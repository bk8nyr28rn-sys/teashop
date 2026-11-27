"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { qaConfig } from "@/config/qa";
import { ui } from "@/components/ui";
import {
  answerAction,
  askAction,
  disputeAction,
  rateAction,
  saveResponderProfileAction,
  type QaFormState,
} from "./actions";

type T = Dictionary["qa"];

function ErrorLine({ state, t }: { state: QaFormState; t: T }) {
  if (!state?.error || state.error === "crisis-check") return null;
  return <p className={ui.error}>{t.errors[state.error]}</p>;
}

/* ---------------------------------- Ask --------------------------------- */

export function AskForm(props: {
  locale: string;
  responderId: string;
  priceLabel: string;
  t: T;
  /** Server-rendered crisis resources, shown when crisis language is detected. */
  resources: ReactNode;
}) {
  const { t } = props;
  const [state, action, pending] = useActionState(askAction.bind(null, props.locale, props.responderId), undefined);
  const crisis = state?.crisis;

  return (
    <form action={action} className="space-y-4">
      <label className={ui.label}>
        {t.titleLabel}
        <input
          name="title"
          required
          maxLength={qaConfig.titleMax}
          defaultValue={state?.values?.title}
          className={`${ui.input} mt-1`}
        />
      </label>
      <label className={ui.label}>
        {t.bodyLabel}
        <textarea
          name="body"
          required
          rows={6}
          minLength={qaConfig.bodyMin}
          maxLength={qaConfig.bodyMax}
          defaultValue={state?.values?.body}
          className={`${ui.input} mt-1`}
        />
        <span className="mt-1 block text-xs font-normal text-muted">{t.bodyHint}</span>
      </label>

      {crisis && (
        <section
          className="space-y-3 rounded-3xl border border-accent/30 bg-accent-soft p-5"
          data-testid="crisis-panel"
        >
          <h2 className={ui.h2}>{t.crisisTitle}</h2>
          <p className="text-sm">{t.crisisBody}</p>
          {props.resources}
          <Link href={`/${props.locale}/help`} className={`${ui.link} text-sm`}>
            {t.crisisHelpLink}
          </Link>
          <label className="flex items-start gap-2 text-sm font-medium">
            <input type="checkbox" name="crisisAck" required className="mt-1" />
            {t.crisisAck}
          </label>
        </section>
      )}

      <ol className={`${ui.panel} space-y-1 text-sm`}>
        {t.how.map((step, i) => (
          <li key={step} className="flex gap-2">
            <span className="font-semibold text-accent">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <ErrorLine state={state} t={t} />
      <button className={`${ui.button} w-full sm:w-auto`} disabled={pending}>
        {t.pay.replace("{price}", props.priceLabel)}
      </button>
    </form>
  );
}

/* -------------------------------- Answer -------------------------------- */

export function AnswerForm({ locale, questionId, t }: { locale: string; questionId: string; t: T }) {
  const [state, action, pending] = useActionState(answerAction.bind(null, locale, questionId), undefined);
  return (
    <form action={action} className="space-y-3">
      <label className={ui.label}>
        {t.answerLabel}
        <textarea
          name="answer"
          required
          rows={8}
          minLength={qaConfig.answerMin}
          maxLength={qaConfig.answerMax}
          defaultValue={state?.values?.answer}
          className={`${ui.input} mt-1`}
        />
        <span className="mt-1 block text-xs font-normal text-muted">
          {t.answerHint.replace("{min}", String(qaConfig.answerMin)).replace("{max}", String(qaConfig.answerMax))}
        </span>
      </label>
      <ErrorLine state={state} t={t} />
      <button className={ui.button} disabled={pending}>
        {t.submitAnswer}
      </button>
    </form>
  );
}

/* --------------------------- Rating and review -------------------------- */

export function RateForm({ locale, questionId, t }: { locale: string; questionId: string; t: T }) {
  const [state, action, pending] = useActionState(rateAction.bind(null, locale, questionId), undefined);
  const [rating, setRating] = useState(0);
  if (state?.done) return <p className={ui.success}>{t.rated}</p>;
  return (
    <form action={action} className="space-y-3">
      <p className="font-medium">{t.rateTitle}</p>
      <div className="flex gap-1" role="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer">
            <input
              type="radio"
              name="rating"
              value={n}
              required
              className="peer sr-only"
              onChange={() => setRating(n)}
            />
            <span
              className={`inline-flex size-10 items-center justify-center rounded-full border text-lg transition peer-focus-visible:ring-2 peer-focus-visible:ring-accent ${
                n <= rating ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"
              }`}
              aria-label={`${n}`}
            >
              ★
            </span>
          </label>
        ))}
      </div>
      <label className={ui.label}>
        {t.feedbackLabel}
        <textarea name="feedback" rows={2} maxLength={1000} className={`${ui.input} mt-1`} />
      </label>
      <ErrorLine state={state} t={t} />
      <button className={ui.buttonGhost} disabled={pending}>
        {t.rate}
      </button>
    </form>
  );
}

