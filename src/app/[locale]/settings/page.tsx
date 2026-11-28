import { Suspense } from "react";
import Link from "next/link";
import { Handle } from "@/components/handle";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { isFreshSession, requireViewer } from "@/lib/dal";
import { LanguagePicker } from "@/components/locale-switcher";
import { ui } from "@/components/ui";
import { DeleteAccountForm, SignOutOthersForm } from "./forms";

export default async function SettingsPage() {
  const dict = await getDictionary();
  return (
    <div className="space-y-6">
      <h1 className={ui.h1}>{dict.settings.title}</h1>
      <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  // Any signed-in user, including suspended ones, may manage or delete their account.
  const viewer = await requireViewer(locale);
  const t = dict.settings;

  return (
    <div className="space-y-6">
      <section className={`${ui.card} space-y-2`}>
        <h2 className={ui.h2}>{t.accountTitle}</h2>
        <dl className="space-y-1 text-sm">
          <div>
            <dt className={ui.muted}>{t.handle}</dt>
            <dd>{viewer.profile.handle ? <Handle>{viewer.profile.handle}</Handle> : "—"}</dd>
          </div>
          <div>
            <dt className={ui.muted}>{t.email}</dt>
            <dd>{viewer.email}</dd>
          </div>
        </dl>
        {viewer.staffMfa !== null && (
          <Link href={`/${locale}/settings/security`} className="text-sm text-accent underline">
            {t.securityLink}
          </Link>
        )}
      </section>

      <section className={`${ui.card} space-y-3`} data-testid="language-settings">
        <h2 className={ui.h2}>{t.languageTitle}</h2>
        <p className={ui.muted}>{t.languageBody}</p>
        <LanguagePicker current={locale} label={t.languageTitle} />
        <div className={`${ui.panel} space-y-1 text-sm`}>
          <p>{t.translateTip}</p>
          <p className="text-xs text-muted">{t.translatePrivacy}</p>
        </div>
      </section>

      <section className={`${ui.card} space-y-2`}>
        <h2 className={ui.h2}>{t.sessionsTitle}</h2>
        <p className={ui.muted}>{t.sessionsBody}</p>
        <SignOutOthersForm locale={locale} t={t} />
      </section>

      <section className="space-y-2 rounded-2xl border border-danger/40 bg-surface p-5">
        <h2 className={`${ui.h2} text-danger`}>{t.deleteTitle}</h2>
        <p className={ui.muted}>{t.deleteBody}</p>
        <DeleteAccountForm
          locale={locale}
          word={viewer.profile.handle ?? "DELETE"}
          fresh={isFreshSession(viewer)}
          t={t}
        />
      </section>
    </div>
  );
}
