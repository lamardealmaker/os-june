# Research: Conversation Turns for Dual-Source Notes

## Decision: Detect Turns from Finalized WAV Artifacts

**Decision**: Run turn detection after recording finalization using saved WAV files.

**Rationale**: The MVP already prioritizes saved, validated local audio. Finalized-file detection keeps recording reliability independent from provider latency and avoids making provider availability part of the capture path.

**Alternatives Considered**:

- Live segmentation during recording: deferred because it requires rolling finalized chunks from both microphone and system capture paths; adding that before the finalized-file pipeline is stable would increase capture risk.
- Provider diarization: rejected because speaker identity is out of scope and provider support would vary.

## Decision: Background Source-Lane Transcription

**Decision**: After validation succeeds, finish the recording command and run transcription/generation on a backend task. For dual-source recordings, transcribe microphone and system lanes concurrently while keeping each lane sequential.

**Rationale**: Long recordings should not keep the recording UI blocked until all provider work completes. Source-lane concurrency reduces elapsed processing time without removing context from consecutive turns on the same source.

**Alternatives Considered**:

- Fully parallel turn transcription: rejected because short clips lose useful prior context and can produce lower-quality language/name continuity.
- Fully sequential turn transcription: rejected for long dual-source recordings because it scales poorly with meeting length.

## Decision: Source-Specific Activity Thresholds

**Decision**: Use separate activity profiles for microphone and system audio.

**Rationale**: Microphone input often contains room noise, keyboard noise, and breathing. System playback is usually cleaner but may be lower level. One shared threshold would either create microphone false positives or miss system turns.

## Decision: Persist Timing Metadata on Transcript Rows

**Decision**: Store `start_ms`, `end_ms`, and `turn_index` on transcript rows.

**Rationale**: The UI and retry path need durable ordering. Temporary turn audio files can be regenerated, but the persisted transcript should remain stable once processing succeeds.

## Decision: Preserve System Audio Timeline

**Decision**: The system-audio helper writes silence for wall-clock gaps before incoming system frames.

**Rationale**: If a source file compresses inactive periods, its timestamps cannot be compared with microphone timestamps. Silence insertion keeps both source files on the same recording timeline.
