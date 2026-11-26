import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins/email-otp";
import { getDb } from "@/db";
import { account, session, user, verification } from "@/db/schema";
import { siteConfig } from "@/config/site";
import { sendOtpEmail } from "./email";
import { ensureProfile } from "./membership";

function createAuth() {
  return betterAuth({
    appName: siteConfig.name,
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    // Passwordless only: email one-time codes. Passkeys / 2FA come next.
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
          // Not awaited to avoid leaking timing information about the address.
          void sendOtpEmail(email, otp, type).catch((err) => {
            console.error("[auth] failed to send OTP email", err);
          });
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
