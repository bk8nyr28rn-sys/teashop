import {
  buyDecor, dayPrices, depositCoins, DOORS, expandYard, payHome, sellOrdinary, storeBelongings, TRAPS,
  type DecorKind, type Owner,
} from '../core/loop';
import type { HouseDoc, Life } from './model';
import { fail, type Ctx } from './world';

/** 白天的操作。手机先算、马上给画面，在回家、去集市、修院子这些节点攒成一批交上来 */
export type DayOp =
  | { type: 'sell'; owner: Owner; kind: string; quantity: number | 'all' }
  | { type: 'deposit'; amount: number }
  | { type: 'store' }
  | { type: 'buyDoor' }
  | { type: 'buyTrap'; trap: 'crossbow' | 'lamp' | 'talisman' }
  | { type: 'expandYard' }
  | { type: 'buyDecor'; kind: DecorKind; slot?: number };

function paid(ctx: Ctx, life: Life, house: HouseDoc, payment: { chest: number; purse: number } | null, why: string): void {
  if (!payment) fail('钱不够');
  ctx.ledger(life.id, house.id, -payment.chest, -payment.purse, why);
}

export function runDayOps(ctx: Ctx, life: Life, ops: readonly DayOp[]): void {
  if (life.phase !== 'day') fail('现在不是白天');
  if (!ops?.length) fail('没有操作');
  const house = ctx.house(life.houseId);
  const person = life.person;
  for (const op of ops) {
    switch (op.type) {
      case 'sell': {
        // 价钱服务器自己算，不信手机报的
        const value = sellOrdinary(house, person, op.owner, op.kind, op.quantity, dayPrices(life.id, person.day));
        if (!value) fail('没有这么多东西可卖');
        ctx.ledger(life.id, house.id, op.owner === 'house' ? value : 0, op.owner === 'person' ? value : 0, `卖${op.kind}`);
        break;
      }
      case 'deposit':
        if (!depositCoins(house, person, op.amount)) fail('钱袋里没有这么多钱');
        ctx.ledger(life.id, house.id, op.amount, -op.amount, '存进钱箱');
        break;
      case 'store':
        storeBelongings(house, person);
        break;
      case 'buyDoor': {
        const next = DOORS[house.door + 1];
        if (!next) fail('门已经是最好的了');
        paid(ctx, life, house, payHome(house, person, next.cost), `换${next.name}`);
        house.door++;
        break;
      }
      case 'buyTrap': {
        const trap = TRAPS[op.trap];
        if (!trap) fail('没有这种机关');
        if (house.traps[op.trap] >= trap.max) fail(`${trap.name}已经装满了`);
        paid(ctx, life, house, payHome(house, person, trap.cost), `装${trap.name}`);
        house.traps[op.trap]++;
        break;
      }
      case 'expandYard':
        paid(ctx, life, house, expandYard(house, person), '扩院子');
        break;
      case 'buyDecor': {
        const bought = buyDecor(house, person, op.kind, op.slot);
        paid(ctx, life, house, bought?.payment ?? null, '买装饰');
        break;
      }
      default:
        fail('不认识的操作');
    }
  }
}
