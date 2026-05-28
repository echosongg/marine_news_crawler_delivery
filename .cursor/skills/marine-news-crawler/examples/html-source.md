# HTML 源配置示例（含注释）

以一个假想的静态 HTML 海事新闻站点为例，展示完整配置逻辑。  
实际参考：`app/configs/sources/eworldship.yaml`（中文 / GBK）、`sources/xindemarinenews.yaml`

---

## 场景假设

目标：`https://www.example-maritime.com`  
列表页：`/news/`，文章条目为 `<li class="news-item">`  
详情页：标题 `h1.article-title`，正文 `.article-body`，日期 `time.published`  
无反爬，静态 HTML，英文站点

---

## sources.yaml 条目

```yaml
- name: example_maritime
  url: https://www.example-maritime.com
  type: html
  status: enable
```

---

## sources/example_maritime.yaml

```yaml
# ============================================================
# example-maritime.com — 示例海事新闻站
# 静态 HTML，英文，UTC 时区
# ============================================================

source:
  name: example_maritime          # 必须与 sources.yaml 中的 name 一致
  url: https://www.example-maritime.com
  type: html
  strategy: html                  # → 使用 HTMLConnector
  status: enable

request:
  timeout: 20
  headers:
    User-Agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
    Accept-Language: "en-US,en;q=0.9"

list_page:
  url: https://www.example-maritime.com/news/
  sections:

    # ── 1. 最新新闻 ──────────────────────────────────────────────
    # 列表结构：<ul class="news-list"><li class="news-item">
    #   <a href="/news/2026/article-slug">
    #     <h2 class="title">Article Title</h2>
    #     <time class="date">2026-04-21</time>
    #   </a>
    # </li></ul>
    - name: latest_news
      section_title: "Latest News"
      item_selector: "ul.news-list li.news-item"  # 文章容器
      link_selector: "a[href]"                    # 容器内的链接
      title_selector: "h2.title"                  # 容器内的标题
      date_selector: "time.date"                  # 容器内的日期（无则写 null）
      tags:
        - type: section
          name: latest_news
        - type: language
          name: en

    # ── 2. 技术专栏（另一分类页）────────────────────────────────
    - name: technology
      section_title: "Marine Technology"
      url: https://www.example-maritime.com/technology/  # 覆盖父 url
      item_selector: "ul.news-list li.news-item"
      link_selector: "a[href]"
      title_selector: "h2.title"
      date_selector: "time.date"
      tags:
        - type: section
          name: technology

detail_page:
  # 详情页结构：
  #   <h1 class="article-title">Full Title</h1>
  #   <div class="article-meta">
  #     <time class="published" datetime="2026-04-21">April 21, 2026</time>
  #   </div>
  #   <div class="article-body">
  #     <p>正文段落...</p>
  #   </div>
  #   <div class="related-articles">...</div>
  title_selector: "h1.article-title"
  content_selector: ".article-body"
  date_selector: "time.published"
  remove_selectors:
    - "script"
    - "style"
    - "nav"
    - "header"
    - "footer"
    - ".related-articles"    # 相关推荐
    - ".social-share"        # 分享按钮
    - ".comments"            # 评论区
    - ".advertisement"       # 广告

parse:
  date_format: "%B %d, %Y"     # 对应 "April 21, 2026"
  timezone: UTC
  max_articles_per_run: 20     # 两个 section 合计最多处理 20 篇

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

---

## 变体：中文 GBK + 弱 TLS 站点

在 `request` 块加两个字段（参考 `eworldship.yaml`）：

```yaml
request:
  timeout: 25
  legacy_tls_compatibility: true   # DH 密钥过小，必须启用
  headers:
    User-Agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    Accept-Language: "zh-CN,zh;q=0.9,en;q=0.8"
    Referer: "https://www.example-cn.com/"
```

`parse` 块改为：

```yaml
parse:
  date_format: "%Y-%m-%d %H:%M:%S"  # 中文站常见格式
  timezone: Asia/Shanghai
  max_articles_per_run: 35
```

---

## 变体：需要 Playwright 的站点

列表页 JS 渲染、详情页 Cloudflare 等场景（参考 `motorship.yaml`）：

```yaml
request:
  timeout: 45           # Playwright 启动较慢，建议 45+
  use_playwright: true
  headers:
    User-Agent: "Mozilla/5.0 ..."
```

> 前提：本地已安装 Playwright 浏览器（`playwright install chromium`）
