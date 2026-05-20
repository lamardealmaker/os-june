import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NoteEditor } from "../components/note-editor/NoteEditor";
import type { NoteDto } from "../lib/tauri";

const now = "2026-05-19T10:00:00Z";

function note(overrides: Partial<NoteDto> = {}): NoteDto {
  return {
    id: "note-1",
    title: "Generated note",
    preview: "Preview",
    processingStatus: "ready",
    folderIds: [],
    createdAt: now,
    updatedAt: now,
    generatedContent: "Generated body",
    activeTab: "notes",
    ...overrides,
  };
}

const props = {
  folders: [],
  sourceMode: "microphoneOnly" as const,
  checkingSourceReadiness: false,
  onTitleChange: vi.fn(),
  onContentChange: vi.fn(),
  onSourceModeChange: vi.fn(),
  onStartRecording: vi.fn(),
  onPauseRecording: vi.fn(),
  onResumeRecording: vi.fn(),
  onFinishRecording: vi.fn(),
  onRetry: vi.fn(),
  onAssignFolder: vi.fn(),
  onRemoveFolder: vi.fn(),
  onTabChange: vi.fn(),
};

describe("NoteEditor", () => {
  it("edits title and generated note body", async () => {
    const user = userEvent.setup();
    const onTitleChange = vi.fn();
    const onContentChange = vi.fn();
    render(
      <NoteEditor
        {...props}
        note={note()}
        onTitleChange={onTitleChange}
        onContentChange={onContentChange}
      />,
    );

    await user.type(screen.getByLabelText("Note title"), " updated");
    await user.type(screen.getByLabelText("Generated note"), " extra");

    expect(onTitleChange).toHaveBeenCalled();
    expect(onContentChange).toHaveBeenCalled();
  });

  it("shows raw transcript in transcription tab", () => {
    render(
      <NoteEditor
        {...props}
        note={note({
          activeTab: "transcription",
          transcript: {
            id: "transcript-1",
            text: "Exact raw transcript",
            status: "succeeded",
          },
        })}
      />,
    );

    expect(screen.getByText("Exact raw transcript")).toBeInTheDocument();
  });

  it("shows source transcript turns with labels and timing", () => {
    render(
      <NoteEditor
        {...props}
        note={note({
          activeTab: "transcription",
          sourceTranscripts: [
            {
              id: "turn-1",
              text: "System playback text",
              source: "system",
              startMs: 1000,
              endMs: 2500,
              turnIndex: 0,
              status: "succeeded",
            },
            {
              id: "turn-2",
              text: "Microphone response",
              source: "microphone",
              startMs: 3000,
              endMs: 4500,
              turnIndex: 1,
              status: "succeeded",
            },
          ],
        })}
      />,
    );

    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("Microphone")).toBeInTheDocument();
    expect(screen.getByText("0:01-0:03")).toBeInTheDocument();
    expect(screen.getByText("System playback text")).toBeInTheDocument();
    expect(screen.getByText("Microphone response")).toBeInTheDocument();
  });

  it("requests tab change when Transcription is selected", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<NoteEditor {...props} note={note()} onTabChange={onTabChange} />);

    await user.click(screen.getByRole("tab", { name: "Transcription" }));

    expect(onTabChange).toHaveBeenCalledWith("transcription");
  });

  it("offers retry when transcript failed and audio exists", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <NoteEditor
        {...props}
        onRetry={onRetry}
        note={note({
          activeTab: "transcription",
          processingStatus: "failed",
          lastError: "Transcription failed",
          audio: {
            id: "audio-1",
            source: "microphone",
            format: "wav",
            durationMs: 1200,
            sizeBytes: 2048,
            checksum: "abc",
            createdAt: now,
          },
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalled();
  });

  it("keeps showing working state and hides retry while processing", () => {
    render(
      <NoteEditor
        {...props}
        note={note({
          activeTab: "transcription",
          processingStatus: "transcribing",
          audio: {
            id: "audio-1",
            source: "microphone",
            format: "wav",
            durationMs: 1200,
            sizeBytes: 2048,
            checksum: "abc",
            createdAt: now,
          },
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "Working" })).toBeDisabled();
    expect(screen.getByText("Transcribing audio...")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
  });
});
