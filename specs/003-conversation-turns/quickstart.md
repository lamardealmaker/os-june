# Quickstart: Conversation Turns

## Run

```bash
pnpm install
pnpm tauri:dev
```

## Manual Validation

1. Select `Microphone + system audio`.
2. Play audible system audio for a few seconds.
3. Speak into the microphone before and after the system playback.
4. Select Done.
5. Open the Transcription tab.
6. Verify the rows appear in observed conversation order with `Microphone` and `System` labels.
7. Verify generated notes reflect the ordered transcript.

## Automated Checks

```bash
pnpm test:rust
pnpm test
pnpm run lint
pnpm tauri:build
```
