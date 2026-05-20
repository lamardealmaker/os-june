import type { ProcessingStatus } from "../lib/tauri";

export function shouldPollProcessingStatus(status: ProcessingStatus) {
  return status === "transcribing" || status === "generating";
}
