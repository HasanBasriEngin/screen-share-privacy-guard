# Ekran Guard — Proje Bağlamı

Chrome eklentisi (Manifest V3). Yayıncılar ekran/sekme paylaşırken kart no,
TC kimlik, telefon, IBAN, e-posta ve ev adresi gibi hassas bilgilerin
ekranda görünmesini engelliyor.

## Mimari

- `manifest.json` — MV3 tanımı, `content_scripts` tüm sayfalara `document_start`'ta
  enjekte edilir (`lib/patterns.js` önce, `content.js` sonra yüklenir). `icons`
  ve `action.default_icon` altında 16/48/128px ikonlar tanımlı.
- `lib/patterns.js` — saf mantık (DOM'a, `chrome.*`'a bağımlı değil), hem
  content script'e `self.EkranGuardPatterns` global'i üzerinden hem de Jest
  testlerine `module.exports` ile aynı kod üzerinden hizmet eder (UMD kalıbı):
  - `getPatterns()`: regex + doğrulama fonksiyonu + etiket dizisini **taze**
    döndürür (paylaşılan `lastIndex` durumu sızmasın diye). Yeni bir veri türü
    eklemek için buraya bir obje eklemek yeterli.
  - `luhnValid` / `isValidCard` / `isValidTCKN`: doğrulama fonksiyonları.
  - `escapeRegex` / `buildCustomPatterns`: kullanıcı tanımlı düz metinleri
    (popup'tan eklenen) güvenli regex kalıplarına çevirir.
  - `normalizeDomain` / `isDomainWhitelisted`: site bazlı whitelist mantığı.
    `normalizeDomain` baştaki `www.` önekini atar ki `example.com` ve
    `www.example.com` aynı whitelist kaydına karşılık gelsin.
  - `INPUT_SELECTOR`: kart/adres/telefon autofill alanlarını hedefleyen CSS
    seçici string'i.
- `content.js` — DOM ile ilgilenen kısım, `EkranGuardPatterns`'ı kullanır:
  - `activePatterns()` — sabit `PATTERNS`'a, storage'dan gelen
    `customPatterns`'ı da ekler.
  - `walk()` — `TreeWalker` ile DOM'daki metin node'larını gezer, eşleşenleri
    `<span class="ekran-guard-blur">` içine alır.
  - `protectInputs()` — `INPUT_SELECTOR`'a uyan form alanlarını (kart/adres/
    telefon autofill alanları) odaklanmadıkça bulanık tutar.
  - `MutationObserver` — sonradan yüklenen içerikleri (SPA, chat widget'ları)
    de tarar.
  - Site whitelist'te ise (`isDomainWhitelisted`) hiç taramaz; `chrome.storage.
    onChanged` ile whitelist/özel kalıp/açma-kapama değişikliklerine sayfa
    yenilenmeden tepki verir.
  - Panik modu: `chrome.commands` (`Ctrl+Shift+B`) → `background.js` →
    `chrome.tabs.sendMessage` → `content.js` tüm sayfayı karartır. Panik modu
    whitelist'ten **etkilenmez** (bilinçli karar: acil durumda site whitelist'te
    olsa bile kullanıcı hâlâ panik tuşuyla ekranı karartabilmeli).
- `content.css` — blur efektleri, panik modu overlay'i.
- `background.js` — sadece komut (kısayol) yönlendirme ve ilk kurulum ayarı.
- `popup.html/css/js` — açma/kapama toggle'ı, panik butonu, "bu sitede kapat"
  whitelist toggle'ı ve özel kalıp ekleme/silme listesi. `lib/patterns.js`'i
  `window.EkranGuardPatterns` olarak kullanır (`normalizeDomain`,
  `isDomainWhitelisted`).
- `icons/` — `generate_icons.py` (Pillow) ile üretilen 16/48/128px PNG ikonlar;
  kaynak script depoda tutulmuyor, gerekirse yeniden üretilebilir (kırmızı
  kalkan + bulanık çizgiler motifi, marka renkleriyle: `#111318` zemin,
  `#ff3c3c` kalkan, `#f1f1f4` çizgiler).
