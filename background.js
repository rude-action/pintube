// 拡張機能のアイコンクリックでサイドパネルを開く
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// content.js からの視聴履歴の記録（重複時は先頭に移動）
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "ADD_HISTORY" && msg.item) {
    chrome.storage.local.get({ history: [] }, ({ history }) => {
      const rest = history.filter((h) => h.id !== msg.item.id);
      chrome.storage.local.set({ history: [msg.item, ...rest] }, () => {
        sendResponse({ ok: true });
      });
    });
    return true; // 非同期で sendResponse する
  }

  if (msg.type === "SAVE_CHANNELS" && Array.isArray(msg.channels)) {
    chrome.storage.local.set({ channels: msg.channels, channelsSavedAt: Date.now() }, () => {
      sendResponse({ ok: true, count: msg.channels.length });
    });
    return true;
  }
});
