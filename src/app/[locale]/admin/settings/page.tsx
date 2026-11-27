import { Suspense } from "react";
import { getDb } from "@/db";
import { format, getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { getQaSettings } from "@/lib/qa";
import { ui } from "@/components/ui";
import { SettingsForm } from "../forms";

export default async function AdminSettingsPage() {
  const dict = await getDictionary();
  return (
    <div className="space-y-6">
      <h1 className={ui.h1}>{dict.console.settings.title}</h1>
      <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  await requireArea(locale, "admin");
  const settings = await getQaSettings(getDb());
  const dt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  return (
    <section className={`${ui.card} space-y-3`}>
      {settings.updatedAt.getTime() > 0 && (
        <p className="text-xs text-muted">
          {format(dict.console.settings.lastChange, { d: dt.format(settings.updatedAt) })}
        </p>
      )}
      <SettingsForm locale={locale} t={dict.console} initial={settings} />
    </section>
  );
}
