# 美术接入：把美工的图接进样机（给 Codex）

> 2026-11-24。先读 `docs/ART_ASSETS.md`（美工按它出图，每一项都有编号、尺寸、文件名），再读 `docs/HANDOFF.md`。
> **从完整的项目包开始做**（产品负责人会给你最新的 `teashop-full-*.zip`）。第四、五、六阶段和「和人说话」是 Claude 直接写的，你手上旧的那份没有这些代码。

## 目标

美工会**一批一批**交图。每交一批，就把这批图接进样机：

- 有图的位置用图，**没图的位置照旧用现在程序画的色块**，所以不管交了几张，游戏都不会坏
- **只换画面，不改规则**：不动 `src/core/loop/` 的规则、不改数值、不改按钮和流程
- 两种屏幕（390 × 844、320 × 640）都要好看、不出横向滚动、没有控制台报错

## 1. 先搭「换图」的架子（第一次做，后面每批都用它）

1. **图放在** `assets/art/<场景>/<名字>`，名字照 `docs/ART_ASSETS.md` 的「文件名」
2. **清单**：写一个 `scripts/art-manifest.mjs`，扫 `assets/art/` 生成 `assets/art/manifest.js`，内容是 `window.ART = { 'yard/bg-day': { src, w, h }, ... }`（键就是去掉扩展名的文件名，`w`、`h` 是图片像素）。`npm run art:manifest` 生成，`--check` 只检查（和 `build:loop`、`sync:draw` 一样）
3. **页面里加一个小工具**：`art(id, x, y, w, h, opts)`。有这张图就返回 SVG 的 `<image>`，没有就返回空，调用的地方接着画原来的色块：

   ```js
   s += art('yard/stove-' + st, x, 106, 36, 44) || 原来画灶的那段;
   ```

   `opts` 里支持：`anchor: 'bottom'`（底边中点对齐，站在地上的东西都用这个）、`flip: true`（镜像，石狮子和侧墙用）
4. **路径**：`manifest.js` 里的 `src` 写相对路径，用 `document.currentScript.src` 拼出完整地址（`assets/riverside.js` 就是这么找 `riverside.webp` 的）。这样在线版、离线版（`prototype/loop.html`）都能找到图
5. **页面引用**：`docs/proto/loop/index.html` 在 `loop-core.js` 后面加一行 `<script src="../../../assets/art/manifest.js"></script>`，然后跑 `npm run sync:draw`，离线副本会跟着改

## 2. 每个编号接在代码哪里

