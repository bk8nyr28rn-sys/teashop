import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { getMyResponderApplication } from "@/lib/qa-admin";
import { ui } from "@/components/ui";
import { ApplyForm } from "./apply-form";

export default async function ApplyResponderPage() {
  const dict = await getDictionary();
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className={ui.h1}>{dict.qa.applyTitle}</h1>
        <p className="text-muted">{dict.qa.applyIntro}</p>
      </header>
      <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
        <Apply />
      </Suspense>
    </div>
  );
}

async function Apply() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const viewer = await requireArea(locale, "member");
  if (viewer.realRole !== "member") redirect(`/${locale}/responder`);
  const t = dict.qa;
  const app = await getMyResponderApplication(getDb(), viewer.userId);
  if (app?.status === "pending") {
    return (
      <div className="space-y-3">
        <p className={ui.notice}>{t.applyPending}</p>
        <Link href={`/${locale}/me`} className={ui.buttonGhost}>
          {dict.nav.me}
        </Link>
      </div>
    );
  }
  if (viewer.profile.trustLevel < 1) return <p className={ui.notice}>{t.applyNotEligible}</p>;
  return (
    <section className={ui.card}>
      <ApplyForm locale={locale} t={t} />
    </section>
  );
}
