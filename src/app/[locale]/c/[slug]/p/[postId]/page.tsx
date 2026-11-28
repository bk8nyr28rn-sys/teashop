import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { format, getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { listComments, loadPost } from "@/lib/community";
import { ui } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { deleteOwnAction, moderatorRemoveAction } from "../../../actions";
import { CommentForm, ReportForm } from "../../../forms";
import { Handle } from "@/components/handle";
import { ugc } from "@/lib/content-lang";
import { formatRich, NoTranslate } from "@/components/handle";

type Props = PageProps<"/[locale]/c/[slug]/p/[postId]">;

export default async function PostPage({ params }: Props) {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
      <PostView params={params} />
    </Suspense>
  );
}

const small = "text-xs text-muted hover:text-ink";

async function PostView({ params }: Pick<Props, "params">) {
  const [{ slug, postId }, locale, dict] = await Promise.all([params, getLocale(), getDictionary()]);
  const viewer = await requireArea(locale, "member");
  const db = getDb();
  const loaded = await loadPost(db, viewer, postId);
  if (!loaded || loaded.circle.slug !== slug) notFound();
  const { post: p, circle: c, access, authorHandle } = loaded;
  const t = dict.post;
  const comments = await listComments(db, p.id, true);
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const mine = p.authorId === viewer.userId;
  const postLang = ugc(p.title, p.body);

  return (
    <div className="space-y-6">
      <Link href={`/${locale}/c/${c.slug}`} className={small}>
        ← {format(t.back, { circle: c.name[locale] ?? c.name.en })}
      </Link>

      <article className={`${ui.card} space-y-3`}>
        {p.removedAt && <p className={`${ui.badge} inline-block`}>{t.moderatorView}</p>}
        <h1 {...postLang} className={ui.h1}>
          {p.title}
        </h1>
        <p className="flex items-center gap-2 text-xs text-muted">
          <Avatar name={authorHandle} size={28} />
          <span className="font-medium text-ink">
            {formatRich(dict.circle.by, { handle: <NoTranslate>{authorHandle ?? "?"}</NoTranslate> })}
          </span>
          · {dateFmt.format(p.createdAt)}
        </p>
        <p {...postLang} className="whitespace-pre-wrap break-words">
          {p.body}
        </p>
        {!p.removedAt && (
          <div className="flex flex-wrap items-start gap-4">
            {mine && (
              <form action={deleteOwnAction.bind(null, locale, "post", p.id, c.slug)}>
                <button className={small}>{t.delete}</button>
              </form>
            )}
            {access.isModerator && !mine && (
              <form action={moderatorRemoveAction.bind(null, locale, "post", p.id)}>
                <button className={small}>{t.remove}</button>
              </form>
            )}
            {!mine && <ReportForm locale={locale} targetType="post" targetId={p.id} t={t} errors={dict.errors} />}
          </div>
        )}
      </article>

      <section className="space-y-3">
        <h2 className={ui.h2}>{t.commentsTitle}</h2>
        {comments.length === 0 && <p className={ui.muted}>{t.commentsEmpty}</p>}
        <ul className="space-y-3">
          {comments.map((cm) => {
            const own = cm.authorId === viewer.userId;
            const hidden = cm.removedAt && !(access.isModerator && cm.removal === "moderator");
            return (
              <li key={cm.id} className="flex gap-3" data-testid="comment">
                <Avatar name={hidden ? null : cm.authorHandle} size={32} />
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-3">
                  {hidden ? (
                    <p className="text-sm italic text-muted">
                      {cm.removal === "author" ? t.removedByAuthor : t.removedByModerator}
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted">
                        <span className="font-medium text-ink">
                          <Handle>{cm.authorHandle}</Handle>
                        </span>{" "}
                        · {dateFmt.format(cm.createdAt)}
                        {cm.removedAt && ` · ${t.moderatorView}`}
                      </p>
                      <p {...ugc(cm.body)} className="mt-1 whitespace-pre-wrap break-words text-sm">
                        {cm.body}
                      </p>
                      {!cm.removedAt && !p.removedAt && (
                        <div className="mt-2 flex flex-wrap items-start gap-4">
                          {own && (
                            <form action={deleteOwnAction.bind(null, locale, "comment", cm.id, undefined)}>
                              <button className={small}>{t.delete}</button>
                            </form>
                          )}
                          {access.isModerator && !own && (
                            <form action={moderatorRemoveAction.bind(null, locale, "comment", cm.id)}>
                              <button className={small}>{t.remove}</button>
                            </form>
                          )}
                          {!own && (
                            <ReportForm
                              locale={locale}
                              targetType="comment"
                              targetId={cm.id}
                              t={t}
                              errors={dict.errors}
                            />
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {!p.removedAt &&
          (access.canWrite ? (
            <CommentForm locale={locale} postId={p.id} t={t} errors={dict.errors} />
          ) : (
            <p className={ui.muted}>{dict.circle.mustJoin}</p>
          ))}
      </section>
    </div>
  );
}
