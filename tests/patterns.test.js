const {
  luhnValid,
  isValidCard,
  isValidTCKN,
  getPatterns,
  findMatches,
  escapeRegex,
  buildCustomPatterns,
  normalizeDomain,
  isDomainWhitelisted
} = require('../lib/patterns');

function matchesForPattern(text, patternName) {
  const pattern = getPatterns().find((p) => p.name === patternName);
  const matches = [];
  let m;
  pattern.regex.lastIndex = 0;
  while ((m = pattern.regex.exec(text)) !== null) {
    if (pattern.validate(m[0])) matches.push(m[0]);
  }
  return matches;
}

describe('luhnValid / isValidCard', () => {
  test('geçerli bir kart numarasını kabul eder', () => {
    expect(isValidCard('4532 0151 1283 0366')).toBe(true);
  });

  test('Luhn checksum tutmayan numarayı reddeder', () => {
    expect(isValidCard('4532 0151 1283 0367')).toBe(false);
  });

  test('13 haneden kısa numarayı reddeder', () => {
    expect(isValidCard('123456789012')).toBe(false);
  });

  test('19 haneden uzun numarayı reddeder', () => {
    expect(isValidCard('12345678901234567890')).toBe(false);
  });
});

describe('isValidTCKN', () => {
  test('geçerli bir TCKN\'yi kabul eder', () => {
    expect(isValidTCKN('10000000146')).toBe(true);
  });

  test('checksum tutmayan TCKN\'yi reddeder', () => {
    expect(isValidTCKN('10000000147')).toBe(false);
  });

  test('0 ile başlayan TCKN\'yi reddeder', () => {
    expect(isValidTCKN('01234567890')).toBe(false);
  });

  test('11 haneden farklı uzunluğu reddeder', () => {
    expect(isValidTCKN('123456789')).toBe(false);
  });
});

describe('kart deseni (metin içinde)', () => {
  test('geçerli kart numarasını metinden yakalar', () => {
    const text = 'Kart numaram: 4532 0151 1283 0366 lütfen not al.';
    expect(matchesForPattern(text, 'kart')).toContain('4532 0151 1283 0366');
  });

  test('rastgele 16 haneli ama Luhn tutmayan sayıyı yakalamaz', () => {
    const text = 'Sipariş kodu: 1234 5678 9012 3459';
    expect(matchesForPattern(text, 'kart')).toHaveLength(0);
  });
});

describe('tckn deseni (metin içinde)', () => {
  test('geçerli TCKN\'yi metinden yakalar', () => {
    const text = 'TC Kimlik No: 10000000146 kayıtlıdır.';
    expect(matchesForPattern(text, 'tckn')).toContain('10000000146');
  });

  test('checksum tutmayan 11 haneli sayıyı yanlış pozitif olarak yakalamaz', () => {
    const text = 'Referans: 12345678901';
    expect(matchesForPattern(text, 'tckn')).toHaveLength(0);
  });
});

describe('iban deseni', () => {
  test('boşluklu TR IBAN\'ı yakalar', () => {
    const text = 'IBAN: TR33 0006 1005 1978 6457 8413 26';
    expect(matchesForPattern(text, 'iban')).toContain('TR33 0006 1005 1978 6457 8413 26');
  });
});

describe('telefon deseni', () => {
  test('0 ile başlayan cep telefonunu yakalar', () => {
    expect(matchesForPattern('Beni ara: 0532 123 45 67', 'tel')).toContain('0532 123 45 67');
  });

  test('+90 ile başlayan cep telefonunu yakalar', () => {
    expect(matchesForPattern('Numaram +90 532 123 45 67', 'tel')).toContain('+90 532 123 45 67');
  });
});

describe('e-posta deseni', () => {
  test('standart bir e-posta adresini yakalar', () => {
    expect(matchesForPattern('İletişim: test@example.com adresinden.', 'email')).toContain('test@example.com');
  });
});

describe('adres deseni', () => {
  test('Mahalle + No/Daire içeren bir adresi yakalar', () => {
    const text = 'Adresim: Cumhuriyet Mahallesi Atatürk Caddesi No:15 Daire:4';
    const matches = matchesForPattern(text, 'adres');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]).toMatch(/Cumhuriyet/);
  });

  test('e-ticaret sitesindeki gerçek bir teslimat adresi satırını yakalar (Mahalle + noktalı sokak kısaltması + apartman/no/zil)', () => {
    const text = 'Karşıyaka Mahallesi 519.Sok 45/1 Isalar Apartman No 11 Zil';
    const matches = matchesForPattern(text, 'adres');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]).toMatch(/Karşıyaka Mahallesi/);
    expect(matches[0]).toMatch(/519\.Sok/);
  });

  test('sayıya bitişik nokta ile yazılmış sokak kısaltmasını da (Mahalle olmadan) yakalar', () => {
    const text = '519.Sok 45/1 Isalar Apartman No 11 Zil';
    const matches = matchesForPattern(text, 'adres');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]).toMatch(/519\.Sok/);
  });
});

