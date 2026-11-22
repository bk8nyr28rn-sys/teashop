# 阶段 2 验收

## 存档和入口

游戏继续使用浏览器本地存档 `wulin-loop`。文档样机与离线样机都从同一个相对路径资源目录加载规则。解压项目后，直接打开 `prototype/loop.html` 即可试玩。

| v4 字段 | 内容 |
| --- | --- |
| `account` | 攒天余额、上次领天日期、试玩开关、祖宗带路及已听过的话、捏的脸和表情、历世记录、河埠提示与试玩记录、跨世递增的 `nightId`。新开局另有独立的 `worldId`。 |
| `person` | `lifeId` 与所在的 `houseId`，钱袋 `purse`、在院里的个人货 `goods`、个人宝物 `personalTreasures`、野外背包 `bag`，以及日龄、体力、亲友、旅途和投胎进度。 |
| `houses[houseId]` | 家名、钱箱 `chest`、仓库 `store`、宝物架 `treasures`、院石和摆位、门、机关、画像与荒置标记。开打预定的损失存在 `nightPlan`，战报存在 `receipts[nightId]`，`pendingNightId` 指向当前待看的战报。 |
| `revision` | 浏览器写入进度时核对的版本号。旧标签必须读到最新进度才能提交。 |

v2 和 v3 的旧钱、货、宝物架均归到原家，钱袋从零起步。已有战报直接登记。没有回执的历史扣款按存下的余额迁移。奈何桥旧档保留已展示的候选，按上一世的身份补齐画像。

## 规则及对应测试

核心位于 `src/core/loop/`。表中的单测位于 `test/loop/`，浏览器测试位于 `scripts/proto-tests/`。

| 规则 | 核心实现 | 单测与浏览器入口 |
| --- | --- | --- |
| 野外货、宝物、背柴归个人；卖谁的货就进谁的口袋 | `economy.ts` 的 `unpackBag`、`splitFirewood`、`sellOrdinary`、`sellAllOrdinary`、`sellTreasure`；`field.ts` 的归家入口 | `economy.test.ts`、`field.test.ts`；`day-market.test.cjs`、`riverside.test.cjs` |
| 普通货入仓、宝物上架；个人钱可存部分或全部，钱箱没有提款操作 | `storeBelongings`、`shelveTreasure`、`depositCoins` | `economy.test.ts` 覆盖单件上架、全存、部分存钱、负数和超额；`day-market.test.cjs` 通过集市按钮操作 |
| 换门、装机关、收徒先用钱箱，不足再用钱袋。预览与实扣显示各付多少 | `quoteHome`、`payHome` | `economy.test.ts`、`day-market.test.cjs`、`guidance.test.cjs`；`pockets-mobile.test.cjs` 验证点完换门立即刷新 |
| 个人消费、给邻居钱或货只动自己的；疗伤先用自己的药，再用仓药 | `payPersonal`、`givePersonalGood`、`useHerb` | `economy.test.ts`、`day-market.test.cjs` |
| 一世结束的钱、货、宝与画像归原家；选第二个后人也继承同户家产，选同姓别家则分别存放 | `household.ts` 的 `finishLife`、`nextLifeView`；旧档用 `migrateSave` | `household.test.ts`、`loop-family.test.cjs`、`day-bank.test.cjs`。覆盖无后人荒置、院石摆位、重复迁移与重复挂画像 |
| 守住的纸钱进守夜人的钱袋；护家神的纸钱去奈何桥时留在原家；厉鬼得手的 30 文和宝物随人投胎 | `settlement.ts` 的 `settleNightLedger`；`household.ts` 的 `leaveGuardianReward`、`nextLifeView` | `settlement.test.ts`、`household.test.ts`、`night-receipt.test.cjs` |
| 门破时钱袋丢 2–4 成、钱箱丢 0–2 成，各自向下取整；架上至多丢预定的一件 | `planNightLoot`、`nightPayout`；独立夜种子在开战时存盘 | `settlement.test.ts` 对 256 个种子检查预抽、刷新、成数及宝物；`night.test.ts` 检查战斗结果，`night-receipt.test.cjs` 核对显示金额 |
| 一晚只入账一次，读完回执仍保留历史 | `settleNightLedger` 与 `assets/loop-storage.js` 的跨标签写锁 | `night-receipt.test.cjs` 覆盖普通夜、末夜、护家神夜、两个标签同时提交相反结果和同时点天亮，以及第三个标签迟交；也在 IndexedDB 后备锁上验证 |

## 试玩与实现取舍

- 带路第一天，搬回一根整木在院里劈出 7 件柴，每件沿用 3 文的价格。全卖后钱袋有 21 文。换木门从钱箱、钱袋各付 20 文，钱袋余 1 文。原来每根浮木只给 1 件柴，河岸三根全搬也只卖 9 文。
- 第 3 天开放家和祠堂时，念头提示「钱存进钱箱更安全，只能花在家上」。两种手机视口都显示各自余额。
- 任务单明确了老死的遗产。早逝也按保留已带回财物处理，个人余额和院里的货宝留给原家。野外掉落的背包不进家仓。
- `scripts/build-loop-core.mjs` 用 esbuild 从 `src/core/loop/browser.ts` 生成 `assets/loop-core.js`。两个页面共用存档、迁移、经济和夜账。战斗继续由原样机运行。守夜参数逐局对账使用 35 组、合计 2,520 场的输入。

## 验收命令与截图

```sh
npm run typecheck
npm test
npm run build:loop -- --check
npm run sync:draw -- --check
npm run test:proto
npm run balance:night -- --compare-core
```

本目录收录 390 × 844 的集市与刷新后的破门战报，以及 320 × 640 的院子和两袋余额。集市与院子截图使用中期库存样本，首日攒足门钱另由带路浏览器测试从开局实际走通。
