import { describe, expect, it } from "vitest";
import { completeProjectClose, needsSavePrompt } from "./project-close";

describe("manual save before closing", () => {
  it("asks about an unsaved recording or edit", () => {
    expect(needsSavePrompt("saved-project", "before", "after-recording", false)).toBe(true);
    expect(needsSavePrompt("saved-project", "before", "before", true)).toBe(true);
  });
  it("asks about a project never saved, but not an unchanged saved project", () => {
    expect(needsSavePrompt(undefined, "same", "same", false)).toBe(true);
    expect(needsSavePrompt("saved-project", "same", "same", false)).toBe(false);
  });
  it("keeps the project open when saving fails or is declined", async () => {
    let closed = false;
    expect(
      await completeProjectClose(
        async () => false,
        () => {
          closed = true;
        },
      ),
    ).toBe(false);
    expect(closed).toBe(false);
  });
  it("closes only after saving finishes successfully", async () => {
    const order: string[] = [];
    await completeProjectClose(
      async () => {
        order.push("saved");
        return true;
      },
      () => order.push("closed"),
    );
    expect(order).toEqual(["saved", "closed"]);
  });
});
