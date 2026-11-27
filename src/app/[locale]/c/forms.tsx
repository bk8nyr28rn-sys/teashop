"use client";

import { useActionState, useEffect, useRef } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ReportReason } from "@/db/schema";
import { LIMITS } from "@/lib/community-limits";
import { ui } from "@/components/ui";
import { createCommentAction, createPostAction, reportAction, type FormState } from "./actions";

type Errors = Dictionary["errors"];

function ErrorLine({ state, errors }: { state: FormState; errors: Errors }) {
  return state?.error ? <p className={ui.error}>{errors[state.error]}</p> : null;
}

export function PostForm(props: {
  locale: string;
  circleId: string;
  slug: string;
  t: Dictionary["circle"];
  errors: Errors;
}) {
  const { t } = props;
  const [state, action, pending] = useActionState(
    createPostAction.bind(null, props.locale, props.circleId, props.slug),
    undefined,
  );
  return (
    <form action={action} className={`${ui.card} space-y-3`}>
      <h2 className={ui.h2}>{t.newPost}</h2>
      <label className={ui.label}>
        {t.titleLabel}
        <input
          name="title"
          required
          maxLength={LIMITS.titleMax}
          defaultValue={state?.values?.title}
          className={`${ui.input} mt-1`}
        />
      </label>
      <label className={ui.label}>
        {t.bodyLabel}
        <textarea
          name="body"
          required
          rows={4}
          maxLength={LIMITS.postBodyMax}
          defaultValue={state?.values?.body}
          className={`${ui.input} mt-1`}
        />
      </label>
      <p className="text-xs text-muted">{t.privacyReminder}</p>
      <ErrorLine state={state} errors={props.errors} />
      <button className={ui.button} disabled={pending}>
        {t.publish}
      </button>
    </form>
  );
}

export function CommentForm(props: { locale: string; postId: string; t: Dictionary["post"]; errors: Errors }) {
  const [state, action, pending] = useActionState(
    createCommentAction.bind(null, props.locale, props.postId),
    undefined,
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.done) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <label className={ui.label}>
        {props.t.commentLabel}
        <textarea
          name="body"
          required
          rows={3}
          maxLength={LIMITS.commentMax}
          defaultValue={state?.values?.body}
          className={`${ui.input} mt-1`}
        />
      </label>
      <ErrorLine state={state} errors={props.errors} />
      <button className={ui.button} disabled={pending}>
        {props.t.send}
      </button>
    </form>
  );
}

const REASONS: ReportReason[] = ["harassment", "hate", "outing", "sexual", "spam", "self_harm", "other"];

/** Collapsed by default so it doesn't clutter threads; works without extra JS for the toggle. */
export function ReportForm(props: {
  locale: string;
  targetType: "post" | "comment";
  targetId: string;
  t: Dictionary["post"];
  errors: Errors;
}) {
  const { t } = props;
  const [state, action, pending] = useActionState(
    reportAction.bind(null, props.locale, props.targetType, props.targetId),
    undefined,
  );
  if (state?.done) return <p className="text-xs text-muted">{t.reported}</p>;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-xs text-muted hover:text-ink">{t.report}</summary>
      <form action={action} className="mt-2 space-y-2 rounded-xl border border-line p-3">
        <fieldset className="space-y-1">
          <legend className="mb-1 font-medium">{t.reportTitle}</legend>
          {REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2">
              <input type="radio" name="reason" value={r} required />
              {t.reasons[r]}
            </label>
          ))}
        </fieldset>
        <p className="text-xs text-muted">{t.selfHarmNote}</p>
        <label className={ui.label}>
          {t.reportDetails}
          <textarea name="details" rows={2} maxLength={LIMITS.reportDetailsMax} className={`${ui.input} mt-1`} />
        </label>
        <ErrorLine state={state} errors={props.errors} />
        <button className={ui.buttonGhost} disabled={pending}>
          {t.reportSubmit}
        </button>
      </form>
    </details>
  );
}
