import { Suspense } from "react";
import { getDb } from "@/db";
import { format, getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { listPendingApplications } from "@/lib/membership";
import { listOpenReports } from "@/lib/community";
import { ReportList } from "@/components/report-list";
import { ui } from "@/components/ui";
import { findMembers, listSuspended } from "@/lib/accounts";
import { decideApplicationAction, setResponderAction, suspendAction, unsuspendAction } from "../actions";

type Props = PageProps<"/[locale]/admin/community">;

export default async function AdminPage({ searchParams }: Props) {
  const dict = await getDictionary();
  return (
    <div className="space-y-8">
      <h1 className={ui.h1}>{dict.console.community.title}</h1>
      <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
        <Queue />
        <Members searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Members({ searchParams }: Pick<Props, "searchParams">) {
  const [locale, dict, sp] = await Promise.all([getLocale(), getDictionary(), searchParams]);
  const viewer = await requireArea(locale, "admin");
  const t = dict.admin;
  const q = typeof sp.q === "string" ? sp.q : "";
  const db = getDb();
  const [results, suspended] = await Promise.all([q ? findMembers(db, q) : [], listSuspended(db)]);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className={ui.h2}>{t.membersTitle}</h2>
        <form className="flex gap-2" action={`/${locale}/admin/community`}>
          <label className="sr-only" htmlFor="q">
            {t.searchLabel}
          </label>
          <input id="q" name="q" defaultValue={q} placeholder={t.searchLabel} className={ui.input} autoComplete="off" />
          <button className={ui.buttonGhost}>{t.search}</button>
        </form>
        {q && results.length === 0 && <p className={ui.muted}>{t.noResults}</p>}
        <ul className="space-y-2">
          {results.map((m) => (
            <li key={m.userId} className={`${ui.card} space-y-2`} data-testid="member-row">
              <p className="text-sm">
                <span className="font-medium">@{m.handle}</span> <span className={ui.badge}>{t.roles[m.role]}</span>{" "}
                <span className={ui.badge}>{t.status[m.status]}</span>
              </p>
              {m.status === "suspended" ? (
                <form action={unsuspendAction.bind(null, locale, m.userId)}>
                  <button className={ui.buttonGhost}>{t.unsuspend}</button>
                </form>
              ) : (
                m.role !== "admin" &&
                m.userId !== viewer.userId && (
                  <div className="space-y-2">
                    {m.status === "approved" && (
                      <form action={setResponderAction.bind(null, locale, m.userId, m.role !== "responder")}>
                        <button className={ui.buttonSmall}>
                          {m.role === "responder" ? dict.qa.removeResponder : dict.qa.makeResponder}
                        </button>
                      </form>
                    )}
                    <form action={suspendAction.bind(null, locale, m.userId)} className="flex flex-wrap gap-2">
                      <input
                        name="reason"
                        placeholder={t.suspendReason}
                        maxLength={500}
                        className={`${ui.input} flex-1`}
                      />
                      <button className="rounded-full border border-danger px-4 py-2 text-danger hover:bg-danger-soft">
                        {t.suspend}
                      </button>
                    </form>
                  </div>
                )
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className={ui.h2}>{t.suspendedTitle}</h2>
        {suspended.length === 0 && <p className={ui.muted}>{t.suspendedEmpty}</p>}
        <ul className="space-y-2">
          {suspended.map((m) => (
            <li key={m.userId} className={`${ui.card} flex flex-wrap items-center justify-between gap-2`}>
              <span>@{m.handle ?? "—"}</span>
              <form action={unsuspendAction.bind(null, locale, m.userId)}>
                <button className={ui.buttonGhost}>{t.unsuspend}</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
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
