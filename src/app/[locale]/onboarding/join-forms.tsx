"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { ui } from "@/components/ui";
import { ANSWER_MAX, ANSWER_MIN, APPLICATION_QUESTIONS } from "@/lib/application-questions";
import { siteConfig } from "@/config/site";
import { redeemInviteAction, submitApplicationAction, type JoinFormState } from "./actions";

type T = Dictionary["onboarding"];

type Values = Record<string, string> | undefined;

function IdentityFields({ t, defaultHandle, values }: { t: T; defaultHandle?: string | null; values: Values }) {
  return (
    <>
      <div>
        <label className={ui.label}>
          {t.handleLabel}
          <input
            name="handle"
            required
            minLength={3}
            maxLength={20}
            pattern="[a-z0-9_]{3,20}"
            autoComplete="off"
            defaultValue={values?.handle ?? defaultHandle ?? ""}
            className={`${ui.input} mt-1`}
          />
        </label>
        <p className={ui.muted}>{t.handleHint}</p>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="ageConfirmed" required className="mt-1" defaultChecked={values?.ageConfirmed === "on"} />
        <span>{t.ageConfirm.replace("{age}", String(siteConfig.minimumAge))}</span>
      </label>
    </>
  );
}

function ErrorLine({ t, state }: { t: T; state: JoinFormState }) {
  return state?.error ? <p className={ui.error}>{t.errors[state.error]}</p> : null;
}

export function InviteForm({ locale, t, defaultHandle }: { locale: string; t: T; defaultHandle?: string | null }) {
  const [state, action, pending] = useActionState(redeemInviteAction.bind(null, locale), undefined);
  return (
    <form action={action} className={`${ui.card} space-y-3`}>
      <h2 className={ui.h2}>{t.inviteTitle}</h2>
      <label className={ui.label}>
        {t.inviteLabel}
        <input
          name="code"
          required
          autoComplete="off"
          placeholder="XXXXX-XXXXX"
          defaultValue={state?.values?.code ?? ""}
          className={`${ui.input} mt-1 uppercase tracking-widest`}
        />
      </label>
      <IdentityFields t={t} defaultHandle={defaultHandle} values={state?.values} />
      <ErrorLine t={t} state={state} />
      <button className={ui.button} disabled={pending}>
        {t.inviteSubmit}
      </button>
    </form>
  );
}

export function ApplicationForm({ locale, t, defaultHandle }: { locale: string; t: T; defaultHandle?: string | null }) {
  const [state, action, pending] = useActionState(submitApplicationAction.bind(null, locale), undefined);
  const hint = t.answerHint.replace("{min}", String(ANSWER_MIN)).replace("{max}", String(ANSWER_MAX));
  return (
    <form action={action} className={`${ui.card} space-y-3`}>
      <h2 className={ui.h2}>{t.applyTitle}</h2>
      <p className={ui.muted}>{t.applyIntro}</p>
      {APPLICATION_QUESTIONS.map((id) => (
        <label key={id} className={ui.label}>
          {t.questions[id]}
          <textarea
            name={`answer_${id}`}
            required
            minLength={ANSWER_MIN}
            maxLength={ANSWER_MAX}
            rows={3}
            defaultValue={state?.values?.[`answer_${id}`] ?? ""}
            className={`${ui.input} mt-1`}
          />
          <span className="text-xs font-normal text-muted">{hint}</span>
        </label>
      ))}
      <IdentityFields t={t} defaultHandle={defaultHandle} values={state?.values} />
      <ErrorLine t={t} state={state} />
      <button className={ui.button} disabled={pending}>
        {t.applySubmit}
      </button>
    </form>
  );
}
