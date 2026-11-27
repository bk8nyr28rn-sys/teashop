import Link from "next/link";
import { siteConfig } from "@/config/site";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { getViewer } from "@/lib/dal";
import { canEnterAdminArea, canEnterMemberArea, canEnterResponderArea } from "@/lib/permissions";
import { LocaleSwitcher } from "./locale-switcher";
import { SignOutButton } from "./sign-out-button";

/** Reads the session, so it must render inside a <Suspense> boundary. */
export async function SiteHeader() {
  const [locale, dict, viewer] = await Promise.all([getLocale(), getDictionary(), getViewer()]);
  const p = viewer?.profile ?? null;
  const link = "whitespace-nowrap text-sm text-muted hover:text-ink";

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href={`/${locale}`} className="font-semibold">
          {siteConfig.name}
        </Link>
        {/* On phones the nav drops to its own row so nothing is cut off. */}
        <nav className="order-last flex w-full items-center gap-4 overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
          {canEnterMemberArea(p) && (
            <Link className={link} href={`/${locale}/home`}>
              {dict.nav.home}
            </Link>
          )}
          {canEnterResponderArea(p) && (
            <Link className={link} href={`/${locale}/responder`}>
              {dict.nav.responder}
            </Link>
          )}
          {canEnterAdminArea(p) && (
            <Link className={link} href={`/${locale}/admin`}>
              {dict.nav.admin}
            </Link>
          )}
          {(viewer?.staffMfa === "setup" || viewer?.staffMfa === "verify") && (
            <Link
              className="whitespace-nowrap rounded-full border border-danger px-2 py-0.5 text-xs text-danger"
              href={`/${locale}/settings/security`}
            >
              {viewer.staffMfa === "setup" ? dict.nav.mfaSetup : dict.nav.mfaVerify}
            </Link>
          )}
          {viewer && (
            <Link className={link} href={`/${locale}/settings`}>
              {dict.nav.settings}
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <LocaleSwitcher current={locale} label={dict.common.language} />
          {viewer ? (
            <SignOutButton locale={locale} label={dict.common.signOut} />
          ) : (
            <Link className={link} href={`/${locale}/sign-in`}>
              {dict.common.signIn}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
