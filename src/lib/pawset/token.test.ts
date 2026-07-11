import { describe, it, expect } from "vitest";
import { makeShareToken } from "./token";

describe("makeShareToken (share-link tokens)", () => {
  it("produces a URL-safe string with no +, / or = characters", () => {
    for (let i = 0; i < 200; i++) {
      const t = makeShareToken();
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(t).not.toContain("+");
      expect(t).not.toContain("/");
      expect(t).not.toContain("=");
    }
  });

  it("is long enough to be unguessable (>= 32 chars for 24 bytes)", () => {
    expect(makeShareToken().length).toBeGreaterThanOrEqual(32);
  });

  it("generates unique tokens", () => {
    const set = new Set(Array.from({ length: 1000 }, () => makeShareToken()));
    expect(set.size).toBe(1000);
  });

  it("honours a custom byte length", () => {
    expect(makeShareToken(48).length).toBeGreaterThan(makeShareToken(12).length);
  });
});
