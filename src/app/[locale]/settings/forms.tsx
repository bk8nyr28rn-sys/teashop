"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { ui } from "@/components/ui";
import {
  confirmMfaSetupAction,
  deleteAccountAction,
  reauthenticateAction,
  signOutOthersAction,
  verifyMfaAction,
} from "./actions";

export function SignOutOthersForm({ locale, t }: { locale: string; t: Dictionary["settings"] }) {
  const [state, action, pending] = useActionState(signOutOthersAction.bind(null, locale), undefined);
  return (
    <form action={action} className="space-y-2">
      <button className={ui.buttonGhost} disabled={pending}>
        {t.signOutOthers}
      </button>
      {state?.count !== undefined && (
        <p className={ui.muted}>{t.signedOutOthers.replace("{n}", String(state.count))}</p>
      )}
    </form>
  );
}

export function DeleteAccountForm(props: { locale: string; word: string; fresh: boolean; t: Dictionary["settings"] }) {
  const { t } = props;
  const [state, action, pending] = useActionState(deleteAccountAction.bind(null, props.locale), undefined);

  if (!props.fresh || state?.error === "stale-session") {
    return (
      <form action={reauthenticateAction.bind(null, props.locale)} className="space-y-2">
        <p className={ui.muted}>{t.deleteNeedsFresh}</p>
        <button className={ui.buttonGhost}>{t.signInAgain}</button>
      </form>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <label className={ui.label}>
        {t.deleteConfirmLabel.replace("{word}", props.word)}
        <input name="confirm" required autoComplete="off" className={`${ui.input} mt-1`} />
      </label>
      {state?.error === "mismatch" && <p className={ui.error}>{t.deleteMismatch}</p>}
      <button
        disabled={pending}
        className="inline-flex items-center justify-center rounded-xl bg-danger px-4 py-2 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {t.deleteButton}
      </button>
    </form>
  );
}

type SecurityT = Dictionary["security"];

function CodeInput({ t }: { t: SecurityT }) {
  return (
    <label className={ui.label}>
      {t.codeLabel}
      <input
        name="code"
        required
        autoComplete="one-time-code"
        inputMode="text"
        maxLength={12}
        className={`${ui.input} mt-1 font-mono tracking-widest`}
      />
    </label>
  );
}

export function ConfirmSetupForm({ locale, t, next }: { locale: string; t: SecurityT; next: string }) {
  const [state, action, pending] = useActionState(confirmMfaSetupAction.bind(null, locale), undefined);
  if (state?.backupCodes) {
    return (
      <div className="space-y-3" data-testid="backup-codes">
        <h2 className={ui.h2}>{t.backupTitle}</h2>
        <p className={ui.muted}>{t.backupBody}</p>
        <ul translate="no" className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-bg p-3 font-mono text-sm">
          {state.backupCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <Link href={next} className={ui.button}>
          {t.backupDone}
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <CodeInput t={t} />
      {state?.error && <p className={ui.error}>{t.errors[state.error]}</p>}
      <button className={ui.button} disabled={pending}>
        {t.confirm}
      </button>
    </form>
  );
}

export function VerifyForm({ locale, t }: { locale: string; t: SecurityT }) {
  const [state, action, pending] = useActionState(verifyMfaAction.bind(null, locale), undefined);
  return (
    <form action={action} className="space-y-3">
      <CodeInput t={t} />
      {state?.error && <p className={ui.error}>{t.errors[state.error]}</p>}
      <button className={ui.button} disabled={pending}>
        {t.verify}
      </button>
    </form>
  );
}
