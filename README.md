# Taxi / NCC 考试助手

React + TypeScript + Vite，面向 iPhone / Mac 的中文学习界面，保留意大利语原题与 A/B/C。支持 PWA、离线使用、2015–2024 真题筛选、30 题模拟考试、随机练习、错题本、交卷自动评分、中文解析、历史记录、断点续考、题库/学习备份和独立勘误。

**当前没有提供原始真题资料，正式题库为空，不包含编造的题目或答案。** 收录目标为 21 套 / 630 题，导入真实资料即可启用学习。没有答案的题目不能进入评分；完整 30 题试卷才能考试。

## 运行

要求 Node.js 22.12+（推荐 24）与 npm。

```bash
npm ci
npm run dev
```

打开终端显示的地址。手机与电脑同局域网时可通过电脑 IP 访问开发服务；PWA 安装/离线需要 HTTPS 或 localhost，普通 LAN HTTP 不支持服务工作线程。

```bash
npm run validate:bank
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run preview
```

端到端测试使用生产预览服务器，测试桌面与 iPhone 尺寸的 Chromium，覆盖离线重载与考试流程。实际 iOS Safari 安装仍需真机验证。自动化合成题目仅在 tests 中。

## 导入真实资料

详见 [docs/IMPORT.md](docs/IMPORT.md)。网页导入写入本机浏览器，不会修改仓库。题库 JSON 和完整学习备份分别导入；备份恢复会替换本机数据。已有题目禁止静默覆盖；错误标准答案通过独立 errata 修正，保留依据与时间。每次考试保存当时的答案快照。

所有学习数据使用 localStorage 自动保存；写入失败会明确报错，不假称保存成功。iPhone 与 Mac 之间通过导出/恢复备份迁移，没有账户或云同步。清除站点数据、浏览器回收存储或更换域名都会影响记录，请定期导出备份。

## 部署

构建产物为 `dist/`，可直接托管在任意 HTTPS 静态站点（Cloudflare Pages、Netlify、Vercel 等），构建命令 `npm run build`，输出目录 `dist`。不需要后端、密钥或第三方字体服务。

GitHub Pages：仓库已包含手动触发的 `.github/workflows/deploy.yml`。在仓库 Settings → Pages 选择 GitHub Actions，然后在 Actions 运行 Deploy Pages。流程设置 `BASE_PATH=/taxi-ncc-quiz/` 并发布 dist。其他子路径通过 `BASE_PATH=/子路径/ npm run build` 配置；根域部署用默认 `/`。CI 自动运行单元测试、类型检查、生产构建和浏览器测试。

## PWA

首次联网成功加载后缓存应用全部静态资源，题库/学习进度已在本机保存，可断网重开。设置页显示缓存就绪状态。

- iPhone Safari：分享 → 添加到主屏幕。
- Mac Safari（支持版本）：文件 → 添加到程序坞；Chrome / Edge 使用地址栏安装按钮。
- 新版本就绪后提示更新；未交卷时延后更新，避免打断学习。

答题时不显示答案；交卷确认后统一计分，未答题算错。不声称官方及格或官方时限，具体考试规则应以主管机构公告为准。
