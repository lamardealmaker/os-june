import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  AGENT_NEW_SESSION_EVENT,
  AGENT_SELECT_SESSION_EVENT,
  AGENT_SESSIONS_CHANGED_EVENT,
} from "../components/agent/AgentWorkspace";
import { NotesList } from "../components/notes-list/NotesList";
import { Sidebar } from "../components/sidebar/Sidebar";
import type { FolderDto, NoteListItemDto } from "../lib/tauri";

const now = "2026-05-19T10:00:00Z";

const folders: FolderDto[] = [
  { id: "folder-1", name: "Ideas", createdAt: now, updatedAt: now },
  { id: "folder-2", name: "Work", createdAt: now, updatedAt: now },
];

const notes: NoteListItemDto[] = [
  {
    id: "note-2",
    title: "Second",
    preview: "Second preview",
    processingStatus: "ready",
    folderIds: ["folder-1"],
    createdAt: "2026-05-19T11:00:00Z",
    updatedAt: "2026-05-19T11:00:00Z",
  },
  {
    id: "note-1",
    title: "",
    preview: "",
    processingStatus: "draft",
    folderIds: [],
    createdAt: now,
    updatedAt: now,
  },
];

describe("folders UI", () => {
  it("renders the meetings entry and starts agent sessions from the sidebar", async () => {
    const user = userEvent.setup();
    const onCreateNote = vi.fn();
    const onChangeView = vi.fn();
    const onNewSession = vi.fn();
    window.addEventListener(AGENT_NEW_SESSION_EVENT, onNewSession);
    render(
      <Sidebar
        folders={folders}
        notes={notes}
        selectedNoteId="note-2"
        selectedFolderId={undefined}
        activeView="meetings"
        onChangeView={onChangeView}
        onCreateFolder={vi.fn()}
        onCreateNote={onCreateNote}
        onSelectAll={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onOpenMoveDialog={vi.fn()}
        onRemoveNoteFromFolder={vi.fn()}
      />,
    );

    expect(screen.getByText("Scribe")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Meetings" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Agent" })).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Meetings" }));
    await user.click(screen.getByRole("button", { name: "New Session +" }));

    expect(onChangeView).toHaveBeenCalledWith("meetings");
    expect(onChangeView).toHaveBeenCalledWith("agent");
    expect(onCreateNote).not.toHaveBeenCalled();
    await waitFor(() => expect(onNewSession).toHaveBeenCalled());

    window.removeEventListener(AGENT_NEW_SESSION_EVENT, onNewSession);
  });

  it("renders agent sessions in the sidebar and selects them", async () => {
    const user = userEvent.setup();
    const onChangeView = vi.fn();
    const onSelectAgentSession = vi.fn();
    window.addEventListener(AGENT_SELECT_SESSION_EVENT, onSelectAgentSession);
    render(
      <Sidebar
        folders={folders}
        notes={notes}
        selectedNoteId="note-2"
        selectedFolderId={undefined}
        activeView="notes"
        onChangeView={onChangeView}
        onCreateFolder={vi.fn()}
        onCreateNote={vi.fn()}
        onSelectAll={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onOpenMoveDialog={vi.fn()}
        onRemoveNoteFromFolder={vi.fn()}
      />,
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent(AGENT_SESSIONS_CHANGED_EVENT, {
          detail: {
            sessions: [
              {
                id: "session-1",
                title: "Researching Google",
                preview: "Generate a PDF",
                last_active: "2026-06-04T19:00:00Z",
              },
            ],
            selectedSessionId: "session-1",
            workingSessionIds: ["session-1"],
          },
        }),
      );
    });

    expect(await screen.findByText("Researching Google")).toBeInTheDocument();
    expect(screen.getByLabelText("Working")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Researching Google/ }),
    );

    expect(onChangeView).toHaveBeenCalledWith("agent");
    await waitFor(() => expect(onSelectAgentSession).toHaveBeenCalled());
    const detail = (onSelectAgentSession.mock.calls[0][0] as CustomEvent)
      .detail;
    expect(detail).toEqual({ sessionId: "session-1" });

    window.removeEventListener(
      AGENT_SELECT_SESSION_EVENT,
      onSelectAgentSession,
    );
  });

  it("shows notes with placeholders and selects notes", async () => {
    const user = userEvent.setup();
    const onSelectNote = vi.fn();
    const { container } = render(
      <NotesList
        notes={notes}
        selectedNoteId="note-2"
        onSelectNote={onSelectNote}
        onCreateNote={vi.fn()}
        onOpenMoveDialog={vi.fn()}
        onDeleteNote={vi.fn()}
      />,
    );
    const list = within(
      container.querySelector(".all-notes-list") as HTMLElement,
    );

    expect(list.getByRole("button", { name: /^Second/ })).toBeInTheDocument();
    expect(screen.queryByText("Ideas")).not.toBeInTheDocument();

    await user.click(list.getByRole("button", { name: /^Second/ }));
    expect(onSelectNote).toHaveBeenCalledWith("note-2");
  });

  it("labels future-dated notes explicitly", () => {
    render(
      <NotesList
        notes={[
          {
            ...notes[0],
            id: "future-note",
            updatedAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
        ]}
        onSelectNote={vi.fn()}
        onCreateNote={vi.fn()}
        onOpenMoveDialog={vi.fn()}
        onDeleteNote={vi.fn()}
      />,
    );

    expect(screen.getByText("Future")).toBeInTheDocument();
  });

  it("shows empty state with create action", () => {
    render(
      <NotesList
        notes={[]}
        onSelectNote={vi.fn()}
        onCreateNote={vi.fn()}
        onOpenMoveDialog={vi.fn()}
        onDeleteNote={vi.fn()}
      />,
    );

    expect(screen.getByText("No notes yet.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create your first note" }),
    ).toBeInTheDocument();
  });
});
