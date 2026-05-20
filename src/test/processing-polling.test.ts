import { describe, expect, it } from "vitest";
import { shouldPollProcessingStatus } from "../app/processing-polling";

describe("shouldPollProcessingStatus", () => {
  it("polls while backend processing is still running", () => {
    expect(shouldPollProcessingStatus("transcribing")).toBe(true);
    expect(shouldPollProcessingStatus("generating")).toBe(true);
  });

  it("does not poll terminal or recording statuses", () => {
    expect(shouldPollProcessingStatus("ready")).toBe(false);
    expect(shouldPollProcessingStatus("failed")).toBe(false);
    expect(shouldPollProcessingStatus("recording")).toBe(false);
  });
});
