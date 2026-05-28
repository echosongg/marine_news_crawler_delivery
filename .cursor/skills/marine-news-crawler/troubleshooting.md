# Troubleshooting — 日志报错与修复

日志路径：`logs/crawler_YYYYMMDD.log`  
日志格式：`时间 | 级别 | app.模块:方法:行号 - 消息`

---

## 选择器类错误

### selector_not_found

```
crawl_error site=XXX section=YYY stage=extract_candidates
type=selector_not_found
msg=No elements matched item_selector: '.subSleeve'
```

**原因**：网站改版，`item_selector` 对应的 CSS 类名/结构已变化。

**修复步骤**：
1. WebFetch 列表页 URL
2. 在 HTML 中搜索文章标题文字，找到对应的容器元素
3. 更新 `list_page.sections[].item_selector`
4. 同步检查 `link_selector` 和 `title_selector` 是否也失效

---

### content_empty

```
crawl_error site=XXX section=YYY stage=parse_detail_page
type=content_empty
msg=Article content is shorter than the configured minimum length
```

**原因 A**：`content_selector` 命中了错误元素，或目标元素被 `remove_selectors` 误删。  
**原因 B**：正文字符数确实很短（摘要类站点、PDF 提取不完整）。  
**原因 C**：详情页需要 Playwright 但未启用，拿到的是空 body。

**修复步骤**：
1. WebFetch 详情页 URL，确认 `content_selector` 命中正文
2. 检查 `remove_selectors` 没有误删正文父容器
3. 若是摘要类站点：降低 `min_content_length`（如 20）
4. 若 HTML body 基本为空：加 `use_playwright: true`

---

## Playwright 类错误

### 浏览器可执行文件不存在

```
Playwright fetch failed … Executable doesn't exist at
…_internal\playwright\driver\package\.local-browsers\chromium_headless_shell-1208\…
```

**原因**：Playwright 未安装浏览器，或路径变更。

**修复**：在 `_internal/` 目录下运行：
```powershell
.\playwright install
```
或指定 chromium：
```powershell
.\playwright install chromium
```

### Playwright Sync API in asyncio loop

```
Playwright fetch failed … It looks like you are using Playwright Sync API
inside the asyncio loop. Please use the Async API instead.
```

**原因**：这是已知的 Playwright 集成问题，当 use_playwright: true 的站点在异步批量任务中运行时会触发。Connector 会自动 fallback 到 HTTP client。

**影响**：fallback 后 JS 渲染的页面会拿到空内容，最终 `in_window=0` 或 `selector_not_found`。

**临时绕法**：用 `--sources NAME` 单独运行该 source（不在批量并发中），可减少此问题。

---

## 时间窗类问题

### in_window=0，但 candidates > 0

```
collection done – candidates=20 list_date=0 detail_date=20 in_window=0 filtered=20
```

**原因 A**：日期解析失败，文章被归入未知日期桶，不进时间窗。  
**原因 B**：站点确实没有时间窗内的新文章（如季度更新的产品目录）。  
**原因 C**：`timezone` 设置错误，日期差了 8 小时导致窗口边界偏移。

**排查**：
1. 先用 `--days 30` 甚至 `--days 365` 重跑，确认是配置问题还是内容问题
2. WebFetch 详情页，手动确认 `date_selector` 命中的文字，核对 `date_format`
3. 中文站确认 `timezone: Asia/Shanghai`

---

### no_date 占比高

```
collection done – no_date=15 in_window=2
```

**原因**：`date_selector` 命中元素为空，或文字格式与 `date_format` 不匹配。

**排查**：
- WebFetch 详情页，看 `date_selector` 对应位置的实际文字格式
- 参考 SKILL.md 日期对照表，选正确的 `date_format`
- 注意月份语言：英文月名用 `%B` / `%b`，数字月份用 `%m`

---

## 网络类问题

### 连接超时（正常重试）

```
Request error for 'https://...' (attempt 1/3): The read operation timed out. Retrying in 1.0s
```

网络波动，Connector 自动重试最多 3 次，通常可自愈。若频繁出现，增大 `request.timeout`。

### TLS / SSL 错误

```
SSL: UNEXPECTED_EOF_WHILE_READING
TLSV1_UNRECOGNIZED_NAME
DH_KEY_TOO_SMALL
```

加 `legacy_tls_compatibility: true`，Connector 切换为 urllib + SECLEVEL=1 模式。

---

## 常见配置陷阱

| 问题 | 原因 | 修复 |
|------|------|------|
| 所有文章都抓到但 `inserted=0` | 文章 URL 在 DB 中已存在 | 正常，去重机制生效，不是 bug |
| `sources.yaml` 改了 name 但没抓 | 详情 yaml 的 `source.name` 未同步改 | 两处 name 必须完全一致 |
| 新 source 跑 `--enabled` 没出现 | `status: disable` 或已加 `skip_in_regular_crawl: true` | 改 enable 或用 `--sources NAME` 指定 |
| PDF 文章正文为空 | PDF 加密或扫描件（非文字 PDF） | 无法解析，记录为 content_empty，属已知限制 |
| 详情页日期取到列表页日期格式 | detail_page date_selector 命中了 list 里带来的缓存元素 | 精确化 detail_page date_selector |
