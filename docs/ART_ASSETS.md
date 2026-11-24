# 美术需求清单（给美工）

> 2026-11-24。游戏《武林世家》，微信小游戏。现在的样机画面全是程序画的色块，这份清单列出**每一个能换成美术图的地方**。
> 图交过来以后，由 Codex 接进游戏（见 `docs/ART_INTEGRATION_SPEC.md`）。**哪张图没交，游戏就继续用原来的色块，不会坏**，所以可以一批一批交。
> 先看位置图：`docs/art/slots/yard-slots.png`（院子里每个位置的编号和大小）。

## 0. 先看这里：五条硬规矩

1. **图上不写字**。门匾上的「林府」、「奈何桥」这类字都由程序写，因为以后可能要换说法（见 `docs/TERMS.md`）
2. **人物不用画**。玩家、伴侣、孩子、邻居、掌柜、木匠、摆渡人，全是用捏人台（`docs/art/creator/index.html`）捏出来的。你要做的是**给 7 个 NPC 捏脸**，交「捏人码」（第 I 项）
3. **鬼不画恐怖**。鬼就是人物的脸发白、飘着，由程序画。人物形象里**不放戏曲元素**
4. **原创或有授权**。用 AI 生成也可以，但每张图都要在 `assets/art/CREDITS.md` 写清楚：怎么来的、用的什么工具、有没有用别人的素材
5. **透视统一**：院子、守夜、当厉鬼都是**正面平视、稍微俯一点**，像站在院门外往里看；地图是**正上方俯视**

## 1. 风格

一句话：**温暖安静的江南武侠小院，扁平插画，带一点水粉质感，不写实**。

- **白天**：暖米、黛灰、朱红。有烟火气
- **夜里**：青黛、灯笼红、月白。整体很暗，**光由程序加**（灯照到的地方亮），所以夜里的背景图画「全暗」就行，不要自己画光晕
- **阴间**：淡紫、雾白。雾和水
- 线条：干净的色块，少量描边；不要照片质感，不要 3D 渲染
- 参考：路线图「美术方向」那一节，和你手上的 16 张参考图（只参考，不描）

## 2. 尺寸、格式、命名

- **单位**：下面表里的尺寸都是「画面单位」。**出图按 3 倍**：画面 360×300 的院子背景，出 1080×900 像素
- **格式**：背景用 WebP（不要透明）；小物件用 **PNG 透明底**（或带透明的 WebP）
- **锚点**：站在地上的东西（灶、树、水缸、门、石狮……）按**底边中点**对齐，图的底边就是它落地的地方，四周留 2–4 像素空白
- **大小**：每张背景不超过 250 KB，每个小物件不超过 40 KB，全部加起来不超过 6 MB
- **命名**：`assets/art/<场景>/<名字>.png`，有几种状态的加后缀，例如 `assets/art/yard/stove-cooking.png`。下面表里的「文件名」照抄就行

## 3. 清单

优先级：**P0** 先做，换完最能感觉到变化；**P1** 第二批；**P2** 有空再做。

### A. 自家院子（白天最常看的画面，画面 360×300）

位置见 `docs/art/slots/yard-slots.png`。

