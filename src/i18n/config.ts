export const locales = ["en", "zh"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = { en: "English", zh: "中文" };

export function hasLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
