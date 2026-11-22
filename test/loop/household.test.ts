import { describe, expect, it } from 'vitest';
import { addLifePortrait, finishLife, fromView, migrateSave, nextLifeView, toView } from '../../src/core/loop/household';

const today = '2026-11-22';
const jade = { n: '古玉', v: 90 };
const pearl = { n: '夜明珠', v: 140 };
const portrait = { name: '林青', look: { eyes: 'round' }, note: '第 2 世的你' };
const legacy = {
  v: 3, lifeNo: 2, fam: '林家', name: '林青', phase: 'home', day: 3, money: 83, held: 2,
  store: { 柴: 8, 草药: 1 }, door: 2, traps: { crossbow: 2, lamp: 1, talisman: 1 },
  treasures: [jade], ancestors: [{ name: '林大娘', note: '祖上' }], kids: [],
  bankedDays: 1, lastGrantDate: today, unlimitedDays: true, look: { eyes: 'round' }, expression: 'smug',
  guideOff: true, guideSeen: ['要天黑了'], allFeatures: true, history: [{ life: 1, fam: '陈家' }],
  guideSoldDay: 3, river: { visited: true, p: { x: 52, y: 70 }, stone: 'yard', yardSlot: 2,
    hints: { entry: true }, textOn: true, record: { events: ['搬回青纹石'] } },
};
const newborn = { fam: '林家', day: 1, phase: 'birth', money: 32, store: { 草药: 2 },
  parents: [{ name: '第三郎' }], ancestors: [{ name: '林太婆' }], kids: [] };
const migrated = () => migrateSave(legacy, today)!;

