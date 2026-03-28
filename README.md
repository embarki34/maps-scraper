# Google Maps Lead Scraper — Chrome Extension

A powerful Chrome Extension that automatically scrapes business leads from Google Maps search results. Built for Manifest V3.

## What It Extracts

| Field | Example |
|-------|---------|
| Business Name | Café de Flore |
| Category | Coffee shop |
| Address | 172 Bd Saint-Germain, 75006 Paris |
| Phone | +33 1 45 48 55 26 |
| Website | cafedeflore.fr |
| Rating | 4.5 |
| Reviews | 12,345 |

## Installation (Load Unpacked)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer Mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select this folder: `c:\Users\Gaming_Setif\Documents\maps scraper`
5. The extension icon will appear in your toolbar

## How to Use

1. Go to [Google Maps](https://www.google.com/maps)
2. Search for a business type, e.g. `restaurants in London`
3. Wait for the results sidebar to load
4. Click the **Maps Lead Scraper** extension icon
5. Click **▶ Start Scraping**
6. The extension will auto-scroll and collect leads
7. Click **■ Stop Scraping** at any time, OR wait for it to finish
8. Click **⬇ CSV** or **⬇ JSON** to download your leads

## Tips

- Search more specifically for better results: `"plumbers in Manchester"` returns more focused leads
- The scraper respects page load time — don't interfere while it's running
- Use **Clear** to reset results before a new search
- Each run appends to existing data — good for scraping multiple searches

## File Structure

```
maps scraper/
├── manifest.json       # Extension config (Manifest V3)
├── background.js       # Service worker: storage + exports
├── content.js          # Scraping logic injected into Maps
├── popup.html          # Extension popup UI
├── popup.js            # Popup controller
├── popup.css           # Dark-theme styling
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Privacy

All data is stored **locally** in your browser via `chrome.storage.local`. Nothing is sent to any external server.
