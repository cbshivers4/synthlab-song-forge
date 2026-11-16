import { describe, expect, it } from "vitest";
import { SUPPORT_EMAIL } from "./contact";
import { KNOWLEDGE_BASE } from "./help-articles";
import { searchArticles } from "./support";

describe("customer contact address", () => {
  it("tells customers to write to the founder's support address", () => {
    expect(SUPPORT_EMAIL).toBe("christopherbshivers@gmail.com");
  });

  it("the getting-help article names that address", () => {
    const article = KNOWLEDGE_BASE.find((a) => a.id === "support");
    expect(article?.body.join(" ")).toContain(SUPPORT_EMAIL);
  });

  it("no help article still shows the retired address", () => {
    for (const a of KNOWLEDGE_BASE) {
      const text = [a.title, ...a.body, ...a.can, ...a.cant].join(" ");
      expect(text).not.toMatch(/info@synclabsapp\.com/);
    }
  });

  it("typing the address into help search finds the getting-help article", () => {
    expect(searchArticles(SUPPORT_EMAIL).map((a) => a.id)).toContain("support");
  });
});
