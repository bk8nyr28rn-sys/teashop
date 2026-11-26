import { describe, expect, it } from "vitest";
import { generateInviteCode, normalizeInviteCode } from "@/lib/invite-code";

describe("invite codes", () => {
  it("generates well-formed, unique codes", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const code = generateInviteCode();
      expect(code).toMatch(/^[2-9A-HJKMNP-TV-Z]{5}-[2-9A-HJKMNP-TV-Z]{5}$/);
      expect(normalizeInviteCode(code)).toBe(code);
      seen.add(code);
    }
    expect(seen.size).toBe(2000);
  });

  it("normalises user input", () => {
    expect(normalizeInviteCode(" k7m2q zp9xa ")).toBe("K7M2Q-ZP9XA");
    expect(normalizeInviteCode("k7m2qzp9xa")).toBe("K7M2Q-ZP9XA");
  });

  it("rejects impossible codes", () => {
    expect(normalizeInviteCode("")).toBeNull();
    expect(normalizeInviteCode("K7M2Q-ZP9X")).toBeNull(); // too short
    expect(normalizeInviteCode("O0IL1-ZP9XA")).toBeNull(); // look-alike chars
    expect(normalizeInviteCode("K7M2Q-ZP9XA'; drop")).toBeNull();
  });
});
