"use client";

import { useActionState, useRef } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { QaSettings } from "@/db/schema";
import { ui } from "@/components/ui";
import { refundAction, saveQaSettingsAction } from "./actions";

type C = Dictionary["console"];

/** Refund any amount up to what's left; quick buttons fill common shares. */
export function RefundForm(props: {
  locale: string;
  questionId: string;
  remainingCents: number;
  hint: string;
  t: C;
  errors: Record<string, string>;
}) {
  const { t } = props;
  const [state, action, pending] = useActionState(refundAction.bind(null, props.locale, props.questionId), undefined);
  const amount = useRef<HTMLInputElement>(null);
  const max = props.remainingCents / 100;
  const quick = [
    { label: "25%", value: max * 0.25 },
    { label: "50%", value: max * 0.5 },
    { label: t.reviews.full, value: max },
  ];
  return (
    <form action={action} className="space-y-3" data-testid="refund-form">
      <div className="space-y-1.5">
        <span className={ui.label}>{t.reviews.quick}</span>
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <button
              key={q.label}
              type="button"
              className={ui.buttonSmall + " border border-line"}
              onClick={() => {
                if (amount.current) amount.current.value = q.value.toFixed(2);
              }}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>
      <label className={ui.label}>
        {t.reviews.refundLabel}
        <input
          ref={amount}
          name="amount"
          type="number"
          inputMode="decimal"
          min="0.01"
          max={max}
          step="0.01"
          required
          // No default: the admin must choose an amount on purpose.
          defaultValue={state?.amount ?? ""}
          // "0.00", not the maximum: a placeholder showing the full price reads as pre-filled.
          placeholder="0.00"
          className={`${ui.input} mt-1 max-w-40 tabular-nums`}
        />
        <span className="mt-1 block text-xs font-normal text-muted">{props.hint}</span>
      </label>
      <label className={ui.label}>
        {t.reviews.note}
        <input
          name="note"
          maxLength={500}
          defaultValue={state?.note}
          className={`${ui.input} mt-1`}
          autoComplete="off"
        />
      </label>
      {state?.error && <p className={ui.error}>{props.errors[state.error] ?? props.errors["invalid-input"]}</p>}
      <button className={ui.buttonDanger} disabled={pending}>
        {t.reviews.refund}
      </button>
    </form>
  );
}

export function SettingsForm({ locale, t, initial }: { locale: string; t: C; initial: QaSettings }) {
  const [state, action, pending] = useActionState(saveQaSettingsAction.bind(null, locale), undefined);
  const s = t.settings;
  const field = (name: string, label: string, value: number, attrs: { min: number; max: number; step?: number }) => (
    <label className={ui.label}>
      {label}
      <input
        name={name}
        type="number"
        inputMode="decimal"
        required
        defaultValue={state?.values?.[name] ?? value}
        min={attrs.min}
        max={attrs.max}
        step={attrs.step ?? 1}
        className={`${ui.input} mt-1 max-w-40 tabular-nums`}
      />
    </label>
  );
  return (
    <form action={action} className="space-y-4" data-testid="settings-form">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("feePercent", s.fee, initial.feePercent, { min: 0, max: 50 })}
        {field("answerHours", s.hours, initial.answerHours, { min: 12, max: 168 })}
        {field("priceMin", s.priceMin, initial.priceMinCents / 100, { min: 1, max: 1000, step: 0.01 })}
        {field("priceMax", s.priceMax, initial.priceMaxCents / 100, { min: 1, max: 1000, step: 0.01 })}
        {field("maxOpenPerAsker", s.maxOpen, initial.maxOpenPerAsker, { min: 1, max: 10 })}
      </div>
      <fieldset className={`${ui.panel} grid gap-4 sm:grid-cols-2`}>
        {field("overdueWarnAt", s.warnAt, initial.overdueWarnAt, { min: 1, max: 20 })}
        {field("overduePauseAt", s.pauseAt, initial.overduePauseAt, { min: 1, max: 20 })}
        <p className="text-xs text-muted sm:col-span-2">{s.pauseHint}</p>
      </fieldset>
      <p className={ui.muted}>{s.note}</p>
      {state?.error && <p className={ui.error}>{s.invalid}</p>}
      {state?.done && <p className={ui.success}>{s.saved}</p>}
      <button className={ui.button} disabled={pending}>
        {s.save}
      </button>
    </form>
  );
}
