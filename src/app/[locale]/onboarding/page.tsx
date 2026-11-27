import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireViewer } from "@/lib/dal";
import { landingPathFor } from "@/lib/permissions";
import { applicationsOpen } from "@/lib/env";
import { ui } from "@/components/ui";
import { ApplicationForm, InviteForm } from "./join-forms";

export default async function OnboardingPage() {
  const dict = await getDictionary();
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className={ui.h1}>{dict.onboarding.title}</h1>
        <p className={ui.muted}>{dict.onboarding.intro}</p>
      </header>
      <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
        <Forms />
      </Suspense>
    </div>
  );
}

async function Forms() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const { profile } = await requireViewer(locale);
  if (profile.status !== "new" && profile.status !== "rejected") {
    redirect(`/${locale}${landingPathFor(profile.status)}`);
  }
  const t = dict.onboarding;
  return (
    <div className="space-y-6">
      {profile.status === "rejected" && <p className={ui.card}>{t.rejectedNote}</p>}
      <InviteForm locale={locale} t={t} defaultHandle={profile.handle} />
      {applicationsOpen() ? (
        <ApplicationForm locale={locale} t={t} defaultHandle={profile.handle} />
      ) : (
        <p className={ui.card}>{t.inviteOnlyNote}</p>
      )}
    </div>
  );
}
