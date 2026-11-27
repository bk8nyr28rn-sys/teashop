import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/dictionaries";
import type { listOpenReports } from "@/lib/community";
import { resolveReportAction } from "@/app/[locale]/c/actions";
import { ui } from "./ui";

type Reports = Awaited<ReturnType<typeof listOpenReports>>;

/** Open reports with a snapshot of the reported text and uphold/dismiss buttons. */
export function ReportList({ reports, locale, dict }: { reports: Reports; locale: string; dict: Dictionary }) {
  const t = dict.mod;
  if (reports.length === 0) return <p className={ui.muted}>{t.reportsEmpty}</p>;
  return (
    <ul className="space-y-3">
      {reports.map((r) => (
        <li key={r.id} className={`${ui.card} space-y-2`} data-testid="report">
          <p className="text-sm font-medium">
            {format(r.targetType === "post" ? t.reportedPost : t.reportedComment, { handle: r.authorHandle ?? "?" })}
            {" · "}
            <span className={r.reason === "self_harm" || r.reason === "outing" ? "text-danger" : ""}>
              {dict.post.reasons[r.reason]}
            </span>
          </p>
          <blockquote className="whitespace-pre-wrap break-words border-l-2 border-line pl-3 text-sm text-muted">
            {r.targetType === "post" ? `${r.postTitle}\n${r.postBody}` : r.commentBody}
          </blockquote>
          {r.details && <p className="text-sm">“{r.details}”</p>}
          <div className="flex flex-wrap items-center gap-3">
            <form action={resolveReportAction.bind(null, locale, r.id, "upheld")}>
              <button className={ui.button}>{t.uphold}</button>
            </form>
            <form action={resolveReportAction.bind(null, locale, r.id, "dismissed")}>
              <button className={ui.buttonGhost}>{t.dismiss}</button>
            </form>
            {r.postId && (
              <Link className="text-sm text-muted hover:text-ink" href={`/${locale}/c/${r.circleSlug}/p/${r.postId}`}>
                {t.open}
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
