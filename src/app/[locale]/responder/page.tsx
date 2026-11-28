import { Suspense } from "react";
import Link from "next/link";
import { getDb } from "@/db";
import { formatMoney } from "@/config/qa";
import { format, getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { getPaymentProvider } from "@/lib/payments";
import { expireOverdue, getResponderProfile, getResponderStanding, listResponderQueue } from "@/lib/qa";
import { Icon } from "@/components/icons";
import { QuestionStatusBadge } from "@/components/question-status";
import { ui } from "@/components/ui";
import { ugc } from "@/lib/content-lang";

export default async function ResponderPage() {
  const dict = await getDictionary();
  return (
    <div className="space-y-6">
      <h1 className={ui.h1}>{dict.responder.title}</h1>
      <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
        <Desk />
      </Suspense>
    </div>
  );
}

async function Desk() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const viewer = await requireArea(locale, "responder");
  const t = dict.qa;
  const db = getDb();
  const provider = getPaymentProvider();
  if (provider) await expireOverdue(db, provider);
  const [profile, { open, history }, standing] = await Promise.all([
    getResponderProfile(db, viewer.userId),
    listResponderQueue(db, viewer.userId),
    getResponderStanding(db, viewer.userId),
  ]);
  const dt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="space-y-8">
      {standing.pausedAt ? (
        <p className={`${ui.error} font-medium`} data-testid="standing">
          {standing.pauseReason === "overdue" ? t.standingPausedOverdue : t.standingPausedAdmin}
        </p>
      ) : (
        standing.warned && (
          <p className={`${ui.notice} border border-warn/40 bg-warn-soft font-medium text-warn`} data-testid="standing">
            {format(t.standingWarned, { n: standing.missed, m: standing.pauseAt })}
          </p>
        )
      )}
      <Link href={`/${locale}/responder/profile`} className={`${ui.cardLink} flex items-center gap-3`}>
        <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Icon name="me" />
        </span>
        <span className="flex-1">
          <span className="block font-semibold">{t.profileTitle}</span>
          <span className={ui.muted}>
            {profile?.accepting ? t.accepting : profile?.payoutsReady ? t.profileIntro : t.payoutsNotReady}
          </span>
        </span>
        <Icon name="arrow" className="size-4 text-muted" />
      </Link>

      <section className="space-y-3">
        <h2 className={ui.h2}>{t.queueTitle}</h2>
        {open.length === 0 && <p className={ui.muted}>{t.queueEmpty}</p>}
        <ul className="grid gap-3">
          {open.map((q) => (
            <li key={q.id}>
              <Link
                href={`/${locale}/questions/${q.id}`}
                className={`${ui.cardLink} space-y-1`}
                data-testid="queue-item"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {q.crisisFlag && <span className={ui.badgeDanger}>!</span>}
                  <span {...ugc(q.title)} className="min-w-0 flex-1 truncate font-semibold">
                    {q.title}
                  </span>
                  <span className={ui.badgeSuccess}>{formatMoney(q.priceCents - q.feeCents, q.currency, locale)}</span>
                </div>
                {q.deadlineAt && (
                  <p className="text-xs text-muted">{format(t.dueBy, { date: dt.format(q.deadlineAt) })}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className={ui.h2}>{t.historyTitle}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
            {history.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/${locale}/questions/${q.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2"
                >
                  <span {...ugc(q.title)} className="min-w-0 flex-1 truncate text-sm">
                    {q.title}
                  </span>
                  <QuestionStatusBadge status={q.status} t={t} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