| 编号 | 东西 | 画面尺寸 | 出图 | 文件名 | 说明 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| Y1+Y8 | 院子背景：天空、远山、院子地面 | 360×300 | 1080×900 | `yard/bg-day.webp` | 不画房子、不画人、不画门（都分开叠上去）。黄昏的颜色程序会自己压 | P0 |
| Y2 | 正屋：小院 | 256×114 | 768×342 | `yard/house-0.png` | 白墙黛瓦，一扇屋门两扇窗 | P0 |
| Y2 | 正屋：中院 | 256×114 | 768×342 | `yard/house-1.png` | 同一座房子，修得更体面（檐下挂灯、窗格更细） | P1 |
| Y2+Y3 | 正屋：大宅 | 360×114 | 1080×342 | `yard/house-2.png` | 正屋加右边一进厢房 | P1 |
| Y4 | 中院的侧墙 | 70×32 | 210×96 | `yard/side-wall.png` | 左右各用一次（程序会镜像） | P1 |
| Y5 | 灶：空着 / 在烧 / 烧好了 | 36×44 | 108×132 | `yard/stove-empty.png`、`stove-cooking.png`、`stove-ready.png` | 在烧：灶口有火、冒烟；烧好了：锅上冒白气 | P0 |
| Y6 | 宝物架 | 102×66 | 306×198 | `yard/shelf.png` | 两层木架，空着（宝物另外叠上去） | P0 |
| Y7 | 仓库的货堆 | 90×48 | 270×144 | `yard/store-1.png`、`store-2.png`、`store-3.png` | 少 / 中 / 多三种 | P1 |
| Y9 | 前墙 | 360×54 | 1080×162 | `yard/front-wall.png` | 中间留出院门的位置（62 宽） | P0 |
| Y10 | 院门五档 | 62×58 | 372×348 | `door/door-0.png` … `door-4.png` | 柴门、木门、铁皮门、朱漆铜钉门、机关大门。**守夜和当厉鬼也用这五张，会放大**，所以出 6 倍 | P0 |
| Y11 | 匾额（空白，不写字） | 48×18 | 144×54 | `yard/plaque.png` | 深色木匾、金边，中间留空，字由程序写 | P1 |
| — | 门口灯笼（门 ≥ 木门） | 10×18 | 30×54 | `yard/door-lantern.png` | 红灯笼 | P1 |
| — | 石狮子（门 ≥ 朱漆铜钉门） | 24×28 | 72×84 | `yard/lion.png` | 一只，另一只程序镜像 | P1 |
| — | 护院大阵（机关大门） | 172×36 | 516×108 | `yard/array-glow.png` | 地上一圈发光的阵纹，半透明 | P2 |
| — | 「守住 N 夜」小牌 | 68×16 | 204×48 | `yard/held-sign.png` | 空白小木牌，字由程序写 | P2 |

**装饰**（摆在 D1–D7 七个位置上，每个位置约 40×44）：

| 东西 | 出图 | 文件名 | 优先级 |
| --- | --- | --- | --- |
| 盆栽（一盆小松） | 120×132 | `decor/pot.png` | P1 |
| 水缸（养着两尾鱼） | 120×132 | `decor/vat.png` | P1 |
| 石桌石凳 | 120×132 | `decor/table.png` | P1 |
| 桂花树（开着小黄花） | 120×150 | `decor/tree.png` | P1 |
| 院石（河埠搬回来的青纹石） | 90×60 | `decor/stone.png` | P2 |

**机关**（白天在院墙上，夜里在守夜画面里，同一张图）：

| 东西 | 画面尺寸 | 出图 | 文件名 | 优先级 |
| --- | --- | --- | --- | --- |
| 弩机 | 30×26 | 120×104 | `trap/crossbow.png` | P1 |
| 灯笼串（一整串，横着） | 360×24 | 1080×72 | `trap/lamp-string.png` | P1 |
| 镇宅符 | 16×24 | 64×96 | `trap/talisman.png` | P1 |

### B. 守夜（画面 360×500，夜里）

| 东西 | 出图 | 文件名 | 说明 | 优先级 |
| --- | --- | --- | --- | --- |
| 守夜背景 | 1080×1500 | `night/bg.webp` | 从自家院门往外看的雨夜窄巷：两边高墙，远处巷口，近处是院墙和门框。**画暗**，光由程序加；雨也由程序下 | P0 |
| 门框和门楣 | 1080×420 | `night/gate-frame.png` | 院门两边的门柱和门楣，叠在门的外面 | P1 |
| 鬼的特点小牌：飞、隐、甲 | 48×48 各一 | `night/tag-fly.png`、`tag-shade.png`、`tag-armor.png` | 只画底牌（圆牌或小旗），**字由程序写** | P2 |
| 手里的东西：剑、弓、灯笼 | 96×96 各一 | `night/item-sword.png`、`item-bow.png`、`item-lamp.png` | 守夜时下面那排按钮上的图 | P1 |
| 本事卡的图标 | 96×96 各一，共 17 张 | `perk/<编号>.png` | 编号：heavy、crit、sweep、qi、pierce、burn、ear、eye、lampstr、bowplus、bowfast、rain、fix、bolt、slow、soul、coins（每张是什么见 `src/core/loop/night-config.ts` 的 PERKS） | P2 |

### C. 野外地图（画面 360×360，正上方俯视）

