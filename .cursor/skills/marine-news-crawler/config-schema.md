# Config Schema — YAML 字段速查

## sources.yaml（注册表）

每个站点一条，字段说明：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✓ | 唯一标识，必须与 `sources/{name}.yaml` 的 `source.name` 完全一致 |
| `url` | string | ✓ | 站点根 URL（仅用于展示/索引，不影响抓取逻辑） |
| `type` | `html` \| `rss` | ✓ | 与详情 yaml 的 `source.strategy` 保持一致即可 |
| `status` | `enable` \| `disable` | ✓ | `disable` 时不参与任何抓取 |
| `skip_in_regular_crawl` | bool | - | `true` 时跳过常规 `/crawl/run`，只在 `--sources NAME` 手动指定时运行 |

---

## sources/{name}.yaml（详情配置）

### source 块

| 字段 | 说明 |
|------|------|
| `name` | 与 sources.yaml 中的 name 一致 |
| `url` | 站点根 URL |
| `type` | `html` \| `rss` |
| `strategy` | **决定使用哪个 Connector**：`html` → HTMLConnector，`rss` → RSSConnector |
| `status` | `enable` \| `disable` |

### request 块

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `timeout` | int | 20 | 请求超时秒数；Playwright 页面建议 45+ |
| `use_playwright` | bool | false | 启用无头 Chromium；用于 JS 渲染、Cloudflare、AWS WAF |
| `legacy_tls_compatibility` | bool | false | 改用 urllib + SECLEVEL=1；用于 DH key 过小、httpx TLS 不兼容 |
| `headers` | map | - | 自定义请求头，至少设 User-Agent |

常用 headers 组合：

```yaml
# 英文站点
headers:
  User-Agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
  Accept-Language: "en-US,en;q=0.9"

# 中文站点（GBK）
headers:
  User-Agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
  Accept-Language: "zh-CN,zh;q=0.9,en;q=0.8"
  Referer: "https://example.com/"

# RSS 请求
headers:
  Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8"
```

### list_page 块

| 字段 | 说明 |
|------|------|
| `url` | 列表页 URL（RSS 策略填 feed URL） |
| `sections[]` | 一个或多个 section，每个独立抓取 |

**section 字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | section 内部标识（蛇形命名） |
| `section_title` | string | 人类可读标题，用于日志 |
| `url` | string | 可覆盖父 list_page.url；RSS 多 feed 时每个 section 配自己的 url |
| `item_selector` | string | **HTML**：CSS 选择器选出文章容器；**RSS**：固定写 `item` |
| `link_selector` | string | 从 item 内取链接；HTML 为 CSS，RSS 为标签名 `link` |
| `title_selector` | string | 从 item 内取标题；同上 |
| `date_selector` | string \| null | 从 item 内取日期；列表无日期写 `null`；RSS 写 `pubDate` |
| `tags[]` | list | 给该 section 所有文章打预设标签（`type` + `name`） |

常用 tag type：`section`, `region`, `language`, `company`, `engine_maker`, `term`, `content_type`

### detail_page 块

| 字段 | 说明 |
|------|------|
| `title_selector` | 详情页标题的 CSS 选择器，通常 `h1` |
| `content_selector` | 正文容器选择器，越精准越好 |
| `date_selector` | 日期元素选择器；若列表已有日期可写 `time.nonexistent`（让其回退） |
| `remove_selectors[]` | 正文容器内需删除的元素列表（广告、导航、评论等） |

> **重要**：若正文容器内有 date_selector 目标的**父元素**，不要在 remove_selectors 里删该父元素，先删其中不需要的子元素。Connector 先执行 remove_selectors，再提取日期。

### parse 块

| 字段 | 类型 | 说明 |
|------|------|------|
| `date_format` | string | Python strptime 格式字符串；见 SKILL.md 日期对照表 |
| `timezone` | string | IANA 时区：`UTC` / `Asia/Shanghai` / `Asia/Tokyo` 等 |
| `max_articles_per_run` | int | 每次运行每个 source 最多处理文章数；多 section 时为总上限 |

### cleaning 块

| 字段 | 默认 | 说明 |
|------|------|------|
| `strip_html` | true | 剔除 HTML 标签，保留纯文本 |
| `remove_blank_lines` | true | 删除空行 |
| `normalize_whitespace` | true | 合并多余空格 |
| `min_content_length` | 30 | 正文字符数低于此值触发 `content_empty` 错误；PDF 摘要类可调低 |

### tagging 块

| 字段 | 默认 | 说明 |
|------|------|------|
| `enable_rule_tagger` | true | 基于规则自动打标签（国家、公司、船型、燃料等） |
| `enable_llm_tagger` | false | LLM 打标签（当前 mock，生产环境按需开启） |
| `allowed_tag_types[]` | - | 限制该 source 允许打的标签类型 |

### summary / llm 块

当前配置均使用 `mode: rule` 和 mock LLM，保持模板默认值即可，无需修改。
