import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { listCirclePosts, loadCircle } from "@/lib/community";
import { can } from "@/lib/permissions";
import { ui } from "@/components/ui";
import { PostCard } from "@/components/post-card";
import { joinAction, leaveAction } from "../actions";
import { PostForm } from "../forms";

export default async function CirclePage({ params }: PageProps<"/[locale]/c/[slug]">) {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
      <CircleView params={params} />
    </Suspense>
  );
}

async function CircleView({ params }: Pick<PageProps<"/[locale]/c/[slug]">, "params">) {
  const [{ slug }, locale, dict] = await Promise.all([params, getLocale(), getDictionary()]);
  const viewer = await requireArea(locale, "member");
  const db = getDb();
  const loaded = await loadCircle(db, viewer, { slug });
  if (!loaded) notFound();
  const { circle: c, access } = loaded;
  const t = dict.circle;
  const posts = access.canRead ? await listCirclePosts(db, c.id) : [];
  const m = access.membership;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className={ui.h1}>{c.name[locale] ?? c.name.en}</h1>
          <span className={ui.badge}>{dict.home.visibility[c.visibility]}</span>
        </div>
        <p className={ui.muted}>{c.description[locale] ?? c.description.en}</p>
        <div className="flex flex-wrap items-center gap-3">
          {access.joinOutcome === "join" && (
            <form action={joinAction.bind(null, locale, c.id)}>
              <button className={ui.button}>{t.join}</button>
            </form>
          )}
          {access.joinOutcome === "request" && (
            <form action={joinAction.bind(null, locale, c.id)}>
              <button className={ui.button}>{t.request}</button>
            </form>
          )}
          {(access.joinOutcome === "trust-too-low" || access.joinOutcome === "invite-only") && (
            <p className={ui.muted}>{dict.home.outcome[access.joinOutcome]}</p>
          )}
          {m?.status === "pending" && <p className={ui.muted}>{t.requested}</p>}
          {(m?.status === "active" || m?.status === "pending") && (
            <form action={leaveAction.bind(null, locale, c.id)}>
              <button className={ui.buttonGhost}>{m.status === "pending" ? t.cancelRequest : t.leave}</button>
            </form>
          )}
          {access.isModerator && (
            <Link href={`/${locale}/c/${c.slug}/mod`} className={ui.buttonGhost}>
              {t.moderate}
            </Link>
          )}
        </div>
      </header>

      {access.canWrite &&
        (can(viewer.profile, "post") ? (
          <PostForm locale={locale} circleId={c.id} slug={c.slug} t={t} errors={dict.errors} />
        ) : (
          <p className={ui.notice}>{t.postLocked}</p>
        ))}
      {access.canRead && !access.canWrite && <p className={ui.muted}>{t.mustJoin}</p>}

      {access.canRead ? (
        <section className="space-y-3">
          {posts.length === 0 && <p className={ui.muted}>{t.postsEmpty}</p>}
          <ul className="grid gap-3">
            {posts.map((p) => (
              <li key={p.id}>
                <PostCard post={p} href={`/${locale}/c/${c.slug}/p/${p.id}`} locale={locale} dict={dict} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className={`${ui.panel} text-sm`}>{t.privateNotice}</p>
      )}
    </div>
  );
}