| 东西 | 出图 | 文件名 | 说明 | 优先级 |
| --- | --- | --- | --- | --- |
| 地图底图 | 1080×1080 | `map/bg.webp` | 中间是家，往外三圈：近郊（田、竹林、河）、山林（松林、猎场、矿洞）、禁地（古墓、乱葬岗）。越往外越暗、越多雾 | P1 |
| 家 | 72×72 | `map/home.png` | 小房子图标 | P1 |
| 八个地点 | 120×120 各一 | `map/spot-0.png` … `spot-7.png` | 0 河边、1 竹林、2 菜地、3 松林、4 猎场、5 矿洞、6 古墓、7 乱葬岗 | P1 |

### D. 河埠（已经有背景图）

`assets/riverside.webp` 已经在用。里面的小东西可以换：木头、青纹石、绳子、草药、木排、挑担的周伯（周伯是人，用捏人台捏，见第 I 项）。P2。

### E. 当厉鬼（画面 360×500，夜里）

| 东西 | 出图 | 文件名 | 说明 | 优先级 |
| --- | --- | --- | --- | --- |
| 别人家门口 | 1080×1500 | `haunt/bg.webp` | 月夜，从街上看别人家的院门（门用第 A 项的五张门） | P1 |

### F. 老死、奈何桥、祠堂

| 东西 | 画面尺寸 | 出图 | 文件名 | 说明 | 优先级 |
| --- | --- | --- | --- | --- | --- |
| 老死那一刻 | 360×300 | 1080×900 | `afterlife/death-bg.webp` | 月夜、远山、一片空地。安静，不恐怖 | P1 |
| 奈何桥 | 360×220 | 1080×660 | `afterlife/bridge-bg.webp` | 淡紫的雾、水、一座拱桥，**不写桥名** | P1 |
| 祠堂的画像框 | 180×190 | 540×570 | `hall/frame.png` | 卷轴或木框，中间透明（画像由程序画进去） | P1 |
| 祠堂墙 | 360×300 | 1080×900 | `hall/wall.webp` | 挂画像的墙，香炉、供桌 | P2 |

### G. 和人说话的头像框

| 东西 | 出图 | 文件名 | 说明 | 优先级 |
| --- | --- | --- | --- | --- |
| 头像底框 | 252×288 | `ui/talk-frame.png` | 头像后面的底和边框（现在是一块米色圆角）。中间放人物，不要挡住脸 | P1 |
| 对话气泡 | 可拉伸的九宫格，96×96 | `ui/bubble.png` | 宣纸质感，左下角有个小尖 | P2 |

### H. 货物和宝物图标（集市、仓库里用）

每个出 96×96，PNG 透明底，`goods/<名字>.png`、`treasure/<名字>.png`。P0（集市里一眼就看得懂卖的是什么）。

- 货物 8 个：柴、时蔬、草药、兽皮、铁矿、古物、木炭、金疮药
- 宝物 6 个：古玉、夜明珠、青铜剑、金步摇、玉玺残片、夜行衣

文件名用中文也可以，例如 `goods/柴.png`。

### I. 七个 NPC：用捏人台捏脸（P0，最省事、效果最明显）

打开 `docs/art/creator/index.html`，给下面每个人捏一张脸，在「灵感」那一栏点「复制捏人码」，把**捏人码**写进 `docs/art/npc-looks.md`。

| 人 | 在哪说话 | 样子的方向 |
| --- | --- | --- |
| 钱掌柜 | 集市 | 圆脸、精明、笑眯眯，戴小帽或斗笠，衣服体面 |
| 鲁师傅（木匠） | 修院子 | 结实、皮肤晒黑、短打、腰上别着工具 |
| 摆渡人 | 奈何桥 | 老人、白发、斗笠、旧蓑衣，沧桑但和气 |
| 王大哥 | 邻居 | 憨厚的壮年男人 |
| 李二娘 | 邻居 | 爽利的中年妇人 |
| 赵小六 | 邻居 | 机灵的少年 |
| 周伯 | 河埠挑担的 | 驼背的老挑夫 |

祖宗不用捏：祖宗就是你前几世捏的那张脸。

### J. 界面（P2）

| 东西 | 出图 | 文件名 | 说明 |
| --- | --- | --- | --- |
| 宣纸底纹 | 512×512 可平铺 | `ui/paper.png` | 卡片的底，很淡，不能影响看字 |
| 印章 | 96×96 | `ui/seal.png` | 主要按钮的角上点缀 |
| 钱箱、钱袋、体力 | 48×48 各一 | `ui/chest.png`、`purse.png`、`hp.png` | 顶上那一栏用 |
| 开场画面 | 1080×900 | `ui/intro.webp` | 清晨推开院门 |

