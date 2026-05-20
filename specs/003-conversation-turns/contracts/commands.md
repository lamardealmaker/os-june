# Command Contract Changes

No new Tauri commands are required.

Existing note retrieval responses include additional optional fields on `TranscriptDto`:

```ts
type TranscriptDto = {
  id: string;
  text: string;
  sourceMode?: "microphoneOnly" | "microphonePlusSystem";
  source?: "microphone" | "system";
  startMs?: number;
  endMs?: number;
  turnIndex?: number;
  language?: string;
  status: "pending" | "running" | "succeeded" | "failed";
  lastError?: string;
};
```

`sourceTranscripts` are returned in conversation order when `turnIndex` exists.
