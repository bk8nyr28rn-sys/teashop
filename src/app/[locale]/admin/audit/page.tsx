import { Suspense } from "react";
import { getDb } from "@/db";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { listAuditLog } from "@/lib/qa-admin";
import { ui } from "@/components/ui";
import { qCode } from "../ui";
import { Handle } from "@/components/handle";

export default async function AdminAuditPage() {
  const dict = await getDictionary();
  return (
    <div className="space-y-6">
      <h1 className={ui.h1}>{dict.console.audit.title}</h1>
      <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
        <Audit />
      </Suspense>
    </div>
  );
}

/** Opaque ids are shortened; meta is shown as-is (it never contains question text). */
function describeMeta(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "";
  return Object.entries(meta as Record<string, unknown>)
    .map(([k, v]) =>
      v && typeof v === "object" && "from" in v && "to" in v
        ? `${k}: ${String((v as { from: unknown }).from)} → ${String((v as { to: unknown }).to)}`
        : `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`,
    )
    .join(" · ");
}

async function Audit() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const viewer = await requireArea(locale, "admin");
  const rows = await listAuditLog(getDb(), viewer, 200);
  const dt = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });
  if (rows.length === 0) return <p className={`${ui.panel} text-sm text-muted`}>{dict.console.audit.empty}</p>;
  return (
    <ul
      className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface text-sm"
      data-testid="audit"
    >
      {rows.map((r) => (
        <li key={r.id} className="grid gap-1 px-5 py-3 sm:grid-cols-[9rem_1fr]">
          <span className="text-xs text-muted tabular-nums">{dt.format(r.createdAt)}</span>
          <span className="min-w-0 break-words">
            <span className="font-medium">
              {r.actorHandle ? <Handle>{r.actorHandle}</Handle> : dict.console.audit.system}
            </span>{" "}
            <span className="font-mono text-xs">{r.action}</span>{" "}
            <span className="text-muted">
              {r.targetType} #{qCode(r.targetId)}
            </span>
            {r.meta ? <span className="block text-xs text-muted">{describeMeta(r.meta)}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
