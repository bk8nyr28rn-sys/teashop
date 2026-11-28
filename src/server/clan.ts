import { FAMILY, HAUNT, newFamily, settleEstate } from '../core/loop';
import { CLAN } from './config';
import { touchHouse } from './house';
import type { Account, Ask, Cradle, HouseDoc, Life } from './model';
import { fail, isAdult, type Ctx } from './world';

// 家族 → 房 → 人（11-28 定）：住哪随你，成亲不用搬，成年可以自立门户。

function ask(ctx: Ctx, fields: Omit<Ask, 'id' | 'status'>, text: string): Ask {
  const a: Ask = { id: ctx.id('ask'), status: 'open', ...fields };
  ctx.w.asks[a.id] = a;
  for (const id of a.askers) ctx.tell({ lifeId: id }, 'ask', text);
  return a;
}

function notDuringNight(life: Life): void {
  if (life.phase === 'night') fail('夜里正在打，等这一夜结完账再说');
  if (life.phase === 'dead' || life.phase === 'old') fail('这一世已经走完了');
}

// ---------------- 自立门户 ----------------

export function foundHouse(ctx: Ctx, life: Life, amount: number) {
  notDuringNight(life);
  if (!isAdult(life)) fail('长大了才能自立门户');
  if (!Number.isSafeInteger(amount) || amount < 0) fail('分多少钱要写整数');
  const house = ctx.house(life.houseId);
  if (amount > Math.floor(house.chest * CLAN.splitShare)) fail(`最多只能分走钱箱的${CLAN.splitShare * 10}成`);
  const others = ctx.realResidents(house, life.id).filter(isAdult);
  if (others.length) {
    const a = ask(ctx, { kind: 'found', from: life.id, houseId: house.id, amount, askers: others.map(l => l.id) },
      `${life.name}想自立门户，从钱箱分走 ${amount} 文起家。`);
    return { pending: a.id };
  }
  return { houseId: doFound(ctx, life, amount).id };
}

function doFound(ctx: Ctx, life: Life, amount: number): HouseDoc {
  const old = ctx.house(life.houseId);
  if (amount > Math.floor(old.chest * CLAN.splitShare)) fail('钱箱里的钱变少了，分不了这么多');
  // 起房的钱先从分到的钱里出，不够再用自己的钱袋
  const fromSplit = Math.min(amount, CLAN.houseCost);
  const fromPurse = CLAN.houseCost - fromSplit;
  if (life.person.purse < fromPurse) fail(`起一座房要 ${CLAN.houseCost} 文，钱不够`);
  const clan = ctx.clan(life.clanId);
  const house = ctx.newHouse(clan, `${life.name}宅`, CLAN.newHouseDoor);
  old.chest -= amount;
  life.person.purse -= fromPurse;
  house.chest = amount - fromSplit;
  ctx.ledger(life.id, old.id, -amount, 0, '分家');
  ctx.ledger(life.id, house.id, house.chest, -fromPurse, '起新房');
  ctx.leave(life);
  house.residents.push(life.id);
  life.houseId = house.id;
  ctx.tell({ houseId: old.id }, 'found', `${life.name}自立门户，分走 ${amount} 文，在族里起了一座新房。`);
  return house;
}

// ---------------- 搬进别人的房 ----------------

function spouseOf(ctx: Ctx, life: Life): string | null {
  const bond = life.bondId ? ctx.w.bonds[life.bondId] : null;
  return bond ? (bond.a === life.id ? bond.b : bond.a) : null;
}

export function moveIn(ctx: Ctx, life: Life, houseId: string) {
  notDuringNight(life);
  const target = ctx.house(houseId);
  if (target.id === life.houseId) fail('已经住在这了');
  const spouse = spouseOf(ctx, life);
  if (target.clanId !== life.clanId && !(spouse && target.residents.includes(spouse))) fail('只能搬进自己族里的房，或者伴侣住的房');
  const reals = ctx.realResidents(target);
  if (reals.length) {
    const a = ask(ctx, { kind: 'moveIn', from: life.id, houseId, askers: reals.map(l => l.id) }, `${life.name}想搬进来住。`);
    return { pending: a.id };
  }
  doMove(ctx, life, target);
  return { houseId };
}

function doMove(ctx: Ctx, life: Life, target: HouseDoc): void {
  // 先把老宅空着那些天补完（没人住不来鬼），再住进去
  touchHouse(ctx, target);
  ctx.leave(life);
  target.residents.push(life.id);
  target.abandoned = false;
  life.houseId = target.id;
  ctx.tell({ houseId: target.id }, 'moveIn', `${life.name}搬进来住了。`);
}

// ---------------- 红线 ----------------

export function proposeBond(ctx: Ctx, life: Life, to: string) {
  notDuringNight(life);
  const other = ctx.life(to);
  if (other.id === life.id || other.accountId === null) fail('找不到这个人');
  if (life.bondId || other.bondId) fail('已经有红线了');
  if (!isAdult(life) || !isAdult(other) || other.phase === 'dead' || other.phase === 'old') fail('两个人都要是成年人');
  const a = ask(ctx, { kind: 'bond', from: life.id, to, askers: [to] }, `${life.name}想和你牵红线。`);
  return { pending: a.id };
}

function doBond(ctx: Ctx, a: Life, b: Life): void {
  if (a.bondId || b.bondId) fail('已经有红线了');
  const bond = { id: ctx.id('bond'), a: a.id, b: b.id, love: FAMILY.matchLove, lastDawnDate: null, kids: [] };
  ctx.w.bonds[bond.id] = bond;
  a.bondId = bond.id;
  b.bondId = bond.id;
  ctx.tell({ lifeId: a.id }, 'bond', `${b.name}答应了，红线牵上了。`);
}