describe('geliştirici sırları', () => {
  test('AWS erişim anahtarını yakalar', () => {
    expect(matchesForPattern('key=AKIAABCDEFGHIJKLMNOP burada', 'aws-key')).toContain('AKIAABCDEFGHIJKLMNOP');
  });

  test('GCP API anahtarını yakalar', () => {
    const text = 'AIzaSyD-abcdefghijklmnopqrstuvwxyz012345';
    expect(matchesForPattern(text, 'gcp-key')).toContain(text);
  });

  test('Azure bağlantı anahtarını yakalar', () => {
    const text = 'AccountKey=' + 'a'.repeat(40) + '==';
    expect(matchesForPattern(text, 'azure-key').length).toBeGreaterThan(0);
  });

  test('GitHub token\'ını yakalar', () => {
    const text = 'ghp_' + 'a'.repeat(36);
    expect(matchesForPattern(text, 'github-token')).toContain(text);
  });

  test('Slack token\'ını yakalar', () => {
    const text = 'xoxb-1234567890-abcdefghij';
    expect(matchesForPattern(text, 'slack-token')).toContain(text);
  });

  test('Anthropic anahtarını yakalar ve OpenAI kalıbıyla çakışmaz', () => {
    const text = 'sk-ant-api03-' + 'a'.repeat(30);
    expect(matchesForPattern(text, 'anthropic-key')).toContain(text);
    expect(matchesForPattern(text, 'openai-key')).toHaveLength(0);
  });

  test('OpenAI anahtarını yakalar', () => {
    const text = 'sk-' + 'a'.repeat(40);
    expect(matchesForPattern(text, 'openai-key')).toContain(text);
  });

  test('JWT yakalar', () => {
    const text = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dQw4w9WgXcQ_abcdefgh';
    expect(matchesForPattern(text, 'jwt')).toContain(text);
  });
});

describe('isim tespiti (Faz A)', () => {
  test('bağlam etiketinden sonraki ismi yakalar, etiketin kendisini değil', () => {
    const text = 'Ad Soyad: Ahmet Yılmaz';
    const matches = matchesForPattern(text, 'isim-baglam');
    expect(matches).toContain('Ahmet Yılmaz');
  });

  test('"Alıcı:" etiketiyle de çalışır', () => {
    expect(matchesForPattern('Alıcı: Fatma Kaya', 'isim-baglam')).toContain('Fatma Kaya');
  });

  test('yaygın isim listesinden bir isim + soyadı yakalar (etiket olmadan)', () => {
    const text = 'Sipariş detayları: Hasan Yılmaz - 0532 000 00 00';
    const matches = matchesForPattern(text, 'isim-liste');
    expect(matches).toContain('Hasan Yılmaz');
  });

  test('listede olmayan bir kelimeden sonra soyadı yakalamaz', () => {
    expect(matchesForPattern('Rastgele Kelime burada', 'isim-liste')).toHaveLength(0);
  });
});

describe('findMatches', () => {
  test('birden fazla kalıp türünü aynı metinde bulur', () => {
    const text = 'Kartım 4532 0151 1283 0366, mailim test@example.com';
    const matches = findMatches(text, getPatterns());
    const labels = matches.map((m) => m.label);
    expect(labels).toContain('Kart No');
    expect(labels).toContain('E-posta');
  });

  test('eşleşme yoksa boş dizi döner', () => {
    expect(findMatches('sıradan bir cümle', getPatterns())).toHaveLength(0);
  });
});

describe('escapeRegex / buildCustomPatterns', () => {
  test('regex özel karakterlerini kaçırır', () => {
    expect(escapeRegex('a.b*c?')).toBe('a\\.b\\*c\\?');
  });

  test('boş veya sadece boşluk olan girdileri eler', () => {
    expect(buildCustomPatterns(['', '   ', 'Gerçek Adres'])).toHaveLength(1);
  });

  test('üretilen kalıp metinde büyük/küçük harf duyarsız eşleşir', () => {
    const [pattern] = buildCustomPatterns(['Cumhuriyet Mah. No:15']);
    expect(pattern.regex.test('adresim cumhuriyet mah. no:15 istanbul')).toBe(true);
  });

  test('regex özel karakteri içeren özel metin hata fırlatmaz', () => {
    const [pattern] = buildCustomPatterns(['a.b (test)']);
    expect(pattern.regex.test('a.b (test)')).toBe(true);
    expect(pattern.regex.test('aXb (test)')).toBe(false);
  });
});

describe('normalizeDomain / isDomainWhitelisted', () => {
  test('www. önekini ve büyük harfleri normalize eder', () => {
    expect(normalizeDomain('WWW.Example.com')).toBe('example.com');
  });

  test('tam eşleşen domaini whitelist olarak kabul eder', () => {
    expect(isDomainWhitelisted('example.com', ['example.com'])).toBe(true);
  });

  test('alt alan adını whitelist olarak kabul eder', () => {
    expect(isDomainWhitelisted('giris.example.com', ['example.com'])).toBe(true);
  });

  test('benzer ama farklı domaini kabul etmez', () => {
    expect(isDomainWhitelisted('notexample.com', ['example.com'])).toBe(false);
  });

  test('boş liste için whitelist döndürmez', () => {
    expect(isDomainWhitelisted('example.com', [])).toBe(false);
  });
});
