# Ekran Guard

Yayın açarken ekranında yanlışlıkla görünen kredi kartı numarası, TC kimlik no,
telefon numarası veya IBAN gibi bilgileri otomatik olarak bulanıklaştıran bir
Chrome eklentisi.

## Nasıl çalışır

- Sayfa metnini tarar, kalıp eşleşen verileri bulanıklaştırır:
  - **Kredi kartı** — Luhn algoritmasıyla doğrulanır (sahte pozitif üretmez)
  - **TC kimlik no** — resmi checksum algoritmasıyla doğrulanır
  - **IBAN, telefon, e-posta**
  - **Ev adresi** — "... Mahallesi", "... Sokak/Cadde", "No:/Daire:/Kat:" gibi
    kalıpları yakalar. Tam adres ayrıştırması teknik olarak neredeyse imkansız
    olduğundan bu kalıp **bilinçli olarak geniş** yakalar; az kaçırmak, fazla
    yakalamaktan daha güvenlidir.
- Kart no / adres / telefon gibi otomatik doldurma (autofill) alanlarını
  odaklanmadığı sürece varsayılan olarak bulanık tutar.
- **Panik modu** (`Ctrl+Shift+B` veya popup'taki kırmızı buton): tüm sayfayı
  anında karartır, canlı yayında acil durumlar için.
- Bulanık bir metin alanına tıklayınca 2,5 saniyeliğine görünür, sonra otomatik
  tekrar bulanıklaşır.
- **Site bazlı whitelist**: popup'taki "Bu sitede kapat" düğmesiyle, kendi
  bankacılık sitesi gibi güvendiğin bir sitede korumayı devre dışı bırakabilirsin.
  Whitelist alt alan adlarını da kapsar (`example.com` eklersen `www.example.com`
  ve `giris.example.com` da whitelist'te sayılır). Panik modu whitelist'ten
  etkilenmez, her zaman çalışır.
- **Özel kalıplar**: popup'tan kendi ev adresin gibi otomatik kalıplara
  uymayan bir metni ekleyip her sitede otomatik bulanıklaştırılmasını
  sağlayabilirsin.

## Kurulum (geliştirici modu)

1. `chrome://extensions` adresine git.
2. Sağ üstten **Geliştirici modu**'nu aç.
3. **Paketlenmemiş öğe yükle**'ye tıkla, bu klasörü seç.
4. Eklenti simgesine tıklayıp korumanın açık olduğunu doğrula.

## Bilinen sınırlamalar

- Bu bir **tarayıcı sekmesi** eklentisidir: sadece Chrome içinde açık olan
  sayfaları korur. OBS, Zoom gibi harici yazılımlarla yapılan **masaüstü**
  paylaşımlarını (örn. bilgisayarındaki bir Excel dosyası, dosya gezgini)
  kapsamaz — bunun için ayrı bir masaüstü uygulaması gerekir.
- Bulanıklaştırma DOM (sayfa metni + form alanları) üzerinden çalışır; bir
  görselin/fotoğrafın *içine* gömülü hassas bilgiyi tespit edemez (bu, gerçek
  zamanlı görüntü işleme/OCR gerektirir ve performans maliyeti yüksektir).
- Kalıplar Türkiye'ye özel formatlara göre ayarlandı (TC kimlik, TR IBAN, 05XX
  telefon). Farklı ülke formatları için `content.js` içindeki `PATTERNS`
  dizisine yeni regex eklenebilir.

## Genişletme fikirleri

- Gerçek zamanlı ekran görüntüsü paylaşımı (getDisplayMedia ile "bu sekmeyi
  paylaş" seçildiğinde) için ayrı bir video-stream filtreleme katmanı.
- Chrome Web Store yayını için gizlilik politikası, store açıklaması ve
  ekran görüntüleri.

## Geliştirici notları

Regex ve doğrulama mantığının birim testleri için bkz. `CLAUDE.md` →
"Test etme" (`npm install && npm test`).
