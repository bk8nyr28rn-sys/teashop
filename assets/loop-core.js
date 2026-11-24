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
    AFTERLIFE: () => AFTERLIFE,
    AUTO_DEFENSE: () => AUTO_DEFENSE,
    BANK_CAP: () => BANK_CAP,
    FAMILY: () => FAMILY,
    FIREWOOD_PER_LOG: () => FIREWOOD_PER_LOG,
    GOODS: () => GOODS,
    HAUNT: () => HAUNT,
    REBIRTH: () => REBIRTH,
    Rng: () => Rng,
    TRADE: () => TRADE,
    acceptRequest: () => acceptRequest,
    accompany: () => accompany,
    accrueDays: () => accrueDays,
    addLifePortrait: () => addLifePortrait,
    autoLossLimit: () => autoLossLimit,
    beginNightLedger: () => beginNightLedger,
    birth: () => birth,
    canAccompany: () => canAccompany,
    canBirth: () => canBirth,
    canCook: () => canCook,
    canTakeDisciple: () => canTakeDisciple,
    carryFriends: () => carryFriends,
    chanceLabel: () => chanceLabel,
    collectStove: () => collectStove,
    dawnLove: () => dawnLove,
    dayPrices: () => dayPrices,
    defenseChance: () => defenseChance,
    deliverRequest: () => deliverRequest,
    depositCoins: () => depositCoins,
    discipleGrade: () => discipleGrade,
    finishLife: () => finishLife,
    fromView: () => fromView,
    getAbsenceSummary: () => getAbsenceSummary,
    givePersonalGood: () => givePersonalGood,
    goodsValue: () => goodsValue,
    gradeFor: () => gradeFor,
    hauntBash: () => hauntBash,
    hauntDodge: () => hauntDodge,
    hauntOutcome: () => hauntOutcome,
    hauntStep: () => hauntStep,
    karmaRows: () => karmaRows,
    karmaTotal: () => karmaTotal,
    leaveGuardianReward: () => leaveGuardianReward,
    makeDayBank: () => makeDayBank,
    markAbsenceRead: () => markAbsenceRead,
    markActiveDate: () => markActiveDate,
    match: () => match,
    migrateSave: () => migrateSave,
    newFamily: () => newFamily,
    nextLifeView: () => nextLifeView,
    nightKarma: () => nightKarma,
    nightPayout: () => nightPayout,
    offerFor: () => offerFor,
    ownThread: () => ownThread,
    paperReward: () => paperReward,
    payHome: () => payHome,
    payPersonal: () => payPersonal,
    planDelivery: () => planDelivery,
    planNightLoot: () => planNightLoot,
    priceTrend: () => priceTrend,
    quoteHome: () => quoteHome,
    reconcileAbsence: () => reconcileAbsence,
    refreshRequest: () => refreshRequest,
    requestBoard: () => requestBoard,
    sameNight: () => sameNight,
    sellAllOrdinary: () => sellAllOrdinary,
    sellOrdinary: () => sellOrdinary,
    sellTreasure: () => sellTreasure,
    settleAutoNight: () => settleAutoNight,
    settleEstate: () => settleEstate,
    settleNightLedger: () => settleNightLedger,
    shelveTreasure: () => shelveTreasure,
    spendDawn: () => spendDawn,
    splitFirewood: () => splitFirewood,
    startHaunt: () => startHaunt,
    startStove: () => startStove,
    storeBelongings: () => storeBelongings,
    stoveStatus: () => stoveStatus,
    strangerTiers: () => strangerTiers,
    takeDisciple: () => takeDisciple,
    threadName: () => threadName,
    tierOf: () => tierOf,
    toView: () => toView,
    unpackBag: () => unpackBag,
    useHealing: () => useHealing,
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
  function monthLengths(year) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  }
  function dateOrdinal(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new RangeError("日期须为 YYYY-MM-DD");
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(5, 7));
    const day = Number(key.slice(8, 10));
    const lengths = monthLengths(year);
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > lengths[month - 1]) {
      throw new RangeError("无效的公历日期");
    }
    const pastYears = year - 1;
    return 365 * pastYears + Math.floor(pastYears / 4) - Math.floor(pastYears / 100) + Math.floor(pastYears / 400) + lengths.slice(0, month - 1).reduce((a, b) => a + b, day);
  }
  function nextCalendarDate(key) {
    dateOrdinal(key);
    let year = Number(key.slice(0, 4)), month = Number(key.slice(5, 7)), day = Number(key.slice(8)) + 1;
    if (day > monthLengths(year)[month - 1]) {
      day = 1;
      if (++month > 12) {
        month = 1;
        year++;
      }
    }
    if (year > 9999) throw new RangeError("日期超出公历存档范围");
    return [String(year).padStart(4, "0"), String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
  }
  function makeDayBank(today) {
    dateOrdinal(today);
    return { bankedDays: BANK_CAP, lastGrantDate: today, unlimitedDays: false };
  }
  function accrueDays(bank, today) {
    const elapsed = dateOrdinal(today) - dateOrdinal(bank.lastGrantDate);
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
  var GOODS = { 柴: 3, 时蔬: 5, 草药: 6, 兽皮: 14, 铁矿: 18, 古物: 40, 木炭: 14, 金疮药: 20 };
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
  function goodsValue(stock, prices = GOODS) {
    return Object.entries(stock).reduce((sum, [kind, count2]) => sum + (prices[kind] ?? 0) * count2, 0);
  }
  function creditSale(house, person, owner, value) {
    if (owner === "house") house.chest += value;
    else person.purse += value;
  }
  function sellOrdinary(house, person, owner, kind, quantity, prices = GOODS) {
    const stock = owner === "house" ? house.store : person.goods;
    const count2 = quantity === "all" ? stock[kind] ?? 0 : quantity;
    const price = prices[kind];
    if (!price || !takeGoods(stock, kind, count2)) return 0;
    const value = price * count2;
    creditSale(house, person, owner, value);
    return value;
  }
  function sellAllOrdinary(house, person, owner, prices = GOODS) {
    const stock = owner === "house" ? house.store : person.goods;
    return Object.keys(stock).reduce((sum, kind) => sum + sellOrdinary(house, person, owner, kind, "all", prices), 0);
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

  // src/core/loop/field-config.ts
  var RINGS = [
    { name: "近郊", hint: "风险低，东西普通", r: 64, fight: 0.85, escape: 0.75, death: 0, foes: ["野狗", "毒蛇"] },
    { name: "山林", hint: "有野兽，东西好", r: 112, fight: 0.6, escape: 0.45, death: 0, foes: ["山狼", "黑熊", "山贼"] },
    { name: "禁地", hint: "很危险，有宝物", r: 158, fight: 0.45, escape: 0.2, death: 0.5, foes: ["凶尸", "古墓机关", "毒瘴"] }
  ];
  function fieldClue(text, action, focus, extraRisk = 0) {
    return { text, action, focus, extraRisk };
  }
  var sites = [
    { name: "河边", ring: 0, angle: -50, loot: { 草药: 75, 柴: 25 }, scene: "岸边挂着一串水草，石滩再往前就要蹚水了。", safe: "在浅滩摘草药", minutes: [20, 45], risk: [0.02, 0.13], clues: [
      fieldClue("昨夜涨了水，石缝里卡着带根的药草。", "沿着水线捞草药", "草药", 0.05),
      fieldClue("桥桩压着一排漂木，树皮还没泡软。", "绕到桥下拖漂木", "柴")
    ] },
    { name: "竹林", ring: 0, angle: 70, loot: { 柴: 85, 草药: 15 }, scene: "竹梢挨着竹梢，地上有条砍柴人踩出来的小路。", safe: "沿小路拾枯竹", minutes: [20, 40], risk: [0.02, 0.11], clues: [
      fieldClue("风刮断了几根老竹，折口还泛白。", "钻进倒竹堆拆柴", "柴"),
      fieldClue("背阴处冒出一排青叶，根下的土很松。", "扒开竹叶挖药根", "草药", 0.04)
    ] },
    { name: "菜地", ring: 0, angle: 190, loot: { 时蔬: 85, 草药: 15 }, scene: "田埂上摆着两只空筐，摘满一把就能沿原路回来。", safe: "在田边摘两把菜", safeCount: 2, minutes: [25, 45], risk: [0.01, 0.06], clues: [
      fieldClue("畦里的菜都卷了心，隔着篱笆就看得见。", "穿过篱门收菜心", "时蔬"),
      fieldClue("沟边翻过土，几株平时难找的药苗露出了头。", "顺着水沟辨药苗", "草药", 0.02)
    ] },
    { name: "松林", ring: 1, angle: -10, loot: { 兽皮: 60, 柴: 40 }, scene: "老松下散着松针，树干粗糙处挂着一绺兽毛。", safe: "查看林缘的旧猎套", minutes: [30, 55], risk: [0.05, 0.22], clues: [
      fieldClue("狐狸换毛，松根旁留了一路毛团。", "循着毛团找兽径", "兽皮", 0.06),
      fieldClue("雷劈开了老松，树心干得正好。", "进林劈开雷击木", "柴")
    ] },
    { name: "猎场", ring: 1, angle: 110, loot: { 兽皮: 85, 草药: 15 }, scene: "废猎棚外有两串脚印，一串进了芦苇，就没再出来。", safe: "查猎棚边的浅套", minutes: [30, 60], risk: [0.09, 0.36], solo: "屏住气钻进兽径", clues: [
      fieldClue("饮水坑边都是蹄印，野兽刚散开。", "沿蹄印收深处的猎套", "兽皮", 0.08),
      fieldClue("守棚人晾的药根被雨打落，散进了围场。", "进围场找散落的药根", "草药")
    ] },
    { name: "矿洞", ring: 1, angle: 230, loot: { 铁矿: 85, 柴: 15 }, scene: "洞口堆着碎石，一条窄轨通往看不清的深处。", safe: "在洞口捡碎矿", minutes: [25, 55], risk: [0.04, 0.23], clues: [
      fieldClue("铁轨尽头泛着红光，岩壁上露出了新矿脉。", "沿窄轨凿富矿", "铁矿"),
      fieldClue("洞口有新鲜爪印，石壁上还蹭着兽毛。", "循着爪印查旧矿车", "兽皮", 0.12)
    ] },
    { name: "古墓", ring: 2, angle: 40, loot: { 古物: 80, 宝物: 20 }, scene: "石门只开了一道缝，门槛上散着碎陶，里头有侧室。", safe: "在门槛边拾旧物", minutes: [35, 65], risk: [0.08, 0.32], solo: "侧身悄悄摸进耳室", clues: [
      fieldClue("门口掉了半张地图，角上圈着一间耳室。", "按残图寻找暗格", "宝物", 0.1),
      fieldClue("塌土露出一段砖台，台沿排着陶片。", "扒开砖台寻古物", "古物")
    ] },
    { name: "乱葬岗", ring: 2, angle: 200, loot: { 宝物: 55, 古物: 45 }, scene: "几块残碑歪在坡上，过了枯树便听不见身后的脚步。", safe: "翻找坡脚的旧供台", minutes: [35, 70], risk: [0.11, 0.46], clues: [
      fieldClue("枯树根下透出一点金光，远处的铃却自己响了。", "掘开枯树根找金光", "宝物", 0.12),
      fieldClue("坡上的土被冲开了，露出一列旧香炉。", "顺着断碑寻旧供器", "古物", 0.04)
    ] }
  ];
  var HOME = { name: "家", x: 180, y: 180 };
  var SPOTS = sites.map((spot, id) => {
    const angle = spot.angle * Math.PI / 180;
    const radius = RINGS[spot.ring].r;
    return { ...spot, id, x: HOME.x + radius * Math.cos(angle), y: HOME.y + radius * Math.sin(angle) };
  });
  var TREASURES = [
    { n: "古玉", v: 90 },
    { n: "夜明珠", v: 140 },
    { n: "青铜剑", v: 110 },
    { n: "金步摇", v: 120 },
    { n: "玉玺残片", v: 160 },
    { n: "夜行衣", v: 80 }
  ];

  // src/core/loop/haunt.ts
  var HAUNT = {
    time: 25,
    door: 220,
    doorPerTier: 80,
    tiers: [1, 3],
    bash: 8,
    souls: 3,
    /** 躲一次能躲多久；躲着的时候砸不了门 */
    dodge: 0.75,
    /** 亮红光多久就射。躲闪要比这个长，按了躲就一定躲得开 */
    charge: 0.65,
    wait: [1.6, 2.8],
    /** 两台弩机的位置和第一次等多久 */
    bows: [{ x: 108, first: [1.4, 2] }, { x: 252, first: [2.6, 3.4] }],
    /** 砸开了：带进下一世的钱 */
    lootCoins: 30
  };
  function draw(h) {
    const rng = new Rng(1);
    rng.setState(h.rngState);
    return rng;
  }
  function between(rng, [lo, hi]) {
    return lo + rng.next() * (hi - lo);
  }
  function finish(h, result) {
    h.over = true;
    h.result = result;
  }
  function startHaunt(seed, tier) {
    const rng = new Rng(seed);
    const level2 = tier ?? rng.int(HAUNT.tiers[0], HAUNT.tiers[1]);
    const max = HAUNT.door + level2 * HAUNT.doorPerTier;
    const bows = HAUNT.bows.map((b) => ({ x: b.x, s: "wait", c: between(rng, b.first) }));
    return { tier: level2, door: max, max, souls: HAUNT.souls, t: HAUNT.time, dodge: 0, over: false, result: null, bows, rngState: rng.getState() };
  }
  function hauntBash(h) {
    if (h.over || h.dodge > 0) return false;
    h.door -= HAUNT.bash;
    if (h.door <= 0) finish(h, "win");
    return true;
  }
  function hauntDodge(h) {
    if (h.over) return false;
    h.dodge = HAUNT.dodge;
    return true;
  }
  function hauntStep(h, dt) {
    if (h.over) return [];
    const events = [];
    const rng = draw(h);
    h.t -= dt;
    if (h.dodge > 0) {
      h.dodge -= dt;
      if (h.dodge <= 0) events.push({ kind: "dodged-end" });
    }
    h.bows.forEach((b, i) => {
      b.c -= dt;
      if (b.s === "wait" && b.c <= 0) {
        b.s = "charge";
        b.c = HAUNT.charge;
        events.push({ kind: "charge", bow: i });
      } else if (b.s === "charge" && b.c <= 0) {
        b.s = "wait";
        b.c = between(rng, HAUNT.wait);
        const hit = h.dodge <= 0;
        if (hit) h.souls--;
        events.push({ kind: "shot", bow: i, hit });
      }
    });
    h.rngState = rng.getState();
    if (h.souls <= 0) finish(h, "caught");
    else if (h.t <= 0) finish(h, "timeout");
    return events;
  }
  function hauntOutcome(h) {
    if (h.result === "win") {
      const rng = draw(h);
      const loot = { ...rng.pick(TREASURES) };
      h.rngState = rng.getState();
      return { kind: "haunt", won: true, loot };
    }
    if (h.result === "caught") return { kind: "haunt", caught: true };
    return { kind: "haunt" };
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
    "worldId",
    "lastActiveDate",
    "skipAfterlife"
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
    "nightReceipt",
    "absencePeriods",
    "absenceReadThrough",
    "stove",
    "request"
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
    if (Array.isArray(h.absencePeriods)) house.absencePeriods = h.absencePeriods;
    if (typeof h.absenceReadThrough === "number") house.absenceReadThrough = count(h.absenceReadThrough);
    if (isObject(h.stove)) house.stove = h.stove;
    if (isObject(h.request)) house.request = h.request;
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
      const match2 = list(choice.ancestors).find((p) => p.note === note && p.name === game.name);
      if (match2) return match2;
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
    if (g.estateSettled) {
      depositCoins(g, g, g.purse);
      return;
    }
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
      purse: loot ? HAUNT.lootCoins : 0,
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

  // src/core/loop/night-config.ts
  var DOORS = [
    { name: "柴门", hp: 140, cost: 0 },
    { name: "木门", hp: 220, cost: 40 },
    { name: "铁皮门", hp: 340, cost: 100 },
    { name: "朱漆铜钉门", hp: 500, cost: 200 },
    { name: "机关大门", hp: 720, cost: 360 }
  ];
  var TRAPS = {
    crossbow: { name: "弩机", cost: 45, max: 4, desc: "每隔一会儿自动射最近的鬼" },
    lamp: { name: "灯笼串", cost: 30, max: 1, desc: "走到门口的隐身鬼会现形" },
    talisman: { name: "镇宅符", cost: 40, max: 2, desc: "门口的鬼走得慢" }
  };
  var NIGHT = {
    waves: 5,
    spread: 3.5,
    hpPerDay: 0.2,
    hpPerWave: 0.06,
    hitPerDay: 0.12,
    tap: 10,
    bowDmg: 12,
    bowCd: 1.4,
    allyDmg: 12,
    step: 0.05,
    waveDelay: 1.5,
    offerCount: 3,
    counts: {
      firstNightEvil: [3, 4, 6, 7, 9],
      evilBase: 3,
      evilPerDay: 0.4,
      extraEvery: 3,
      flyWave: 1,
      flyOffset: 1,
      shadeDay: 2,
      shadeWave: 3,
      shadeOffset: 3,
      armorLastWave: 4,
      armorDay: 3,
      armorWave: 2,
      armorOffset: 5
    },
    spawn: {
      lane: [-0.85, 0.85],
      y: [96, 122],
      gateXOffset: [-48, 48],
      gateYOffset: [-6, 4],
      speed: [0.85, 1.15],
      bashDelay: [0.2, 0.8],
      flyRise: 34,
      phase: [0, 6.28]
    },
    lane: {
      centerX: 180,
      gateY: 424,
      depthStart: 90,
      depthBase: 0.55,
      depthGain: 0.45,
      farWidth: 40,
      extraWidth: 114,
      widenFrom: 152,
      widenDistance: 262,
      mergeFrom: 0.72,
      mergeDistance: 0.28,
      flySwing: 22,
      flyFrequency: 2.2,
      flySettleDistance: 80,
      centerHeight: 44,
      hitRadius: 36,
      minHitScale: 0.8
    },
    reveal: { lamp: 150, wall: 330, eye: 240, flashTime: 0.25 },
    gate: { slowFrom: 300, talismanFactor: 0.72, bashCd: 1 },
    weapon: { hurt: 0.85, badlyHurt: 0.6, playerCoins: 2, lampX: 122, lampY: 466, lampRadius: 330 },
    perk: {
      heavy: 0.4,
      qi: 1.3,
      pierce: 0.6,
      ear: 0.5,
      critChance: 0.25,
      critCap: 0.75,
      critDamage: 3,
      sweepRadius: 70,
      sweepFactor: 0.5,
      burnInterval: 0.5,
      burnMinY: 150,
      burnDamage: 2.5,
      rainKills: 5,
      rainDamage: 15,
      soul: 3,
      coins: 3,
      fix: 0.4,
      fixBelow: 0.8,
      bolt: 0.7,
      slow: 0.7
    },
    bows: {
      x: [40, 320, 92, 268],
      y: 410,
      fromY: 150,
      firstCd: 1,
      stagger: 0.35,
      giftCd: 0.5,
      fastFactor: 0.5,
      minCd: 0.35,
      idleCd: 0.2
    },
    family: {
      spouseDamage: 6,
      spouseCd: 1,
      spouseRate: 0.8,
      maxKids: 2,
      childBaseDamage: 4,
      childRate: 1.2,
      childCd: 1.2,
      childStagger: 0.3,
      idleCd: 0.2
    },
    ally: { duration: 18, firstCd: 0.4, rate: 0.45, idleCd: 0.15, friendship: 2, maxFriendship: 100 },
    guardian: { power: 1.25, slow: 0.65 }
  };
  function waveCounts(d, w, swordOnly = false) {
    const c = NIGHT.counts;
    if (d === 1 && swordOnly) return { evil: c.firstNightEvil[w], fly: 0, shade: 0, armor: 0 };
    return {
      evil: c.evilBase + w + Math.floor(c.evilPerDay * (d - 1)),
      fly: w >= c.flyWave ? 1 + Math.floor((d + w - c.flyOffset) / c.extraEvery) : 0,
      shade: d >= c.shadeDay || w >= c.shadeWave ? 1 + Math.floor(Math.max(0, d + w - c.shadeOffset) / c.extraEvery) : 0,
      armor: w === c.armorLastWave || d >= c.armorDay && w >= c.armorWave ? 1 + Math.floor(Math.max(0, d + w - c.armorOffset) / c.extraEvery) : 0
    };
  }

  // src/core/loop/auto-defense.ts
  var AUTO_DEFENSE = {
    floor: 0.05,
    ceiling: 0.95,
    startingScore: -0.96,
    door: 1.5,
    crossbow: 0.85,
    lamp: 0.24,
    talisman: 0.48,
    day: 0.17,
    daySquared: 0.065,
    lossFraction: 0.1,
    lossCap: 20,
    paperShare: 0.5,
    heldKarma: 8,
    brokenKarma: 4,
    coinsPerKarma: 20,
    estateKarmaCap: 20
  };
  var digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  function level(value, maximum) {
    return Math.min(maximum, Math.max(0, Math.floor(value ?? 0)));
  }
  function defenseChance(day, door, traps) {
    const c = AUTO_DEFENSE;
    const elapsed = Math.max(0, day - 1);
    const hp = DOORS[level(door, DOORS.length - 1)].hp;
    const defense = c.startingScore + c.door * Math.log(hp / DOORS[0].hp) + c.crossbow * level(traps.crossbow, TRAPS.crossbow.max) + c.lamp * level(traps.lamp, TRAPS.lamp.max) + c.talisman * level(traps.talisman, TRAPS.talisman.max);
    const threat = c.day * elapsed + c.daySquared * elapsed ** 2;
    return c.floor + (c.ceiling - c.floor) / (1 + Math.exp(threat - defense));
  }
  function chanceLabel(probability) {
    if (probability <= 0) return "零成";
    if (probability >= 1) return "十成";
    return digits[Math.max(1, Math.min(9, Math.round(probability * 10)))] + "成";
  }
  function autoLossLimit(chest, lifeNo) {
    return lifeNo <= 1 ? 0 : Math.min(AUTO_DEFENSE.lossCap, Math.floor(Math.max(0, chest) * AUTO_DEFENSE.lossFraction));
  }
  function nightKarma(held, autoHeld = 0, broken = 0, earned = 0) {
    const c = AUTO_DEFENSE;
    const heldScore = (held - Math.min(held, autoHeld) / 2) * c.heldKarma;
    return Math.min(c.estateKarmaCap, heldScore - broken * c.brokenKarma + Math.floor(earned / c.coinsPerKarma));
  }
  function isAutoReceipt(receipt) {
    return "mode" in receipt && (receipt.mode === "delegated" || receipt.mode === "offline");
  }
  function paperReward(day, guided) {
    let ghosts = 0;
    for (let wave = 0; wave < NIGHT.waves; wave++) {
      for (const count2 of Object.values(waveCounts(day, wave, guided))) ghosts += count2;
    }
    return Math.floor(ghosts * NIGHT.weapon.playerCoins * AUTO_DEFENSE.paperShare);
  }
  function settleAutoNight(game, options) {
    const { mode, nightId, realDate, progress } = options;
    const guardian = options.guardian ?? false;
    if (options.houseId !== void 0 && options.houseId !== game.houseId || options.lifeId !== void 0 && options.lifeId !== game.lifeId) return null;
    const prior = game.receipts[nightId];
    if (prior) {
      return isAutoReceipt(prior) && prior.houseId === game.houseId && prior.lifeId === game.lifeId && prior.guardian === guardian && prior.mode === mode && prior.realDate === realDate && (options.day === void 0 || prior.day === options.day) ? prior : null;
    }
    if (!Number.isSafeInteger(nightId) || options.day !== void 0 && options.day !== game.day) return null;
    const plan = game.nightPlan;
    const fightPhase = guardian ? "guard" : "night";
    if (plan) {
      if (!progress || game.phase !== fightPhase || game.nightId !== nightId || !sameNight(plan, { ...game, guardian, nightId })) return null;
    } else if (nightId !== game.nightId + 1) return null;
    if (progress && (game.nightReceipt || game.phase !== fightPhase && (guardian || game.phase !== "home"))) return null;
    const day = guardian ? CFG.lifeDays : game.day;
    const chance = defenseChance(day, game.door, game.traps);
    const seed = (plan?.seed ?? options.seed) >>> 0;
    const rng = new Rng(1);
    rng.setState(seed);
    const won = rng.chance(chance);
    const chestLost = !won && options.allowLoss ? autoLossLimit(game.chest, game.lifeNo) : 0;
    const earnedMoney = won && mode === "delegated" ? paperReward(day, !guardian && !game.allFeatures) : 0;
    const subject = mode === "offline" ? "你不在时，机关" : "机关";
    let report;
    if (won && mode === "offline") report = "你不在时，机关守住了家门。";
    else if (won) report = `${subject}守住了家门，${earnedMoney} 文纸钱已放进钱袋。`;
    else if (game.lifeNo <= 1) report = `${subject}没守住，好在新家有保护，没丢东西。`;
    else if (chestLost > 0) report = `${subject}没守住，钱箱少了 ${chestLost} 文。`;
    else report = `${subject}没守住，钱箱里的钱一文没少。`;
    const receipt = {
      houseId: game.houseId,
      lifeId: game.lifeId,
      nightId,
      day: game.day,
      guardian,
      mode,
      realDate,
      seed,
      chance,
      won,
      earnedMoney,
      chestLost,
      purseLost: 0,
      lostTreasureIndex: null,
      lostTreasure: null,
      next: guardian ? "reborn" : game.day >= CFG.lifeDays ? "old" : "morning",
      paragraphs: [report]
    };
    game.chest -= chestLost;
    game.purse += earnedMoney;
    if (won) {
      game.held++;
      game.autoHeld = (game.autoHeld ?? 0) + 1;
    } else game.autoBroken = (game.autoBroken ?? 0) + 1;
    game.nightId = nightId;
    game.receipts[nightId] = receipt;
    if (progress) {
      if (guardian) game.afterlife = { kind: "guard", won, automatic: true };
      game.nightPlan = null;
      game.nightReceipt = receipt;
      game.phase = "dawn";
    }
    return receipt;
  }

  // src/core/loop/absence.ts
  function markActiveDate(account, today) {
    dateOrdinal(today);
    if (account.lastActiveDate && today <= account.lastActiveDate) return false;
    account.lastActiveDate = today;
    return true;
  }
  function returnFromField(game) {
    game.goods = { ...game.goods };
    game.personalTreasures = [...game.personalTreasures];
    unpackBag(game);
    if (game.river) {
      const river = { ...game.river, fromWharf: false };
      if (game.phase === "river") {
        const hand = river.hand;
        if (hand === "stone") {
          river.stone = "yard";
          river.yardSlot = 1;
        } else if (typeof hand === "string" && /^wood\d+$/.test(hand) && Array.isArray(river.wood)) {
          const wood = [...river.wood];
          wood[Number(hand.slice(4))] = "firewood";
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
    game.at = "home";
    game.target = null;
    game.phase = "home";
  }
  function reconcileAbsence(game, today, seed) {
    const end = dateOrdinal(today);
    const start = game.lastActiveDate;
    if (!start || game.phase === "intro") return { count: 0, changed: markActiveDate(game, today) };
    const days = end - dateOrdinal(start);
    if (days <= 0) return { count: 0, changed: false };
    const next = { ...game, receipts: { ...game.receipts } };
    if (next.phase === "map" || next.phase === "river") returnFromField(next);
    const unfinished = !next.nightReceipt && ["home", "night", "guard"].includes(next.phase);
    let date = start;
    let allowLoss = true;
    for (let i = 0; i < days; i++) {
      const progress = i === 0 && unfinished;
      const plan = progress ? next.nightPlan : null;
      const nightId = plan?.nightId ?? next.nightId + 1;
      const draw2 = plan?.seed ?? (typeof seed === "number" ? seed + i >>> 0 : seed(date, nightId));
      const receipt = settleAutoNight(next, {
        mode: "offline",
        realDate: date,
        nightId,
        seed: draw2,
        progress,
        guardian: progress && next.phase === "guard",
        allowLoss
      });
      if (!receipt) throw new Error("离开期间的来袭与现有夜账不一致");
      if (receipt.chestLost > 0) allowLoss = false;
      date = nextCalendarDate(date);
    }
    next.lastActiveDate = today;
    Object.assign(game, next);
    return { count: days, changed: true };
  }
  function isOffline(receipt) {
    return "mode" in receipt && receipt.mode === "offline";
  }
  function summarize(game, after, through) {
    const events = Object.values(game.receipts).filter((r) => isOffline(r) && r.nightId > after && r.nightId <= through).sort((a, b) => a.nightId - b.nightId);
    if (!events.length) return null;
    const first = events[0], last = events[events.length - 1];
    let won = 0, chestLost = 0, earnedMoney = 0;
    for (const event of events) {
      if (event.won) won++;
      chestLost += event.chestLost;
      earnedMoney += event.earnedMoney;
    }
    return {
      firstNightId: first.nightId,
      lastNightId: last.nightId,
      fromDate: first.realDate,
      toDate: last.realDate,
      days: events.length,
      raids: events.length,
      won,
      broken: events.length - won,
      chestLost,
      earnedMoney
    };
  }
  function getAbsenceSummary(game, kind = "unread") {
    const unread = summarize(game, game.absenceReadThrough ?? 0, Infinity);
    if (unread || kind === "unread") return unread;
    const history = game.absencePeriods;
    const last = history?.[history.length - 1];
    return last ? summarize(game, last.firstNightId - 1, last.lastNightId) : null;
  }
  function markAbsenceRead(game, lastNightId) {
    const seen = game.absenceReadThrough ?? 0;
    if (!Number.isSafeInteger(lastNightId) || lastNightId <= seen) return false;
    const summary = summarize(game, seen, lastNightId);
    if (!summary || summary.lastNightId !== lastNightId) return false;
    (game.absencePeriods ?? (game.absencePeriods = [])).push({ firstNightId: summary.firstNightId, lastNightId });
    game.absenceReadThrough = lastNightId;
    return true;
  }

  // src/core/loop/trade.ts
  var TRADE = {
    /** 当天价 = 基础价 × (1 ± swing)，第 1 天固定用基础价 */
    priceSwing: 0.2,
    /** 和基础价差到一成，集市里才标「今天贵 / 今天便宜」 */
    badgeAt: 0.1,
    recipes: {
      charcoal: { name: "木炭", input: { 柴: 3 }, output: "木炭", count: 1 },
      salve: { name: "金疮药", input: { 草药: 2 }, output: "金疮药", count: 1 }
    },
    /** 疗伤一次回几点体力 */
    heal: { 草药: 1, 金疮药: 2 },
    request: {
      payRate: 1.5,
      friendship: 5,
      maxFriendship: 100,
      /** 接单当天算第 1 天，一共几天内要交 */
      days: 2,
      /** 托付的东西和数量范围：都是一两天能凑齐的 */
      wants: { 柴: [4, 6], 时蔬: [2, 3], 草药: [2, 3], 兽皮: [1, 1], 木炭: [1, 2], 金疮药: [1, 1] }
    },
    /** 带路下第几天开放（全部开放时不看天数） */
    unlock: { prices: 2, stove: 3, requests: 4 }
  };
  function seedOf(text) {
    let h = 2166136261;
    for (const ch of text) {
      h ^= ch.codePointAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function stream(lifeId, day, topic) {
    return new Rng(seedOf(lifeId + "#" + day + "#" + topic));
  }
  function positiveInt2(n) {
    return Number.isSafeInteger(n) && n > 0;
  }
  function has(stock, input) {
    return Object.entries(input).every(([kind, n]) => (stock[kind] ?? 0) >= n);
  }
  function take2(stock, kind, n) {
    const left = (stock[kind] ?? 0) - n;
    if (left > 0) stock[kind] = left;
    else delete stock[kind];
  }
  function add(stock, kind, n) {
    stock[kind] = (stock[kind] ?? 0) + n;
  }
  function dayPrices(lifeId, day) {
    const prices = { ...GOODS };
    if (day <= 1) return prices;
    const rng = stream(lifeId, day, "prices");
    for (const kind of Object.keys(GOODS)) {
      const mult = 1 - TRADE.priceSwing + rng.next() * 2 * TRADE.priceSwing;
      prices[kind] = Math.max(1, Math.round(GOODS[kind] * mult));
    }
    return prices;
  }
  function priceTrend(prices, kind) {
    const base = GOODS[kind];
    const price = prices[kind];
    if (!base || !price) return null;
    if (price >= base * (1 + TRADE.badgeAt)) return "up";
    if (price <= base * (1 - TRADE.badgeAt)) return "down";
    return null;
  }
  function stoveStatus(job, lifeId, day) {
    if (!job) return "empty";
    return job.lifeId !== lifeId || day > job.day ? "ready" : "cooking";
  }
  function canCook(house, person, recipe, owner) {
    const r = TRADE.recipes[recipe];
    if (!r || house.stove) return false;
    return has(owner === "house" ? house.store : person.goods, r.input);
  }
  function startStove(house, person, recipe, owner, at) {
    if (!canCook(house, person, recipe, owner)) return null;
    const stock = owner === "house" ? house.store : person.goods;
    for (const [kind, n] of Object.entries(TRADE.recipes[recipe].input)) take2(stock, kind, n);
    const job = { jobId: at.lifeId + "/d" + at.day, recipe, owner, lifeId: at.lifeId, day: at.day };
    house.stove = job;
    return job;
  }
  function collectStove(house, person, at) {
    const job = house.stove;
    if (!job || stoveStatus(job, at.lifeId, at.day) !== "ready") return null;
    const r = TRADE.recipes[job.recipe];
    const owner = job.owner === "person" && job.lifeId === at.lifeId ? "person" : "house";
    add(owner === "person" ? person.goods : house.store, r.output, r.count);
    house.stove = null;
    return { kind: r.output, count: r.count, owner };
  }
  function useHealing(house, person, kind) {
    const amount = TRADE.heal[kind];
    if (!amount) return null;
    for (const [owner, stock] of [["person", person.goods], ["house", house.store]]) {
      if ((stock[kind] ?? 0) > 0) {
        take2(stock, kind, 1);
        return { owner, amount };
      }
    }
    return null;
  }
  function offerFor(lifeId, day, neighbors) {
    if (!neighbors.length) return null;
    const rng = stream(lifeId, day, "request");
    const neighbor = rng.pick(neighbors);
    const kind = rng.pick(Object.keys(TRADE.request.wants));
    const [lo, hi] = TRADE.request.wants[kind];
    const count2 = rng.int(lo, hi);
    const pay = Math.round(GOODS[kind] * count2 * TRADE.request.payRate);
    return { id: lifeId + "/r" + day, lifeId, day, neighbor, kind, count: count2, pay, status: "offered" };
  }
  function refreshRequest(house, lifeId, day) {
    const r = house.request;
    if (r?.status === "accepted" && (r.lifeId !== lifeId || day > r.dueDay)) r.status = "expired";
  }
  function requestBoard(house, lifeId, day, neighbors) {
    refreshRequest(house, lifeId, day);
    const r = house.request;
    if (r?.status === "accepted") return { active: r, offer: null };
    if (r && r.lifeId === lifeId && r.day === day) return { active: null, offer: null };
    return { active: null, offer: offerFor(lifeId, day, neighbors) };
  }
  function acceptRequest(house, lifeId, day, neighbors) {
    const { active, offer } = requestBoard(house, lifeId, day, neighbors);
    if (active || !offer) return null;
    house.request = { ...offer, status: "accepted", acceptedDay: day, dueDay: day + TRADE.request.days - 1 };
    return house.request;
  }
  function planDelivery(house, person) {
    const r = house.request;
    if (!r || r.status !== "accepted") return null;
    const mine = Math.min(person.goods[r.kind] ?? 0, r.count);
    const home = Math.min(house.store[r.kind] ?? 0, r.count - mine);
    return { person: mine, house: home, short: r.count - mine - home };
  }
  function deliverRequest(house, person, at) {
    refreshRequest(house, at.lifeId, at.day);
    const r = house.request;
    const plan = planDelivery(house, person);
    if (!r || !plan || plan.short > 0 || !positiveInt2(r.count)) return null;
    take2(person.goods, r.kind, plan.person);
    take2(house.store, r.kind, plan.house);
    const purse = Math.floor(r.pay * plan.person / r.count);
    const chest = r.pay - purse;
    person.purse += purse;
    house.chest += chest;
    const T = TRADE.request;
    person.friends[r.neighbor] = Math.min(T.maxFriendship, (person.friends[r.neighbor] ?? 0) + T.friendship);
    r.status = "done";
    return { purse, chest, friendship: T.friendship, neighbor: r.neighbor };
  }

  // src/core/loop/family.ts
  var FAMILY = {
    /** 红线到多少算哪一级。一辈子之内最多到挚爱 */
    threads: [[0, "相识"], [20, "知己"], [45, "倾心"], [70, "挚爱"]],
    /** 爹娘红线 → 孩子品级和强弱。品级主要给面子，强弱最多差三成 */
    grades: { 相识: ["寻常", 1], 知己: ["良才", 1.05], 倾心: ["上等", 1.1], 挚爱: ["奇才", 1.2] },
    maxLove: 100,
    /** 刚牵上红线 */
    matchLove: 10,
    /** 有伴侣时每天早上 */
    dawnLove: 8,
    /** 陪伴：花 1 个时辰 */
    accompany: { minutes: 120, love: 12 },
    /** 红线到知己、第 3 天起，一天最多生一个，最多两个孩子 */
    birth: { minLove: 20, maxKids: 2, fromDay: 3 },
    /** 收徒：家里的事，先用钱箱。品级看这一世守住了几夜 */
    disciple: { cost: 30, max: 2, grades: [[3, "上等", 1.1], [1, "良才", 1.05], [0, "寻常", 1]] }
  };
  function threadName(love) {
    let name = "相识";
    for (const [min, n] of FAMILY.threads) if (love >= min) name = n;
    return name;
  }
  function gradeFor(love) {
    return FAMILY.grades[threadName(love)];
  }
  function match(s, spouse) {
    if (s.spouse || !spouse) return false;
    s.spouse = spouse;
    s.love = FAMILY.matchLove;
    return true;
  }
  function canAccompany(s) {
    return !!s.spouse && s.time + FAMILY.accompany.minutes <= CFG.dusk;
  }
  function accompany(s) {
    if (!canAccompany(s)) return false;
    s.time += FAMILY.accompany.minutes;
    s.love = Math.min(FAMILY.maxLove, s.love + FAMILY.accompany.love);
    return true;
  }
  function dawnLove(s) {
    if (s.spouse) s.love = Math.min(FAMILY.maxLove, s.love + FAMILY.dawnLove);
  }
  function canBirth(s) {
    const B = FAMILY.birth;
    const kids = s.kids.filter((k) => k.kind !== "徒").length;
    return !!s.spouse && s.love >= B.minLove && kids < B.maxKids && s.day >= B.fromDay && s.bornToday !== s.day;
  }
  function birth(s, rng) {
    if (!canBirth(s)) return null;
    const [grade, power] = gradeFor(s.love);
    const kid = { kind: rng.chance(0.5) ? "子" : "女", grade, power };
    s.kids.push(kid);
    s.bornToday = s.day;
    return kid;
  }
  function discipleGrade(held) {
    const row = FAMILY.disciple.grades.find(([min]) => held >= min);
    return [row[1], row[2]];
  }
  function canTakeDisciple(s) {
    return s.kids.filter((k) => k.kind === "徒").length < FAMILY.disciple.max && !quoteHome(s, s, FAMILY.disciple.cost).shortfall;
  }
  function takeDisciple(s) {
    if (s.kids.filter((k) => k.kind === "徒").length >= FAMILY.disciple.max) return null;
    const payment = payHome(s, s, FAMILY.disciple.cost);
    if (!payment) return null;
    const [grade, power] = discipleGrade(s.held);
    const kin = { kind: "徒", grade, power };
    s.kids.push(kin);
    return { kin, payment };
  }

  // src/core/loop/rebirth.ts
  var AFTERLIFE = { night: true };
  var REBIRTH = {
    /** 因果分 < 30 寻常人家，< 70 殷实人家，其余名门望族 */
    tierAt: [30, 70],
    tierNames: ["寻常人家", "殷实人家", "名门望族"],
    /** 各档人家的家底范围 */
    families: [
      { door: [0, 1], money: [10, 40], crossbow: [0, 0], lamp: 0, talisman: 0, treasures: [0, 0] },
      { door: [1, 2], money: [50, 110], crossbow: [1, 1], lamp: 0, talisman: 0, treasures: [0, 1] },
      { door: [2, 4], money: [120, 240], crossbow: [2, 3], lamp: 1, talisman: 1, treasures: [1, 2] }
    ],
    /** 各档人家爹娘的红线 */
    threads: [["相识", "知己"], ["知己", "倾心"], ["倾心", "挚爱"]],
    karma: {
      friendsPer: 10,
      kinEach: 10,
      kinCap: 40,
      thread: { 相识: 0, 知己: 5, 倾心: 15, 挚爱: 25 },
      guardWin: 20,
      guardLose: 5,
      hauntWin: 5,
      hauntCaught: -10,
      early: -5
    },
    /** 回自家投胎时，爹娘（上一世的后人）红线在这个范围里随 */
    ownLove: [20, 60],
    /** 交情深的邻居下一世还记得你（留一半）；其余随机重新认识 */
    friends: { keepAt: CFG.helpAt, keepShare: 0.5, fresh: [0, 15] }
  };
  function karmaRows(g, neighbors) {
    const K = REBIRTH.karma;
    const autoHeld = g.autoHeld ?? 0;
    const friends = neighbors.reduce((a, id) => a + (g.friends[id] ?? 0), 0);
    const rows = [
      [
        "家业",
        `亲守 ${g.held - autoHeld} 夜，机关守住 ${autoHeld} 夜，亲守破门 ${g.broken} 次，赚 ${g.earned} 文`,
        nightKarma(g.held, autoHeld, g.broken, g.earned)
      ],
      ["交情", `合计 ${friends}`, Math.floor(friends / K.friendsPer)],
      ["养育", `${g.kids.length} 个孩子或徒弟`, Math.min(K.kinCap, g.kids.length * K.kinEach)],
      ["红线", g.spouse ? threadName(g.love) : "没有", g.spouse ? K.thread[threadName(g.love)] : 0]
    ];
    const A = g.afterlife;
    if (A?.kind === "guard" && !A.automatic) rows.push(["当护家神", A.won ? "守住了" : "没守住", A.won ? K.guardWin : K.guardLose]);
    if (A?.kind === "haunt") rows.push(["当厉鬼", A.won ? "得手了" : A.caught ? "被收进葫芦" : "没砸开", A.won ? K.hauntWin : A.caught ? K.hauntCaught : 0]);
    if (g.deathKind === "early") rows.push(["英年早逝", "", K.early]);
    return rows;
  }
  function karmaTotal(rows) {
    return rows.reduce((a, r) => a + r[2], 0);
  }
  function tierOf(total) {
    return total < REBIRTH.tierAt[0] ? 0 : total < REBIRTH.tierAt[1] ? 1 : 2;
  }
  function newFamily(tier, rng) {
    const R = REBIRTH.families[tier];
    const between2 = ([lo, hi]) => rng.int(lo, hi);
    return {
      door: between2(R.door),
      money: between2(R.money),
      crossbow: between2(R.crossbow),
      lamp: R.lamp,
      talisman: R.talisman,
      thread: rng.pick(REBIRTH.threads[tier]),
      treasures: Array.from({ length: between2(R.treasures) }, () => ({ ...rng.pick(TREASURES), tre: true }))
    };
  }
  function strangerTiers(tier, heirs) {
    return heirs ? [tier, Math.max(0, tier - 1)] : [tier, tier, Math.max(0, tier - 1)];
  }
  function ownThread(rng) {
    return threadName(rng.int(REBIRTH.ownLove[0], REBIRTH.ownLove[1]));
  }
  function carryFriends(prev, neighbors, rng) {
    const F = REBIRTH.friends;
    const out = {};
    for (const id of neighbors) {
      const v = prev[id] ?? 0;
      out[id] = v >= F.keepAt ? Math.floor(v * F.keepShare) : rng.int(F.fresh[0], F.fresh[1]);
    }
    return out;
  }
  return __toCommonJS(browser_exports);
})();
