import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "../globals.css";
import { siteConfig } from "@/config/site";
import { htmlLang, locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Icon } from "@/components/icons";
import { TranslationGuard } from "@/components/translation-guard";

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    title: { default: siteConfig.name, template: `%s · ${siteConfig.name}` },
    description: dict.common.tagline,
    // A community like this should not be indexed with member content.
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#171514" },
  ],
};

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <html lang={htmlLang(locale)} className="h-full">
      <body className="flex min-h-full flex-col">
        <TranslationGuard />
        <Suspense fallback={<div className="h-14 border-b border-line/70" />}>
          <SiteHeader />
        </Suspense>
        {/* Admin pages mark themselves with .admin-wide to get a wider canvas. */}
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 has-[.admin-wide]:max-w-5xl">{children}</main>
        <footer className="pb-tabbar mx-auto w-full max-w-2xl px-4 pt-10">
          <Link
            href={`/${locale}/help`}
            className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm text-muted transition hover:bg-surface-2 hover:text-ink"
          >
            <Icon name="help" className="size-4" />
            {dict.nav.help}
          </Link>
        </footer>
      </body>
    </html>
  );
}
