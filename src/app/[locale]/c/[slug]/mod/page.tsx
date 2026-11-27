import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { format, getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { listMembers, listOpenReports, listPendingRequests, loadCircle } from "@/lib/community";
import { ui } from "@/components/ui";
import { ReportList } from "@/components/report-list";
import { decideJoinAction, setModeratorAction } from "../../actions";

type Props = PageProps<"/[locale]/c/[slug]/mod">;

export default async function ModPage({ params }: Props) {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
      <ModView params={params} />
    </Suspense>
  );
}

async function ModView({ params }: Pick<Props, "params">) {
  const [{ slug }, locale, dict] = await Promise.all([params, getLocale(), getDictionary()]);
  const viewer = await requireArea(locale, "member");
  const db = getDb();
  const loaded = await loadCircle(db, viewer, { slug });
  // Non-moderators get a 404 rather than a hint that the page exists.
  if (!loaded || !loaded.access.isModerator) notFound();
  const { circle: c } = loaded;
  const t = dict.mod;
  const isAdmin = viewer.profile.role === "admin";
  const [requests, reports, members] = await Promise.all([
    listPendingRequests(db, c.id),
    listOpenReports(db, [c.id]),
    listMembers(db, c.id),
  ]);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <Link href={`/${locale}/c/${c.slug}`} className="text-xs text-muted hover:text-ink">
          ← {c.name[locale] ?? c.name.en}
        </Link>
        <h1 className={ui.h1}>{format(t.title, { circle: c.name[locale] ?? c.name.en })}</h1>
      </header>

      <section className="space-y-3">
        <h2 className={ui.h2}>{t.reportsTitle}</h2>
        <ReportList reports={reports} locale={locale} dict={dict} />
      </section>

      <section className="space-y-3">
        <h2 className={ui.h2}>{t.requestsTitle}</h2>
        {requests.length === 0 && <p className={ui.muted}>{t.requestsEmpty}</p>}
        <ul className="space-y-2">
          {requests.map((r) => (
            <li
              key={r.userId}
              className={`${ui.card} flex flex-wrap items-center justify-between gap-3`}
              data-testid="join-request"
            >
              <span>
                @{r.handle} <span className={ui.muted}>· {format(t.trust, { level: r.trustLevel })}</span>
              </span>
              <span className="flex gap-2">
                <form action={decideJoinAction.bind(null, locale, c.id, r.userId, true)}>
                  <button className={ui.button}>{t.approve}</button>
                </form>
                <form action={decideJoinAction.bind(null, locale, c.id, r.userId, false)}>
                  <button className={ui.buttonGhost}>{t.decline}</button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className={ui.h2}>{t.membersTitle}</h2>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
              <span>
                @{m.handle} {m.role === "moderator" && <span className={ui.badge}>{t.moderator}</span>}
              </span>
              {isAdmin && m.userId !== viewer.userId && (
                <form action={setModeratorAction.bind(null, locale, c.id, m.userId, m.role !== "moderator")}>
                  <button className="text-xs text-muted hover:text-ink">
                    {m.role === "moderator" ? t.removeMod : t.makeMod}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
