import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { ui } from "@/components/ui";

export default async function SuspendedPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <section className={`${ui.card} space-y-2`}>
      <h1 className={ui.h1}>{dict.suspended.title}</h1>
      <p className={ui.muted}>{dict.suspended.body}</p>
      <p className="text-sm">
        <Link className="text-accent underline" href={`/${locale}/settings`}>
          {dict.suspended.deleteHint}
        </Link>
      </p>
    </section>
  );
}
