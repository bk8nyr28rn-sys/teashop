"use client";

import { usePathname, useRouter } from "next/navigation";
import { localeLabels, locales, type Locale } from "@/i18n/config";

export function LocaleSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <select
      aria-label={label}
      className="rounded-lg border border-line bg-bg px-2 py-1 text-sm"
      value={current}
      onChange={(e) => {
        const rest = pathname.split("/").slice(2).join("/");
        router.push(`/${e.target.value}${rest ? `/${rest}` : ""}`);
      }}
    >
      {locales.map((l) => (
        <option key={l} value={l}>
          {localeLabels[l]}
        </option>
      ))}
    </select>
  );
}
