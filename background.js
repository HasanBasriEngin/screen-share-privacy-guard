// Ekran Guard - background service worker
// Ctrl+Shift+B kısayolu ile aktif sekmede panik modunu açar/kapatır.

let panicActive = false;

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'panic-blur') return;
  panicActive = !panicActive;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'PANIC', value: panicActive }).catch(() => {});
  }
});

// Kurulumda varsayılan ayarı yaz
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['ekranGuardEnabled'], (res) => {
    if (res.ekranGuardEnabled === undefined) {
      chrome.storage.sync.set({ ekranGuardEnabled: true });
    }
  });
});
