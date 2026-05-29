# 海洋新闻爬虫 Windows 版使用说明

## 一、快速启动

### 1. 启动 Web 页面服务

在项目目录中双击运行：

```bat
run.bat
```

启动成功后，在浏览器中打开：

```text
http://127.0.0.1:8000/
```

即可进入海洋新闻爬虫 Web 页面。

> 注意：运行期间请不要关闭黑色命令行窗口。关闭该窗口后，Web 服务会停止。

---

## 二、目录与配置说明

### 1. 数据源配置

如需修改或新增数据源，请编辑以下配置文件：

```text
app\configs\sources.yaml
app\configs\sources\*.yaml
```

其中：

* `app\configs\sources.yaml`：用于注册和启用数据源；
* `app\configs\sources\`：用于存放各数据源的详细抓取配置。

---

### 2. 结果输出目录

JSON 抓取结果默认输出到：

```text
output\
```

---

### 3. 日志目录

运行日志默认输出到：

```text
logs\
```

同时，控制台窗口中也会显示抓取进度和错误信息。

---

### 4. SQLite 数据库

SQLite 数据库默认写入：

```text
data\crawler.db
```

如需指定数据库路径，可修改 `run.bat` 中的启动命令，例如：

```bat
marine_news_crawler.exe --web --db D:\crawler_data\crawler.db
```

---

## 三、端口配置

默认 Web 服务端口为：

```text
8000
```

如果端口 `8000` 被占用，可在命令行中指定其他端口，例如：

```bat
marine_news_crawler.exe --web --port 8001
```

然后在浏览器中访问：

```text
http://127.0.0.1:8001/
```

---

## 四、高级命令行用法

### 1. 指定数据源抓取

```bat
marine_news_crawler.exe --sources eworldship,xindemarinenews --days 7 --db D:\crawler_data\crawler.db
```

说明：

* `--sources`：指定需要抓取的数据源；
* `--days`：指定抓取最近多少天的新闻；
* `--db`：指定数据库文件路径。

---

### 2. 抓取所有已启用数据源

```bat
marine_news_crawler.exe --enabled
```

该命令会根据配置文件抓取当前已启用的数据源。

---

# AI 辅助配置说明（Cursor Skill）

本项目内置了一个 Cursor Agent Skill，可辅助完成：

```text
分析网站 → 编写配置 → 试运行验证
```

使用该 Skill 后，无需手动编写 YAML 配置文件，AI 可以根据目标新闻网站自动分析页面结构，并生成对应的数据源配置。

---

## 一、Skill 文件位置

```text
.cursor\skills\marine-news-crawler\SKILL.md
```

---

## 二、使用前提

使用前，请先在 **Cursor IDE** 中打开本项目目录。

---

## 三、使用方法

### 方法一：直接描述任务（推荐）

在 Cursor 对话框中直接输入需求，例如：

```text
帮我给 https://www.example-maritime.com 新增新闻源
```

或：

```text
motorship 的 selector 报 selector_not_found，帮我修复
```

或：

```text
用 marine-news-crawler skill 分析 seatrade 的新结构
```

AI 会自动识别并加载对应 Skill，按照项目内置流程完成配置分析与验证。

---

### 方法二：手动指定 Skill

也可以在 Cursor 对话框中手动指定：

```text
@marine-news-crawler
```

然后继续描述具体需求。

例如：

```text
@marine-news-crawler 帮我新增一个 seatrade 的新闻源配置
```

该方式可以确保 AI 优先使用本项目内置的 Skill 流程。

---

## 四、Skill 工作流程

该 Skill 主要覆盖以下三个阶段。

### 1. 分析网站

AI 会使用 WebFetch 抓取列表页、RSS 或详情页，并自动判断适合的抓取策略，例如：

* 静态 HTML；
* RSS；
* Playwright；
* 旧 TLS 兼容方式。

同时，AI 会分析页面中的：

* 新闻列表选择器；
* 标题选择器；
* 链接选择器；
* 发布时间选择器；
* 日期格式；
* 详情页正文结构。

---

### 2. 写入配置文件

AI 会自动写入或更新以下配置文件：

```text
app\configs\sources.yaml
app\configs\sources\{name}.yaml
```

说明：

* `sources.yaml` 用于注册数据源；
* `{name}.yaml` 用于保存该数据源的详细抓取规则；
* 此过程不会修改 `exe` 文件或已有核心代码。

---

### 3. 试运行验证

配置完成后，AI 会执行类似以下命令进行验证：

```bat
marine_news_crawler.exe --sources {name} --days 3
```

然后读取日志并确认运行结果。

一般情况下，当日志中显示：

```text
inserted >= 1
```

即可认为该数据源配置基本可用。

---

## 五、Skill 延伸文档

如需进一步查看配置字段或排查问题，可参考以下文档：

```text
.cursor\skills\marine-news-crawler\config-schema.md
.cursor\skills\marine-news-crawler\troubleshooting.md
.cursor\skills\marine-news-crawler\examples\
```

说明：

* `config-schema.md`：YAML 字段速查；
* `troubleshooting.md`：常见日志报错与修复方法；
* `examples\`：HTML / RSS 数据源完整注释示例。

---

# GitHub 仓库与下载说明

本目录对应 GitHub 仓库：

```text
marine_news_crawler_delivery
```

该仓库采用“方案 A”交付方式，即：

* 源码开发仓库与交付仓库分离；
* 交付仓库主要跟踪配置文件、说明文档、启动脚本和 Cursor Skill；
* 完整运行包通过 GitHub Releases 下载。

---

## 一、仓库地址

```text
https://github.com/echosongg/marine_news_crawler_delivery
```

---

## 二、仓库分工

| 类型     | 说明                                                                    |
| ------ | --------------------------------------------------------------------- |
| 源码开发仓库 | `marine_news_crawler`，用于维护 Python 源码                                  |
| 交付配置仓库 | `marine_news_crawler_delivery`，用于维护 README、run.bat、配置文件和 Cursor Skill |
| 完整运行包  | 通过 GitHub Releases 下载，包含 `exe` 与 `_internal` 目录                       |

---

## 三、完整运行包下载

最新版本下载地址：

```text
https://github.com/echosongg/marine_news_crawler_delivery/releases/download/v1.0.0/marine_news_crawler_delivery-v1.0.0.zip
```

该压缩包包含：

* `marine_news_crawler.exe`
* `_internal`
* `run.bat`
* `app\configs`
* `.cursor\skills`
* 相关说明文件

---

## 四、首次使用步骤

首次使用时，请按以下步骤操作：

1. 打开 GitHub 仓库的 Releases 页面；
2. 下载最新版本的运行包：

```text
marine_news_crawler_delivery-vX.X.X.zip
```

3. 解压到任意目录；
4. 双击运行：

```bat
run.bat
```

5. 浏览器访问：

```text
http://127.0.0.1:8000/
```

即可开始使用。

---

# 维护者发版步骤

当需要发布新版本时，维护者可按以下流程操作。

## 1. 生成发布压缩包

在项目根目录执行：

```powershell
.\scripts\make-release-zip.ps1 -Version v1.0.0
```

执行完成后，会在以下目录生成发布包：

```text
dist\
```

示例文件名：

```text
marine_news_crawler_delivery-v1.0.0.zip
```

---

## 2. 上传 GitHub Release

将生成的 zip 文件上传到 GitHub Release 页面。

---

## 3. 提交配置与 Skill 变更

如果本次发版修改了配置文件、README 或 Cursor Skill，需要提交到 GitHub：

```bash
git add README.md run.bat app\configs .cursor\skills
git commit -m "docs: update delivery package and crawler skill"
git push
```

注意：

```text
exe 文件和 _internal 目录不需要提交到 Git 仓库
```

它们只需要放入 GitHub Release 的 zip 运行包中。

---

# 常见注意事项

1. 运行 Web 服务时，请不要关闭命令行窗口。
2. 如果页面无法打开，请先确认服务是否启动成功。
3. 如果端口被占用，可使用 `--port` 指定新端口。
4. 如果抓取不到新闻，请优先查看 `logs\` 目录中的日志。
5. 如果需要新增数据源，推荐使用 Cursor Skill 自动辅助配置。
6. Git 仓库只维护轻量配置和文档，完整运行包请通过 GitHub Releases 下载。

