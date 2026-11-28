import { Suspense } from "react";
import Link from "next/link";
import { getDb } from "@/db";
import { formatMoney, qaConfig } from "@/config/qa";
import { format, getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { getFinance } from "@/lib/qa-admin";
import { ui } from "@/components/ui";
import { Kpi } from "../ui";
import { Handle } from "@/components/handle";

type Props = PageProps<"/[locale]/admin/finance">;
const RANGES = [7, 30, 90];

export default async function AdminFinancePage({ searchParams }: Props) {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
      <Finance searchParams={searchParams} />
    </Suspense>
  );
}

async function Finance({ searchParams }: Pick<Props, "searchParams">) {
  const [locale, dict, sp] = await Promise.all([getLocale(), getDictionary(), searchParams]);
  const viewer = await requireArea(locale, "admin");
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const fin = (await getFinance(getDb(), viewer, days))!;
  const f = dict.console.finance;
  const money = (c: number) => formatMoney(c, qaConfig.currency, locale);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={ui.h1}>{format(f.title, { n: days })}</h1>
        <nav className="flex gap-1 rounded-full bg-surface-2 p-1" aria-label="Range">
          {RANGES.map((d) => (
            <Link
              key={d}
              href={`/${locale}/admin/finance?days=${d}`}
              aria-current={d === days ? "true" : undefined}
              className={`rounded-full px-3 py-1 text-sm ${d === days ? "bg-surface text-accent shadow-soft" : "text-muted"}`}
            >
              {format(f.range, { n: d })}
            </Link>
          ))}
        </nav>
      </div>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="finance-totals">
        <Kpi label={f.charged} value={money(fin.totals.charged)} />
        <Kpi label={f.refunded} value={fin.totals.refunded ? `−${money(fin.totals.refunded)}` : money(0)} />
        <Kpi label={f.responders} value={money(fin.totals.responders)} />
        <Kpi label={f.platform} value={money(fin.totals.platform)} />
      </section>
      <section className={`${ui.card} space-y-3`}>
        <h2 className={ui.h2}>{f.byResponder}</h2>
        {fin.byResponder.length === 0 ? (
          <p className={ui.muted}>{f.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="py-2 pr-3 text-left font-medium">{f.cols.responder}</th>
                  <th className="px-3 py-2 text-right font-medium">{f.cols.answered}</th>
                  <th className="px-3 py-2 text-right font-medium">{f.cols.charged}</th>
                  <th className="px-3 py-2 text-right font-medium">{f.cols.refunded}</th>
                  <th className="px-3 py-2 text-right font-medium">{f.cols.share}</th>
                  <th className="py-2 pl-3 text-right font-medium">{f.cols.platform}</th>
                </tr>
              </thead>
              <tbody>
                {fin.byResponder.map((r) => (
                  <tr key={r.handle ?? "—"} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <Handle>{r.handle ?? "—"}</Handle>
                    </td>
                    <td className="px-3 py-2.5 text-right">{r.answered}</td>
                    <td className="px-3 py-2.5 text-right">{money(r.charged)}</td>
                    <td className="px-3 py-2.5 text-right">{r.refunded ? `−${money(r.refunded)}` : "—"}</td>
                    <td className="px-3 py-2.5 text-right">{money(r.responder)}</td>
                    <td className="py-2.5 pl-3 text-right">{money(r.platform)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className={ui.muted}>{f.note}</p>
    </div>
  );
}
