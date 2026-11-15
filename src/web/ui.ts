/**
 * 竖屏界面：把游戏状态画成几块区域的 HTML（顶栏、场景、特效、面板、导航、弹字、提示、弹层）。
 * 这里只负责“怎么显示”和“点了什么”，规则全部在 src/core。
 * 画面以 Q 版修仙小院为主，戏曲只做点缀。
 */
import {
  HOURS_PER_DAY,
  bigSuccessChance,
  canAttemptTribulation,
  doorPower,
  guardLineup,
  raidRewardsLeft,
  RAID_SPOTS,
  formationUpgradeCost,
  isInRetreat,
  isProtected,
  otherSide,
  threadsOf,
  tribulationOdds,
  tribulationRequirement,
  type Appearance,
  type ClanMember,
  type Gender,
  type Heir,
  type Thread,
  type World,
} from '../core';
import { hexToHsl, hslToHex, DEFAULT_LOOK, HAIRS, HEADDRESSES, OUTFITS, PATHS, ROBES, SKINS, TRIMS, chibi, ghost, npcLook, type Mood, type Swatch } from './art';
import { Game, ME, SPEEDS, SPEED_LABEL, type Speed } from './game';

export const REGIONS = ['hud', 'scene', 'fx', 'panel', 'nav', 'banner', 'toast', 'sheet'] as const;
export type Region = (typeof REGIONS)[number];
export type Frame = Record<Region, string>;

type Tab = 'home' | 'threads' | 'family' | 'trib';
type SheetState =
  | { type: 'avatar'; first: boolean }
  | { type: 'big'; threadId: string }
  | { type: 'pills' }
  | { type: 'retreat' }
  | { type: 'settings' }
  | { type: 'tie' }
  | { type: 'away' }
  | { type: 'log' };

interface Draft {
  name: string;
  initialName: string;
  gender: Gender;
  role: string;
  look: Appearance;
  /** 正在用调色盘调哪一项（robe / trim / skin / hair） */
  picker?: string | null;
}

const ui = {
  tab: 'home' as Tab,
  sheet: null as SheetState | null,
  draft: null as Draft | null,
  stake: 50,
  usePill: true,
  more: null as string | null,
  confirm: null as { kind: 'cut' | 'block' | 'newgame'; id: string } | null,
};

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const STAKES = [20, 50, 100, 200];
const GENDERS: { id: Gender; n: string }[] = [
  { id: 'female', n: '女' },
  { id: 'male', n: '男' },
  { id: 'other', n: '其他' },
  { id: 'unsaid', n: '不说' },
];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
const fmt = (n: number) => (Math.abs(n) >= 100 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, ''));
const pct = (x: number) => `${Math.round(x * 100)}%`;
const stamp = (hour: number) => `第 ${Math.floor(hour / HOURS_PER_DAY) + 1} 天 ${String(hour % HOURS_PER_DAY).padStart(2, '0')}:00`;

