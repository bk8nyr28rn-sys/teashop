import { describe, expect, it, vi } from 'vitest';
import { getAbsenceSummary, markAbsenceRead, markActiveDate, reconcileAbsence } from '../../src/core/loop/absence';
import { nightKarma, settleAutoNight } from '../../src/core/loop/auto-defense';
import { fromView, migrateSave, nextLifeView, toView } from '../../src/core/loop/household';
import { beginNightLedger, settleNightLedger, type NightReceipt } from '../../src/core/loop/settlement';
import { makeHouse, makePerson } from '../../src/core/loop/state';
import { accrueDays, startDay } from '../../src/core/loop/time';

const start = '2026-11-20';
const win = 7, lose = 2;
function game(phase = 'dawn', lifeNo = 2) {
  return {
    ...makeHouse(), ...makePerson(), lifeNo, houseId: 'h', lifeId: 'life-' + lifeNo, day: 3,
    chest: 126, purse: 31, treasures: [{ n: '古玉', v: 90 }], hp: 2, phase, at: 'home',
    held: 0, broken: 0, kills: 0, afterlife: null, nightPlan: null, nightReceipt: null, nightId: 0,
    receipts: {} as Record<string, NightReceipt>,
    lastActiveDate: start, lastGrantDate: start, bankedDays: 1, unlimitedDays: false,
  };
}

