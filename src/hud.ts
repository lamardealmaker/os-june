import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { spinners } from "unicode-animations";
import "./styles/hud.css";

type DictationHudEvent = {
  type: string;
  payload?: {
    app?: string;
    code?: string;
    message?: string;
    level?: string;
    [key: string]: unknown;
  };
};

const appWindow = getCurrentWindow();
const hud = document.querySelector<HTMLDivElement>("#hud");
const dragHandle = document.querySelector<HTMLElement>("#hud-handle");
const bars = Array.from(document.querySelectorAll<HTMLElement>(".hud-bar"));
const brailleNode = document.querySelector<HTMLElement>("#hud-braille");
const errorText = document.querySelector<HTMLElement>("#hud-error-text");
const stopButton = document.querySelector<HTMLButtonElement>("#hud-stop");
const statusText = document.querySelector<HTMLElement>("#hud-status");

let hideTimer: number | undefined;
let brailleTimer: number | undefined;
let brailleFrame = 0;
let stopHoverPollTimer: number | undefined;

// waverows shows multiple horizontal rows of dots flowing across — reads as a
// "thinking/processing" texture rather than a single dot bouncing.
const brailleWave = spinners.waverows;

// Matches the .hud[data-state="exiting"] transition in hud.css.
const EXIT_TRANSITION_MS = 160;

// Zero idle plus the CSS 3px base height makes silence read as a dot row.
const IDLE_LEVEL = 0;

// Single RMS samples arrive from the helper at ~25Hz. This is the middle
// ground between the earlier centered crest and the too-jumpy history-only
// pass: each bar still has its own shape, but it blends the newest level with
// a nearby recent sample so the motion feels coherent.
const BAR_WEIGHTS = [0.64, 0.86, 0.7, 0.84, 0.58];
const BAR_HISTORY_OFFSETS = [1, 0, 1, 0, 1];
const LEVEL_HISTORY_LENGTH = 8;
const LIVE_LEVEL_MIX = 0.7;
const ATTACK_ALPHA = 0.44;
const RELEASE_ALPHA = 0.48;
const IDLE_SNAP_DELTA = 0.004;

const levelHistory: number[] = new Array(LEVEL_HISTORY_LENGTH).fill(IDLE_LEVEL);
const displayedLevels: number[] = new Array(bars.length).fill(IDLE_LEVEL);
const targetLevels: number[] = new Array(bars.length).fill(IDLE_LEVEL);
let levelHead = 0;

let rafHandle: number | undefined;
let lastAudioLevelAt = 0;
const IDLE_RAF_TIMEOUT_MS = 260;
const AUDIO_NOISE_GATE = 0.012;
const AUDIO_VISUAL_GAIN = 16;
const AMBIENT_VISUAL_GAIN = 4;
const AMBIENT_MAX_LEVEL = 0.11;
const STOP_HOVER_POLL_MS = 33;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function setTargetLevels(level: number) {
  levelHead = (levelHead + 1) % LEVEL_HISTORY_LENGTH;
  levelHistory[levelHead] = level;

  for (let i = 0; i < bars.length; i++) {
    const weight = BAR_WEIGHTS[i] ?? 0.5;
    const offset = BAR_HISTORY_OFFSETS[i] ?? 0;
    const historyIndex =
      (levelHead - offset + LEVEL_HISTORY_LENGTH) % LEVEL_HISTORY_LENGTH;
    const blendedLevel =
      levelHistory[levelHead] * LIVE_LEVEL_MIX +
      levelHistory[historyIndex] * (1 - LIVE_LEVEL_MIX);
    targetLevels[i] = clamp(IDLE_LEVEL + blendedLevel * weight, IDLE_LEVEL, 1);
  }
}

function setHud(state: string, status: string) {
  if (!hud || !statusText) return;
  const previous = hud.dataset.state;
  hud.dataset.state = state;
  statusText.textContent = status;
  if (errorText) {
    errorText.textContent = state === "silent-error" ? status : "";
  }
  if (state === "transcribing" || state === "pasting") {
    startBraille();
  } else if (previous === "transcribing" || previous === "pasting") {
    stopBraille();
  }
  if (state === "listening") {
    startBarLoop();
  } else if (state !== "listening" && previous === "listening") {
    // Bars hide via CSS in non-listening states; let the rAF coast to idle
    // and stop itself.
  }
}

