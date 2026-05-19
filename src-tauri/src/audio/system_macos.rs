use crate::domain::types::{AppError, AudioLevelDto, RecordingSource, SourceReadinessDto};
use std::{
    io::{BufRead, BufReader},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{mpsc, Arc, Mutex},
    time::Duration,
};

#[derive(Debug, Clone, Default)]
pub struct SystemAudioStats {
    pub level: AudioLevelDto,
    pub last_error: Option<String>,
}

pub struct SystemAudioCapture {
    child: Child,
    stats: Arc<Mutex<SystemAudioStats>>,
    partial_path: PathBuf,
    final_path: PathBuf,
}

impl SystemAudioCapture {
    pub fn start(partial_path: PathBuf, final_path: PathBuf) -> Result<Self, AppError> {
        let helper = helper_executable_path();
        if !helper.exists() {
            return Err(AppError::new(
                "system_audio_unavailable",
                "System audio helper is not built. Run pnpm tauri:dev again.",
            ));
        }
        let mut child = Command::new(helper)
            .arg("--output")
            .arg(&partial_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|error| AppError::new("system_audio_unavailable", error.to_string()))?;
        let stdout = child.stdout.take().ok_or_else(|| {
            AppError::new(
                "system_audio_unavailable",
                "System audio helper stdout is unavailable.",
            )
        })?;
        let stats = Arc::new(Mutex::new(SystemAudioStats::default()));
        let stats_for_thread = Arc::clone(&stats);
        let (ready_tx, ready_rx) = mpsc::channel();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().map_while(Result::ok) {
                let Ok(value) = serde_json::from_str::<serde_json::Value>(&line) else {
                    continue;
                };
                let event = value
                    .get("event")
                    .and_then(|event| event.as_str())
                    .unwrap_or_default();
                match event {
                    "ready" => {
                        let _ = ready_tx.send(Ok(()));
                    }
                    "error" => {
                        let message = value
                            .get("message")
                            .and_then(|message| message.as_str())
                            .unwrap_or("System audio capture failed.")
                            .to_string();
                        if let Ok(mut stats) = stats_for_thread.lock() {
                            stats.last_error = Some(message.clone());
                        }
                        let _ = ready_tx.send(Err(message));
                    }
                    "level" => {
                        let level = value
                            .get("level")
                            .and_then(|level| level.as_str())
                            .and_then(|level| level.parse::<f32>().ok())
                            .unwrap_or_default();
                        if let Ok(mut stats) = stats_for_thread.lock() {
                            stats.level = AudioLevelDto {
                                peak: level,
                                rms: level,
                                recent_peaks: vec![level],
                            };
                        }
                    }
                    _ => {}
                }
            }
        });
        match ready_rx.recv_timeout(Duration::from_secs(8)) {
            Ok(Ok(())) => Ok(Self {
                child,
                stats,
                partial_path,
                final_path,
            }),
            Ok(Err(message)) => {
                let _ = child.kill();
                Err(AppError::new("system_audio_permission_denied", message))
            }
            Err(_) => {
                let _ = child.kill();
                Err(AppError::new(
                    "system_audio_unavailable",
                    "System audio helper did not become ready.",
                ))
            }
        }
    }

    pub fn pause(&mut self) {
        send_signal(self.child.id(), "-USR1");
    }

    pub fn resume(&mut self) {
        send_signal(self.child.id(), "-USR2");
    }

    pub fn status(&self) -> (AudioLevelDto, i64, Option<String>) {
        let level = self
            .stats
            .lock()
            .map(|stats| stats.level.clone())
            .unwrap_or_default();
        let error = self
            .stats
            .lock()
            .ok()
            .and_then(|stats| stats.last_error.clone());
        let bytes = std::fs::metadata(&self.partial_path)
            .or_else(|_| std::fs::metadata(&self.final_path))
            .map(|metadata| metadata.len() as i64)
            .unwrap_or_default();
        (level, bytes, error)
    }

    pub fn stop(mut self) -> Result<PathBuf, AppError> {
        send_signal(self.child.id(), "-TERM");
        let _ = self.child.wait();
        if self.partial_path.exists() {
            std::fs::rename(&self.partial_path, &self.final_path)
                .map_err(|error| AppError::new("audio_finalization_failed", error.to_string()))?;
        }
        Ok(self.final_path)
    }
}

