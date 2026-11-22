import { settleAutoNight, type AutoNightGame, type AutoNightReceipt } from './auto-defense';
import { splitFirewood, unpackBag } from './economy';
import type { AbsencePeriod, HouseholdView } from './household';
import type { Person } from './state';
import { dateOrdinal, nextCalendarDate } from './time';

interface Activity { lastActiveDate?: string }
// 二阶段以前的手动战报可能只有旧夜号和文字，不参与离开摘要。
interface StoredEvent { nightId?: number }
interface SummaryLedger {
  receipts: Record<string, StoredEvent>;
  absenceReadThrough?: number;
  absencePeriods?: AbsencePeriod[];
}
export interface AbsenceGame extends AutoNightGame, Activity, Omit<SummaryLedger, 'receipts'>,
  Pick<Person, 'bag' | 'goods' | 'personalTreasures'> {
  river?: Record<string, unknown>;
  at?: unknown;
  target?: unknown;
  buddy?: unknown;
}
type AbsenceSeed = number | ((realDate: string, nightId: number) => number);

/** 持续在线跨零点时只推进账号的活动日期。攒天仍由 accrueDays 处理。 */
export function markActiveDate(account: Activity, today: string): boolean {
  dateOrdinal(today);
  if (account.lastActiveDate && today <= account.lastActiveDate) return false;
  account.lastActiveDate = today;
  return true;
}

// 隔日交接在途的游戏夜时，带回随身包和手里的河埠重物。留在地上的货物仍在原地。
function returnFromField(game: AbsenceGame): void {
  game.goods = { ...game.goods };
  game.personalTreasures = [...game.personalTreasures];
  unpackBag(game);
  if (game.river) {
    const river = { ...game.river, fromWharf: false } as Record<string, unknown>;
    if (game.phase === 'river') {
      const hand = river.hand;
      if (hand === 'stone') {
        river.stone = 'yard';
        river.yardSlot = 1;
      } else if (typeof hand === 'string' && /^wood\d+$/.test(hand) && Array.isArray(river.wood)) {
        const wood = [...river.wood];
        wood[Number(hand.slice(4))] = 'firewood';
        river.wood = wood;
        splitFirewood(game);
      }
      river.hand = null;
      river.helper = false;
      river.focus = null;
    }
    game.river = river;
  }
  game.buddy = null;
  game.at = 'home';
  game.target = null;
  game.phase = 'home';
}

/** 由调用方持锁读取最新存档，并把这整段家账与新活动日期一次提交。 */
export function reconcileAbsence(game: AbsenceGame | HouseholdView, today: string, seed: AbsenceSeed) {
  const end = dateOrdinal(today);
  const start = game.lastActiveDate;
  if (!start || game.phase === 'intro') return { count: 0, changed: markActiveDate(game, today) };
  const days = end - dateOrdinal(start);
  if (days <= 0) return { count: 0, changed: false };

  // 输入的取种函数、夜账一致性检查都可能失败；整批成功后才把变化交回页面。
  // HouseholdView 保留旧战报的宽类型。交接只复用已登记的夜，其余收据按新夜号追加。
  const next = { ...game, receipts: { ...game.receipts } } as AbsenceGame;
  if (next.phase === 'map' || next.phase === 'river') returnFromField(next);
  const unfinished = !next.nightReceipt && ['home', 'night', 'guard'].includes(next.phase);
  let date = start;
  let allowLoss = true;
  for (let i = 0; i < days; i++) {
    const progress = i === 0 && unfinished;
    const plan = progress ? next.nightPlan : null;
    const nightId = plan?.nightId ?? next.nightId + 1;
    const draw = plan?.seed ?? (typeof seed === 'number' ? (seed + i) >>> 0 : seed(date, nightId));
    const receipt = settleAutoNight(next, { mode: 'offline', realDate: date, nightId, seed: draw,
      progress, guardian: progress && next.phase === 'guard', allowLoss });
    if (!receipt) throw new Error('离开期间的来袭与现有夜账不一致');
    if (receipt.chestLost > 0) allowLoss = false;
    date = nextCalendarDate(date);
  }
  next.lastActiveDate = today;
  Object.assign(game, next);
  return { count: days, changed: true };
}

function isOffline(receipt: StoredEvent): receipt is AutoNightReceipt {
  return 'mode' in receipt && receipt.mode === 'offline';
}

function summarize(game: SummaryLedger, after: number, through: number) {
  const events = Object.values(game.receipts)
    .filter((r): r is AutoNightReceipt => isOffline(r) && r.nightId > after && r.nightId <= through)
    .sort((a, b) => a.nightId - b.nightId);
  if (!events.length) return null;
  const first = events[0]!, last = events[events.length - 1]!;
  let won = 0, chestLost = 0, earnedMoney = 0;
  for (const event of events) {
    if (event.won) won++;
    chestLost += event.chestLost;
    earnedMoney += event.earnedMoney;
  }
  return {
    firstNightId: first.nightId, lastNightId: last.nightId, fromDate: first.realDate, toDate: last.realDate,
    days: events.length, raids: events.length, won, broken: events.length - won, chestLost, earnedMoney,
  };
}

/** 新卡覆盖所有未读来袭。回看优先展示新卡，否则按上次实际看到的夜号区间重建。 */
export function getAbsenceSummary(game: SummaryLedger, kind: 'unread' | 'latest' = 'unread') {
  const unread = summarize(game, game.absenceReadThrough ?? 0, Infinity);
  if (unread || kind === 'unread') return unread;
  const history = game.absencePeriods;
  const last = history?.[history.length - 1];
  return last ? summarize(game, last.firstNightId - 1, last.lastNightId) : null;
}

/** 只确认眼前这张卡。旧标签页迟到的点击不会把其后新来的一晚标成已读。 */
export function markAbsenceRead(game: SummaryLedger, lastNightId: number): boolean {
  const seen = game.absenceReadThrough ?? 0;
  if (!Number.isSafeInteger(lastNightId) || lastNightId <= seen) return false;
  const summary = summarize(game, seen, lastNightId);
  if (!summary || summary.lastNightId !== lastNightId) return false;
  (game.absencePeriods ??= []).push({ firstNightId: summary.firstNightId, lastNightId });
  game.absenceReadThrough = lastNightId;
  return true;
}
