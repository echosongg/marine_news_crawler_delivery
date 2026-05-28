const sourcesEl = document.querySelector("#sources");
const logEl = document.querySelector("#log");
const startBtn = document.querySelector("#start");
const startLabelEl = document.querySelector("#start-label");
const startSpinnerEl = document.querySelector("#start-spinner");
const selectAllBtn = document.querySelector("#select-all");
const viewConfigDetailBtn = document.querySelector("#view-config-detail");
const sourceDetailModalEl = document.querySelector("#source-detail-modal");
const sourceDetailBackdropEl = document.querySelector("#source-detail-backdrop");
const closeConfigDetailBtn = document.querySelector("#close-config-detail");
const detailSearchEl = document.querySelector("#detail-search");
const detailTypeFilterEl = document.querySelector("#detail-type-filter");
const detailCountEl = document.querySelector("#detail-count");
const detailTableBodyEl = document.querySelector("#detail-table-body");

const fields = {
  statusLabel: document.querySelector("#status-label"),
  statusDot: document.querySelector("#status-dot"),
  currentSource: document.querySelector("#current-source"),
  currentSection: document.querySelector("#current-section"),
  progressRatio: document.querySelector("#progress-ratio"),
  progressPercent: document.querySelector("#progress-percent"),
  progressBar: document.querySelector("#progress-bar"),
  successCount: document.querySelector("#success-count"),
  failCount: document.querySelector("#fail-count"),
  fetchedCount: document.querySelector("#fetched-count"),
  skippedCount: document.querySelector("#skipped-count"),
  totalSources: document.querySelector("#total-sources"),
  insertedArticles: document.querySelector("#inserted-articles"),
  skippedArticles: document.querySelector("#skipped-articles"),
  jsonPath: document.querySelector("#json-path"),
  dbPath: document.querySelector("#db-path"),
};

const state = {
  sources: [],
  sourceDetails: [],
  detailExpanded: new Set(),
  expandedGroups: new Set(),
  sourceState: new Map(),
  eventSource: null,
  selectedTotal: 0,
  doneCount: 0,
};

function parseHostname(rawUrl) {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return String(rawUrl).trim() || "(unknown)";
  }
}

function groupSourcesBySite(list) {
  const groups = new Map();
  for (const src of list) {
    const host = parseHostname(src.url);
    if (!groups.has(host)) groups.set(host, []);
    groups.get(host).push(src);
  }
  for (const arr of groups.values()) arr.sort((a, b) => a.name.localeCompare(b.name));
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function formatSiteTitle(hostname) {
  return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const replacements = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return replacements[char];
  });
}

function typeBadge(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "rss") {
    return '<span class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">rss</span>';
  }
  return '<span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">html</span>';
}

function SourceItem(source, host) {
  return `
    <label class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-slate-100">
      <input
        type="checkbox"
        value="${escapeHtml(source.name)}"
        data-source-checkbox="true"
        data-source-host="${escapeHtml(host)}"
        data-skip-regular="${source.skip_in_regular_crawl ? "true" : "false"}"
        class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      <span class="truncate font-medium text-slate-800" title="${escapeHtml(source.name)}">${escapeHtml(source.name)}</span>
      ${
        source.skip_in_regular_crawl
          ? '<span class="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">不常更新</span>'
          : ""
      }
    </label>
  `;
}

function SourceGroup(host, items) {
  const title = formatSiteTitle(host);
  const expanded = state.expandedGroups.has(host);
  const skipCount = items.filter((item) => item.skip_in_regular_crawl).length;
  return `
    <section class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md">
      <div class="flex items-center gap-2">
        <input
          type="checkbox"
          data-group-checkbox="true"
          data-group-host="${escapeHtml(host)}"
          class="h-4 w-4 flex-shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span class="flex-1 truncate text-sm font-semibold text-slate-800" title="${escapeHtml(host)}">${escapeHtml(title)}</span>
        ${skipCount > 0 ? `<span class="flex-shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">${skipCount} 不常</span>` : ""}
        <span class="flex-shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-400">${items.length}</span>
        <button
          type="button"
          data-expand-btn="${escapeHtml(host)}"
          class="flex-shrink-0 rounded px-1 py-0.5 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          title="${expanded ? "收起" : "展开详情"}"
        >${expanded ? "▴" : "▾"}</button>
      </div>
      <div data-group-detail="${escapeHtml(host)}" class="${expanded ? "mt-2 space-y-0.5" : "hidden"}">
        ${items.map((item) => SourceItem(item, host)).join("")}
      </div>
    </section>
  `;
}

