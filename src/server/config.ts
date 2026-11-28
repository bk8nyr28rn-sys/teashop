// 本地假服务器（S0）的参数。玩法数值都在规则核心里，这里只放「多人以后才有」的规矩。
// 标「暂定」的是 Claude 按 docs/SERVER_SPEC.md 第四节的建议先写的，产品负责人可以改。

export const SERVER = {
  /** 北京时间，早上 5 点换天（第四节第 6 条） */
  utcOffsetHours: 8,
  dayStartsAtHour: 5,
  /** 空位等真人多久，没人来就让 NPC 孩子先占着（暂定，第四节第 4 条） */
  cradleWaitDays: 1,
  /** 守夜重放：最后一个操作之后最多再跑多少步（一夜正常几千步） */
  nightTailCalls: 20000,
  /** 当厉鬼按固定步长走，服务器才能重放（页面现在是按帧走，要改） */
  hauntStep: 0.05,
  /** 记账、战报留多少条（内存版） */
  keepGuardedDates: 14,
} as const;

/** 家族、房、人（11-28 定）里还要定的数（都是暂定，第四节第 7、8 条） */
export const CLAN = {
  /** 起一座新房：小院、木门 */
  houseCost: 60,
  newHouseDoor: 1,
  /** 自立门户时，最多从原来那座房的钱箱分走几成 */
  splitShare: 0.3,
  /** 族人派人来帮忙、门守住了，帮忙的人钱袋里多几文（暂定） */
  helpReward: 10,
} as const;

export const SURNAMES = [...'林陈周吴郑王冯褚卫蒋沈韩杨朱秦许何吕施张孔曹严华金魏陶姜'];
export const GIVEN = ['青', '远', '安', '宁', '平', '岳', '舟', '岚', '川', '玉', '霜', '竹', '松', '梅', '云', '秋'];
