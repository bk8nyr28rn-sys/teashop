/** Minimal outline icons (inline SVG, no icon font or CDN). */
type P = { className?: string };
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export const icons = {
  home: ({ className }: P) => (
    <svg {...base} className={className}>
      <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" />
    </svg>
  ),
  circles: ({ className }: P) => (
    <svg {...base} className={className}>
      <circle cx="9" cy="10" r="4.5" />
      <circle cx="15.5" cy="14" r="4.5" />
    </svg>
  ),
  ask: ({ className }: P) => (
    <svg {...base} className={className}>
      <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7l-4.5 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M9.5 9.2a2.5 2.5 0 1 1 3.2 2.4c-.5.2-.7.5-.7 1v.2" />
      <path d="M12 14.6h.01" />
    </svg>
  ),
  me: ({ className }: P) => (
    <svg {...base} className={className}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5" />
    </svg>
  ),
  help: ({ className }: P) => (
    <svg {...base} className={className}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  ),
  shield: ({ className }: P) => (
    <svg {...base} className={className}>
      <path d="M12 3.5 5 6v5.5c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6z" />
    </svg>
  ),
  lock: ({ className }: P) => (
    <svg {...base} className={className}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </svg>
  ),
  arrow: ({ className }: P) => (
    <svg {...base} className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
} as const;

export type IconName = keyof typeof icons;

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  const C = icons[name];
  return <C className={className} />;
}
