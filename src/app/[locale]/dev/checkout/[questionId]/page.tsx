import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { formatMoney } from "@/config/qa";
import { format, getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { getPaymentProvider } from "@/lib/payments";
import { getQuestionView } from "@/lib/qa";
import { ui } from "@/components/ui";
import { cancelQuestionAction, devAuthorizeAction } from "../../../questions/actions";

type Props = PageProps<"/[locale]/dev/checkout/[questionId]">;

/** Stand-in for Stripe Checkout when running without Stripe keys (dev only). */
export default async function DevCheckoutPage({ params }: Props) {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
      <Checkout params={params} />
    </Suspense>
  );
}

async function Checkout({ params }: Pick<Props, "params">) {
  const [{ questionId }, locale, dict] = await Promise.all([params, getLocale(), getDictionary()]);
  const viewer = await requireArea(locale, "member");
  if (getPaymentProvider()?.name !== "fake") notFound();
  const q = await getQuestionView(getDb(), viewer, questionId);
  if (!q || q.viewerRole !== "asker" || q.status !== "awaiting_payment") notFound();
  const t = dict.qa;
  const price = formatMoney(q.priceCents, q.currency, locale);

  return (
    <section className={`${ui.card} mx-auto max-w-sm space-y-4 text-center`}>
      <p className={ui.badgeWarn}>DEV</p>
      <h1 className={ui.h1}>{t.devCheckoutTitle}</h1>
      <p className={ui.muted}>{t.devCheckoutBody}</p>
      <p className="text-3xl font-semibold">{price}</p>
      <form action={devAuthorizeAction.bind(null, locale, q.id)}>
        <button className={`${ui.button} w-full`}>{format(t.devAuthorize, { price })}</button>
      </form>
      <form action={cancelQuestionAction.bind(null, locale, q.id)}>
        <button className={`${ui.buttonSmall} mx-auto`}>{dict.qa.cancel}</button>
      </form>
    </section>
  );
}
