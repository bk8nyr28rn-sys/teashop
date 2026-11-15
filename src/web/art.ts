/**
 * 用代码画的占位美术：Q 版角色和鬼。正式美术照着同样的比例替换。
 * 都返回一段 <svg>，可以单独放在页面里，也可以嵌进更大的 SVG 场景。
 */
import type { Appearance } from '../core';

export type Mood = 'calm' | 'happy' | 'sad' | 'angry';

export interface Swatch {
  c: string;
  n: string;
}

export const ROBES: Swatch[] = [
  { c: '#F0525A', n: '朱红' },
  { c: '#52D6A6', n: '翠青' },
  { c: '#7FA8FF', n: '天蓝' },
  { c: '#9B8CFF', n: '藤紫' },
  { c: '#FFC24B', n: '明黄' },
  { c: '#FF9A6B', n: '橘橙' },
  { c: '#FF8FC7', n: '桃粉' },
  { c: '#E9ECFF', n: '月白' },
];
export const TRIMS: Swatch[] = [
  { c: '#FFC24B', n: '金' },
  { c: '#E9ECFF', n: '银' },
  { c: '#52D6A6', n: '玉' },
  { c: '#F0525A', n: '朱' },
];
export const SKINS: Swatch[] = [
  { c: '#FFE4D6', n: '白皙' },
  { c: '#F6CFB4', n: '暖米' },
  { c: '#D9A27E', n: '蜜色' },
  { c: '#A8754F', n: '栗色' },
];
export const HAIRS: Swatch[] = [
  { c: '#2B2233', n: '墨黑' },
  { c: '#5A3A2E', n: '深棕' },
  { c: '#9A9DB8', n: '霜银' },
  { c: '#B4432F', n: '赭红' },
];
/** 发型全部是修仙风格（形象里不放戏曲元素） */
export const HEADDRESSES: { id: Appearance['headdress']; n: string }[] = [
  { id: 'bun', n: '发髻' },
  { id: 'guan', n: '玉冠' },
  { id: 'plain', n: '披发' },
  { id: 'twin', n: '双髻' },
  { id: 'ribbon', n: '仙带' },
];
/** 道途：OC 的身份标签，只是标签，不影响任何数值；和性别脱钩 */
export const PATHS = ['剑修', '丹修', '符修', '阵修', '器修', '御兽'];

/** 旧存档兼容：以前的两款戏曲头饰换成修仙款，旧的行当标签换成道途 */
const LEGACY_HEADDRESS: Record<string, Appearance['headdress']> = { feather: 'ribbon', crown: 'twin' };
const LEGACY_TRAIT: Record<string, string> = { 文武生: '剑修', 小生: '符修', 正印花旦: '丹修', 二帮花旦: '阵修', 丑生: '器修', 武生: '御兽' };
export function migrateLook(look: Appearance): Appearance {
  const hd = LEGACY_HEADDRESS[look.headdress as string];
  return hd ? { ...look, headdress: hd } : look;
}
export function migrateTraits(traits: string[]): string[] {
  return [...new Set(traits.map((t) => LEGACY_TRAIT[t] ?? t))];
}

export const DEFAULT_LOOK: Appearance = { robe: '#F0525A', trim: '#FFC24B', headdress: 'bun', skin: '#FFE4D6', hair: '#2B2233', outfit: 'robe' };

/** 服装风格：玩家自己挑，画风不定死。衣色和镶边色在三种服装上都生效 */
export const OUTFITS: { id: NonNullable<Appearance['outfit']>; n: string }[] = [
  { id: 'robe', n: '仙袍' },
  { id: 'tunic', n: '短褂' },
  { id: 'hoodie', n: '卫衣' },
];