describe('现实日来袭、游戏夜和攒天', () => {
  it.each([[1, '2026-11-21'], [3, '2026-11-23'], [10, '2026-11-30']] as const)(
    '现实日相差 %i 天，逐夜记账，整个离开期间最多损失一次', (days, today) => {
      const g = game();
      const money = g.chest;
      expect(reconcileAbsence(g, today, () => lose)).toEqual({ count: days, changed: true });
      expect(g).toMatchObject({ day: 3, phase: 'dawn', hp: 2, purse: 31, chest: money - 12,
        treasures: [{ n: '古玉', v: 90 }], bankedDays: 1, lastGrantDate: start,
        held: 0, broken: 0, autoBroken: days, nightReceipt: null, nightId: days });
      expect(getAbsenceSummary(g)).toMatchObject({ days, raids: days, won: 0, broken: days, chestLost: 12, earnedMoney: 0 });
      expect(reconcileAbsence(g, today, () => win)).toEqual({ count: 0, changed: false });
      expect(g.chest).toBe(money - 12);
    });

  it('整段采用同一笔损失额度，保留已守的半份因果和家业上限', () => {
    const g = game('home');
    const draw = vi.fn((_: string, id: number) => id % 2 ? win : lose);
    reconcileAbsence(g, '2026-11-30', draw);
    expect(g).toMatchObject({ phase: 'dawn', day: 3, hp: 2, bankedDays: 1, chest: 114,
      held: 5, autoHeld: 5, autoBroken: 5, broken: 0, nightReceipt: { nightId: 1, won: true } });
    expect(getAbsenceSummary(g)).toMatchObject({ days: 10, won: 5, broken: 5, chestLost: 12, earnedMoney: 0 });
    expect(g.purse).toBe(31);
    expect(nightKarma(1, 1, 0)).toBe(nightKarma(1, 0, 0) / 2);
    expect(nightKarma(5, 5, 0, 100)).toBe(20);
    expect(draw.mock.calls[0]).toEqual([start, 1]);
    expect(draw.mock.calls[9]).toEqual(['2026-11-29', 10]);
    // 玩家手动确认原来的清晨，才正常补天并进入第 4 天。
    expect(startDay(g, g, '2026-11-30', 'next')).toBe(true);
    expect(g).toMatchObject({ day: 4, bankedDays: 2, hp: 3 });
  });

  it('整段第一世保护；第二世重新离开时另有一次损失额度', () => {
    const first = game('home', 1);
    reconcileAbsence(first, '2026-11-30', () => lose);
    expect(first).toMatchObject({ chest: 126, autoBroken: 10, broken: 0 });
    expect(first.nightReceipt).toMatchObject({ won: false, chestLost: 0 });
    const second = game();
    reconcileAbsence(second, '2026-11-23', () => lose);
    reconcileAbsence(second, '2026-11-25', () => lose);
    expect(second).toMatchObject({ chest: 103, autoBroken: 5, broken: 0 });
  });

  it('同日保持战斗；隔日用原夜的夜号、种子交接一次，后续纯来袭不挤掉待看回执', () => {
    const g = game('home');
    const plan = beginNightLedger(g, false, win)!;
    const snapshot = structuredClone(g);
    reconcileAbsence(g, start, () => win);
    expect(g).toEqual(snapshot);
    const draw = vi.fn(() => lose);
    reconcileAbsence(g, '2026-11-23', draw);
    expect(draw).toHaveBeenCalledTimes(2);
    expect(g).toMatchObject({ nightId: 3, nightPlan: null, day: 3, phase: 'dawn', bankedDays: 1,
      purse: 31, held: 1, autoHeld: 1, autoBroken: 2,
      nightReceipt: { nightId: plan.nightId, seed: plan.seed, realDate: start, mode: 'offline', won: true, earnedMoney: 0 } });
    const settled = structuredClone(g);
    reconcileAbsence(g, '2026-11-22', draw);
    reconcileAbsence(g, '2026-11-23', draw);
    expect(g).toEqual(settled);
  });

  it('已结算的亲手守夜，原待看回执和生命进度保留；回访只记新的家宅来袭', () => {
    const g = game('home');
    const plan = beginNightLedger(g, false, win)!;
    const manual = settleNightLedger(g, plan, { won: true, kills: 3, coins: 9 }, () => ['亲手守住'])!;
    reconcileAbsence(g, '2026-11-23', () => lose);
    expect(g.nightReceipt).toEqual(manual);
    expect(g.receipts[1]).toEqual(manual);
    expect(g).toMatchObject({ nightId: 4, held: 1, broken: 0, kills: 3, purse: 40, bankedDays: 1, day: 3 });
    expect(getAbsenceSummary(g)).toMatchObject({ raids: 3, won: 0, firstNightId: 2, lastNightId: 4 });
  });

  it.each(['map', 'river'])('在 %s 当天回来照旧；跨日安全归家，个人物品仍归本人', phase => {
    const g = { ...game(phase), at: 2, buddy: 'wang', target: 4,
      bag: [{ n: '兽皮' }, { n: '古玉', v: 90, tre: true as const }],
      river: { hand: 'wood0', wood: ['hand'], helper: true, focus: 'wood0', fromWharf: phase === 'map' } };
    const sameDay = structuredClone(g);
    reconcileAbsence(g, start, lose);
    expect(g).toEqual(sameDay);
    reconcileAbsence(g, '2026-11-21', lose);
    expect(g).toMatchObject({ phase: 'dawn', at: 'home', buddy: null, target: null,
      bag: [], goods: { 兽皮: 1 }, personalTreasures: [{ n: '古玉', v: 90 }], hp: 2, bankedDays: 1 });
    if (phase === 'river') {
      expect(g.goods.柴).toBe(7);
      expect(g.river).toMatchObject({ hand: null, wood: ['firewood'], helper: false, focus: null });
    }
  });

  it('拿着青纹石时隔夜，院石到院子后仍能跨存档保留', () => {
    const g = { ...game('river'), river: { hand: 'stone', stone: 'hand' } };
    reconcileAbsence(g, '2026-11-21', lose);
    expect(fromView(g).houses.h?.yard).toEqual({ stone: 'yard', yardSlot: 1 });
    expect(toView(fromView(g)).river).toMatchObject({ hand: null, stone: 'yard' });
  });

  it.each(['birth', 'death', 'haunt', 'reborn'])('在 %s 纯家宅来袭，已展示的家庭和人生相位保持原状', phase => {
    const choices = { rows: [['家业', 10]], total: 10, fams: [{ name: '程家', money: 20 }] };
    const g = { ...game(phase), reborn: structuredClone(choices) };
    reconcileAbsence(g, '2026-11-23', () => lose);
    expect(g).toMatchObject({ phase, reborn: choices, chest: 114, held: 0, day: 3, bankedDays: 1, nightReceipt: null });
    expect(getAbsenceSummary(g)).toMatchObject({ raids: 3 });
  });

  it('护家神已在守夜时接回投胎；寿数最后一天交接后仍按原次序天亮', () => {
    const guardian = game('death');
    const plan = beginNightLedger(guardian, true, win)!;
    reconcileAbsence(guardian, '2026-11-23', () => lose);
    expect(guardian).toMatchObject({ phase: 'dawn', nightId: 3,
      nightReceipt: { nightId: plan.nightId, guardian: true, next: 'reborn', won: true } });
    const last = { ...game('home'), day: 5 };
    reconcileAbsence(last, '2026-11-21', lose);
    expect(last.nightReceipt).toMatchObject({ next: 'old' });
  });

  it('尚未开玩的首世和没有活动日期的迁移档从本次建立基线', () => {
    const intro = game('intro', 1);
    expect(reconcileAbsence(intro, '2026-12-01', lose)).toEqual({ count: 0, changed: true });
    const legacy = { ...game('home'), v: 3, lastActiveDate: undefined, money: 126 };
    const migrated = toView(migrateSave(legacy, start)!);
    expect(reconcileAbsence(migrated, '2026-12-01', lose)).toEqual({ count: 0, changed: true });
    expect(fromView(migrated).account.lastActiveDate).toBe('2026-12-01');
    expect(reconcileAbsence(migrated, '2026-12-02', lose).count).toBe(1);
  });

  it('持续在线跨午夜只记上线日期；闰日、跨年、倒拨不重复来袭或发天', () => {
    const g = { ...game('night'), lastActiveDate: '2024-02-28', lastGrantDate: '2024-02-28' };
    expect(markActiveDate(g, '2024-02-29')).toBe(true);
    expect(markActiveDate(g, '2024-02-28')).toBe(false);
    expect(accrueDays(g, '2024-02-29')).toBe(true);
    expect(reconcileAbsence(g, '2024-02-29', lose).count).toBe(0);
    expect(g).toMatchObject({ phase: 'night', receipts: {}, bankedDays: 2 });
    expect(reconcileAbsence(g, '2024-03-02', lose).count).toBe(2);
    expect(getAbsenceSummary(g)).toMatchObject({ fromDate: '2024-02-29', toDate: '2024-03-01' });
    expect(markActiveDate(g, '2024-12-31')).toBe(true);
    expect(reconcileAbsence(g, '2025-01-02', lose).count).toBe(2);
    expect(g.receipts[3]).toMatchObject({ realDate: '2024-12-31' });
    expect(g.receipts[4]).toMatchObject({ realDate: '2025-01-01' });
  });

  it('中途取种失败不会提交半份账或吞掉背包', () => {
    const g = { ...game('river'), bag: [{ n: '柴' }], river: { hand: 'wood0', wood: ['hand'] } };
    const original = structuredClone(g);
    expect(() => reconcileAbsence(g, '2026-11-23', (_, id) => {
      if (id === 2) throw new Error('取种失败');
      return lose;
    })).toThrow('取种失败');
    expect(g).toEqual(original);
    expect(reconcileAbsence(g, '2026-11-23', lose).count).toBe(3);
  });
});

