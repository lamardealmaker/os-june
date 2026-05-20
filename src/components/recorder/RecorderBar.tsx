import type { RecordingStatusDto } from "../../lib/tauri";
import { Waveform } from "./Waveform";

type RecorderBarProps = {
  status: RecordingStatusDto;
  onPause: (sessionId: string) => void;
  onResume: (sessionId: string) => void;
  onDone: (sessionId: string) => void;
};

export function RecorderBar({
  status,
  onPause,
  onResume,
  onDone,
}: RecorderBarProps) {
  const paused = status.state === "paused";
  const controlsEnabled =
    status.state === "recording" || status.state === "paused";
  const sources = status.sources?.length
    ? status.sources
    : [
        {
          source: "microphone" as const,
          state: status.state,
          elapsedMs: status.elapsedMs,
          bytesWritten: status.bytesWritten,
          level: status.level,
          silenceWarning: status.silenceWarning,
          pathFinalized: false,
        },
      ];
  const pauseLabel = paused
    ? "Resume"
    : status.state === "recording"
      ? "Pause"
      : status.state === "starting"
        ? "Starting"
        : "Finalizing";

  return (
    <div className="recorder-bar" data-state={status.state}>
      <button
        type="button"
        disabled={!controlsEnabled}
        onClick={() =>
          paused ? onResume(status.sessionId) : onPause(status.sessionId)
        }
      >
        {pauseLabel}
      </button>
      <div className="recorder-meter">
        <span className="elapsed">{formatElapsed(status.elapsedMs)}</span>
        <Waveform level={status.level} />
      </div>
      {sources.length > 1 ? (
        <div className="source-status-list" aria-label="Recording sources">
          {sources.map((source) => (
            <div className="source-status" key={source.source}>
              <span>{labelForSource(source.source)}</span>
              <Waveform level={source.level} />
              <span>{source.bytesWritten} bytes</span>
              {source.silenceWarning ? (
                <span className="source-warning">Silent</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="done-button"
        disabled={!controlsEnabled}
        onClick={() => onDone(status.sessionId)}
      >
        {controlsEnabled ? "Done" : "Working"}
      </button>
      {status.silenceWarning ? (
        <p className="recorder-warning" role="status">
          Microphone input appears silent
        </p>
      ) : null}
      {status.warnings?.map((warning) => (
        <p className="recorder-warning" role="status" key={warning.code}>
          {warning.message}
        </p>
      ))}
    </div>
  );
}

export function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function labelForSource(source: string) {
  return source === "system" ? "System audio" : "Microphone";
}
