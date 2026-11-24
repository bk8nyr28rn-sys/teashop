import { payHome, quoteHome } from './economy';

// 第五阶段：把钱花回家里。扩院子（多一口灶、多几个摆东西的位置）、装饰（只给面子，不加战力）、匾额。
// 都是家里的东西：先用钱箱，不够再用钱袋；跟着家走，下一世回自家还在。
export const YARD = {
  levels: [
    { name: '小院', cost: 0, stoves: 1, slots: 3 },
    { name: '中院', cost: 120, stoves: 2, slots: 5 },
    { name: '大宅', cost: 300, stoves: 3, slots: 7 },
  ],
  decor: {
    pot: { name: '盆栽', cost: 10, note: '一盆小松' },
    vat: { name: '水缸', cost: 15, note: '养着两尾鱼' },
    table: { name: '石桌石凳', cost: 25, note: '夏天能在院里吃饭' },
    tree: { name: '桂花树', cost: 40, note: '会开花，满院香' },
  },
  /** 匾额挂在门楣上，写着家名，不占院里的位置 */
  plaque: { name: '匾额', cost: 60, note: '门楣上挂着家名' },
} as const;

export type DecorKind = keyof typeof YARD.decor;
export interface YardHouse {
  chest: number;
  yardLevel?: number;
  decor?: (DecorKind | null)[];
  plaque?: boolean;
}
type Purse = { purse: number };

export function yardLevel(h: Pick<YardHouse, 'yardLevel'>): number {
  const level = h.yardLevel ?? 0;
  return Number.isInteger(level) && level >= 0 && level < YARD.levels.length ? level : 0;
}
export function yardInfo(h: Pick<YardHouse, 'yardLevel'>) {
  return YARD.levels[yardLevel(h)]!;
}
export function stoveCount(h: Pick<YardHouse, 'yardLevel'>): number {
  return yardInfo(h).stoves;
}

/** 摆东西的位置，长度跟着院子等级走；没摆的是 null */
export function decorSlots(h: YardHouse): (DecorKind | null)[] {
  const n = yardInfo(h).slots;
  const slots = (h.decor ?? []).slice(0, n).map(k => (k && k in YARD.decor ? k : null));
  while (slots.length < n) slots.push(null);
  return slots;
}
export function decorCount(h: YardHouse): number {
  return decorSlots(h).filter(Boolean).length + (h.plaque ? 1 : 0);
}

/** 下一级院子的价钱；已经是大宅返回 null */
export function nextYard(h: YardHouse) {
  return YARD.levels[yardLevel(h) + 1] ?? null;
}
export function quoteYard(h: YardHouse, person: Purse) {
  const next = nextYard(h);
  return next ? quoteHome(h, person, next.cost) : null;
}

/** 扩院子：一级一级扩，钱箱先付 */
export function expandYard(h: YardHouse, person: Purse) {
  const next = nextYard(h);
  if (!next) return null;
  const payment = payHome(h, person, next.cost);
  if (!payment) return null;
  h.yardLevel = yardLevel(h) + 1;
  h.decor = decorSlots(h);
  return payment;
}

/** 买一件装饰摆在空位上；不指定位置就摆在第一个空位。位置满了买不了 */
export function buyDecor(h: YardHouse, person: Purse, kind: DecorKind, slot?: number) {
  const item = YARD.decor[kind];
  if (!item) return null;
  const slots = decorSlots(h);
  const at = slot ?? slots.indexOf(null);
  if (!Number.isInteger(at) || at < 0 || at >= slots.length || slots[at] !== null) return null;
  const payment = payHome(h, person, item.cost);
  if (!payment) return null;
  slots[at] = kind;
  h.decor = slots;
  return { payment, slot: at };
}

/** 挪位置：挪到空位，或者和那个位置上的东西对调 */
export function moveDecor(h: YardHouse, from: number, to: number): boolean {
  const slots = decorSlots(h);
  if (from === to || !slots[from] || to < 0 || to >= slots.length) return false;
  [slots[from], slots[to]] = [slots[to]!, slots[from]!];
  h.decor = slots;
  return true;
}

/** 拿掉一件（不退钱），空出位置 */
export function removeDecor(h: YardHouse, slot: number): DecorKind | null {
  const slots = decorSlots(h);
  const kind = slots[slot] ?? null;
  if (!kind) return null;
  slots[slot] = null;
  h.decor = slots;
  return kind;
}

export function buyPlaque(h: YardHouse, person: Purse) {
  if (h.plaque) return null;
  const payment = payHome(h, person, YARD.plaque.cost);
  if (!payment) return null;
  h.plaque = true;
  return payment;
}
