/**
 * Generated avatar: a soft two-tone gradient + initial, derived from the
 * nickname. No photo uploads at all — nothing identifying to leak.
 */
const PALETTES = [
  ["#c9b6e4", "#7d63a8"],
  ["#f2c6b6", "#c0705a"],
  ["#b8d8c8", "#4f8d74"],
  ["#c4d3ee", "#5874ad"],
  ["#f0d9a8", "#b28433"],
  ["#e8bfd2", "#a65a80"],
  ["#c7e0e3", "#4a8a93"],
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function Avatar({ name, size = 36 }: { name: string | null | undefined; size?: number }) {
  const key = name || "?";
  const [from, to] = PALETTES[hash(key) % PALETTES.length];
  const initial = key === "?" ? "·" : key[0].toUpperCase();
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, ${from}, ${to})`,
      }}
    >
      {initial}
    </span>
  );
}
