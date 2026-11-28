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
    COOP: () => COOP,
    DOORS: () => DOORS,
    FAMILY: () => FAMILY,
    FIREWOOD_PER_LOG: () => FIREWOOD_PER_LOG,
    GHOSTS: () => GHOSTS,
    GOODS: () => GOODS,
    HAUNT: () => HAUNT,
    MULT: () => MULT,
    NIGHT: () => NIGHT,
    PERKS: () => PERKS,
    REBIRTH: () => REBIRTH,
    Rng: () => Rng,
    TRADE: () => TRADE,
    TRAPS: () => TRAPS,
    YARD: () => YARD,
    acceptRequest: () => acceptRequest,
    accompany: () => accompany,
    accrueDays: () => accrueDays,
    addLifePortrait: () => addLifePortrait,
    applyNightAction: () => applyNightAction,
    autoLossLimit: () => autoLossLimit,
    beginNightLedger: () => beginNightLedger,
    birth: () => birth,
    buyDecor: () => buyDecor,
    buyPlaque: () => buyPlaque,
    canAccompany: () => canAccompany,
    canBirth: () => canBirth,
    canCook: () => canCook,
    canGift: () => canGift,
    canTakeDisciple: () => canTakeDisciple,
    carryFriends: () => carryFriends,
    chanceLabel: () => chanceLabel,
    collectStove: () => collectStove,
    dawnLove: () => dawnLove,
    dayPrices: () => dayPrices,
    decorCount: () => decorCount,
    decorSlots: () => decorSlots,
    defenseChance: () => defenseChance,
    deliverRequest: () => deliverRequest,
    depositCoins: () => depositCoins,
    discipleGrade: () => discipleGrade,
    expandYard: () => expandYard,
    finishLife: () => finishLife,
    freeStove: () => freeStove,
    fromView: () => fromView,
    getAbsenceSummary: () => getAbsenceSummary,
    ghostAt: () => ghostAt,
    ghostCenter: () => ghostCenter,
    giveGift: () => giveGift,
    givePersonalGood: () => givePersonalGood,
    goodsValue: () => goodsValue,
    gradeFor: () => gradeFor,
    hauntBash: () => hauntBash,
    hauntDodge: () => hauntDodge,
    hauntOutcome: () => hauntOutcome,
    hauntStep: () => hauntStep,
    helpCandidates: () => helpCandidates,
    karmaRows: () => karmaRows,
    karmaTotal: () => karmaTotal,
    lampHeld: () => lampHeld,
    leaveGuardianReward: () => leaveGuardianReward,
    makeDayBank: () => makeDayBank,
    makeHouse: () => makeHouse,
    makePerson: () => makePerson,
    markAbsenceRead: () => markAbsenceRead,
    markActiveDate: () => markActiveDate,
    match: () => match,
    migrateSave: () => migrateSave,
    moveDecor: () => moveDecor,
    nearestGhost: () => nearestGhost,
    newFamily: () => newFamily,
    nextLifeView: () => nextLifeView,
    nextYard: () => nextYard,
    nightKarma: () => nightKarma,
    nightPayout: () => nightPayout,
    nightStep: () => nightStep,
    offerFor: () => offerFor,
    ownThread: () => ownThread,
    paperReward: () => paperReward,
    payHome: () => payHome,
    payPersonal: () => payPersonal,
    planDelivery: () => planDelivery,
    planNightLoot: () => planNightLoot,
    priceTrend: () => priceTrend,
    quoteHome: () => quoteHome,
    quoteYard: () => quoteYard,
    reconcileAbsence: () => reconcileAbsence,
    refreshRequest: () => refreshRequest,
    removeDecor: () => removeDecor,
    requestBoard: () => requestBoard,
    revealed: () => revealed,
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
    startNight: () => startNight,
    startStove: () => startStove,
    storeBelongings: () => storeBelongings,
    stoveCount: () => stoveCount,
    stoveJobs: () => stoveJobs,
    stoveStatus: () => stoveStatus,
    strangerTiers: () => strangerTiers,
    takeDisciple: () => takeDisciple,
    threadName: () => threadName,
    tierOf: () => tierOf,
    toView: () => toView,
    unpackBag: () => unpackBag,
    useHealing: () => useHealing,
    useHerb: () => useHerb,
    yardInfo: () => yardInfo,
    yardLevel: () => yardLevel
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
  var RULE_VERSION = 2;
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
  var AGE_FX = {
    child: { dmg: 0.8, fight: -0.1, walk: 1 },
    adult: { dmg: 1, fight: 0, walk: 1 },
    elder: { dmg: 0.85, fight: -0.05, walk: 1.2 }
  };
  var AGE_LIMITS = { adult: 0.2, elder: 0.7 };
  function balanceAge(day) {
    const fraction = (day - 1) / Math.max(1, CFG.lifeDays - 1);
    if (fraction < AGE_LIMITS.adult) return "child";
    return fraction < AGE_LIMITS.elder ? "adult" : "elder";
  }
  function nextRandom(stream2) {
    const rng = new Rng(1);
    rng.setState(stream2.rngState);
    const value = rng.next();
    stream2.rngState = rng.getState();
    return value;
  }

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
  var FIRST_PERSON = { power: 1.05, friends: { wang: 26, li: 8, zhao: 0 } };
  function makeHouse() {
    return { door: 0, traps: { crossbow: 0, lamp: 0, talisman: 0 }, chest: 0, store: {}, treasures: [] };
  }
  function makePerson() {
    return {
      day: 1,
      time: CFG.dayStart,
      hp: CFG.hpMax,
      bag: [],
      purse: 0,
      goods: {},
      personalTreasures: [],
      item: "sword",
      power: FIRST_PERSON.power,
      friends: { ...FIRST_PERSON.friends }
    };
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
        const hit2 = h.dodge <= 0;
        if (hit2) h.souls--;
        events.push({ kind: "shot", bow: i, hit: hit2 });
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
    "stoves",
    "request",
    "yardLevel",
    "decor",
    "plaque"
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
    "yard",
    "yardLevel",
    "decorCount"
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
      ancestors: [...house.ancestors],
      yardLevel: house.yardLevel ?? 0,
      decorCount: (house.decor ?? []).filter(Boolean).length + (house.plaque ? 1 : 0)
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
    if (Array.isArray(h.stoves)) house.stoves = h.stoves.map((j) => isObject(j) ? j : null);
    else if (isObject(h.stove)) house.stoves = [h.stove];
    if (typeof h.yardLevel === "number") house.yardLevel = count(h.yardLevel);
    if (Array.isArray(h.decor)) house.decor = h.decor.map((k) => typeof k === "string" ? k : null);
    if (h.plaque === true) house.plaque = true;
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
  var GHOSTS = {
    evil: { name: "恶鬼", hp: 42, speed: 26, hit: 7, tag: null },
    fly: { name: "飞鬼", hp: 30, speed: 34, hit: 5, tag: ["飞", "#9CC9F0"] },
    shade: { name: "隐身鬼", hp: 34, speed: 24, hit: 8, tag: ["隐", "#B9A2E8"] },
    armor: { name: "铁甲鬼", hp: 70, speed: 18, hit: 11, tag: ["甲", "#B8BFC9"] }
  };
  var MULT = {
    sword: { evil: 1.5, fly: 0.3, shade: 1, armor: 0.5 },
    bow: { evil: 0.9, fly: 2, shade: 0.9, armor: 0.5 },
    lamp: { evil: 0.6, fly: 0.6, shade: 1.5, armor: 0.4 }
  };
  var PERKS = {
    heavy: { n: "重手", d: "点一下伤害 +40%，铁甲也挡不住", stack: true },
    crit: { n: "会心一击", d: "每下有 25% 机会打出三倍伤害", stack: true },
    sweep: { n: "横扫", d: "点中一个鬼，旁边的鬼也挨一半", stack: false },
    qi: { n: "剑气", d: "剑能砍到天上的飞鬼", stack: false },
    pierce: { n: "穿云箭", d: "弓的伤害 +60%", stack: true },
    burn: { n: "灯光烧鬼", d: "提着灯时，灯光里的鬼一直掉血", stack: true },
    ear: { n: "听声辨位", d: "看不见的鬼也能打，伤害减半", stack: false },
    eye: { n: "火眼", d: "隐身鬼走到半路就现形", stack: false },
    lampstr: { n: "挂灯笼", d: "今晚墙上多挂一串灯笼，门口的隐身鬼现形", stack: false },
    bowplus: { n: "连弩", d: "每台弩机多射一个鬼；没有弩机就先送你一台", stack: true },
    bowfast: { n: "快弩", d: "弩机射得快一倍", stack: true },
    rain: { n: "剑雨", d: "每打散 5 个鬼，全场落一阵剑雨", stack: true },
    fix: { n: "连夜补门", d: "门马上回 40% 的血", stack: true },
    bolt: { n: "铁门栓", d: "门挨的打少三成", stack: true },
    slow: { n: "定身符", d: "门口的鬼走得更慢", stack: true },
    soul: { n: "吸魂", d: "每打散一个鬼，门回 3 点血", stack: true },
    coins: { n: "纸钱雨", d: "每打散一个鬼，多掉 3 文纸钱", stack: true }
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
  var COOP = { maxGuests: 1, ghostScale: 1.5 };
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

  // src/core/loop/home.ts
  var YARD = {
    levels: [
      { name: "小院", cost: 0, stoves: 1, slots: 3 },
      { name: "中院", cost: 120, stoves: 2, slots: 5 },
      { name: "大宅", cost: 300, stoves: 3, slots: 7 }
    ],
    decor: {
      pot: { name: "盆栽", cost: 10, note: "一盆小松" },
      vat: { name: "水缸", cost: 15, note: "养着两尾鱼" },
      table: { name: "石桌石凳", cost: 25, note: "夏天能在院里吃饭" },
      tree: { name: "桂花树", cost: 40, note: "会开花，满院香" }
    },
    /** 匾额挂在门楣上，写着家名，不占院里的位置 */
    plaque: { name: "匾额", cost: 60, note: "门楣上挂着家名" }
  };
  function yardLevel(h) {
    const level2 = h.yardLevel ?? 0;
    return Number.isInteger(level2) && level2 >= 0 && level2 < YARD.levels.length ? level2 : 0;
  }
  function yardInfo(h) {
    return YARD.levels[yardLevel(h)];
  }
  function stoveCount(h) {
    return yardInfo(h).stoves;
  }
  function decorSlots(h) {
    const n = yardInfo(h).slots;
    const slots = (h.decor ?? []).slice(0, n).map((k) => k && k in YARD.decor ? k : null);
    while (slots.length < n) slots.push(null);
    return slots;
  }
  function decorCount(h) {
    return decorSlots(h).filter(Boolean).length + (h.plaque ? 1 : 0);
  }
  function nextYard(h) {
    return YARD.levels[yardLevel(h) + 1] ?? null;
  }
  function quoteYard(h, person) {
    const next = nextYard(h);
    return next ? quoteHome(h, person, next.cost) : null;
  }
  function expandYard(h, person) {
    const next = nextYard(h);
    if (!next) return null;
    const payment = payHome(h, person, next.cost);
    if (!payment) return null;
    h.yardLevel = yardLevel(h) + 1;
    h.decor = decorSlots(h);
    return payment;
  }
  function buyDecor(h, person, kind, slot) {
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
  function moveDecor(h, from, to) {
    const slots = decorSlots(h);
    if (from === to || !slots[from] || to < 0 || to >= slots.length) return false;
    [slots[from], slots[to]] = [slots[to], slots[from]];
    h.decor = slots;
    return true;
  }
  function removeDecor(h, slot) {
    const slots = decorSlots(h);
    const kind = slots[slot] ?? null;
    if (!kind) return null;
    slots[slot] = null;
    h.decor = slots;
    return kind;
  }
  function buyPlaque(h, person) {
    if (h.plaque) return null;
    const payment = payHome(h, person, YARD.plaque.cost);
    if (!payment) return null;
    h.plaque = true;
    return payment;
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
  function stoveJobs(house) {
    const jobs = (house.stoves ?? (house.stove ? [house.stove] : [])).map((j) => j ?? null);
    while (jobs.length < stoveCount(house)) jobs.push(null);
    return jobs;
  }
  function saveJobs(house, jobs) {
    house.stoves = jobs;
    delete house.stove;
  }
  function stoveStatus(job, lifeId, day) {
    if (!job) return "empty";
    return job.lifeId !== lifeId || day > job.day ? "ready" : "cooking";
  }
  function freeStove(house) {
    return stoveJobs(house).indexOf(null);
  }
  function canCook(house, person, recipe, owner, index = freeStove(house)) {
    const r = TRADE.recipes[recipe];
    if (!r || index < 0 || stoveJobs(house)[index] !== null) return false;
    return has(owner === "house" ? house.store : person.goods, r.input);
  }
  function startStove(house, person, recipe, owner, at, index = freeStove(house)) {
    if (!canCook(house, person, recipe, owner, index)) return null;
    const stock = owner === "house" ? house.store : person.goods;
    for (const [kind, n] of Object.entries(TRADE.recipes[recipe].input)) take2(stock, kind, n);
    const job = { jobId: at.lifeId + "/d" + at.day + "/s" + index, recipe, owner, lifeId: at.lifeId, day: at.day };
    const jobs = stoveJobs(house);
    jobs[index] = job;
    saveJobs(house, jobs);
    return job;
  }
  function collectStove(house, person, at, index) {
    const jobs = stoveJobs(house);
    const i = index ?? jobs.findIndex((j) => stoveStatus(j, at.lifeId, at.day) === "ready");
    const job = jobs[i];
    if (!job || stoveStatus(job, at.lifeId, at.day) !== "ready") return null;
    const r = TRADE.recipes[job.recipe];
    const owner = job.owner === "person" && job.lifeId === at.lifeId ? "person" : "house";
    add(owner === "person" ? person.goods : house.store, r.output, r.count);
    jobs[i] = null;
    saveJobs(house, jobs);
    return { kind: r.output, count: r.count, owner, index: i };
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
  function offerFor(lifeId, day, neighbors2) {
    if (!neighbors2.length) return null;
    const rng = stream(lifeId, day, "request");
    const neighbor = rng.pick(neighbors2);
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
  function requestBoard(house, lifeId, day, neighbors2) {
    refreshRequest(house, lifeId, day);
    const r = house.request;
    if (r?.status === "accepted") return { active: r, offer: null };
    if (r && r.lifeId === lifeId && r.day === day) return { active: null, offer: null };
    return { active: null, offer: offerFor(lifeId, day, neighbors2) };
  }
  function acceptRequest(house, lifeId, day, neighbors2) {
    const { active, offer } = requestBoard(house, lifeId, day, neighbors2);
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
    disciple: { cost: 30, max: 2, grades: [[3, "上等", 1.1], [1, "良才", 1.05], [0, "寻常", 1]] },
    /** 给伴侣买礼物：东西到了某个人手里，只能用钱袋；一天一次。陪伴花时间，礼物花钱 */
    gift: { cost: 20, love: 8 }
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
  function canGift(s) {
    return !!s.spouse && s.giftDay !== s.day && s.purse >= FAMILY.gift.cost;
  }
  function giveGift(s) {
    if (!canGift(s) || !payPersonal(s, FAMILY.gift.cost)) return false;
    s.love = Math.min(FAMILY.maxLove, s.love + FAMILY.gift.love);
    s.giftDay = s.day;
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
  function karmaRows(g, neighbors2) {
    const K = REBIRTH.karma;
    const autoHeld = g.autoHeld ?? 0;
    const friends = neighbors2.reduce((a, id) => a + (g.friends[id] ?? 0), 0);
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
  function carryFriends(prev, neighbors2, rng) {
    const F = REBIRTH.friends;
    const out = {};
    for (const id of neighbors2) {
      const v = prev[id] ?? 0;
      out[id] = v >= F.keepAt ? Math.floor(v * F.keepShare) : rng.int(F.fresh[0], F.fresh[1]);
    }
    return out;
  }

  // src/core/loop/night.ts
  var ghostTypes = Object.keys(GHOSTS);
  var perkIds = Object.keys(PERKS);
  var equipmentPerks = ["pierce", "burn", "lampstr", "bowplus", "bowfast"];
  var neighbors = ["wang", "li", "zhao"];
  var surnames = [..."孙周吴郑冯陈褚卫蒋沈韩杨朱秦许何吕施张孔"];
  var given = ["太爷爷", "老祖宗", "大娘", "三叔", "二姑奶奶", "老太公", "大伯", "小姑", "老掌柜", "大侠", "书生", "镖头"];
  function eventRng(seed, wave, event) {
    const rng = new Rng(seed);
    rng.setState(seed + (wave + 1) * 65537 + event * 257);
    return rng;
  }
  function orderNightDeck(items, draw2) {
    if (items.length < 2) return items;
    let end = 1;
    if (items.length > 16) {
      const reversePrefix = draw2() < 0.5;
      end = 2;
      while (end < items.length && draw2() < 0.5 === reversePrefix) end++;
      if (reversePrefix) {
        for (let left = 0, right = end - 1; left < right; left++, right--) {
          [items[left], items[right]] = [items[right], items[left]];
        }
      }
    }
    for (let i = end; i < items.length; i++) {
      const item = items[i];
      let lo = 0, hi = i;
      while (lo < hi) {
        const mid = lo + hi >>> 1;
        if (draw2() < 0.5) hi = mid;
        else lo = mid + 1;
      }
      items.copyWithin(lo + 1, lo, i);
      items[lo] = item;
    }
    return items;
  }
  function familyHelpers(options) {
    const cfg = NIGHT.family;
    const helpers = [];
    if (options.spouse && !options.guardian) {
      helpers.push({ dmg: cfg.spouseDamage, rate: cfg.spouseRate, cd: cfg.spouseCd });
    }
    for (const [i, power] of (options.childPowers ?? []).slice(0, cfg.maxKids).entries()) {
      helpers.push({ dmg: Math.round(cfg.childBaseDamage * power), rate: cfg.childRate, cd: cfg.childCd + i * cfg.childStagger });
    }
    return helpers;
  }
  function startNight(house, person, options) {
    const door = DOORS[house.door];
    if (!door) throw new RangeError("未知的院门等级");
    const guardian = options.guardian ?? false;
    const advancedItems = options.advancedItems ?? true;
    const bows = NIGHT.bows.x.slice(0, house.traps.crossbow).map((x, i) => ({ x, y: NIGHT.bows.y, cd: NIGHT.bows.firstCd + i * NIGHT.bows.stagger }));
    const state = {
      ruleVersion: RULE_VERSION,
      seed: options.seed >>> 0,
      rngState: options.seed >>> 0,
      cosmeticSeedState: (options.cosmeticSeed ?? options.seed ^ 2654435769) >>> 0,
      nextId: 1,
      spawnedInWave: 0,
      d: guardian ? CFG.lifeDays : person.day,
      guardian,
      advancedItems,
      helpEnabled: options.helpEnabled ?? true,
      hp: person.hp,
      power: person.power,
      item: advancedItems ? person.item : "sword",
      traps: { ...house.traps },
      lossBase: options.lossBase ?? house.chest,
      purse: person.purse,
      lootPlan: planNightLoot(options.seed, house.treasures),
      treasures: house.treasures.map((t) => ({ ...t })),
      friends: { ...person.friends },
      friendship: {},
      t: 0,
      door: door.hp,
      doorMax: door.hp,
      wave: -1,
      spawns: [],
      ghosts: [],
      pk: {},
      offer: [],
      picking: false,
      bows,
      fam: familyHelpers(options),
      ally: null,
      helpUsed: false,
      kin: [...options.kin ?? []],
      helper: null,
      rainCount: 0,
      burnT: 0,
      kills: 0,
      coins: 0,
      over: false,
      result: null
    };
    startWave(state, 0);
    return state;
  }
  function startWave(n, wave) {
    if (n.over || wave !== n.wave + 1 || wave >= NIGHT.waves || wave > 0 && !n.picking) return;
    const swordOnly = n.ruleVersion >= 2 && !n.guardian && !n.advancedItems;
    const counts = waveCounts(n.d, wave, swordOnly);
    if (n.guests?.length) for (const type of ghostTypes) counts[type] = Math.round(counts[type] * COOP.ghostScale);
    const types = ghostTypes.flatMap((type) => Array(counts[type]).fill(type));
    const draw2 = eventRng(n.seed, wave, 0);
    orderNightDeck(types, () => draw2.next());
    n.spawns = types.map((type, i) => ({ at: n.t + NIGHT.waveDelay + i * NIGHT.spread / types.length, type, wave }));
    n.wave = wave;
    n.spawnedInWave = 0;
    n.offer = [];
    n.picking = false;
    if (n.pickers) {
      n.pickers = [];
      n.pickedBy = [];
    }
  }
  function perkAvailable(n, id) {
    if (!n.advancedItems && equipmentPerks.includes(id) || n.pk[id] && !PERKS[id].stack) return false;
    if (id === "bowfast") return n.bows.length > 0;
    if (id === "lampstr") return !n.traps.lamp;
    if (id === "fix") return n.door <= n.doorMax * NIGHT.perk.fixBelow;
    return true;
  }
  function offerPerks(n) {
    const pool = perkIds.filter((id) => perkAvailable(n, id));
    const draw2 = eventRng(n.seed, n.wave, 200);
    n.offer = orderNightDeck(pool, () => draw2.next()).slice(0, NIGHT.offerCount);
    n.picking = true;
    if (n.guests?.length) {
      n.pickers = ["host", ...n.guests.map((g) => g.id)];
      n.pickedBy = [];
    }
  }
  function choosePerk(n, id, by) {
    if (!n.picking || !n.offer.includes(id)) return;
    const who = by ?? "host";
    if (n.pickers?.length) {
      if (!n.pickers.includes(who) || n.pickedBy.includes(who) || n.pk[id] && !PERKS[id].stack) return;
      n.pickedBy.push(who);
    } else if (by !== void 0) return;
    n.pk[id] = (n.pk[id] ?? 0) + 1;
    if (id === "fix") n.door = Math.min(n.doorMax, n.door + n.doorMax * NIGHT.perk.fix);
    if (id === "bowplus" && !n.bows.length) {
      n.bows.push({ x: NIGHT.bows.x[0], y: NIGHT.bows.y, cd: NIGHT.bows.giftCd });
    }
    if (n.pickers?.length && n.pickers.some((p) => !n.pickedBy.includes(p))) return;
    startWave(n, n.wave + 1);
  }
  function spawnGhost(n, sp) {
    const rng = eventRng(n.seed, sp.wave, ++n.spawnedInWave);
    const between2 = ([lo, hi]) => lo + rng.next() * (hi - lo);
    const cfg = NIGHT.spawn;
    const ghost = GHOSTS[sp.type];
    const max = ghost.hp * ((1 + NIGHT.hpPerDay * (n.d - 1)) * (1 + NIGHT.hpPerWave * sp.wave));
    const look = new Rng(n.cosmeticSeedState);
    look.setState(n.cosmeticSeedState);
    const name = look.pick(surnames) + "家的" + look.pick(given);
    const lookSeed = look.int(0, 4294967295);
    n.cosmeticSeedState = look.getState();
    const g = {
      id: n.nextId++,
      type: sp.type,
      hp: max,
      max,
      lane: between2(cfg.lane),
      x: NIGHT.lane.centerX,
      y: between2(cfg.y),
      ox: 0,
      k: NIGHT.lane.depthBase,
      tx: NIGHT.lane.centerX + between2(cfg.gateXOffset),
      ty: NIGHT.lane.gateY + between2(cfg.gateYOffset) - (sp.type === "fly" ? cfg.flyRise : 0),
      speed: ghost.speed * between2(cfg.speed),
      state: "walk",
      bashT: between2(cfg.bashDelay),
      ph: 0,
      hit: ghost.hit,
      flash: 0,
      name,
      lookSeed
    };
    rng.next();
    rng.next();
    g.ph = between2(cfg.phase);
    n.ghosts.push(g);
  }
  function ghostCenter(g) {
    return { x: g.x + g.ox, y: g.y - NIGHT.lane.centerHeight * g.k };
  }
  function ghostAt(n, x, y) {
    let nearest = null;
    let distance = Infinity;
    for (const ghost of n.ghosts) {
      const c = ghostCenter(ghost);
      const d = Math.hypot(x - c.x, y - c.y);
      if (d < distance && d < NIGHT.lane.hitRadius * Math.max(ghost.k, NIGHT.lane.minHitScale)) {
        nearest = ghost;
        distance = d;
      }
    }
    return nearest;
  }
  function lampHeld(n) {
    return n.item === "lamp" || !!n.guests?.some((g) => g.item === "lamp");
  }
  function revealed(n, g) {
    return g.type !== "shade" || lampHeld(n) && g.y > NIGHT.reveal.lamp || !!(n.traps.lamp || n.pk.lampstr) && g.y > NIGHT.reveal.wall || !!n.pk.eye && g.y > NIGHT.reveal.eye || g.flash > 0;
  }
  function nearestGhost(n, visibleOnly = true) {
    let nearest = null;
    for (const ghost of n.ghosts) {
      if ((!visibleOnly || revealed(n, ghost)) && (!nearest || ghost.y > nearest.y)) nearest = ghost;
    }
    return nearest;
  }
  function tapMult(n, g, item = n.item) {
    let multiplier = MULT[item][g.type];
    if (g.type === "armor" && n.pk.heavy) multiplier = MULT[item].evil;
    if (g.type === "fly" && item === "sword" && n.pk.qi) multiplier = NIGHT.perk.qi;
    if (item === "bow") multiplier *= 1 + NIGHT.perk.pierce * (n.pk.pierce ?? 0);
    return multiplier * (1 + NIGHT.perk.heavy * (n.pk.heavy ?? 0));
  }
  function hurtGhost(n, g, dmg, byPlayer = false) {
    if (g.hp <= 0) return;
    g.hp -= dmg;
    g.flash = NIGHT.reveal.flashTime;
    if (g.hp > 0) return;
    n.ghosts.splice(n.ghosts.indexOf(g), 1);
    n.kills++;
    n.coins += (byPlayer ? NIGHT.weapon.playerCoins : 0) + NIGHT.perk.coins * (n.pk.coins ?? 0);
    if (n.pk.soul) n.door = Math.min(n.doorMax, n.door + NIGHT.perk.soul * n.pk.soul);
    if (n.pk.rain && ++n.rainCount >= NIGHT.perk.rainKills) {
      n.rainCount = 0;
      for (const other of n.ghosts.slice()) hurtGhost(n, other, NIGHT.perk.rainDamage * n.pk.rain);
    }
  }
  function hit(n, g, guest) {
    if (!g) return;
    const hidden = !revealed(n, g);
    if (hidden && !n.pk.ear) return;
    const multiplier = tapMult(n, g, guest?.item ?? n.item) * (hidden ? NIGHT.perk.ear : 1);
    const hp = guest?.hp ?? n.hp;
    const guardian = !guest && n.guardian;
    const hurt = guardian || hp >= CFG.hpMax ? 1 : hp <= 1 ? NIGHT.weapon.badlyHurt : NIGHT.weapon.hurt;
    const age = guardian ? AGE_FX.child : AGE_FX[balanceAge(guest?.d ?? n.d)];
    const power = guardian ? NIGHT.guardian.power : (guest ? guest.power : n.power) || 1;
    const crit = nextRandom(n) < Math.min(NIGHT.perk.critCap, NIGHT.perk.critChance * (n.pk.crit ?? 0));
    const dmg = Math.max(1, Math.round(NIGHT.tap * multiplier * age.dmg * hurt * power * (crit ? NIGHT.perk.critDamage : 1)));
    const center = ghostCenter(g);
    hurtGhost(n, g, dmg, true);
    if (!n.pk.sweep) return;
    for (const other of n.ghosts.slice()) {
      if (other === g || !revealed(n, other)) continue;
      const c = ghostCenter(other);
      if (Math.hypot(c.x - center.x, c.y - center.y) < NIGHT.perk.sweepRadius) {
        hurtGhost(n, other, Math.max(1, Math.round(dmg * NIGHT.perk.sweepFactor)), true);
      }
    }
  }
  function helpCandidates(n) {
    if (!n.helpEnabled || n.helpUsed) return [];
    const friends = neighbors.filter((id) => (n.friends[id] ?? 0) >= CFG.helpAt).sort((a, b) => n.friends[b] - n.friends[a]);
    return [...friends, ...(n.kin ?? []).filter((id) => !friends.includes(id))];
  }
  function callHelp(n, choice) {
    const list2 = helpCandidates(n);
    const id = choice === void 0 ? list2[0] : list2.includes(choice) ? choice : void 0;
    if (!id) return;
    n.helpUsed = true;
    n.helper = id;
    n.ally = { id, t: NIGHT.ally.duration, cd: NIGHT.ally.firstCd };
    if (neighbors.includes(id)) n.friendship[id] = Math.min(NIGHT.ally.friendship, NIGHT.ally.maxFriendship - n.friends[id]);
  }
  function join(n, a) {
    n.guests ?? (n.guests = []);
    if (n.guardian || n.guests.length >= COOP.maxGuests || n.guests.some((g) => g.id === a.by) || a.by === "host") return;
    const item = a.item && (n.advancedItems || a.item === "sword") ? a.item : "sword";
    n.guests.push({ id: a.by, item, power: a.power ?? 1, hp: a.hp ?? CFG.hpMax, d: a.day ?? n.d });
  }
  function applyNightAction(n, action) {
    if (n.over) return;
    if (action.type === "join") return join(n, action);
    const by = "by" in action ? action.by : void 0;
    const guest = by === void 0 ? void 0 : n.guests?.find((g) => g.id === by);
    if (by !== void 0 && !guest) return;
    if (action.type === "perk") return choosePerk(n, action.id, by);
    if (n.picking) return;
    switch (action.type) {
      case "hit":
        return hit(n, n.ghosts.find((g) => g.id === action.id) ?? null, guest);
      case "hitAt":
        return hit(n, ghostAt(n, action.x, action.y), guest);
      case "item":
        if (n.advancedItems || action.item === "sword") {
          if (guest) guest.item = action.item;
          else n.item = action.item;
        }
        return;
      case "help":
        return callHelp(n, action.id);
    }
  }
  var clamp01 = (v) => Math.min(1, Math.max(0, v));
  function advanceGhosts(n) {
    const dt = NIGHT.step, lane = NIGHT.lane;
    const slowNear = NIGHT.gate.talismanFactor ** n.traps.talisman * NIGHT.perk.slow ** (n.pk.slow ?? 0) * (n.guardian ? NIGHT.guardian.slow : 1);
    for (const g of n.ghosts) {
      g.flash = Math.max(0, g.flash - dt);
      if (g.state === "bash") {
        g.bashT -= dt;
        if (g.bashT <= 0) {
          g.bashT = NIGHT.gate.bashCd;
          n.door -= g.hit * (1 + NIGHT.hitPerDay * (n.d - 1)) * NIGHT.perk.bolt ** (n.pk.bolt ?? 0);
        }
        continue;
      }
      const slow = g.y > NIGHT.gate.slowFrom ? slowNear : 1;
      g.y = Math.min(g.ty, g.y + g.speed * slow * dt);
      const progress = clamp01((g.y - lane.depthStart) / (g.ty - lane.depthStart));
      const halfWidth = lane.farWidth + lane.extraWidth * clamp01((g.y - lane.widenFrom) / lane.widenDistance);
      const merge = clamp01((progress - lane.mergeFrom) / lane.mergeDistance);
      g.x = lane.centerX + g.lane * halfWidth * (1 - merge) + (g.tx - lane.centerX) * merge;
      if (g.y >= g.ty) g.state = "bash";
      g.ox = g.type === "fly" ? Math.sin(n.t * lane.flyFrequency + g.ph) * lane.flySwing * clamp01((g.ty - g.y) / lane.flySettleDistance) : 0;
      g.k = lane.depthBase + lane.depthGain * clamp01((g.y - lane.depthStart) / (lane.gateY - lane.depthStart));
    }
  }
  function fireBows(n) {
    const cfg = NIGHT.bows;
    for (const b of n.bows) {
      b.cd -= NIGHT.step;
      if (b.cd > 0) continue;
      const distance = (g) => Math.hypot(g.x - b.x, g.y - b.y);
      const targets = n.ghosts.filter((g) => revealed(n, g) && g.y > cfg.fromY).sort((a, c) => distance(a) - distance(c)).slice(0, 1 + (n.pk.bowplus ?? 0));
      if (!targets.length) {
        b.cd = cfg.idleCd;
        continue;
      }
      b.cd = Math.max(cfg.minCd, NIGHT.bowCd * cfg.fastFactor ** (n.pk.bowfast ?? 0));
      for (const target of targets) hurtGhost(n, target, NIGHT.bowDmg);
    }
  }
  function burnGhosts(n) {
    if (!n.pk.burn || !lampHeld(n)) return;
    n.burnT += NIGHT.step;
    if (n.burnT < NIGHT.perk.burnInterval) return;
    n.burnT = 0;
    for (const g of n.ghosts.slice()) {
      const c = ghostCenter(g);
      if (c.y > NIGHT.perk.burnMinY && Math.hypot(c.x - NIGHT.weapon.lampX, c.y - NIGHT.weapon.lampY) < NIGHT.weapon.lampRadius) {
        hurtGhost(n, g, NIGHT.perk.burnDamage * n.pk.burn);
      }
    }
  }
  function helpDefend(n) {
    for (const member of n.fam) {
      member.cd -= NIGHT.step;
      if (member.cd > 0) continue;
      const target = nearestGhost(n);
      member.cd = target ? member.rate : NIGHT.family.idleCd;
      if (target) hurtGhost(n, target, member.dmg);
    }
    const ally = n.ally;
    if (!ally) return;
    ally.t -= NIGHT.step;
    ally.cd -= NIGHT.step;
    if (ally.cd <= 0) {
      const target = nearestGhost(n);
      ally.cd = target ? NIGHT.ally.rate : NIGHT.ally.idleCd;
      if (target) hurtGhost(n, target, NIGHT.allyDmg);
    }
    if (ally.t <= 0) n.ally = null;
  }
  function endNight(n, won) {
    n.over = true;
    if (!won) n.door = 0;
    const plan = n.lootPlan ?? planNightLoot(n.seed, n.treasures);
    const payout = nightPayout(plan, { purse: n.purse ?? 0, chest: n.lossBase, treasures: n.treasures }, won, n.coins);
    n.result = {
      won,
      kills: n.kills,
      coins: n.coins,
      door: n.door,
      doorMax: n.doorMax,
      creditedKills: won ? n.kills : 0,
      ...payout,
      lostMoney: payout.purseLost + payout.chestLost,
      held: won && !n.guardian ? 1 : 0,
      broken: !won && !n.guardian ? 1 : 0,
      friendship: { ...n.friendship }
    };
  }
  function nightStep(n, actions = []) {
    for (const action of actions) applyNightAction(n, action);
    if (n.over || n.picking) return n;
    n.t += NIGHT.step;
    while (n.spawns.length && n.spawns[0].at <= n.t) spawnGhost(n, n.spawns.shift());
    advanceGhosts(n);
    fireBows(n);
    burnGhosts(n);
    helpDefend(n);
    if (n.door <= 0) endNight(n, false);
    else if (!n.ghosts.length && !n.spawns.length) {
      if (n.wave === NIGHT.waves - 1) endNight(n, true);
      else offerPerks(n);
    }
    return n;
  }
  return __toCommonJS(browser_exports);
})();
