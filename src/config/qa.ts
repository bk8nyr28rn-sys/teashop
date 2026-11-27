/** Paid Q&A settings. Prices are in the smallest currency unit (cents). */
export const qaConfig = {
  currency: "usd",
  priceMinCents: 500,
  priceMaxCents: 10_000,
  /** Default platform share; the live value is in the qa_settings table (Admin → Settings). */
  defaultFeePercent: 20,
  /** Responders must answer within this many hours or the hold is released. */
  answerHours: 48,
  /** Unfinished checkouts are cleaned up after this many minutes. */
  checkoutTtlMinutes: 120,
  /** Open + awaiting-payment questions one asker may have at a time. */
  maxOpenPerAsker: 3,
  disputeWindowDays: 7,
  titleMax: 120,
  bodyMin: 20,
  bodyMax: 4000,
  answerMin: 50,
  answerMax: 8000,
  bioMax: 1000,
  headlineMax: 80,
  topics: ["coming-out", "relationships", "family", "identity", "gender", "wellbeing", "work-school", "other"],
  languages: ["en", "zh"],
} as const;

export function platformFee(priceCents: number, percent: number): number {
  return Math.round((priceCents * percent) / 100);
}

export function formatMoney(cents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}
