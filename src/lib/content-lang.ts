import "server-only";
import { eld } from "eld/small";

/**
 * Best-effort language of user-written text, detected locally (nothing is
 * sent anywhere). Used for the `lang` attribute so screen readers pronounce
 * posts correctly and browser translation can tell what language they're in.
 *
 * Conservative on purpose: a missing tag just inherits the page language,
 * while a wrong one misleads, so short or ambiguous text gets no tag.
 */

/** Latin/Cyrillic languages we tag. Restricting the candidates avoids exotic misfires. */
const STATISTICAL = ["en", "es", "pt", "fr", "de", "it", "nl", "pl", "tr", "vi", "id", "ru", "uk"];
eld.setLanguageSubset(STATISTICAL);

/** Letters needed before trusting a statistical guess for Latin/Cyrillic text. */
const MIN_LETTERS = 15;

const RE = {
  noise: /https?:\/\/\S+|\S+@\S+\.\S+|@[\w.]+|#\w+/g,
  kana: /[\p{Script=Hiragana}\p{Script=Katakana}]/gu,
  han: /\p{Script=Han}/gu,
  hangul: /\p{Script=Hangul}/gu,
  latin: /\p{Script=Latin}/gu,
  cyrillic: /\p{Script=Cyrillic}/gu,
  thai: /\p{Script=Thai}/gu,
  hebrew: /\p{Script=Hebrew}/gu,
  greek: /\p{Script=Greek}/gu,
};

const count = (text: string, re: RegExp) => text.match(re)?.length ?? 0;

export function detectLang(input: string | null | undefined): string | undefined {
  if (!input) return undefined;
  const text = input.replace(RE.noise, " ");
  const n = {
    kana: count(text, RE.kana),
    han: count(text, RE.han),
    hangul: count(text, RE.hangul),
    latin: count(text, RE.latin),
    cyrillic: count(text, RE.cyrillic),
    thai: count(text, RE.thai),
    hebrew: count(text, RE.hebrew),
    greek: count(text, RE.greek),
  };
  const cjk = n.kana + n.han;
  const top = Math.max(cjk, n.hangul, n.latin, n.cyrillic, n.thai, n.hebrew, n.greek);
  if (top < 2) return undefined;

  // Scripts that identify the language on their own.
  if (cjk === top) return n.kana > 0 ? "ja" : "zh";
  if (n.hangul === top) return "ko";
  if (n.thai === top) return "th";
  if (n.hebrew === top) return "he";
  if (n.greek === top) return "el";

  // Latin and Cyrillic are shared by many languages: use a statistical guess.
  if (top < MIN_LETTERS) return undefined;
  const result = eld.detect(text);
  return result.isReliable() && STATISTICAL.includes(result.language) ? result.language : undefined;
}

/**
 * Props for an element showing user-written text: its language (when sure)
 * and `dir="auto"`, so right-to-left posts display correctly in any UI.
 */
export function ugc(...texts: (string | null | undefined)[]): { lang?: string; dir: "auto" } {
  const lang = detectLang(texts.filter(Boolean).join("\n"));
  return lang ? { lang, dir: "auto" } : { dir: "auto" };
}
