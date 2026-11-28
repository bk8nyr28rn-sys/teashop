import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { hasLocale } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { setPreferredLocale } from "@/lib/accounts";
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
  // Follow the language saved on the account (e.g. signing in on a new device);
  // on first sign-in, remember the language they signed up in.
  const saved = viewer.profile.locale;
  if (hasLocale(saved) && saved !== locale) redirect(`/${saved}/start`);
  if (!saved) await setPreferredLocale(getDb(), viewer.userId, locale);
  redirect(`/${locale}${landingPathFor(viewer.profile.status)}`);
}
