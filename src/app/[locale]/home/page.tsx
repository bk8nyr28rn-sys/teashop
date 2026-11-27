import { Suspense } from "react";
import Link from "next/link";
import { getDb } from "@/db";
import { format, getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listFeed } from "@/lib/community";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { PostCard } from "@/components/post-card";
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
  const feed = await listFeed(getDb(), userId);
  const name = profile.displayName ?? profile.handle ?? "";

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-3">
        <Avatar name={profile.handle} size={48} />
        <div>
          <h1 className={ui.h1}>{format(t.title, { name })}</h1>
          <p className={ui.muted}>{format(t.trust, { level: profile.trustLevel })}</p>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className={ui.h2}>{t.feedTitle}</h2>
        {feed.length === 0 ? (
          <div className={`${ui.panel} flex flex-col items-start gap-3`}>
            <p className={ui.muted}>{t.feedEmpty}</p>
            <Link href={`/${locale}/circles`} className={ui.buttonGhost}>
              <Icon name="circles" className="size-4" />
              {dict.nav.circles}
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3">
            {feed.map((p) => (
              <li key={p.id}>
                <PostCard
                  post={{ ...p, circleName: p.circleName[locale] ?? p.circleName.en }}
                  href={`/${locale}/c/${p.circleSlug}/p/${p.id}`}
                  locale={locale}
                  dict={dict}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="invite" className={`${ui.card} space-y-2 scroll-mt-20`}>
        <h2 className={ui.h2}>{t.inviteTitle}</h2>
        <p className={ui.muted}>{t.inviteBody}</p>
        {can(profile, "createInvite") ? (
          <InvitePanel locale={locale} t={t} />
        ) : (
          <p className={ui.muted}>{t.inviteLocked}</p>
        )}
      </section>
    </div>
  );
}