| 编号（见 ART_ASSETS） | 代码位置 | 注意 |
| --- | --- | --- |
| Y1+Y8 院子背景 | `homeSvg()` 开头的天空、远山、地面 | 黄昏、天黑的压暗（`f > 0.75` 那层）照旧由程序叠在最上面 |
| Y2/Y3 正屋三档 | `homeSvg()` 画房子那段，按 `LoopCore.yardLevel(G)` 选 `yard/house-0/1/2` | 大宅那张已经带厢房，有图时不再画程序的厢房 |
| Y4 侧墙 | `homeSvg()` 的「院子等级」那段 | 右边那面用 `flip` |
| Y5 灶 | `homeSvg()` 的灶（`stoveJobsNow().forEach`） | 三种状态各一张 |
| Y6 宝物架、Y7 货堆 | `homeSvg()` 的「宝物架」「仓库」 | 宝物架上的宝物用 H 项的宝物图标，缩小摆上去 |
| Y9 前墙、Y10 院门 | `homeSvg()` 末尾；`doorSvg(t, cx, by, w, h)` | **院门在三个地方用**：院子、守夜（`nightSvg`）、当厉鬼（`hauntSvg`）。改 `doorSvg` 一处就三处都换 |
| Y11 匾额 | `homeSvg()` 画匾额那段 | 只换底图，「X府」照旧由程序写上去 |
| 门口灯笼、石狮、大阵、小牌 | `lanternSvg`、`lionSvg`、`homeSvg()` | 石狮右边那只 `flip` |
| 装饰 | `decorSvg(kind, x, y)` | 位置照旧用 `DECOR_SLOTS`，只换画法 |
| 机关 | `crossbowSvg`、`talismanSvg`、灯笼串那段 | 白天、夜里同一张图 |
| B 守夜背景 | `nightSvg()` | **只换「底」**：墙、巷子、地面、门框。灯光的遮罩（`darkmask`）、光晕、雨、鬼、血条、鬼头上的特点牌**都留着程序画，叠在图上面**。鬼的图标和血条永远在最上层 |
| B 手里的东西、本事卡 | `renderNightPanel()`、`showPerkChoice()` | 图放在按钮的字前面 |
| C 地图 | `mapSvg()` | 地点的可点范围不能变小（手机上要点得准） |
| E 当厉鬼背景 | `hauntSvg()` | 弩机、红光照旧程序画 |
| F 老死、奈何桥 | `renderDeath()`、`renderReborn()` | 「奈何桥」三个字照旧由程序写（以后可能换词，见 `docs/TERMS.md`） |
| F 祠堂框和墙 | `portrait(a)`、`openHall()` | 画像（人）照旧由程序画在框里 |
| G 头像框、气泡 | `talkHead(npc, line)` 和 `.talk-head`、`.talk-bubble` 的样式 | 夜里、奈何桥是深色底，气泡要看得清 |
| H 货物、宝物图标 | `marketSection(owner)` 每一行的名字前面；`openStove()` 的配方行；宝物架 | 24 × 24 显示 |
| I NPC 的脸 | `MERCHANT`、`CARPENTER`、`FERRYMAN`、`NEIGHBORS` 的 `look`；周伯在 `assets/riverside.js` | 美工交的是**捏人码**（`docs/art/npc-looks.md`）。用页面里现成的 `decode(捏人码)` 把码变成 `look` 写进去，不要自己猜参数 |
| J 界面 | `.card`、`.big`、`.main`、HUD | 字的对比度不能变差 |
| D 河埠 | `assets/riverside.js` 的 `woodArt`、`stoneArt`、`ropeArt`、`herbArt`、`raftArt`、`porterArt` | 同样「有图用图，没图照旧」 |

## 3. 不能破坏的

- **图上不写字**，所有字都由程序写（换词表 `docs/TERMS.md` 要能管到）
- 人物、鬼都由捏人系统画，不换成图片
- 守夜的玩法信息永远最醒目：鬼头上的特点牌和血条、门的血条在最上层
- 夜里的亮暗由程序控制（灯照到的地方亮），背景图不能自带光
- 页面文件 `docs/proto/loop/index.html` 和 `assets/guidance.js` 是 Windows 换行（CRLF），改的时候保持原来的换行，不要整份转换（不然一次小改动看起来像改了几千行）
- 不改规则、不改数值；`npm run balance:night -- --compare-core` 要照旧逐局对得上

## 4. 检查和测试

1. **`npm run art:check`**：`assets/art/` 里每个文件都对得上 `docs/ART_ASSETS.md` 的某个编号；长宽比和表里写的画面尺寸一致（误差 5% 以内）；每张背景 ≤ 250 KB、小物件 ≤ 40 KB、全部 ≤ 6 MB；`assets/art/CREDITS.md` 里每个文件都有一行来源
2. **浏览器测试 `scripts/proto-tests/art.test.cjs`**：
   - 用脚本生成一套**占位图**（纯色块加编号，放在临时目录的项目拷贝里），打开院子（小院、中院、大宅各一次）、守夜、地图、当厉鬼、老死、奈何桥、祠堂、集市、和人说话，确认每个编号都变成了 `<image>`
   - 在当前没有美术的项目上，确认全部照旧是程序画的（原来的测试照样全过）
   - 两种屏幕尺寸、没有横向滚动、没有控制台报错
3. **照旧全绿**：`npm run typecheck`、`npm test`、`npm run build:loop -- --check`、`npm run sync:draw -- --check`、`npm run test:proto`

## 5. 每批图怎么汇报

1. 这批接了哪些编号，哪些还是程序画的（列一张表）
2. 每个换了图的画面，**换之前 / 换之后**各一张截图（390 × 844）
3. 发现的图的问题：透视不对、尺寸不对、图上有字、背景不透明、颜色和别的图对不上……直接列出来，让美工改，不要自己修图
4. `npm run art:check` 和全部测试的结果
5. 把整个项目打包一份

## 6. 这次不做

- 声音
- 动画（灶的火苗跳、树叶晃）：先静态图，动画以后再说
- 正式版的 Cocos 美术（那边要按骨骼动画和图集重新做）
