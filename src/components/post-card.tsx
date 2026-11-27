import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/dictionaries";
import { Avatar } from "./avatar";
import { ui } from "./ui";

export type PostSummary = {
  id: string;
  title: string;
  createdAt: Date;
  authorHandle: string | null;
  comments: number;
  circleName?: string;
};

export function PostCard({
  post,
  href,
  locale,
  dict,
}: {
  post: PostSummary;
  href: string;
  locale: string;
  dict: Dictionary;
}) {
  const date = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(post.createdAt);
  return (
    <Link href={href} className={`${ui.cardLink} flex gap-3`}>
      <Avatar name={post.authorHandle} size={40} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span className="font-medium text-ink">@{post.authorHandle ?? "?"}</span>
          <span>{date}</span>
          {post.circleName && <span className={ui.badgeAccent}>{post.circleName}</span>}
        </p>
        <h3 className="font-semibold leading-snug break-words">{post.title}</h3>
        <p className="text-xs text-muted">{format(dict.circle.comments, { n: post.comments })}</p>
      </div>
    </Link>
  );
}
