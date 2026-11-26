import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import zh from "@/i18n/dictionaries/zh.json";

function shape(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return [`${prefix}[${value.length}]`];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => shape(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

function placeholders(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return (value.match(/\{\w+\}/g) ?? []).map((p) => `${prefix}:${p}`).sort();
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => placeholders(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}

describe("dictionaries", () => {
  it("zh has exactly the same keys as en", () => {
    expect(shape(zh).sort()).toEqual(shape(en).sort());
  });

  it("zh keeps every {placeholder} used by en", () => {
    expect(placeholders(zh).sort()).toEqual(placeholders(en).sort());
  });
});