function sectionDetailRows(sourceName, sections) {
  if (!sections || !sections.length) {
    return `
      <tr class="bg-slate-50">
        <td colspan="7" class="px-3 py-3 text-xs text-slate-500">No sections</td>
      </tr>
    `;
  }
  return `
    <tr class="bg-slate-50">
      <td colspan="7" class="px-3 py-3">
        <div class="overflow-x-auto">
          <table class="min-w-full text-xs">
            <thead>
              <tr class="border-b border-slate-200 text-slate-500">
                <th class="px-2 py-1 text-left">name</th>
                <th class="px-2 py-1 text-left">title</th>
                <th class="px-2 py-1 text-left">mode</th>
                <th class="px-2 py-1 text-left">url</th>
                <th class="px-2 py-1 text-left">item_selector</th>
                <th class="px-2 py-1 text-left">link_selector</th>
                <th class="px-2 py-1 text-left">title_selector</th>
                <th class="px-2 py-1 text-left">date_selector</th>
                <th class="px-2 py-1 text-left">tags</th>
              </tr>
            </thead>
            <tbody>
              ${sections
                .map((section) => {
                  const tags = Array.isArray(section.tags)
                    ? section.tags.map((tag) => `${tag.type}:${tag.name}`).join(", ")
                    : "-";
                  return `
                    <tr class="border-b border-slate-100">
                      <td class="px-2 py-1">${escapeHtml(section.name || "-")}</td>
                      <td class="px-2 py-1">${escapeHtml(section.section_title || "-")}</td>
                      <td class="px-2 py-1">${escapeHtml(section.mode || "-")}</td>
                      <td class="px-2 py-1"><code class="font-mono">${escapeHtml(section.url || "-")}</code></td>
                      <td class="px-2 py-1"><code class="font-mono" title="${escapeHtml(section.item_selector || "-")}">${escapeHtml(section.item_selector || "-")}</code></td>
                      <td class="px-2 py-1"><code class="font-mono" title="${escapeHtml(section.link_selector || "-")}">${escapeHtml(section.link_selector || "-")}</code></td>
                      <td class="px-2 py-1"><code class="font-mono" title="${escapeHtml(section.title_selector || "-")}">${escapeHtml(section.title_selector || "-")}</code></td>
                      <td class="px-2 py-1"><code class="font-mono" title="${escapeHtml(section.date_selector || "-")}">${escapeHtml(section.date_selector || "-")}</code></td>
                      <td class="px-2 py-1">${escapeHtml(tags || "-")}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  `;
}

function SourceConfigTable() {
  const search = detailSearchEl.value.trim().toLowerCase();
  const typeFilter = detailTypeFilterEl.value.trim().toLowerCase();
  const filtered = state.sourceDetails.filter((source) => {
    const matchesName = !search || String(source.name || "").toLowerCase().includes(search);
    const matchesType = !typeFilter || String(source.type || "").toLowerCase() === typeFilter;
    return matchesName && matchesType;
  });
  detailCountEl.textContent = String(filtered.length);
  detailTableBodyEl.innerHTML = filtered
    .map((source) => {
      const key = source.name;
      const expanded = state.detailExpanded.has(key);
      const row = `
        <tr class="cursor-pointer border-b border-slate-100 hover:bg-slate-50" data-detail-row="${escapeHtml(key)}">
          <td class="px-2 py-2 font-medium">${escapeHtml(source.name || "-")}</td>
          <td class="px-2 py-2">${escapeHtml(source.domain || "-")}</td>
          <td class="px-2 py-2">${typeBadge(source.type || "-")}</td>
          <td class="px-2 py-2">${escapeHtml(source.strategy || "-")}</td>
          <td class="px-2 py-2 max-w-[280px] truncate" title="${escapeHtml(source.url || "-")}"><code class="font-mono text-xs">${escapeHtml(source.url || "-")}</code></td>
          <td class="px-2 py-2">${source.section_count ?? "-"}</td>
          <td class="px-2 py-2">${String(Boolean(source.skip_in_regular_crawl))}</td>
        </tr>
      `;
      return expanded ? `${row}${sectionDetailRows(key, source.sections)}` : row;
    })
    .join("");
}

function openSourceConfigModal() {
  sourceDetailModalEl.classList.remove("hidden");
  SourceConfigTable();
}

function closeSourceConfigModal() {
  sourceDetailModalEl.classList.add("hidden");
}

function StatusBar(status, doneCount, totalCount) {
  const map = {
    idle: { label: "Idle", dot: "bg-slate-400" },
    running: { label: "🟢 Running", dot: "bg-green-500" },
    success: { label: "🟢 Success", dot: "bg-green-500" },
    partial_success: { label: "🟡 Partial Success", dot: "bg-amber-500" },
    failed: { label: "🔴 Failed", dot: "bg-red-500" },
    starting: { label: "⚪ Starting", dot: "bg-slate-400" },
    disconnected: { label: "⚪ Disconnected", dot: "bg-slate-400" },
  };
  const data = map[status] || map.idle;
  const safeTotal = Math.max(totalCount, 0);
  const safeDone = Math.min(Math.max(doneCount, 0), safeTotal || 0);
  const ratio = safeTotal > 0 ? Math.round((safeDone / safeTotal) * 100) : 0;
  fields.statusLabel.textContent = data.label;
  fields.statusDot.className = `h-2.5 w-2.5 rounded-full ${data.dot}`;
  fields.progressRatio.textContent = `${safeDone} / ${safeTotal}`;
  if (fields.progressPercent) {
    fields.progressPercent.textContent = safeTotal > 0 ? `${ratio}%` : "—";
  }
  fields.progressBar.style.width = `${ratio}%`;
  fields.progressBar.setAttribute("aria-valuenow", String(safeDone));
  fields.progressBar.setAttribute("aria-valuemax", String(Math.max(safeTotal, 0)));
}

function renderSources() {
  if (!state.sources.length) {
    sourcesEl.textContent = "没有 enable source";
    return;
  }
  const grouped = groupSourcesBySite(state.sources);
  sourcesEl.innerHTML = grouped.map(([host, items]) => SourceGroup(host, items)).join("");
  updateGroupCheckboxStates();
}

function selectedSources() {
  return [...sourcesEl.querySelectorAll("input[data-source-checkbox='true']:checked")].map((input) => input.value);
}

function updateGroupCheckboxStates() {
  const groupCheckboxes = sourcesEl.querySelectorAll("input[data-group-checkbox='true']");
  groupCheckboxes.forEach((groupInput) => {
    const host = groupInput.dataset.groupHost;
    const sourceInputs = [...sourcesEl.querySelectorAll(`input[data-source-checkbox='true'][data-source-host='${host}']`)];
    const checkedCount = sourceInputs.filter((input) => input.checked).length;
    if (checkedCount === 0) {
      groupInput.checked = false;
      groupInput.indeterminate = false;
      return;
    }
    if (checkedCount === sourceInputs.length) {
      groupInput.checked = true;
      groupInput.indeterminate = false;
      return;
    }
    groupInput.checked = false;
    groupInput.indeterminate = true;
  });
}

function setRunningUI(isRunning) {
  startBtn.disabled = isRunning;
  startLabelEl.textContent = isRunning ? "正在爬取..." : "开始爬取";
  startSpinnerEl.classList.toggle("hidden", !isRunning);
}

function logPrefix(level, message) {
  if (level === "error") return `✗ ${message}`;
  if (level === "success") return `✓ ${message}`;
  if (level === "warning") return `• ${message}`;
  return `▶ ${message}`;
}

function LogPanel(message, level = "info") {
  const toneClass = {
    success: "text-green-300",
    error: "text-red-300",
    warning: "text-amber-300",
    info: "text-slate-300",
  }[level] || "text-slate-300";
  const line = document.createElement("div");
  line.className = `${toneClass} leading-6`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${logPrefix(level, message)}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

async function loadSources() {
  try {
    const response = await fetch("/api/sources");
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.detail || "Failed to load sources");
    state.sources = payload.sources || [];
    renderSources();
    LogPanel(`已加载 ${state.sources.length} 个 enable sources。`, "info");
  } catch (error) {
    sourcesEl.textContent = "加载数据源失败";
    LogPanel(error.message, "error");
  }
}

async function loadSourceDetails() {
  try {
    const response = await fetch("/api/sources/detail");
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.detail || "Failed to load source details");
    state.sourceDetails = Array.isArray(payload.sources) ? payload.sources : [];
    SourceConfigTable();
  } catch (error) {
    LogPanel(`配置详情加载失败: ${error.message}`, "error");
  }
}

function buildRequest() {
  const relativeDays = document.querySelector("#relative-days").value;
  const startDate = document.querySelector("#start-date").value;
  const endDate = document.querySelector("#end-date").value;
  const limit = document.querySelector("#limit").value;
  return {
    sources: selectedSources(),
    relative_days: relativeDays ? Number(relativeDays) : null,
    start_date: startDate || null,
    end_date: endDate || null,
    limit: limit ? Number(limit) : null,
    source_timeout_seconds: (() => {
      const el = document.querySelector("#source-timeout-seconds");
      const raw = el && el.value.trim();
      if (!raw) return 600;
      const n = Number(raw);
      return Number.isFinite(n) ? n : 600;
    })(),
    write_output_json: Boolean(document.querySelector("#write-output-json")?.checked),
  };
}

function connectEvents(jobId) {
  if (state.eventSource) state.eventSource.close();
  state.eventSource = new EventSource(`/api/crawl/events/${jobId}`);
  // Server sends default SSE frames (no "event:" line); the browser only delivers those as "message".
  state.eventSource.onmessage = (event) => {
    try {
      handleEvent(JSON.parse(event.data));
    } catch (err) {
      LogPanel(`SSE 解析失败: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };
  state.eventSource.onerror = () => {
    LogPanel("SSE 连接已关闭。", "warning");
    setRunningUI(false);
    StatusBar("disconnected", state.doneCount, state.selectedTotal);
    state.eventSource.close();
  };
}

