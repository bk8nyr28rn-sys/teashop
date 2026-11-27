import { Suspense } from "react";
import Link from "next/link";
import { getDb } from "@/db";
import { formatMoney, qaConfig } from "@/config/qa";
import { format, getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { getOverview } from "@/lib/qa-admin";
import { ui } from "@/components/ui";
import { Kpi, qCode } from "./ui";

export default async function AdminOverviewPage() {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
      <Overview />
    </Suspense>
  );
}

function DailyChart({
  daily,
  locale,
  label,
}: {
  daily: { day: Date; count: number }[];
  locale: string;
  label: string;
}) {
  const W = 320;
  const H = 150;
  const top = 18;
  const bottom = 22;
  const slot = W / daily.length;
  const bw = Math.min(26, slot * 0.6);
  const max = Math.max(1, ...daily.map((d) => d.count));
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} className="overflow-visible">
      <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} stroke="var(--line)" />
      {daily.map((d, i) => {
        const h = (d.count / max) * (H - top - bottom);
        const x = i * slot + (slot - bw) / 2;
        const y = H - bottom - h;
        return (
          <g key={d.day.toISOString()}>
            <rect
              x={x}
              y={y}
              width={bw}
              height={Math.max(h, 0.5)}
              rx="5"
              fill={i === daily.length - 1 ? "var(--accent-strong)" : "var(--accent)"}
            />
            <text x={x + bw / 2} y={y - 5} textAnchor="middle" fontSize="10" fill="var(--muted)">
              {d.count}
            </text>
            <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">
              {fmt.format(d.day)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

async function Overview() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const viewer = await requireArea(locale, "admin");
  const o = (await getOverview(getDb(), viewer, 7))!;
  const c = dict.console;
  const money = (cents: number) => formatMoney(cents, qaConfig.currency, locale);
  const hours = (n: number | null) => (n === null ? "—" : format(c.hours, { n: n < 1 ? "<1" : Math.round(n) }));
  const a = o.attention;
  const base = `/${locale}/admin`;

  const alerts: { tone: string; text: string; href: string }[] = [
    ...a.crisisWaiting.map((q) => ({
      tone: "bg-danger",
      text: format(c.alertCrisis, { id: qCode(q.id), n: Math.round(q.waitedHours), r: q.responder ?? "—" }),
      href: `${base}/questions/${q.id}`,
    })),
    ...a.expiringSoon.map((q) => ({
      tone: "bg-warn",
      text: format(c.alertSoon, { id: qCode(q.id), n: Math.round(q.hoursLeft), r: q.responder ?? "—" }),
      href: `${base}/questions?f=open`,
    })),
    ...(a.disputes
      ? [{ tone: "bg-accent", text: format(c.alertDisputes, { n: a.disputes }), href: `${base}/reviews` }]
      : []),
    ...(a.responderApplications
      ? [
          {
            tone: "bg-accent",
            text: format(c.alertResponderApps, { n: a.responderApplications }),
            href: `${base}/responders`,
          },
        ]
      : []),
    ...a.responders.map((r) => ({
      tone: r.paused ? "bg-danger" : "bg-warn",
      text: format(r.paused ? c.alertPaused : c.alertWarned, { h: r.handle ?? "—" }),
      href: `${base}/responders`,
    })),
    ...(a.memberApplications
      ? [{ tone: "bg-accent", text: format(c.alertMemberApps, { n: a.memberApplications }), href: `${base}/community` }]
      : []),
    ...(a.openReports
      ? [{ tone: "bg-accent", text: format(c.alertReports, { n: a.openReports }), href: `${base}/community` }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <h1 className={ui.h1}>{format(c.overviewTitle, { n: o.days })}</h1>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="kpis">
        <Kpi label={c.kpi.questions} value={String(o.questions)} />
        <Kpi
          label={c.kpi.onTime}
          value={o.closed ? `${Math.round((o.onTime / o.closed) * 100)}%` : "—"}
          sub={format(c.ofClosed, { a: o.onTime, b: o.closed })}
        />
        <Kpi label={c.kpi.response} value={hours(o.medianResponseHours)} />
        <Kpi
          label={c.kpi.charged}
          value={money(o.chargedCents - o.refundedCents)}
          sub={o.refundedCents ? format(c.afterRefunds, { p: money(o.refundedCents) }) : undefined}
        />
        <Kpi label={c.kpi.platform} value={money(o.platformCents)} />
        <Kpi label={c.kpi.rating} value={o.averageRating === null ? "—" : `★ ${o.averageRating.toFixed(1)}`} />
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[1.15fr_1fr]">
        <section className="space-y-2">
          <h2 className={ui.h2}>{c.attention}</h2>
          <ul
            className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface"
            data-testid="attention"
          >
            {alerts.length === 0 && <li className="px-5 py-4 text-sm text-muted">{c.attentionEmpty}</li>}
            {alerts.map((al, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-3">
                <span aria-hidden className={`size-2 shrink-0 rounded-full ${al.tone}`} />
                <span className="flex-1 text-sm">{al.text}</span>
                <Link href={al.href} className={ui.buttonSmall + " border border-line"}>
                  {c.open}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className={`${ui.card} space-y-2`}>
          <h2 className={ui.h2}>{c.chart}</h2>
          <DailyChart daily={o.daily} locale={locale} label={c.chart} />
        </section>
      </div>
    </div>
  );
}
