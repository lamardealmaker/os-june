# Tasks: Conversation Turns for Dual-Source Notes

**Input**: Design documents from `/specs/003-conversation-turns/`  
**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, contracts

## Phase 1: Tests First

- [x] T001 Add Rust turn-detection test using synthetic microphone and system WAV files in `src-tauri/tests/turn_detection.rs`.
- [x] T002 Update source transcript assembly test to expect chronological turn labels in `src-tauri/tests/source_processing.rs`.

## Phase 2: Backend Turn Detection

- [x] T003 Add `src-tauri/src/audio/turns.rs` with RMS-window detection, source-specific thresholds, gap merging, chronological ordering, and WAV turn extraction.
- [x] T004 Export the turn detection module from `src-tauri/src/audio/mod.rs`.
- [x] T005 Extend transcript DTOs and SQLite migrations with `start_ms`, `end_ms`, and `turn_index`.
- [x] T006 Persist and query transcript rows in turn order from `src-tauri/src/db/repositories.rs`.

## Phase 3: Processing Pipeline

- [x] T007 Detect turns before source transcription in `src-tauri/src/domain/processing.rs`.
- [x] T008 Transcribe turn WAV segments and persist timing metadata.
- [x] T009 Assemble generation transcript from valid turn rows in chronological order.
- [x] T010 Keep retry path compatible with saved source audio.
- [x] T010a Coalesce adjacent same-source turns before provider transcription.
- [x] T010b Send recent valid transcript context to providers that support transcription prompts.
- [x] T010c Coalesce adjacent same-source transcript rows before persistence.
- [x] T010d Add optional ISO-639-1 transcription language override for short clips.
- [x] T010e Run dual-source transcription as concurrent source lanes with per-source context.
- [x] T010f Continue validated recording processing in the background and poll active notes from the frontend.
- [x] T010g Pass user-written manual notes into final note generation and preserve them in editable content.

## Phase 4: System Timeline

- [x] T011 Preserve system-audio wall-clock gaps in `src-tauri/native/mac-system-audio-recorder/main.swift`.

## Phase 5: Frontend

- [x] T012 Extend frontend transcript types in `src/lib/tauri.ts`.
- [x] T013 Render ordered source turn rows in `src/components/note-editor/NoteEditor.tsx`.
- [x] T014 Style turn rows in `src/styles/app.css`.

## Phase 6: Verification

- [x] T015 Run Rust tests.
- [x] T016 Run frontend tests and lint.
- [x] T017 Run Tauri build verification.
