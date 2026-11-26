import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { ui } from "@/components/ui";

export default async function ResponderPage() {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
      <Desk />
    </Suspense>
  );
}

async function Desk() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  await requireArea(locale, "responder");
  return (
    <section className={`${ui.card} space-y-2`}>
      <h1 className={ui.h1}>{dict.responder.title}</h1>
      <p className={ui.muted}>{dict.responder.body}</p>
      <p className={ui.badge + " inline-block"}>{dict.common.comingSoon}</p>
    </section>
  );
}
