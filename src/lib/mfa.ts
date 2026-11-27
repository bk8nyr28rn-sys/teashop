import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import type { Db } from "@/db";
import { mfaSession, staffMfa } from "@/db/schema";

/**
 * Staff step-up authentication (TOTP + one-time backup codes).
 *
 * Why not Better Auth's two-factor plugin? Its sign-in challenge only hooks
 * password / username / phone sign-in, not email OTP, so enabling it would
 * silently enforce nothing. We reuse its vetted HOTP primitive instead and
 * record per-session verification in `mfa_session`.
 */

const PERIOD_S = 30;
const DIGITS = 6;
/** Accept the previous/next time step to tolerate clock drift. */
const WINDOW = 1;
export const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 15 * 60_000;
/** A pending (unconfirmed) secret is reused for this long so a scanned QR stays valid. */
const PENDING_TTL_MS = 15 * 60_000;
const BACKUP_CODES = 10;
const BACKUP_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export type MfaError = "not-enrolled" | "already-enrolled" | "invalid-code" | "locked";
type Fail = { ok: false; error: MfaError };
const fail = (error: MfaError): Fail => ({ ok: false, error });

function encryptionKey(): string {
  const key = process.env.BETTER_AUTH_SECRET;
  if (!key) throw new Error("BETTER_AUTH_SECRET is required for staff 2FA");
  return key;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function normalizeBackupCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[\s-]/g, "");
  if (raw.length !== 8 || [...raw].some((c) => !BACKUP_ALPHABET.includes(c))) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODES }, () => {
    let s = "";
    for (let i = 0; i < 8; i++) s += BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)];
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}

async function secretBytes(row: { secretEnc: string }): Promise<Uint8Array> {
  return base32.decode(await symmetricDecrypt({ key: encryptionKey(), data: row.secretEnc }));
}

/** Returns the matching time-step counter for `code`, or null. Skips steps already used. */
async function matchTotp(secret: Uint8Array, code: string, lastCounter: number): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null;
  const otp = createOTP(secret, { digits: DIGITS, period: PERIOD_S });
  const now = Math.floor(Date.now() / 1000 / PERIOD_S);
  let matched: number | null = null;
  for (let i = -WINDOW; i <= WINDOW; i++) {
    const counter = now + i;
    const expected = Buffer.from(await otp.hotp(counter));
    // Compare every candidate (constant work), remember the newest unused match.
    if (timingSafeEqual(expected, Buffer.from(code)) && counter > lastCounter) matched = counter;
  }
  return matched;
}

async function getRow(db: Db, userId: string) {
  const [row] = await db.select().from(staffMfa).where(eq(staffMfa.userId, userId));
  return row ?? null;
}

/* -------------------------------- Status -------------------------------- */

export type MfaStatus = { enrolled: boolean; verified: boolean };

export async function mfaStatus(db: Db, userId: string, sessionId: string): Promise<MfaStatus> {
  const row = await getRow(db, userId);
  if (!row?.enabledAt) return { enrolled: false, verified: false };
  const [s] = await db
    .select({ id: mfaSession.sessionId })
    .from(mfaSession)
    .where(and(eq(mfaSession.sessionId, sessionId), eq(mfaSession.userId, userId)));
  return { enrolled: true, verified: !!s };
}

/* -------------------------------- Setup --------------------------------- */

/**
 * Start (or resume) enrolment. Returns the otpauth URI for the QR code and
 * the base32 secret for manual entry.
 */
export async function beginSetup(
  db: Db,
  input: { userId: string; issuer: string; account: string },
): Promise<{ ok: true; uri: string; secret: string } | Fail> {
  let row = await getRow(db, input.userId);
  if (row?.enabledAt) return fail("already-enrolled");

  if (!row || Date.now() - row.createdAt.getTime() > PENDING_TTL_MS) {
    const secret = base32.encode(randomBytes(20), { padding: false });
    const secretEnc = await symmetricEncrypt({ key: encryptionKey(), data: secret });
    const now = new Date();
    [row] = await db
      .insert(staffMfa)
      .values({ userId: input.userId, secretEnc, createdAt: now })
      .onConflictDoUpdate({
        target: staffMfa.userId,
        set: { secretEnc, createdAt: now, lastCounter: 0, failedAttempts: 0, lockedUntil: null },
        where: isNull(staffMfa.enabledAt),
      })
      .returning();
    if (!row) return fail("already-enrolled"); // enabled concurrently
  }
  const bytes = await secretBytes(row);
  const uri = createOTP(bytes, { digits: DIGITS, period: PERIOD_S }).url(input.issuer, input.account);
  return { ok: true, uri, secret: base32.encode(bytes, { padding: false }) };
}

