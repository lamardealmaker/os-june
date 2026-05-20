# Feature Specification: Conversation Turns for Dual-Source Notes

**Feature Branch**: `003-conversation-turns`  
**Created**: 2026-05-20  
**Status**: Draft  
**Input**: User description: "Order microphone and system transcription as a conversation by intervention or turn, without speaker diarization. The app should use the automatic split points, account for microphone noise and system-audio sensitivity differences, and display the transcript as ordered Microphone/System turns."

## User Scenarios & Testing

### User Story 1 - Read a Dual-Source Recording as Conversation Turns (Priority: P1)

A user records with `Microphone + system audio`, stops the note, and sees the Transcription tab as a chronological conversation with source labels such as `Microphone` and `System`.

**Independent Test**: Play system audio, speak into the microphone at separate moments, finish recording, and verify the transcript rows appear in the order the interventions happened.

**Acceptance Scenarios**:

1. **Given** both sources contain usable speech, **When** processing completes, **Then** the transcript is displayed as ordered source turns rather than grouped source blocks.
2. **Given** a system turn happens between two microphone turns, **When** processing completes, **Then** the order is Microphone, System, Microphone.
3. **Given** the same transcript is used for note generation, **When** generation runs, **Then** it uses the ordered conversation text.

---

### User Story 2 - Avoid False Turns from Background Noise (Priority: P1)

A user records in a normal room where the microphone contains low background noise while system audio may be quieter or intermittent.

**Independent Test**: Record with mild microphone room noise plus distinct speech and system playback; verify background noise alone does not create many microphone turns.

**Acceptance Scenarios**:

1. **Given** microphone background noise remains below the detected activity threshold, **When** processing runs, **Then** it is not emitted as a separate turn.
2. **Given** system audio has clear playback separated by silence, **When** processing runs, **Then** it is detected even if its level is lower than the microphone.
3. **Given** either source has short gaps inside the same intervention, **When** processing runs, **Then** the app merges nearby active windows into a single turn.

---

### User Story 3 - Preserve Recoverable Source Artifacts (Priority: P2)

A user should still be able to retry processing from saved audio even if turn transcription or generation fails.

**Independent Test**: Force provider failure after audio validation, retry, and verify the app reuses saved source audio and recomputes ordered turns.

**Acceptance Scenarios**:

1. **Given** audio validation succeeded, **When** turn transcription fails, **Then** saved source audio remains available for retry.
2. **Given** only one source produces valid turns, **When** processing completes, **Then** generation can continue from the valid source with source labels preserved.

## Requirements

### Functional Requirements

- **FR-001**: The app MUST create source-labeled transcript rows ordered by conversation turn for dual-source recordings.
- **FR-002**: The app MUST label turns only as `Microphone` or `System`; speaker identity and diarization are out of scope.
- **FR-003**: Turn ordering MUST be based on persisted timing metadata: `start_ms`, `end_ms`, and `turn_index`.
- **FR-004**: The microphone and system sources MUST use separate activity-detection thresholds tuned for their different noise profiles.
- **FR-005**: Microphone turn detection MUST tolerate low background noise and avoid emitting turns from short or low-level noise bursts.
- **FR-006**: System turn detection MUST support lower-level but clean playback without requiring microphone-style thresholds.
- **FR-007**: The app MUST merge short gaps inside the same source intervention into one turn.
- **FR-008**: The app MUST preserve system-audio wall-clock timing by writing silence for inactive gaps or by storing equivalent timing metadata.
- **FR-009**: The Transcription tab MUST display ordered turns instead of source-grouped transcript blocks when turn metadata exists.
- **FR-010**: Note generation MUST use the ordered turn transcript for dual-source recordings.
- **FR-011**: Retry MUST recompute or reuse turn ordering from saved source artifacts without requiring a new recording.
- **FR-012**: Realtime captions and live transcript updates remain out of scope.
- **FR-013**: The app SHOULD send recent valid transcript context to the transcription provider when processing later turns, when the provider supports contextual prompts.
- **FR-014**: The app SHOULD coalesce adjacent same-source turns before transcription when no other source intervenes and the silence gap is short.
- **FR-015**: The app SHOULD coalesce adjacent same-source transcript rows before persistence when transcription still produces consecutive fragments.
- **FR-016**: The app SHOULD support an optional local transcription language override using an ISO-639-1 code to reduce language misclassification on short clips.
- **FR-017**: After audio validation succeeds, the app SHOULD continue transcription and generation in the background so the recording controls can return immediately while the note shows processing status.
- **FR-018**: Dual-source turn transcription SHOULD run microphone and system lanes concurrently while preserving sequential context within each source lane and final chronological turn ordering.
- **FR-019**: The app MUST allow the user to write manual notes during recording and include those manual notes with the transcript when generating the final note.
- **FR-020**: Generated notes MUST preserve user-written manual notes and MUST NOT overwrite them.

### Key Entities

- **Audio Turn**: A detected active source interval with `source`, source artifact reference, `start_ms`, `end_ms`, and `turn_index`.
- **Source Transcript Row**: A transcript result for one turn, persisted with timing metadata and source label.
- **Ordered Conversation Transcript**: A newline-separated transcript assembled from valid source transcript rows sorted by turn order.
- **Manual Notes**: User-written note content captured before generation and supplied as user-authored context alongside the transcript.

## Success Criteria

- **SC-001**: In a manual recording with at least three alternating interventions, the displayed transcript order matches the observed order.
- **SC-002**: In a recording with mild microphone background noise, the app does not create many noise-only microphone turns.
- **SC-003**: Generated notes reflect the ordered conversation transcript and preserve source labels as context.
- **SC-004**: Retry from saved audio produces the same source order for the same recording artifacts.
- **SC-005**: Short same-source fragments separated by brief pauses are displayed as one transcript turn when no other source intervenes.
- **SC-006**: Manual notes written during recording are present in the final editable note and are used as context for generation.

## Assumptions

- Turn ordering is based on source activity windows and is not expected to identify individual people.
- Processing starts after finalized audio validation; transcription and generation may continue in the background after the user selects Done.
- Source recordings are local WAV artifacts that can be read for activity analysis and turn extraction.
- The previous source-mode behavior remains valid except where this feature replaces source-grouped transcript display with ordered turn display.
