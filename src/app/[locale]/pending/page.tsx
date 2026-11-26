import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireViewer } from "@/lib/dal";
import { landingPathFor } from "@/lib/permissions";
import { ui } from "@/components/ui";
import { InviteForm } from "../onboarding/join-forms";

export default async function PendingPage() {
  const dict = await getDictionary();
  return (
    <div className="space-y-6">
      <section className={`${ui.card} space-y-2`}>
        <h1 className={ui.h1}>{dict.pending.title}</h1>
        <p className={ui.muted}>{dict.pending.body}</p>
      </section>
      <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
        <InviteFallback />
      </Suspense>
    </div>
  );
}

async function InviteFallback() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const { profile } = await requireViewer(locale);
  if (profile.status !== "pending") redirect(`/${locale}${landingPathFor(profile.status)}`);
  return <InviteForm locale={locale} t={dict.onboarding} defaultHandle={profile.handle} />;
}
