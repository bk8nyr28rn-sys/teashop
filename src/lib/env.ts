/**
 * Production configuration checks. Run at server start (instrumentation.ts)
 * so a misconfigured deploy fails loudly instead of, say, silently never
 * delivering sign-in codes.
 */
export function productionEnvErrors(env: Record<string, string | undefined>): string[] {
  const errors: string[] = [];
  const need = (name: string, ok: boolean, hint: string) => {
    if (!ok) errors.push(`${name}: ${hint}`);
  };

  need(
    "DATABASE_URL",
    !!env.DATABASE_URL?.startsWith("postgres"),
    "set it to the Postgres (Neon pooled) connection string",
  );
  need(
    "BETTER_AUTH_SECRET",
    (env.BETTER_AUTH_SECRET?.length ?? 0) >= 32,
    "use at least 32 random characters (openssl rand -base64 32)",
  );
  // Preview deployments may fall back to VERCEL_URL; production must be explicit.
  const isPreview = env.VERCEL_ENV === "preview";
  need(
    "BETTER_AUTH_URL",
    isPreview ? true : !!env.BETTER_AUTH_URL?.startsWith("https://"),
    "set it to the public https:// URL of the site",
  );
  need("RESEND_API_KEY", !!env.RESEND_API_KEY, "required to email sign-in codes");
  need(
    "EMAIL_FROM",
    !!env.EMAIL_FROM?.includes("@"),
    'e.g. "Account <no-reply@your-domain>" on a domain verified in Resend',
  );
  // Paid Q&A is optional; when Stripe is configured the rest must be too.
  if (env.STRIPE_SECRET_KEY) {
    need(
      "STRIPE_SECRET_KEY",
      /^(sk|rk)_(live|test)_/.test(env.STRIPE_SECRET_KEY),
      "must be a Stripe secret or restricted key",
    );
    need(
      "STRIPE_WEBHOOK_SECRET",
      !!env.STRIPE_WEBHOOK_SECRET && env.STRIPE_WEBHOOK_SECRET.split(",").every((x) => x.trim().startsWith("whsec_")),
      "copy the signing secret of the webhook endpoint",
    );
    need("CRON_SECRET", (env.CRON_SECRET?.length ?? 0) >= 16, "16+ random characters; used by the hold-release cron");
  }
  return errors;
}

/** Public base URL: explicit setting, else the Vercel preview URL. */
export function resolveBaseUrl(env: Record<string, string | undefined>): string | undefined {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL;
  if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return undefined;
}

/** Closed-beta switch: APPLICATIONS_OPEN=false makes joining invite-only. */
export function applicationsOpen(env: Record<string, string | undefined> = process.env): boolean {
  return env.APPLICATIONS_OPEN !== "false";
}
