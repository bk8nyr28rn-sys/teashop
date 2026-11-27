import { Suspense } from "react";
import Link from "next/link";
import { getDb } from "@/db";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { getPaymentProvider } from "@/lib/payments";
import { expireOverdue, listMyQuestions } from "@/lib/qa";
import { Avatar } from "@/components/avatar";
import { QuestionStatusBadge } from "@/components/question-status";
import { ui } from "@/components/ui";

export default async function MyQuestionsPage() {
  const dict = await getDictionary();
  return (
    <div className="space-y-6">
      <h1 className={ui.h1}>{dict.qa.myQuestions}</h1>
      <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const viewer = await requireArea(locale, "member");
  const t = dict.qa;
  const db = getDb();
  const provider = getPaymentProvider();
  if (provider) await expireOverdue(db, provider); // lazy sweep between cron runs
  const rows = await listMyQuestions(db, viewer.userId);
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  if (rows.length === 0) {
    return (
      <div className={`${ui.panel} flex flex-col items-start gap-3`}>
        <p className={ui.muted}>{t.myQuestionsEmpty}</p>
        <Link href={`/${locale}/ask`} className={ui.buttonGhost}>
          {t.title}
        </Link>
      </div>
    );
  }
  return (
    <ul className="grid gap-3">
      {rows.map((q) => (
        <li key={q.id}>
          <Link href={`/${locale}/questions/${q.id}`} className={`${ui.cardLink} flex items-center gap-3`}>
            <Avatar name={q.responderHandle} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{q.title}</p>
              <p className="text-xs text-muted">
                @{q.responderHandle ?? "?"} · {dateFmt.format(q.createdAt)}
              </p>
            </div>
            <QuestionStatusBadge status={q.status} t={t} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
