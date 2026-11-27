import { Suspense } from "react";
import Link from "next/link";
import { getDb } from "@/db";
import { formatMoney } from "@/config/qa";
import { format, getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { getPaymentProvider } from "@/lib/payments";
import { listAvailableResponders } from "@/lib/qa";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { ui } from "@/components/ui";

export default async function AskPage() {
  const dict = await getDictionary();
  const t = dict.qa;
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className={ui.h1}>{t.title}</h1>
        <p className="text-muted">{t.intro}</p>
      </header>
      <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
        <Responders />
      </Suspense>
    </div>
  );
}

async function Responders() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const viewer = await requireArea(locale, "member");
  const t = dict.qa;
  const provider = getPaymentProvider();
  if (!provider) return <p className={ui.notice}>{t.unavailable}</p>;
  const responders = (await listAvailableResponders(getDb())).filter((r) => r.userId !== viewer.userId);

  return (
    <div className="space-y-5">
      <div className={`${ui.panel} space-y-1.5 text-sm`}>
        <p className="flex items-center gap-2 font-medium">
          <Icon name="lock" className="size-4 text-accent" />
          {t.anonymity}
        </p>
        <p className="text-muted">{t.disclaimer}</p>
        {provider.name === "fake" && <p className="text-xs text-warn">{t.devNote}</p>}
      </div>

      <Link href={`/${locale}/questions`} className={`${ui.buttonSmall} -ml-3`}>
        {t.myQuestions}
        <Icon name="arrow" className="size-3.5" />
      </Link>

      {responders.length === 0 ? (
        <p className={ui.muted}>{t.empty}</p>
      ) : (
        <ul className="grid gap-3">
          {responders.map((r) => (
            <li key={r.userId} className={`${ui.card} space-y-3`} data-testid="responder">
              <div className="flex items-start gap-3">
                <Avatar name={r.handle} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">@{r.handle}</p>
                  {r.headline && <p className={ui.muted}>{r.headline}</p>}
                </div>
                <span className="text-right text-sm font-semibold">
                  {format(t.price, { price: formatMoney(r.priceCents, r.currency, locale) })}
                </span>
              </div>
              {r.bio && <p className="text-sm whitespace-pre-wrap">{r.bio}</p>}
              <div className="flex flex-wrap gap-1.5">
                {r.topics.map((topic) => (
                  <span key={topic} className={ui.badgeAccent}>
                    {t.topics[topic as keyof typeof t.topics] ?? topic}
                  </span>
                ))}
                {r.languages.map((lang) => (
                  <span key={lang} className={ui.badge}>
                    {t.languages[lang as keyof typeof t.languages] ?? lang}
                  </span>
                ))}
              </div>
              <Link href={`/${locale}/ask/${r.userId}`} className={ui.button}>
                {t.choose} @{r.handle}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
