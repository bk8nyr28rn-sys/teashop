# Qijian (working title)

A privacy-first community for LGBTQ+ people, with paid emotional-support Q&A answered by real people.
**Status: early build** — accounts, membership gating, circles, posts, comments, moderation, account safety and paid Q&A (Stripe Connect) work end-to-end.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components) + TypeScript |
| Database | PostgreSQL + Drizzle ORM (Neon recommended in production) |
| Auth | Better Auth, passwordless email one-time codes; TOTP step-up for staff |
| i18n | Built-in dictionaries + `next/root-params` (`/en`, `/zh`); choice remembered per device and per account |
| Styling | Tailwind CSS 4, system fonts only |
| Payments | Stripe Connect (Express), manual-capture destination charges; fake provider in dev |
| Tests | Vitest (unit + real-Postgres integration + Stripe SDK against a mock server) |

> Next.js 16 differs from older versions: `middleware.ts` is now `src/proxy.ts`, and anything reading the session must render inside `<Suspense>`. Read `node_modules/next/dist/docs/` before changing routing or caching.

## Deploying

See **[docs/DEPLOY.md](docs/DEPLOY.md)** — Vercel + Neon + Resend, step by step, including the first admin and invite-only beta mode.

## Getting started

Requires Node.js ≥ 22.12 and a PostgreSQL database.

```sh
npm install
cp .env.example .env.local     # fill in DATABASE_URL and BETTER_AUTH_SECRET
npm run db:migrate             # create tables + starter circles
npm run dev                    # http://localhost:3000
```

Without `RESEND_API_KEY`, sign-in codes are printed to the dev server log (`[dev-email] …`).

**First admin:** sign in once, then run `npm run admin:grant -- you@example.com`. There is deliberately no "first user becomes admin" shortcut. On first visit to the admin area you'll be asked to set up an authenticator app.

**Lost authenticator:** after verifying the person out of band, `npm run mfa:reset -- them@example.com`.

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Unit tests. Set `TEST_DATABASE_URL` to a **throwaway** database to also run the Postgres integration tests (it gets wiped). |
| `npm run typecheck` | Generate route types and run `tsc` |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm run format` | Prettier |
| `npm run admin:grant -- <email>` / `npm run mfa:reset -- <email>` | Bootstrap an admin / remove someone's 2FA enrolment |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |
| `npm run vercel-build` | What Vercel runs: migrations (production only) + build |

## How membership works

```
sign in (email code) → onboarding ─┬─ invite code ────────────→ approved
                                   └─ application (3 questions) → pending → admin review → approved / rejected
