import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "../globals.css";
import { siteConfig } from "@/config/site";
import { locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { SiteHeader } from "@/components/site-header";

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
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1917" },
  ],
};

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  return (
    <html lang={locale === "zh" ? "zh-Hans" : "en"} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Suspense fallback={<div className="h-14 border-b border-line" />}>
          <SiteHeader />
        </Suspense>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
