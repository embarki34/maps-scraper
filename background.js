// ============================================================
// Maps Lead Scraper — background.js (Service Worker)
// ============================================================

// ── Lead Storage Helpers ──────────────────────────────────────

async function getLeads() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['leads'], (result) => {
      resolve(result.leads || []);
    });
  });
}

async function saveLeads(leads) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ leads }, resolve);
  });
}

// ── Message Router ────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {

      // Content script sends scraped leads in batches
      case 'ADD_LEADS': {
        const existing = await getLeads();
        const existingKeys = new Set(existing.map(l => leadKey(l)));
        const newLeads = (message.leads || []).filter(l => !existingKeys.has(leadKey(l)));
        const merged = [...existing, ...newLeads];
        await saveLeads(merged);
        sendResponse({ ok: true, total: merged.length });
        break;
      }

      // Popup requests all stored leads
      case 'GET_LEADS': {
        const leads = await getLeads();
        sendResponse({ leads });
        break;
      }

      // Popup requests clear
      case 'CLEAR_LEADS': {
        await saveLeads([]);
        sendResponse({ ok: true });
        break;
      }

      // Popup requests CSV download
      case 'EXPORT_CSV': {
        const leads = await getLeads();
        const csv = buildCSV(leads);
        const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        chrome.downloads.download({
          url: dataUrl,
          filename: `maps_leads_${timestamp()}.csv`,
          saveAs: false
        });
        sendResponse({ ok: true });
        break;
      }

      // Popup requests JSON download
      case 'EXPORT_JSON': {
        const leads = await getLeads();
        const json = JSON.stringify(leads, null, 2);
        const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
        chrome.downloads.download({
          url: dataUrl,
          filename: `maps_leads_${timestamp()}.json`,
          saveAs: false
        });
        sendResponse({ ok: true });
        break;
      }

      default:
        sendResponse({ ok: false, error: 'Unknown message type' });
    }
  })();
  return true; // keep channel open for async response
});

// ── Utilities ─────────────────────────────────────────────────

function leadKey(lead) {
  return `${(lead.name || '').toLowerCase()}__${(lead.address || '').toLowerCase()}`;
}

function buildCSV(leads) {
  if (!leads.length) return '';
  const headers = ['Name', 'Category', 'Address', 'Phone', 'Website', 'Rating', 'Reviews'];
  const rows = leads.map(l => [
    csvEsc(l.name),
    csvEsc(l.category),
    csvEsc(l.address),
    csvEsc(l.phone),
    csvEsc(l.website),
    csvEsc(l.rating),
    csvEsc(l.reviews)
  ].join(','));
  return [headers.join(','), ...rows].join('\r\n');
}

function csvEsc(val) {
  if (val === undefined || val === null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
