import { Suspense } from "react";
import Link from "next/link";
import { format, getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireArea } from "@/lib/dal";
import { getDb } from "@/db";
import { getMyResponderApplication } from "@/lib/qa-admin";
import { Avatar } from "@/components/avatar";
import { Icon, type IconName } from "@/components/icons";
import { SignOutButton } from "@/components/sign-out-button";
import { ui } from "@/components/ui";

export default async function MePage() {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
      <Me />
    </Suspense>
  );
}

type Row = { href: string; label: string; icon: IconName; note?: string };

function LinkList({ rows }: { rows: Row[] }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
      {rows.map((r) => (
        <li key={r.href}>
          <Link href={r.href} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-surface-2">
            <Icon name={r.icon} className="size-5 text-accent" />
            <span className="flex-1 font-medium">{r.label}</span>
            {r.note && <span className={ui.badgeDanger}>{r.note}</span>}
            <Icon name="arrow" className="size-4 text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Me() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const viewer = await requireArea(locale, "member");
  const { profile, realRole, staffMfa } = viewer;
  const t = dict.me;
  const l = (p: string) => `/${locale}${p}`;
  const mfaNote = staffMfa === "setup" ? dict.nav.mfaSetup : staffMfa === "verify" ? dict.nav.mfaVerify : undefined;

  const staff: Row[] = [];
  if (realRole === "responder" || realRole === "admin") {
    staff.push(
      { href: l("/responder"), label: t.responderDesk, icon: "ask" },
      { href: l("/responder/profile"), label: t.responderProfile, icon: "me" },
    );
  }
  if (realRole === "admin") staff.push({ href: l("/admin"), label: t.admin, icon: "shield" });
  const app = realRole === "member" ? await getMyResponderApplication(getDb(), viewer.userId) : null;
  const q = dict.qa;
  if (staff.length) staff.push({ href: l("/settings/security"), label: t.security, icon: "lock", note: mfaNote });

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Avatar name={profile.handle} size={64} />
        <div>
          <h1 className={ui.h1}>@{profile.handle}</h1>
          <p className={ui.muted}>{format(dict.home.trust, { level: profile.trustLevel })}</p>
        </div>
      </header>

      <LinkList
        rows={[
          { href: l("/questions"), label: t.myQuestions, icon: "ask" },
          { href: l("/home#invite"), label: t.invite, icon: "circles" },
          { href: l("/settings"), label: t.settings, icon: "me" },
          { href: l("/help"), label: t.help, icon: "help" },
          ...(realRole === "member" && app?.status !== "pending"
            ? [{ href: l("/responder/apply"), label: t.applyResponder, icon: "shield" as const }]
            : []),
        ]}
      />
      {app && (
        <p className={app.status === "declined" ? ui.panel + " text-sm" : ui.notice}>
          {app.status === "pending" ? q.applyPending : app.status === "approved" ? q.applyApproved : q.applyDeclined}
        </p>
      )}

      {staff.length > 0 && (
        <section className="space-y-2">
          <h2 className={ui.eyebrow}>{t.staffTitle}</h2>
          <LinkList rows={staff} />
        </section>
      )}

      <div className="flex justify-center pt-2">
        <SignOutButton locale={locale} label={dict.common.signOut} />
      </div>
    </div>
  );
}
