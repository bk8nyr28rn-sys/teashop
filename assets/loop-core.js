// 由 npm run build:loop 生成。规则源文件位于 src/core/loop/。
"use strict";
var LoopCore = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/core/loop/browser.ts
  var browser_exports = {};
  __export(browser_exports, {
    BANK_CAP: () => BANK_CAP,
    FIREWOOD_PER_LOG: () => FIREWOOD_PER_LOG,
    GOODS: () => GOODS,
    accrueDays: () => accrueDays,
    addLifePortrait: () => addLifePortrait,
    beginNightLedger: () => beginNightLedger,
    depositCoins: () => depositCoins,
    finishLife: () => finishLife,
    fromView: () => fromView,
    givePersonalGood: () => givePersonalGood,
    goodsValue: () => goodsValue,
    leaveGuardianReward: () => leaveGuardianReward,
    makeDayBank: () => makeDayBank,
    migrateSave: () => migrateSave,
    nextLifeView: () => nextLifeView,
    nightPayout: () => nightPayout,
    payHome: () => payHome,
    payPersonal: () => payPersonal,
    planNightLoot: () => planNightLoot,
    quoteHome: () => quoteHome,
    sameNight: () => sameNight,
    sellAllOrdinary: () => sellAllOrdinary,
    sellOrdinary: () => sellOrdinary,
    sellTreasure: () => sellTreasure,
    settleEstate: () => settleEstate,
    settleNightLedger: () => settleNightLedger,
    shelveTreasure: () => shelveTreasure,
    spendDawn: () => spendDawn,
    splitFirewood: () => splitFirewood,
    storeBelongings: () => storeBelongings,
    toView: () => toView,
    unpackBag: () => unpackBag,
    useHerb: () => useHerb
  });

  // src/core/rng.ts
  var Rng = class {
    constructor(seed) {
      this.state = seed >>> 0 || 1;
    }
    /** 存档用：取出 / 恢复内部状态 */
    getState() {
      return this.state;
    }
    setState(state) {
      this.state = state >>> 0;
    }
    /** [0, 1) */
    next() {
      let t = this.state = this.state + 1831565813 >>> 0;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    chance(p) {
      return this.next() < p;
    }
    /** [lo, hi] 之间的整数 */
    int(lo, hi) {
      return lo + Math.floor(this.next() * (hi - lo + 1));
    }
    pick(items) {
      if (items.length === 0) throw new Error("pick from empty list");
      return items[Math.floor(this.next() * items.length)];
    }
  };

  // src/core/loop/base.ts
  var CFG = {
    lifeDays: 5,
    dayStart: 360,
    dusk: 1080,
    hpMax: 3,
    bag: 6,
    bagBuddy: 3,
    buddyAt: 20,
    helpAt: 40
  };

  // src/core/loop/time.ts
  var BANK_CAP = 3;
  function calendarOrdinal(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new RangeError("日期须为 YYYY-MM-DD");
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(5, 7));
    const day = Number(key.slice(8, 10));
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const monthLengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthLengths[month - 1]) {
      throw new RangeError("无效的公历日期");
    }
    const pastYears = year - 1;
    return 365 * pastYears + Math.floor(pastYears / 4) - Math.floor(pastYears / 100) + Math.floor(pastYears / 400) + monthLengths.slice(0, month - 1).reduce((a, b) => a + b, day);
  }
  function makeDayBank(today) {
    calendarOrdinal(today);
    return { bankedDays: BANK_CAP, lastGrantDate: today, unlimitedDays: false };
  }
  function accrueDays(bank, today) {
    const elapsed = calendarOrdinal(today) - calendarOrdinal(bank.lastGrantDate);
    if (elapsed <= 0) return false;
    bank.bankedDays = Math.min(BANK_CAP, bank.bankedDays + elapsed);
    bank.lastGrantDate = today;
    return true;
  }
  function spendDawn(bank, today) {
    accrueDays(bank, today);
    if (bank.unlimitedDays) return true;
    if (bank.bankedDays === 0) return false;
    bank.bankedDays--;
    return true;
  }

  // src/core/loop/economy.ts
  var GOODS = { 柴: 3, 时蔬: 5, 草药: 6, 兽皮: 14, 铁矿: 18, 古物: 40 };
  var FIREWOOD_PER_LOG = 7;
  function positiveInt(n) {
    return Number.isSafeInteger(n) && n > 0;
  }
  function takeGoods(stock, kind, count2) {
    const available = stock[kind] ?? 0;
    if (!positiveInt(count2) || count2 > available) return false;
    if (count2 === available) delete stock[kind];
    else stock[kind] = available - count2;
    return true;
  }
  function unpackBag(person) {
    for (const item of person.bag) {
      if (item.tre) person.personalTreasures.push({ n: item.n, v: item.v });
      else person.goods[item.n] = (person.goods[item.n] ?? 0) + 1;
    }
    person.bag = [];
  }
  function splitFirewood(person) {
    person.goods.柴 = (person.goods.柴 ?? 0) + FIREWOOD_PER_LOG;
    return FIREWOOD_PER_LOG;
  }
  function goodsValue(stock) {
    return Object.entries(stock).reduce((sum, [kind, count2]) => sum + (GOODS[kind] ?? 0) * count2, 0);
  }
  function creditSale(house, person, owner, value) {
    if (owner === "house") house.chest += value;
    else person.purse += value;
  }
  function sellOrdinary(house, person, owner, kind, quantity) {
    const stock = owner === "house" ? house.store : person.goods;
    const count2 = quantity === "all" ? stock[kind] ?? 0 : quantity;
    const price = GOODS[kind];
    if (!price || !takeGoods(stock, kind, count2)) return 0;
    const value = price * count2;
    creditSale(house, person, owner, value);
    return value;
  }
  function sellAllOrdinary(house, person, owner) {
    const stock = owner === "house" ? house.store : person.goods;
    return Object.keys(stock).reduce((sum, kind) => sum + sellOrdinary(house, person, owner, kind, "all"), 0);
  }
  function sellTreasure(house, person, owner, index) {
    const treasures = owner === "house" ? house.treasures : person.personalTreasures;
    const item = treasures[index];
    if (!Number.isInteger(index) || !item) return null;
    treasures.splice(index, 1);
    creditSale(house, person, owner, item.v);
    return item;
  }
  function shelveTreasure(house, person, index) {
    const item = person.personalTreasures[index];
    if (!Number.isInteger(index) || !item) return false;
    person.personalTreasures.splice(index, 1);
    house.treasures.push(item);
    return true;
  }
  function storeBelongings(house, person) {
    for (const [kind, count2] of Object.entries(person.goods)) {
      house.store[kind] = (house.store[kind] ?? 0) + count2;
    }
    person.goods = {};
    house.treasures.push(...person.personalTreasures);
    person.personalTreasures = [];
  }
  function depositCoins(house, person, amount) {
    if (!payPersonal(person, amount)) return false;
    house.chest += amount;
    return true;
  }
  function settleEstate(house, person) {
    depositCoins(house, person, person.purse);
    storeBelongings(house, person);
  }
  function quoteHome(house, person, cost) {
    if (!positiveInt(cost)) throw new RangeError("家用价格应为正整数");
    const chest = Math.min(house.chest, cost);
    const purse = Math.min(person.purse, cost - chest);
    return { chest, purse, shortfall: cost - chest - purse };
  }
  function payHome(house, person, cost) {
    const payment = quoteHome(house, person, cost);
    if (payment.shortfall) return null;
    house.chest -= payment.chest;
    person.purse -= payment.purse;
    return payment;
  }
  function payPersonal(person, cost) {
    if (!positiveInt(cost) || person.purse < cost) return false;
    person.purse -= cost;
    return true;
  }
  function givePersonalGood(person, kind) {
    return takeGoods(person.goods, kind, 1);
  }
  function useHerb(house, person) {
    if (takeGoods(person.goods, "草药", 1)) return "person";
    return takeGoods(house.store, "草药", 1) ? "house" : null;
  }

  // src/core/loop/state.ts
  function makeHouse() {
    return { door: 0, traps: { crossbow: 0, lamp: 0, talisman: 0 }, chest: 0, store: {}, treasures: [] };
  }

  // src/core/loop/household.ts
  var otherHouses = /* @__PURE__ */ Symbol("inactive households");
  var accountKeys = [
    "bankedDays",
    "lastGrantDate",
    "unlimitedDays",
    "guideSeen",
    "guideOff",
    "allFeatures",
    "look",
    "expression",
    "history",
    "nightId",
    "worldId"
  ];
  var riverGuideKeys = ["record", "hints", "textOn"];
  var houseKeys = [
    "houseId",
    "fam",
    "money",
    "chest",
    "door",
    "traps",
    "store",
    "treasures",
    "ancestors",
    "abandoned",
    "nightPlan",
    "receipts",
    "nightReceipt"
  ];
  var candidateAssets = [
    "name",
    "money",
    "chest",
    "store",
    "door",
    "crossbow",
    "lamp",
    "talisman",
    "traps",
    "treasures",
    "ancestors",
    "yard"
  ];
  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function object(value) {
    return isObject(value) ? value : {};
  }
  function list(value) {
    return Array.isArray(value) ? value : [];
  }
  function count(value) {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
  }
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function take(source, keys) {
    const result = {};
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(source, key)) result[key] = source[key];
      delete source[key];
    }
    return result;
  }
  function validDate(value) {
    if (typeof value !== "string") return false;
    try {
      makeDayBank(value);
      return true;
    } catch {
      return false;
    }
  }
  function ownCandidates(person) {
    return list(object(person.reborn).fams).filter((f) => isObject(f) && f.own === true);
  }
  function candidateView(f, house) {
    Object.assign(f, {
      name: house.name,
      houseId: house.houseId,
      money: house.chest,
      store: { ...house.store },
      door: house.door,
      ...house.traps,
      treasures: [...house.treasures],
      ancestors: [...house.ancestors]
    });
  }
  function fromView(raw, base) {
    const view = clone(raw);
    const accountFields = take(view, accountKeys);
    const h = take(view, houseKeys);
    const lifeNo = count(view.lifeNo) || 1;
    const prefix = typeof accountFields.worldId === "string" ? accountFields.worldId + "/" : "";
    const lifeId = typeof view.lifeId === "string" ? view.lifeId : prefix + "life-" + lifeNo;
    const houseId = typeof h.houseId === "string" ? h.houseId : prefix + "house-" + lifeNo;
    const lastGrantDate = accountFields.lastGrantDate ?? base?.account.lastGrantDate;
    if (!validDate(lastGrantDate)) throw new RangeError("存档需要调用方提供有效的本地年月日");
    const account = {
      ...accountFields,
      nightId: count(accountFields.nightId),
      bankedDays: Number.isInteger(accountFields.bankedDays) ? Math.min(BANK_CAP, count(accountFields.bankedDays)) : BANK_CAP,
      lastGrantDate,
      unlimitedDays: accountFields.unlimitedDays === true
    };
    const yard = {};
    if (isObject(view.river)) {
      const guide = take(view.river, riverGuideKeys);
      if (Object.keys(guide).length) account.riverGuide = guide;
      if (view.river.stone === "yard") {
        yard.stone = "yard";
        yard.yardSlot = Number.isInteger(view.river.yardSlot) ? Number(view.river.yardSlot) : 1;
        delete view.river.stone;
      }
      delete view.river.yardSlot;
    }
    const house = {
      houseId,
      name: typeof h.fam === "string" ? h.fam : "林家",
      chest: count(h.chest ?? h.money),
      store: object(h.store),
      door: count(h.door),
      traps: { ...makeHouse().traps, ...object(h.traps) },
      treasures: list(h.treasures),
      ancestors: list(h.ancestors),
      yard,
      abandoned: h.abandoned === true,
      nightPlan: isObject(h.nightPlan) ? h.nightPlan : null,
      receipts: object(h.receipts),
      pendingNightId: null
    };
    if (isObject(h.nightReceipt)) {
      const nightId = count(h.nightReceipt.nightId) || account.nightId || 1;
      house.receipts[nightId] = {
        ...h.nightReceipt,
        houseId,
        lifeId,
        nightId,
        day: h.nightReceipt.day ?? (count(view.day) || 1),
        guardian: h.nightReceipt.guardian ?? h.nightReceipt.next === "reborn"
      };
      house.pendingNightId = nightId;
      account.nightId = Math.max(account.nightId, nightId);
    }
    for (const choice of ownCandidates(view)) {
      take(choice, candidateAssets);
      choice.houseId = houseId;
    }
    delete view.v;
    const person = {
      ...view,
      lifeId,
      houseId,
      lifeNo,
      purse: count(view.purse),
      goods: object(view.goods),
      personalTreasures: list(view.personalTreasures),
      bag: list(view.bag)
    };
    const inactive = raw[otherHouses];
    const houses = { ...clone(base?.houses ?? {}), ...clone(inactive ?? {}), [houseId]: house };
    return { v: 4, account, person, houses };
  }
  function toView(save) {
    const { account, person, houses } = clone(save);
    const house = houses[person.houseId];
    delete houses[person.houseId];
    const { yard, pendingNightId, name, ...inventory } = house;
    const { riverGuide, ...accountFields } = account;
    const view = {
      ...accountFields,
      ...person,
      ...inventory,
      v: 4,
      fam: name,
      nightReceipt: pendingNightId === null ? null : house.receipts[pendingNightId] ?? null
    };
    if (isObject(person.river) || riverGuide || yard.stone) {
      view.river = { ...object(person.river), ...riverGuide, ...yard };
    }
    for (const choice of ownCandidates(view)) candidateView(choice, house);
    view[otherHouses] = houses;
    return view;
  }
  function legacyPortrait(game) {
    const note = "第 " + (count(game.lifeNo) || 1) + " 世的你";
    for (const choice of ownCandidates(game)) {
      const match = list(choice.ancestors).find((p) => p.note === note && p.name === game.name);
      if (match) return match;
    }
    return { name: game.name, look: game.look, expression: game.expression || "calm", note };
  }
  function migrateSave(raw, today) {
    if (!isObject(raw)) return null;
    if (raw.v === 4) {
      if (!isObject(raw.account) || !isObject(raw.person) || !isObject(raw.houses) || typeof raw.person.houseId !== "string" || !Object.prototype.hasOwnProperty.call(raw.houses, raw.person.houseId) || !isObject(raw.houses[raw.person.houseId])) return null;
      return clone(raw);
    }
    if (raw.v !== 2 && raw.v !== 3) return null;
    const flat = {
      ...raw,
      chest: count(raw.money),
      purse: 0,
      goods: {},
      personalTreasures: [],
      lastGrantDate: validDate(raw.lastGrantDate) ? raw.lastGrantDate : today
    };
    const migrated = fromView(flat);
    if (raw.deathKind !== "old" && raw.deathKind !== "early") return migrated;
    const view = toView(migrated);
    finishLife(view, legacyPortrait(raw));
    return fromView(view);
  }
  function addLifePortrait(g, portrait) {
    if (g.ancestors.some((p) => p.lifeId === g.lifeId)) return;
    const existing = g.ancestors.find((p) => !p.lifeId && p.name === portrait.name && p.note === "第 " + g.lifeNo + " 世的你");
    if (existing) existing.lifeId = g.lifeId;
    else g.ancestors.push({ ...clone(portrait), lifeId: g.lifeId });
  }
  function finishLife(g, portrait) {
    if (!g.estateSettled) {
      if (g.deathKind !== "early") unpackBag(g);
      settleEstate(g, g);
      g.estateSettled = true;
    }
    addLifePortrait(g, portrait);
  }
  function leaveGuardianReward(g) {
    if (g.guardianRewardStored) return;
    const receipt = Object.values(g.receipts).find((r) => r.lifeId === g.lifeId && r.guardian === true && r.won === true);
    if (receipt && depositCoins(g, g, Math.min(g.purse, count(receipt.earnedMoney)))) g.guardianRewardStored = true;
  }
  function nextLifeView(newFlat, previous, own, loot) {
    leaveGuardianReward(previous);
    const prior = fromView(previous);
    const oldHouse = prior.houses[previous.houseId];
    oldHouse.abandoned = !own && list(previous.kids).length === 0;
    const lifeNo = previous.lifeNo + 1;
    const prefix = typeof prior.account.worldId === "string" ? prior.account.worldId + "/" : "";
    let houseId = oldHouse.houseId;
    if (!own) {
      let serial = lifeNo;
      do {
        houseId = prefix + "house-" + serial++;
      } while (prior.houses[houseId]);
    }
    const fresh = fromView({
      ...newFlat,
      lastGrantDate: prior.account.lastGrantDate,
      lifeNo,
      houseId,
      lifeId: prefix + "life-" + lifeNo,
      own,
      purse: loot ? 30 : 0,
      personalTreasures: loot ? [loot] : [],
      goods: {}
    });
    const riverGuide = { ...prior.account.riverGuide, ...fresh.account.riverGuide };
    fresh.account = prior.account;
    if (Object.keys(riverGuide).length) fresh.account.riverGuide = riverGuide;
    fresh.houses = { ...prior.houses, [houseId]: own ? oldHouse : fresh.houses[houseId] };
    fresh.houses[houseId].pendingNightId = null;
    fresh.houses[houseId].nightPlan = null;
    return toView(fresh);
  }

  // src/core/loop/settlement.ts
  function planNightLoot(seed, shelf) {
    const rng = new Rng(seed ^ 2769414579);
    const purseTenths = rng.int(2, 4);
    const chestTenths = rng.int(0, 2);
    const treasureIndex = shelf.length ? rng.int(0, shelf.length - 1) : null;
    return {
      seed: seed >>> 0,
      purseTenths,
      chestTenths,
      treasureIndex,
      treasure: treasureIndex === null ? null : { ...shelf[treasureIndex] }
    };
  }
  function nightPayout(plan, assets, won, coins) {
    let index = -1;
    if (!won && plan.treasure && plan.treasureIndex !== null) {
      const planned = plan.treasure;
      const same = (t) => t?.n === planned.n && t.v === planned.v;
      index = same(assets.treasures[plan.treasureIndex]) ? plan.treasureIndex : assets.treasures.findIndex(same);
    }
    return {
      earnedMoney: won ? coins : 0,
      purseLost: won ? 0 : Math.floor(assets.purse * plan.purseTenths / 10),
      chestLost: won ? 0 : Math.floor(assets.chest * plan.chestTenths / 10),
      lostTreasureIndex: index < 0 ? null : index,
      lostTreasure: index < 0 ? null : { ...assets.treasures[index] }
    };
  }
  function sameNight(a, b) {
    return a.houseId === b.houseId && a.lifeId === b.lifeId && a.nightId === b.nightId && a.day === b.day && a.guardian === b.guardian;
  }
  function beginNightLedger(game, guardian, seed) {
    const phase = guardian ? "guard" : "night";
    if (game.nightReceipt) return null;
    if (game.nightPlan) {
      const plan2 = game.nightPlan;
      return game.phase === phase && sameNight(plan2, { ...game, guardian }) ? plan2 : null;
    }
    if (game.phase !== phase && game.phase !== (guardian ? "death" : "home")) return null;
    const plan = {
      houseId: game.houseId,
      lifeId: game.lifeId,
      day: game.day,
      guardian,
      nightId: game.nightId + 1,
      ...planNightLoot(seed, game.treasures)
    };
    game.nightId = plan.nightId;
    game.nightPlan = plan;
    game.phase = phase;
    return plan;
  }
  function settleNightLedger(game, expected, battle, describe) {
    const prior = game.receipts[expected.nightId];
    if (prior && sameNight(prior, expected)) return prior;
    const plan = game.nightPlan;
    if (!plan || !sameNight(plan, expected) || !sameNight(plan, { ...game, guardian: expected.guardian }) || game.phase !== (plan.guardian ? "guard" : "night") || game.nightReceipt) return null;
    const payout = nightPayout(plan, game, battle.won, battle.coins);
    const receipt = {
      houseId: plan.houseId,
      lifeId: plan.lifeId,
      nightId: plan.nightId,
      day: plan.day,
      guardian: plan.guardian,
      won: battle.won,
      ...payout,
      paragraphs: [],
      next: plan.guardian ? "reborn" : game.day >= CFG.lifeDays ? "old" : "morning"
    };
    receipt.paragraphs = describe(receipt);
    game.purse += receipt.earnedMoney - receipt.purseLost;
    game.chest -= receipt.chestLost;
    if (receipt.lostTreasureIndex !== null) game.treasures.splice(receipt.lostTreasureIndex, 1);
    if (battle.won) game.kills += battle.kills;
    if (plan.guardian) game.afterlife = { kind: "guard", won: battle.won };
    else if (battle.won) game.held++;
    else game.broken++;
    game.receipts[plan.nightId] = receipt;
    game.nightReceipt = receipt;
    game.nightPlan = null;
    game.phase = "dawn";
    return receipt;
  }
  return __toCommonJS(browser_exports);
})();
