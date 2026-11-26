import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { ui } from "@/components/ui";

export default async function LandingPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const t = dict.landing;

  return (
    <div className="space-y-8">
      <section className="space-y-4 pt-6">
        <h1 className="text-3xl font-semibold tracking-tight">{t.title}</h1>
        <p className="text-muted">{t.body}</p>
        <Link href={`/${locale}/start`} className={ui.button}>
          {t.cta}
        </Link>
      </section>
      <section className={ui.card}>
        <h2 className={ui.h2}>{t.privacyTitle}</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          {t.privacyPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