pub fn system_audio_readiness() -> SourceReadinessDto {
    #[cfg(target_os = "macos")]
    {
        let capture_available =
            macos_version_supports_system_audio() && helper_executable_path().exists();
        return SourceReadinessDto {
            source: RecordingSource::System,
            required: true,
            ready: capture_available,
            permission_state: if capture_available {
                "unknown".to_string()
            } else {
                "unsupported".to_string()
            },
            device_available: capture_available,
            capture_available,
            recovery_action: if capture_available {
                Some("openSystemAudioSettings".to_string())
            } else {
                Some("upgradeMacos".to_string())
            },
            message: if capture_available {
                None
            } else {
                Some(
                    "System audio capture requires macOS 14.2 or later and a built capture helper."
                        .to_string(),
                )
            },
        };
    }
    #[cfg(not(target_os = "macos"))]
    {
        SourceReadinessDto {
            source: RecordingSource::System,
            required: true,
            ready: false,
            permission_state: "unsupported".to_string(),
            device_available: false,
            capture_available: false,
            recovery_action: None,
            message: Some("System audio capture is only supported on macOS.".to_string()),
        }
    }
}

pub fn helper_permission_check() -> Result<(), AppError> {
    let helper = helper_executable_path();
    if !helper.exists() {
        return Err(AppError::new(
            "system_audio_unavailable",
            "System audio helper is not built. Run pnpm tauri:dev again.",
        ));
    }
    let output = Command::new(helper)
        .arg("--check")
        .output()
        .map_err(|error| AppError::new("system_audio_unavailable", error.to_string()))?;
    if output.status.success() {
        return Ok(());
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let message = stdout
        .lines()
        .filter_map(|line| serde_json::from_str::<serde_json::Value>(line).ok())
        .find_map(|value| {
            value
                .get("message")
                .and_then(|message| message.as_str())
                .map(str::to_string)
        })
        .unwrap_or_else(|| "System audio permission check failed.".to_string());
    Err(AppError::new("system_audio_permission_denied", message))
}

#[cfg(target_os = "macos")]
fn macos_version_supports_system_audio() -> bool {
    let output = std::process::Command::new("sw_vers")
        .arg("-productVersion")
        .output();
    let Ok(output) = output else {
        return false;
    };
    let version = String::from_utf8_lossy(&output.stdout);
    let mut parts = version
        .trim()
        .split('.')
        .filter_map(|part| part.parse::<u32>().ok());
    let major = parts.next().unwrap_or(0);
    let minor = parts.next().unwrap_or(0);
    major > 14 || (major == 14 && minor >= 2)
}

pub fn helper_executable_path() -> PathBuf {
    let dev_path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("native")
        .join("bin")
        .join("OS Notetaker Audio Capture.app")
        .join("Contents")
        .join("MacOS")
        .join("os-notetaker-system-audio-recorder");
    if dev_path.exists() {
        return dev_path;
    }
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(contents_dir) = current_exe
            .ancestors()
            .find(|path| path.file_name().and_then(|name| name.to_str()) == Some("Contents"))
        {
            let resource_path = contents_dir
                .join("Resources")
                .join("native")
                .join("bin")
                .join("OS Notetaker Audio Capture.app")
                .join("Contents")
                .join("MacOS")
                .join("os-notetaker-system-audio-recorder");
            if resource_path.exists() {
                return resource_path;
            }
        }
    }
    dev_path
}

fn send_signal(pid: u32, signal: &str) {
    let _ = Command::new("kill")
        .arg(signal)
        .arg(pid.to_string())
        .status();
}
