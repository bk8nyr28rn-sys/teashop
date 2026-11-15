# 离线字体

`zcool-kuaile.woff2` 为展示字体，`noto-sans-sc.woff2` 为正文可变字体（400–700 字重，覆盖常规与粗体）。两者均按网页实际 bundle 中的字符串与页面静态文字裁剪，包含核心规则返回的错误、事件文案、动态模板的各段和基本 ASCII；不包含整个中文字库、注释或测试文案。等宽数字等 OpenType 特性保留。

`npm run build:web` 将两份 WOFF2 以 data URL 内嵌到 `dist/web/teashop.html`，同时附带两份 OFL 授权。正常构建无需网络、Python 或原始字体。打开 HTML 不请求 Google Fonts，也不需要相邻字体文件。

自定义名字中的生僻字不可能预先穷举：未收录字符由现有系统字体栈显示。`unicode-range` 明确限定内嵌字体覆盖范围；无需下载其它字库。

## 更新文案后的字体刷新

构建会检查用字集合的 SHA-256；新用字出现时拒绝使用过期子集，并提示刷新。字体的固定上游版本、原文件校验值、覆盖范围和大小记录在 `manifest.json`。

```sh
python -m pip install -r scripts/font-requirements.txt
python scripts/subset-fonts.py
npm run build:web
```

刷新工具首次从固定版本的 Google Fonts GitHub 仓库下载源字体及 OFL（不使用 Google Fonts CDN），缓存到 `.cache/fonts/`，后续可离线刷新。可通过 `--source-dir PATH` 指向已经准备好源字体和授权文件的目录。重新生成的 WOFF2 与 manifest 应一并提交；原始大字体和缓存不随原型分发。

上游：ZCOOL KuaiLe（ZCOOL KuaiLe Project Authors）、Noto Sans SC（Adobe / Noto）。完整版权与许可证见本目录的 `ZCOOL-OFL.txt` 和 `Noto-OFL.txt`。
