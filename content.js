// ============================================================
// Maps Lead Scraper — content.js
// Injected into: https://www.google.com/maps/*
// ============================================================

(function () {
  'use strict';

  let isRunning = false;
  let scrapedCount = 0;
  const scrapedKeys = new Set();

  // ── Listen for commands from popup (via background) ─────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_SCRAPING') {
      if (!isRunning) {
        isRunning = true;
        scrapedCount = 0;
        startScraping();
      }
      sendResponse({ ok: true });
    } else if (message.type === 'STOP_SCRAPING') {
      isRunning = false;
      sendResponse({ ok: true, count: scrapedCount });
    } else if (message.type === 'PING') {
      sendResponse({ ok: true, onMaps: true });
    }
    return true;
  });

  // ── Main scraping loop ───────────────────────────────────────

  async function startScraping() {
    // Wait for the results feed to appear
    const feed = await waitForElement('[role="feed"]', 10000);
    if (!feed) {
      notifyPopup('ERROR', 'Could not find Google Maps results list. Please search for a business first.');
      isRunning = false;
      return;
    }

    let lastCount = 0;
    let stallCount = 0;

    while (isRunning) {
      // Get all result cards currently visible
      const cards = feed.querySelectorAll('a.hfpxzc');
      
      for (const card of cards) {
        if (!isRunning) break;
        
        // Extract a unique identifier from the href
        const href = card.getAttribute('href') || '';
        const match = href.match(/!1s([^!]+)/);
        const cardKey = match ? match[1] : card.getAttribute('aria-label') || card.textContent.slice(0, 40);
        
        if (scrapedKeys.has(cardKey)) continue;
        scrapedKeys.add(cardKey);

        // Click the card to open details panel
        card.click();
        await sleep(1500);

        const lead = await scrapeDetailPanel();
        if (lead) {
          scrapedCount++;
          // Send to background for storage
          chrome.runtime.sendMessage({
            type: 'ADD_LEADS',
            leads: [lead]
          });
          // Update popup counter
          notifyPopup('COUNT_UPDATE', scrapedCount);
        }
      }

      // Scroll down to load more results
      const currentCount = feed.querySelectorAll('a.hfpxzc').length;
      
      if (currentCount === lastCount) {
        stallCount++;
        if (stallCount >= 3) {
          // Check if we've reached the end
          const endMsg = document.querySelector('.HlvSq');
          if (endMsg) break; // "You've reached the end of the list"
        }
      } else {
        stallCount = 0;
      }
      
      lastCount = currentCount;
      
      // Scroll feed to load more
      feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' });
      await sleep(2000);
    }

    isRunning = false;
    notifyPopup('DONE', scrapedCount);
  }

  // ── Detail Panel Scraper ─────────────────────────────────────

  async function scrapeDetailPanel() {
    // Wait for detail panel's main title to load
    const titleEl = await waitForElement('h1.DUwDvf, h1.fontHeadlineLarge', 3000);
    if (!titleEl) return null;

    try {
      const lead = {
        name: '', category: '', address: '', phone: '', website: '', rating: '', reviews: ''
      };

      // Name
      lead.name = titleEl.textContent.trim();

      // Category (usually a button just under the title)
      const catEl = document.querySelector('button.DkEaL');
      if (catEl) lead.category = catEl.textContent.trim();

      // Rating & Reviews
      const ratingSpan = document.querySelector('span.MW4etd');
      if (ratingSpan) lead.rating = ratingSpan.textContent.trim();

      const reviewSpan = document.querySelector('span.UY7F9');
      if (reviewSpan) {
        // e.g., "(32)" -> "32"
        lead.reviews = reviewSpan.textContent.replace(/[^\d]/g, '');
      } else {
        // Fallback: Check aria-label of the parent container
        const ratingContainer = document.querySelector('span.ZkP5Je');
        if (ratingContainer) {
          const aria = ratingContainer.getAttribute('aria-label') || '';
          const match = aria.match(/([0-9.,]+)[^\d]*([0-9.,]+)/);
          if (match && !lead.rating) lead.rating = match[1];
          if (match && !lead.reviews) lead.reviews = match[2];
        }
      }

      // Information section (Address, Phone, Website)
      // These use robust data-item-id attributes
      
      // Address
      const addressBtn = document.querySelector('button[data-item-id="address"]');
      if (addressBtn) {
        // The text is usually in a div with class Io6YTe or similar inside the button
        // Or in the aria-label
        const ariaLabel = addressBtn.getAttribute('aria-label') || '';
        if (ariaLabel.toLowerCase().includes('address')) {
           lead.address = ariaLabel.replace(/^[^:]+:\s*/i, '').trim();
        }
        if (!lead.address) {
            // fallback to finding the child div with text
            const textDivs = addressBtn.querySelectorAll('div');
            for(const div of textDivs) {
                if (div.textContent && div.textContent.length > 5 && !div.querySelector('svg')) {
                    lead.address = div.textContent.trim();
                    break;
                }
            }
        }
      }

      // Phone
      const phoneBtn = document.querySelector('button[data-item-id^="phone"]');
      if (phoneBtn) {
        const ariaLabel = phoneBtn.getAttribute('aria-label') || '';
        if (ariaLabel.toLowerCase().includes('phone')) {
           lead.phone = ariaLabel.replace(/^[^:]+:\s*/i, '').trim();
        }
        if (!lead.phone) {
             const textDivs = phoneBtn.querySelectorAll('div');
             for(const div of textDivs) {
                 if (div.textContent && /[\d\s()+-]{7,}/.test(div.textContent) && !div.querySelector('svg')) {
                     lead.phone = div.textContent.trim();
                     break;
                 }
             }
        }
      }

      // Website
      const siteAnchor = document.querySelector('a[data-item-id="authority"]');
      if (siteAnchor) {
        lead.website = siteAnchor.getAttribute('href') || '';
      }

      return lead;
    } catch (e) {
      console.error('Error scraping details:', e);
      return null;
    }
  }

  // ── Utilities ─────────────────────────────────────────────────

  function notifyPopup(event, data) {
    chrome.runtime.sendMessage({ type: 'SCRAPER_EVENT', event, data });
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
      const existing = document.querySelector(selector);
      if (existing) return resolve(existing);

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

})();
