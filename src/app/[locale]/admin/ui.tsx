import type { QuestionStatus } from "@/db/schema";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/dictionaries";
import { formatMoney } from "@/config/qa";
import type { QuestionMeta } from "@/lib/qa-admin";
import { netSplit } from "@/lib/qa-admin";
import { Avatar } from "@/components/avatar";
import { QuestionStatusBadge } from "@/components/question-status";
import { ui } from "@/components/ui";
import { Handle } from "@/components/handle";

/** Short, stable code for a question (never its title). */
export const qCode = (id: string) => id.replace(/-/g, "").slice(0, 6).toUpperCase();

export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface px-4 py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted tabular-nums">{sub}</p>}
    </div>
  );
}

/** One line of metadata about a question. Deliberately has no title, text or asker. */
export function QuestionMetaLine({ q, locale, dict }: { q: QuestionMeta; locale: string; dict: Dictionary }) {
  const c = dict.console;
  const dt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const money = (cents: number) => formatMoney(cents, q.currency, locale);
  const split = netSplit(q);
  const responseH =
    q.answeredAt && q.authorizedAt ? (q.answeredAt.getTime() - q.authorizedAt.getTime()) / 3_600_000 : null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span translate="no" className="font-mono text-sm font-semibold">
            #{qCode(q.id)}
          </span>
          <Avatar name={q.responderHandle} size={22} />
          <span className="text-sm">
            <Handle>{q.responderHandle ?? "—"}</Handle>
          </span>
        </span>
        <span className="flex flex-wrap gap-1.5">
          {q.crisisFlag && <span className={ui.badgeDanger}>{c.filters.crisis}</span>}
          {q.disputedAt && !q.disputeResolvedAt && <span className={ui.badgeWarn}>{c.filters.disputed}</span>}
          <QuestionStatusBadge status={q.status as QuestionStatus} t={dict.qa} />
        </span>
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted tabular-nums">
        <span className="font-semibold text-ink">{money(q.priceCents)}</span>
        {split.charged > 0 && (
          <span>{format(c.share, { h: q.responderHandle ?? "—", p: money(split.responder) })}</span>
        )}
        {q.refundedCents > 0 && <span>{format(c.refundedAmt, { p: money(q.refundedCents) })}</span>}
        <span>{format(c.askedOn, { d: dt.format(q.createdAt) })}</span>
        {q.status === "open" && q.deadlineAt && <span>{format(c.due, { d: dt.format(q.deadlineAt) })}</span>}
        {responseH !== null && <span>{format(c.answeredIn, { n: responseH < 1 ? "<1" : Math.round(responseH) })}</span>}
        {q.status === "expired" && q.closeReason === "deadline" && <span className="text-danger">{c.missed}</span>}
        {q.status === "expired" && q.closeReason === "released" && <span>{c.released}</span>}
        {q.rating && <span>★ {q.rating}</span>}
      </p>
    </div>
  );
}
