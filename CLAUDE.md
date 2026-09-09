# Ekran Guard — Proje Bağlamı

Chrome eklentisi (Manifest V3). Yayıncılar ekran/sekme paylaşırken kart no,
TC kimlik, telefon, IBAN, e-posta, ev adresi, kişi isimleri ve geliştirici
sırları (API anahtarları/token'lar) gibi hassas bilgilerin ekranda
görünmesini engelliyor. Ayrıca regex'in yakalayamadığı içerikler için manuel
blur ve sayfanın kendi ekran paylaşımını başlattığı anı algılama özellikleri
var.

## Mimari

- `manifest.json` — MV3 tanımı. İki ayrı `content_scripts` girişi var:
  1. `lib/share-hook.js`, **`"world": "MAIN"`** ile sayfanın kendi JS
     bağlamında çalışır (paylaşım algılama için, bkz. aşağı).
  2. `lib/turkish-names.js` → `lib/patterns.js` → `content.js` sırasıyla,
     normal izole content-script dünyasında.
  `icons` ve `action.default_icon` altında 16/48/128px ikonlar tanımlı.
- `lib/turkish-names.js` — `COMMON_TURKISH_FIRST_NAMES`: yaygın ~200 Türkçe
  ilk isimden oluşan küçük, eklentiye gömülü bir liste (ağa istek yok).
  İsim tespiti Faz A'da kullanılır.
- `lib/patterns.js` — saf mantık (DOM'a, `chrome.*`'a bağımlı değil), hem
  content script'e `self.EkranGuardPatterns` global'i üzerinden hem de Jest
  testlerine `module.exports` ile aynı kod üzerinden hizmet eder (UMD kalıbı):
  - `getPatterns()`: regex + doğrulama fonksiyonu + etiket dizisini **taze**
    döndürür (paylaşılan `lastIndex` durumu sızmasın diye). Kapsadığı
    kategoriler: kart (Luhn), TC kimlik (checksum), IBAN, telefon, e-posta,
    adres, geliştirici sırları (AWS/GCP/Azure/GitHub/Slack/OpenAI/Anthropic/
    JWT) ve isim (Faz A, aşağıda detaylı).
  - `luhnValid` / `isValidCard` / `isValidTCKN`: doğrulama fonksiyonları.
  - `findMatches(text, patterns)`: verilen metinde doğrulanmış eşleşmeleri
    konumlarıyla döndürür — hem statik sayfa metni taramasında hem form
    alanlarının anlık değerini kontrol ederken kullanılan **tek** eşleştirme
    fonksiyonu (kopya mantık yok).
  - `escapeRegex` / `buildCustomPatterns`: kullanıcı tanımlı düz metinleri
    (popup'tan eklenen) güvenli regex kalıplarına çevirir.
  - `normalizeDomain` / `isDomainWhitelisted`: site bazlı whitelist mantığı.
    `normalizeDomain` baştaki `www.` önekini atar ki `example.com` ve
    `www.example.com` aynı whitelist kaydına karşılık gelsin.
  - `buildNamePatterns()`: isim tespiti Faz A (bağlam-çıpası + unvan + isim
    listesi, Türkçe VE İngilizce etiketlerle) — bkz. "Bilinçli tasarım
    kararları".
  - `isNameLabelText` / `looksLikeName` / `normalizeLabelText`: etiket ve
    değerin AYRI DOM elemanlarında olduğu durumlar için (content.js'teki
    `scanLabelValuePairs` tarafından kullanılır). `normalizeLabelText`
    `toLocaleLowerCase('tr')` kullanır — standart `toLowerCase()` Türkçe
    "İ"yi yanlış küçülttüğü için "İsim" gibi çok yaygın bir etiket
    tanınamazdı.
  - `INPUT_SELECTOR`: kart/adres/telefon/tckn gibi **bilinen hassas** form
    alanlarını (autofill/name/autocomplete ipuçlarıyla) hedefleyen CSS seçici
    string'i.
- `content.js` — DOM ile ilgilenen kısım, `EkranGuardPatterns`'ı kullanır:
  - `activePatterns()` — sabit `PATTERNS`'a, storage'dan gelen
    `customPatterns`'ı da ekler.
  - `walk()` — `TreeWalker` ile DOM'daki metin node'larını gezer, eşleşenleri
    `<span class="ekran-guard-blur">` içine alır. `contenteditable` alanların
    içini **sarmalamaz** (imleç konumu bozulmasın diye) — onlar
    `watchLiveFields()` ile bütün eleman bazında korunur.
  - `watchLiveFields()` — form alanlarını **yazarken de** korur, odaklanma
    durumundan bağımsız:
    - `INPUT_SELECTOR`'a uyan bilinen hassas alanlar: içi doluysa her zaman
      bulanık (autofill ile dolsun, elle yazılsın fark etmez).
    - Diğer input/textarea/`contenteditable` alanlar: anlık değeri
      `findMatches` ile hassas bir kalıba uyarsa bulanıklaşır.
    - Çift tıklayınca 2,5 saniyeliğine açılır (`revealTemporarily`).
  - `scanLabelValuePairs()` — **etiket ve değer AYRI DOM elemanlarında**
    olduğunda isim tespiti (örn. `<dt>İsim</dt><dd>Hasan Yılmaz</dd>`, bir
    tablo hücresi + yanındaki hücre, ya da bir başlık + hemen altındaki
    satır). "Yaprak" elemanları (`label, dt, span, strong, b, td, th, div, p,
    li`) tarar, metni `isNameLabelText` ile tanınan bir etikete tam eşit
    olanları bulur, `findLabelValueElement()` ile İLİŞKİLİ elemanı (sonraki
    kardeş, `dt`→`dd`, tablo hücresi komşusu, veya ebeveynin sonraki kardeşi)
    bulur, `looksLikeName` ile değeri kontrol eder ve eşleşirse o elemanı
    `ekran-guard-block-blur` ile bulanıklaştırır. `nameBlurEnabled` toggle'ına
    bağlıdır. `dataset.egLabelChecked` / `dataset.egBlurredByLabel` ile
    tekrar tekrar işlenmeyi önler; bu işaretler `removeAllBlurs()` içinde
    temizlenir (yoksa kategori kapatılıp açıldığında yeniden taranmaz).
  - **Manuel blur** (`startManualPicker` / `applyManualBlur` / ...): kullanıcı
    popup'tan "Öğe(ler) seç ve gizle"ye basınca `START_MANUAL_PICKER` mesajı
    gelir; `mouseover`/`click`/`keydown` (Esc) dinleyicileriyle bir "element
    picker" modu açılır (devtools'un öğe seçicisine benzer, kırmızı kesikli
    outline + üstte rozet). Mod **Esc'e basılana kadar açık kalır** — art
    arda birden fazla öğe seçilebilir, her tıklamada mod kapanmaz. Seçilen
    her öğeye `getElementPath()` ile bir CSS yolu üretilir,
    `chrome.storage.sync.manualBlurs[hostname+pathname]` altında kalıcı
    saklanır ve `init()` içinde `loadManualBlurs()` ile her sayfa
    yüklemesinde yeniden uygulanır. Popup, sayfaya tıklanır tıklanmaz
    kapanacağı için picker modu **popup kapansa da** `content.js` içinde
    bağımsız çalışmaya devam eder.
    Ayrıca popup'ı hiç açmadan **`Alt`+sol tık** ile herhangi bir öğe anında
    aç/kapa (toggle) edilebilir — art arda birden fazla öğeye uygulanabilir.
    **`Alt`+sağ tık** ise `contextmenu` event'ini yakalayıp (tarayıcı bağlam
    menüsünü bastırarak) `clearManualBlursForPage()`'i tetikler — sayfadaki
    TÜM manuel blur'ları tek seferde temizler. `Ctrl/Cmd+tık` **kasıtlı
    olarak kullanılmadı**: tarayıcının "linki yeni sekmede aç" davranışıyla
    çakışır, bu yüzden `Alt` modifier'ı seçildi.
  - **Paylaşım algılama banner'ı** — `lib/share-hook.js`'ten gelen
    `ekran-guard:share-start` / `-end` `window` event'lerini dinler, ekranın
    sağ üstünde durum banner'ı gösterir (aktifse yeşil/geçici, kapalıysa veya
    whitelist'teyse turuncu/kalıcı + "Şimdi Aç" butonu).
  - `MutationObserver` — sonradan yüklenen içerikleri (SPA, chat widget'ları)
    de tarar.
  - Site whitelist'te ise (`isDomainWhitelisted`) hiç taramaz; `chrome.storage.
    onChanged` ile whitelist/özel kalıp/manuel blur/açma-kapama/kategori
    değişikliklerine sayfa yenilenmeden tepki verir.
  - **Kategori anahtarları** (`nameBlurEnabled`, `idAddressCardBlurEnabled`):
    ana "Koruma Aktif" anahtarının altında, `activePatterns()` içinde
    `getPatterns()`'in döndürdüğü diziyi **etikete göre filtreler** — 'İsim'
    etiketli kalıplar `nameBlurEnabled`'a, 'TC Kimlik'/'Adres'/'Kart No'
    etiketli kalıplar `idAddressCardBlurEnabled`'a bağlı. Not: bu iki toggle
    sadece İÇERİK bazlı (sayfa metni + `INPUT_SELECTOR` dışındaki genel form
    alanları) tespiti etkiler; `INPUT_SELECTOR`'a uyan (kart/telefon/adres/
    tckn autofill ipuçlu) alanların içi doluysa her zaman blur kalır —
    kategoriden bağımsız, bilinçli bir güvenlik varsayılanı.
  - Panik modu: `chrome.commands` (`Ctrl+Shift+X`) → `background.js` →
    `chrome.tabs.sendMessage` → `content.js` tüm sayfayı karartır. Panik modu
    whitelist'ten **etkilenmez**.
- `lib/share-hook.js` — **MAIN dünyasında** çalışır (izole content-script
  dünyasında DEĞİL). `navigator.mediaDevices.getDisplayMedia`'yı sarmalar;
  sayfa (Meet/Zoom-web/Discord-web gibi) kendi ekran paylaşımını
  başlattığında `window.dispatchEvent` ile `content.js`'e haber verir. Sebep:
  izole dünyadan yapılan bir monkey-patch sayfanın kendi kodunun gördüğü
  API'yi etkilemez (ayrı JS heap). `chrome.*` API'lerine buradan erişilemez.
- `content.css` — blur efektleri, panik modu overlay'i, manuel blur/picker
  stilleri, paylaşım banner'ı.
- `background.js` — sadece komut (kısayol) yönlendirme ve ilk kurulum ayarı.
- `popup.html/css/js` — açma/kapama toggle'ı, panik butonu, **kategori bazlı
  toggle'lar** ("İsimleri Gizle", "Kimlik, Adres ve Kart Bilgilerini Gizle"),
  "bu sitede kapat" whitelist toggle'ı, özel kalıp ekleme/silme listesi,
  manuel blur seç/temizle butonları. `lib/patterns.js`'i
  `window.EkranGuardPatterns` olarak kullanır.
- `icons/` — `generate_icons.py` (Pillow) ile üretilen 16/48/128px PNG ikonlar;
  kaynak script depoda tutulmuyor, gerekirse yeniden üretilebilir (kırmızı
  kalkan + bulanık çizgiler motifi, marka renkleriyle: `#111318` zemin,
  `#ff3c3c` kalkan, `#f1f1f4` çizgiler).