function startBarLoop() {
  if (rafHandle !== undefined) return;
  const tick = () => {
    let stillAnimating = false;
    for (let i = 0; i < bars.length; i++) {
      const diff = targetLevels[i] - displayedLevels[i];
      const alpha = diff > 0 ? ATTACK_ALPHA : RELEASE_ALPHA;
      displayedLevels[i] = clamp(displayedLevels[i] + diff * alpha, 0, 1);

      if (
        targetLevels[i] === IDLE_LEVEL &&
        Math.abs(displayedLevels[i] - IDLE_LEVEL) < IDLE_SNAP_DELTA
      ) {
        displayedLevels[i] = IDLE_LEVEL;
      }

      if (Math.abs(targetLevels[i] - displayedLevels[i]) > 0.004) {
        stillAnimating = true;
      }

      bars[i].style.setProperty("--level", displayedLevels[i].toFixed(3));
    }
    const sinceAudio = performance.now() - lastAudioLevelAt;
    if (stillAnimating || sinceAudio < IDLE_RAF_TIMEOUT_MS) {
      rafHandle = window.requestAnimationFrame(tick);
    } else {
      rafHandle = undefined;
    }
  };
  rafHandle = window.requestAnimationFrame(tick);
}

function resetBars() {
  for (let i = 0; i < LEVEL_HISTORY_LENGTH; i++) {
    levelHistory[i] = IDLE_LEVEL;
  }
  for (let i = 0; i < bars.length; i++) {
    targetLevels[i] = IDLE_LEVEL;
    displayedLevels[i] = IDLE_LEVEL;
    bars[i].style.setProperty("--level", IDLE_LEVEL.toFixed(3));
  }
  levelHead = 0;
  lastAudioLevelAt = performance.now();
}

function renderAudioLevel(rawLevel: number) {
  const shaped =
    rawLevel <= AUDIO_NOISE_GATE
      ? clamp(Math.sqrt(rawLevel * AMBIENT_VISUAL_GAIN), 0, AMBIENT_MAX_LEVEL)
      : clamp(
          AMBIENT_MAX_LEVEL +
            Math.sqrt((rawLevel - AUDIO_NOISE_GATE) * AUDIO_VISUAL_GAIN),
          0,
          1,
        );
  lastAudioLevelAt = performance.now();
  setTargetLevels(shaped);
  startBarLoop();
}

function startBraille() {
  if (!brailleNode || brailleTimer !== undefined) return;
  brailleFrame = 0;
  brailleNode.textContent = brailleWave.frames[0] ?? "";
  brailleTimer = window.setInterval(() => {
    brailleFrame = (brailleFrame + 1) % brailleWave.frames.length;
    if (brailleNode) {
      brailleNode.textContent = brailleWave.frames[brailleFrame] ?? "";
    }
  }, brailleWave.interval);
}

function stopBraille() {
  if (brailleTimer !== undefined) {
    window.clearInterval(brailleTimer);
    brailleTimer = undefined;
  }
}

function setStopHover(isHovered: boolean) {
  stopButton?.classList.toggle("is-hovered", isHovered);
}

let stopHoverPollInFlight = false;

async function updateStopHoverFromNativeHitTest() {
  if (!hud || !stopButton || hud.dataset.state !== "listening") {
    setStopHover(false);
    return;
  }
  if (stopHoverPollInFlight) return;

  stopHoverPollInFlight = true;
  try {
    const { left, right, top, bottom } = stopButton.getBoundingClientRect();
    const isHovered = await invoke<boolean>("dictation_hud_hit_test", {
      rect: { left, right, top, bottom },
    });
    setStopHover(isHovered);
  } catch {
    setStopHover(false);
  } finally {
    stopHoverPollInFlight = false;
  }
}