function updateProgressCounters(event) {
  if (event.event_type === "source_success" && event.source_name && !state.sourceState.has(event.source_name)) {
    state.sourceState.set(event.source_name, "success");
    state.doneCount += 1;
  }
  if (event.event_type === "source_failed" && event.source_name && !state.sourceState.has(event.source_name)) {
    state.sourceState.set(event.source_name, "failed");
    state.doneCount += 1;
  }
  fields.successCount.textContent = [...state.sourceState.values()].filter((v) => v === "success").length;
  fields.failCount.textContent = [...state.sourceState.values()].filter((v) => v === "failed").length;
  fields.fetchedCount.textContent = event.fetched_count ?? fields.fetchedCount.textContent;
  fields.skippedCount.textContent = event.skipped_count ?? fields.skippedCount.textContent;
}

function renderSummary(summary) {
  fields.totalSources.textContent = summary.total_sources ?? "-";
  fields.insertedArticles.textContent = summary.inserted_articles ?? "-";
  fields.skippedArticles.textContent = summary.skipped_articles ?? "-";
  fields.jsonPath.textContent = summary.json_path ?? "-";
  fields.dbPath.textContent = summary.db_path ?? "-";
}

function handleEvent(event) {
  if (event.source_name) fields.currentSource.textContent = event.source_name;
  if (event.section_name) fields.currentSection.textContent = event.section_name;

  updateProgressCounters(event);
  // Keep status bar in sync after each source finishes (and during crawl).
  // Previously only job_start / events with event.status refreshed the bar, so
  // "已完成/总数" stayed at 0 until job_done.
  let uiStatus = event.status;
  if (event.event_type === "job_failed") {
    uiStatus = "failed";
  } else if (event.event_type === "job_done") {
    uiStatus = event.status || "success";
  } else if (!uiStatus) {
    uiStatus = "running";
  }
  StatusBar(uiStatus, state.doneCount, state.selectedTotal);

  if (event.event_type === "source_success") {
    LogPanel(`${event.source_name} success (${event.fetched_count ?? 0} articles)`, "success");
    return;
  }
  if (event.event_type === "source_failed") {
    const detail = event.error_message ? ` (${event.error_message})` : "";
    LogPanel(`${event.source_name} failed${detail}`, "error");
    return;
  }
  LogPanel(event.message || event.event_type, event.level || "info");

  if (event.event_type === "job_done") {
    renderSummary(event.summary || {});
    setRunningUI(false);
    if (state.eventSource) state.eventSource.close();
  }
  if (event.event_type === "job_failed") {
    setRunningUI(false);
    if (event.error_message) LogPanel(event.error_message, "error");
    if (state.eventSource) state.eventSource.close();
  }
}

