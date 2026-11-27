import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins/email-otp";
import { after } from "next/server";
import { getDb } from "@/db";
import { account, session, user, verification } from "@/db/schema";
import { siteConfig } from "@/config/site";
import { sendOtpEmail } from "./email";
import { resolveBaseUrl } from "./env";
import { ensureProfile } from "./membership";
import { createRateLimitStore } from "./rate-limit-store";

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET is not set");
  return value;
}

/** Send after the response (no timing leak) but keep serverless functions alive until done. */
function sendInBackground(task: () => Promise<void>) {
  const run = () =>
    task().catch((err) => {
      console.error("[auth] failed to send OTP email", err);
    });
  try {
    after(run);
  } catch {
    void run(); // outside a request scope (e.g. scripts)
  }
}

function createAuth() {
  return betterAuth({
    appName: siteConfig.name,
    baseURL: resolveBaseUrl(process.env),
    secret: process.env.BETTER_AUTH_SECRET,
    rateLimit: {
      // On by default in production; RATE_LIMIT=on enables it locally for testing.
      enabled: process.env.NODE_ENV === "production" || process.env.RATE_LIMIT === "on",
      window: 60,
      max: 60,
      customStorage: createRateLimitStore(getDb, secret),
    },
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    // Passwordless only: email one-time codes. Staff add TOTP (see lib/mfa.ts).
    emailAndPassword: { enabled: false },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    databaseHooks: {
      user: {
        create: {
          after: async (created) => {
            await ensureProfile(getDb(), created.id);
          },
        },
      },
      session: {
        create: {
          // IPs are still used in memory for rate limiting, but never stored.
          before: async (s) => ({ data: { ...s, ipAddress: null, userAgent: null } }),
        },
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 5,
        storeOTP: "hashed",
        sendVerificationOTP: async ({ email, otp, type }) => {
          sendInBackground(() => sendOtpEmail(email, otp, type));
        },
      }),
      nextCookies(), // must stay last
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;
const globalForAuth = globalThis as unknown as { __auth?: Auth };

/** Created on first use so builds don't need a database connection. */
export function getAuth(): Auth {
  globalForAuth.__auth ??= createAuth();
  return globalForAuth.__auth;
}
