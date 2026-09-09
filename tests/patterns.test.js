const {
  luhnValid,
  isValidCard,
  isValidTCKN,
  getPatterns,
  escapeRegex,
  buildCustomPatterns,
  normalizeDomain,
  isDomainWhitelisted
} = require('../lib/patterns');

function findMatches(text, patternName) {
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
    expect(findMatches(text, 'kart')).toContain('4532 0151 1283 0366');
  });

  test('rastgele 16 haneli ama Luhn tutmayan sayıyı yakalamaz', () => {
    const text = 'Sipariş kodu: 1234 5678 9012 3459';
    expect(findMatches(text, 'kart')).toHaveLength(0);
  });
});

describe('tckn deseni (metin içinde)', () => {
  test('geçerli TCKN\'yi metinden yakalar', () => {
    const text = 'TC Kimlik No: 10000000146 kayıtlıdır.';
    expect(findMatches(text, 'tckn')).toContain('10000000146');
  });

  test('checksum tutmayan 11 haneli sayıyı yanlış pozitif olarak yakalamaz', () => {
    const text = 'Referans: 12345678901';
    expect(findMatches(text, 'tckn')).toHaveLength(0);
  });
});

describe('iban deseni', () => {
  test('boşluklu TR IBAN\'ı yakalar', () => {
    const text = 'IBAN: TR33 0006 1005 1978 6457 8413 26';
    expect(findMatches(text, 'iban')).toContain('TR33 0006 1005 1978 6457 8413 26');
  });
});

describe('telefon deseni', () => {
  test('0 ile başlayan cep telefonunu yakalar', () => {
    expect(findMatches('Beni ara: 0532 123 45 67', 'tel')).toContain('0532 123 45 67');
  });

  test('+90 ile başlayan cep telefonunu yakalar', () => {
    expect(findMatches('Numaram +90 532 123 45 67', 'tel')).toContain('+90 532 123 45 67');
  });
});

describe('e-posta deseni', () => {
  test('standart bir e-posta adresini yakalar', () => {
    expect(findMatches('İletişim: test@example.com adresinden.', 'email')).toContain('test@example.com');
  });
});

describe('adres deseni', () => {
  test('Mahalle + No/Daire içeren bir adresi yakalar', () => {
    const text = 'Adresim: Cumhuriyet Mahallesi Atatürk Caddesi No:15 Daire:4';
    const matches = findMatches(text, 'adres');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]).toMatch(/Cumhuriyet/);
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
