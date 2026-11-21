export const RINGS = [
  { name: '近郊', hint: '风险低，东西普通', r: 64, fight: 0.85, escape: 0.75, death: 0, foes: ['野狗', '毒蛇'] },
  { name: '山林', hint: '有野兽，东西好', r: 112, fight: 0.6, escape: 0.45, death: 0, foes: ['山狼', '黑熊', '山贼'] },
  { name: '禁地', hint: '很危险，有宝物', r: 158, fight: 0.45, escape: 0.2, death: 0.5, foes: ['凶尸', '古墓机关', '毒瘴'] },
] as const;

function fieldClue(text: string, action: string, focus: string, extraRisk = 0) {
  return { text, action, focus, extraRisk };
}

interface SpotDefinition {
  name: string;
  ring: 0 | 1 | 2;
  angle: number;
  loot: Readonly<Record<string, number>>;
  scene: string;
  safe: string;
  safeCount?: number;
  minutes: readonly [number, number];
  risk: readonly [number, number];
  solo?: string;
  clues: readonly ReturnType<typeof fieldClue>[];
}

const sites: SpotDefinition[] = [
  { name: '河边', ring: 0, angle: -50, loot: { 草药: 75, 柴: 25 }, scene: '岸边挂着一串水草，石滩再往前就要蹚水了。', safe: '在浅滩摘草药', minutes: [20, 45], risk: [.02, .13], clues: [
    fieldClue('昨夜涨了水，石缝里卡着带根的药草。', '沿着水线捞草药', '草药', .05),
    fieldClue('桥桩压着一排漂木，树皮还没泡软。', '绕到桥下拖漂木', '柴'),
  ] },
  { name: '竹林', ring: 0, angle: 70, loot: { 柴: 85, 草药: 15 }, scene: '竹梢挨着竹梢，地上有条砍柴人踩出来的小路。', safe: '沿小路拾枯竹', minutes: [20, 40], risk: [.02, .11], clues: [
    fieldClue('风刮断了几根老竹，折口还泛白。', '钻进倒竹堆拆柴', '柴'),
    fieldClue('背阴处冒出一排青叶，根下的土很松。', '扒开竹叶挖药根', '草药', .04),
  ] },
  { name: '菜地', ring: 0, angle: 190, loot: { 时蔬: 85, 草药: 15 }, scene: '田埂上摆着两只空筐，摘满一把就能沿原路回来。', safe: '在田边摘两把菜', safeCount: 2, minutes: [25, 45], risk: [.01, .06], clues: [
    fieldClue('畦里的菜都卷了心，隔着篱笆就看得见。', '穿过篱门收菜心', '时蔬'),
    fieldClue('沟边翻过土，几株平时难找的药苗露出了头。', '顺着水沟辨药苗', '草药', .02),
  ] },
  { name: '松林', ring: 1, angle: -10, loot: { 兽皮: 60, 柴: 40 }, scene: '老松下散着松针，树干粗糙处挂着一绺兽毛。', safe: '查看林缘的旧猎套', minutes: [30, 55], risk: [.05, .22], clues: [
    fieldClue('狐狸换毛，松根旁留了一路毛团。', '循着毛团找兽径', '兽皮', .06),
    fieldClue('雷劈开了老松，树心干得正好。', '进林劈开雷击木', '柴'),
  ] },
  { name: '猎场', ring: 1, angle: 110, loot: { 兽皮: 85, 草药: 15 }, scene: '废猎棚外有两串脚印，一串进了芦苇，就没再出来。', safe: '查猎棚边的浅套', minutes: [30, 60], risk: [.09, .36], solo: '屏住气钻进兽径', clues: [
    fieldClue('饮水坑边都是蹄印，野兽刚散开。', '沿蹄印收深处的猎套', '兽皮', .08),
    fieldClue('守棚人晾的药根被雨打落，散进了围场。', '进围场找散落的药根', '草药'),
  ] },
  { name: '矿洞', ring: 1, angle: 230, loot: { 铁矿: 85, 柴: 15 }, scene: '洞口堆着碎石，一条窄轨通往看不清的深处。', safe: '在洞口捡碎矿', minutes: [25, 55], risk: [.04, .23], clues: [
    fieldClue('铁轨尽头泛着红光，岩壁上露出了新矿脉。', '沿窄轨凿富矿', '铁矿'),
    fieldClue('洞口有新鲜爪印，石壁上还蹭着兽毛。', '循着爪印查旧矿车', '兽皮', .12),
  ] },
  { name: '古墓', ring: 2, angle: 40, loot: { 古物: 80, 宝物: 20 }, scene: '石门只开了一道缝，门槛上散着碎陶，里头有侧室。', safe: '在门槛边拾旧物', minutes: [35, 65], risk: [.08, .32], solo: '侧身悄悄摸进耳室', clues: [
    fieldClue('门口掉了半张地图，角上圈着一间耳室。', '按残图寻找暗格', '宝物', .10),
    fieldClue('塌土露出一段砖台，台沿排着陶片。', '扒开砖台寻古物', '古物'),
  ] },
  { name: '乱葬岗', ring: 2, angle: 200, loot: { 宝物: 55, 古物: 45 }, scene: '几块残碑歪在坡上，过了枯树便听不见身后的脚步。', safe: '翻找坡脚的旧供台', minutes: [35, 70], risk: [.11, .46], clues: [
    fieldClue('枯树根下透出一点金光，远处的铃却自己响了。', '掘开枯树根找金光', '宝物', .12),
    fieldClue('坡上的土被冲开了，露出一列旧香炉。', '顺着断碑寻旧供器', '古物', .04),
  ] },
];

export const HOME = { name: '家', x: 180, y: 180 } as const;
export const SPOTS = sites.map((spot, id) => {
  const angle = spot.angle * Math.PI / 180;
  const radius = RINGS[spot.ring].r;
  return { ...spot, id, x: HOME.x + radius * Math.cos(angle), y: HOME.y + radius * Math.sin(angle) };
});
export type Spot = typeof SPOTS[number];

export const TREASURES = [
  { n: '古玉', v: 90 }, { n: '夜明珠', v: 140 }, { n: '青铜剑', v: 110 },
  { n: '金步摇', v: 120 }, { n: '玉玺残片', v: 160 }, { n: '夜行衣', v: 80 },
] as const;

export const FIELD_CONFIG = {
  RINGS, SPOTS, HOME, TREASURES,
  soloWalk: .8, soloShortcutMinutes: 10,
  clueWeight: 30, baseWeightScale: .7, safeClueRisk: .25, richCount: [2, 3],
  visitFactors: [1, .5, .25], riskLevels: [.12, .32],
  markMinutes: 10, markedYield: 2,
  buddyRisk: .6, buddyShareEvery: 3, buddyFight: .2, buddyEscape: .25,
  returnFriendship: 5, maxFriendship: 100,
  woundedFightPenalty: .1, chanceMin: .05, chanceMax: .95, fightInjury: 1,
  fleeMinutes: 30, fleeLossChance: .5, duskInjury: 2,
  buddyLossShare: .5, crawlMinutesScale: 1.6, injuredHp: 1,
} as const;
