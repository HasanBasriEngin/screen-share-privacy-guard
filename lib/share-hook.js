// Ekran Guard - paylaşım başlangıcı algılama kancası.
// Bu dosya manifest.json'da "world": "MAIN" ile, yani content script izole
// dünyasında DEĞİL, sayfanın KENDİ JS bağlamında çalışır. Sebep: izole dünyadan
// yapılan bir monkey-patch, sayfanın kendi kodunun (Meet/Zoom-web/Discord-web
// gibi) gördüğü navigator.mediaDevices.getDisplayMedia'yı etkilemez — Chrome'da
// izole ve ana dünya ayrı JS heap'lerine sahiptir. chrome.* API'lerine buradan
// erişilemez; content.js ile haberleşme window.dispatchEvent üzerinden olur
// (iki dünya aynı DOM/window nesnesini paylaşır).
//
// ÖNEMLİ SINIRLAMA: bu sadece paylaşımı BAŞLATAN sekmede/sayfada çalışır.
// OBS, Zoom masaüstü uygulaması gibi harici araçlarla yapılan paylaşımları
// göremez (bkz. CLAUDE.md / README.md bilinen sınırlamalar).

(function () {
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
    return;
  }
  // background.js zaten açık sekmelere bu dosyayı elle tekrar enjekte
  // edebilir (bkz. injectIntoExistingTabs) — aynı sekmede iki kez sarmalama
  // yapılırsa bir paylaşım "başladı" event'i iki kez tetiklenir.
  if (navigator.mediaDevices.__ekranGuardPatched) return;
  navigator.mediaDevices.__ekranGuardPatched = true;

  const original = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);

  navigator.mediaDevices.getDisplayMedia = function (...args) {
    return original(...args).then((stream) => {
      window.dispatchEvent(new CustomEvent('ekran-guard:share-start'));
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          window.dispatchEvent(new CustomEvent('ekran-guard:share-end'));
        });
      });
      return stream;
    });
  };
})();
