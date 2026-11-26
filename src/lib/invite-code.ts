import { randomInt } from "node:crypto";

/** Crockford-style alphabet without look-alikes (no 0/O, 1/I/L, U). */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const GROUP = 5;
const GROUPS = 2;

/** e.g. "K7M2Q-ZP9XA" — ~49 bits of entropy from a CSPRNG. */
export function generateInviteCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let part = "";
    for (let i = 0; i < GROUP; i++) part += ALPHABET[randomInt(ALPHABET.length)];
    groups.push(part);
  }
  return groups.join("-");
}

/**
 * Canonical form used for storage and lookup: uppercase, separators removed,
 * regrouped. Returns null when the input cannot be a valid code.
 */
export function normalizeInviteCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[\s-]/g, "");
  if (raw.length !== GROUP * GROUPS) return null;
  for (const ch of raw) if (!ALPHABET.includes(ch)) return null;
  return `${raw.slice(0, GROUP)}-${raw.slice(GROUP)}`;
}
