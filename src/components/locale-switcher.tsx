"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { saveLocaleAction } from "@/i18n/actions";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, localeLabels, locales, type Locale } from "@/i18n/config";

const SHORT: Record<Locale, string> = { en: "EN", zh: "中" };

function writeLocaleCookie(locale: Locale) {
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax${secure}`;
}

function readLocaleCookie(): string | null {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${LOCALE_COOKIE}=`));
  return hit ? hit.slice(LOCALE_COOKIE.length + 1) : null;
}

/** Same page in another language; remembers the choice (and saves it on the account when signed in). */
function useSwitchLocale(current: Locale, signedIn: boolean) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  const switchTo = (l: Locale) => {
    if (l === current) return;
    writeLocaleCookie(l);
    const rest = pathname.split("/").slice(2).join("/");
    const target = `/${l}${rest ? `/${rest}` : ""}${location.search}`;
    start(async () => {
      if (signedIn) await saveLocaleAction(l).catch(() => undefined);
      router.push(target);
    });
  };
  return { switchTo, pending };
}

/** Compact EN / 中 toggle for the header. */
export function LocaleSwitcher({ current, label, signedIn }: { current: Locale; label: string; signedIn: boolean }) {
  const { switchTo, pending } = useSwitchLocale(current, signedIn);
  return (
    <div
      role="group"
      aria-label={label}
      aria-busy={pending}
      translate="no"
      className="flex rounded-full bg-surface-2 p-0.5 text-xs font-medium"
    >
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-label={localeLabels[l]}
          aria-pressed={l === current}
          onClick={() => switchTo(l)}
          className={`rounded-full px-2.5 py-1 transition ${
            l === current ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink"
          }`}
        >
          {SHORT[l]}
        </button>
      ))}
    </div>
  );
}

/** Full list with each language in its own script (Settings). */
export function LanguagePicker({ current, label }: { current: Locale; label: string }) {
  const { switchTo, pending } = useSwitchLocale(current, true);
  return (
    <div role="group" aria-label={label} aria-busy={pending} translate="no" className="flex flex-wrap gap-2">
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === current}
          onClick={() => switchTo(l)}
          data-testid={`language-${l}`}
          className={`min-h-11 rounded-full border px-4 text-sm font-medium transition ${
            l === current
              ? "border-accent bg-accent-soft text-accent"
              : "border-line text-ink hover:border-accent/50 hover:bg-surface-2"
          }`}
        >
          {l === current && <span aria-hidden>✓ </span>}
          {localeLabels[l]}
        </button>
      ))}
    </div>
  );
}

/**
 * After signing in on a new device, adopt the language saved on the account
 * so later visits to the bare domain open in it too.
 */
export function LocaleCookieSync({ locale }: { locale: Locale }) {
  useEffect(() => {
    if (readLocaleCookie() !== locale) writeLocaleCookie(locale);
  }, [locale]);
  return null;
}