- `lib/patterns.js` + `tests/patterns.test.js` — Jest ile birim testler
  (`npm install`, `npm test`). Regex'lerin ve doğrulama fonksiyonlarının
  gerçek metin üzerinde beklendiği gibi çalıştığını doğrular.

## Bilinçli tasarım kararları

- **Autofill'in native açılır penceresi bulanıklaştırılmıyor.** Chrome'un
  kayıtlı kart/adres önerisi kutusu sayfa DOM'unun dışında, tarayıcının kendi
  arayüz katmanında render edilir — hiçbir content script CSS/JS ile ona
  erişemez. Daha önce `autocomplete="off"` zorlayarak bu kutunun çıkmasını
  engelleyen bir katman vardı, kullanıcı isteğiyle **kaldırıldı** — sebep:
  bazı sitelerde form davranışını bozma riski ve kullanıcının bunu istememesi.
  Sadece input alanının kendisi (kutunun içindeki yazı) blur'lanıyor.
- Regex doğrulamaları (Luhn, TCKN checksum) bilinçli olarak sıkı — yanlış
  pozitifi azaltmak için. Adres kalıbı ise bilinçli olarak **geniş** — az
  kaçırmak, fazla yakalamaktan daha güvenli kabul edildi.
- OCR / video-frame analizi kullanılmıyor. Sebep: bu bir sekme/sayfa
  eklentisi, sadece DOM içeriğine erişebiliyor; OBS/masaüstü paylaşımı zaten
  kapsam dışı (bkz. Bilinen Sınırlamalar, README.md).

## Bilinen eksikler / olası sıradaki adımlar

- [x] Eklenti ikonları — `icons/icon{16,48,128}.png`, `manifest.json`'da
      `icons` ve `action.default_icon` altında tanımlı.
- [x] Site bazlı whitelist — `chrome.storage.sync.whitelistedDomains`,
      popup'ta "Bu sitede kapat" toggle'ı, `lib/patterns.js`'te
      `isDomainWhitelisted`.
- [x] Kullanıcı tanımlı özel kalıplar — `chrome.storage.sync.customPatterns`,
      popup'ta ekleme/silme listesi, `lib/patterns.js`'te
      `buildCustomPatterns`.
- [x] Otomatik test — `lib/patterns.js` + `tests/patterns.test.js` (Jest,
      `npm test`). Kart/TCKN/IBAN/telefon/e-posta/adres kalıpları, whitelist
      ve özel kalıp mantığı test ediliyor.
- [ ] Adres regex'i gerçek Türkçe adres varyasyonlarıyla (kısaltmalar, il/ilçe
      sırası vb.) daha kapsamlı test edilmeli — şu an sadece temel bir örnek
      test var.
- [ ] Chrome Web Store'a yayınlamak için: gizlilik politikası metni, store
      açıklaması, ekran görüntüleri hâlâ gerekiyor (ikonlar artık hazır).

## Test etme

1. `chrome://extensions` → Geliştirici modu aç → "Paketlenmemiş öğe yükle" →
   bu klasörü seç.
2. Kod değiştirdikten sonra `chrome://extensions` sayfasında eklentinin
   yenile (⟳) butonuna bas, sonra test ettiğin sekmeyi yenile (content
   script sadece sayfa yeniden yüklendiğinde güncellenir).
3. Hızlı test metni: `4532 0151 1283 0366` (kart), `05XX XXX XX XX` (tel),
   `Cumhuriyet Mahallesi Atatürk Caddesi No:15 Daire:4` (adres),
   `test@example.com` (e-posta).

### Birim testleri (regex/doğrulama mantığı)

```
npm install
npm test
```

`lib/patterns.js`'teki saf fonksiyonları test eder; tarayıcı/DOM gerekmez.
