---
name: marine-news-crawler
description: >-
  为 marine_news_crawler 系统新增或修复新闻源配置。完整三阶段工作流：分析目标网站
  HTML/RSS 结构并找出 CSS 选择器，写入 app/configs/sources.yaml 和
  app/configs/sources/{name}.yaml，然后用 CLI 试运行确认能抓到文章。
  当需要新增海事新闻站点、修复 selector_not_found / content_empty 报错、
  或网站改版需重新分析选择器时使用。触发词：新增新闻源、新网站、爬虫配置、
  selector、sources.yaml、抓取失败、选择器失效、marine news crawler、船讯通爬虫。
disable-model-invocation: true
---

# Marine News Crawler — 源配置工作流

## 架构速览

```
sources.yaml（注册表）→ sources/{name}.yaml（详情配置）
       ↓ source_loader 加载
connector_registry 按 strategy 分发：
  strategy: html → HTMLConnector（静态 HTML / Playwright / PDF）
  strategy: rss  → RSSConnector（RSS 列表 + HTML 详情）
       ↓ crawl_service
时间窗过滤 → cleaning → tagging → SQLite（data/crawler.db）+ output/ JSON
```

**只能动**：`app/configs/` 下的 YAML 文件  
**不能动**：`marine_news_crawler.exe` 及 `_internal/` 目录

---

## Phase 1：分析目标网站

### 1.1 判断抓取策略

用 WebFetch 抓列表页 URL，按下面的决策树选 strategy：

```
抓列表页 URL
├─ HTML 正常，能看到文章列表 → strategy: html
├─ HTML body 基本为空 / 文章列表为空（JS 渲染）
│   ├─ 站点有 RSS → strategy: rss（首选，绕过 JS）
│   └─ 无 RSS    → strategy: html + use_playwright: true
├─ 返回 403（Cloudflare / CDN）
│   ├─ 试 /rss.xml, /feed/, /rss/, /atom.xml → 成功则 strategy: rss
│   └─ 无 RSS → strategy: html + use_playwright: true
└─ 返回 202 + JS 挑战（AWS WAF） → use_playwright: true
```

RSS 常见路径（逐一 WebFetch 试探）：
- `/rss.xml`  `/feed/`  `/rss/`  `/atom.xml`  `/feeds/posts/default`

### 1.2 分析列表页 — HTML 策略

WebFetch 列表页，在返回 HTML 中找**重复出现的文章条目容器**，确定 4 个字段：

| 字段 | 描述 | 常见形式 |
|------|------|---------|
| `item_selector` | 每篇文章的容器元素 | `"li.news-item"` / `"article.post"` / `"div.card"` |
| `link_selector` | 容器内带 href 的链接 | `"h2 > a"` / `"a.title[href]"` / `"a[href*='/news/']"` |
| `title_selector` | 标题元素（无单独标题时可与 link 同） | `"h2"` / `"h3.title"` / `"a[href]"` |
| `date_selector` | 日期元素，列表页无日期则设 `null` | `"time"` / `"span.date"` / `".meta .pubdate"` |

> 若列表页无日期，设 `date_selector: null`，日期从详情页取。

### 1.3 分析列表页 — RSS 策略

WebFetch RSS feed URL，确认 `<item>` 下存在这些标签：

```xml
<item>
  <title>文章标题</title>         → title_selector: title
  <link>https://...</link>        → link_selector: link
  <pubDate>Thu, 23 Apr 2026</pubDate> → date_selector: pubDate
</item>
```

> RSS selector 是 **XML 标签名**，不是 CSS selector。

### 1.4 分析详情页

WebFetch 列表中的任意一篇文章 URL，找下面 4 类元素：

| 字段 | 查找目标 | 建议 |
|------|---------|------|
| `title_selector` | 文章主标题 | 通常是 `h1` |
| `content_selector` | 正文容器 | 越精准越好，避免取到导航/广告 |
| `date_selector` | 发布日期 | 找 `<time>`, `<span>`, 含日期文字的 `<p>` |
| `remove_selectors` | 正文内的噪音元素 | 广告、相关推荐、评论、分享按钮等 |

**日期格式对照表**（填入 `parse.date_format`）：

| 日期样例 | date_format |
|---------|-------------|
| `2026-04-21 11:18:17` | `%Y-%m-%d %H:%M:%S` |
| `2026-04-21` | `%Y-%m-%d` |
| `22/04/2026` | `%d/%m/%Y` |
| `April 21, 2026` | `%B %d, %Y` |
| `Apr 21, 2026` | `%b %d, %Y` |
| `2026/04/21` | `%Y/%m/%d` |
| RSS pubDate RFC 2822 | `%a, %d %b %Y %H:%M:%S %z` |

### 1.5 特殊情况检测

| 现象 | 处置 |
|------|------|
| 详情页 403 但 RSS 列表正常 | `use_playwright: true`（详情走 Playwright） |
| httpx TLS 报错 / DH key too small | `legacy_tls_compatibility: true` |
| 文章链接以 `.pdf` 结尾 | HTMLConnector 自动解析 PDF，无需额外配置 |
| 正文在付费墙后 | 只配摘要部分的 selector（如 `.synopsis-access`） |
| 中文站 GBK 编码 | connector 自动识别，headers 加 `Accept-Language: zh-CN,zh;q=0.9` |

---

## Phase 2：写配置文件

### 2.1 在 sources.yaml 注册

在 `app/configs/sources.yaml` 末尾添加一条：

