import { describe, expect, it } from "vitest";
import { textForManualSpeech } from "./spoken-playback";

describe("textForManualSpeech", () => {
  it("uses the server's choice, including a summary", async () => {
    await expect(
      textForManualSpeech({
        fallback: "The long reply.",
        lookup: async () => ({ text: "Done. Next is the review.", hostSpoken: false }),
      }),
    ).resolves.toBe("Done. Next is the review.");
  });

  it("does not replace an empty server choice with the full reply", async () => {
    await expect(
      textForManualSpeech({
        fallback: "The long reply.",
        lookup: async () => ({ text: "", hostSpoken: false }),
      }),
    ).resolves.toBe("");
  });

  it("keeps the on-screen reply when the lookup fails", async () => {
    await expect(
      textForManualSpeech({
        fallback: "The long reply.",
        lookup: async () => {
          throw new Error("offline");
        },
      }),
    ).resolves.toBe("The long reply.");
  });
});
