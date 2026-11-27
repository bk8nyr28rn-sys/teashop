import { Suspense } from "react";
import Link from "next/link";
import { getDb } from "@/db";
import { formatMoney, qaConfig } from "@/config/qa";
import { format, getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { getPaymentProvider } from "@/lib/payments";
import { getQaSettings, getResponderProfile, refreshPayoutStatus } from "@/lib/qa";
import { ui } from "@/components/ui";
import { startPayoutsAction } from "../../questions/actions";
import { ResponderProfileForm } from "../../questions/forms";

type Props = PageProps<"/[locale]/responder/profile">;

export default async function ResponderProfilePage({ searchParams }: Props) {
  const dict = await getDictionary();
  return (
    <div className="space-y-6">
      <h1 className={ui.h1}>{dict.qa.profileTitle}</h1>
      <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
        <ProfileEditor searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ProfileEditor({ searchParams }: Pick<Props, "searchParams">) {
  const [locale, dict, sp] = await Promise.all([getLocale(), getDictionary(), searchParams]);
  const viewer = await requireArea(locale, "responder");
  const t = dict.qa;
  const db = getDb();
  const provider = getPaymentProvider();
  if (!provider) return <p className={ui.notice}>{t.unavailable}</p>;

  // Coming back from payout onboarding: ask the provider for the latest status.
  if (sp.payouts === "return") await refreshPayoutStatus(db, provider, viewer.userId);
  const [profile, settings] = await Promise.all([getResponderProfile(db, viewer.userId), getQaSettings(db)]);
  const ready = !!profile?.payoutsReady;
  const money = (c: number) => formatMoney(c, qaConfig.currency, locale);

  return (
    <div className="space-y-6">
      <Link href={`/${locale}/responder`} className="text-sm text-muted hover:text-ink">
        ← {dict.nav.responder}
      </Link>
      <p className={ui.muted}>{t.profileIntro}</p>

      <section className={`${ui.card} space-y-3`}>
        <h2 className={ui.h2}>{t.payoutsTitle}</h2>
        {ready ? (
          <p className={ui.success}>{t.payoutsReady}</p>
        ) : (
          <>
            <p className={ui.muted}>{t.payoutsNotReady}</p>
            <form action={startPayoutsAction.bind(null, locale)}>
              <button className={ui.button}>{t.payoutsButton}</button>
            </form>
          </>
        )}
        {provider.name === "fake" && <p className="text-xs text-warn">{t.devNote}</p>}
      </section>

      <section className={ui.card}>
        <ResponderProfileForm
          locale={locale}
          t={t}
          payoutsReady={ready}
          priceMinCents={settings.priceMinCents}
          priceMaxCents={settings.priceMaxCents}
          priceHint={format(t.priceHint, {
            min: money(settings.priceMinCents),
            max: money(settings.priceMaxCents),
            fee: settings.feePercent,
          })}
          initial={{
            headline: profile?.headline ?? "",
            bio: profile?.bio ?? "",
            topics: profile?.topics ?? [],
            languages: profile?.languages ?? [],
            priceCents: profile?.priceCents ?? 1500,
            accepting: profile?.accepting ?? false,
          }}
        />
      </section>
    </div>
  );
}
