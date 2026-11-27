import type { Metadata } from "next";
import { getDictionary } from "@/i18n/dictionaries";
import { CrisisResources } from "@/components/crisis-resources";
import { Icon } from "@/components/icons";
import { ui } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.help.title };
}

/** Public, static, no sign-in needed: reachable from every page. */
export default async function HelpPage() {
  const dict = await getDictionary();
  const t = dict.help;
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Icon name="help" className="size-6" />
        </span>
        <h1 className={ui.h1}>{t.title}</h1>
        <p className="text-muted">{t.intro}</p>
      </header>
      <p className={`${ui.notice} font-medium`}>{t.emergency}</p>
      <section className="space-y-2">
        <h2 className={ui.eyebrow}>{t.resourcesTitle}</h2>
        <CrisisResources />
      </section>
      <p className={ui.muted}>{t.note}</p>
    </div>
  );
}
