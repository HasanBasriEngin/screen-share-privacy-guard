// Ekran Guard - içerik betiği
// Sayfadaki metinleri ve hassas form alanlarını tarar, eşleşmeleri bulanıklaştırır.
// Saf kalıp/doğrulama mantığı lib/patterns.js içinde (manifest.json'da bu
// dosyadan önce yüklenir), self.EkranGuardPatterns üzerinden erişilir.

(function () {
  'use strict';

  const {
    getPatterns,
    INPUT_SELECTOR,
    buildCustomPatterns,
    isDomainWhitelisted
  } = self.EkranGuardPatterns;

  let enabled = true;
  let whitelisted = false;
  let customPatterns = [];
  let panicMode = false;
  const REVEAL_MS = 2500; // Tıklayınca kaç ms açık kalsın

  function activePatterns() {
    return getPatterns().concat(buildCustomPatterns(customPatterns));
  }

  // ---------- Ayarları yükle ----------
  chrome.storage.sync.get(['ekranGuardEnabled', 'whitelistedDomains', 'customPatterns'], (res) => {
    enabled = res.ekranGuardEnabled !== false; // varsayılan: açık
    whitelisted = isDomainWhitelisted(location.hostname, res.whitelistedDomains);
    customPatterns = res.customPatterns || [];
    if (enabled && !whitelisted) init();
  });

  // Popup'tan ayar değiştiğinde (whitelist, özel kalıp, açma/kapama) sayfayı
  // yenilemeden tepki ver.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;

    if (changes.whitelistedDomains) {
      whitelisted = isDomainWhitelisted(location.hostname, changes.whitelistedDomains.newValue);
      if (whitelisted) {
        removeAllBlurs();
      } else if (enabled) {
        init();
      }
    }

    if (changes.customPatterns) {
      customPatterns = changes.customPatterns.newValue || [];
      if (enabled && !whitelisted) {
        removeAllBlurs();
        init();
      }
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'TOGGLE') {
      enabled = msg.enabled;
      if (enabled && !whitelisted) init(); else removeAllBlurs();
    }
    if (msg.type === 'PANIC') {
      togglePanic(msg.value);
    }
  });

  // ---------- Panik modu: tüm sayfayı anında kapat ----------
  function togglePanic(value) {
    panicMode = value;
    let overlay = document.getElementById('ekran-guard-panic-overlay');
    if (panicMode) {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'ekran-guard-panic-overlay';
        overlay.innerHTML = '<div class="ekran-guard-panic-msg">🔒 Ekran Guard: Gizlilik Modu Aktif<br><span>Tekrar açmak için Ctrl+Shift+B</span></div>';
        document.documentElement.appendChild(overlay);
      }
    } else if (overlay) {
      overlay.remove();
    }
  }

  // ---------- Metin tarayıcı ----------
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT']);

  function scanTextNode(node) {
    const text = node.nodeValue;
    if (!text || text.trim().length < 8) return;

    let matches = [];
    for (const p of activePatterns()) {
      p.regex.lastIndex = 0;
      let m;
      while ((m = p.regex.exec(text)) !== null) {
        if (p.validate(m[0])) {
          matches.push({ start: m.index, end: m.index + m[0].length, label: p.label, value: m[0] });
        }
        if (m[0].length === 0) p.regex.lastIndex++; // sıfır uzunluklu eşleşmede sonsuz döngüyü önle
      }
    }
    if (matches.length === 0) return;

    matches.sort((a, b) => a.start - b.start);
    // Çakışan eşleşmeleri temizle
    matches = matches.filter((m, i) => i === 0 || m.start >= matches[i - 1].end);

    const frag = document.createDocumentFragment();
    let cursor = 0;
    for (const m of matches) {
      if (m.start > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, m.start)));
      const span = document.createElement('span');
      span.className = 'ekran-guard-blur';
      span.textContent = m.value;
      span.title = `${m.label} gizlendi — görmek için tıkla`;
      span.addEventListener('click', revealTemporarily);
      frag.appendChild(span);
      cursor = m.end;
    }
    if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
    node.parentNode.replaceChild(frag, node);
  }

  function revealTemporarily(e) {
    const span = e.currentTarget;
    span.classList.add('ekran-guard-revealed');
    clearTimeout(span._eg_timer);
    span._eg_timer = setTimeout(() => span.classList.remove('ekran-guard-revealed'), REVEAL_MS);
  }

  function walk(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.parentNode) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(n.parentNode.tagName)) return NodeFilter.FILTER_REJECT;
        if (n.parentNode.classList && n.parentNode.classList.contains('ekran-guard-blur')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(scanTextNode);
  }

  function protectInputs(root) {
    root.querySelectorAll(INPUT_SELECTOR).forEach((el) => {
      if (el.dataset.egProtected) return;
      el.dataset.egProtected = '1';
      el.classList.add('ekran-guard-input-blur');
      el.addEventListener('focus', () => el.classList.add('ekran-guard-input-active'));
      el.addEventListener('blur', () => el.classList.remove('ekran-guard-input-active'));
    });
  }

  function removeAllBlurs() {
    document.querySelectorAll('.ekran-guard-blur').forEach((span) => {
      span.replaceWith(document.createTextNode(span.textContent));
    });
    document.querySelectorAll('.ekran-guard-input-blur').forEach((el) => {
      el.classList.remove('ekran-guard-input-blur', 'ekran-guard-input-active');
      delete el.dataset.egProtected;
    });
  }

  let scanScheduled = false;
  function scheduleScan(root) {
    if (scanScheduled) return;
    scanScheduled = true;
    requestIdleCallback ? requestIdleCallback(run, { timeout: 500 }) : setTimeout(run, 200);
    function run() {
      scanScheduled = false;
      if (!enabled || whitelisted) return;
      walk(root);
      protectInputs(root);
    }
  }

  let observer = null;
  function init() {
    if (document.body) scheduleScan(document.body);
    if (!observer) {
      observer = new MutationObserver((mutations) => {
        if (!enabled || whitelisted) return;
        for (const mut of mutations) {
          mut.addedNodes.forEach((node) => {
            if (node.nodeType === 1) scheduleScan(node);
            else if (node.nodeType === 3) scheduleScan(node.parentNode || document.body);
          });
        }
      });
    }
    const start = () => {
      scheduleScan(document.body);
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start);
  }
})();
