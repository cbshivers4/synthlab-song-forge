import { describe, expect, it } from "vitest";
import { oauthReturnPath } from "./oauth-return-path";

describe("oauthReturnPath", () => {
  it("keeps a same-origin consent path with its query", () => {
    expect(oauthReturnPath("/.lovable/oauth/consent?authorization_id=abc")).toBe(
      "/.lovable/oauth/consent?authorization_id=abc",
    );
  });
  it("rejects other sites and tricks", () => {
    expect(oauthReturnPath("https://evil.example/x")).toBe("/");
    expect(oauthReturnPath("//evil.example/x")).toBe("/");
    expect(oauthReturnPath("/\\evil.example")).toBe("/");
    expect(oauthReturnPath(undefined)).toBe("/");
  });
});
