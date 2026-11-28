import Negotiator from "negotiator";
import { defaultLocale, hasLocale, type Locale } from "./config";

/**
 * Picks the UI language: an explicit choice (page the user is on, or the
 * remembered cookie) wins; otherwise the browser's languages in order of
 * preference, matched on the base language so zh-TW, zh-HK and en-GB still
 * map to a language we have. Falls back to English.
 */
export function negotiateLocale(input: {
  explicit?: string | null;
  cookie?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  for (const value of [input.explicit, input.cookie]) {
    if (hasLocale(value)) return value;
  }
  const preferred = new Negotiator({ headers: { "accept-language": input.acceptLanguage ?? "" } }).languages();
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0];
    if (hasLocale(base)) return base;
  }
  return defaultLocale;
}

/** Reads one cookie from a raw Cookie header (for contexts without a cookie API). */
export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}
