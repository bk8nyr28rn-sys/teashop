import { Suspense } from "react";
import QRCode from "qrcode";
import { getDb } from "@/db";
import { siteConfig } from "@/config/site";
import { format, getDictionary, getLocale } from "@/i18n/dictionaries";
import { requireViewer } from "@/lib/dal";
import { backupCodesLeft, beginSetup } from "@/lib/mfa";
import { ui } from "@/components/ui";
import { ConfirmSetupForm, VerifyForm } from "../forms";

export default async function SecurityPage() {
  const dict = await getDictionary();
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className={ui.h1}>{dict.security.title}</h1>
        <p className={ui.muted}>{dict.security.intro}</p>
      </header>
      <Suspense fallback={<p className={ui.muted}>{dict.common.loading}</p>}>
        <Security />
      </Suspense>
    </div>
  );
}

async function Security() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const viewer = await requireViewer(locale);
  const t = dict.security;
  const next = `/${locale}/${viewer.realRole === "admin" ? "admin" : "responder"}`;

  if (viewer.staffMfa === null) return <p className={ui.card}>{t.notStaff}</p>;

  if (viewer.staffMfa === "ok") {
    const left = await backupCodesLeft(getDb(), viewer.userId);
    return (
      <section className={`${ui.card} space-y-2`}>
        <p>✅ {t.enabled}</p>
        <p className={ui.muted}>{format(t.backupLeft, { n: left })}</p>
      </section>
    );
  }

  if (viewer.staffMfa === "verify") {
    return (
      <section className={`${ui.card} space-y-3`}>
        <h2 className={ui.h2}>{t.verifyTitle}</h2>
        <p className={ui.muted}>{t.verifyBody}</p>
        <VerifyForm locale={locale} t={t} />
        <p className="text-xs text-muted">{t.lostDevice}</p>
      </section>
    );
  }

  // Setup. The account label is the nickname, never the email: authenticator
  // apps show it on screen and may sync it to the cloud.
  const setup = await beginSetup(getDb(), {
    userId: viewer.userId,
    issuer: siteConfig.name,
    account: viewer.profile.handle ?? "staff",
  });
  if (!setup.ok) return <p className={ui.error}>{t.errors[setup.error]}</p>;
  const qr = await QRCode.toDataURL(setup.uri, { margin: 1, width: 220 });

  return (
    <section className={`${ui.card} space-y-4`}>
      <h2 className={ui.h2}>{t.setupTitle}</h2>
      <p className={ui.muted}>{t.setupSteps}</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimise */}
      <img src={qr} alt="" width={220} height={220} className="rounded-lg bg-white p-2" />
      <div>
        <p className="text-xs text-muted">{t.manualKey}</p>
        <code translate="no" className="break-all font-mono text-sm" data-testid="totp-secret">
          {setup.secret}
        </code>
      </div>
      <ConfirmSetupForm locale={locale} t={t} next={next} />
    </section>
  );
}
