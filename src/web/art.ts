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
/** 发型以修仙为主；翎子和凤冠是两个戏曲款（点缀） */
export const HEADDRESSES: { id: Appearance['headdress']; n: string }[] = [
  { id: 'bun', n: '发髻' },
  { id: 'guan', n: '玉冠' },
  { id: 'plain', n: '披发' },
  { id: 'feather', n: '翎子 · 戏曲款' },
  { id: 'crown', n: '凤冠 · 戏曲款' },
];
/** 行当取自粤剧六柱制，只当作 OC 的性格标签，和性别脱钩 */
export const ROLES = ['文武生', '小生', '正印花旦', '二帮花旦', '丑生', '武生'];

export const DEFAULT_LOOK: Appearance = { robe: '#F0525A', trim: '#FFC24B', headdress: 'bun', skin: '#FFE4D6', hair: '#2B2233' };

const INK = '#2B2233';

/**
 * Q 版角色。attrs 原样写进 <svg> 标签（class，或嵌套时的 x / y / width / height）。
 * portrait：只取头像；clown：丑生的“豆腐块”白鼻。
 */
export function chibi(
  look: Appearance,
  mood: Mood,
  attrs: string,
  opts: { portrait?: boolean; clown?: boolean; label?: string } = {},
): string {
  const { robe, trim, skin, hair, headdress } = look;
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
${headdress === 'feather' ? '<path d="M44 26 Q34 6 10 8 M76 26 Q86 6 110 8" fill="none" stroke="#E08A3C" stroke-width="3" stroke-linecap="round"/>' : ''}
<path d="M30 98 Q14 110 10 134 Q20 138 27 129 Q31 114 37 106 Z M90 98 Q106 110 110 134 Q100 138 93 129 Q89 114 83 106 Z" fill="#FFFFFF"/>
<path d="M32 92 Q60 80 88 92 L98 140 Q60 148 22 140 Z" fill="${robe}"/>
<path d="M46 88 L60 104 L74 88" fill="none" stroke="${trim}" stroke-width="4" stroke-linejoin="round"/>
<rect x="34" y="114" width="52" height="6" rx="3" fill="${trim}"/>
<circle cx="60" cy="56" r="34" fill="${skin}"/>
${headdress === 'bun' ? `<circle cx="60" cy="20" r="12" fill="${hair}"/><path d="M48 16 L74 22" stroke="${trim}" stroke-width="3" stroke-linecap="round"/>` : ''}
${headdress === 'guan' ? `<circle cx="60" cy="21" r="10" fill="${hair}"/><path d="M50 24 L52 8 L68 8 L70 24 Z" fill="${trim}"/><circle cx="60" cy="15" r="3" fill="#7FE0FF"/><path d="M44 17 H76" stroke="${trim}" stroke-width="3" stroke-linecap="round"/>` : ''}
<path d="M26 56 Q27 21 60 21 Q93 21 94 56 Q86 37 60 37 Q34 37 26 56 Z" fill="${hair}"/>
${headdress === 'crown' ? `<path d="M30 32 L38 13 L50 25 L60 8 L70 25 L82 13 L90 32 Q60 23 30 32 Z" fill="${trim}"/><circle cx="38" cy="13" r="5" fill="#F0525A"/><circle cx="60" cy="8" r="5" fill="#F0525A"/><circle cx="82" cy="13" r="5" fill="#F0525A"/>` : ''}
${headdress === 'feather' ? `<path d="M34 34 Q60 24 86 34 L84 40 Q60 31 36 40 Z" fill="${trim}"/><circle cx="60" cy="30" r="4" fill="#F0525A"/>` : ''}
<ellipse cx="46" cy="59" rx="9" ry="7" fill="#FF6B6B" opacity="0.3"/><ellipse cx="74" cy="59" rx="9" ry="7" fill="#FF6B6B" opacity="0.3"/>
${mood === 'angry' ? `<path d="M38 48 L52 52 M82 48 L68 52" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` : ''}
${eyes}
<ellipse cx="41" cy="68" rx="7" ry="4" fill="#FF8FA3" opacity="0.75"/><ellipse cx="79" cy="68" rx="7" ry="4" fill="#FF8FA3" opacity="0.75"/>
${opts.clown ? '<rect x="53" y="59" width="14" height="10" rx="4" fill="#FFFFFF"/>' : ''}
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
  };
}
