const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const statusEl = document.getElementById("status");
const sortBtn = document.getElementById("sort-btn");
const exportBtn = document.getElementById("export-btn");
const clearBtn = document.getElementById("clear-btn");
const filterInput = document.getElementById("filter");
const saveChannelsBtn = document.getElementById("save-channels-btn");

let history = [];
let sortDesc = true;
let filterText = "";

function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate()
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

function setStatus(text) {
  statusEl.textContent = text;
  if (text) setTimeout(() => {
    if (statusEl.textContent === text) statusEl.textContent = "";
  }, 3000);
}

function visibleItems() {
  const items = filterText
    ? history.filter((h) => h.title.toLowerCase().includes(filterText))
    : history.slice();
  items.sort((a, b) => (sortDesc ? b.date - a.date : a.date - b.date));
  return items;
}

function render() {
  const items = visibleItems();
  listEl.textContent = "";
  emptyEl.hidden = items.length > 0;
  for (const item of items) {
    const li = document.createElement("li");
    li.className = "item";
    li.draggable = true;
    li.dataset.id = item.id;

    const thumb = document.createElement("img");
    thumb.className = "thumb";
    thumb.src = item.thumb;
    thumb.alt = "";

    const meta = document.createElement("div");
    meta.className = "meta";

    const title = document.createElement("a");
    title.className = "title";
    title.href = item.url;
    title.textContent = item.title;
    title.target = "_blank";

    const date = document.createElement("span");
    date.className = "date";
    date.textContent = fmtDate(item.date);

    const row = document.createElement("div");
    row.className = "row-actions";
    const del = document.createElement("button");
    del.textContent = "削除";
    del.title = "この項目を削除";
    del.addEventListener("click", () => {
      history = history.filter((h) => h.id !== item.id);
      persist();
      render();
    });
    row.appendChild(del);

    meta.appendChild(title);
    meta.appendChild(date);
    meta.appendChild(row);
    li.appendChild(thumb);
    li.appendChild(meta);
    listEl.appendChild(li);
  }
}

function persist() {
  chrome.storage.local.set({ history });
}

function load() {
  chrome.storage.local.get({ history: [] }, ({ history: h }) => {
    history = h;
    render();
  });
}

// 並べ替え（新しい順 / 古い順）
sortBtn.addEventListener("click", () => {
  sortDesc = !sortDesc;
  sortBtn.textContent = sortDesc ? "↓新しい順" : "↑古い順";
  render();
});

// タイトルで絞り込み
filterInput.addEventListener("input", () => {
  filterText = filterInput.value.trim().toLowerCase();
  render();
});

// 書き出し（テキストファイル）
exportBtn.addEventListener("click", async () => {
  const items = visibleItems();
  const text =
    items.map((h) => `${fmtDate(h.date)}\t${h.title}\t${h.url}`).join("\n") + "\n";
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "youtube-history.txt";
  a.click();
  URL.revokeObjectURL(url);
  setStatus(`${items.length} 件を書き出しました`);
});

// 全消去
clearBtn.addEventListener("click", () => {
  if (!history.length || !confirm("すべての記録を削除します。よろしいですか？")) return;
  history = [];
  persist();
  render();
});

// チャンネル一覧保存：アクティブな YouTube タブの content script へ依頼
saveChannelsBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.startsWith("https://www.youtube.com/")) {
    setStatus("YouTube のタブを開いてから実行してください");
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: "GET_CHANNELS" }, (res) => {
    if (chrome.runtime.lastError || !res) {
      setStatus("チャンネル一覧を取得できませんでした（ページを再読み込みして再試行）");
      return;
    }
    chrome.runtime.sendMessage(
      { type: "SAVE_CHANNELS", channels: res.channels },
      (r) => {
        if (r && r.ok) setStatus(`チャンネルを ${r.count} 件保存しました`);
      }
    );
  });
});

// ドラッグ＆ドロップで手動並べ替え（フィルタ・ソント中は無効）
let dragId = null;
listEl.addEventListener("dragstart", (e) => {
  const li = e.target.closest("li.item");
  if (!li) return;
  dragId = li.dataset.id;
  li.classList.add("dragging");
});
listEl.addEventListener("dragend", (e) => {
  e.target.closest("li.item")?.classList.remove("dragging");
});
listEl.addEventListener("dragover", (e) => {
  e.preventDefault();
  const li = e.target.closest("li.item");
  listEl.querySelectorAll("li.item").forEach((el) => el.classList.remove("drag-over"));
  if (li && li.dataset.id !== dragId) li.classList.add("drag-over");
});
listEl.addEventListener("drop", (e) => {
  e.preventDefault();
  const target = e.target.closest("li.item");
  listEl.querySelectorAll("li.item").forEach((el) => el.classList.remove("drag-over"));
  if (!target || !dragId || target.dataset.id === dragId) return;
  const from = history.findIndex((h) => h.id === dragId);
  const to = history.findIndex((h) => h.id === target.dataset.id);
  if (from < 0 || to < 0) return;
  const [moved] = history.splice(from, 1);
  history.splice(to, 0, moved);
  sortDesc = null; // 手動並べ替えモード
  sortBtn.textContent = "↕手動順";
  persist();
  render();
});

// ストレージの変更を他ウィンドウ・タブと同期
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.history) {
    history = changes.history.newValue || [];
    render();
  }
});

load();