```yaml
- name: SITE_NAME          # 必须与详情 yaml 的 source.name 一致
  url: https://example.com
  type: html               # html 或 rss
  status: enable
  # skip_in_regular_crawl: true  # 产品目录 / 极低频更新源加此项
```

### 2.2 创建 sources/{name}.yaml

路径：`app/configs/sources/SITE_NAME.yaml`

**HTML 策略基础模板**（复制后按需修改）：

```yaml
source:
  name: SITE_NAME
  url: https://example.com
  type: html
  strategy: html
  status: enable

request:
  timeout: 20
  headers:
    User-Agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
    Accept-Language: "en-US,en;q=0.9"
  # use_playwright: true           # Cloudflare / JS 渲染时加
  # legacy_tls_compatibility: true # DH key 过小 / httpx TLS 兼容问题时加

list_page:
  url: https://example.com/news/
  sections:
    - name: section_name
      section_title: "人类可读标题"
      item_selector: "li.news-item"
      link_selector: "a[href]"
      title_selector: "h2"
      date_selector: "time"        # 无日期写 null
      tags:
        - type: section
          name: section_name

detail_page:
  title_selector: "h1"
  content_selector: ".article-body"
  date_selector: "time.published"
  remove_selectors:
    - "script"
    - "style"
    - "nav"
    - "header"
    - "footer"
    # 按实际情况添加广告/推荐/评论区

parse:
  date_format: "%Y-%m-%d"
  timezone: UTC           # 中文站用 Asia/Shanghai，日文站用 Asia/Tokyo
  max_articles_per_run: 20

cleaning:
  strip_html: true
  remove_blank_lines: true
  normalize_whitespace: true
  min_content_length: 30

tagging:
  enable_rule_tagger: true
  enable_llm_tagger: false
  allowed_tag_types:
    - country
    - company
    - vessel_type
    - fuel_type
    - term

summary:
  enable: true
  mode: rule

llm:
  provider: mock
  model: mock-llm
  base_url: http://mock-llm.local
  api_key_env: MOCK_LLM_API_KEY
  timeout: 10
```

RSS 策略：将 `source.strategy` 改为 `rss`，`list_page.sections` 里使用 XML 标签名作为 selector：

```yaml
item_selector: item
link_selector: link
title_selector: title
date_selector: pubDate
```

### 2.3 参考最近邻模板

按站点特征选现有配置复制修改，比从零写更快且不易出错：

| 特征 | 参考文件 |
|------|---------|
| 中文站 / GBK / 弱 TLS | `sources/eworldship.yaml` |
| WordPress / 多分类 RSS | `sources/splash247_rss.yaml` |
| Cloudflare + Playwright 详情 | `sources/seatrade.yaml` |
| AWS WAF / JS 挑战全链路 | `sources/motorship.yaml` |
| PDF 文章列表 | `sources/csioe_weekly_info.yaml` |
| 产品目录（非新闻） | `sources/woodward.yaml` |
| 多页面/多年度分页 | `sources/kanadevia_newsroom.yaml` |

---

## Phase 3：试运行与验证

### 3.1 运行单源测试

在 `marine_news_crawler_delivery\` 目录执行：

```powershell
.\marine_news_crawler.exe --sources SITE_NAME --days 3
```

日志实时输出到 `logs/crawler_YYYYMMDD.log`，同时控制台也可见。

### 3.2 解读日志

**成功信号**（两行必须都出现）：

```
Source 'SITE_NAME' collection done – ... in_window=N ...
SQLite commit for source 'SITE_NAME' — inserted=N ...
```

`in_window > 0` 且 `inserted > 0` = 成功。

**失败信号速查**：

| 日志关键词 | 含义 | 修复方向 |
|-----------|------|---------|
| `selector_not_found` / `item_selector: 'X'` | 列表页 CSS 选择器未命中 | 重新分析列表页 HTML，修正 `item_selector` |
| `content_empty` | 正文字符数 < `min_content_length` | 修正 `detail_page.content_selector`，或降低 `min_content_length` |
| `Playwright fetch failed … Executable doesn't exist` | Playwright 浏览器未安装 | 在 `_internal/` 目录运行 `playwright install` |
| `timed out` | 网络超时，会自动重试 | 可适当增大 `request.timeout` |
| `in_window=0`，候选 > 0 | 日期解析失败或文章超出时间窗 | 检查 `date_selector` + `date_format` + `timezone`；尝试 `--days 30` |
| `no_date=N`（占比高） | 大量文章日期无法解析 | 检查 `date_selector` 是否命中，`date_format` 是否匹配 |

### 3.3 成功标准

- `in_window >= 1` 且 `inserted >= 1`
- 无 `selector_not_found`
- `content_empty` 占比 < 20%

如 3 天窗口无结果，用 `--days 30` 再试（区分「配置错」还是「近期确实无文章」）。

---

## 约束

- **不修改** `marine_news_crawler.exe` 和 `_internal/` 目录下任何文件
- **不删除**现有 YAML 注释（记录了历史排查知识）
- 配置 `remove_selectors` 时：若父容器内有 `date_selector` 目标元素，**删子元素而非父容器**（否则日期提取在父容器被删后失败，参见 `eworldship.yaml` 注释）
- 新增 `sources.yaml` 条目时 `name` 必须与详情 yaml 的 `source.name` 完全一致

---

## 延伸资料

- 完整 YAML 字段说明：[config-schema.md](config-schema.md)
- 常见错误与修复：[troubleshooting.md](troubleshooting.md)
- HTML 源完整注释示例：[examples/html-source.md](examples/html-source.md)
- RSS 源完整注释示例：[examples/rss-source.md](examples/rss-source.md)
