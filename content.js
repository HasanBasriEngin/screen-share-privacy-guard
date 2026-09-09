// Ekran Guard - içerik betiği
// Sayfadaki metinleri ve hassas form alanlarını tarar, eşleşmeleri bulanıklaştırır.
// Saf kalıp/doğrulama mantığı lib/patterns.js içinde (manifest.json'da bu
// dosyadan önce yüklenir), self.EkranGuardPatterns üzerinden erişilir.

(function () {
  'use strict';

  // background.js, eklenti kurulduğunda/güncellendiğinde/yeniden
  // etkinleştirildiğinde zaten açık olan sekmelere bu dosyayı elle tekrar
  // enjekte edebilir (bkz. injectIntoExistingTabs). Aynı sekmede iki kez
  // çalışırsa event listener'lar ve MutationObserver'lar çoğalır — bu yüzden
  // ikinci çalıştırmada hemen çık.
  if (self.__ekranGuardContentLoaded) return;
  self.__ekranGuardContentLoaded = true;

  const {
    getPatterns,
    findMatches,
    INPUT_SELECTOR,
    buildCustomPatterns,
    isDomainWhitelisted,
    isNameLabelText,
    looksLikeName
  } = self.EkranGuardPatterns;

  let enabled = true;
  let whitelisted = false;
  let customPatterns = [];
  let panicMode = false;
  // Kategori bazlı anahtarlar: ana "Koruma Aktif" anahtarının altında, hangi
  // kalıp türlerinin aktif olduğunu ayrıca kontrol eder.
  let nameBlurEnabled = true;
  let idAddressCardBlurEnabled = true;
  const ID_ADDRESS_CARD_LABELS = new Set(['TC Kimlik', 'Adres', 'Kart No']);
  const REVEAL_MS = 2500; // Tıklayınca/çift tıklayınca kaç ms açık kalsın

  function activePatterns() {
    let patterns = getPatterns();
    if (!nameBlurEnabled) patterns = patterns.filter((p) => p.label !== 'İsim');
    if (!idAddressCardBlurEnabled) patterns = patterns.filter((p) => !ID_ADDRESS_CARD_LABELS.has(p.label));
    return patterns.concat(buildCustomPatterns(customPatterns));
  }

  // ---------- Ayarları yükle ----------
  chrome.storage.sync.get(
    ['ekranGuardEnabled', 'whitelistedDomains', 'customPatterns', 'nameBlurEnabled', 'idAddressCardBlurEnabled'],
    (res) => {
      enabled = res.ekranGuardEnabled !== false; // varsayılan: açık
      whitelisted = isDomainWhitelisted(location.hostname, res.whitelistedDomains);
      customPatterns = res.customPatterns || [];
      nameBlurEnabled = res.nameBlurEnabled !== false;
      idAddressCardBlurEnabled = res.idAddressCardBlurEnabled !== false;
      if (enabled && !whitelisted) init();
    }
  );

  // Popup'tan ayar değiştiğinde (whitelist, özel kalıp, kategori, açma/kapama)
  // sayfayı yenilemeden tepki ver.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;

    // Not: TOGGLE mesajı sadece popup açıkken AKTİF olan sekmeye gönderiliyor
    // (chrome.tabs.sendMessage tek bir tab.id hedefler). Diğer açık
    // sekmeler/pencereler bu mesajı hiç almadığı için, koruma kapatıldığında
    // onlarda blur'lu görünmeye devam ediyordu. storage.onChanged HER
    // sekmede tetiklendiği için gerçek kaynak-of-truth burası olmalı.
    if (changes.ekranGuardEnabled) {
      enabled = changes.ekranGuardEnabled.newValue !== false;
      if (enabled && !whitelisted) init(); else removeAllBlurs();
    }

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

    if (changes.nameBlurEnabled) {
      nameBlurEnabled = changes.nameBlurEnabled.newValue !== false;
      if (enabled && !whitelisted) {
        removeAllBlurs();
        init();
      }
    }

    if (changes.idAddressCardBlurEnabled) {
      idAddressCardBlurEnabled = changes.idAddressCardBlurEnabled.newValue !== false;
      if (enabled && !whitelisted) {
        removeAllBlurs();
        init();
      }
    }

    if (changes.manualBlurs && enabled && !whitelisted) {
      document.querySelectorAll('.ekran-guard-manual-blur').forEach((el) => {
        el.classList.remove('ekran-guard-manual-blur');
      });
      loadManualBlurs();
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
    if (msg.type === 'START_MANUAL_PICKER') {
      startManualPicker();
    }
    if (msg.type === 'CLEAR_MANUAL_BLURS') {
      clearManualBlursForPage();
    }
  });

  // ---------- Paylaşım başlangıcını algılama ----------
  // lib/share-hook.js MAIN dünyasında (sayfanın kendi JS bağlamında) çalışıp
  // navigator.mediaDevices.getDisplayMedia'yı sarmalıyor; sayfa (Meet/Zoom-web/
  // Discord-web gibi) kendi ekran paylaşımını başlattığında window üzerinden
  // özel event'ler yayınlıyor. Bu sadece paylaşımı BAŞLATAN sekmede çalışır —
  // OBS gibi harici masaüstü paylaşımını göremez (bkz. CLAUDE.md sınırlamalar).
  window.addEventListener('ekran-guard:share-start', () => {
    if (whitelisted) {
      showShareBanner('⚠️ Ekran paylaşımı başladı ama bu site whitelist\'te — koruma yapılmıyor.', { persistent: true });
      return;
    }
    if (!enabled) {
      showShareBanner('⚠️ Ekran paylaşımı başladı ama koruma kapalı.', {
        persistent: true,
        actionLabel: 'Şimdi Aç',
        onAction: () => {
          enabled = true;
          chrome.storage.sync.set({ ekranGuardEnabled: true });
          init();
        }
      });
      return;
    }
    showShareBanner('🟢 Ekran paylaşımı algılandı — koruma aktif.');
  });
  window.addEventListener('ekran-guard:share-end', () => hideShareBanner());

  function showShareBanner(message, { persistent = false, actionLabel, onAction } = {}) {
    hideShareBanner();
    const banner = document.createElement('div');
    banner.id = 'ekran-guard-share-banner';
    const text = document.createElement('span');
    text.textContent = message;
    banner.appendChild(text);
    if (actionLabel && onAction) {
      const btn = document.createElement('button');
      btn.textContent = actionLabel;
      btn.addEventListener('click', () => {
        onAction();
        hideShareBanner();
      });
      banner.appendChild(btn);
    }
    document.documentElement.appendChild(banner);
    if (!persistent) setTimeout(hideShareBanner, 4000);
  }

  function hideShareBanner() {
    const el = document.getElementById('ekran-guard-share-banner');
    if (el) el.remove();
  }

  // ---------- Panik modu: tüm sayfayı anında kapat ----------
  function togglePanic(value) {
    panicMode = value;
    let overlay = document.getElementById('ekran-guard-panic-overlay');
    if (panicMode) {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'ekran-guard-panic-overlay';
        overlay.innerHTML = '<div class="ekran-guard-panic-msg">🔒 Gizlilik Modu Aktif<br><span>Tekrar açmak için Ctrl+Shift+X (veya popup)</span></div>';
        document.documentElement.appendChild(overlay);
      }
    } else if (overlay) {
      overlay.remove();
    }
  }

  // ---------- Metin tarayıcı (statik sayfa metni) ----------
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT']);

  function scanTextNode(node) {
    const text = node.nodeValue;
    if (!text || text.trim().length < 8) return;

    let matches = findMatches(text, activePatterns());
    if (matches.length === 0) return;

    matches.sort((a, b) => a.start - b.start);
    // Çakışan eşleşmeleri temizle
    matches = matches.filter((m, i) => i === 0 || m.start >= matches[i - 1].end);

    const parent = node.parentNode;
    const hasAddressMatch = matches.some((m) => m.label === 'Adres');
    const hasNameMatch = matches.some((m) => m.label === 'İsim');

    const frag = document.createDocumentFragment();
    let cursor = 0;
    for (const m of matches) {
      if (m.start > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, m.start)));
      const span = document.createElement('span');
      span.className = 'ekran-guard-blur';
      span.textContent = m.value;
      span.title = `${m.label} gizlendi — görmek için tıkla`;
      span.addEventListener('click', () => revealTemporarily(span));
      frag.appendChild(span);
      cursor = m.end;
    }
    if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
    parent.replaceChild(frag, node);

    // Adres/isim eşleşmesi bir satırın sadece bir kısmını yakalayabilir; aynı
    // "adres kartı" içindeki şehir/ilçe (anahtar kelimesiz) veya isim gibi
    // KARDEŞ satırlar ayrı metin node'larında/elemanlarında olduğundan
    // regex'e hiç girmeyebilir. Bunun için sadece en dar kapsayıcıyı değil,
    // genellikle "kart" seviyesine denk gelen İKİNCİ blok atasını da
    // bulanıklaştırıyoruz — tek satırlık bir <p>/<div> yerine, o satırı da
    // içeren daha geniş kart bulanıklaşır (bkz. "Bilinçli tasarım kararları").
    if (hasAddressMatch || hasNameMatch) {
      blurContainingBlock(parent);
    }
  }

  const BLOCK_TAGS = new Set([
    'DIV', 'P', 'LI', 'TD', 'TH', 'TR', 'TABLE', 'UL', 'OL',
    'ARTICLE', 'SECTION', 'FORM', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE'
  ]);

  function blurContainingBlock(startEl) {
    let el = startEl;
    let depth = 0;
    let firstBlock = null;
    while (el && el !== document.body && depth < 8) {
      if (BLOCK_TAGS.has(el.tagName)) {
        if (firstBlock) {
          el.classList.add('ekran-guard-block-blur');
          return;
        }
        firstBlock = el;
      }
      el = el.parentElement;
      depth++;
    }
    if (firstBlock) firstBlock.classList.add('ekran-guard-block-blur');
  }

  function revealTemporarily(el) {
    el.classList.add('ekran-guard-revealed');
    clearTimeout(el._eg_timer);
    el._eg_timer = setTimeout(() => el.classList.remove('ekran-guard-revealed'), REVEAL_MS);
  }

  function walk(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.parentNode) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(n.parentNode.tagName)) return NodeFilter.FILTER_REJECT;
        if (n.parentNode.classList && n.parentNode.classList.contains('ekran-guard-blur')) return NodeFilter.FILTER_REJECT;
        // contenteditable alanlar (chat kutuları, zengin metin editörleri) canlı
        // yazma sırasında span ile sarmalanırsa imleç konumu bozulur; bunlar
        // yerine watchLiveFields() tüm elemanı bulanıklaştırarak korur.
        if (n.parentNode.isContentEditable) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(scanTextNode);
  }

  // ---------- Etiket-değer isim eşleştirmesi (başlık ayrı bir elemanda) ----------
  // Bazı sitelerde "İsim"/"Name" gibi bir etiket ile asıl isim AYRI DOM
  // elemanlarındadır (örn. <dt>İsim</dt><dd>Hasan Yılmaz</dd>, bir tablo
  // hücresi + yanındaki hücre, ya da bir başlık satırı + hemen altındaki
  // değer satırı). scanTextNode/isim-baglam bunu YAKALAYAMAZ çünkü tek bir
  // metin node'u içinde çalışır. Bu yüzden ayrıca: küçük "yaprak" elemanları
  // (içinde başka blok eleman olmayan) tarayıp metni tam olarak bilinen bir
  // isim etiketine eşit olanları bulur, sonra İLİŞKİLİ elemandaki değerin
  // isme benzeyip benzemediğine bakar.
  const LABEL_CANDIDATE_SELECTOR = 'label, dt, span, strong, b, td, th, div, p, li';

  function findLabelValueElement(labelEl) {
    if ((labelEl.tagName === 'TD' || labelEl.tagName === 'TH') && labelEl.nextElementSibling) {
      return labelEl.nextElementSibling;
    }
    if (labelEl.tagName === 'DT' && labelEl.nextElementSibling && labelEl.nextElementSibling.tagName === 'DD') {
      return labelEl.nextElementSibling;
    }
    if (labelEl.nextElementSibling) return labelEl.nextElementSibling;
    const parent = labelEl.parentElement;
    if (parent && parent.nextElementSibling) return parent.nextElementSibling;
    return null;
  }

  function scanLabelValuePairs(root) {
    root.querySelectorAll(LABEL_CANDIDATE_SELECTOR).forEach((labelEl) => {
      if (labelEl.dataset.egLabelChecked) return;
      // Sadece "yaprak" elemanlar — içinde başka element varsa muhtemelen bir
      // kapsayıcıdır, tek başına bir etiket değildir.
      if (labelEl.children.length > 0) return;
      const text = labelEl.textContent;
      if (!text || text.length > 40) return;
      labelEl.dataset.egLabelChecked = '1';
      if (!isNameLabelText(text)) return;

      const valueEl = findLabelValueElement(labelEl);
      if (!valueEl || valueEl.dataset.egBlurredByLabel) return;
      if (!looksLikeName(valueEl.textContent)) return;

      valueEl.dataset.egBlurredByLabel = '1';
      valueEl.classList.add('ekran-guard-block-blur');
    });
  }

  // ---------- Form alanları: yazarken de bulanıklaştır ----------
  // İki kategori:
  //  1) "Bilinen hassas alan" (INPUT_SELECTOR: kart/telefon/adres/tckn autofill
  //     alanları) — odaklanma durumundan bağımsız, içi doluysa HER ZAMAN
  //     bulanık. Autofill ile dolduğunda da, elle yazarken de geçerli.
  //  2) Genel metin alanı (diğer input'lar, textarea, contenteditable) — anlık
  //     değeri PATTERNS'ten biriyle eşleşirse bulanıklaşır (örn. bir not
  //     kutusuna kart numarası yapıştırılması/yazılması).
  const GENERIC_TEXT_FIELD_SELECTOR = [
    'input[type="text"]',
    'input[type="search"]',
    'input[type="email"]',
    'input[type="url"]',
    'input:not([type])',
    'textarea',
    '[contenteditable=""]',
    '[contenteditable="true"]'
  ].join(', ');

  function getFieldValue(el) {
    if (el.isContentEditable) return el.innerText || el.textContent || '';
    return el.value || '';
  }

  function fieldElements(root) {
    const set = new Set();
    root.querySelectorAll(INPUT_SELECTOR).forEach((el) => set.add(el));
    root.querySelectorAll(GENERIC_TEXT_FIELD_SELECTOR).forEach((el) => set.add(el));
    if (root.matches && (root.matches(INPUT_SELECTOR) || root.matches(GENERIC_TEXT_FIELD_SELECTOR))) {
      set.add(root);
    }
    return set;
  }

  function updateFieldBlur(el) {
    if (!enabled || whitelisted) {
      el.classList.remove('ekran-guard-live-blur');
      return;
    }
    const text = getFieldValue(el);
    const isKnownSensitive = el.matches(INPUT_SELECTOR);
    const sensitive = isKnownSensitive
      ? text.trim().length > 0
      : findMatches(text, activePatterns()).length > 0;
    el.classList.toggle('ekran-guard-live-blur', sensitive);
  }

  function watchLiveFields(root) {
    fieldElements(root).forEach((el) => {
      if (!el.dataset.egFieldWatched) {
        el.dataset.egFieldWatched = '1';
        const handler = () => updateFieldBlur(el);
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
        el.addEventListener('dblclick', () => revealTemporarily(el));
      }
      updateFieldBlur(el);
    });
  }

  function removeAllBlurs() {
    document.querySelectorAll('.ekran-guard-blur').forEach((span) => {
      span.replaceWith(document.createTextNode(span.textContent));
    });
    document.querySelectorAll('.ekran-guard-live-blur, .ekran-guard-revealed').forEach((el) => {
      el.classList.remove('ekran-guard-live-blur', 'ekran-guard-revealed');
    });
    document.querySelectorAll('.ekran-guard-manual-blur').forEach((el) => {
      el.classList.remove('ekran-guard-manual-blur');
    });
    document.querySelectorAll('.ekran-guard-block-blur').forEach((el) => {
      el.classList.remove('ekran-guard-block-blur');
      delete el.dataset.egBlurredByLabel;
    });
    // Etiket-değer eşleştirmesinin "zaten kontrol edildi" işaretlerini de
    // temizle — yoksa kategori kapatılıp yeniden açıldığında (nameBlurEnabled
    // toggle) scanLabelValuePairs() aynı etiketleri bir daha değerlendirmez.
    document.querySelectorAll('[data-eg-label-checked]').forEach((el) => {
      delete el.dataset.egLabelChecked;
    });
  }

  // ---------- Manuel blur: kullanıcı bir öğeyi elle seçip kalıcı gizler ----------
  // Regex'in yakalayamadığı görseller/beklenmedik içerikler için "son çare"
  // koruması. Seçim, sayfanın DOM yapısına göre üretilen bir CSS yolu ile
  // chrome.storage.sync'te sayfa (hostname+pathname) bazlı saklanır — SPA'larda
  // veya çok dinamik sayfalarda yapı değişirse eşleşme bozulabilir, bu bilinen
  // bir sınırlamadır (bkz. CLAUDE.md).
  function pageKey() {
    return location.hostname + location.pathname;
  }

  function getElementPath(el) {
    const path = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body) {
      let selector = node.tagName.toLowerCase();
      if (node.id) {
        path.unshift(`${selector}#${node.id}`);
        break;
      }
      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (siblings.length > 1) {
          selector += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
      }
      path.unshift(selector);
      node = parent;
    }
    return path.join(' > ');
  }

  function applyManualBlur(el) {
    el.classList.add('ekran-guard-manual-blur');
  }

  function saveManualBlur(el) {
    const selector = getElementPath(el);
    if (!selector) return;
    chrome.storage.sync.get(['manualBlurs'], (res) => {
      const all = res.manualBlurs || {};
      const key = pageKey();
      const list = all[key] || [];
      if (!list.includes(selector)) list.push(selector);
      all[key] = list;
      chrome.storage.sync.set({ manualBlurs: all });
    });
  }

  function loadManualBlurs() {
    chrome.storage.sync.get(['manualBlurs'], (res) => {
      const all = res.manualBlurs || {};
      const list = all[pageKey()] || [];
      list.forEach((selector) => {
        try {
          document.body.querySelectorAll(selector).forEach(applyManualBlur);
        } catch (e) {
          // Sayfa yapısı değişmiş, geçersiz hale gelmiş bir seçici — sessizce atla.
        }
      });
    });
  }

  function clearManualBlursForPage() {
    document.querySelectorAll('.ekran-guard-manual-blur').forEach((el) => {
      el.classList.remove('ekran-guard-manual-blur');
    });
    chrome.storage.sync.get(['manualBlurs'], (res) => {
      const all = res.manualBlurs || {};
      delete all[pageKey()];
      chrome.storage.sync.set({ manualBlurs: all });
    });
  }

  function removeManualBlur(el) {
    el.classList.remove('ekran-guard-manual-blur');
    const selector = getElementPath(el);
    chrome.storage.sync.get(['manualBlurs'], (res) => {
      const all = res.manualBlurs || {};
      const key = pageKey();
      all[key] = (all[key] || []).filter((s) => s !== selector);
      chrome.storage.sync.set({ manualBlurs: all });
    });
  }

  // ---------- Manuel blur seçim modu (element picker) ----------
  let pickerActive = false;
  let pickerHoverEl = null;

  function showPickerBadge() {
    if (document.getElementById('ekran-guard-picker-badge')) return;
    const badge = document.createElement('div');
    badge.id = 'ekran-guard-picker-badge';
    badge.textContent = '🖱️ Blur modu: istediğin kadar öğeye tıkla, bitirince Esc';
    document.documentElement.appendChild(badge);
  }

  function hidePickerBadge() {
    const badge = document.getElementById('ekran-guard-picker-badge');
    if (badge) badge.remove();
  }

  function onPickerHover(e) {
    if (pickerHoverEl) pickerHoverEl.classList.remove('ekran-guard-picker-hover');
    pickerHoverEl = e.target;
    pickerHoverEl.classList.add('ekran-guard-picker-hover');
  }

  function onPickerClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    applyManualBlur(el);
    saveManualBlur(el);
    // Seçim modu açık kalır — birden fazla öğe art arda seçilebilir,
    // bitirmek için Esc'e basmak gerekir.
    el.classList.remove('ekran-guard-picker-hover');
    if (pickerHoverEl === el) pickerHoverEl = null;
  }

  function onPickerKeydown(e) {
    if (e.key === 'Escape') stopManualPicker();
  }

  function startManualPicker() {
    if (pickerActive) return;
    pickerActive = true;
    showPickerBadge();
    document.addEventListener('mouseover', onPickerHover, true);
    document.addEventListener('click', onPickerClick, true);
    document.addEventListener('keydown', onPickerKeydown, true);
  }

  function stopManualPicker() {
    pickerActive = false;
    hidePickerBadge();
    if (pickerHoverEl) {
      pickerHoverEl.classList.remove('ekran-guard-picker-hover');
      pickerHoverEl = null;
    }
    document.removeEventListener('mouseover', onPickerHover, true);
    document.removeEventListener('click', onPickerClick, true);
    document.removeEventListener('keydown', onPickerKeydown, true);
  }

  // Normal modda (seçim modu değilken) Alt+tıklama ile hızlı manuel blur
  // aç/kapa (toggle). Ctrl/Cmd+tık kasıtlı olarak KULLANILMIYOR — tarayıcının
  // "linki yeni sekmede aç" davranışıyla çakışır. Alt+tık ile art arda birden
  // fazla öğe seçilebilir, popup'ı hiç açmaya gerek kalmaz.
  document.addEventListener('click', (e) => {
    if (pickerActive || !e.altKey) return;
    const blurredAncestor = e.target.closest('.ekran-guard-manual-blur');
    e.preventDefault();
    e.stopPropagation();
    if (blurredAncestor) {
      removeManualBlur(blurredAncestor);
    } else {
      applyManualBlur(e.target);
      saveManualBlur(e.target);
    }
  }, true);

  // Alt+sağ tık: tek tek kaldırmak yerine bu sayfadaki TÜM manuel blur'ları
  // tek seferde temizler (popup'taki "Bu sayfadaki manuel blur'ları temizle"
  // butonuyla aynı işi yapar, sayfadan hiç çıkmadan).
  document.addEventListener('contextmenu', (e) => {
    if (!e.altKey) return;
    e.preventDefault();
    clearManualBlursForPage();
  }, true);

  // Not: scheduleScan HER ZAMAN document.body'nin tamamını tarar (belirli bir
  // "root" alt ağacı değil). Eskiden MutationObserver'daki her addedNode için
  // ayrı bir root ile scheduleScan çağrılıyordu; ama bir tarama zaten
  // bekliyorsa (`scanScheduled`) yeni gelen root'lar sessizce YOK
  // SAYILIYORDU — aynı anda/yakın zamanda eklenen birden fazla blok (örn. bir
  // sayfadaki "Teslimat Adresi" ve "Fatura Adresi" kartları) varsa sadece
  // ilki taranıp diğeri hiç görülmüyordu. Tüm body'yi taramak bu kaybı
  // ortadan kaldırır; debounce (idle callback) sayesinde maliyeti kabul
  // edilebilir düzeyde tutulur.
  let scanScheduled = false;
  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestIdleCallback ? requestIdleCallback(run, { timeout: 500 }) : setTimeout(run, 200);
    function run() {
      scanScheduled = false;
      if (!enabled || whitelisted) return;
      walk(document.body);
      watchLiveFields(document.body);
      if (nameBlurEnabled) scanLabelValuePairs(document.body);
    }
  }

  let observer = null;
  function init() {
    if (document.body) scheduleScan();
    if (!observer) {
      observer = new MutationObserver((mutations) => {
        if (!enabled || whitelisted) return;
        const changed = mutations.some((mut) => mut.addedNodes.length > 0 || mut.type === 'characterData');
        if (changed) scheduleScan();
      });
    }
    const start = () => {
      scheduleScan();
      loadManualBlurs();
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start);
  }
})();