export function DisputeForm({ locale, questionId, t }: { locale: string; questionId: string; t: T }) {
  const [state, action, pending] = useActionState(disputeAction.bind(null, locale, questionId), undefined);
  if (state?.done) return <p className={ui.notice}>{t.disputed}</p>;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted hover:text-ink">{t.disputeTitle}</summary>
      <form action={action} className="mt-3 space-y-2">
        <label className={ui.label}>
          {t.disputeLabel}
          <textarea
            name="reason"
            required
            minLength={10}
            maxLength={1000}
            rows={3}
            defaultValue={state?.values?.reason}
            className={`${ui.input} mt-1`}
          />
        </label>
        <ErrorLine state={state} t={t} />
        <button className={ui.buttonGhost} disabled={pending}>
          {t.dispute}
        </button>
      </form>
    </details>
  );
}

/* --------------------------- Responder profile -------------------------- */

export function ResponderProfileForm(props: {
  locale: string;
  t: T;
  initial: {
    headline: string;
    bio: string;
    topics: string[];
    languages: string[];
    priceCents: number;
    accepting: boolean;
  };
  payoutsReady: boolean;
  priceHint: string;
  priceMinCents: number;
  priceMaxCents: number;
}) {
  const { t, initial } = props;
  const [state, action, pending] = useActionState(saveResponderProfileAction.bind(null, props.locale), undefined);
  const chip =
    "cursor-pointer rounded-full border border-line px-3 py-1.5 text-sm transition has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent";
  return (
    <form action={action} className="space-y-4">
      <label className={ui.label}>
        {t.headline}
        <input
          name="headline"
          maxLength={qaConfig.headlineMax}
          defaultValue={state?.values?.headline ?? initial.headline}
          className={`${ui.input} mt-1`}
        />
      </label>
      <label className={ui.label}>
        {t.bio}
        <textarea
          name="bio"
          rows={4}
          maxLength={qaConfig.bioMax}
          defaultValue={state?.values?.bio ?? initial.bio}
          className={`${ui.input} mt-1`}
        />
      </label>
      <fieldset className="space-y-2">
        <legend className={ui.label}>{t.topicsLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {qaConfig.topics.map((topic) => (
            <label key={topic} className={chip}>
              <input
                type="checkbox"
                name="topics"
                value={topic}
                defaultChecked={initial.topics.includes(topic)}
                className="sr-only"
              />
              {t.topics[topic]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className={ui.label}>{t.languagesLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {qaConfig.languages.map((lang) => (
            <label key={lang} className={chip}>
              <input
                type="checkbox"
                name="languages"
                value={lang}
                defaultChecked={initial.languages.includes(lang)}
                className="sr-only"
              />
              {t.languages[lang]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className={ui.label}>
        {t.priceLabel}
        <input
          name="price"
          type="number"
          inputMode="decimal"
          min={props.priceMinCents / 100}
          max={props.priceMaxCents / 100}
          step="1"
          required
          defaultValue={state?.values?.price ?? String(initial.priceCents / 100)}
          className={`${ui.input} mt-1 max-w-40`}
        />
        <span className="mt-1 block text-xs font-normal text-muted">{props.priceHint}</span>
      </label>
      <label className="flex items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          name="accepting"
          defaultChecked={initial.accepting}
          disabled={!props.payoutsReady}
          className="size-5 accent-[var(--accent)]"
        />
        {t.accepting}
      </label>
      <ErrorLine state={state} t={t} />
      {state?.done && <p className={ui.success}>{t.saved}</p>}
      <button className={ui.button} disabled={pending}>
        {t.save}
      </button>
    </form>
  );
}
