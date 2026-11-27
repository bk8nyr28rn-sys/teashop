# Qijian (working title)

A privacy-first community for LGBTQ+ people, with paid emotional-support Q&A answered by real people.
**Status: early build** — accounts, membership gating, circles, posts, comments, reports and moderation work end-to-end; payments are next.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components) + TypeScript |
| Database | PostgreSQL + Drizzle ORM (Neon recommended in production) |
| Auth | Better Auth, passwordless email one-time codes |
| i18n | Built-in dictionaries + `next/root-params` (`/en`, `/zh`) |
| Styling | Tailwind CSS 4, system fonts only |
| Tests | Vitest (unit + real-Postgres integration) |

> Next.js 16 differs from older versions: `middleware.ts` is now `src/proxy.ts`, and anything reading the session must render inside `<Suspense>`. Read `node_modules/next/dist/docs/` before changing routing or caching.

## Getting started

Requires Node.js ≥ 22.12 and a PostgreSQL database.

```sh
npm install
cp .env.example .env.local     # fill in DATABASE_URL and BETTER_AUTH_SECRET
npm run db:migrate             # create tables
npm run db:seed                # starter circles (idempotent)
npm run dev                    # http://localhost:3000
```

Without `RESEND_API_KEY`, sign-in codes are printed to the dev server log (`[dev-email] …`).

**First admin:** sign in once, then run `npm run admin:grant -- you@example.com`. There is deliberately no "first user becomes admin" shortcut.

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Unit tests. Set `TEST_DATABASE_URL` to a **throwaway** database to also run the Postgres integration tests (it gets wiped). |
| `npm run typecheck` | Generate route types and run `tsc` |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm run format` | Prettier |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |

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

## Privacy decisions (do not regress)

- No orientation / gender-identity column anywhere. Belonging = circle membership.
- Application answers are **deleted** when a decision is made; only the outcome is kept.
- Sessions never store IP address or user agent (IPs are used in memory for rate limiting only).
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
  lib/dal.ts           session → viewer; the only place that reads auth
  i18n/                locale config and en/zh dictionaries
  proxy.ts             locale redirect + optimistic auth gate
scripts/               seed, grant-admin
tests/                 Vitest suites
drizzle/               generated SQL migrations
```

## Not built yet

Account deletion, suspending users from the admin UI, editing posts, notifications, optional evidence upload (schema fields exist; must auto-delete after review), passkeys / mandatory 2FA for staff, the paid Q&A flow (Stripe Connect), crisis-keyword safety prompts, and the low-profile ("discreet") mode.
