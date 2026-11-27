"use client";

import { usePathname, useRouter } from "next/navigation";
import { locales, type Locale } from "@/i18n/config";

const SHORT: Record<Locale, string> = { en: "EN", zh: "中" };

export function LocaleSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div role="group" aria-label={label} className="flex rounded-full bg-surface-2 p-0.5 text-xs font-medium">
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={l === current}
          onClick={() => {
            if (l === current) return;
            const rest = pathname.split("/").slice(2).join("/");
            router.push(`/${l}${rest ? `/${rest}` : ""}`);
          }}
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
