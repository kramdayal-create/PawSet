import { describe, it, expect } from "vitest";
import { cn, formatDate, formatBytes, initials } from "./utils";

describe("cn", () => {
  it("merges and dedupes tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-foreground", false && "hidden", "font-bold")).toBe(
      "text-foreground font-bold",
    );
  });
});

describe("formatDate", () => {
  it("renders an em dash for empty values", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });
  it("formats an ISO date", () => {
    expect(formatDate("2026-07-04")).toMatch(/Jul/);
  });
});

describe("formatBytes", () => {
  it("handles zero and scales units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
  });
});

describe("initials", () => {
  it("takes up to two uppercased initials", () => {
    expect(initials("Sarah Miller")).toBe("SM");
    expect(initials("lenny")).toBe("L");
    expect(initials(null)).toBe("?");
    expect(initials("Anna Belle Carter")).toBe("AB");
  });
});
