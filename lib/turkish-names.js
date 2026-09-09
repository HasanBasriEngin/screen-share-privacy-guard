// Ekran Guard - yaygın Türkçe ilk isim listesi.
// "İsim tespiti Faz A" (bkz. CLAUDE.md) için kullanılır: bu listedeki bir
// isimden hemen sonra gelen büyük harfli kelimeyi muhtemel soyadı sayarak
// "Ad Soyad" ikilisini bulanıklaştırmaya çalışır. Küçük/başlangıç seviyeli bir
// liste — kapsamlı bir isim veritabanı değildir, gerekirse genişletilebilir.

(function (root) {
  'use strict';

  const COMMON_TURKISH_FIRST_NAMES = [
    // Erkek isimleri
    'Ahmet', 'Mehmet', 'Mustafa', 'Ali', 'Hüseyin', 'Hasan', 'İbrahim', 'Osman',
    'Yusuf', 'Murat', 'Emre', 'Burak', 'Mert', 'Kemal', 'Kadir', 'Ömer', 'Halil',
    'İsmail', 'Ramazan', 'Recep', 'Fatih', 'Cem', 'Serkan', 'Erkan', 'Volkan',
    'Tolga', 'Selim', 'Adem', 'Bekir', 'Bilal', 'Cengiz', 'Cihan', 'Doğan',
    'Ekrem', 'Enes', 'Erdem', 'Ersin', 'Ferhat', 'Furkan', 'Gökhan', 'Hakan',
    'Hakkı', 'Harun', 'Hüsnü', 'İlker', 'İlyas', 'Kaan', 'Kenan', 'Kerem',
    'Levent', 'Mahmut', 'Melih', 'Metin', 'Muhammed', 'Necati', 'Nihat', 'Nuri',
    'Onur', 'Orhan', 'Oktay', 'Ozan', 'Salih', 'Sami', 'Selçuk', 'Serhat',
    'Sinan', 'Suat', 'Şükrü', 'Taner', 'Tarık', 'Tayfun', 'Tuncay', 'Turgut',
    'Uğur', 'Umut', 'Vedat', 'Veli', 'Yasin', 'Yavuz', 'Yiğit', 'Yunus', 'Zafer',
    'Zeki', 'Alper', 'Arda', 'Barış', 'Berkay', 'Bora', 'Can', 'Deniz', 'Efe',
    'Egemen', 'Ekin', 'Eren', 'Ertan', 'Faruk', 'Gökay', 'Görkem', 'Kağan',
    'Koray', 'Mesut', 'Muhsin', 'Necip', 'Nedim', 'Okan', 'Oğuz', 'Polat',
    'Rasim', 'Rıdvan', 'Sabri', 'Safa', 'Samet', 'Sedat', 'Serdar', 'Süleyman',
    'Talha', 'Tevfik', 'Ufuk', 'Ünal', 'Vahit', 'Yakup', 'Yalçın', 'Yener', 'Ziya',
    // Kadın isimleri
    'Ayşe', 'Fatma', 'Emine', 'Hatice', 'Zeynep', 'Elif', 'Meryem', 'Zehra',
    'Şerife', 'Sultan', 'Havva', 'Rukiye', 'Gülsüm', 'Aylin', 'Büşra', 'Cansu',
    'Derya', 'Ebru', 'Esra', 'Gamze', 'Gizem', 'Gül', 'Gülcan', 'Hacer', 'Hülya',
    'Işıl', 'İpek', 'Kader', 'Kübra', 'Leyla', 'Melike', 'Merve', 'Nazlı',
    'Nesrin', 'Nur', 'Nuray', 'Özge', 'Pınar', 'Reyhan', 'Selin', 'Selma', 'Seda',
    'Sema', 'Sevgi', 'Sibel', 'Sinem', 'Songül', 'Şeyma', 'Tuğba', 'Tülay',
    'Ümmü', 'Yasemin', 'Yıldız', 'Zübeyde', 'Aslı', 'Asuman', 'Aynur', 'Ayça',
    'Bahar', 'Banu', 'Begüm', 'Belgin', 'Berna', 'Beste', 'Buse', 'Canan',
    'Ceren', 'Ceyda', 'Ceylan', 'Damla', 'Defne', 'Didem', 'Dilara', 'Dilek',
    'Duygu', 'Ecrin', 'Ela', 'Emel', 'Esin', 'Feride', 'Filiz', 'Funda', 'Gonca',
    'Gökçe', 'Gülay', 'Gülden', 'Gülnaz', 'Gülten', 'Handan', 'Hilal', 'Ilgın',
    'İclal', 'İlknur', 'Jale', 'Kevser', 'Lale', 'Melis', 'Meltem', 'Naz',
    'Nilay', 'Nilüfer', 'Oya', 'Perihan', 'Rabia', 'Rüya', 'Saadet', 'Sevil',
    'Simge', 'Suna', 'Şükran', 'Tuba', 'Ülkü', 'Yeliz', 'Zerrin', 'Zuhal'
  ];

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = COMMON_TURKISH_FIRST_NAMES;
  } else {
    root.EkranGuardTurkishNames = COMMON_TURKISH_FIRST_NAMES;
  }
})(typeof self !== 'undefined' ? self : this);