const ic = (body: string) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const I = {
  stone: ic('<path d="M12 3 19 9 12 21 5 9Z" fill="#7FE0FF"/>'),
  heart: ic('<path d="M12 20C4 14 4 7 8.500 6c2-.4 3 1 3.500 2 .5-1 1.500-2.400 3.500-2C20 7 20 14 12 20Z" fill="#B7ABFF"/>'),
  grudge: ic('<path d="M4 8q4-4 8 0t8 0M4 13q4-4 8 0t8 0M4 18q4-4 8 0t8 0" fill="none" stroke="#FF9A6B" stroke-width="2" stroke-linecap="round"/>'),
  ward: ic('<circle cx="12" cy="12" r="8" fill="none" stroke="#FFC24B" stroke-width="2" stroke-dasharray="3 2.500"/><circle cx="12" cy="12" r="2.500" fill="#FFC24B"/>'),
  home: ic('<path d="M3 11 12 4l9 7M6 10v10h12V10M10 20v-6h4v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'),
  thread: ic('<path d="M4 18C8 6 16 18 20 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="4" cy="18" r="2" fill="currentColor"/><circle cx="20" cy="6" r="2" fill="currentColor"/>'),
  family: ic('<circle cx="12" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="16" r="2.500" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="16" r="2.500" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 10v3M7.500 14 10 12M16.500 14 14 12" stroke="currentColor" stroke-width="2"/>'),
  bolt: ic('<path d="M13 3 6 13h5l-1 8 8-11h-5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'),
  gear: ic('<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.600 5.600l2.100 2.100M16.300 16.300l2.100 2.100M5.600 18.400l2.100-2.100M16.300 7.700l2.100-2.100" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  close: ic('<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.500" stroke-linecap="round"/>'),
};

// ---------- 取数据的小工具 ----------

function partnerOf(game: Game, t: Thread): { id: string | null; name: string; look: Appearance; real: boolean; devoted: boolean } {
  const id = otherSide(t, ME);
  if (id) {
    const h = game.world.houses.get(id);
    return { id, name: h?.name ?? id, look: h?.appearance ?? DEFAULT_LOOK, real: true, devoted: h?.openness === 'devoted' };
  }
  const name = t.npcName ?? '散修';
  return { id: null, name, look: npcLook(name), real: false, devoted: false };
}

function partnerMood(w: World, t: Thread): Mood {
  if (t.quarrel) return 'angry';
  const req = t.pendingRequest;
  if (req && req.from !== ME) return w.hour - req.at >= w.config.neglect.graceDays * HOURS_PER_DAY ? 'sad' : 'happy';
  return 'calm';
}

function myLook(game: Game): { look: Appearance } {
  const me = game.world.houses.get(ME)!;
  return { look: me.appearance ?? DEFAULT_LOOK };
}

/**
 * 族人的样子取自父母双方（孩子是两个人的结晶）：衣色、镶边、肤色、发色、服装各随父母一方，发型五选一。
 * 按族人自己的编号定，同一位族人永远长一样；父母长得像时也不会一排都一模一样。
 */
function memberLook(game: Game, m: ClanMember, i: number): Appearance {
  const mine = myLook(game).look;
  const otherKey = m.parents[0] === ME ? m.parents[1] : m.parents[0];
  const other = game.world.houses.get(otherKey)?.appearance ?? npcLook(otherKey);
  let h = 17 + i;
  for (const ch of m.id) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  const bit = (n: number) => ((h >>> n) & 1) === 1;
  const flip = bit(0);
  return {
    robe: flip ? mine.robe : other.robe,
    trim: flip ? other.robe : mine.robe,
    headdress: HEADDRESSES[(h >>> 3) % HEADDRESSES.length]!.id,
    skin: bit(6) ? other.skin : mine.skin,
    hair: bit(7) ? mine.hair : other.hair,
    outfit: bit(8) ? other.outfit : mine.outfit,
  };
}

function sortedThreads(game: Game): Thread[] {
  return threadsOf(game.world, ME).sort((a, b) => b.strands - a.strands);
}

function pendingStones(w: World): number {
  const me = w.houses.get(ME)!;
  return Math.floor((w.hour - me.lastMeditationCollect) * w.config.economy.meditationPerHour);
}

function openAvatar(game: Game, first: boolean): void {
  const me = game.world.houses.get(ME)!;
  const name = first && me.name === '你' ? '' : me.name;
  ui.draft = {
    name,
    initialName: name,
    gender: me.gender ?? 'unsaid',
    role: PATHS.includes(me.traits[0] ?? '') ? me.traits[0]! : PATHS[0]!,
    look: { outfit: 'robe', ...(me.appearance ?? DEFAULT_LOOK) },
  };
  ui.sheet = { type: 'avatar', first };
}

// ---------- 总入口 ----------

export function render(game: Game): Frame {
  const w = game.world;
  if (!ui.sheet) {
    if (game.needsSetup()) openAvatar(game, true);
    else if (game.awayReport) ui.sheet = { type: 'away' };
  }
  if (ui.sheet?.type === 'big' && w.threads.get(ui.sheet.threadId)?.state !== 'active') ui.sheet = null;

  const panel =
    ui.tab === 'home' ? homePanel(game) : ui.tab === 'threads' ? threadsPanel(game) : ui.tab === 'family' ? familyPanel(game) : tribPanel(game);
  return {
    hud: hud(game),
    scene: ui.tab === 'home' ? homeScene(game) : ui.tab === 'trib' ? tribScene(game) : '',
    fx: fx(game),
    panel,
    nav: nav(game),
    banner: banner(game),
    toast: toast(game),
    sheet: sheet(game),
  };
}

// ---------- 顶栏 ----------

function hud(game: Game): string {
  const w = game.world;
  const me = w.houses.get(ME)!;
  const { look } = myLook(game);
  const day = Math.floor(w.hour / HOURS_PER_DAY);
  const res = (icon: string, value: string, label: string, cls = '') =>
    `<div class="res ${cls}"><span>${icon}${label}</span><b class="num">${value}</b></div>`;
  const speedIcon = {
    pause: '<path d="M7 5v14M17 5v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    real: '<path d="M8 5l11 7-11 7Z" fill="currentColor"/>',
    fast: '<path d="M3 5l9 7-9 7ZM12 5l9 7-9 7Z" fill="currentColor"/>',
    turbo: '<path d="M1 5l7 7-7 7ZM9 5l7 7-7 7ZM17 5l6 7-6 7Z" fill="currentColor"/>',
  }[game.speed];
  return `<div class="hud-row gutter">
    <button id="btn-avatar" class="me-btn" data-act="avatar" aria-label="设置形象">${chibi(look, 'calm', 'class="portrait"', { portrait: true })}</button>
    <div class="who"><b>${esc(me.name)}</b><span class="num">境界 ${me.realm} · 第 ${day + 1} 天 ${WEEKDAYS[day % 7]} ${String(w.hour % 24).padStart(2, '0')}:00</span></div>
    <button id="btn-speed" class="chip-btn" data-act="speed-cycle" aria-label="时间流速：${SPEED_LABEL[game.speed]}，点按切换">${ic(speedIcon)}${SPEED_LABEL[game.speed]}</button>
    <button id="btn-settings" class="icon-btn" data-act="settings" aria-label="设置">${I.gear}</button>
  </div>
  <div class="res-row gutter">
    ${res(I.stone, fmt(me.stones), '灵石', game.justCollected() ? 'bump' : '')}
    ${res(I.heart, String(me.ghostHearts), '诡心')}
    ${res(I.grudge, fmt(me.grudge), '怨丝', me.grudge >= w.config.ghosts.omenGrudge ? 'warn' : '')}
    ${res(I.ward, fmt(doorPower(w, me)), '大阵')}
  </div>`;
}

// ---------- 场景：家族大院地图 ----------

/** 地图画板 390 × 430。鬼从三个院门进来，砸的是正中你家的门 */
const MAP_H = 430;
const DOOR = { x: 195, y: 238 };
/** 族人小屋的六块地（左右两列 + 底下两块）；孩子站在 RAID_SPOTS 上，守夜时就在原地出手 */
const HUTS = [
  { x: 52, y: 330 },
  { x: 338, y: 330 },
  { x: 52, y: 404 },
  { x: 338, y: 404 },
  { x: 122, y: 412 },
  { x: 268, y: 412 },
];

function hut(x: number, base: number, roof: string, lit: boolean): string {
  return `<g>
    <ellipse cx="${x}" cy="${base + 2}" rx="30" ry="5" fill="#000" opacity="0.18"/>
    <rect x="${x - 24}" y="${base - 30}" width="48" height="30" rx="3" fill="#F7EEE0"/>
    <path d="M${x - 33} ${base - 26} L${x - 20} ${base - 46} L${x + 20} ${base - 46} L${x + 33} ${base - 26} Q${x} ${base - 31} ${x - 33} ${base - 26} Z" fill="${roof}"/>
    <path d="M${x - 33} ${base - 26} q-5 -3 -3 -8 M${x + 33} ${base - 26} q5 -3 3 -8" stroke="#FFC24B" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M${x - 7} ${base} V${base - 16} Q${x} ${base - 22} ${x + 7} ${base - 16} V${base} Z" fill="#B8323C"/>
    <rect x="${x + 11}" y="${base - 22}" width="8" height="8" rx="1.5" fill="${lit ? '#FFD86B' : '#5B4F7A'}"/>
  </g>`;
}

/** 守夜局的背景：同一张院子地图，去掉孩子、当家人、游荡的鬼和所有可点的东西（这些由守夜画面自己画） */
export function raidBackdrop(game: Game): string {
  return homeScene(game, true).replace(/ data-(act|v)="[^"]*"/g, '');
}

/** 给守夜画面用：孩子和当家人的样子 */
export function lookOfGuard(game: Game, id: string): Appearance {
  const me = game.world.houses.get(ME)!;
  if (id === 'self') return myLook(game).look;
  const i = me.members.findIndex((m) => m.id === id);
  return i >= 0 ? memberLook(game, me.members[i]!, i) : DEFAULT_LOOK;
}

function homeScene(game: Game, backdrop = false): string {
  const w = game.world;
  const me = w.houses.get(ME)!;
  const h = w.hour % 24;
  const phase = h >= 20 || h < 5 ? 'night' : h < 8 ? 'dawn' : h < 17 ? 'day' : 'dusk';
  const sky = { night: '#1F2256', dawn: '#4B4A8C', day: '#3F5FA8', dusk: '#5C3F7A' }[phase];
  const ground = { night: '#17193F', dawn: '#2A2B5E', day: '#2C3A72', dusk: '#2A2050' }[phase];
  const knock = game.activeKnock();
  const retreating = isInRetreat(w, me);
  const safe = retreating || isProtected(w, me) || me.graceActionsLeft > 0;
  const damaged = me.formationDamage > 0;
  const ring = safe ? '#52D6A6' : damaged ? '#FF9A6B' : '#FFC24B';
  const threads = sortedThreads(game);
  const top = threads[0];
  const { look } = myLook(game);
  const mood: Mood = knock ? (knock.outcome === 'breach' ? 'sad' : 'happy') : threads.some((t) => t.quarrel) ? 'sad' : 'calm';
  const night = phase === 'night' || phase === 'dusk';

  // —— 隔壁：搭档的宅子（地图右上，院墙外） ——
  let neighbor = `<g class="tap" data-act="tab" data-v="threads">
      <rect x="262" y="22" width="112" height="58" rx="10" fill="none" stroke="#4A4F8F" stroke-width="2" stroke-dasharray="6 6"/>
      <text x="318" y="48" text-anchor="middle" font-size="13" fill="#B9BCE8">隔壁空着</text>
      <text x="318" y="66" text-anchor="middle" font-size="11" fill="#FFC24B">去牵红线 ›</text></g>`;
  let thread = '';
  if (top) {
    const p = partnerOf(game, top);
    const color = top.quarrel ? '#FF9A6B' : top.golden ? '#FFC24B' : '#F0525A';
    const tier = w.config.tiers.names[top.tier] ?? '';
    const online = game.partnerOnline(top);
    const asking = !!top.pendingRequest && top.pendingRequest.from !== ME;
    thread = `<path class="red-thread" d="M318 108 C 330 200, 262 250, ${DOOR.x + 18} ${DOOR.y - 8}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" ${top.quarrel ? 'stroke-dasharray="7 6"' : ''}/>`;
    neighbor = `<g class="tap" data-act="tab" data-v="threads">
      <ellipse cx="318" cy="84" rx="58" ry="6" fill="#000" opacity="0.2"/>
      <rect x="276" y="44" width="84" height="40" rx="3" fill="#F7EEE0"/>
      <path d="M264 46 Q318 14 372 46 L364 38 Q318 8 272 38 Z" fill="${p.real ? '#3E8A6E' : '#6B6F9A'}"/>
      <path d="M290 84 V64 Q300 56 310 64 V84 Z" fill="#B8323C"/>
      <rect x="320" y="58" width="12" height="10" rx="2" fill="${online ? '#FFD86B' : '#5B4F7A'}"/>
      <rect x="276" y="${online ? 88 : 88}" width="84" height="20" rx="10" fill="#2A2D5E" stroke="${color}" stroke-width="1.5"/>
      <text x="318" y="102" text-anchor="middle" font-size="11.5" fill="#FFFFFF">${esc(p.name)}家 · <tspan fill="#FFC24B">${esc(tier)}</tspan>${threads.length > 1 ? ` +${threads.length - 1}` : ''}</text>
      ${online ? `<g class="bob">${chibi(p.look, partnerMood(w, top), 'x="338" y="44" width="34" height="42.5"')}</g>` : ''}
      ${asking ? `<g class="float"><rect x="250" y="20" width="44" height="26" rx="13" fill="#FFFFFF"/><path d="M282 44 L288 52 L290 44Z" fill="#FFFFFF"/><text x="272" y="38" text-anchor="middle" font-size="14" fill="#1E2048" class="display">…</text></g>` : ''}
      ${top.quarrel ? '<path d="M262 30 l8 0 M266 26 l0 8 M276 22 l6 6 M276 28 l6 -6" stroke="#FF9A6B" stroke-width="3" stroke-linecap="round"/>' : ''}
    </g>`;
  }

  // —— 族人小屋：守夜阵容里的孩子站在自己的位置上，受伤的排在后面 ——
  const { guards, hurt } = guardLineup(w, ME);
  const shown = [...guards, ...hurt].slice(0, HUTS.length);
  const huts = HUTS.map((s, i) => {
    const m = shown[i];
    if (!m) {
      return `<g opacity="0.7"><rect x="${s.x - 26}" y="${s.y - 34}" width="52" height="34" rx="8" fill="none" stroke="#5B61B0" stroke-width="2" stroke-dasharray="5 5"/>
        <text x="${s.x}" y="${s.y - 12}" text-anchor="middle" font-size="11" fill="#8C90D0">空地</text></g>`;
    }
    const spot = RAID_SPOTS[i]!;
    const isHurt = m.injuredUntil > w.hour;
    const idx = me.members.indexOf(m);
    if (backdrop) return hut(s.x, s.y, '#6A58B8', night);
    return `${hut(s.x, s.y, '#6A58B8', night)}
      <g ${isHurt ? 'opacity="0.6"' : ''}>${chibi(memberLook(game, m, idx), isHurt ? 'sad' : 'calm', `x="${spot.x - 16}" y="${spot.y - 40}" width="32" height="40"`)}</g>
      ${isHurt ? `<g transform="translate(${spot.x + 6} ${spot.y - 42})"><rect width="12" height="12" rx="3" fill="#FFFFFF"/><path d="M6 2V10M2 6H10" stroke="#F0525A" stroke-width="2.4"/></g>` : ''}`;
  }).join('');
  const extra = me.members.length > HUTS.length ? `<text x="195" y="428" text-anchor="middle" font-size="10.5" fill="#B9BCE8">还有 ${me.members.length - HUTS.length} 位族人在后院</text>` : '';

  // —— 灵石堆（点了收）和丹炉（点了炼丹） ——
  const pending = pendingStones(w);
  const gems = pending >= 60 ? 3 : pending >= 20 ? 2 : pending > 0 ? 1 : 0;
  const pile = `<g class="tap" data-act="collect">
      <ellipse cx="80" cy="214" rx="30" ry="7" fill="#000" opacity="0.2"/>
      ${gems >= 2 ? '<path d="M60 214 72 190 84 214Z" fill="#5CCBEF"/>' : ''}
      ${gems >= 1 ? '<path d="M70 216 84 180 98 216Z" fill="#7FE0FF"/><path d="M84 180 88 202 98 216Z" fill="#FFFFFF" opacity="0.35"/>' : '<path d="M66 214 L94 214" stroke="#5B61B0" stroke-width="3" stroke-linecap="round"/>'}
      ${gems >= 3 ? '<path d="M88 216 100 194 112 216Z" fill="#A9EEFF"/>' : ''}
      ${pending > 0 ? `<g class="bob"><rect x="56" y="152" width="50" height="22" rx="11" fill="#52D6A6"/><text x="81" y="168" text-anchor="middle" font-size="13" fill="#15173A" class="num">+${pending}</text></g>` : '<text x="80" y="232" text-anchor="middle" font-size="10.5" fill="#8C90D0">打坐中</text>'}
    </g>`;
  const furnace = `<g class="tap" data-act="pills">
      <ellipse cx="312" cy="216" rx="28" ry="6" fill="#000" opacity="0.2"/>
      <path d="M294 214 L298 200 M330 214 L326 200" stroke="#8C7BDC" stroke-width="4" stroke-linecap="round"/>
      <path d="M288 184 Q312 176 336 184 L332 204 Q312 212 292 204 Z" fill="#8C7BDC"/>
      <rect x="290" y="180" width="44" height="7" rx="3.5" fill="#FFC24B"/>
      <g class="glow"><ellipse cx="312" cy="198" rx="8" ry="5" fill="#FF9A6B"/></g>
      <g class="drift-up" fill="#E9ECFF" opacity="0.35"><circle cx="308" cy="170" r="5"/><circle cx="316" cy="160" r="4"/></g>
      ${me.ghostHearts > 0 ? `<g transform="translate(330 172)"><circle r="10" fill="#9B8CFF"/><text y="4.5" text-anchor="middle" font-size="12" fill="#FFFFFF" class="num">${me.ghostHearts}</text></g>` : ''}
    </g>`;

  // —— 门的血条：符阵等级减去受损 ——
  const hp = me.formationLevel > 0 ? Math.max(0, me.formationLevel - me.formationDamage) / me.formationLevel : 1;
  const hpBar = `<g>
      <rect x="160" y="160" width="70" height="8" rx="4" fill="#15173A"/>
      <rect x="160" y="160" width="${(70 * hp).toFixed(1)}" height="8" rx="4" fill="${ring}"/>
      <text x="195" y="182" text-anchor="middle" font-size="11" fill="#1E2048" class="num">大阵 ${fmt(doorPower(w, me))}</text>
    </g>`;

  // —— 游荡的鬼：院墙外一直在转；没有保护时，院子里也有一只在晃 ——
  const spirits = Math.min(3, Math.ceil(me.grudge / 10));
  const omen = me.grudge >= w.config.ghosts.omenGrudge;
  const roamers = [
    `<g class="roam roam-top">${ghost('wild', 'x="-16" y="-16" width="32" height="32"')}</g>`,
    `<g class="roam roam-left">${ghost('wild', 'x="-14" y="-14" width="28" height="28"')}</g>`,
    ...Array.from({ length: spirits }, (_, i) => `<g class="roam roam-${['right', 'bottom', 'top2'][i]}">${ghost('spirit', 'x="-17" y="-17" width="34" height="34"')}</g>`),
    safe ? '' : `<g class="roam roam-yard" opacity="0.92">${ghost(omen ? 'spirit' : 'wild', 'x="-18" y="-18" width="36" height="36"')}</g>`,
  ].join('');

  return `<svg class="scene-svg" viewBox="0 0 390 ${MAP_H}" role="img" aria-label="你的家族大院：鬼在院外游荡，砸的是你家的门">
    <rect width="390" height="${MAP_H}" fill="${ground}"/>
    <rect width="390" height="104" fill="${sky}"/>
    ${night ? `<circle cx="40" cy="40" r="18" fill="#FFF2C4"/><g class="twinkle" fill="#FFFFFF"><circle cx="110" cy="22" r="1.5"/><circle cx="180" cy="50" r="1.3"/><circle cx="230" cy="16" r="1.6"/><circle cx="90" cy="70" r="1.2"/></g>` : '<circle cx="40" cy="40" r="17" fill="#FFD98A"/>'}
    <path d="M0 96 50 62 96 88 150 54 210 90 250 70 262 96Z" fill="#1A1C4A" opacity="0.7"/>
    <path d="M0 104H390" stroke="#000" stroke-opacity="0.15" stroke-width="6"/>
    ${safe ? '<rect x="18" y="110" width="354" height="314" rx="22" fill="none" stroke="#52D6A6" stroke-width="10" opacity="0.25" class="glow"/>' : ''}
    <rect x="26" y="118" width="338" height="298" rx="16" fill="#3D4285"/>
    <path d="M26 166H364M26 214H364M26 262H364M26 310H364M26 358H364M90 118V416M160 118V416M230 118V416M300 118V416" stroke="#363B7A" stroke-width="2"/>
    <path d="M195 246 V416" stroke="#4A4F8F" stroke-width="22"/>
    <rect x="26" y="118" width="338" height="298" rx="16" fill="none" stroke="#6A58B8" stroke-width="9"/>
    <g fill="${ground}"><rect x="20" y="236" width="14" height="40"/><rect x="356" y="236" width="14" height="40"/><rect x="175" y="410" width="40" height="14"/></g>
    <g fill="#FFC24B"><rect x="19" y="228" width="16" height="8" rx="2"/><rect x="19" y="276" width="16" height="8" rx="2"/><rect x="355" y="228" width="16" height="8" rx="2"/><rect x="355" y="276" width="16" height="8" rx="2"/><rect x="167" y="408" width="8" height="16" rx="2"/><rect x="215" y="408" width="8" height="16" rx="2"/></g>
    ${[[30, 122], [360, 122], [30, 412], [360, 412]].map(([x, y]) => `<g class="glow"><circle cx="${x}" cy="${y}" r="7" fill="${ring}"/></g>`).join('')}
    ${pile}${furnace}
    <ellipse cx="${DOOR.x}" cy="${DOOR.y}" rx="104" ry="20" fill="${ring}" opacity="0.1"/>
    <ellipse class="ward-flow" cx="${DOOR.x}" cy="${DOOR.y}" rx="104" ry="20" fill="none" stroke="${ring}" stroke-width="2.5" stroke-dasharray="${damaged ? '3 9' : '9 7'}"/>
    <rect x="130" y="150" width="130" height="90" fill="#FFF0E2"/>
    <rect x="130" y="150" width="12" height="90" fill="#F0525A"/><rect x="248" y="150" width="12" height="90" fill="#F0525A"/>
    <path d="M110 154 Q195 104 280 154 Q272 162 258 158 L132 158 Q118 162 110 154 Z" fill="#6A58B8"/>
    <path d="M110 154 Q102 144 112 138 M280 154 Q288 144 278 138" stroke="#FFC24B" stroke-width="4" fill="none" stroke-linecap="round"/>
    <rect x="160" y="118" width="70" height="22" rx="5" fill="#2A2D5E" stroke="#FFC24B" stroke-width="2"/>
    <text x="195" y="134" text-anchor="middle" font-size="13" fill="#FFF2C4" class="display">${esc(me.name.slice(0, 4))}宅</text>
    ${hpBar}
    <path d="M176 240 V206 Q176 190 195 190 Q214 190 214 206 V240 Z" fill="#C2434A"/>
    <path d="M195 192 V240" stroke="#8E2D33" stroke-width="2"/>
    <circle cx="189" cy="218" r="2.6" fill="#FFC24B"/><circle cx="201" cy="218" r="2.6" fill="#FFC24B"/>
    ${retreating ? '<rect x="184" y="198" width="22" height="36" rx="3" fill="#FFF2C4" stroke="#52D6A6" stroke-width="2"/><text x="195" y="213" text-anchor="middle" font-size="10" fill="#1E2048" class="display">闭</text><text x="195" y="227" text-anchor="middle" font-size="10" fill="#1E2048" class="display">关</text>' : ''}
    ${damaged ? '<path d="M180 200 L190 212 L184 222 M210 204 L202 216" stroke="#15173A" stroke-width="2" fill="none"/>' : ''}
    <g class="glow"><ellipse cx="150" cy="176" rx="8" ry="10" fill="#FFB347"/><ellipse cx="240" cy="176" rx="8" ry="10" fill="#FFB347"/></g>
    ${me.guardianKnocks > 0 ? `<g class="float" opacity="0.9">${ghost('spirit', 'x="222" y="196" width="30" height="30"')}</g>` : ''}
    ${huts}${extra}
    ${neighbor}
    ${thread}
    ${backdrop ? '' : `<g class="tap bob" data-act="avatar">${chibi(look, mood, `x="${DOOR.x - 62}" y="${DOOR.y - 50}" width="46" height="57.5"`)}</g>`}
    ${backdrop ? '' : roamers}
  </svg>`;
}

function tribScene(game: Game): string {
  const w = game.world;
  const { look } = myLook(game);
  const odds = tribulationOdds(w, ME, { usePill: ui.usePill });
  const helper = odds.helper ? partnerOf(game, odds.helper) : null;
  return `<svg class="scene-svg" viewBox="0 0 390 240" role="img" aria-label="渡劫">
    <rect width="390" height="240" fill="#191B40"/>
    <g class="flash" fill="none" stroke="#FFC24B" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><path d="M64 26 90 76 78 78 98 124"/><path d="M326 20 302 72 316 74 296 116"/></g>
    <ellipse cx="195" cy="218" rx="92" ry="16" fill="#F0525A"/><ellipse cx="195" cy="213" rx="80" ry="11" fill="#FF8FA3"/>
    <g class="float">${ghost('wild', 'x="135" y="4" width="120" height="120"')}</g>
    <rect x="262" y="44" width="112" height="24" rx="12" fill="#2A2D5E" stroke="#E9ECFF" stroke-width="1.500"/>
    <text x="318" y="61" text-anchor="middle" font-size="12" fill="#FFFFFF">大鬼 · 战力 ${fmt(odds.strength)}</text>
    ${helper ? `<g opacity="0.8">${chibi(helper.look, 'calm', 'x="96" y="142" width="58" height="72.500"')}</g>` : ''}
    <g class="bob">${chibi(look, 'angry', 'x="157" y="122" width="76" height="95"')}</g>
  </svg>`;
}

/** 一次性的特效单独放一层：场景重画时不会把动画打断 */
function fx(game: Game): string {
  if (ui.tab === 'home') {
    const k = game.activeKnock();
    if (!k) return '';
    const badge = { defended: '散！', purified: '化！', guarded: '挡！', breach: '破！' }[k.outcome];
    const color = k.outcome === 'breach' ? '#FF9A6B' : k.outcome === 'purified' ? '#52D6A6' : '#FFC24B';
    // 从哪个院门进来：按这次砸门的时间挑一个，同一次重画不会变
    const gate = ['left', 'right', 'bottom'][Math.floor(k.at / 7) % 3];
    return `<svg class="scene-svg" viewBox="0 0 390 ${MAP_H}" aria-hidden="true" data-fx="${k.at}">
      ${k.outcome === 'breach' ? `<rect class="m-flash" width="390" height="${MAP_H}" fill="#FF9A6B"/>` : ''}
      <g class="m-ring"><ellipse cx="${DOOR.x}" cy="${DOOR.y - 20}" rx="22" ry="22" fill="none" stroke="#FFFFFF" stroke-width="3"/></g>
      <g class="m-ring m-ring2"><ellipse cx="${DOOR.x}" cy="${DOOR.y - 20}" rx="22" ry="22" fill="none" stroke="#FFFFFF" stroke-width="3"/></g>
      <g class="m-ring m-ring3"><ellipse cx="${DOOR.x}" cy="${DOOR.y - 20}" rx="22" ry="22" fill="none" stroke="#FFFFFF" stroke-width="3"/></g>
      <g class="raid raid-${gate}"><g class="m-bang"><g class="m-out m-${k.outcome}">
        <g class="whack" data-act="whack">${ghost(k.kind, 'x="-30" y="-30" width="60" height="60"')}<circle r="34" fill="transparent"/></g>
      </g></g></g>
      <g class="m-knock"><rect x="214" y="148" width="104" height="28" rx="14" fill="#FFFFFF"/><path d="M222 174 L216 184 L232 175Z" fill="#FFFFFF"/><text x="266" y="167" text-anchor="middle" font-size="14" fill="#1E2048" class="display">咚…咚咚…</text></g>
      ${k.outcome === 'breach'
        ? `<path class="m-crack" d="M182 196 L192 210 L184 222 L196 236 M206 198 L200 214 L210 228" stroke="#15173A" stroke-width="3" fill="none" stroke-linecap="round"/>`
        : `<path class="m-burst" d="M195 160 205 196 240 182 218 212 256 220 218 228 240 258 205 244 195 280 185 244 150 258 172 228 134 220 172 212 150 182 185 196Z" fill="${color}"/>`}
      <text class="m-badge display" x="${DOOR.x}" y="296" text-anchor="middle" font-size="48" fill="${color}" stroke="#15173A" stroke-width="6" paint-order="stroke">${badge}</text>
      <g class="m-hint"><rect x="120" y="84" width="150" height="26" rx="13" fill="#15173A" opacity="0.85"/><text x="195" y="102" text-anchor="middle" font-size="12.5" fill="#FFFFFF">戳戳它，出口气！</text></g>
    </svg>`;
  }
  if (ui.tab === 'trib') {
    const t = game.activeTribulation();
    if (!t) return '';
    return `<svg class="scene-svg" viewBox="0 0 390 240" aria-hidden="true">
      <rect class="fx-flash fx-now" width="390" height="240" fill="${t.success ? '#FFC24B' : '#FF9A6B'}"/>
      <text class="fx-badge fx-now display" x="195" y="110" text-anchor="middle" font-size="46" fill="${t.success ? '#FFC24B' : '#FF9A6B'}" stroke="#15173A" stroke-width="6" paint-order="stroke">${t.success ? '突破！' : '未过…'}</text>
    </svg>`;
  }
  return '';
}

// ---------- 宅院页 ----------

function homePanel(game: Game): string {
  const w = game.world;
  const me = w.houses.get(ME)!;
  const latest = game.log[0];
  const injured = me.members.filter((m) => m.injuredUntil > w.hour).length;
  const retreating = isInRetreat(w, me);
  const quota = w.config.retreat.daysPerWindow - me.retreatDaysUsed;
  const pending = pendingStones(w);
  const cost = formationUpgradeCost(w, me);
  const protectedLeft = (me.protectedUntil ?? 0) - w.hour;

  const chips: string[] = [];
  if (protectedLeft > 0) chips.push(chip(`新手保护 · 还剩 ${Math.ceil(protectedLeft / HOURS_PER_DAY)} 天`, 'jade'));
  if (retreating) chips.push(chip('闭关中', 'jade'));
  if (me.graceActionsLeft > 0) chips.push(chip(`劫后余生 · ${me.graceActionsLeft} 次行动内安全`, 'gold'));
  if (me.guardianKnocks > 0) chips.push(chip(`护宅怨灵 × ${me.guardianKnocks}`, 'jade'));
  if (me.formationDamage > 0) chips.push(chip(`阵法受损 ${me.formationDamage}`, 'ember'));
  if (injured > 0) chips.push(chip(`${injured} 位族人疗伤中`, 'ember'));
  if (me.grudge >= w.config.ghosts.omenGrudge) chips.push(chip('怨气深重，怨灵将至', 'red'));

  const second =
    me.formationDamage > 0
      ? actionBtn('repair', '修阵法', `每处 ${w.config.economy.repairCostPerDamage} 灵石`, me.stones < w.config.economy.repairCostPerDamage)
      : actionBtn('upgrade', '升符阵', `${cost} 灵石`, me.stones < cost);

  const left = raidRewardsLeft(w, ME);
  const lineup = guardLineup(w, ME).guards.length;
  const raidCard = `<button id="raid-start" class="raid-start" data-act="raid-start">
      <span class="raid-start-title">开始守夜</span>
      <span class="raid-start-sub">你和 ${lineup} 个孩子一起守院子 · ${left > 0 ? `今天还有 ${left} 局有奖励` : '今天的奖励领完了，可以练手'}</span>
    </button>`;
  return `<div class="gutter stack">
    ${raidCard}
    ${latest ? `<button id="btn-log" class="subtitle tone-${latest.tone}" data-act="log"><span class="tag">见闻</span><span class="line">${esc(latest.text)}</span><span class="go">›</span></button>` : ''}
    ${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}
    ${todos(game)}
    <div class="actions">
      ${actionBtn('collect', '收灵石', pending > 0 ? `可收 ${pending}` : '打坐中', false, pending > 0 ? `+${pending}` : '')}
      ${second}
      ${actionBtn('pills', '炼丹', `诡心 ${me.ghostHearts}`)}
      ${actionBtn('retreat-sheet', '闭关', retreating ? '闭关中' : `本月剩 ${quota} 天`)}
    </div>
  </div>`;
}

function chip(text: string, tone: string): string {
  return `<span class="chip chip-${tone}">${esc(text)}</span>`;
}

function actionBtn(act: string, label: string, note: string, disabled = false, badge = ''): string {
  return `<button id="act-${act}" class="action" data-act="${act}" ${disabled ? 'disabled' : ''}><b>${esc(label)}</b><small>${esc(note)}</small>${badge ? `<span class="badge num">${esc(badge)}</span>` : ''}</button>`;
}

/** 现在最该处理的事，直接给一个去处 */
function todos(game: Game): string {
  const w = game.world;
  const me = w.houses.get(ME)!;
  const out: string[] = [];
  const todo = (id: string, tone: string, text: string, cta: string, attrs: string) =>
    `<button id="${id}" class="todo todo-${tone}" ${attrs}><span>${esc(text)}</span><b>${esc(cta)} ›</b></button>`;

  const proposal = [...w.snatchProposals.values()].find((p) => p.target === ME);
  if (proposal) {
    const who = w.houses.get(proposal.by)?.name ?? '有人';
    out.push(`<div class="todo todo-red snatch"><span>${esc(who)}来抢亲：答应的话，现在的线按剪线处理，再和 TA 牵新线。</span>
      <div class="row"><button id="snatch-yes" class="btn" data-act="snatch" data-id="${proposal.id}" data-v="1">答应</button><button id="snatch-no" class="btn primary" data-act="snatch" data-id="${proposal.id}" data-v="0">回绝</button></div></div>`);
  }
  for (const heir of w.heirs.values()) {
    if (heir.parents.includes(ME) && heir.home === null) out.push(todo(`todo-heir-${heir.id}`, 'gold', '嫡传降生了，商量记在哪家族谱', '去家族', 'data-act="tab" data-v="family"'));
  }
  for (const t of sortedThreads(game)) {
    const p = partnerOf(game, t);
    if (t.quarrel && !t.quarrel.reconciled.includes(ME)) out.push(todo(`todo-q-${t.id}`, 'ember', `和${p.name}闹别扭了`, '去和好', 'data-act="tab" data-v="threads"'));
    else if (t.pendingRequest && t.pendingRequest.from !== ME) out.push(todo(`todo-r-${t.id}`, 'red', `${p.name}捎来一句话，等你回音`, '去回话', 'data-act="tab" data-v="threads"'));
    else if (p.real && !t.heirId && t.strands >= w.config.heir.strandThreshold && !t.heirSignatures.includes(ME)) out.push(todo(`todo-h-${t.id}`, 'gold', `和${p.name}的红线够浓了，可以结嫡传`, '去签署', 'data-act="tab" data-v="threads"'));
  }
  if (canAttemptTribulation(w, ME).ok) out.push(todo('todo-trib', 'gold', `修为已满，可以冲击境界 ${me.realm + 1}`, '去渡劫', 'data-act="tab" data-v="trib"'));
  return out.slice(0, 3).join('');
}

// ---------- 红线页 ----------

function threadsPanel(game: Game): string {
  const w = game.world;
  const me = w.houses.get(ME)!;
  const active = sortedThreads(game);
  const cut = threadsOf(w, ME, false).filter((t) => t.state === 'cut' && t.cutAt !== null);
  return `<div class="gutter stack">
    <header class="page-head">
      <div><h1>红线</h1><p>牵着 ${active.length} 根线 · 你的 OC：${me.openness === 'open' ? '开放' : '专一'}</p></div>
      <button id="toggle-open" class="chip-btn" data-act="openness">改为${me.openness === 'open' ? '专一' : '开放'}</button>
    </header>
    ${active.length ? active.map((t) => threadCard(game, t)).join('') : '<p class="empty">还没有红线。先和一位散修牵线，或者邀请好友。</p>'}
    ${cut.map((t) => cutCard(game, t)).join('')}
    <div class="two">
      <button id="tie-open" class="dashed" data-act="tie-open"><b>＋ 和散修牵线</b><small>随时可牵</small></button>
      <button id="invite" class="dashed" data-act="invite"><b>＋ 邀请好友</b><small>真人线可以结嫡传</small></button>
    </div>
    <p class="hint">多牵一根线，旧线会心力分散；和一根线互动时，其他线会按亲密程度吃醋。</p>
  </div>`;
}

function threadBar(w: World, t: Thread): string {
  const max = w.config.thread.goldenThreshold;
  const mins = w.config.tiers.mins;
  const names = w.config.tiers.names;
  const ticks = mins
    .slice(1, -1)
    .map((m) => `<i style="left:${(m / max) * 100}%"></i>`)
    .join('');
  const labels = names
    .map((n, i) => {
      const pos = i === 0 ? 'left:0' : i === names.length - 1 ? 'right:0' : `left:${((mins[i] ?? 0) / max) * 100}%;transform:translateX(-50%)`;
      return `<span style="${pos}" class="${i === t.tier ? 'on' : ''}">${esc(n)}</span>`;
    })
    .join('');
  return `<div class="bar${t.golden ? ' golden' : ''}" role="img" aria-label="红线浓度 ${fmt(t.strands)}，满 ${max}"><b style="width:${Math.min(100, (t.strands / max) * 100)}%"></b>${ticks}</div>
    <div class="bar-labels" aria-hidden="true">${labels}</div>`;
}

function threadCard(game: Game, t: Thread): string {
  const w = game.world;
  const p = partnerOf(game, t);
  const req = t.pendingRequest;
  const theyAsked = !!req && req.from !== ME;
  const iAsked = !!req && req.from === ME;
  const q = t.quarrel;
  const iMadeUp = !!q && q.reconciled.includes(ME);
  const canSign = p.real && !t.heirId && t.strands >= w.config.heir.strandThreshold && !t.heirSignatures.includes(ME);
  const strain = t.strain[ME] ?? 0;
  const online = game.partnerOnline(t);

  let state = '';
  if (q) state = iMadeUp ? '你已递了台阶，等 TA 回心' : '闹别扭了，TA 变了脸';
  else if (theyAsked) state = '捎来一句话，等你回音';
  else if (iAsked) state = p.real ? '已传话，等 TA 回' : '散修过几个时辰回话';
  else if (strain > 0.5) state = '心力分散中，多陪陪 TA';
  else if (t.heirSignatures.length && !t.heirId) state = `嫡传签署 ${t.heirSignatures.length}/2`;

  const more = ui.more === t.id;
  const confirmCut = ui.confirm?.kind === 'cut' && ui.confirm.id === t.id;
  const confirmBlock = !!p.id && ui.confirm?.kind === 'block' && ui.confirm.id === p.id;

  return `<article class="card thread${q ? ' is-quarrel' : theyAsked ? ' is-waiting' : ''}">
    <div class="thread-top">
      <div class="avatar">${chibi(p.look, partnerMood(w, t), 'class="avatar-svg"', { portrait: true })}</div>
      <div class="thread-info">
        <div class="name-row"><b>${esc(p.name)}</b><span class="tier">${esc(w.config.tiers.names[t.tier] ?? '')}</span><span class="kind">${p.real ? `好友${p.devoted ? ' · 专一' : ''}` : '散修'}</span>${online ? '<span class="online">在线</span>' : ''}</div>
        ${state ? `<span class="state">${esc(state)}</span>` : ''}
      </div>
      <span class="strands num">${fmt(t.strands)}<small>/${w.config.thread.goldenThreshold}</small></span>
    </div>
    ${threadBar(w, t)}
    <div class="three">
      <button id="talk-${t.id}" class="btn ${theyAsked ? 'primary' : ''}" data-act="talk" data-id="${t.id}">${theyAsked ? '回话' : '传话'}</button>
      <button id="risky-${t.id}" class="btn" data-act="risky" data-id="${t.id}"><span>${theyAsked ? '回句玩笑' : '开个玩笑'}</span><small>翻倍 · 有风险</small></button>
      <button id="big-${t.id}" class="btn gold" data-act="big-open" data-id="${t.id}"><span>结伴历练</span><small>押灵石搏一把</small></button>
    </div>
    ${q && !iMadeUp ? `<button id="makeup-${t.id}" class="btn jade wide" data-act="makeup" data-id="${t.id}">和好</button>` : ''}
    ${canSign ? `<button id="sign-${t.id}" class="btn gold wide" data-act="sign" data-id="${t.id}">签署结嫡传（会消耗 ${pct(w.config.heir.consumeRatio)} 浓度）</button>` : ''}
    <div class="more-row">
      ${
        confirmCut
          ? `<button id="cut-yes-${t.id}" class="btn warn" data-act="cut-yes" data-id="${t.id}">确认剪线</button><button id="cancel-${t.id}" class="btn" data-act="cancel">算了</button>`
          : confirmBlock
            ? `<button id="block-yes-${p.id}" class="btn warn" data-act="block-yes" data-id="${p.id}">确认拉黑（不可撤回）</button><button id="cancel-${t.id}" class="btn" data-act="cancel">算了</button>`
            : more
              ? `<button id="cut-${t.id}" class="link" data-act="cut" data-id="${t.id}">剪线</button>${p.id ? `<button id="block-${p.id}" class="link" data-act="block" data-id="${p.id}">拉黑</button>` : ''}<button id="less-${t.id}" class="link" data-act="more" data-id="">收起</button>`
              : `<button id="more-${t.id}" class="link" data-act="more" data-id="${t.id}">更多</button>`
      }
    </div>
  </article>`;
}

function cutCard(game: Game, t: Thread): string {
  const w = game.world;
  const left = w.config.cut.reconcileWindowDays * HOURS_PER_DAY - (w.hour - (t.cutAt ?? w.hour));
  if (left <= 0) return '';
  const p = partnerOf(game, t);
  return `<article class="card thread is-cut">
    <div class="thread-top">
      <div class="avatar">${chibi(p.look, 'sad', 'class="avatar-svg"', { portrait: true })}</div>
      <div class="thread-info"><div class="name-row"><b>${esc(p.name)}</b><span class="kind">已剪线</span></div><span class="state">还剩 ${Math.ceil(left / HOURS_PER_DAY)} 天可以复合</span></div>
      <button id="reunite-${t.id}" class="btn primary" data-act="reunite" data-id="${t.id}">复合</button>
    </div>
  </article>`;
}

// ---------- 家族页 ----------

function familyPanel(game: Game): string {
  const w = game.world;
  const me = w.houses.get(ME)!;
  const injured = me.members.filter((m) => m.injuredUntil > w.hour).length;
  const heirs = [...w.heirs.values()].filter((h) => h.parents.includes(ME));
  const nameOf = (key: string) => (key === ME ? '你' : w.houses.get(key)?.name ?? key);

  const groups = new Map<string, { m: ClanMember; i: number }[]>();
  me.members.forEach((m, i) => {
    const key = m.parents.join('|');
    const list = groups.get(key);
    if (list) list.push({ m, i });
    else groups.set(key, [{ m, i }]);
  });
  const groupHtml = [...groups.entries()]
    .map(([key, list]) => {
      const [a = '', b = ''] = key.split('|');
      const title = b === '收养' ? `收养的孩子 · ${list.length} 位` : `${esc(nameOf(a))}与${esc(nameOf(b))}所结 · ${list.length} 位`;
      return `<div class="group"><span class="group-title">${title}</span>
        <div class="members">${list
          .map(({ m, i }) => {
            const hurt = m.injuredUntil > w.hour;
            return `<div class="member${hurt ? ' hurt' : ''}">${chibi(memberLook(game, m, i), hurt ? 'sad' : 'happy', 'class="member-svg"')}<span class="path">${esc(m.path ?? '')}</span><span class="num">${hurt ? `疗伤 ${Math.ceil((m.injuredUntil - w.hour) / HOURS_PER_DAY)} 天` : `资质 ${fmt(m.root ?? 0)} · 修为 ${fmt(m.cultivation)}`}</span></div>`;
          })
          .join('')}</div></div>`;
    })
    .join('');

  return `<div class="gutter stack">
    <header class="page-head"><div><h1>家族</h1><p>族人 ${me.members.length} 位${injured ? ` · ${injured} 位疗伤中` : ''} · 族人修为越高，大阵越厚</p></div></header>
    ${heirs.map((h) => heirCard(game, h)).join('')}
    <section class="card">
      <h2>族人</h2>
      ${me.members.length ? groupHtml : '<p class="empty">还没有族人。红线越浓，结出族人越快。</p>'}
      ${injured > 0 ? `<button id="act-heal" class="btn wide" data-act="heal" ${me.ghostHearts < w.config.economy.healingPillHearts ? 'disabled' : ''}>炼疗伤丹（${w.config.economy.healingPillHearts} 诡心）· 让一位族人立刻痊愈</button>` : ''}
    </section>
  </div>`;
}

function heirCard(game: Game, h: Heir): string {
  const w = game.world;
  const mine = myLook(game).look;
  const otherId = h.parents[0] === ME ? h.parents[1] : h.parents[0];
  const other = w.houses.get(otherId);
  const otherLook = other?.appearance ?? DEFAULT_LOOK;
  const look: Appearance = { robe: '#FFC24B', trim: otherLook.robe, headdress: 'guan', skin: mine.skin, hair: otherLook.hair, outfit: mine.outfit };
  const home = h.home ? (h.home === ME ? '你家' : `${w.houses.get(h.home)?.name ?? h.home}家`) : null;
  return `<section class="card heir">
    <div class="heir-top">
      ${chibi(look, 'happy', 'class="heir-svg"')}
      <div class="heir-info"><h2>嫡传</h2><span>你与${esc(other?.name ?? otherId)}的结晶</span><span>灵根 <b class="num">${fmt(h.spiritualRoot)}</b> · 出生时锁定</span><span>特质：${esc(h.traitKinds.join('、') || '无')}</span></div>
    </div>
    ${
      home
        ? `<p class="hint">记在${esc(home)}族谱。另一家照样能探望；成年时孩子会再表一次态，看这些年谁陪得多。</p>`
        : `<p>两人商量，记在哪家族谱？</p><div class="two">${h.parents
            .map((p) => `<button id="home-${h.id}-${p}" class="btn ${p === ME ? 'primary' : ''}" data-act="home" data-id="${h.id}" data-v="${p}">记在${p === ME ? '你' : esc(w.houses.get(p)?.name ?? p)}家</button>`)
            .join('')}</div>`
    }
  </section>`;
}

// ---------- 渡劫页 ----------

function tribPanel(game: Game): string {
  const w = game.world;
  const me = w.houses.get(ME)!;
  const need = tribulationRequirement(w, me);
  const progress = Math.min(1, me.cultivationProgress / need);
  const odds = tribulationOdds(w, ME, { usePill: ui.usePill });
  const check = canAttemptTribulation(w, ME);
  const helper = odds.helper ? partnerOf(game, odds.helper) : null;
  const cooling = me.tribulationCooldownUntil > w.hour;
  const perHour = w.config.tribulation.progressPerHour;
  const hoursLeft = Math.max(0, Math.ceil((need - me.cultivationProgress) / perHour));
  const pillCost = w.config.economy.breakthroughPillHearts;

  return `<div class="gutter stack">
    <header class="page-head"><div><h1>渡劫</h1><p>境界 ${me.realm} → ${me.realm + 1} · 打赢大鬼即突破</p></div></header>
    <section class="card">
      <div class="split"><span>修为进度</span><b class="num ${progress >= 1 ? 'ok' : ''}">${fmt(Math.min(me.cultivationProgress, need))} / ${fmt(need)}${progress >= 1 ? ' · 已攒满' : ''}</b></div>
      <div class="bar jade"><b style="width:${progress * 100}%"></b></div>
      ${progress < 1 ? `<p class="hint">打坐还要大约 ${hoursLeft} 个时辰（收灵石时一并结算）。</p>` : ''}
    </section>
    <div class="two">
      ${
        me.breakthroughPills > 0
          ? `<button id="trib-pill" class="option${ui.usePill ? ' on' : ''}" data-act="trib-pill" aria-pressed="${ui.usePill}"><b>${ui.usePill ? '吃破境丹' : '不吃破境丹'}</b><small>+${w.config.tribulation.pillBonus} 胜算 · 还有 ${me.breakthroughPills} 颗</small></button>`
          : `<button id="trib-brew" class="option" data-act="pill" ${me.ghostHearts < pillCost ? 'disabled' : ''}><b>炼破境丹</b><small>${pillCost} 诡心 · 你有 ${me.ghostHearts}</small></button>`
      }
      <div class="option static${helper ? ' on jade' : ''}"><b>${helper ? `护法：${esc(helper.name)}` : '无人护法'}</b><small>${helper ? `红线越浓帮得越多 · +${fmt(odds.helperBonus)}` : '牵了红线的搭档会来护法'}</small></div>
    </div>
    <section class="card deep">
      <div class="split"><span>胜算</span><b class="big-num gold">${pct(odds.chance)}</b></div>
      <p class="hint">我方 ${fmt(odds.power)}（大阵 ${fmt(odds.door)}${helper ? ` · 护法 ${fmt(odds.helperBonus)}` : ''}${odds.usePill ? ` · 丹 ${odds.pillBonus}` : ''}）对 大鬼 ${fmt(odds.strength)}</p>
      <p class="hint">失败按门被砸破处理，${w.config.tribulation.cooldownDays} 天后可再试；修为进度保留，境界不会掉。</p>
    </section>
    <button id="trib-go" class="btn primary huge" data-act="trib-go" ${check.ok ? '' : 'disabled'}>${check.ok ? '渡劫' : cooling ? `冷却中 · 还要 ${Math.ceil((me.tribulationCooldownUntil - w.hour) / HOURS_PER_DAY)} 天` : '修为还没攒满'}</button>
  </div>`;
}

// ---------- 导航、弹字、提示 ----------

function nav(game: Game): string {
  const w = game.world;
  const threads = threadsOf(w, ME);
  const dots: Record<Tab, boolean> = {
    home: pendingStones(w) >= 60,
    threads: threads.some((t) => (t.quarrel && !t.quarrel.reconciled.includes(ME)) || (t.pendingRequest && t.pendingRequest.from !== ME)),
    family: [...w.heirs.values()].some((h) => h.parents.includes(ME) && h.home === null),
    trib: canAttemptTribulation(w, ME).ok,
  };
  const item = (tab: Tab, icon: string, label: string) =>
    `<button id="nav-${tab}" class="nav-item${ui.tab === tab ? ' on' : ''}" data-act="tab" data-v="${tab}" ${ui.tab === tab ? 'aria-current="page"' : ''}>${icon}<span>${label}</span>${dots[tab] ? '<i class="dot"></i>' : ''}</button>`;
  return `${item('home', I.home, '宅院')}${item('threads', I.thread, '红线')}${item('family', I.family, '家族')}${item('trib', I.bolt, '渡劫')}`;
}

function banner(game: Game): string {
  const b = game.currentBanner();
  if (!b) return '';
  return `<div class="pop tone-${b.tone}" data-id="${b.id}"><b>${esc(b.title)}</b>${b.sub ? `<span>${esc(b.sub)}</span>` : ''}</div>`;
}

function toast(game: Game): string {
  const n = game.activeNotice();
  return n ? `<div class="toast-msg tone-${n.tone}">${esc(n.text)}</div>` : '';
}

// ---------- 弹层 ----------

function sheet(game: Game): string {
  const s = ui.sheet;
  if (!s) return '';
  const closable = !(s.type === 'avatar' && s.first);
  const head = (title: string) =>
    `<header class="sheet-head gutter"><h2 id="sheet-title">${esc(title)}</h2>${closable ? `<button id="sheet-close" class="icon-btn" data-act="close-sheet" aria-label="关闭">${I.close}</button>` : ''}</header>`;
  let body = '';
  switch (s.type) {
    case 'avatar':
      body = avatarSheet(game, s.first, head);
      break;
    case 'big':
      body = bigSheet(game, s.threadId, head);
      break;
    case 'pills':
      body = pillsSheet(game, head);
      break;
    case 'retreat':
      body = retreatSheet(game, head);
      break;
    case 'settings':
      body = settingsSheet(game, head);
      break;
    case 'tie':
      body = `${head('和散修牵线')}<div class="sheet-body gutter stack"><form id="tie-form" class="stack">
        <label for="npc-name">给这位散修起个名字</label>
        <input id="npc-name" maxlength="8" placeholder="比如：云游客" autocomplete="off">
        <p class="hint">散修的规则和好友一样，只是长得慢一些，也结不出嫡传。它也会主动找你，不回一样算冷落。</p>
        <button id="tie-go" class="btn primary huge" type="submit">牵线</button>
      </form></div>`;
      break;
    case 'away':
      body = `${head('你不在的时候')}<div class="sheet-body gutter stack">
        <p class="hint">离开了 ${game.awayHours} 个时辰，这期间的事都已结算。离线时由符阵、族人和搭档自动守门，最多输一次。</p>
        ${logList(game.awayReport ?? [], '这段时间风平浪静。')}
        <button id="away-ok" class="btn primary huge" data-act="close-sheet">知道了</button>
      </div>`;
      break;
    case 'log':
      body = `${head('见闻')}<div class="sheet-body gutter stack" id="log-scroll" data-keep-scroll>${logList(game.log.slice(0, 40), '还没有发生什么。')}</div>`;
      break;
  }
  return `<div class="backdrop" ${closable ? 'data-act="close-sheet"' : ''}></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">${body}</section>`;
}

type Head = (title: string) => string;

function logList(entries: { hour: number; text: string; tone: string }[], empty: string): string {
  if (entries.length === 0) return `<p class="empty">${esc(empty)}</p>`;
  return `<ol class="log">${entries.map((l) => `<li class="tone-${l.tone}"><time>${stamp(l.hour)}</time>${esc(l.text)}</li>`).join('')}</ol>`;
}

function avatarSheet(game: Game, first: boolean, head: Head): string {
  const d = ui.draft;
  if (!d) return '';
  const group = (label: string, key: string, items: { id: string; n: string }[], current: string) =>
    `<fieldset><legend>${label}</legend><div class="options">${items
      .map((it) => `<button id="opt-${key}-${it.id}" type="button" class="opt${it.id === current ? ' on' : ''}" data-act="draft" data-id="${key}" data-v="${esc(it.id)}" aria-pressed="${it.id === current}">${esc(it.n)}</button>`)
      .join('')}</div></fieldset>`;
  // 每一项颜色：一排推荐色 + 一个“调色盘”，点开后用色相 / 鲜艳 / 明暗三条滑块随便调
  const swatches = (label: string, key: string, items: Swatch[], current: string) => {
    const custom = !items.some((it) => it.c.toUpperCase() === current.toUpperCase());
    const open = d.picker === key;
    const { h, s, l } = hexToHsl(current);
    const slider = (id: string, name: string, min: number, max: number, value: number, track: string) =>
      `<label class="pick-row"><span>${name}</span><input id="pk-${key}-${id}" type="range" min="${min}" max="${max}" value="${value}" data-pick="${key}" style="--track:${track}" aria-label="${label}${name}"></label>`;
    return `<fieldset><legend>${label}</legend><div class="swatches">${items
      .map((it, i) => `<button id="sw-${key}-${i}" type="button" class="swatch${it.c.toUpperCase() === current.toUpperCase() ? ' on' : ''}" style="--c:${it.c}" data-act="draft" data-id="${key}" data-v="${it.c}" aria-pressed="${it.c === current}" aria-label="${label} ${it.n}"></button>`)
      .join('')}<button id="sw-${key}-custom" type="button" class="swatch custom${custom || open ? ' on' : ''}" style="--c:${current}" data-act="picker" data-id="${key}" aria-expanded="${open}" aria-label="${label}：调色盘"><span></span></button></div>
      ${
        open
          ? `<div class="picker">
          ${slider('h', '色相', 0, 360, h, 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)')}
          ${slider('s', '鲜艳', 0, 100, s, `linear-gradient(90deg,${hslToHex(h, 0, l)},${hslToHex(h, 100, l)})`)}
          ${slider('l', '明暗', 8, 92, l, `linear-gradient(90deg,${hslToHex(h, s, 8)},${hslToHex(h, s, 50)},${hslToHex(h, s, 92)})`)}
        </div>`
          : ''
      }</fieldset>`;
  };
  return `${head(first ? '先捏一个你的 OC' : '设置形象')}
    <div class="sheet-body gutter stack" id="avatar-scroll" data-keep-scroll>
      <div class="avatar-stage">${chibi(d.look, 'happy', 'class="avatar-big"', { label: '形象预览' })}</div>
      <label for="oc-name">名字</label>
      <input id="oc-name" maxlength="8" value="${esc(d.initialName)}" placeholder="1–8 个字" autocomplete="off">
      ${group('性别', 'gender', GENDERS, d.gender)}
      <p class="hint">性别随时可改，和发型、道途都不挂钩。</p>
      ${group('服装', 'outfit', OUTFITS, d.look.outfit ?? 'robe')}
      ${group('发型', 'headdress', HEADDRESSES, d.look.headdress)}
      ${swatches('衣色', 'robe', ROBES, d.look.robe)}
      ${swatches('镶边', 'trim', TRIMS, d.look.trim)}
      ${swatches('肤色', 'skin', SKINS, d.look.skin)}
      ${swatches('发色', 'hair', HAIRS, d.look.hair)}
      ${group('道途（身份标签）', 'role', PATHS.map((r) => ({ id: r, n: r })), d.role)}
      <p class="hint">道途只是标签，不影响任何数值；嫡传会继承双方的道途。</p>
    </div>
    <footer class="sheet-foot gutter"><button id="avatar-save" class="btn primary huge" data-act="avatar-save">${first ? '开始' : '保存'}</button></footer>`;
}

function bigSheet(game: Game, threadId: string, head: Head): string {
  const w = game.world;
  const t = w.threads.get(threadId);
  if (!t) return '';
  const me = w.houses.get(ME)!;
  const p = partnerOf(game, t);
  const b = w.config.big;
  const present = game.partnerOnline(t);
  const chance = bigSuccessChance(w, t, present);
  const affordable = STAKES.filter((s) => s <= me.stones);
  const stake = affordable.includes(ui.stake) ? ui.stake : affordable[affordable.length - 1] ?? 0;
  const gain = stake * b.strandsPerStone * (1 + b.successEdge) * (t.b ? 1 : w.config.npc.investMultiplier);
  const result = game.activeBig(threadId);
  const jealous = threadsOf(w, ME).some((x) => x.id !== threadId && x.tier > 0);
  const { look } = myLook(game);
  return `${head(`和${p.name}结伴历练`)}
    <div class="sheet-body gutter stack">
      <div class="duo${result ? (result.success ? ' win' : ' lose') : ''}">
        ${chibi(look, result ? (result.success ? 'happy' : 'sad') : 'calm', 'class="duo-svg"')}
        ${chibi(p.look, result ? (result.success ? 'happy' : 'sad') : partnerMood(w, t), 'class="duo-svg"')}
        ${result ? `<div class="result ${result.success ? 'ok' : 'bad'}"><b>${result.success ? '满载而归！' : '铩羽而归…'}</b><span>${result.success ? `情丝 +${fmt(result.strands)}` : `折了 ${result.lost} 灵石`}</span></div>` : ''}
      </div>
      <p class="hint">押上灵石当盘缠，一起闯一趟秘境。成了，盘缠全部化成情丝；失手，盘缠随机折损一半到全部，红线不变。</p>
      <fieldset><legend>押多少灵石（手头 ${fmt(me.stones)}）</legend><div class="stakes">${STAKES.map((s) => `<button id="stake-${s}" type="button" class="opt num${s === stake ? ' on' : ''}" data-act="stake" data-v="${s}" aria-pressed="${s === stake}" ${s > me.stones ? 'disabled' : ''}>${s}</button>`).join('')}</div></fieldset>
      <section class="card deep">
        <div class="split"><span>成功率</span><b class="big-num jade">${pct(chance)}</b></div>
        <div class="bar jade"><b style="width:${chance * 100}%"></b></div>
        <p class="hint">基础 ${pct(b.baseSuccess)}${p.real ? (present ? ` · ${esc(p.name)}此刻在线 +${pct(b.coPresenceBonus)}` : ` · ${esc(p.name)}在线时再 +${pct(b.coPresenceBonus)}`) : ''}</p>
        <div class="two">
          <div class="outcome ok"><span>成了</span><b>情丝 +${fmt(gain)}</b></div>
          <div class="outcome bad"><span>失手</span><b>折损 ${Math.round(stake * b.failLossMin)}–${Math.round(stake * b.failLossMax)} 灵石</b></div>
        </div>
      </section>
      ${jealous ? `<p class="hint">你的其他红线会因此吃醋（是平时的 ${w.config.jealousy.bigMultiplier} 倍）。</p>` : ''}
    </div>
    <footer class="sheet-foot gutter"><button id="big-go" class="btn primary huge" data-act="big-go" ${stake > 0 ? '' : 'disabled'}>${stake > 0 ? `出发 · 押 ${stake}` : `灵石不够（至少 ${b.minStake}）`}</button></footer>`;
}

function pillsSheet(game: Game, head: Head): string {
  const w = game.world;
  const me = w.houses.get(ME)!;
  const e = w.config.economy;
  const injured = me.members.filter((m) => m.injuredUntil > w.hour).length;
  return `${head('炼丹')}<div class="sheet-body gutter stack">
    <p class="hint">诡心打野鬼才会掉。你现在有 ${me.ghostHearts} 颗。</p>
    <button id="act-heal" class="option" data-act="heal" ${injured === 0 || me.ghostHearts < e.healingPillHearts ? 'disabled' : ''}><b>疗伤丹 · ${e.healingPillHearts} 诡心</b><small>${injured > 0 ? `让一位疗伤中的族人立刻痊愈（现在有 ${injured} 位）` : '现在没有族人在疗伤'}</small></button>
    <button id="act-pill" class="option" data-act="pill" ${me.ghostHearts < e.breakthroughPillHearts ? 'disabled' : ''}><b>破境丹 · ${e.breakthroughPillHearts} 诡心</b><small>渡劫时 +${w.config.tribulation.pillBonus} 胜算 · 已有 ${me.breakthroughPills} 颗</small></button>
  </div>`;
}

function retreatSheet(game: Game, head: Head): string {
  const w = game.world;
  const me = w.houses.get(ME)!;
  const quota = w.config.retreat.daysPerWindow - me.retreatDaysUsed;
  const retreating = isInRetreat(w, me);
  return `${head('闭关')}<div class="sheet-body gutter stack">
    <p class="hint">忙的时候用。闭关期间红线冻结、不生怨、鬼不登门，族人照常结。本月额度还剩 ${quota} 天。</p>
    ${retreating ? '<p class="empty">你正在闭关。</p>' : ''}
    <div class="two">
      <button id="retreat-1" class="option" data-act="retreat" data-v="1" ${quota < 1 || retreating ? 'disabled' : ''}><b>闭关 1 天</b><small>短暂离开</small></button>
      <button id="retreat-3" class="option" data-act="retreat" data-v="3" ${quota < 3 || retreating ? 'disabled' : ''}><b>闭关 3 天</b><small>考试周、出差</small></button>
    </div>
  </div>`;
}

function settingsSheet(game: Game, head: Head): string {
  const confirming = ui.confirm?.kind === 'newgame';
  return `${head('设置')}<div class="sheet-body gutter stack">
    <fieldset><legend>时间流速</legend><div class="options">${SPEEDS.map((s) => `<button id="speed-${s}" type="button" class="opt${game.speed === s ? ' on' : ''}" data-act="speed" data-v="${s}" aria-pressed="${game.speed === s}">${SPEED_LABEL[s]}</button>`).join('')}</div></fieldset>
    <p class="hint">快进：2 秒一个时辰。极速：0.2 秒一个时辰，用来快速看到各种事件。</p>
    <button id="open-avatar" class="btn wide" data-act="avatar">设置形象</button>
    ${confirming ? `<div class="two"><button id="newgame-yes" class="btn warn" data-act="newgame-yes">确认重开（形象保留）</button><button id="newgame-no" class="btn" data-act="cancel">算了</button></div>` : `<button id="newgame" class="btn wide" data-act="newgame">新开一局</button>`}
    <p class="hint">原型说明：阿青是机器人好友，每天 9、13、21 点上线。把 OC 改成“专一”后，白露偶尔会来抢亲。存档只在这台设备的浏览器里；关掉页面后，下次打开会按离开时的流速补算（最多 14 天）。</p>
  </div>`;
}

// ---------- 点击 ----------

export function bind(game: Game, root: HTMLElement, rerender: () => void): void {
  const keyOf = (el: Element) => [el.getAttribute('data-act'), el.getAttribute('data-id'), el.getAttribute('data-v')].join('|');
  const activate = (el: Element, ev: MouseEvent) => {
    if (el.hasAttribute('disabled')) return;
    if (el.getAttribute('data-act') === 'whack') {
      whack(el, ev);
      return;
    }
    handle(game, el.getAttribute('data-act') ?? '', el.getAttribute('data-id') ?? '', el.getAttribute('data-v') ?? '');
    rerender();
  };

  /*
   * 按下时就记住按的是哪个按钮（按 data-act / data-id / data-v 认，不按元素认）。
   * 松手时只要还在同一个按钮上就算点到，哪怕这期间界面重画、元素被换掉了。
   * 有的浏览器（尤其是 Mac 触控板）在元素被换掉时会把这一下当成选字，click 就丢了。
   */
  let down: { key: string; x: number; y: number } | null = null;
  let handledAt = 0;
  root.addEventListener('pointerdown', (ev) => {
    const el = (ev.target as Element).closest('[data-act]');
    down = el && !el.hasAttribute('disabled') ? { key: keyOf(el), x: ev.clientX, y: ev.clientY } : null;
  });
  root.addEventListener('pointercancel', () => (down = null));
  root.addEventListener('pointerup', (ev) => {
    const start = down;
    down = null;
    if (!start || Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 12) return;
    const el = (ev.target as Element).closest('[data-act]');
    if (!el || keyOf(el) !== start.key) return;
    handledAt = Date.now();
    activate(el, ev);
  });
  // 键盘（回车 / 空格）和读屏软件只会发 click（detail 为 0）；指针刚处理过的那一下（detail ≥ 1）跳过
  root.addEventListener('click', (ev) => {
    const el = (ev.target as Element).closest('[data-act]');
    if (!el) return;
    if (ev.detail > 0 && Date.now() - handledAt < 800) return;
    activate(el, ev);
  });
  root.addEventListener('submit', (ev) => {
    const form = ev.target as HTMLFormElement;
    if (form.id !== 'tie-form') return;
    ev.preventDefault();
    const name = (document.getElementById('npc-name') as HTMLInputElement | null)?.value ?? '';
    if (game.tieNpc(name)) ui.sheet = null;
    rerender();
  });
  root.addEventListener('input', (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.id === 'oc-name' && ui.draft) ui.draft.name = t.value;
    // 调色盘：拖动时只改预览和这一项的色块，不整块重画（重画会打断拖动）；松手后再整块重画
    const key = t.getAttribute('data-pick');
    if (key && ui.draft && (key === 'robe' || key === 'trim' || key === 'skin' || key === 'hair')) {
      const v = (id: string) => Number((document.getElementById(`pk-${key}-${id}`) as HTMLInputElement | null)?.value ?? 0);
      const hex = hslToHex(v('h'), v('s'), v('l'));
      ui.draft.look[key] = hex;
      const stage = document.querySelector('.avatar-stage');
      if (stage) stage.innerHTML = chibi(ui.draft.look, 'happy', 'class="avatar-big"', { label: '形象预览' });
      const sw = document.getElementById(`sw-${key}-custom`) as HTMLElement | null;
      sw?.style.setProperty('--c', hex);
    }
  });
}

/**
 * 在线时戳正在砸门的鬼：有火花和“啪”，纯手感，不改结果（提示语也故意不说“帮忙打”）（砸门的结果由规则决定，见 docs/HANDOFF.md）。
 * 直接改 DOM、不重画，免得把正在播的砸门动画打断。
 */
function whack(el: Element, ev: MouseEvent): void {
  const svg = el.closest('svg.scene-svg') as SVGSVGElement | null;
  if (!svg) return;
  const box = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const x = ((ev.clientX - box.left) / box.width) * vb.width;
  const y = ((ev.clientY - box.top) / box.height) * vb.height;
  const words = ['啪！', '砰！', '去！', '嘿！'];
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('class', 'm-hit');
  g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
  g.innerHTML = `<path d="M0 -18 5 -6 18 -8 8 2 14 14 0 7 -14 14 -8 2 -18 -8 -5 -6Z" fill="#FFC24B"/><text y="-22" text-anchor="middle" font-size="18" fill="#FFFFFF" stroke="#15173A" stroke-width="4" paint-order="stroke" class="display">${words[Math.floor(Math.random() * words.length)]}</text>`;
  svg.appendChild(g);
  el.classList.remove('m-shake');
  void el.getBoundingClientRect();
  el.classList.add('m-shake');
  setTimeout(() => g.remove(), 650);
}

function handle(game: Game, act: string, id: string, v: string): void {
  if (act !== 'cut' && act !== 'block' && act !== 'newgame') ui.confirm = null;
  switch (act) {
    case 'tab':
      ui.tab = v as Tab;
      ui.more = null;
      document.getElementById('main')?.scrollTo(0, 0);
      break;
    case 'close-sheet':
      if (ui.sheet?.type === 'avatar' && ui.sheet.first) break;
      if (ui.sheet?.type === 'away') game.dismissAway();
      ui.sheet = null;
      break;
    case 'avatar':
      openAvatar(game, false);
      break;
    case 'draft':
      if (!ui.draft) break;
      if (id === 'gender') ui.draft.gender = v as Gender;
      else if (id === 'role') ui.draft.role = v;
      else if (id === 'headdress') ui.draft.look.headdress = v as Appearance['headdress'];
      else if (id === 'outfit') ui.draft.look.outfit = v as Appearance['outfit'];
      if (id === 'robe' || id === 'trim' || id === 'skin' || id === 'hair') ui.draft.picker = null;
      else if (id === 'robe' || id === 'trim' || id === 'skin' || id === 'hair') ui.draft.look[id] = v;
      break;
    case 'picker':
      if (ui.draft) ui.draft.picker = ui.draft.picker === id ? null : id;
      break;
    case 'avatar-save': {
      if (!ui.draft) break;
      const name = (document.getElementById('oc-name') as HTMLInputElement | null)?.value ?? ui.draft.name;
      if (game.saveProfile({ name, gender: ui.draft.gender, role: ui.draft.role, look: ui.draft.look })) {
        ui.sheet = null;
        ui.draft = null;
      }
      break;
    }
    case 'settings':
      ui.sheet = { type: 'settings' };
      break;
    case 'log':
      ui.sheet = { type: 'log' };
      break;
    case 'pills':
      ui.sheet = { type: 'pills' };
      break;
    case 'retreat-sheet':
      ui.sheet = { type: 'retreat' };
      break;
    case 'tie-open':
      ui.sheet = { type: 'tie' };
      break;
    case 'big-open':
      ui.sheet = { type: 'big', threadId: id };
      break;
    case 'speed-cycle':
      game.cycleSpeed();
      break;
    case 'speed':
      game.setSpeed(v as Speed);
      break;
    case 'raid-start':
      game.beginRaid();
      break;
    case 'collect':
      game.collect();
      break;
    case 'upgrade':
      game.upgrade();
      break;
    case 'repair':
      game.repair();
      break;
    case 'heal':
      game.healPill();
      break;
    case 'pill':
      game.breakPill();
      break;
    case 'retreat':
      if (game.retreat(Number(v))) ui.sheet = null;
      break;
    case 'openness':
      game.toggleOpenness();
      break;
    case 'invite':
      game.tell('原型里的好友是机器人阿青。正式版会在这里邀请真人好友。');
      break;
    case 'talk':
      game.talk(id, false);
      break;
    case 'risky':
      game.talk(id, true);
      break;
    case 'stake':
      ui.stake = Number(v);
      break;
    case 'big-go': {
      if (ui.sheet?.type !== 'big') break;
      const me = game.world.houses.get(ME)!;
      const affordable = STAKES.filter((s) => s <= me.stones);
      const stake = affordable.includes(ui.stake) ? ui.stake : affordable[affordable.length - 1];
      if (stake) game.big(ui.sheet.threadId, stake);
      break;
    }
    case 'makeup':
      game.makeUp(id);
      break;
    case 'sign':
      game.sign(id);
      break;
    case 'home':
      game.setHome(id, v);
      break;
    case 'reunite':
      game.reunite(id);
      break;
    case 'snatch':
      game.answerSnatch(id, v === '1');
      break;
    case 'more':
      ui.more = id || null;
      break;
    case 'cut':
      ui.confirm = { kind: 'cut', id };
      break;
    case 'cut-yes':
      game.cut(id);
      ui.more = null;
      break;
    case 'block':
      ui.confirm = { kind: 'block', id };
      break;
    case 'block-yes':
      game.block(id);
      ui.more = null;
      break;
    case 'trib-pill':
      ui.usePill = !ui.usePill;
      break;
    case 'trib-go':
      game.tribulation(ui.usePill);
      break;
    case 'newgame':
      ui.confirm = { kind: 'newgame', id: '' };
      break;
    case 'newgame-yes':
      game.newGame();
      ui.tab = 'home';
      ui.sheet = null;
      break;
    default:
      break;
  }
}
