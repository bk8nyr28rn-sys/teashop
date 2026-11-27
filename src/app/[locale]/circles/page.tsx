import { Suspense } from "react";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { circle, circleMember } from "@/db/schema";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { circleJoinOutcome } from "@/lib/permissions";
import { Icon } from "@/components/icons";
import { ui } from "@/components/ui";

export default async function CirclesPage() {
  const dict = await getDictionary();
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className={ui.h1}>{dict.circlesPage.title}</h1>
        <p className={ui.muted}>{dict.circlesPage.intro}</p>
      </header>
      <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
        <CircleList />
      </Suspense>
    </div>
  );
}

async function CircleList() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const { userId, profile } = await requireArea(locale, "member");
  const t = dict.home;
  const rows = await getDb()
    .select({ circle, membership: circleMember })
    .from(circle)
    .leftJoin(circleMember, and(eq(circleMember.circleId, circle.id), eq(circleMember.userId, userId)))
    .orderBy(circle.createdAt);

  if (rows.length === 0) return <p className={ui.muted}>{t.circlesEmpty}</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {rows.map(({ circle: c, membership }) => {
        const outcome = circleJoinOutcome(profile, c, membership);
        const joined = outcome === "already-member";
        return (
          <li key={c.id}>
            <Link href={`/${locale}/c/${c.slug}`} className={`${ui.cardLink} flex h-full flex-col gap-2`}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold">{c.name[locale] ?? c.name.en}</h2>
                {c.visibility === "open" ? (
                  <span className={ui.badge}>{t.visibility.open}</span>
                ) : (
                  <span className={`${ui.badge} inline-flex items-center gap-1`}>
                    <Icon name="lock" className="size-3" />
                    {t.visibility[c.visibility]}
                  </span>
                )}
              </div>
              <p className={`${ui.muted} flex-1`}>{c.description[locale] ?? c.description.en}</p>
              <p>
                <span className={joined ? ui.badgeSuccess : ui.badgeAccent}>{t.outcome[outcome]}</span>
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
