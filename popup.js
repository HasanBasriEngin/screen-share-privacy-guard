const { normalizeDomain, isDomainWhitelisted } = window.EkranGuardPatterns;

const toggle = document.getElementById('toggle');
const panicBtn = document.getElementById('panicBtn');
const whitelistToggle = document.getElementById('whitelistToggle');
const currentDomainEl = document.getElementById('currentDomain');
const customInput = document.getElementById('customInput');
const customAddBtn = document.getElementById('customAddBtn');
const customList = document.getElementById('customList');

let panicActive = false;
let currentHostname = null;

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

async function notifyContentScript(type, extra) {
  const tab = await getActiveTab();
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { type, ...extra }).catch(() => {});
  }
}

// ---------- Koruma aç/kapa ----------
chrome.storage.sync.get(['ekranGuardEnabled'], (res) => {
  toggle.checked = res.ekranGuardEnabled !== false;
});

toggle.addEventListener('change', async () => {
  const enabled = toggle.checked;
  chrome.storage.sync.set({ ekranGuardEnabled: enabled });
  await notifyContentScript('TOGGLE', { enabled });
});

// ---------- Panik modu ----------
panicBtn.addEventListener('click', async () => {
  panicActive = !panicActive;
  panicBtn.classList.toggle('active', panicActive);
  panicBtn.textContent = panicActive ? '🔓 Gizlemeyi Kaldır' : '🔒 Şimdi Her Şeyi Gizle';
  await notifyContentScript('PANIC', { value: panicActive });
});

// ---------- Site bazlı whitelist ----------
async function initWhitelist() {
  const tab = await getActiveTab();
  currentHostname = tab && tab.url ? hostnameFromUrl(tab.url) : null;

  if (!currentHostname) {
    currentDomainEl.textContent = 'Bu sayfada kullanılamıyor';
    whitelistToggle.disabled = true;
    return;
  }

  currentDomainEl.textContent = currentHostname;
  chrome.storage.sync.get(['whitelistedDomains'], (res) => {
    const list = res.whitelistedDomains || [];
    whitelistToggle.checked = isDomainWhitelisted(currentHostname, list);
  });
}

whitelistToggle.addEventListener('change', () => {
  if (!currentHostname) return;
  const domain = normalizeDomain(currentHostname);
  chrome.storage.sync.get(['whitelistedDomains'], (res) => {
    let list = res.whitelistedDomains || [];
    if (whitelistToggle.checked) {
      if (!list.some((d) => normalizeDomain(d) === domain)) list = [...list, domain];
    } else {
      list = list.filter((d) => normalizeDomain(d) !== domain);
    }
    chrome.storage.sync.set({ whitelistedDomains: list });
  });
});

// ---------- Özel kalıplar ----------
function renderCustomList(items) {
  customList.innerHTML = '';
  items.forEach((text, index) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = text;
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.className = 'eg-custom-remove';
    removeBtn.addEventListener('click', () => {
      chrome.storage.sync.get(['customPatterns'], (res) => {
        const list = (res.customPatterns || []).slice();
        list.splice(index, 1);
        chrome.storage.sync.set({ customPatterns: list });
      });
    });
    li.appendChild(span);
    li.appendChild(removeBtn);
    customList.appendChild(li);
  });
}

function loadCustomPatterns() {
  chrome.storage.sync.get(['customPatterns'], (res) => {
    renderCustomList(res.customPatterns || []);
  });
}

function addCustomPattern() {
  const text = customInput.value.trim();
  if (!text) return;
  chrome.storage.sync.get(['customPatterns'], (res) => {
    const list = res.customPatterns || [];
    if (list.includes(text)) return;
    const updated = [...list, text];
    chrome.storage.sync.set({ customPatterns: updated }, () => {
      renderCustomList(updated);
      customInput.value = '';
      customInput.focus();
    });
  });
}

customAddBtn.addEventListener('click', addCustomPattern);
customInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addCustomPattern();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (changes.customPatterns) renderCustomList(changes.customPatterns.newValue || []);
});

// ---------- Manuel blur ----------
const pickerBtn = document.getElementById('pickerBtn');
const clearManualBtn = document.getElementById('clearManualBtn');

pickerBtn.addEventListener('click', async () => {
  // Popup, sayfaya tıklanır tıklanmaz odağını kaybedip kapanır — bu yüzden
  // seçim modu content.js'te bağımsız çalışır, popup kapansa da devam eder.
  await notifyContentScript('START_MANUAL_PICKER');
  window.close();
});

clearManualBtn.addEventListener('click', async () => {
  await notifyContentScript('CLEAR_MANUAL_BLURS');
});

initWhitelist();
loadCustomPatterns();
