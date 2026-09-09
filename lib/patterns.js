// Ekran Guard - paylaşılan saf mantık (regex, doğrulama, whitelist, özel kalıp).
// Bu dosya hem content.js tarafından <script> olarak (tarayıcı, global obje
// üzerinden) hem de Jest testleri tarafından require() ile (Node, module.exports
// üzerinden) kullanılır. DOM'a dokunmaz, chrome.* API'lerine bağımlı değildir.

(function (root) {
  'use strict';

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
      { name: 'tckn', regex: /\b[1-9]\d{10}\b/g, validate: isValidTCKN, label: 'TC Kimlik' },
      { name: 'iban', regex: /\bTR\d{2}\s?(?:\d{4}\s?){5}\d{2}\b/g, validate: () => true, label: 'IBAN' },
      { name: 'tel', regex: /(?:\+90[\s.-]?|0)?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/g, validate: () => true, label: 'Telefon' },
      { name: 'email', regex: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, validate: () => true, label: 'E-posta' },
      // Adres: "... Mahallesi/Sokak/Cadde ..." gibi anahtar kelimelerin etrafındaki
      // metni yakalar; ardından gelen No/Daire/Kat/Blok bilgisini de dahil eder.
      // Tam adres ayrıştırması yapmaz (imkansıza yakın), bu yüzden bilinçli olarak
      // geniş yakalar — az kaçırmak, fazla yakalamaktan daha güvenlidir.
      {
        name: 'adres',
        regex: /\b[A-Za-zÇĞİÖŞÜçğıöşü0-9]+(\s+[A-Za-zÇĞİÖŞÜçğıöşü0-9]+){0,3}\s+(Mahallesi|Mah\.|Sokağı|Sokak|Sok\.|Caddesi|Cadde|Cad\.|Cd\.)(\s*,?\s*(No\s*:?\s*\d+[A-Za-z]?|Daire\s*:?\s*\d+|Kat\s*:?\s*\d+|Blok\s*:?\s*[\wÇĞİÖŞÜçğıöşü]+))*\b/gi,
        validate: () => true,
        label: 'Adres'
      }
    ];
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
    INPUT_SELECTOR,
    escapeRegex,
    buildCustomPatterns,
    normalizeDomain,
    isDomainWhitelisted
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.EkranGuardPatterns = api;
  }
})(typeof self !== 'undefined' ? self : this);
