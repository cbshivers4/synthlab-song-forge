import { describe, expect, it } from "vitest";
import { bendCents, curvedVelocity } from "./preferences";
describe("working MIDI preferences", () => {
  it("keeps linear velocity", () => expect(curvedVelocity(0.5, "Linear")).toBe(0.5));
  it("soft increases quiet hits", () => expect(curvedVelocity(0.25, "Soft")).toBe(0.5));
  it("hard reduces quiet hits", () => expect(curvedVelocity(0.5, "Hard")).toBe(0.25));
  it("fixed uses MIDI velocity 100 but retains note-off zero", () => {
    expect(curvedVelocity(0.2, "Fixed 100")).toBe(100 / 127);
    expect(curvedVelocity(0, "Fixed 100")).toBe(0);
  });
  it("applies selected bend range in cents", () => {
    expect(bendCents(1, 12)).toBe(1200);
    expect(bendCents(0, 2)).toBe(-200);
    expect(bendCents(0.5, 24)).toBe(0);
  });
});
