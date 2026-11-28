import { siteConfig } from "@/config/site";

/** Abstract arch ("a place to rest") — no flags or symbols, so it stays discreet. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill="url(#logo-g)" />
      <path d="M10 24v-7a6 6 0 0 1 12 0v7" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <LogoMark />
      <span translate="no">{siteConfig.name}</span>
    </span>
  );
}
