/*
  Background service worker for fetching Metacritic scores with caching and fallbacks.
*/

const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const STORAGE_KEY_PREFIX = "mc:title:";

function normalizeTitle(rawTitle) {
  if (!rawTitle) return "";
  let title = String(rawTitle).toLowerCase();
  // Remove locale/format qualifiers often used on AR cinema sites
  const junkPatterns = [
    /\b(3d|2d|imax|4dx|xd)\b/g,
    /\b(subtitulad[oa]s?|sub\.?|doblad[oa]s?|castellano|español)\b/g,
    /\b(reestreno|re\s?estreno|preestreno)\b/g,
    /\b(edici[oó]n\s+especial)\b/g,
  ];
  for (const pattern of junkPatterns) title = title.replace(pattern, " ");

  // Remove year in parentheses or brackets
  title = title.replace(/[\[(]\s*\d{4}\s*[\])]/g, " ");
  // Remove anything after a colon or dash (common subtitles in Spanish)
  title = title.split(":")[0];
  title = title.split(" - ")[0];

  // Remove diacritics
  title = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Remove non alphanumerics except spaces
  title = title.replace(/[^a-z0-9 ]+/g, " ");
  // Collapse spaces
  title = title.replace(/\s+/g, " ").trim();
  // Remove leading articles in Spanish/English
  title = title.replace(/^(la|el|los|las|the|a|an)\s+/i, "");
  return title;
}

function titleToSlug(title) {
  const t = normalizeTitle(title);
  if (!t) return "";
  return t.replace(/\s+/g, "-");
}

async function getFromCache(normalizedTitle) {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_PREFIX + normalizedTitle], (res) => {
      const entry = res[STORAGE_KEY_PREFIX + normalizedTitle];
      if (!entry) return resolve(null);
      if (Date.now() - (entry.timestamp || 0) > CACHE_TTL_MS) return resolve(null);
      resolve(entry);
    });
  });
}

async function setCache(normalizedTitle, data) {
  return new Promise((resolve) => {
    const value = { ...data, timestamp: Date.now() };
    chrome.storage.local.set({ [STORAGE_KEY_PREFIX + normalizedTitle]: value }, () => resolve());
  });
}

async function fetchText(url) {
  try {
    const res = await fetch(url, {
      // No custom headers; extensions cannot set restricted headers like User-Agent
      credentials: "omit",
      cache: "no-store",
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    throw err;
  }
}

function parseScoresFromMoviePage(html) {
  // Try multiple patterns to be resilient to Metacritic markup changes
  let critic = null;
  let user = null;

  const patternsCritic = [
    /metascore_w[^>]*>(\d{2,3})<\/span>/i,
    /c-siteReviewScore_num[^>]*>(\d{2,3})<\//i,
    /c-productScoreInfo_scoreNumber[^>]*>(\d{2,3})<\//i,
    /<span[^>]*data-v2-meta-score[^>]*>(\d{2,3})<\//i,
  ];
  const patternsUser = [
    /metascore_w\s+user[^>]*>(\d(?:\.\d)?)<\/span>/i,
    /c-siteReviewScoreUser_scoreNumber[^>]*>(\d(?:\.\d)?)<\//i,
    /c-userScore_scoreNumber[^>]*>(\d(?:\.\d)?)<\//i,
  ];

  for (const re of patternsCritic) {
    const m = html.match(re);
    if (m && m[1]) { critic = parseInt(m[1], 10); break; }
  }
  for (const re of patternsUser) {
    const m = html.match(re);
    if (m && m[1]) { user = parseFloat(m[1]); break; }
  }
  return { critic, user };
}

function extractFirstMovieLinkFromSearch(html) {
  // Find first link to /movie/<slug>
  const linkMatch = html.match(/href=\"(\/movie\/[^\"?#]+)\"/i);
  return linkMatch ? linkMatch[1] : null;
}

async function tryFetchMoviePageBySlug(slug) {
  const urls = [
    `https://www.metacritic.com/movie/${slug}`,
    // Fallback via text mirror to bypass potential CORS/anti-bot
    `https://r.jina.ai/http://www.metacritic.com/movie/${slug}`,
  ];
  for (const url of urls) {
    try {
      const html = await fetchText(url);
      const { critic, user } = parseScoresFromMoviePage(html);
      if (critic != null || user != null) return { critic, user };
    } catch (_) { /* continue */ }
  }
  return null;
}

async function searchAndFetch(title) {
  const q = encodeURIComponent(normalizeTitle(title));
  const searchUrls = [
    `https://www.metacritic.com/search/movie/${q}/results`,
    `https://r.jina.ai/http://www.metacritic.com/search/movie/${q}/results`,
    // Legacy search paths as fallbacks
    `https://www.metacritic.com/search/all/${q}/results?cats=movies`,
    `https://r.jina.ai/http://www.metacritic.com/search/all/${q}/results?cats=movies`,
  ];
  for (const url of searchUrls) {
    try {
      const html = await fetchText(url);
      const link = extractFirstMovieLinkFromSearch(html);
      if (link) {
        const slug = link.split("/movie/")[1];
        const res = await tryFetchMoviePageBySlug(slug);
        if (res) return res;
      }
    } catch (_) { /* continue */ }
  }
  return null;
}

async function getScoresForTitle(title) {
  const normalized = normalizeTitle(title);
  if (!normalized) return { critic: null, user: null };

  const cached = await getFromCache(normalized);
  if (cached) return { critic: cached.critic ?? null, user: cached.user ?? null };

  // Try direct slug guess first
  const slug = titleToSlug(title);
  let result = null;
  if (slug) {
    result = await tryFetchMoviePageBySlug(slug);
  }
  if (!result) {
    result = await searchAndFetch(title);
  }

  const finalResult = result || { critic: null, user: null };
  await setCache(normalized, finalResult);
  return finalResult;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === "GET_METACRITIC_SCORES") {
    const { title } = message;
    getScoresForTitle(title)
      .then((res) => sendResponse({ ok: true, data: res }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // indicates async response
  }
  return false;
});

