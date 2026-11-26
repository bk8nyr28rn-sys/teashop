import { getDictionary } from "@/i18n/dictionaries";
import { ui } from "@/components/ui";

export default async function SuspendedPage() {
  const dict = await getDictionary();
  return (
    <section className={`${ui.card} space-y-2`}>
      <h1 className={ui.h1}>{dict.suspended.title}</h1>
      <p className={ui.muted}>{dict.suspended.body}</p>
    </section>
  );
}
