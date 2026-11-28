export const locales = ["en", "zh"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

/** Each language in its own script, so people can find theirs. Never flags: languages aren't countries. */
export const localeLabels: Record<Locale, string> = { en: "English", zh: "中文" };

/** Remembers an explicit language choice. Not sensitive, so readable by the client (it can re-sync it). */
export const LOCALE_COOKIE = "locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Request header the sign-in form sends so emails match the page language. */
export const UI_LOCALE_HEADER = "x-ui-locale";

export function hasLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** BCP 47 tag for <html lang>. Our Chinese UI is Simplified. */
export function htmlLang(locale: Locale): string {
  return locale === "zh" ? "zh-Hans" : locale;
}
