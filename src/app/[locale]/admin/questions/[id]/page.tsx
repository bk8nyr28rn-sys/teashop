import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { format, getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { canUnlock, getQuestionMeta, getUnlockedContent, UNLOCK_REASONS } from "@/lib/qa-admin";
import { Icon } from "@/components/icons";
import { ui } from "@/components/ui";
import { unlockQuestionAction } from "../../actions";
import { QuestionMetaLine, qCode } from "../../ui";

type Props = PageProps<"/[locale]/admin/questions/[id]">;

export default async function AdminQuestionPage({ params, searchParams }: Props) {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
      <Detail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Detail({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ id }, sp, locale, dict] = await Promise.all([params, searchParams, getLocale(), getDictionary()]);
  const viewer = await requireArea(locale, "admin");
  const db = getDb();
  const meta = await getQuestionMeta(db, viewer, id);
  if (!meta) notFound();
  const c = dict.console;
  const content = await getUnlockedContent(db, viewer, id);
  const dt = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <div className="space-y-5">
      <Link href={`/${locale}/admin/questions`} className="text-sm text-muted hover:text-ink">
        ← {c.nav.questions}
      </Link>
      <h1 className={ui.h1}>{format(c.detailTitle, { id: qCode(meta.id) })}</h1>
      <section className={ui.card}>
        <QuestionMetaLine q={meta} locale={locale} dict={dict} />
      </section>

      {content ? (
        <section className="space-y-4 rounded-3xl border border-accent/30 bg-surface p-5" data-testid="unlocked">
          <p className={ui.notice}>
            {format(c.unlockedNote, {
              r: c.reasons[(content.reason ?? "review") as keyof typeof c.reasons] ?? content.reason ?? "",
              t: dt.format(new Date(content.unlockedAt.getTime() + 30 * 60_000)),
            })}
          </p>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className={ui.eyebrow}>{c.asker}</dt>
              <dd>@{content.askerHandle ?? "—"}</dd>
            </div>
            <div>
              <dt className={ui.eyebrow}>{c.question}</dt>
              <dd className="font-semibold">{content.title}</dd>
              <dd className="whitespace-pre-wrap break-words">{content.body}</dd>
            </div>
            {content.answer && (
              <div>
                <dt className={ui.eyebrow}>{c.answer}</dt>
                <dd className="whitespace-pre-wrap break-words">{content.answer}</dd>
              </div>
            )}
            {content.disputeReason && (
              <div>
                <dt className={ui.eyebrow}>{c.disputeReason}</dt>
                <dd className="whitespace-pre-wrap break-words">{content.disputeReason}</dd>
              </div>
            )}
            {content.feedback && (
              <div>
                <dt className={ui.eyebrow}>{c.feedback}</dt>
                <dd className="whitespace-pre-wrap break-words">{content.feedback}</dd>
              </div>
            )}
          </dl>
        </section>
      ) : canUnlock(meta) ? (
        <form
          action={unlockQuestionAction.bind(null, locale, meta.id)}
          className={`${ui.card} space-y-3`}
          data-testid="unlock-form"
        >
          <p className="flex items-center gap-2 text-sm text-muted">
            <Icon name="lock" className="size-4" />
            {c.hidden}
          </p>
          <fieldset className="space-y-1.5">
            <legend className="mb-1 font-medium">{c.reasonTitle}</legend>
            {UNLOCK_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  required
                  defaultChecked={r === (meta.disputedAt ? "review" : "safety")}
                />
                {c.reasons[r]}
              </label>
            ))}
          </fieldset>
          {error && <p className={ui.error}>{c.errors[error as keyof typeof c.errors] ?? c.errors["invalid-input"]}</p>}
          <button className={ui.buttonGhost}>{c.unlock}</button>
        </form>
      ) : (
        <p className={`${ui.panel} flex items-center gap-2 text-sm text-muted`}>
          <Icon name="lock" className="size-4" />
          {c.hidden} · {c.locked}
        </p>
      )}
    </div>
  );
}
