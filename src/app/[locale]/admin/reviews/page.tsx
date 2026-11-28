import { Suspense } from "react";
import Link from "next/link";
import { getDb } from "@/db";
import { formatMoney } from "@/config/qa";
import { format, getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { listOpenDisputes } from "@/lib/qa";
import { Avatar } from "@/components/avatar";
import { ui } from "@/components/ui";
import { keepPaymentAction } from "../actions";
import { RefundForm } from "../forms";
import { qCode } from "../ui";
import { Handle } from "@/components/handle";
import { ugc } from "@/lib/content-lang";

export default async function AdminReviewsPage() {
  const dict = await getDictionary();
  return (
    <div className="space-y-6">
      <h1 className={ui.h1}>{dict.console.reviews.title}</h1>
      <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
        <Reviews />
      </Suspense>
    </div>
  );
}

async function Reviews() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  await requireArea(locale, "admin");
  const disputes = await listOpenDisputes(getDb());
  const c = dict.console;
  const dt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const errors = { ...c.errors, ...dict.qa.errors } as Record<string, string>;

  if (disputes.length === 0) return <p className={`${ui.panel} text-sm text-muted`}>{c.reviews.empty}</p>;
  return (
    <div className="space-y-4">
      {disputes.map((d) => {
        const remaining = d.priceCents - d.refundedCents;
        const money = (cents: number) => formatMoney(cents, d.currency, locale);
        return (
          <article
            key={d.id}
            className={`${ui.card} grid gap-5 md:grid-cols-[1fr_minmax(0,18rem)]`}
            data-testid="review"
          >
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span translate="no" className="font-mono text-sm font-semibold">
                    #{qCode(d.id)}
                  </span>
                  <Avatar name={d.responderHandle} size={22} />
                  <span className="text-sm">
                    <Handle>{d.responderHandle ?? "—"}</Handle>
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">{money(d.priceCents)}</span>
              </div>
              <div>
                <p className={ui.eyebrow}>{c.reviews.reason}</p>
                <p {...ugc(d.disputeReason)} className="whitespace-pre-wrap break-words">
                  “{d.disputeReason}”
                </p>
              </div>
              <p className="text-xs text-muted">
                {d.disputedAt && dt.format(d.disputedAt)}
                {d.rating ? ` · ★ ${d.rating}` : ""}
                {d.refundedCents ? ` · ${format(c.refundedAmt, { p: money(d.refundedCents) })}` : ""}
              </p>
              <Link href={`/${locale}/admin/questions/${d.id}`} className={`${ui.link} text-sm`}>
                {c.reviews.view} →
              </Link>
            </div>
            <div className="space-y-3 md:border-l md:border-line md:pl-5">
              {remaining > 0 && d.status === "answered" && (
                <RefundForm
                  locale={locale}
                  questionId={d.id}
                  remainingCents={remaining}
                  hint={format(c.reviews.refundHint, { p: money(remaining) })}
                  t={c}
                  errors={errors}
                />
              )}
              <form action={keepPaymentAction.bind(null, locale, d.id)}>
                <button className={ui.buttonGhost}>{c.reviews.keep}</button>
              </form>
            </div>
          </article>
        );
      })}
    </div>
  );
}