// ---------------- 答应 / 不答应 ----------------

export function respond(ctx: Ctx, life: Life, askId: string, accept: boolean) {
  const a = ctx.w.asks[askId];
  if (!a || a.status !== 'open' || !a.askers.includes(life.id)) fail('没有这件事要你答应');
  const from = ctx.life(a.from);
  if (!accept) {
    a.status = 'declined';
    ctx.tell({ lifeId: from.id }, 'declined', `${life.name}没有答应。`);
    return { status: a.status };
  }
  if (a.kind === 'found') {
    if (from.houseId !== a.houseId) fail('他已经不住这了');
    doFound(ctx, from, a.amount ?? 0);
  } else if (a.kind === 'moveIn') {
    doMove(ctx, from, ctx.house(a.houseId!));
  } else {
    doBond(ctx, from, life);
  }
  a.status = 'accepted';
  return { status: a.status };
}

// ---------------- 空位、出生 ----------------

/** 红线到知己、第 3 天起，在自己住的房里开一个空位。真人来投胎，或者等一天 NPC 孩子先占着 */
export function openCradle(ctx: Ctx, life: Life) {
  notDuringNight(life);
  const bond = life.bondId ? ctx.w.bonds[life.bondId] : null;
  if (!bond) fail('还没有红线');
  const B = FAMILY.birth;
  if (bond.love < B.minLove || life.person.day < B.fromDay) fail('红线还不够深');
  const open = Object.values(ctx.w.houses).flatMap(h => h.cradles).filter(c => c.bondId === bond.id);
  if (open.length) fail('已经有一个空位在等了');
  if (bond.kids.length >= B.maxKids) fail('孩子已经够了');
  const house = ctx.house(life.houseId);
  const cradle: Cradle = { id: ctx.id('cradle'), bondId: bond.id, openedDate: ctx.today, placeholder: null };
  house.cradles.push(cradle);
  ctx.tell({ houseId: house.id }, 'cradle', '家里有了一个空位，等孩子来投胎。');
  return { cradleId: cradle.id };
}

/** 有空位、房里还有真人活着的人家 */
export function openCradles(ctx: Ctx): Array<{ house: HouseDoc; cradle: Cradle }> {
  return Object.values(ctx.w.houses).flatMap(house => ctx.realResidents(house).length
    ? house.cradles.map(cradle => ({ house, cradle })) : []);
}

/** 投胎进一个空位：孩子算这座房所在的家族（暂定，第四节第 9 条） */
export function bornInto(ctx: Ctx, accountId: string, lifeNo: number, house: HouseDoc, cradle: Cradle): Life {
  const bond = ctx.w.bonds[cradle.bondId] ?? fail('空位对不上');
  const life = ctx.newLife(accountId, ctx.clan(house.clanId), house, lifeNo, [bond.a, bond.b]);
  if (cradle.placeholder) bond.kids[bond.kids.indexOf(cradle.placeholder)] = life.id;
  else bond.kids.push(life.id);
  house.cradles = house.cradles.filter(c => c.id !== cradle.id);
  ctx.tell({ houseId: house.id }, 'birth', cradle.placeholder
    ? `孩子出生了：${life.name}投胎来了，顶替了先抱养的那个孩子。` : `孩子出生了：${life.name}投胎来了。`);
  return life;
}

/** 没有空位时：一户新的人家（新家族、一座房） */
export function newFamilyLife(ctx: Ctx, accountId: string, lifeNo: number): Life {
  const clan = ctx.newClan();
  const fam = ctx.draw(rng => newFamily(0, rng));
  const house = ctx.newHouse(clan, `${clan.name}宅`, fam.door);
  house.chest = fam.money;
  house.traps = { crossbow: fam.crossbow, lamp: fam.lamp, talisman: fam.talisman };
  house.treasures = fam.treasures.map(({ n, v }) => ({ n, v }));
  return ctx.newLife(accountId, clan, house, lifeNo);
}

// ---------------- 老死、投胎 ----------------

/** 老死：钱袋进住的那座房的钱箱，东西进仓库；画像挂进家族的祠堂 */
export function die(ctx: Ctx, life: Life) {
  if (life.phase !== 'old') fail('还没老');
  const house = ctx.house(life.houseId);
  const purse = life.person.purse;
  settleEstate(house, life.person);
  ctx.ledger(life.id, house.id, purse, -purse, '老死，钱袋进钱箱');
  ctx.clan(life.clanId).ancestors.push({ lifeId: life.id, name: life.name, lifeNo: life.lifeNo, diedDate: ctx.today });
  ctx.leave(life);
  life.phase = 'dead';
  ctx.tell({ houseId: house.id }, 'death', `${life.name}老了，画像挂进了祠堂。`);
  return { ancestors: ctx.clan(life.clanId).ancestors.length };
}

/** 投胎。指定空位就生在那；不指定就去一户新人家。当厉鬼砸开了门，钱和宝物带进下一世 */
export function reborn(ctx: Ctx, account: Account, cradleId?: string) {
  const old = ctx.life(account.lifeId);
  if (old.phase !== 'dead') fail('这一世还没走完');
  let life: Life;
  if (cradleId) {
    const hit = openCradles(ctx).find(x => x.cradle.id === cradleId) ?? fail('这个空位已经没了');
    life = bornInto(ctx, account.id, old.lifeNo + 1, hit.house, hit.cradle);
  } else life = newFamilyLife(ctx, account.id, old.lifeNo + 1);
  const after = old.afterlife;
  if (after?.kind === 'haunt' && after.won) {
    life.person.purse += HAUNT.lootCoins;
    if (after.loot) life.person.personalTreasures.push({ ...after.loot });
  }
  account.lifeId = life.id;
  return { lifeId: life.id, houseId: life.houseId, clanId: life.clanId };
}
