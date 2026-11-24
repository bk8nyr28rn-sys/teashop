import { describe, expect, it } from 'vitest';
import { canGift, giveGift, FAMILY } from '../../src/core/loop/family';
import { fromView, nextLifeView, toView } from '../../src/core/loop/household';
import {
  YARD, buyDecor, buyPlaque, decorCount, decorSlots, expandYard, moveDecor, nextYard, removeDecor, stoveCount, yardInfo,
  type YardHouse,
} from '../../src/core/loop/home';
import { canCook, collectStove, freeStove, startStove, stoveJobs } from '../../src/core/loop/trade';

const LIFE = 'w/life-1';
const home = (o: Partial<YardHouse> = {}) => ({ chest: 0, store: {} as Record<string, number>, treasures: [], ...o });

describe('扩院子', () => {
  it('小院 → 中院 → 大宅，一级一级扩；先扣钱箱再扣钱袋；钱不够不行；大宅以后不能再扩', () => {
    const h = home({ chest: 100 }), p = { purse: 50 };
    expect([yardInfo(h).name, stoveCount(h), decorSlots(h).length]).toEqual(['小院', 1, 3]);
    expect(expandYard(h, p)).toEqual({ chest: 100, purse: 20, shortfall: 0 });
    expect([yardInfo(h).name, stoveCount(h), decorSlots(h).length]).toEqual(['中院', 2, 5]);
    expect(expandYard(h, p)).toBeNull();
    expect([h.chest, p.purse, h.yardLevel]).toEqual([0, 30, 1]);
    h.chest = 300;
    expect(expandYard(h, p)).not.toBeNull();
    expect([yardInfo(h).name, stoveCount(h), decorSlots(h).length, nextYard(h)]).toEqual(['大宅', 3, 7, null]);
    h.chest = 999;
    expect(expandYard(h, p)).toBeNull();
  });
});

describe('装饰', () => {
  it('买了摆在第一个空位，也能指定位置；位置满了买不了；钱箱先付', () => {
    const h = home({ chest: 30 }), p = { purse: 100 };
    expect(buyDecor(h, p, 'pot')).toMatchObject({ slot: 0, payment: { chest: 10, purse: 0 } });
    expect(buyDecor(h, p, 'tree', 2)).toMatchObject({ slot: 2, payment: { chest: 20, purse: 20 } });
    expect(buyDecor(h, p, 'vat', 2)).toBeNull();
    expect(buyDecor(h, p, 'vat')).toMatchObject({ slot: 1 });
    expect(decorSlots(h)).toEqual(['pot', 'vat', 'tree']);
    const purse = p.purse;
    expect(buyDecor(h, p, 'table')).toBeNull();
    expect(p.purse).toBe(purse);
  });

  it('挪到空位或者和别的对调；拿掉不退钱，空出位置；扩院子以后原来的摆设还在', () => {
    const h = home({ chest: 999 }), p = { purse: 0 };
    buyDecor(h, p, 'pot'); buyDecor(h, p, 'tree');
    expect(moveDecor(h, 0, 1)).toBe(true);
    expect(decorSlots(h)).toEqual(['tree', 'pot', null]);
    expect(moveDecor(h, 2, 0)).toBe(false);
    expect(moveDecor(h, 0, 2)).toBe(true);
    expect(decorSlots(h)).toEqual([null, 'pot', 'tree']);
    const chest = h.chest;
    expect(removeDecor(h, 1)).toBe('pot');
    expect(h.chest).toBe(chest);
    expect(decorSlots(h)).toEqual([null, null, 'tree']);
    expandYard(h, p);
    expect(decorSlots(h)).toEqual([null, null, 'tree', null, null]);
  });

  it('匾额只买一次，不占院里的位置；只给面子，不改战力相关的任何东西', () => {
    const h = home({ chest: 60 }), p = { purse: 0 };
    expect(buyPlaque(h, p)).not.toBeNull();
    expect(buyPlaque(h, p)).toBeNull();
    expect([h.plaque, decorSlots(h).filter(Boolean).length, decorCount(h)]).toEqual([true, 0, 1]);
    expect(Object.keys(YARD.decor)).toEqual(['pot', 'vat', 'table', 'tree']);
  });
});

