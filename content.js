// YouTube ページ内で動画の視聴を検知し、情報を background へ送る

function isWatchPage() {
  return location.pathname === "/watch";
}

function sendHistory() {
  const videoId = new URLSearchParams(location.search).get("v");
  const title =
    document.querySelector("h1.ytd-video-primary-info-renderer")?.textContent?.trim() ||
    document.querySelector("h1.title")?.textContent?.trim() ||
    document.title.replace(" - YouTube", "");
  if (!videoId) return;
  chrome.runtime.sendMessage({
    type: "ADD_HISTORY",
    item: {
      id: videoId,
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumb: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      date: Date.now(),
    },
  });
}

// SPA ナビゲーションに対応
window.addEventListener("yt-navigate-finish", () => {
  if (isWatchPage()) setTimeout(sendHistory, 1500);
});
if (isWatchPage()) setTimeout(sendHistory, 1500);

// サイドパネルからの「チャンネル一覧取得」要求に応答する
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_CHANNELS") {
    const channels = new Map();
    document
      .querySelectorAll(
        'ytd-guide-section-renderer a[href^="/@"], ytd-guide-section-renderer a[href^="/channel/"]'
      )
      .forEach((a) => {
        const name =
          a.querySelector("yt-formatted-string")?.textContent?.trim() ||
          a.getAttribute("title")?.trim();
        if (!name) return;
        const href = a.getAttribute("href").split("?")[0];
        const url = new URL(href, location.origin).href;
        if (!channels.has(url)) channels.set(url, { name, url });
      });
    sendResponse({ channels: [...channels.values()] });
  }
});
