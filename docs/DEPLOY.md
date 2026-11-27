# Deploying the closed beta

Target setup: **Vercel** (hosting) + **Neon** (Postgres, via the Vercel Marketplace) + **Resend** (sign-in emails) + your own **domain**. Expect about an hour, most of it waiting for DNS.

## 0. Decide first

| Decision | Recommendation | Why |
|---|---|---|
| Repository visibility | **Private** | It's currently public. The code holds no secrets, but a private repo keeps CI logs, issues and the project's existence out of public view. GitHub → repo → Settings → General → Danger Zone → *Change visibility*. |
| Domain | **Required** | Resend only delivers to arbitrary addresses from a domain you've verified. Without one, nobody but you can receive sign-in codes. |
| Joining during beta | **Invite-only** (`APPLICATIONS_OPEN=false`) | You hand out codes; no review queue to staff yet. |
| Data region | **EU (Frankfurt)** for Neon, and pick Vercel functions near it | Simplest story for GDPR; keep DB and functions close for speed. |

**Costs for a small beta:** Vercel Hobby $0, Neon Free $0, Resend Free $0 (3,000 emails/month, 100/day), domain ≈ $10–15/year.
⚠️ Vercel Hobby is for **non-commercial** use. Move to Vercel Pro before you start charging for Q&A.

## 1. Put the code on `main`

Vercel deploys `main` to production. Merge the feature branch (open a pull request and merge it). CI (`.github/workflows/ci.yml`) runs lint, types, tests against a throwaway Postgres, and a build on every push.

## 2. Create the Vercel project

1. vercel.com → *Add New… → Project* → import the GitHub repo. Framework: Next.js (auto-detected). Leave build settings as they are — Vercel runs the `vercel-build` script automatically.
2. The first deploy will fail (no database yet). That's expected.

## 3. Add the database (Neon)

1. Vercel project → *Storage* → *Create Database* → **Neon**.
2. Region: **Frankfurt (eu-central-1)**. Plan: Free.
3. Connect it to the project for the **Production** environment. This adds `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct, used for migrations).
4. Optional: also connect **Preview** with Neon *branching* so every preview deploy gets its own copy of the database. Only then set `MIGRATE_ON_PREVIEW=true` for Preview. Never point previews at the production database.

## 4. Add your domain

Vercel project → *Settings → Domains* → add e.g. `example.org` (buy it there or at any registrar and follow the DNS instructions).

## 5. Set up email (Resend)

1. resend.com → *Domains → Add Domain* → use a subdomain such as `mail.example.org`.
2. Add the DNS records Resend shows (SPF/DKIM; DMARC recommended). If the domain is on Vercel DNS, add them under Vercel → *Domains → example.org → DNS Records*. Wait for **Verified**.
3. *API Keys → Create* → permission **Sending access**, restricted to that domain. Copy the key once.

## 6. Environment variables

Vercel project → *Settings → Environment Variables*, scope **Production**:

| Name | Value |
|---|---|
| `BETTER_AUTH_SECRET` | 32+ random characters. Generate locally with `openssl rand -base64 32` or a password manager. Never reuse it. |
| `BETTER_AUTH_URL` | `https://example.org` (your real domain, https) |
| `RESEND_API_KEY` | the key from step 5 |
| `EMAIL_FROM` | `Account <no-reply@mail.example.org>` — keep the name neutral; inbox previews are visible to others |
| `APPLICATIONS_OPEN` | `false` |

`DATABASE_URL` / `DATABASE_URL_UNPOOLED` come from the Neon integration. The server **refuses to start** if any required value is missing or weak, and lists what's wrong in the Vercel logs.

## 7. Deploy

*Deployments → ⋯ → Redeploy*. The build log should show:

```
[vercel-build] production: applying database migrations
```

Migrations create all tables and the starter circles (once — later edits by admins are never overwritten).

## 8. Become the first admin

1. Open `https://example.org`, sign in with your email. You'll land on "Join the community" — stop there.
2. Neon console → your project → **SQL Editor**, run (with your email and a nickname):

   ```sql
   UPDATE profile
   SET role = 'admin', status = 'approved', trust_level = 3,
       handle = coalesce(handle, 'your_nickname'),
       approved_at = coalesce(approved_at, now()),
       age_confirmed_at = coalesce(age_confirmed_at, now())
   WHERE user_id = (SELECT id FROM "user" WHERE email = 'you@example.org');
   ```

3. Visit `/en/admin`. You'll be sent to set up two-factor authentication: scan the QR code, enter the code, **store the backup codes in your password manager**.

## 9. Invite testers

Home → *Invite someone* → *Create invite code* (single-use, valid 7 days). Send each code privately (not in a group chat). Testers sign in with their email and paste the code.

## 10. Smoke test (5 minutes)

- [ ] A tester receives the sign-in email; sender and subject look neutral.
- [ ] Without a code, onboarding says joining is invitation-only.
- [ ] Tester joins with a code, joins *Lounge*, comments (posting unlocks after 3 days).
- [ ] Report a comment → it appears under *Admin → Open reports*.
- [ ] Settings → *Sign out other devices* works; deleting a test account shows the goodbye page.
- [ ] Requesting 4+ sign-in codes within a minute gets "too many requests".

## Operations (Neon SQL Editor)

```sql
-- Make someone a responder (they'll be asked to set up 2FA)
UPDATE profile SET role = 'responder' WHERE handle = 'their_nickname';

-- Lost authenticator + backup codes (verify the person out of band first!)
DELETE FROM mfa_session WHERE user_id = (SELECT id FROM "user" WHERE email = 'them@example.org');
DELETE FROM staff_mfa   WHERE user_id = (SELECT id FROM "user" WHERE email = 'them@example.org');

-- Open applications later: set APPLICATIONS_OPEN=true in Vercel and redeploy.
```

Developers with a local checkout can use `npm run admin:grant -- <email>` and `npm run mfa:reset -- <email>` with `DATABASE_URL` pointing at the target database.

## Privacy notes for your privacy notice

- The app database never stores IP addresses or user agents (rate-limit keys are HMAC hashes).
- Vercel, Neon and Resend process data on your behalf (hosting logs, the database, email delivery). Vercel's platform request logs do include IP addresses — mention this, and keep log retention short.
- Account deletion is self-service and erases the user's post and comment text.
