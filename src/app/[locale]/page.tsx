import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { Icon, type IconName } from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { ui } from "@/components/ui";

const FEATURE_ICONS: IconName[] = ["circles", "ask", "lock"];

export default async function LandingPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const t = dict.landing;

  return (
    <div className="space-y-12 pb-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-line bg-surface px-6 py-12 shadow-soft sm:px-10 sm:py-16">
        {/* Soft, abstract light — no flags or loud symbols, so the page stays discreet. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--accent-soft), transparent 70%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -left-20 size-72 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--warn-soft), transparent 70%)" }}
        />
        <div className="relative space-y-5">
          <LogoMark size={44} />
          <p className={ui.eyebrow}>{t.eyebrow}</p>
          <h1 className="max-w-md text-4xl font-semibold tracking-tight sm:text-5xl">{t.title}</h1>
          <p className="max-w-lg text-lg text-muted">{t.body}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href={`/${locale}/start`} className={ui.button}>
              {t.cta}
              <Icon name="arrow" className="size-4" />
            </Link>
            <Link href={`/${locale}/start`} className={ui.buttonGhost}>
              {t.ctaInvite}
            </Link>
          </div>
          <p className="text-xs text-muted">{t.footnote}</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {t.features.map((f, i) => (
          <article key={f.title} className={`${ui.card} space-y-2`}>
            <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Icon name={FEATURE_ICONS[i] ?? "shield"} />
            </span>
            <h2 className="font-semibold">{f.title}</h2>
            <p className={ui.muted}>{f.body}</p>
          </article>
        ))}
      </section>

      <section className={`${ui.panel} space-y-3`}>
        <h2 className={`${ui.h2} flex items-center gap-2`}>
          <Icon name="shield" className="size-5 text-accent" />
          {t.privacyTitle}
        </h2>
        <ul className="space-y-2 text-sm">
          {t.privacyPoints.map((point) => (
            <li key={point} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