function startStopHoverPolling() {
  if (stopHoverPollTimer !== undefined) return;
  stopHoverPollTimer = window.setInterval(() => {
    void updateStopHoverFromNativeHitTest();
  }, STOP_HOVER_POLL_MS);
  void updateStopHoverFromNativeHitTest();
}

function stopStopHoverPolling() {
  if (stopHoverPollTimer !== undefined) {
    window.clearInterval(stopHoverPollTimer);
    stopHoverPollTimer = undefined;
  }
  setStopHover(false);
}

function clearHideTimer() {
  if (hideTimer) {
    window.clearTimeout(hideTimer);
    hideTimer = undefined;
  }
}

async function hideHud() {
  clearHideTimer();
  stopStopHoverPolling();
  if (hud) {
    hud.dataset.state = "exiting";
    stopBraille();
    await new Promise((resolve) =>
      window.setTimeout(resolve, EXIT_TRANSITION_MS),
    );
  }
  await appWindow.hide();
}

async function showHud() {
  clearHideTimer();
  await appWindow.show();
  startStopHoverPolling();
}

function hideSoon(delay = 900) {
  clearHideTimer();
  hideTimer = window.setTimeout(() => {
    void hideHud();
  }, delay);
}

async function handleDictationEventPayload(payload: unknown) {
  const dictationEvent = parseEvent(payload);
  if (!dictationEvent) return;

  if (dictationEvent.type === "listening_started") {
    resetBars();
    setHud("listening", "Listening");
    await showHud();
    return;
  }

  if (dictationEvent.type === "audio_level") {
    const level = Number(dictationEvent.payload?.level || 0);
    renderAudioLevel(level);
    setHud("listening", "Listening");
    return;
  }

  if (dictationEvent.type === "finalizing_transcript") {
    setHud("transcribing", "Transcribing");
    await showHud();
    return;
  }

  if (dictationEvent.type === "final_transcript") {
    setHud("pasting", "Pasting");
    await showHud();
    return;
  }

  if (dictationEvent.type === "paste_target") {
    setHud(
      "pasting",
      `Pasting into ${dictationEvent.payload?.app || "previous app"}`,
    );
    await showHud();
    return;
  }

  if (dictationEvent.type === "paste_completed") {
    void hideHud();
    return;
  }

  if (dictationEvent.type === "error") {
    const errorCode =
      typeof dictationEvent.payload?.code === "string"
        ? dictationEvent.payload.code
        : "";
    const errorMessage = dictationEvent.payload?.message || "";
    if (isSilentDictationError(errorCode, errorMessage)) {
      setHud("silent-error", "Nothing recorded");
    } else {
      setHud("error", errorMessage || "Dictation failed.");
    }
    await showHud();
    hideSoon(900);
  }
}

function isSilentDictationError(code: string, message: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    [
      "missing_recording",
      "no_speech",
      "no_transcription",
      "empty_transcript",
      "transcription_empty",
    ].includes(code) ||
    normalizedMessage.includes("empty transcript") ||
    normalizedMessage.includes("no transcript") ||
    normalizedMessage.includes("no speech") ||
    normalizedMessage.includes("no recorded audio") ||
    normalizedMessage.includes("audio file is too short") ||
    normalizedMessage.includes("did not return any transcript")
  );
}

function parseEvent(payload: unknown): DictationHudEvent | undefined {
  try {
    if (typeof payload === "string") {
      return JSON.parse(payload) as DictationHudEvent;
    }
    if (payload && typeof payload === "object") {
      return payload as DictationHudEvent;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

dragHandle?.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  void appWindow.startDragging().catch(() => {});
});

stopButton?.addEventListener("click", async (event) => {
  event.preventDefault();
  setStopHover(false);
  if (hud?.dataset.state === "listening") {
    setHud("transcribing", "Transcribing");
  }
  try {
    await invoke("dictation_helper_command", {
      command: { type: "stop_and_paste" },
    });
  } catch {
    void hideHud();
  }
});

void listen("dictation-event", async (event) => {
  await handleDictationEventPayload(event.payload);
});

void invoke<string | undefined>("latest_dictation_event")
  .then((payload) => {
    if (payload) {
      return handleDictationEventPayload(payload);
    }
  })
  .catch(() => {});
