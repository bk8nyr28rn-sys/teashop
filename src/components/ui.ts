/** Shared Tailwind class recipes — tiny on purpose; swap for a UI kit later. */
export const ui = {
  card: "rounded-2xl border border-line bg-surface p-5",
  h1: "text-2xl font-semibold tracking-tight",
  h2: "text-lg font-semibold",
  muted: "text-sm text-muted",
  label: "block text-sm font-medium mb-1",
  input:
    "w-full rounded-xl border border-line bg-bg px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30",
  button:
    "inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2 font-medium text-accent-ink transition hover:opacity-90 disabled:opacity-50",
  buttonGhost:
    "inline-flex items-center justify-center rounded-xl border border-line px-4 py-2 font-medium transition hover:bg-line/40 disabled:opacity-50",
  error: "text-sm text-danger",
  badge: "shrink-0 whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-xs text-muted",
} as const;
