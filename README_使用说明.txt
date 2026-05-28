海洋新闻爬虫 Windows 版使用说明

1. 双击 run.bat 启动 Web 页面服务。
2. 启动成功后，在浏览器打开 http://127.0.0.1:8000/ 使用爬虫页面。
3. 运行期间不要关闭黑色命令行窗口；关闭窗口即停止 Web 服务。
4. 如需修改数据源，请编辑 app\configs\sources.yaml 和 app\configs\sources\ 下对应的 YAML 文件。
5. JSON 结果会输出到 output\ 目录。
6. 运行日志会输出到 logs\ 目录，同时控制台也会显示进度和错误。
7. SQLite 数据库默认写入 data\crawler.db。
8. 如需指定数据库路径，可把 run.bat 中的启动命令改为：marine_news_crawler.exe --web --db D:\crawler_data\crawler.db
9. 如果端口 8000 被占用，可在命令行运行：marine_news_crawler.exe --web --port 8001

高级命令行用法：
marine_news_crawler.exe --sources eworldship,xindemarinenews --days 7 --db D:\crawler_data\crawler.db
marine_news_crawler.exe --enabled

────────────────────────────────────────────────────────────
AI 辅助配置（Cursor Skill）
────────────────────────────────────────────────────────────
本项目内置了一个 Cursor Agent Skill，可让 AI 自动完成「分析网站 →
写配置 → 试运行」的完整流程，无需手动写 YAML。

Skill 文件位置：
  .cursor\skills\marine-news-crawler\SKILL.md

使用前提：
  在 Cursor IDE 中打开本项目目录。

使用方法：

  方法一（推荐）— 在对话框直接描述任务：
    例：「帮我给 https://www.example-maritime.com 新增新闻源」
    例：「motorship 的 selector 报 selector_not_found，帮我修复」
    例：「用 marine-news-crawler skill 分析 seatrade 的新结构」
    AI 会自动识别并加载 skill，按三阶段流程操作。

  方法二 — 手动指定 skill：
    在对话框输入 @marine-news-crawler，再描述需求，
    可确保 AI 优先使用此 skill 的流程。

Skill 覆盖的三个阶段：
  1. 分析网站   — AI 用 WebFetch 抓列表页/RSS/详情页，
                  自动判断抓取策略（静态HTML / RSS / Playwright / 旧TLS），
                  找出所有 CSS 选择器和日期格式。
  2. 写配置文件 — 自动写入 app\configs\sources.yaml（注册）
                  和 app\configs\sources\{name}.yaml（详情），
                  不修改任何 exe 或现有代码。
  3. 试运行验证 — 执行 marine_news_crawler.exe --sources {name} --days 3，
                  读取日志，确认 inserted >= 1 后结束。

Skill 延伸文档（需要时查阅）：
  .cursor\skills\marine-news-crawler\config-schema.md    YAML 字段速查
  .cursor\skills\marine-news-crawler\troubleshooting.md  日志报错与修复
  .cursor\skills\marine-news-crawler\examples\           HTML/RSS 完整注释示例

────────────────────────────────────────────────────────────
GitHub 仓库与下载
────────────────────────────────────────────────────────────
本目录对应 GitHub 仓库 marine_news_crawler_delivery（方案 A）：

  仓库地址：  https://github.com/echosongg/marine_news_crawler_delivery
  源码开发：  marine_news_crawler（Python 源码，单独仓库）
  交付配置：  本仓库 git 跟踪 README、run.bat、app\configs、.cursor\skills
  完整运行包：GitHub Releases 下载 zip（含 exe 与 _internal，约 88 MB）
  最新下载：  https://github.com/echosongg/marine_news_crawler_delivery/releases/download/v1.0.0/marine_news_crawler_delivery-v1.0.0.zip

首次使用（从 GitHub 下载）：
  1. 打开仓库 Releases 页面，下载最新 marine_news_crawler_delivery-vX.X.X.zip
  2. 解压到任意目录，双击 run.bat 启动

维护者发版步骤：
  1. 在项目根目录执行：  .\scripts\make-release-zip.ps1 -Version v1.0.0
  2. 将生成的 dist\marine_news_crawler_delivery-v1.0.0.zip 上传到 GitHub Release
  3. git add / commit / push 配置与 skill 的变更（不含 exe 与 _internal）