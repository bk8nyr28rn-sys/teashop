import { Suspense } from "react";
import { getDb } from "@/db";
import { format, getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { listPendingApplications } from "@/lib/membership";
import { listOpenReports } from "@/lib/community";
import { ReportList } from "@/components/report-list";
import { ui } from "@/components/ui";
import { decideApplicationAction } from "./actions";

export default async function AdminPage() {
  const dict = await getDictionary();
  return (
    <div className="space-y-6">
      <h1 className={ui.h1}>{dict.admin.title}</h1>
      <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
        <Queue />
      </Suspense>
    </div>
  );
}

async function Queue() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  await requireArea(locale, "admin");
  const t = dict.admin;
  const [apps, reports] = await Promise.all([listPendingApplications(getDb()), listOpenReports(getDb(), "all")]);
  const dateFmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className={ui.h2}>{t.reportsTitle}</h2>
        <ReportList reports={reports} locale={locale} dict={dict} />
      </section>
      <section className="space-y-3">
        <h2 className={ui.h2}>{t.queueTitle}</h2>
        <p className={ui.muted}>{t.decisionNote}</p>
        {apps.length === 0 && <p className={ui.muted}>{t.queueEmpty}</p>}
        {apps.map((app) => (
          <article key={app.id} className={`${ui.card} space-y-3`} data-testid="application">
            <header className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-medium">@{app.handle}</span>
              <span className={ui.muted}>{format(t.submitted, { date: dateFmt.format(app.createdAt) })}</span>
            </header>
            <dl className="space-y-2 text-sm">
              {app.answers?.map((a) => (
                <div key={a.questionId}>
                  <dt className="font-medium">
                    {dict.onboarding.questions[a.questionId as keyof typeof dict.onboarding.questions] ?? a.questionId}
                  </dt>
                  <dd className="whitespace-pre-wrap text-muted">{a.answer}</dd>
                </div>
              ))}
            </dl>
            <div className="flex gap-3">
              <form action={decideApplicationAction.bind(null, locale, app.id, "approved")}>
                <button className={ui.button}>{t.approve}</button>
              </form>
              <form action={decideApplicationAction.bind(null, locale, app.id, "rejected")}>
                <button className={ui.buttonGhost}>{t.reject}</button>
              </form>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