## 4. 先做哪些（建议）

**第一批（P0）**：院子背景、正屋（小院）、前墙、院门五档、灶三种状态、宝物架、守夜背景、货物和宝物图标 14 个、7 个 NPC 的捏人码。
这一批换完，一天里最常看的院子、集市、守夜就都有了美术。

**第二批（P1）**：中院、大宅、装饰、机关、地图、老死、奈何桥、祠堂框、头像框、手里的东西。

**第三批（P2）**：本事卡图标、界面、开场、河埠的小东西。

## 5. 用 AI 生成时的提示词

很多图可以先用 AI 生成，再修。下面的英文提示词可以直接用；每次都把**通用前缀**放在最前面，保证风格一致。

**通用前缀（每张都加）**

```
flat 2D illustration for a mobile game, Chinese wuxia countryside, Jiangnan style, soft gouache texture, clean shapes, gentle lighting, muted warm palette of beige, ink gray and vermilion, front view with a slight top-down angle, no text, no letters, no watermark, no people
```

**负面提示词（工具支持的话加上）**

```
text, letters, calligraphy, watermark, logo, photo, 3D render, realistic, horror, blood, opera costume, people, characters
```

**小物件额外加**：`isolated object, centered, transparent background, full object visible, ground shadow only`

| 东西 | 提示词（接在通用前缀后面） |
| --- | --- |
| 院子背景 | `a small courtyard ground of packed earth and stone slabs, morning sky, distant soft green hills, empty space in the middle for a house, wide shot` |
| 正屋（小院） | `a modest single-story house with white walls and dark gray tiled roof, one wooden door and two lattice windows, isolated, transparent background` |
| 正屋（大宅） | `a dignified courtyard residence with white walls, dark tiled roof and a side wing on the right, carved lattice windows, red lanterns under the eaves, isolated, transparent background` |
| 院门（柴门） | `a crude gate made of bundled branches and twine, isolated, transparent background` |
| 院门（木门） | `a sturdy plank wooden gate with iron nails, isolated, transparent background` |
| 院门（铁皮门） | `a wooden gate reinforced with dark iron sheets and rivets, isolated, transparent background` |
| 院门（朱漆铜钉门） | `a vermilion lacquered double gate with rows of brass studs and brass door rings, isolated, transparent background` |
| 院门（机关大门） | `a heavy mechanical fortress gate with gears, bronze bolts and faint glowing runes, isolated, transparent background` |
| 灶（空着） | `a small clay brick stove with a black iron pot on top, cold, isolated, transparent background` |
| 灶（在烧） | `a small clay brick stove with a black iron pot, orange fire glowing in the stove mouth, thin smoke rising, isolated, transparent background` |
| 灶（烧好了） | `a small clay brick stove with a black iron pot, white steam puffs rising from the pot, isolated, transparent background` |
| 宝物架 | `an empty two-tier wooden display shelf, isolated, transparent background` |
| 桂花树 | `a small osmanthus tree with tiny yellow blossoms, isolated, transparent background` |
| 水缸 | `a glazed ceramic water vat with two small orange fish, isolated, transparent background` |
| 守夜背景 | `night, rainy narrow alley seen from inside a courtyard gate, tall walls on both sides, distant alley mouth, wet stone floor, very dark, cold indigo palette, no light sources` |
| 地图底图 | `top-down map, a tiny house in the center, three concentric zones: farmland and bamboo near the center, pine forest and mines in the middle ring, ancient tombs in misty dark outer ring` |
| 奈何桥 | `misty pale purple river at night, an old stone arch bridge, soft fog, calm and melancholic, not scary` |
| 货物图标 | `game item icon of a bundle of firewood, isolated, transparent background`（把 firewood 换成 vegetables、medicinal herbs、animal pelt、iron ore、antique bronze ware、charcoal、wound ointment jar） |

AI 生成的图常见毛病，交之前检查一下：透视不统一（有的平视有的俯视）、图里冒出字、背景不透明、同一样东西几张颜色对不上。

## 6. 怎么交

- 照第 2 节的命名放进 `assets/art/` 对应的文件夹，整个文件夹打包给产品负责人
- 每张图在 `assets/art/CREDITS.md` 写一行：文件名、作者或工具、来源和授权
- NPC 的捏人码写进 `docs/art/npc-looks.md`
- 不用一次交齐：交了哪张，游戏就换哪张
