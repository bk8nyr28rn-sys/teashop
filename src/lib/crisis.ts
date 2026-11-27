/**
 * Crisis-language detection for paid questions.
 *
 * This is a safety net, not a diagnosis: false positives are fine (the
 * person just sees support resources first), false negatives are the risk.
 * Have the list reviewed by someone with crisis-support experience before
 * launch, and extend it for every language you support.
 */
const PATTERNS: RegExp[] = [
  // English
  /\bsuicid(e|al)\b/i,
  /\bkill(ing)? myself\b/i,
  /\bend(ing)? (my|it all|my life)\b/i,
  /\b(want|wanna|going) to die\b/i,
  /\bbetter off dead\b/i,
  /\bno (reason|point) (to|in) (live|living)\b/i,
  /\bself[-\s]?harm/i,
  /\b(cut|cutting|hurt|hurting) myself\b/i,
  /\boverdos(e|ing)\b/i,
  // Chinese
  /自杀|自殺|想死|不想活|活不下去|轻生|輕生|结束(自己的)?生命|自残|自殘|割腕|跳楼|跳樓|寻死|尋死/,
];

export function hasCrisisLanguage(...texts: string[]): boolean {
  const text = texts.join("\n");
  return PATTERNS.some((p) => p.test(text));
}

/**
 * Support resources shown before payment and on the /help page.
 * REVIEW BEFORE LAUNCH: verify every number for the regions you serve.
 */
export const CRISIS_RESOURCES = [
  { region: "Worldwide", name: "Find A Helpline", contact: "findahelpline.com", href: "https://findahelpline.com" },
  { region: "United States", name: "988 Suicide & Crisis Lifeline", contact: "Call or text 988", href: "tel:988" },
  {
    region: "United States",
    name: "The Trevor Project (LGBTQ+ young people)",
    contact: "1-866-488-7386",
    href: "tel:18664887386",
  },
  { region: "US & Canada", name: "Trans Lifeline", contact: "1-877-565-8860", href: "tel:18775658860" },
  { region: "United Kingdom & Ireland", name: "Samaritans", contact: "116 123", href: "tel:116123" },
  { region: "中国大陆", name: "全国心理援助热线", contact: "12356", href: "tel:12356" },
] as const;