describe('v4 存档与家庭投胎', () => {
  it('从头再来后，即使又走到相同的世数、日期与夜号，也不会认作旧标签守的那一户', () => {
    const start = (worldId: string) => toView(fromView({ ...legacy, worldId, lifeNo: 1 }));
    const a = start('first'), b = start('second');
    expect(a.houseId).not.toBe(b.houseId);
    const heirA = nextLifeView(newborn, a, false), heirB = nextLifeView(newborn, b, false);
    expect(heirA.houseId).not.toBe(heirB.houseId);
    expect(heirA.lifeId).not.toBe(heirB.lifeId);
  });
  it('v2 将余额与仓货归家，缺失的日历字段用迁移当日补齐，重复迁移不变', () => {
    const v2 = { ...legacy, v: 2, bankedDays: undefined, lastGrantDate: '坏日期', unlimitedDays: undefined };
    const save = migrateSave(v2, today)!;
    expect(migrateSave(save, '2026-12-01')).toEqual(save);
    expect(save.account).toMatchObject({ bankedDays: 3, lastGrantDate: today, unlimitedDays: false, nightId: 0 });
    expect(save.person).toMatchObject({ purse: 0, goods: {}, personalTreasures: [], held: 2, guideSoldDay: 3 });
    expect(save.houses[save.person.houseId]).toMatchObject({ chest: 83, store: legacy.store, door: 2,
      traps: legacy.traps, treasures: [jade], ancestors: legacy.ancestors, yard: { stone: 'yard', yardSlot: 2 } });
    expect(save.person.river).toEqual({ visited: true, p: legacy.river.p });
    expect(save.account.riverGuide).toEqual({ hints: legacy.river.hints, textOn: true, record: legacy.river.record });
    for (const key of ['money', 'chest', 'store', 'treasures', 'look', 'traps', 'ancestors'])
      expect(save.person).not.toHaveProperty(key);
    expect(toView(save).river).toEqual(legacy.river);
    expect(fromView(toView(save))).toEqual(save);
  });

  it('v3 的已结算战报编入原家，不补扣、不退款；确认后仍有历史', () => {
    const oldReceipt = { paragraphs: ['门破了，剩下 83 文'], won: false, next: 'morning' };
    const save = migrateSave({ ...legacy, phase: 'dawn', nightReceipt: oldReceipt }, today)!;
    expect(migrateSave(save, today)).toEqual(save);
    const view = toView(save);
    const id = view.nightId;
    expect(id).toBe(1);
    expect(view.nightReceipt).toMatchObject({ ...oldReceipt, houseId: view.houseId, lifeId: view.lifeId, nightId: id });
    expect(view.chest).toBe(83);
    expect(view.nightReceipt).toEqual(view.receipts[id]);
    view.nightReceipt = null;
    const reloaded = toView(fromView(view));
    expect(reloaded.nightReceipt).toBeNull();
    expect(reloaded.receipts[id]).toEqual(view.receipts[id]);
    expect(reloaded.chest).toBe(83);
  });

  it('旧奈何桥修复原家画像和自家卡片；同姓的别家候选仍是原报价', () => {
    const candidate = { own: true, name: '林家', money: 10, door: 0, ancestors: [...legacy.ancestors, portrait],
      parents: [{ name: '小郎' }], thread: '倾心' };
    const other = { name: '林家', money: 19, door: 0, treasures: [], thread: '相识' };
    const old = { ...legacy, phase: 'reborn', deathKind: 'old', reborn: { fams: [candidate, other], total: 60 } };
    const save = migrateSave(old, today)!;
    expect(migrateSave(save, today)).toEqual(save);
    const view = toView(save);
    expect(view.ancestors).toEqual([...legacy.ancestors, { ...portrait, lifeId: view.lifeId }]);
    expect(save.person.reborn).toEqual({ total: 60, fams: [
      { houseId: view.houseId, own: true, parents: candidate.parents, thread: '倾心' }, other] });
    expect(view.reborn).toMatchObject({ fams: [{ name: '林家', money: 83, store: legacy.store, door: 2 }, other] });
    expect(old.reborn.fams[0]).toEqual(candidate);
    expect(fromView(view)).toEqual(save);
  });

  it('早逝旧档中已经挂过的本人画像补上身份，每次读档都只留一幅', () => {
    const old = { ...legacy, phase: 'reborn', deathKind: 'early', ancestors: [...legacy.ancestors, portrait] };
    const save = migrateSave(old, today)!;
    const view = toView(save);
    addLifePortrait(view, portrait);
    expect(view.ancestors).toEqual([...legacy.ancestors, { ...portrait, lifeId: view.lifeId }]);
    expect(migrateSave(save, today)).toEqual(save);
  });

  it('老死把钱袋、个人货宝和随身背包都留在家，重复入账和同名误认都不会发生', () => {
    const view = toView(migrated());
    view.ancestors.push({ ...portrait, lifeId: 'life-1' });
    view.purse = 12;
    view.goods = { 柴: 7 };
    view.personalTreasures = [pearl];
    view.bag = [{ n: '铁矿' }, { ...jade, tre: true }];
    finishLife(view, portrait);
    const saved = fromView(view);
    finishLife(view, portrait);
    expect(fromView(view)).toEqual(saved);
    expect(view).toMatchObject({ chest: 95, store: { 柴: 15, 草药: 1, 铁矿: 1 },
      treasures: [jade, pearl, jade], purse: 0, goods: {}, personalTreasures: [], bag: [] });
    expect(view.ancestors.filter(p => p.name === '林青').map(p => p.lifeId)).toEqual(['life-1', 'life-2']);
  });

  it('禁地早逝时已经带回院里的钱和货留给原家，掉在野外的背包不会入仓', () => {
    const view = toView(migrated());
    Object.assign(view, { deathKind: 'early', purse: 9, goods: { 柴: 2 },
      personalTreasures: [pearl], bag: [{ n: '铁矿' }] });
    finishLife(view, portrait);
    const next = nextLifeView(newborn, view, false);
    expect(fromView(next).houses[view.houseId]).toMatchObject({
      chest: 92, store: { 柴: 10, 草药: 1 }, treasures: [jade, pearl],
    });
    expect(view.store.铁矿).toBeUndefined();
    expect(next.purse).toBe(0);
  });

  it('第二位后人成为父母，继承同一户的宝物和院石，新人从空钱袋起步', () => {
    const view = toView(migrated());
    view.kids = [{ name: '长子' }, { name: '次女' }];
    finishLife(view, portrait);
    view.nightId = 7;
    view.receipts[7] = { houseId: view.houseId, lifeId: view.lifeId, nightId: 7, won: false };
    const newbornView = nextLifeView({ ...newborn, parents: [{ name: '次女' }] }, view, true);
    expect(newbornView).toMatchObject({ houseId: view.houseId, lifeId: 'life-3', parents: [{ name: '次女' }],
      purse: 0, goods: {}, personalTreasures: [], chest: view.chest, store: view.store,
      treasures: [jade], ancestors: view.ancestors, door: 2, traps: view.traps,
      river: { stone: 'yard', yardSlot: 2 }, nightId: 7, receipts: view.receipts, nightReceipt: null,
      bankedDays: 1, lastGrantDate: today, guideSeen: legacy.guideSeen, history: legacy.history, look: legacy.look });
    expect(newbornView.guideSoldDay).toBeUndefined();
    expect(Object.keys(fromView(newbornView).houses)).toEqual([view.houseId]);
  });

  it.each([true, false])('投同姓别家仍保留原户，按是否有后人决定荒置（有后人 %s）', heirs => {
    const view = toView(migrated());
    view.kids = heirs ? [{ name: '长子' }] : [];
    finishLife(view, portrait);
    const oldHouse = fromView(view).houses[view.houseId]!;
    const next = nextLifeView(newborn, view, false, pearl);
    expect(next.houseId).not.toBe(view.houseId);
    expect(next).toMatchObject({ fam: '林家', chest: 32, store: { 草药: 2 }, treasures: [],
      purse: 30, personalTreasures: [pearl], ancestors: newborn.ancestors });
    expect(next.river?.stone).toBeUndefined();
    const saved = fromView({ ...next, look: { eyes: 'smile' } });
    expect(saved.houses[view.houseId]).toEqual({ ...oldHouse, abandoned: !heirs });
    expect(Object.keys(saved.houses)).toHaveLength(2);
    expect(fromView(toView(migrateSave(saved, today)!))).toEqual(saved);
    const third = nextLifeView(newborn, toView(saved), false);
    expect(Object.keys(fromView(third).houses)).toHaveLength(3);
    expect(fromView(third).houses[view.houseId]).toEqual(saved.houses[view.houseId]);
  });

  it.each(['early', 'old'])('护家神死后捡的纸钱留在原家（%s）', kind => {
    const view = toView(migrated());
    view.deathKind = kind;
    view.purse = 10;
    finishLife(view, portrait);
    const before = view.chest;
    view.purse += 7;
    view.nightId = 2;
    view.receipts[1] = { lifeId: 'life-1', guardian: true, won: true, earnedMoney: 100 };
    view.receipts[2] = { lifeId: view.lifeId, guardian: true, won: true, earnedMoney: 7 };
    const next = nextLifeView(newborn, view, false);
    expect(fromView(next).houses[view.houseId]!.chest).toBe(before + 7);
    expect(next).toMatchObject({ purse: 0, chest: 32, nightId: 2, receipts: {} });
  });
});