describe('家宅摘要从夜账重建', () => {
  it('普通夜与主动交给机关不出现在离开摘要；重复读写不改变钱或进度', () => {
    const g = game('home');
    settleAutoNight(g, { nightId: 1, realDate: start, mode: 'delegated', seed: win, progress: true, allowLoss: true });
    expect(getAbsenceSummary(g)).toBeNull();
    expect(getAbsenceSummary(g, 'latest')).toBeNull();
    reconcileAbsence(g, '2026-11-23', (_, id) => id === 3 ? lose : win);
    const summary = getAbsenceSummary(g)!;
    expect(summary).toMatchObject({ fromDate: start, toDate: '2026-11-22', won: 2, broken: 1, chestLost: 12,
      firstNightId: 2, lastNightId: 4, days: 3 });
    const balances = [g.chest, g.purse, g.held, g.nightId];
    expect(markAbsenceRead(g, 1)).toBe(false);
    expect(markAbsenceRead(g, 99)).toBe(false);
    expect(markAbsenceRead(g, summary.lastNightId)).toBe(true);
    expect(markAbsenceRead(g, summary.lastNightId)).toBe(false);
    expect(getAbsenceSummary(g)).toBeNull();
    expect(getAbsenceSummary(g, 'latest')).toEqual(summary);
    expect([g.chest, g.purse, g.held, g.nightId]).toEqual(balances);
    const save = fromView(g);
    expect(save.account.lastActiveDate).toBe('2026-11-23');
    expect(save.houses.h).toMatchObject({ absenceReadThrough: 4, absencePeriods: [{ firstNightId: 2, lastNightId: 4 }] });
    expect(save.person).not.toHaveProperty('lastActiveDate');
    expect(save.person).not.toHaveProperty('absencePeriods');
    const view = toView(save);
    expect(getAbsenceSummary(view, 'latest')).toEqual(summary);
    expect(getAbsenceSummary(view)).toBeNull();
    for (const own of [true, false]) {
      const next = nextLifeView(game('birth', 3), view, own);
      expect(next.lastActiveDate).toBe('2026-11-23');
      expect(getAbsenceSummary(next, 'latest')).toEqual(own ? summary : null);
    }
  });

  it('旧卡迟到的已读动作只标原来的夜；后来的离开和再次打开各有正确的范围', () => {
    const g = game();
    reconcileAbsence(g, '2026-11-21', lose);
    const original = getAbsenceSummary(g)!;
    reconcileAbsence(g, '2026-11-23', () => win);
    expect(markAbsenceRead(g, original.lastNightId)).toBe(true);
    const later = getAbsenceSummary(g)!;
    expect(later).toMatchObject({ firstNightId: 2, lastNightId: 3, days: 2, won: 2, broken: 0, chestLost: 0 });
    expect(markAbsenceRead(g, later.lastNightId)).toBe(true);
    expect(getAbsenceSummary(g)).toBeNull();
    expect(getAbsenceSummary(g, 'latest')).toEqual(later);
    expect(fromView(g).houses.h?.absencePeriods).toEqual([
      { firstNightId: 1, lastNightId: 1 }, { firstNightId: 2, lastNightId: 3 },
    ]);
  });
});
