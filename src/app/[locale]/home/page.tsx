import { Suspense } from "react";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { circle, circleMember } from "@/db/schema";
import { format, getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { can, circleJoinOutcome } from "@/lib/permissions";
import { ui } from "@/components/ui";
import { InvitePanel } from "./invite-panel";

export default async function HomePage() {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const { userId, profile } = await requireArea(locale, "member");
  const t = dict.home;

  const rows = await getDb()
    .select({ circle, membership: circleMember })
    .from(circle)
    .leftJoin(circleMember, and(eq(circleMember.circleId, circle.id), eq(circleMember.userId, userId)))
    .orderBy(circle.createdAt);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className={ui.h1}>{format(t.title, { name: profile.displayName ?? profile.handle ?? "" })}</h1>
        <p className={ui.muted}>{format(t.trust, { level: profile.trustLevel })}</p>
      </header>

      <section className="space-y-3">
        <h2 className={ui.h2}>{t.circlesTitle}</h2>
        {rows.length === 0 && <p className={ui.muted}>{t.circlesEmpty}</p>}
        <ul className="grid gap-3">
          {rows.map(({ circle: c, membership }) => {
            const outcome = circleJoinOutcome(profile, c, membership);
            return (
              <li key={c.id} className={ui.card}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{c.name[locale] ?? c.name.en}</h3>
                    <p className={ui.muted}>{c.description[locale] ?? c.description.en}</p>
                  </div>
                  <span className={ui.badge}>{t.visibility[c.visibility]}</span>
                </div>
                <p className="mt-2 text-xs text-muted">
                  {t.outcome[outcome]} · {dict.common.comingSoon}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={`${ui.card} space-y-2`}>
        <h2 className={ui.h2}>{t.inviteTitle}</h2>
        <p className={ui.muted}>{t.inviteBody}</p>
        {can(profile, "createInvite") ? <InvitePanel locale={locale} t={t} /> : <p className={ui.muted}>{t.inviteLocked}</p>}
      </section>
    </div>
  );
}
