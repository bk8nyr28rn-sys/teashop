import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { formatMoney } from "@/config/qa";
import { format, getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { getPaymentProvider } from "@/lib/payments";
import { expireOverdue, getQuestionView } from "@/lib/qa";
import { Avatar } from "@/components/avatar";
import { QuestionStatusBadge } from "@/components/question-status";
import { ui } from "@/components/ui";
import { cancelQuestionAction } from "../actions";
import { AnswerForm, DisputeForm, RateForm } from "../forms";
import { ugc } from "@/lib/content-lang";
import { formatRich, NoTranslate } from "@/components/handle";

type Props = PageProps<"/[locale]/questions/[id]">;

export default async function QuestionPage({ params, searchParams }: Props) {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
      <Question params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Question({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ id }, sp, locale, dict] = await Promise.all([params, searchParams, getLocale(), getDictionary()]);
  const viewer = await requireArea(locale, "member");
  const db = getDb();
  const provider = getPaymentProvider();
  if (provider) await expireOverdue(db, provider);
  const q = await getQuestionView(db, viewer, id);
  if (!q) notFound();
  const t = dict.qa;
  const dt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const money = (c: number) => formatMoney(c, q.currency, locale);
  const checkout = typeof sp.checkout === "string" ? sp.checkout : null;
  const isAsker = q.viewerRole === "asker";
  const isResponder = q.viewerRole === "responder";

  return (
    <div className="space-y-5">
      <Link
        href={`/${locale}/${isResponder ? "responder" : "questions"}`}
        className="text-sm text-muted hover:text-ink"
      >
        ← {isResponder ? dict.nav.responder : t.myQuestions}
      </Link>

      {isAsker && checkout === "done" && (
        <p className={q.status === "awaiting_payment" ? ui.notice : ui.success}>
          {q.status === "awaiting_payment" ? t.checkoutPending : t.checkoutDone}
        </p>
      )}
      {isAsker && checkout === "cancelled" && q.status === "awaiting_payment" && (
        <p className={ui.notice}>{t.checkoutCancelled}</p>
      )}
      {isResponder && q.crisisFlag && (
        <p className={`${ui.error} font-medium`} data-testid="crisis-banner">
          {t.crisisBanner}{" "}
          <Link href={`/${locale}/help`} className="underline">
            {dict.nav.help}
          </Link>
        </p>
      )}

      <article className={`${ui.card} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={ui.eyebrow}>{isResponder ? t.anonymousAsker : t.yourQuestion}</p>
          <QuestionStatusBadge status={q.status} t={t} />
        </div>
        <div {...ugc(q.title, q.body)} className="space-y-3">
          <h1 className="text-xl font-semibold tracking-tight break-words">{q.title}</h1>
          <p className="whitespace-pre-wrap break-words">{q.body}</p>
        </div>
        <p className="text-xs text-muted">
          {dt.format(q.createdAt)} · {money(q.priceCents)}
          {q.status === "open" && q.deadlineAt && ` · ${format(t.dueBy, { date: dt.format(q.deadlineAt) })}`}
        </p>
        {isResponder && q.status === "open" && (
          <p className={ui.badgeSuccess}>{format(t.youEarn, { amount: money(q.priceCents - q.feeCents) })}</p>
        )}
      </article>

      {q.answer ? (
        <article className="space-y-3 rounded-3xl border border-accent/25 bg-accent-soft/60 p-5" data-testid="answer">
          <p className="flex items-center gap-2 text-sm font-medium">
            {q.responderHandle && <Avatar name={q.responderHandle} size={28} />}
            {q.responderHandle
              ? formatRich(t.from, { handle: <NoTranslate>{q.responderHandle}</NoTranslate> })
              : t.answer}
          </p>
          <p {...ugc(q.answer)} className="whitespace-pre-wrap break-words">
            {q.answer}
          </p>
          {q.answeredAt && <p className="text-xs text-muted">{dt.format(q.answeredAt)}</p>}
        </article>
      ) : (
        isAsker && q.status === "open" && <p className={`${ui.panel} text-sm`}>{t.waiting}</p>
      )}

      {isResponder && q.status === "open" && (
        <div className={ui.card}>
          <AnswerForm locale={locale} questionId={q.id} t={t} />
        </div>
      )}

      {isAsker && (q.status === "open" || q.status === "awaiting_payment") && (
        <form action={cancelQuestionAction.bind(null, locale, q.id)}>
          <button className={ui.buttonSmall}>{t.cancel}</button>
        </form>
      )}

      {isAsker && q.refundedCents > 0 && q.status === "answered" && (
        <p className={ui.success}>{format(t.refundedPartial, { p: money(q.refundedCents) })}</p>
      )}

      {isAsker && q.status === "answered" && (
        <section className={`${ui.card} space-y-4`}>
          {q.rating ? <p className={ui.success}>{t.rated}</p> : <RateForm locale={locale} questionId={q.id} t={t} />}
          {q.disputedAt ? (
            <p className={ui.notice}>{q.disputeResolvedAt ? t.disputeResolved : t.disputed}</p>
          ) : (
            <DisputeForm locale={locale} questionId={q.id} t={t} />
          )}
        </section>
      )}
    </div>
  );
}
