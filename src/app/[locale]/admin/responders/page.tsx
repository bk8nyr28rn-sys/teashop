import { Suspense } from "react";
import { getDb } from "@/db";
import { formatMoney } from "@/config/qa";
import { format, getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { listResponderApplications, listRespondersForAdmin } from "@/lib/qa-admin";
import { Avatar } from "@/components/avatar";
import { ui } from "@/components/ui";
import { decideResponderAppAction, setResponderPausedAction } from "../actions";
import { Handle } from "@/components/handle";
import { ugc } from "@/lib/content-lang";

export default async function AdminRespondersPage() {
  const dict = await getDictionary();
  return (
    <div className="space-y-6">
      <h1 className={ui.h1}>{dict.console.responders.title}</h1>
      <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
        <Responders />
      </Suspense>
    </div>
  );
}

async function Responders() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const viewer = await requireArea(locale, "admin");
  const db = getDb();
  const [apps, responders] = await Promise.all([
    listResponderApplications(db, viewer),
    listRespondersForAdmin(db, viewer),
  ]);
  const r = dict.console.responders;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const stateTone = {
    active: ui.badgeSuccess,
    away: ui.badge,
    onboarding: ui.badgeWarn,
    paused: ui.badgeDanger,
  } as const;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className={ui.h2}>{r.appsTitle}</h2>
        {apps.length === 0 && <p className={`${ui.panel} text-sm text-muted`}>{r.appsEmpty}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {apps.map((a) => (
            <article key={a.id} className={`${ui.card} space-y-3`} data-testid="responder-application">
              <div className="flex items-center gap-3">
                <Avatar name={a.handle} size={40} />
                <div>
                  <p className="font-semibold">
                    <Handle>{a.handle}</Handle>
                  </p>
                  <p className="text-xs text-muted">
                    {a.memberSince && format(r.memberSince, { d: date.format(a.memberSince) })} ·{" "}
                    {format(r.trust, { n: a.trustLevel })}
                  </p>
                </div>
              </div>
              <p {...ugc(a.experience)} className="whitespace-pre-wrap break-words text-sm">
                {a.experience}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {a.topics.map((t) => (
                  <span key={t} className={ui.badgeAccent}>
                    {dict.qa.topics[t as keyof typeof dict.qa.topics] ?? t}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted">{r.approveNote}</p>
              <div className="flex gap-2">
                <form action={decideResponderAppAction.bind(null, locale, a.id, true)}>
                  <button className={ui.button}>{r.approve}</button>
                </form>
                <form action={decideResponderAppAction.bind(null, locale, a.id, false)}>
                  <button className={ui.buttonGhost}>{r.decline}</button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className={ui.h2}>{r.listTitle}</h2>
        {responders.length === 0 && <p className={`${ui.panel} text-sm text-muted`}>{r.empty}</p>}
        <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
          {responders.map((x) => (
            <li key={x.userId} className="space-y-2 px-5 py-4" data-testid="responder-row">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-3">
                  <Avatar name={x.handle} size={36} />
                  <span>
                    <span className="block font-semibold">
                      <Handle>{x.handle}</Handle>
                    </span>
                    {x.headline && (
                      <span {...ugc(x.headline)} className="block text-xs text-muted">
                        {x.headline}
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {x.overdueWarnedAt && !x.pausedAt && <span className={ui.badgeWarn}>{r.warned}</span>}
                  <span className={stateTone[x.state]}>{r.states[x.state]}</span>
                </span>
              </div>
              {x.pausedAt && (
                <p className="text-xs text-danger">{x.pauseReason === "overdue" ? r.pausedOverdue : r.pausedAdmin}</p>
              )}
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted tabular-nums">
                <span className="font-semibold text-ink">{formatMoney(x.priceCents, x.currency, locale)}</span>
                <span>{format(r.answered, { n: x.answered })}</span>
                {x.onTimePercent !== null && <span>{format(r.onTime, { n: x.onTimePercent })}</span>}
                <span className={x.missed ? "text-danger" : ""}>{format(r.missed, { n: x.missed })}</span>
                <span>{x.averageRating === null ? r.noRating : `★ ${x.averageRating.toFixed(1)}`}</span>
                <span>{format(r.earned, { p: formatMoney(x.earnedCents, x.currency, locale) })}</span>
              </p>
              {x.userId !== viewer.userId && (
                <form action={setResponderPausedAction.bind(null, locale, x.userId, !x.pausedAt)}>
                  <button className={ui.buttonSmall + " border border-line"}>{x.pausedAt ? r.resume : r.pause}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
