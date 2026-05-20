# Data Model: Conversation Turns

## Audio Turn

Runtime entity derived from source audio.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `artifact_id` | UUID string | Yes | Source audio artifact used for extraction |
| `source` | enum | Yes | `microphone` or `system` |
| `source_path` | path | Yes | Saved local WAV path |
| `start_ms` | integer | Yes | Start offset on the recording timeline |
| `end_ms` | integer | Yes | End offset on the recording timeline |
| `turn_index` | integer | Yes | Chronological order after merging all sources |

## Transcript

Existing transcript record extended for ordered turns.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `start_ms` | integer | No | Present for turn transcript rows |
| `end_ms` | integer | No | Present for turn transcript rows |
| `turn_index` | integer | No | Present for ordered turn transcript rows |

## Rules

- `turn_index` is assigned after all source turns are sorted by `start_ms`.
- If two sources start at the same offset, microphone sorts before system for deterministic display.
- Transcript rows without turn metadata remain supported for older microphone-only notes.
- Generation uses valid turn transcript rows ordered by `turn_index`, then `start_ms`.

## Manual Notes

Manual notes are user-written note content stored in the existing editable note content before generation.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `edited_content` | text | No | Used as manual note context when present before generation |

## Manual Note Rules

- Manual notes are user-authored context, not transcript rows.
- Manual notes are passed to generation together with the transcript.
- Generated output is appended below existing editable content so manual notes are not overwritten.