- `lib/patterns.js` + `tests/patterns.test.js` — Jest ile birim testler
  (`npm install`, `npm test`, şu an 42 test). Regex'lerin ve doğrulama
  fonksiyonlarının gerçek metin üzerinde beklendiği gibi çalıştığını
  doğrular.

## Bilinçli tasarım kararları

- **Autofill'in native açılır penceresi bulanıklaştırılmıyor.** Chrome'un
  kayıtlı kart/adres önerisi kutusu sayfa DOM'unun dışında, tarayıcının kendi
  arayüz katmanında render edilir — hiçbir content script CSS/JS ile ona
  erişemez. Sadece input alanının kendisi (kutunun içindeki yazı) blur'lanıyor.
- Regex doğrulamaları (Luhn, TCKN checksum) bilinçli olarak sıkı — yanlış
  pozitifi azaltmak için. Adres kalıbı ise bilinçli olarak **geniş** — az
  kaçırmak, fazla yakalamaktan daha güvenli kabul edildi. Anahtar kelimeden
  (Mahalle/Sokak/Cadde/Bulvar, kısaltmalı/kısaltmasız, noktayla bitişik
  "519.Sok" gibi biçimler dahil) sonraki en fazla 8 kelimelik serbest metin
  de (apartman adı, No/Daire/Kat/Blok/Zil bilgisi) eşleşmeye dahil edilir.