function resetRun() {
  state.sourceState.clear();
  state.doneCount = 0;
  logEl.innerHTML = "";
  fields.currentSource.textContent = "-";
  fields.currentSection.textContent = "-";
  fields.successCount.textContent = "0";
  fields.failCount.textContent = "0";
  fields.fetchedCount.textContent = "0";
  fields.skippedCount.textContent = "0";
  fields.totalSources.textContent = "-";
  renderSummary({});
  StatusBar("idle", 0, state.selectedTotal);
}

async function startCrawl() {
  const body = buildRequest();
  state.selectedTotal = body.sources.length;
  if (!body.sources.length) {
    LogPanel("请至少选择一个 source。", "warning");
    return;
  }
  resetRun();
  setRunningUI(true);
  StatusBar("starting", 0, state.selectedTotal);
  LogPanel("提交爬取任务...", "info");
  try {
    const response = await fetch("/api/crawl/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.detail || "Failed to start crawl");
    LogPanel(`任务已启动：${payload.job_id}`, "info");
    connectEvents(payload.job_id);
  } catch (error) {
    setRunningUI(false);
    StatusBar("failed", 0, state.selectedTotal);
    LogPanel(error.message, "error");
  }
}

selectAllBtn.addEventListener("click", () => {
  const allInputs = [...sourcesEl.querySelectorAll("input[data-source-checkbox='true']")];
  const regularInputs = allInputs.filter((input) => input.dataset.skipRegular !== "true");
  const allRegularChecked =
    regularInputs.length > 0 && regularInputs.every((input) => input.checked);
  if (allRegularChecked) {
    regularInputs.forEach((input) => {
      input.checked = false;
    });
  } else {
    allInputs.forEach((input) => {
      input.checked = input.dataset.skipRegular !== "true";
    });
  }
  updateGroupCheckboxStates();
});
sourcesEl.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.dataset.groupCheckbox === "true") {
    const host = target.dataset.groupHost;
    const sourceInputs = sourcesEl.querySelectorAll(`input[data-source-checkbox='true'][data-source-host='${host}']`);
    sourceInputs.forEach((input) => {
      input.checked = target.checked;
    });
    target.indeterminate = false;
    return;
  }
  if (target.dataset.sourceCheckbox === "true") {
    updateGroupCheckboxStates();
  }
});
sourcesEl.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-expand-btn]");
  if (!btn) return;
  const host = btn.dataset.expandBtn;
  if (!host) return;
  const detail = sourcesEl.querySelector(`[data-group-detail="${host}"]`);
  if (!detail) return;
  if (state.expandedGroups.has(host)) {
    state.expandedGroups.delete(host);
    detail.className = "hidden";
    btn.textContent = "▾";
    btn.title = "展开详情";
  } else {
    state.expandedGroups.add(host);
    detail.className = "mt-2 space-y-0.5";
    btn.textContent = "▴";
    btn.title = "收起";
  }
});
viewConfigDetailBtn.addEventListener("click", openSourceConfigModal);
closeConfigDetailBtn.addEventListener("click", closeSourceConfigModal);
sourceDetailBackdropEl.addEventListener("click", closeSourceConfigModal);
detailSearchEl.addEventListener("input", SourceConfigTable);
detailTypeFilterEl.addEventListener("change", SourceConfigTable);
detailTableBodyEl.addEventListener("click", (event) => {
  const row = event.target.closest("[data-detail-row]");
  if (!row) return;
  const key = row.dataset.detailRow;
  if (!key) return;
  if (state.detailExpanded.has(key)) state.detailExpanded.delete(key);
  else state.detailExpanded.add(key);
  SourceConfigTable();
});
startBtn.addEventListener("click", startCrawl);
StatusBar("idle", 0, 0);
loadSources();
loadSourceDetails();
