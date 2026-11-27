import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { getViewer } from "@/lib/dal";
import { canEnterMemberArea } from "@/lib/permissions";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";
import { BottomNav, TopNav, type NavItem } from "./nav";
import { SignOutButton } from "./sign-out-button";
import { ui } from "./ui";

/** Reads the session, so it must render inside a <Suspense> boundary. */
export async function SiteHeader() {
  const [locale, dict, viewer] = await Promise.all([getLocale(), getDictionary(), getViewer()]);
  const member = canEnterMemberArea(viewer?.profile ?? null);
  const items: NavItem[] = member
    ? [
        { href: `/${locale}/home`, label: dict.nav.home, icon: "home" },
        { href: `/${locale}/circles`, label: dict.nav.circles, icon: "circles" },
        { href: `/${locale}/ask`, label: dict.nav.ask, icon: "ask" },
        { href: `/${locale}/me`, label: dict.nav.me, icon: "me" },
      ]
    : [];
  const needsMfa = viewer?.staffMfa === "setup" || viewer?.staffMfa === "verify";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Link href={`/${locale}${member ? "/home" : ""}`} aria-label="Home">
            <Logo />
          </Link>
          <TopNav items={items} />
          <div className="ml-auto flex items-center gap-2">
            {needsMfa && (
              <Link className={ui.badgeDanger} href={`/${locale}/settings/security`}>
                {viewer.staffMfa === "setup" ? dict.nav.mfaSetup : dict.nav.mfaVerify}
              </Link>
            )}
            <LocaleSwitcher current={locale} label={dict.common.language} />
            {!viewer && (
              <Link className={`${ui.button} min-h-9 px-4 text-sm`} href={`/${locale}/sign-in`}>
                {dict.common.signIn}
              </Link>
            )}
            {viewer && !member && (
              <>
                <Link className={ui.buttonSmall} href={`/${locale}/settings`}>
                  {dict.nav.settings}
                </Link>
                <SignOutButton locale={locale} label={dict.common.signOut} />
              </>
            )}
          </div>
        </div>
      </header>
      {member && <BottomNav items={items} />}
    </>
  );
}