- Form alanlarında **yazarken de** koruma var (`watchLiveFields`) — eskiden
  bilinen hassas alanlar sadece odaklanılmadığında bulanıktı, odaklanınca
  (yani tam da yazarken) açılıyordu; bu, ekran paylaşımı sırasında yazarken
  bilgiyi ifşa ediyordu. Artık odaklanma durumundan bağımsız, içerik temelli.
- **Geliştirici sırları** (AWS/GCP/Azure/GitHub/Slack/OpenAI/Anthropic/JWT)
  checksum yerine sabit önek/format ayırt ediciliğine güvenir (`AKIA`,
  `AIza`, `gh[pousr]_`, `sk-`, `xox[baprs]-`, `eyJ...`) — bu, gitleaks/
  trufflehog gibi araçların da kullandığı standart yaklaşım.
- **İsim tespiti — iki fazlı, kabul edilmiş sınırlamalarla (Faz A).** Regex
  ile genel isim tespiti güvenilir yapılamaz (ciddi hiçbir PII-tespit aracı
  bunu salt regex'le çözmüyor, hepsi NER modeli kullanıyor). Bilinçli olarak
  düşük maliyetli bir ilk adım seçildi:
  - *Bağlam-çıpası* (`isim-baglam`, yüksek isabet): "Ad Soyad:", "Alıcı:",
    "Müşteri:" gibi Türkçe etiketlerin **hemen ardından** gelen 2-3 kelimelik
    büyük-harfle-başlayan diziyi isim sayar. Sadece isim kısmı bulansın diye
    etiketin kendisi bir **lookbehind** içinde tutulur (`m[0]` sadece ismi
    içerir, etiketi değil).
  - *Yaygın isim listesi* (`isim-liste`, daha geniş/riskli): `lib/turkish-
    names.js`'teki ~200 yaygın Türkçe ilk isimden hemen sonra gelen 1-2 büyük
    harfli kelimeyi muhtemel soyadı sayar. **Bilinen yan etki:** "Hasan Bey"
    gibi isim-olmayan bir ikinci kelime de yanlışlıkla eşleşebilir — kabul
    edilebilir kabul edildi (adres kalıbıyla aynı "az kaçırmak > fazla
    yakalamak" felsefesi).
  - Regex boundary (`\b`) yerine özel `(?<![A-Za-zÇĞİÖŞÜçğıöşü0-9])` /
    `(?![A-Za-zÇĞİÖŞÜçğıöşü0-9])` lookaround'ları kullanılıyor — JS'te `\b`,
    `\w`'yi ASCII `[A-Za-z0-9_]` ile tanımladığından "İbrahim", "Çınar" gibi
    Türkçe harfle başlayan isimlerin önünde **yanlışlıkla eşleşmeyebilir**
    (non-word→non-word geçişi \b'yi tetiklemez). Bu proje için özel olarak
    doğru çözülmüş bir detay; adres/diğer kalıplarda henüz retrofit edilmedi.
  - **Faz B (yapılmadı, gelecek iş):** `transformers.js` ile küçük bir ONNX
    NER modelini tarayıcıda çalıştırmak. Maliyet: eklenti boyutu 10-65 MB
    büyür, her yazışta modeli çalıştırmak ağır (debounce şart), MV3'te WASM
    için offscreen document gibi ek altyapı gerekir — ayrı, kapsamı net bir
    iş olarak ele alınmalı.
- **Manuel blur, CSS seçici yoluyla "best effort" kalıcılık kullanır**
  (`getElementPath`). Elementin id'si varsa onu, yoksa tag+`:nth-of-type`
  zincirini `document.body`'ye kadar üretir. Bu, statik/az-değişen sayfalarda
  iyi çalışır ama çok dinamik SPA'larda (React'in her render'da farklı DOM
  yapısı üretmesi gibi) yapı değişirse eşleşme bozulabilir — bilinen bir
  sınırlama, tam bir fingerprint/XPath çözümü değil.
- **Paylaşım algılama sadece paylaşımı BAŞLATAN sekmede çalışır**
  (`getDisplayMedia` hook'u `lib/share-hook.js`, MAIN dünyasında). OBS, Zoom
  masaüstü uygulaması gibi harici araçlarla yapılan paylaşımları göremez —
  mevcut mimari sınırlama (bkz. Bilinen Sınırlamalar, README.md) devam
  ediyor, bu özellik onu ortadan kaldırmıyor, sadece web-tabanlı paylaşım
  başlatma anını (Meet/Discord-web gibi) yakalıyor.
- OCR / video-frame analizi kullanılmıyor. Sebep: bu bir sekme/sayfa
  eklentisi, sadece DOM içeriğine erişebiliyor; OBS/masaüstü paylaşımı zaten
  kapsam dışı.

## Bilerek almadığımız özellikler (rakiplerde var, burada yok)

- **Scramble modu** (gerçekçi sahte veriyle değiştirme) — blur zaten yeterli,
  ek karmaşıklık gerektirmiyor.
- **Fiyat/para birimi maskeleme** — bu projenin kullanım senaryosuyla alakasız.
- **ML/AI tabanlı görsel tespit** — mevcut regex+DOM yaklaşımı yeterince
  güvenilir ve şeffaf; ML modeli hem performans hem "neden bunu yakaladı/
  yakalamadı" açısından belirsizlik katar (bkz. isim tespiti Faz B notu).

## Bilinen eksikler / olası sıradaki adımlar

- [x] Eklenti ikonları, site bazlı whitelist, özel kalıplar, Jest testleri,
      yazarken canlı blur, genişletilmiş adres kalıbı — hepsi tamam (yukarıya
      bakınız).
- [x] **Manuel blur** — element picker + `chrome.storage.sync.manualBlurs`
      ile sayfa bazlı kalıcılık.
- [x] **Geliştirici sırları** — AWS/GCP/Azure/GitHub/Slack/OpenAI/Anthropic/
      JWT kalıpları `lib/patterns.js`'te.
- [x] **İsim tespiti Faz A** — bağlam-çıpası (Türkçe+İngilizce etiketler) +
      unvan/hitap öneki (Dr./Prof./Mr./Sayın vb.) + yaygın isim listesi +
      etiket ile değerin ayrı DOM elemanlarında olduğu durumlar
      (`scanLabelValuePairs`).
- [x] **IBAN/kart iyileştirmesi** — IBAN artık büyük/küçük harf duyarsız ve
      tire/boşluk ayraçlı biçimleri de yakalıyor; kısmen yıldızla
      maskelenmiş kart numaraları (`5235 29** **** 0744` gibi) da
      bulanıklaşıyor.
- [x] **Panik kısayolu düzeltmesi** — `Ctrl+Shift+B` Chrome/Brave'in yer
      imleri çubuğu kısayoluyla çakıştığı için `Ctrl+Shift+X`'e taşındı.
- [x] **Çoklu sekme tutarlılığı** — `ekranGuardEnabled` artık
      `chrome.storage.onChanged` ile her sekmede ayrı ayrı dinleniyor;
      eskiden sadece popup açıkken aktif olan sekme haberdar oluyordu.
- [x] **Paylaşım başlangıcını algılama** — `lib/share-hook.js` (MAIN world)
      + `content.js`'te durum banner'ı.
- [ ] İsim tespiti Faz B (NER modeli) — kapsamlı, ayrı bir iş; şu an
      planlanmıyor (bkz. yukarıdaki maliyet notu).
- [ ] Yaygın isim listesi küçük (~200) — genişletilebilir ama listeye
      eklenen her isim yanlış-pozitif riskini de büyütür, dengeli tutulmalı.
- [ ] Manuel blur seçici üretimi (`getElementPath`) çok dinamik SPA'larda
      kırılgan olabilir — daha sağlam bir fingerbrint yöntemi (örn. yakın
      metin içeriğine göre eşleştirme) değerlendirilebilir.
- [ ] Adres kalıbı hâlâ tam kapsamlı değil: anahtar kelime (Mahalle/Sokak/
      Cadde) olmadan yazılmış çıplak yer adları yakalanamıyor — kullanıcı
      özel kalıp ekleyebilir.
- [ ] Chrome Web Store'a yayınlamak için: gizlilik politikası metni, store
      açıklaması, ekran görüntüleri hâlâ gerekiyor (ikonlar artık hazır).

## Test etme

1. `chrome://extensions` (veya Brave'de `brave://extensions`) → Geliştirici
   modu aç → "Paketlenmemiş öğe yükle" → bu klasörü seç.
2. Kod değiştirdikten sonra eklentinin yenile (⟳) butonuna bas, sonra test
   ettiğin sekmeyi yenile (content script sadece sayfa yeniden
   yüklendiğinde güncellenir).
3. Hızlı test metni: `4532 0151 1283 0366` (kart), `05XX XXX XX XX` (tel),
   `Cumhuriyet Mahallesi Atatürk Caddesi No:15 Daire:4` (adres),
   `test@example.com` (e-posta), `Ad Soyad: Ahmet Yılmaz` (isim, bağlam),
   `AKIAABCDEFGHIJKLMNOP` (AWS anahtarı, örnek/sahte).
4. **Manuel blur**: popup'tan "Öğe(ler) seç ve gizle" → sayfada istediğin
   kadar öğeye art arda tıkla (Esc ile bitir) → hepsi bulanıklaşmalı ve sayfa
   yenilenince kalıcı kalmalı. Popup'ı hiç açmadan `Alt+tık` ile de anında
   aç/kapa (toggle) yapılabilir.
5. **Paylaşım algılama**: `getDisplayMedia` destekleyen bir sayfada (örn.
   `https://meet.google.com` gibi bir web toplantı sitesinde ya da basit bir
   test sayfasında `navigator.mediaDevices.getDisplayMedia()` çağrısı
   tetikleyip) paylaşım başlatınca sağ üstte durum banner'ı görünmeli.

### Birim testleri (regex/doğrulama mantığı)

```
npm install
npm test
```

`lib/patterns.js`'teki saf fonksiyonları test eder (42 test); tarayıcı/DOM
gerekmez.
