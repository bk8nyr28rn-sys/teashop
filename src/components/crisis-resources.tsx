import { CRISIS_RESOURCES } from "@/lib/crisis";

/** Crisis lines list (static; no tracking on these links). */
export function CrisisResources() {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
      {CRISIS_RESOURCES.map((r) => (
        <li key={r.name} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
          <div>
            <p className="font-medium">{r.name}</p>
            <p className="text-xs text-muted">{r.region}</p>
          </div>
          <a
            href={r.href}
            rel="noreferrer noopener"
            target={r.href.startsWith("http") ? "_blank" : undefined}
            className="rounded-full bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent"
          >
            {r.contact}
          </a>
        </li>
      ))}
    </ul>
  );
}
