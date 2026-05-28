# RSS 源配置示例（含注释）

RSS 策略：用 RSS feed 发现文章列表（绕过 JS 渲染 / Cloudflare），再请求 HTML 详情页提取正文。  
实际参考：`app/configs/sources/splash247_rss.yaml`（多 feed）、`sources/seatrade.yaml`（RSS + Playwright 详情）

---

## 何时用 RSS 策略

- 列表页被 Cloudflare 403 但 RSS feed 可访问（seatrade 案例）
- 列表页 JS 渲染，文章列表为空，但站点提供 WordPress RSS（splash247 案例）
- 一个站点有多个分类 feed，各自独立配置

---

## sources.yaml 条目

```yaml
- name: example_maritime_rss
  url: https://www.example-maritime.com
  type: rss
  status: enable
```

---

## sources/example_maritime_rss.yaml

```yaml
# ============================================================
# example-maritime.com — RSS 策略示例
# 列表页 JS 渲染 → 改用 RSS feed
# 详情页为正常 HTML（无需 Playwright）
# ============================================================

source:
  name: example_maritime_rss
  url: https://www.example-maritime.com
  type: rss
  strategy: rss              # → 使用 RSSConnector
  status: enable

request:
  timeout: 25
  headers:
    User-Agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
    Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8"
    Accept-Language: "en-US,en;q=0.9"

list_page:
  # 兜底 URL（各 section 已配自己的 url，此处通常不会被用到）
  url: https://www.example-maritime.com/feed/

  # RSS selector 是 XML 标签名，不是 CSS selector
  sections:

    # ── 1. 全站最新（单一 RSS feed）────────────────────────────────
    # RSS XML 结构：
    #   <channel>
    #     <item>
    #       <title>Article Title</title>
    #       <link>https://www.example-maritime.com/news/slug</link>
    #       <pubDate>Thu, 23 Apr 2026 08:00:00 GMT</pubDate>
    #       <description>Teaser text...</description>
    #     </item>
    #   </channel>
    - name: latest_news
      section_title: "Latest News"
      url: https://www.example-maritime.com/feed/
      item_selector: item        # XML <item> 元素
      link_selector: link        # <item> 内的 <link> 文本节点
      title_selector: title      # <item> 内的 <title> 文本节点
      date_selector: pubDate     # <item> 内的 <pubDate>（日期最终取自 HTML 详情页）
      tags:
        - type: section
          name: latest_news

    # ── 2. 技术分类（WordPress 分类 RSS）────────────────────────────
    # WordPress 各分类 RSS 路径规律：/category/{slug}/feed/
    - name: technology
      section_title: "Marine Technology"
      url: https://www.example-maritime.com/category/technology/feed/
      item_selector: item
      link_selector: link
      title_selector: title
      date_selector: pubDate
      tags:
        - type: section
          name: technology
        - type: term
          name: marine_technology

    # ── 3. 环保与合规 ────────────────────────────────────────────
    - name: sustainability
      section_title: "Sustainability & Compliance"
      url: https://www.example-maritime.com/category/sustainability/feed/
      item_selector: item
      link_selector: link
      title_selector: title
      date_selector: pubDate
      tags:
        - type: section
          name: sustainability
        - type: term
          name: sustainability

# ─── 详情页（HTML）─────────────────────────────────────────────────
# RSSConnector 从 RSS <link> 取到文章 URL 后，请求该 HTML 页面提取正文。
# 日期来自 HTML 详情页，不用 RSS pubDate（格式不同）。
detail_page:
  title_selector: "h1.entry-title, h1.post-title, h1"
  content_selector: ".entry-content, .post-content, .article-body"
  date_selector: ".entry-meta time, .post-date, time[datetime]"
  remove_selectors:
    - "script"
    - "style"
    - ".related-posts"
    - ".social-share"
    - ".comments"
    - ".post-navigation"
    - ".advertisement"
    - "noscript"

parse:
  # 日期来自 HTML 详情页，格式通常为 WordPress 本地化英文
  date_format: "%B %d, %Y"      # 对应 "April 21, 2026"
  timezone: UTC
  # 3 个 section × 10 篇 = 最多 30 篇/次
  max_articles_per_run: 30

cleaning:
  strip_html: true
  remove_blank_lines: true
  normalize_whitespace: true
  min_content_length: 20

tagging:
  enable_rule_tagger: true
  enable_llm_tagger: false
  allowed_tag_types:
    - country
    - company
    - vessel_type
    - fuel_type
    - regulator
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

---

## 变体：RSS 列表 + Playwright 详情（Cloudflare 详情页）

参考 `seatrade.yaml`。RSS feed 无限制，但文章详情页被 Cloudflare 保护：

```yaml
request:
  timeout: 45
  use_playwright: true       # 只对详情页生效；RSS list_page 请求不经过 Playwright
  headers:
    User-Agent: "Mozilla/5.0 ..."
    Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8"
```

---

## RSS 源排查提示

| 问题 | 检查点 |
|------|--------|
| `selector_not_found` | RSS 文件里没有 `<item>` 节点，或 feed URL 返回 HTML 而非 XML |
| 日期解析失败 | 日期取自 HTML 详情页而非 RSS pubDate，确认 `detail_page.date_selector` 命中 |
| `link_selector` 取到空 | WordPress RSS 中 `<link>` 前后有空白节点，属正常，Connector 会自动 strip |
| 每次只抓到 10 篇 | RSS feed 默认返回最新 10 条，是 feed 限制，非配置问题 |
