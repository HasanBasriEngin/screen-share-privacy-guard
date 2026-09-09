// Ekran Guard - background service worker
// Ctrl+Shift+X kısayolu ile aktif sekmede panik modunu açar/kapatır.

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

// ---------- Zaten açık olan sekmelere elle enjekte et ----------
// manifest.json'daki content_scripts SADECE SAYFA YÜKLENİRKEN otomatik
// çalışır. Eklenti kurulduğunda, güncellendiğinde ya da devre dışı
// bırakılıp tekrar etkinleştirildiğinde, o anda zaten AÇIK olan sekmeler
// bunu kaçırıyor — kullanıcı korumanın çalışması için sayfayı elle
// yenilemek zorunda kalıyordu. Bu fonksiyon, service worker her
// başladığında (kurulum/güncelleme/yeniden etkinleştirme/tarayıcı açılışı)
// hâlâ açık olan tüm sekmelere içerik betiklerini elle enjekte ederek bu
// zorunluluğu ortadan kaldırır. content.js ve lib/share-hook.js kendi
// başlarına "zaten yüklendi mi" kontrolü yaptığı için (idempotency guard)
// aynı sekmeye tekrar enjekte etmek güvenlidir, listener'lar/observer'lar
// çoğalmaz.
async function injectIntoExistingTabs() {
  let tabs;
  try {
    tabs = await chrome.tabs.query({});
  } catch (e) {
    return;
  }
  for (const tab of tabs) {
    if (!tab.id || !tab.url || !/^https?:\/\//.test(tab.url)) continue;

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        world: 'MAIN',
        files: ['lib/share-hook.js']
      });
    } catch (e) {
      // Sayfa izin vermiyor (ör. Chrome Web Store) — sessizce atla.
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['lib/turkish-names.js', 'lib/patterns.js', 'content.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id, allFrames: true },
        files: ['content.css']
      });
    } catch (e) {
      // Sayfa izin vermiyor — sessizce atla.
    }
  }
}

injectIntoExistingTabs();