```

- **Roles:** `member`, `responder`, `admin` (platform-wide); circle `moderator` is per circle.
- **Trust levels 0–3** unlock posting, joining request-only circles, DMs and creating invites (`src/lib/permissions.ts`).
- **Circles** are `open`, `approval` or `invite`; each can require a minimum trust level.
- **Reading:** open circles are readable by every approved member; request/invite circles only by their members. **Writing** always requires joining.
- **Daily limits** per trust level (posts 0/5/20/50, comments 10/50/200/500), enforced under a per-user advisory lock.
- **Reports** (incl. a dedicated *outing / private info* reason) go to circle moderators and admins. Upholding hides the content (kept for appeals) and blocks the author's trust promotion; author deletions erase the text.
- Invite codes are single-use by default (members max 3 uses, admins max 100), expire after 7 days, and are consumed atomically.

## Account safety

- **Staff 2FA (admins, responders):** TOTP authenticator + 10 one-time backup codes. Every new session must pass it; until then the DAL downgrades the viewer to `member`, so no page or action can use staff powers. Codes can't be replayed, 5 wrong codes lock for 15 minutes, secrets are encrypted at rest.
  Better Auth's own two-factor plugin is *not* used: it only intercepts password/username/phone sign-in, not email OTP, so it would silently enforce nothing.
- **Suspension (admins):** blocks all member areas and revokes every session immediately. Admins can't be suspended from the UI.
- **Circle bans (moderators):** survive leaving the circle; only admins can ban a moderator.
- **Sign out other devices** from Settings.
- **Account deletion** from Settings (also available while suspended): requires a sign-in from the last 15 minutes and typing your nickname. Post/comment text is erased and left as "deleted by the author" tombstones so others' replies survive; everything else cascades.

## Paid Q&A

- Members ask an available responder privately; **responders never see who asked**.
- Card is authorised at checkout, **captured only when the answer is delivered**, released if unanswered in 48 h. Platform fee via `application_fee_amount`; disputes reviewed by admins can refund (reversing the transfer).
- Crisis language (`src/lib/crisis.ts`) shows crisis lines before any payment and flags the question for the responder. `/help` lists support lines on every page.
- Without `STRIPE_SECRET_KEY`, development uses a fake provider with a simulated checkout page (`/dev/checkout/…`); production shows Q&A as unavailable.

## Admin console (`/admin`)

Admins only, with 2FA. Sections: **Overview** (7-day KPIs, daily chart, needs-attention list), **Questions**, **Responders**, **Reviews**, **Finance**, **Community** (membership applications, reports, members), **Settings**, **Audit log**.

- **Content stays private from staff.** Lists show metadata only (amount, status, timing, responder) — never titles, text or askers. A question can be opened only if it is under review or crisis-flagged, with a stated reason; the view is written to the audit log and lasts 30 minutes (`lib/qa-admin.ts`).
- **Refunds of any amount.** Admins refund part or all of a disputed question; the responder's share and the platform fee are reversed proportionally. The amount field starts empty on purpose.
- **Missed deadlines: warn, then pause.** After `overdueWarnAt` missed deadlines in 30 days the responder is warned (desk banner + audit); only an already-warned responder is paused at `overduePauseAt`. Cancellations, failed payments and holds released by suspension don't count. Admins can resume at any time; that clears the warning (not the history), so any later pause again needs a fresh warning first.
- **Responder applications.** Members (trust ≥ 1) apply from *Me*; admins approve or decline; the application text is wiped after the decision.
- **Settings in the database** (`qa_settings`): fee, answer window, price range, open questions per member, warning/pause thresholds. Every change is logged with before/after values and only affects new questions (fee and window are snapshotted per question).

## Languages

- **Which language a page opens in:** the language the user picked (`locale` cookie, set by the header switch or *Settings → Language*), else the browser's languages matched on the base language (`zh-TW`, `zh-HK` → Chinese; `en-GB` → English), else English (`src/i18n/negotiate.ts`).
- **Saved on the account** (`profile.locale`): the first sign-in stores the language used; signing in on a new device switches to it and remembers it there too.
- **Sign-in emails** are sent in the language of the page the code was requested from (header `x-ui-locale`), falling back to the cookie and the browser.
- **Browser translation** (Chrome, Safari, Edge) is the zero-cost way to read posts in other languages:
  - user-written text gets `lang` (detected locally with `eld`, conservatively: short or ambiguous text stays untagged) and `dir="auto"` for right-to-left scripts (`lib/content-lang.ts`);
  - nicknames, codes and the brand name are `translate="no"` (`components/handle.tsx`);
  - `components/translation-guard.tsx` keeps React from crashing when a translator rewrites text nodes (facebook/react#11538). It is a precaution; our simulated test didn't crash without it either.
  - Settings tells users that browser translation sends page text to Google or Apple.
- **Adding a language:** add it to `locales` in `src/i18n/config.ts` and add `src/i18n/dictionaries/<code>.json` (a test checks every key and placeholder matches English). Also add crisis keywords and local hotlines in `src/lib/crisis.ts`, and someone who can moderate that language. Right-to-left UI languages would also need the layout mirrored.

## Privacy decisions (do not regress)

- No orientation / gender-identity column anywhere. Belonging = circle membership.
- Application answers are **deleted** when a decision is made; only the outcome is kept.
- Sessions never store IP address or user agent. Auth rate limiting is shared across serverless instances via Postgres, keyed by an HMAC of `ip|path` — never the raw IP.
- Sign-in codes are stored hashed; emails use a neutral subject and sender.
- No third-party fonts, trackers or analytics. `robots: noindex`, `Referrer-Policy: no-referrer`.
- 18+ only (self-confirmed at onboarding).

## Project layout

```
src/
  app/[locale]/        pages: landing, sign-in, start, onboarding, pending, home, responder, admin
  app/[locale]/c/      circle, post thread and moderation pages + server actions
  app/api/auth/        Better Auth handler
  db/schema.ts         all tables
  lib/permissions.ts   pure permission rules (unit-tested)
  lib/membership.ts    invite / application state transitions (integration-tested)
  lib/community.ts     circles, posts, comments, reports, trust refresh (integration-tested)
  lib/mfa.ts           staff TOTP enrolment / step-up
  lib/accounts.ts      suspension, sign-out-others, account deletion
  lib/qa.ts            paid Q&A lifecycle (ask, authorise, answer+capture, expire, dispute, missed deadlines)
  lib/qa-admin.ts      admin console: stats, logged content unlock, responders, applications, finance, settings
  lib/content-lang.ts  local language detection for user-written text (lang / dir attributes)
  lib/payments/        PaymentProvider interface, Stripe and fake implementations
  lib/crisis.ts        crisis-language detection and support lines
  lib/dal.ts           session → viewer; the only place that reads auth (applies the 2FA downgrade)
  i18n/                locale config, negotiation (cookie → browser), en/zh dictionaries
  proxy.ts             locale redirect + optimistic auth gate
scripts/               grant-admin, reset-mfa, vercel-build
tests/                 Vitest suites
drizzle/               SQL migrations (0004 seeds the starter circles)
docs/DEPLOY.md         production deployment guide
```

## Not built yet

In-app "See translation" for posts (planned: translate once and cache per language, mock mode until an API key is set, per-user and monthly caps), editing posts, notifications, 2FA for circle moderators, a data export, follow-up messages on paid questions, payout dashboards for responders, optional evidence upload (schema fields exist; must auto-delete after review), passkeys, and the low-profile ("discreet") mode.
