// Ekran Guard - paylaşılan saf mantık (regex, doğrulama, whitelist, özel kalıp).
// Bu dosya hem content.js tarafından <script> olarak (tarayıcı, global obje
// üzerinden) hem de Jest testleri tarafından require() ile (Node, module.exports
// üzerinden) kullanılır. DOM'a dokunmaz, chrome.* API'lerine bağımlı değildir.

(function (root) {
  'use strict';

  const COMMON_TURKISH_FIRST_NAMES = (typeof module !== 'undefined' && module.exports)
    ? require('./turkish-names')
    : (typeof self !== 'undefined' && self.EkranGuardTurkishNames) || [];

  // ---------- Doğrulama fonksiyonları ----------

  function luhnValid(digits) {
    let sum = 0, alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let n = parseInt(digits[i], 10);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    return sum % 10 === 0;
  }

  function isValidCard(match) {
    const digits = match.replace(/[^\d]/g, '');
    if (digits.length < 13 || digits.length > 19) return false;
    return luhnValid(digits);
  }

  function isValidTCKN(match) {
    const d = match.split('').map(Number);
    if (d.length !== 11 || d[0] === 0) return false;
    const sumOdd = d[0] + d[2] + d[4] + d[6] + d[8];
    const sumEven = d[1] + d[3] + d[5] + d[7];
    const digit10 = ((sumOdd * 7 - sumEven) % 10 + 10) % 10;
    if (digit10 !== d[9]) return false;
    const sumAll = d.slice(0, 10).reduce((a, b) => a + b, 0);
    return sumAll % 10 === d[10];
  }

  // ---------- Sabit kalıplar ----------
  // Not: her kalıp "validate" ile ikinci kez doğrulanır, böylece rastgele
  // 11 haneli bir sayı TC kimlik no sanılıp yanlış pozitif üretmez.
  // regex nesneleri paylaşılan/global durum taşımasın diye her çağrıda
  // getPatterns() ile TAZE üretilir (lastIndex sızıntısını önler).
  function getPatterns() {
    return [
      { name: 'kart', regex: /\b\d(?:[ -]?\d){12,18}\b/g, validate: isValidCard, label: 'Kart No' },
      // Kısmen maskelenmiş kart no (örn. "5235 29** **** 0744"): sitenin
      // kendisi çoğu haneyi zaten yıldızlamış olsa da, kalan gerçek haneler
      // (ilk/son 4 hane gibi) yine de hassastır. En az bir maskeleme karakteri
      // (*, • veya X) içeren 4x4'lük gruplaşmayı yakalar — Luhn kontrolü
      // yapılamaz (maskelenmiş) çünkü validate sadece maskeleme karakteri
      // varlığını arar.
      {
        name: 'kart-maskeli',
        regex: /\b[\dXx*•]{4}[\s-][\dXx*•]{4}[\s-][\dXx*•]{4}[\s-][\dXx*•]{4}\b/g,
        validate: (m) => /[Xx*•]/.test(m),
        label: 'Kart No'
      },
      { name: 'tckn', regex: /\b[1-9]\d{10}\b/g, validate: isValidTCKN, label: 'TC Kimlik' },
      // IBAN: "tr" küçük harfle veya boşluk/tire ile farklı gruplanmış
      // biçimlerde de gelebildiği için büyük/küçük harf duyarsız ve esnek
      // ayraçlı (boşluk veya tire) aranır.
      { name: 'iban', regex: /\bTR\d{2}[\s-]?(?:\d{4}[\s-]?){5}\d{2}\b/gi, validate: () => true, label: 'IBAN' },
      { name: 'tel', regex: /(?:\+90[\s.-]?|0)?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/g, validate: () => true, label: 'Telefon' },
      { name: 'email', regex: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, validate: () => true, label: 'E-posta' },
      // Adres: "... Mahallesi/Sokak/Cadde ..." gibi anahtar kelimelerin etrafındaki
      // metni yakalar. Anahtar kelimeden önceki bağlaç hem boşluk hem de "519.Sok"
      // gibi noktayla bitişik kısaltmaları kapsasın diye [\s.]+ kullanılır.
      // Anahtar kelimeden sonrası — apartman adı, No/Daire/Kat/Blok/Zil bilgisi —
      // gerçek adresler çok değişken sırada geldiği için serbest kelime dizisi
      // olarak (en fazla 8 token) yakalanır. Tam adres ayrıştırması yapmaz
      // (imkansıza yakın), bu yüzden bilinçli olarak geniş yakalar — az kaçırmak,
      // fazla yakalamaktan daha güvenlidir.
      {
        name: 'adres',
        regex: /\b[A-Za-zÇĞİÖŞÜçğıöşü0-9]+(\s+[A-Za-zÇĞİÖŞÜçğıöşü0-9]+){0,3}[\s.]+(Mahallesi|Mah\.|Mh\.|Mah\b|Sokağı|Sokak|Sok\.|Sok\b|Caddesi|Cadde|Cad\.|Cd\.|Cad\b|Bulvarı|Blv\.|Bulv\b)(\s+[A-Za-zÇĞİÖŞÜçğıöşü0-9./:]+){0,8}\b/gi,
        validate: () => true,
        label: 'Adres'
      },
      // Geliştirici sırları: bulut sağlayıcı anahtarları ve API token'ları.
      // Format kendi başına yeterince ayırt edici olduğu için (AKIA/AIza/gh*_/
      // sk-/xox*- gibi sabit önekler) ek bir checksum'a gerek yok.
      { name: 'aws-key', regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, validate: () => true, label: 'AWS Anahtarı' },
      { name: 'gcp-key', regex: /\bAIza[0-9A-Za-z_-]{35,}\b/g, validate: () => true, label: 'GCP API Anahtarı' },
      { name: 'azure-key', regex: /\bAccountKey=[A-Za-z0-9+/=]{40,}/g, validate: () => true, label: 'Azure Bağlantı Anahtarı' },
      { name: 'github-token', regex: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g, validate: () => true, label: 'GitHub Token' },
      { name: 'slack-token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,72}\b/g, validate: () => true, label: 'Slack Token' },
      // Anthropic ("sk-ant-...") daha spesifik olduğu için OpenAI kalıbından
      // önce denenir; OpenAI kalıbı da negatif lookahead ile "sk-ant-" ile
      // başlayanları zaten hariç tutar (çakışmayı önlemek için çift güvence).
      { name: 'anthropic-key', regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, validate: () => true, label: 'Anthropic Anahtarı' },
      { name: 'openai-key', regex: /\bsk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, validate: () => true, label: 'OpenAI Anahtarı' },
      { name: 'jwt', regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, validate: () => true, label: 'JWT' },
      // İsim tespiti — Faz A (bkz. CLAUDE.md): regex ile güvenilir genel isim
      // tespiti yapılamaz, bu yüzden iki düşük-maliyetli sezgisel kullanılır.
      ...buildNamePatterns()
    ];
  }

  // İsim tespiti Faz A — üç sezgisel:
  // (1) "Ad Soyad:", "Alıcı:", "Name:", "Recipient:" gibi Türkçe VE İngilizce
  //     etiketlerin hemen ardından gelen büyük harfli 2-3 kelimelik diziyi
  //     isim say (yüksek isabet, sadece isim kısmı bulanıklaşsın diye etiket
  //     lookbehind içinde tutulur);
  // (2) "Dr.", "Prof.", "Mr.", "Sayın" gibi unvan/hitap önekinden hemen sonra
  //     gelen ismi say (isimler genelde bu tür öneklerden sonra gelir);
  // (3) yaygın bir Türkçe ilk isimden hemen sonra gelen büyük harfli kelimeyi
  //     muhtemel soyadı say (daha geniş, bazı yanlış pozitifler kabul
  //     edilebilir — bkz. "Bilinçli tasarım kararları").
  const NAME_CONTEXT_LABELS = [
    // Türkçe
    'Ad\\s*Soyad', 'Adı\\s*Soyadı', 'İsim\\s*Soyisim', 'İsim', 'İsmi',
    'Alıcı\\s*Adı', 'Alıcı', 'Müşteri\\s*Adı', 'Müşteri', 'Gönderen\\s*Adı',
    'Gönderen', 'Teslim\\s*Alan', 'Teslim\\s*Alacak\\s*Kişi',
    'Sipariş\\s*Sahibi', 'Fatura\\s*Adı', 'Kart\\s*Üzerindeki\\s*İsim',
    'Kart\\s*Sahibi', 'Yetkili\\s*Adı', 'Yetkili', 'İlgili\\s*Kişi',
    'Kullanıcı\\s*Adı',
    // English
    'Full\\s*Name', 'First\\s*Name', 'Last\\s*Name', 'Your\\s*Name', 'Name',
    'Recipient\\s*Name', 'Recipient', 'Customer\\s*Name', 'Customer',
    'Sender\\s*Name', 'Sender', 'Billing\\s*Name', 'Cardholder\\s*Name',
    'Card\\s*Holder\\s*Name', 'Cardholder', 'Card\\s*Holder',
    'Account\\s*Holder', 'Account\\s*Name', 'Contact\\s*Name',
    'Contact\\s*Person', 'Shipped\\s*To', 'Sold\\s*To', 'Ordered\\s*By',
    'Buyer\\s*Name', 'Buyer', 'Attention', 'Attn', 'Ship\\s*To', 'Bill\\s*To',
    'Deliver(?:ed)?\\s*To', 'Consignee'
  ].join('|');

  const NAME_TITLES = [
    'Prof', 'Doç', 'Dr', 'Op', 'Uzm', 'Yrd', 'Av', 'Sayın', 'Mr', 'Mrs', 'Ms', 'Miss'
  ].join('|');

  function buildNamePatterns() {
    const patterns = [
      {
        name: 'isim-baglam',
        regex: new RegExp(
          `(?<=(?:^|[^A-Za-zÇĞİÖŞÜçğıöşü0-9])(?:${NAME_CONTEXT_LABELS})\\s*:?\\s*)` +
          `[A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+){1,2}`,
          'g'
        ),
        validate: () => true,
        label: 'İsim'
      },
      {
        name: 'isim-unvan',
        regex: new RegExp(
          `(?<=(?:^|[^A-Za-zÇĞİÖŞÜçğıöşü0-9])(?:(?:${NAME_TITLES})\\.?\\s+){1,3})` +
          `[A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+){0,2}`,
          'g'
        ),
        validate: () => true,
        label: 'İsim'
      }
    ];

    if (COMMON_TURKISH_FIRST_NAMES.length > 0) {
      const escapedNames = COMMON_TURKISH_FIRST_NAMES.map(escapeRegex).join('|');
      patterns.push({
        name: 'isim-liste',
        regex: new RegExp(
          `(?<![A-Za-zÇĞİÖŞÜçğıöşü0-9])(?:${escapedNames})\\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)?(?![A-Za-zÇĞİÖŞÜçğıöşü0-9])`,
          'g'
        ),
        validate: () => true,
        label: 'İsim'
      });
    }

    return patterns;
  }

  // ---------- Etiket-değer isim eşleştirmesi (DOM tabanlı, bkz. content.js) ----------
  // Bazı sitelerde etiket ("İsim", "Name" gibi) ve asıl değer AYRI DOM
  // elemanlarındadır (örn. <dt>İsim</dt><dd>Hasan Yılmaz</dd>, ya da bir
  // tablo hücresi + yanındaki hücre, ya da bir başlık + altındaki satır).
  // Yukarıdaki regex'ler tek bir metin node'u içinde çalıştığı için bu
  // durumu yakalayamaz; content.js bu iki saf yardımcıyı DOM gezinmesiyle
  // birlikte kullanarak etiketi bulup İLİŞKİLİ elemandaki değeri kontrol eder.
  const NAME_LABEL_TEXTS = new Set([
    // Türkçe
    'ad', 'soyad', 'ad soyad', 'ad-soyad', 'adı', 'soyadı', 'adı soyadı',
    'isim', 'ismi', 'isim soyisim', 'alıcı', 'alıcı adı', 'müşteri',
    'müşteri adı', 'gönderen', 'gönderen adı', 'teslim alan',
    'teslim alacak kişi', 'sipariş sahibi', 'fatura adı', 'kart sahibi',
    'kart üzerindeki isim', 'yetkili', 'yetkili adı', 'ilgili kişi',
    'kullanıcı adı', 'sayın',
    // English
    'name', 'full name', 'first name', 'last name', 'your name',
    'recipient', 'recipient name', 'customer', 'customer name', 'sender',
    'sender name', 'billing name', 'cardholder', 'cardholder name',
    'card holder', 'card holder name', 'account holder', 'account name',
    'contact name', 'contact person', 'shipped to', 'sold to', 'ordered by',
    'buyer', 'buyer name', 'attention', 'attn', 'ship to', 'bill to',
    'deliver to', 'delivered to', 'consignee'
  ]);

  function normalizeLabelText(text) {
    // Not: standart toLowerCase() Türkçe "İ" harfini yanlış küçültür ("i̇",
    // nokta birleşik karakteriyle) — toLocaleLowerCase('tr') doğru şekilde
    // "i" üretir. Bu olmadan "İsim" gibi çok yaygın bir etiket hiç tanınmaz.
    return (text || '').trim().toLocaleLowerCase('tr').replace(/[:：]\s*$/, '');
  }

  function isNameLabelText(text) {
    return NAME_LABEL_TEXTS.has(normalizeLabelText(text));
  }

  // Değerin gerçekten bir isme benzeyip benzemediğini kontrol eden, DOM'dan
  // bağımsız saf sezgisel: 2-4 kelime, her biri büyük harfle başlıyor.
  function looksLikeName(text) {
    const t = (text || '').trim();
    if (!t || t.length > 60) return false;
    const words = t.split(/\s+/);
    if (words.length < 2 || words.length > 4) return false;
    return words.every((w) => /^[A-ZÇĞİÖŞÜ][a-zçğıöşüA-ZÇĞİÖŞÜ.'-]*$/.test(w));
  }

  // Verilen metinde, verilen kalıp listesine göre doğrulanmış eşleşmeleri
  // konumlarıyla birlikte döndürür. content.js hem sayfa metnini taramak hem de
  // form alanlarının anlık değerinin hassas olup olmadığını kontrol etmek için
  // bu tek fonksiyonu kullanır.
  function findMatches(text, patterns) {
    const matches = [];
    for (const p of patterns) {
      p.regex.lastIndex = 0;
      let m;
      while ((m = p.regex.exec(text)) !== null) {
        if (p.validate(m[0])) {
          matches.push({ start: m.index, end: m.index + m[0].length, label: p.label, value: m[0] });
        }
        if (m[0].length === 0) p.regex.lastIndex++; // sıfır uzunluklu eşleşmede sonsuz döngüyü önle
      }
    }
    return matches;
  }

  const INPUT_SELECTOR = [
    'input[type="tel"]',
    'input[autocomplete*="cc-"]',
    'input[autocomplete*="street-address"]',
    'input[autocomplete*="postal-code"]',
    'input[autocomplete="tel"]',
    'input[autocomplete="tel-national"]',
    'input[name*="kart" i]', 'input[name*="card" i]',
    'input[name*="telefon" i]', 'input[name*="phone" i]',
    'input[name*="adres" i]', 'input[name*="address" i]',
    'input[name*="tckn" i]', 'input[name*="kimlik" i]',
    'input[id*="card" i]', 'input[id*="phone" i]', 'input[id*="address" i]'
  ].join(', ');

  // ---------- Kullanıcı tanımlı özel kalıplar ----------
  // Kullanıcının popup'tan eklediği düz metinleri (örn. kendi ev adresi) her
  // zaman bulanıklaştıracak regex kalıplarına çevirir. Regex özel karakterleri
  // kaçırılır; her satır ayrı bir kalıp olur.

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function buildCustomPatterns(customTexts) {
    return (customTexts || [])
      .map((t) => (typeof t === 'string' ? t.trim() : ''))
      .filter((t) => t.length > 0)
      .map((t) => ({
        name: 'custom',
        regex: new RegExp(escapeRegex(t), 'gi'),
        validate: () => true,
        label: 'Özel'
      }));
  }

  // ---------- Site bazlı whitelist ----------
  // "example.com" girildiğinde hem kendisi hem alt alan adları (www.example.com,
  // giris.example.com) eşleşir; ama "notexample.com" eşleşmez.

  function normalizeDomain(domain) {
    return (domain || '').trim().toLowerCase().replace(/^\*?\.*/, '').replace(/^www\./, '');
  }

  function isDomainWhitelisted(hostname, whitelistedDomains) {
    if (!hostname || !Array.isArray(whitelistedDomains) || whitelistedDomains.length === 0) {
      return false;
    }
    const host = hostname.trim().toLowerCase();
    return whitelistedDomains.some((raw) => {
      const domain = normalizeDomain(raw);
      if (!domain) return false;
      return host === domain || host.endsWith('.' + domain);
    });
  }

  // ---------- Dışa aktarım ----------
  const api = {
    luhnValid,
    isValidCard,
    isValidTCKN,
    getPatterns,
    findMatches,
    INPUT_SELECTOR,
    escapeRegex,
    buildCustomPatterns,
    normalizeDomain,
    isDomainWhitelisted,
    isNameLabelText,
    looksLikeName,
    normalizeLabelText
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.EkranGuardPatterns = api;
  }
})(typeof self !== 'undefined' ? self : this);
