import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { ui } from "@/components/ui";
import { SignInForm } from "./sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.common.signIn };
}

export default async function SignInPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <div className={`${ui.card} space-y-4`}>
      <h1 className={ui.h1}>{dict.signIn.title}</h1>
      <p className={ui.muted}>{dict.signIn.intro}</p>
      <SignInForm locale={locale} t={dict.signIn} />
    </div>
  );
}
