// ============================================================
// Maps Lead Scraper — popup.js
// ============================================================

let isRunning = false;
let sessionCount = 0;

// ── DOM Refs ──────────────────────────────────────────────────
const btnToggle     = document.getElementById('btnToggle');
const btnLabel      = document.getElementById('btnLabel');
const btnIcon       = document.getElementById('btnIcon');
const btnClear      = document.getElementById('btnClear');
const btnCsv        = document.getElementById('btnCsv');
const btnJson       = document.getElementById('btnJson');
const totalCountEl  = document.getElementById('totalCount');
const sessionCountEl= document.getElementById('sessionCount');
const statusDot     = document.getElementById('statusDot');
const warningBanner = document.getElementById('warningBanner');
const progressWrap  = document.getElementById('progressWrap');
const tableBody     = document.getElementById('tableBody');
const previewCount  = document.getElementById('previewCount');

// ── Init ──────────────────────────────────────────────────────

async function init() {
  // Check if current tab is Google Maps
  const tab = await getActiveTab();
  const onMaps = tab && tab.url && tab.url.includes('google.com/maps');

  if (!onMaps) {
    warningBanner.classList.remove('hidden');
    btnToggle.disabled = true;
  } else {
    warningBanner.classList.add('hidden');
    btnToggle.disabled = false;
  }

  // Load stored count
  await refreshLeadCount();

  // Listen for real-time updates from content script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SCRAPER_EVENT') {
      if (msg.event === 'COUNT_UPDATE') {
        sessionCount = msg.data;
        sessionCountEl.textContent = sessionCount;
        refreshLeadCount();
      } else if (msg.event === 'DONE') {
        setIdle();
        refreshLeadCount();
        refreshTable();
      } else if (msg.event === 'ERROR') {
        setIdle();
        warningBanner.textContent = msg.data;
        warningBanner.classList.remove('hidden');
      }
    }
  });

  await refreshTable();
}

// ── Button Handlers ───────────────────────────────────────────

btnToggle.addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab) return;

  if (!isRunning) {
    // Start
    isRunning = true;
    sessionCount = 0;
    sessionCountEl.textContent = '0';
    setRunning();

    chrome.tabs.sendMessage(tab.id, { type: 'START_SCRAPING' }, (res) => {
      if (chrome.runtime.lastError) {
        // Content script not yet injected - inject it first
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }, () => {
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { type: 'START_SCRAPING' });
          }, 500);
        });
      }
    });
  } else {
    // Stop
    isRunning = false;
    const tab = await getActiveTab();
    if (tab) chrome.tabs.sendMessage(tab.id, { type: 'STOP_SCRAPING' });
    setIdle();
    await refreshTable();
  }
});

btnClear.addEventListener('click', async () => {
  if (!confirm('Clear all stored leads?')) return;
  await sendBg({ type: 'CLEAR_LEADS' });
  totalCountEl.textContent = '0';
  sessionCount = 0;
  sessionCountEl.textContent = '0';
  btnCsv.disabled = true;
  btnJson.disabled = true;
  renderTable([]);
});

btnCsv.addEventListener('click', () => {
  sendBg({ type: 'EXPORT_CSV' });
});

btnJson.addEventListener('click', () => {
  sendBg({ type: 'EXPORT_JSON' });
});

// ── State Helpers ─────────────────────────────────────────────

function setRunning() {
  btnLabel.textContent = 'Stop Scraping';
  btnIcon.textContent = '■';
  btnToggle.classList.add('running');
  progressWrap.classList.remove('hidden');
  statusDot.className = 'dot dot-running';
}

function setIdle() {
  isRunning = false;
  btnLabel.textContent = 'Start Scraping';
  btnIcon.textContent = '▶';
  btnToggle.classList.remove('running');
  progressWrap.classList.add('hidden');
  statusDot.className = 'dot dot-idle';
}

// ── Data ──────────────────────────────────────────────────────

async function refreshLeadCount() {
  const res = await sendBg({ type: 'GET_LEADS' });
  if (res && res.leads) {
    const count = res.leads.length;
    totalCountEl.textContent = count;
    btnCsv.disabled = count === 0;
    btnJson.disabled = count === 0;
  }
}

async function refreshTable() {
  const res = await sendBg({ type: 'GET_LEADS' });
  if (res && res.leads) {
    renderTable(res.leads);
  }
}

function renderTable(leads) {
  previewCount.textContent = leads.length ? `(${leads.length})` : '';

  if (!leads.length) {
    tableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="3">No leads yet — start scraping!</td>
      </tr>`;
    return;
  }

  tableBody.innerHTML = leads.slice(-50).reverse().map(l => `
    <tr>
      <td title="${esc(l.name)}">${esc(l.name)}</td>
      <td title="${esc(l.phone)}">${esc(l.phone) || '—'}</td>
      <td>${esc(l.rating) || '—'}</td>
    </tr>
  `).join('');
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Communication Helpers ─────────────────────────────────────

function sendBg(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (res) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(res);
    });
  });
}

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0] || null);
    });
  });
}

// ── Start ─────────────────────────────────────────────────────
init();