/** 三种服装的身体部分（头以下），都画在 120 × 150 的画板里 */
function outfitBody(look: Appearance): string {
  const { robe, trim, skin } = look;
  switch (look.outfit ?? 'robe') {
    case 'tunic':
      return `
<rect x="40" y="126" width="16" height="15" rx="4" fill="#2C3346"/><rect x="64" y="126" width="16" height="15" rx="4" fill="#2C3346"/>
<ellipse cx="48" cy="141" rx="10" ry="4" fill="#1B1E2A"/><ellipse cx="72" cy="141" rx="10" ry="4" fill="#1B1E2A"/>
<path d="M33 96 Q18 108 16 126 Q24 130 31 124 Q34 112 39 104 Z M87 96 Q102 108 104 126 Q96 130 89 124 Q86 112 81 104 Z" fill="${robe}"/>
<circle cx="22" cy="127" r="6" fill="${skin}"/><circle cx="98" cy="127" r="6" fill="${skin}"/>
<path d="M34 92 Q60 82 86 92 L92 132 Q60 138 28 132 Z" fill="${robe}"/>
<g fill="#FFFFFF" opacity="0.45"><circle cx="42" cy="104" r="2"/><circle cx="52" cy="120" r="2"/><circle cx="70" cy="110" r="2"/><circle cx="80" cy="124" r="2"/><circle cx="76" cy="100" r="2"/></g>
<path d="M48 88 L66 112 M72 88 L60 104" stroke="#F4ECDD" stroke-width="5" stroke-linecap="round"/>
<rect x="31" y="118" width="58" height="6" rx="3" fill="${trim}"/>`;
    case 'hoodie':
      return `
<rect x="42" y="128" width="14" height="12" rx="4" fill="#2E3650"/><rect x="64" y="128" width="14" height="12" rx="4" fill="#2E3650"/>
<rect x="38" y="137" width="20" height="7" rx="3.5" fill="#FFFFFF"/><rect x="62" y="137" width="20" height="7" rx="3.5" fill="#FFFFFF"/>
<path d="M30 80 Q60 66 90 80 L92 98 Q60 88 28 98 Z" fill="${robe}"/>
<path d="M32 94 Q16 108 18 126 Q26 130 32 122 Q34 112 38 104 Z M88 94 Q104 108 102 126 Q94 130 88 122 Q86 112 82 104 Z" fill="${robe}"/>
<circle cx="24" cy="126" r="6" fill="${skin}"/><circle cx="96" cy="126" r="6" fill="${skin}"/>
<path d="M32 92 Q60 82 88 92 L92 132 Q60 138 28 132 Z" fill="${robe}"/>
<rect x="44" y="114" width="32" height="12" rx="5" fill="#000" opacity="0.12"/>
<path d="M52 92 L50 108 M68 92 L70 108" stroke="${trim}" stroke-width="2.6" stroke-linecap="round"/>
<circle cx="50" cy="109" r="2.4" fill="${trim}"/><circle cx="70" cy="109" r="2.4" fill="${trim}"/>`;
    default:
      return `
<path d="M32 96 Q14 108 12 128 Q22 134 30 126 Q33 112 38 104 Z M88 96 Q106 108 108 128 Q98 134 90 126 Q87 112 82 104 Z" fill="${robe}"/>
<path d="M13 127 Q22 133 30 125 M107 127 Q98 133 90 125" fill="none" stroke="${trim}" stroke-width="3" stroke-linecap="round"/>
<path d="M32 92 Q60 80 88 92 L98 140 Q60 148 22 140 Z" fill="${robe}"/>
<path d="M46 88 L60 104 L74 88" fill="none" stroke="${trim}" stroke-width="4" stroke-linejoin="round"/>
<rect x="34" y="114" width="52" height="6" rx="3" fill="${trim}"/>`;
  }
}

const INK = '#2B2233';

/**
 * Q 版角色。attrs 原样写进 <svg> 标签（class，或嵌套时的 x / y / width / height）。
 * portrait：只取头像。
 */
