import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { formatMoney } from "@/config/qa";
import { format, getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { getPaymentProvider } from "@/lib/payments";
import { listAvailableResponders } from "@/lib/qa";
import { Avatar } from "@/components/avatar";
import { CrisisResources } from "@/components/crisis-resources";
import { ui } from "@/components/ui";
import { AskForm } from "../../questions/forms";

type Props = PageProps<"/[locale]/ask/[responderId]">;

export default async function ComposePage({ params }: Props) {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
      <Compose params={params} />
    </Suspense>
  );
}

async function Compose({ params }: Pick<Props, "params">) {
  const [{ responderId }, locale, dict] = await Promise.all([params, getLocale(), getDictionary()]);
  const viewer = await requireArea(locale, "member");
  if (!getPaymentProvider()) notFound();
  const r = (await listAvailableResponders(getDb())).find((x) => x.userId === responderId);
  if (!r || r.userId === viewer.userId) notFound();
  const t = dict.qa;
  const price = formatMoney(r.priceCents, r.currency, locale);

  return (
    <div className="space-y-6">
      <Link href={`/${locale}/ask`} className="text-sm text-muted hover:text-ink">
        ← {t.title}
      </Link>
      <header className="flex items-center gap-3">
        <Avatar name={r.handle} size={48} />
        <div>
          <h1 className={ui.h1}>{format(t.composeTitle, { handle: r.handle ?? "" })}</h1>
          <p className={ui.muted}>{format(t.price, { price })}</p>
        </div>
      </header>
      <p className={ui.notice}>{t.anonymity}</p>
      <div className={ui.card}>
        <AskForm locale={locale} responderId={r.userId} priceLabel={price} t={t} resources={<CrisisResources />} />
      </div>
    </div>
  );
}
