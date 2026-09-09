# Chrome Web Store — Mağaza Listesi Metinleri

Bu dosya, Chrome Web Store Developer Dashboard'a girerken kopyala-yapıştır
yapılacak metinleri içerir. Yayınlandıktan sonra güncel tutulmasına gerek
yok — bu sadece bir hazırlık referansıdır.

## Gizlilik Politikası URL'i

```
https://hasanbasri.me/screen-share-privacy-guard/privacy-policy.html
```

## Kategori

**Productivity** (alternatif: **Tools**)

## Kısa Açıklama (132 karakter sınırı)

```
Ekran paylaşımı sırasında kart, TC kimlik, adres, isim ve API anahtarlarını otomatik bulanıklaştırır.
```

## Detaylı Açıklama

```
Privacy Shield, ekran/sekme paylaşırken veya canlı yayın yaparken
ekranınızda yanlışlıkla görünen hassas bilgileri otomatik olarak
bulanıklaştıran bir tarayıcı eklentisidir.

NELERI TESPIT EDER
• Kredi kartı numaraları (Luhn algoritmasıyla doğrulanır)
• TC Kimlik No (resmi checksum ile doğrulanır)
• IBAN, telefon numarası, e-posta adresi
• Ev/iş adresleri
• Kişi isimleri (etiket bazlı ve bağlam bazlı tespit)
• Geliştirici sırları: AWS/GCP/Azure anahtarları, GitHub/Slack token'ları,
  OpenAI/Anthropic API anahtarları, JWT'ler

NASIL ÇALIŞIR
• Sayfa metnini ve form alanlarını TAMAMEN YEREL olarak (cihazınızda)
  tarar — hiçbir veri hiçbir sunucuya gönderilmez.
• Form alanlarına yazarken de korumaya devam eder, sadece odaklanma
  durumuna bağlı kalmaz.
• Panik modu (Ctrl+Shift+X): acil durumda tüm ekranı tek tuşla karartır.
• Regex'in yakalayamadığı görseller/öğeler için manuel blur: bir öğeye
  tıklayıp kalıcı olarak gizleyebilirsiniz (Alt+tık ile de hızlıca).
• Kendi ekleyeceğiniz özel kalıplarla (örn. kendi adınız) her sitede
  otomatik koruma sağlayabilirsiniz.
• Güvendiğiniz sitelerde (örn. kendi bankanız) korumayı site bazlı
  kapatabilirsiniz.
• Bir web sayfası kendi ekran paylaşımını başlattığında (Google Meet,
  Discord gibi) otomatik uyarı banner'ı gösterir.

GİZLİLİK
Eklenti hiçbir veriyi sunucuya göndermez, satmaz veya üçüncü taraflarla
paylaşmaz. Tüm tarama tarayıcınızın içinde gerçekleşir. Detaylar için
gizlilik politikamıza bakabilirsiniz.

BİLİNEN SINIRLAMALAR
Bu bir tarayıcı sekmesi eklentisidir — OBS gibi harici masaüstü paylaşım
araçlarını kapsamaz, sadece tarayıcı içindeki sayfaları korur. İsim ve
adres tespiti gerçek dünyada %100 kapsamayabilir; regex tabanlı akıllı
sezgisel yöntemler kullanır, kesin koruma için özel kalıp veya manuel blur
özelliklerini kullanmanızı öneririz.
```

## İzin Gerekçeleri (Developer Dashboard → "Permissions justification")

**Tek amaç (Single purpose) açıklaması:**
```
Bu eklenti, ekran/sekme paylaşımı veya canlı yayın sırasında kullanıcının
ekranında yanlışlıkla görünen hassas bilgileri (kart no, TC kimlik, adres,
isim, API anahtarı vb.) otomatik olarak bulanıklaştırmak için tasarlanmıştır.
Tüm özellikler (otomatik tarama, manuel blur, panik modu, paylaşım algılama)
bu tek amaca hizmet eder.
```

**`host_permissions` (`<all_urls>`) gerekçesi:**
```
Hassas bilgi kullanıcının ziyaret ettiği HERHANGİ bir web sitesinde
görünebilir (e-ticaret, bankacılık, form siteleri, video görüşme
platformları vb.). Eklenti hangi siteleri koruyacağını önceden bilemediği
için, koruma sağlayabilmek amacıyla tüm sitelerde çalışabilmesi gerekir.
Bu izin yalnızca yerel/cihaz-içi metin taraması ve bulanıklaştırma için
kullanılır; hiçbir veri toplanmaz veya iletilmez.
```

**`scripting` gerekçesi:**
```
Manuel blur seçim modu ve panik modu, kullanıcının o an aktif olduğu
sekmeye dinamik olarak enjekte edilen betiklerle çalışır. Ayrıca eklenti
kurulduğunda/güncellendiğinde, kullanıcının o an açık olan sekmelerinin
sayfayı yenilemeden korunabilmesi için bu izin kullanılır.
```

**`storage` gerekçesi:**
```
Kullanıcının koruma tercihlerini (açık/kapalı, kategori toggle'ları,
whitelist, özel kalıplar, manuel blur konumları) kaydetmek için kullanılır.
```

**`activeTab` gerekçesi:**
```
Popup üzerinden tetiklenen aksiyonların (panik modu, manuel blur seçimi,
whitelist ekleme) kullanıcının o an baktığı sekmeye uygulanabilmesi için
kullanılır.
```

**Uzak kod (remote code) kullanımı:**
```
Hayır — eklenti hiçbir uzak sunucudan kod indirmez veya çalıştırmaz. Tüm
JavaScript dosyaları paket içinde gelir.
```

## Ekran Görüntüleri (1280×800 veya 640×400, en az 1 tane gerekli)

Henüz alınmadı. Önerilen kareler:
1. Popup açık görünümü (tüm switch'ler ve butonlarla)
2. Bir form/checkout sayfasında kart no + adres + isim bulanıklaşmış hâli
3. Panik modu aktifken tüm ekranın karardığı an
4. Manuel blur seçim modu (kırmızı kesikli outline ile)