describe('几口灶', () => {
  it('中院能同时烧两锅；每口灶各自过一夜好、各自取', () => {
    const h = { ...home({ chest: 999 }) }, p = { purse: 0, goods: { 柴: 6, 草药: 2 } as Record<string, number> };
    expect(startStove(h, p, 'charcoal', 'person', { lifeId: LIFE, day: 3 })).not.toBeNull();
    expect(canCook(h, p, 'salve', 'person')).toBe(false);
    expandYard(h, p);
    expect(freeStove(h)).toBe(1);
    expect(startStove(h, p, 'salve', 'person', { lifeId: LIFE, day: 3 })).toMatchObject({ jobId: LIFE + '/d3/s1' });
    expect(stoveJobs(h).map(j => j?.recipe)).toEqual(['charcoal', 'salve']);
    expect(collectStove(h, p, { lifeId: LIFE, day: 4 }, 1)).toMatchObject({ kind: '金疮药', index: 1 });
    expect(collectStove(h, p, { lifeId: LIFE, day: 4 })).toMatchObject({ kind: '木炭', index: 0 });
    expect(stoveJobs(h)).toEqual([null, null]);
  });

  it('第四阶段的旧存档（只有 stove 一项）读进来变成第一口灶', () => {
    const job = { jobId: 'x', recipe: 'charcoal' as const, owner: 'person' as const, lifeId: LIFE, day: 3 };
    const view = toView(fromView({ fam: '林家', lifeNo: 1, lastGrantDate: '2026-11-24', day: 3, chest: 0, purse: 0,
      goods: {}, store: {}, treasures: [], personalTreasures: [], bag: [], stove: job }));
    expect(view.stoves).toEqual([job]);
    expect('stove' in fromView(view).houses[view.houseId]!).toBe(false);
  });
});

describe('给伴侣买礼物', () => {
  it('只用钱袋，一天一次，红线 +8，最多 100；没有伴侣不能送', () => {
    const s = { day: 4, time: 360, love: 30, spouse: { name: '甲' }, kids: [], held: 0, purse: 45, chest: 999, giftDay: null as number | null };
    expect(giveGift(s)).toBe(true);
    expect([s.love, s.purse, s.chest, s.giftDay]).toEqual([30 + FAMILY.gift.love, 25, 999, 4]);
    expect(giveGift(s)).toBe(false);
    s.day = 5; s.love = 96;
    expect(giveGift(s)).toBe(true);
    expect([s.love, s.purse]).toEqual([100, 5]);
    s.day = 6;
    expect(canGift(s)).toBe(false);
    expect(canGift({ ...s, purse: 50, spouse: null })).toBe(false);
  });
});

describe('跟着家走', () => {
  it('院子等级、摆设、匾额、几口灶都存在家里；回自家投胎都在，候选卡写着摆了几件', () => {
    const view = toView(fromView({ fam: '林家', lifeNo: 1, lastGrantDate: '2026-11-24', day: 5, chest: 500, purse: 0,
      goods: {}, store: {}, treasures: [], personalTreasures: [], bag: [], kids: [{ kind: '徒', grade: '寻常', power: 1 }],
      deathKind: 'old', name: '林一' }));
    expandYard(view, view); buyDecor(view, view, 'tree'); buyDecor(view, view, 'pot', 3); buyPlaque(view, view);
    const saved = fromView(view);
    expect(saved.houses[view.houseId]).toMatchObject({ yardLevel: 1, decor: ['tree', null, null, 'pot', null], plaque: true });
    expect('decor' in saved.person).toBe(false);
    const next = nextLifeView({ fam: '林家', thread: '知己', lastGrantDate: '2026-11-24', day: 1, chest: 0, purse: 0,
      goods: {}, store: {}, treasures: [], personalTreasures: [], bag: [] }, toView(saved), true);
    expect([next.yardLevel, next.decor, next.plaque]).toEqual([1, ['tree', null, null, 'pot', null], true]);
    const card = { own: true, houseId: view.houseId } as Record<string, unknown>;
    const withCard = toView(fromView({ ...view, reborn: { fams: [card] } }));
    expect((withCard.reborn as { fams: Record<string, unknown>[] }).fams[0]).toMatchObject({ yardLevel: 1, decorCount: 3 });
  });
});
