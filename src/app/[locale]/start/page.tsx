import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireViewer } from "@/lib/dal";
import { landingPathFor } from "@/lib/permissions";

/** Post-sign-in router: sends each user to the step they're at. */
export default async function StartPage() {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<p className="text-muted">{dict.common.loading}</p>}>
      <Route />
    </Suspense>
  );
}

async function Route(): Promise<never> {
  const locale = await getLocale();
  const viewer = await requireViewer(locale);
  redirect(`/${locale}${landingPathFor(viewer.profile.status)}`);
}
