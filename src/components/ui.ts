/** Shared Tailwind class recipes — the app's small design system. */
const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2 text-[0.95rem] font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

export const ui = {
  card: "rounded-3xl border border-line bg-surface p-5 shadow-soft",
  cardLink:
    "block rounded-3xl border border-line bg-surface p-5 shadow-soft transition hover:border-accent/50 hover:bg-surface",
  panel: "rounded-2xl bg-surface-2 p-4",
  h1: "text-[1.7rem] font-semibold tracking-tight",
  h2: "text-lg font-semibold tracking-tight",
  eyebrow: "text-xs font-medium uppercase tracking-wider text-muted",
  muted: "text-sm text-muted",
  label: "block text-sm font-medium mb-1.5",
  input:
    "w-full rounded-2xl border border-line bg-surface-2/60 px-4 py-2.5 text-base outline-none transition placeholder:text-muted/70 focus:border-accent focus:bg-surface focus:ring-4 focus:ring-accent/15",
  button: `${buttonBase} bg-accent text-accent-ink shadow-soft hover:bg-accent-strong`,
  buttonGhost: `${buttonBase} border border-line bg-surface text-ink hover:border-accent/50 hover:text-accent`,
  buttonDanger: `${buttonBase} bg-danger text-white hover:opacity-90`,
  buttonSmall:
    "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-ink",
  error: "rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger",
  success: "rounded-xl bg-success-soft px-3 py-2 text-sm text-success",
  notice: "rounded-2xl bg-accent-soft px-4 py-3 text-sm",
  badge: "shrink-0 whitespace-nowrap rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted",
  badgeAccent: "shrink-0 whitespace-nowrap rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent",
  badgeDanger: "shrink-0 whitespace-nowrap rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-medium text-danger",
  badgeSuccess:
    "shrink-0 whitespace-nowrap rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success",
  badgeWarn: "shrink-0 whitespace-nowrap rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-medium text-warn",
  link: "text-accent underline-offset-4 hover:underline",
} as const;