export function chibi(
  look: Appearance,
  mood: Mood,
  attrs: string,
  opts: { portrait?: boolean; label?: string } = {},
): string {
  const { trim, skin, hair, headdress } = look;
  const happy = mood === 'happy';
  const eyes = happy
    ? `<path d="M41 60 Q47 53 53 60 M67 60 Q73 53 79 60" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`
    : `<circle cx="47" cy="58" r="3.3" fill="${INK}"/><circle cx="73" cy="58" r="3.3" fill="${INK}"/>`;
  const mouth = {
    calm: 'M55 75 Q60 78 65 75',
    happy: 'M53 73 Q60 81 67 73',
    sad: 'M54 78 Q60 72 66 78',
    angry: 'M54 77 L66 77',
  }[mood];
  const a11y = opts.label ? `role="img" aria-label="${opts.label}"` : 'aria-hidden="true"';
  const viewBox = opts.portrait ? '14 0 92 92' : '0 0 120 150';

  return `<svg ${attrs} viewBox="${viewBox}" ${a11y}>
${opts.portrait ? '' : '<ellipse cx="60" cy="144" rx="34" ry="5" fill="#000" opacity="0.18"/>'}
${headdress === 'ribbon' ? `<path d="M50 26 Q30 30 16 52 Q24 54 30 48 Q40 34 52 30 Z M70 26 Q90 30 104 52 Q96 54 90 48 Q80 34 68 30 Z" fill="${trim}" opacity="0.85"/>` : ''}
${outfitBody(look)}
<circle cx="60" cy="56" r="34" fill="${skin}"/>
${headdress === 'bun' ? `<circle cx="60" cy="20" r="12" fill="${hair}"/><path d="M48 16 L74 22" stroke="${trim}" stroke-width="3" stroke-linecap="round"/>` : ''}
${headdress === 'guan' ? `<circle cx="60" cy="21" r="10" fill="${hair}"/><path d="M50 24 L52 8 L68 8 L70 24 Z" fill="${trim}"/><circle cx="60" cy="15" r="3" fill="#7FE0FF"/><path d="M44 17 H76" stroke="${trim}" stroke-width="3" stroke-linecap="round"/>` : ''}
<path d="M26 56 Q27 21 60 21 Q93 21 94 56 Q86 37 60 37 Q34 37 26 56 Z" fill="${hair}"/>
${headdress === 'twin' ? `<circle cx="34" cy="26" r="11" fill="${hair}"/><circle cx="86" cy="26" r="11" fill="${hair}"/><path d="M28 32 Q34 37 40 32 M80 32 Q86 37 92 32" fill="none" stroke="${trim}" stroke-width="3" stroke-linecap="round"/>` : ''}
${headdress === 'ribbon' ? `<path d="M30 36 Q60 26 90 36" fill="none" stroke="${trim}" stroke-width="4" stroke-linecap="round"/>` : ''}
${mood === 'angry' ? `<path d="M38 48 L52 52 M82 48 L68 52" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` : ''}
${eyes}
<ellipse cx="41" cy="68" rx="7" ry="4" fill="#FF8FA3" opacity="0.75"/><ellipse cx="79" cy="68" rx="7" ry="4" fill="#FF8FA3" opacity="0.75"/>
<path d="${mouth}" fill="none" stroke="#9C3D46" stroke-width="2.6" stroke-linecap="round"/>
${mood === 'sad' ? '<path d="M77 64 Q74 70 77 73 Q80 70 77 64 Z" fill="#7FC8FF"/>' : ''}
</svg>`;
}

/** 鬼。wild = 野鬼（月白）；spirit = 怨灵（藤紫，拖着红色的怨丝，皱着眉） */
export function ghost(kind: 'wild' | 'spirit', attrs: string): string {
  const spirit = kind === 'spirit';
  const body = spirit ? '#9B8CFF' : '#E9ECFF';
  return `<svg ${attrs} viewBox="0 0 120 120" aria-hidden="true">
${spirit ? '<path d="M30 98 Q22 108 30 116 Q38 110 34 102 M60 104 Q54 114 62 120 M90 98 Q100 106 94 116" fill="none" stroke="#F0525A" stroke-width="2.5" stroke-linecap="round"/>' : ''}
<path d="M20 62 Q20 18 60 18 Q100 18 100 62 L100 100 Q92 92 84 100 Q76 108 68 100 Q60 92 52 100 Q44 108 36 100 Q28 92 20 100 Z" fill="${body}"/>
<path d="M20 66 Q8 70 10 82 Q18 80 22 74 Z M100 66 Q112 70 110 82 Q102 80 98 74 Z" fill="${body}"/>
<ellipse cx="46" cy="58" rx="6" ry="8" fill="${INK}"/><ellipse cx="74" cy="58" rx="6" ry="8" fill="${INK}"/>
<circle cx="48" cy="55" r="2" fill="#FFFFFF"/><circle cx="76" cy="55" r="2" fill="#FFFFFF"/>
<ellipse cx="38" cy="70" rx="6" ry="3.5" fill="#FF8FA3" opacity="0.8"/><ellipse cx="82" cy="70" rx="6" ry="3.5" fill="#FF8FA3" opacity="0.8"/>
<ellipse cx="60" cy="74" rx="5" ry="6" fill="${INK}"/>
${spirit ? `<path d="M44 30 L52 38 M76 30 L68 38" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` : ''}
</svg>`;
}

/** NPC 散修没有自己设置的形象：按名字固定生成一个，同一个名字永远长一样 */
export function npcLook(name: string): Appearance {
  let h = 7;
  for (const ch of name) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  const pick = <T>(xs: readonly T[], shift: number): T => xs[(h >>> shift) % xs.length] as T;
  return {
    robe: pick(ROBES, 0).c,
    trim: pick(TRIMS, 3).c,
    headdress: pick(['bun', 'guan', 'plain'] as const, 5),
    skin: pick(SKINS, 8).c,
    hair: pick(HAIRS, 11).c,
    outfit: pick(['robe', 'tunic', 'hoodie'] as const, 14),
  };
}
