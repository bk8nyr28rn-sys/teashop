import { Suspense } from "react";
import Link from "next/link";
import { getDb } from "@/db";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { listQuestionMeta, QUESTION_FILTERS, type QuestionFilter } from "@/lib/qa-admin";
import { Icon } from "@/components/icons";
import { ui } from "@/components/ui";
import { QuestionMetaLine } from "../ui";

type Props = PageProps<"/[locale]/admin/questions">;

export default async function AdminQuestionsPage({ searchParams }: Props) {
  const dict = await getDictionary();
  return (
    <div className="space-y-5">
      <h1 className={ui.h1}>{dict.console.nav.questions}</h1>
      <p className={`${ui.notice} flex items-start gap-2`}>
        <Icon name="lock" className="mt-0.5 size-4 shrink-0 text-accent" />
        {dict.console.privacy}
      </p>
      <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
        <QuestionList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function QuestionList({ searchParams }: Pick<Props, "searchParams">) {
  const [locale, dict, sp] = await Promise.all([getLocale(), getDictionary(), searchParams]);
  await requireArea(locale, "admin");
  const c = dict.console;
  const filter = (QUESTION_FILTERS as readonly string[]).includes(String(sp.f)) ? (sp.f as QuestionFilter) : "all";
  const rows = await listQuestionMeta(getDb(), { filter });

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2" aria-label="Filter">
        {QUESTION_FILTERS.map((f) => (
          <Link
            key={f}
            href={`/${locale}/admin/questions${f === "all" ? "" : `?f=${f}`}`}
            aria-current={f === filter ? "true" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              f === filter
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {c.filters[f]}
          </Link>
        ))}
      </nav>
      <ul
        className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface"
        data-testid="admin-questions"
      >
        {rows.length === 0 && <li className="px-5 py-4 text-sm text-muted">{c.empty}</li>}
        {rows.map((q) => (
          <li key={q.id}>
            <Link href={`/${locale}/admin/questions/${q.id}`} className="block px-5 py-4 transition hover:bg-surface-2">
              <QuestionMetaLine q={q} locale={locale} dict={dict} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