/** Confirm enrolment with a first code. Returns backup codes — show them once. */
export async function confirmSetup(
  db: Db,
  input: { userId: string; sessionId: string; code: string },
): Promise<{ ok: true; backupCodes: string[] } | Fail> {
  const row = await getRow(db, input.userId);
  if (!row) return fail("not-enrolled");
  if (row.enabledAt) return fail("already-enrolled");
  if (row.lockedUntil && row.lockedUntil > new Date()) return fail("locked");

  const counter = await matchTotp(await secretBytes(row), input.code.trim(), row.lastCounter);
  if (counter === null) return recordFailure(db, input.userId);

  const backupCodes = generateBackupCodes();
  const enabled = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(staffMfa)
      .set({
        enabledAt: new Date(),
        lastCounter: counter,
        backupCodeHashes: backupCodes.map(sha256),
        failedAttempts: 0,
        lockedUntil: null,
      })
      .where(and(eq(staffMfa.userId, input.userId), isNull(staffMfa.enabledAt), lt(staffMfa.lastCounter, counter)))
      .returning({ userId: staffMfa.userId });
    if (!updated) return false;
    await tx.insert(mfaSession).values({ sessionId: input.sessionId, userId: input.userId }).onConflictDoNothing();
    return true;
  });
  return enabled ? { ok: true, backupCodes } : fail("invalid-code");
}

/* ------------------------------- Step-up -------------------------------- */

/** Verify a TOTP or backup code for this session. */
export async function verifyStepUp(
  db: Db,
  input: { userId: string; sessionId: string; code: string },
): Promise<{ ok: true; usedBackupCode: boolean } | Fail> {
  const row = await getRow(db, input.userId);
  if (!row?.enabledAt) return fail("not-enrolled");
  if (row.lockedUntil && row.lockedUntil > new Date()) return fail("locked");

  const code = input.code.trim();
  let accepted = false;
  let usedBackupCode = false;

  const backup = normalizeBackupCode(code);
  if (backup) {
    // Atomically remove the hash so a backup code works exactly once.
    const hash = sha256(backup);
    const [used] = await db
      .update(staffMfa)
      .set({ backupCodeHashes: sql`${staffMfa.backupCodeHashes} - ${hash}::text` })
      .where(and(eq(staffMfa.userId, input.userId), sql`${staffMfa.backupCodeHashes} ? ${hash}`))
      .returning({ userId: staffMfa.userId });
    accepted = usedBackupCode = !!used;
  } else {
    const counter = await matchTotp(await secretBytes(row), code, row.lastCounter);
    if (counter !== null) {
      // Advance the counter atomically: a concurrent replay of the same code loses.
      const [advanced] = await db
        .update(staffMfa)
        .set({ lastCounter: counter })
        .where(and(eq(staffMfa.userId, input.userId), lt(staffMfa.lastCounter, counter)))
        .returning({ userId: staffMfa.userId });
      accepted = !!advanced;
    }
  }

  if (!accepted) return recordFailure(db, input.userId);
  await db.update(staffMfa).set({ failedAttempts: 0 }).where(eq(staffMfa.userId, input.userId));
  await db.insert(mfaSession).values({ sessionId: input.sessionId, userId: input.userId }).onConflictDoNothing();
  return { ok: true, usedBackupCode };
}

async function recordFailure(db: Db, userId: string): Promise<Fail> {
  const [row] = await db
    .update(staffMfa)
    .set({
      failedAttempts: sql`case when ${staffMfa.failedAttempts} + 1 >= ${MAX_FAILED_ATTEMPTS} then 0 else ${staffMfa.failedAttempts} + 1 end`,
      lockedUntil: sql`case when ${staffMfa.failedAttempts} + 1 >= ${MAX_FAILED_ATTEMPTS} then now() + ${`${LOCK_MS / 1000} seconds`}::interval else ${staffMfa.lockedUntil} end`,
    })
    .where(eq(staffMfa.userId, userId))
    .returning({ lockedUntil: staffMfa.lockedUntil });
  return fail(row?.lockedUntil && row.lockedUntil > new Date() ? "locked" : "invalid-code");
}

/** Remaining backup codes (for the security page). */
export async function backupCodesLeft(db: Db, userId: string): Promise<number> {
  const row = await getRow(db, userId);
  return row?.backupCodeHashes.length ?? 0;
}

/** Recovery for a lost device (CLI only): wipe enrolment and verified sessions. */
export async function resetMfa(db: Db, userId: string): Promise<void> {
  await db.delete(mfaSession).where(eq(mfaSession.userId, userId));
  await db.delete(staffMfa).where(eq(staffMfa.userId, userId));
}

/** Exported for tests: the code an authenticator would show for `secret` at `counter`. */
export async function totpForCounter(secretBase32: string, counter: number): Promise<string> {
  return createOTP(base32.decode(secretBase32), { digits: DIGITS, period: PERIOD_S }).hotp(counter);
}

export function currentCounter(): number {
  return Math.floor(Date.now() / 1000 / PERIOD_S);
}
