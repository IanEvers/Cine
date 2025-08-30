## Cinemark Hoyts Metacritic Scores (Chrome MV3 Extension)

Displays Metacritic critic and user scores on movie tiles at `https://www.cinemarkhoyts.com.ar/`.

### Install (Developer Mode)

1. Download or clone this folder to your machine.
2. Open Chrome → go to `chrome://extensions`.
3. Enable "Developer mode" (top-right).
4. Click "Load unpacked" and select the `/workspace/extension` folder.
5. Visit `https://www.cinemarkhoyts.com.ar/` and browse listings; scores appear top-right on each movie card.

### How it works

- A content script (`content.js`) detects movie tiles on the page, extracts their titles, and asks the background service worker for Metacritic scores.
- The background worker (`background.js`) fetches from Metacritic using multiple strategies:
  - Direct movie slug guess (e.g., `/movie/<slug>`)
  - Search fallback, then follow the first movie result
  - Mirror fallback via `https://r.jina.ai/` (text proxy) to bypass strict HTML delivery in some contexts
- Results are cached in `chrome.storage.local` for 14 days to reduce requests.

### Files

- `manifest.json`: MV3 configuration and permissions
- `background.js`: Fetches and caches Metacritic scores
- `content.js`: Finds titles on Cinemark Hoyts, injects score badges
- `styles.css`: Visual styles for the small top-right badges

### Permissions

- Host permissions: `https://www.cinemarkhoyts.com.ar/*`, `https://www.metacritic.com/*`, `https://r.jina.ai/*`
- Storage permission for local caching

### Notes

- Some titles might not have Metacritic pages; those will show placeholders ("MC …" / "USER …").
- If Metacritic changes their markup, score extraction patterns may need updates.
- The extension is designed to be resilient with multiple selectors and fallbacks.

### Uninstall

- Visit `chrome://extensions`, toggle off or remove the extension.

