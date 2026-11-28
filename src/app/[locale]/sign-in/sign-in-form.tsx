"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { UI_LOCALE_HEADER } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ui } from "@/components/ui";

type Props = { locale: string; t: Dictionary["signIn"] };

export function SignInForm({ locale, t }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const sendCode = () =>
    start(async () => {
      setError(null);
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
        // So the email arrives in the language of this page.
        fetchOptions: { headers: { [UI_LOCALE_HEADER]: locale } },
      });
      if (error) setError(t.errorGeneric);
      else setStep("code");
    });

  const verify = () =>
    start(async () => {
      setError(null);
      const { error } = await authClient.signIn.emailOtp({ email, otp });
      if (error) {
        setError(t.errorCode);
        return;
      }
      router.push(`/${locale}/start`);
      router.refresh();
    });

  if (step === "email") {
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          sendCode();
        }}
      >
        <label className={ui.label} htmlFor="email">
          {t.emailLabel}
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          className={ui.input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && <p className={ui.error}>{error}</p>}
        <button className={ui.button} disabled={pending}>
          {t.sendCode}
        </button>
      </form>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        verify();
      }}
    >
      <p className={ui.muted}>{t.codeSent.replace("{email}", email)}</p>
      <label className={ui.label} htmlFor="otp">
        {t.codeLabel}
      </label>
      <input
        id="otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        className={`${ui.input} tracking-[0.4em]`}
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
      />
      {error && <p className={ui.error}>{error}</p>}
      <div className="flex gap-3">
        <button className={ui.button} disabled={pending}>
          {t.verify}
        </button>
        <button
          type="button"
          className={ui.buttonGhost}
          onClick={() => {
            setStep("email");
            setOtp("");
            setError(null);
          }}
        >
          {t.useAnother}
        </button>
      </div>
    </form>
  );
}
