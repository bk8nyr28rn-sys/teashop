"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { qaConfig } from "@/config/qa";
import { ui } from "@/components/ui";
import { applyResponderAction } from "../../questions/actions";

export function ApplyForm({ locale, t }: { locale: string; t: Dictionary["qa"] }) {
  const [state, action, pending] = useActionState(applyResponderAction.bind(null, locale), undefined);
  const chip =
    "cursor-pointer rounded-full border border-line px-3 py-1.5 text-sm transition has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent";
  return (
    <form action={action} className="space-y-4">
      <label className={ui.label}>
        {t.applyExp}
        <textarea name="experience" rows={5} minLength={30} maxLength={1000} required className={`${ui.input} mt-1`} />
        <span className="mt-1 block text-xs font-normal text-muted">{t.applyExpHint}</span>
      </label>
      <fieldset className="space-y-2">
        <legend className={ui.label}>{t.applyTopics}</legend>
        <div className="flex flex-wrap gap-2">
          {qaConfig.topics.map((topic) => (
            <label key={topic} className={chip}>
              <input type="checkbox" name="topics" value={topic} className="sr-only" />
              {t.topics[topic]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="guidelines" required className="mt-1 size-4 accent-[var(--accent)]" />
        <span>{t.applyGuidelines}</span>
      </label>
      {state?.error && (
        <p className={ui.error}>
          {t.applyErrors[state.error as keyof typeof t.applyErrors] ?? t.applyErrors["invalid-input"]}
        </p>
      )}
      <button className={ui.button} disabled={pending}>
        {t.applySubmit}
      </button>
    </form>
  );
}
