/*
  Content script: scans Cinemark Hoyts pages for movie tiles and injects
  Metacritic critic and user score badges in the top-right corner of each tile.
*/

(function () {
  const BADGE_CLASS = "ch-mc-badge";
  const BADGE_WRAPPER_CLASS = "ch-mc-badge-wrapper";
  const SCANNED_ATTR = "data-ch-mc-scanned";

  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function selectTitleFromCard(card) {
    console.log("selectTitleFromCard", card);
    
    // Prefer explicit movie link with title attribute
    const explicitLinkText = card.title;
    if (explicitLinkText) {
      console.log("explicitLinkText", explicitLinkText);
      return explicitLinkText.trim();
    }
    return "";
  }

  function findMovieCards() {
    const candidates = new Set();
    // Common patterns on cinemarkhoyts.com.ar for movie/listing/detail tiles
    const linkNodes = document.querySelectorAll(
      "a[data-testid='movie-link'][href^='/pelicula/']"
    );
    linkNodes.forEach((a) => {
      const card = a.closest("article, li, .card, .movie, .pelicula, .grid-item, .swiper-slide, .slick-slide, .card-body, .card-container");
      if (card) {
        candidates.add(card);
      } else {
        // Treat the anchor as the card if no parent container exists
        candidates.add(a);
      }
    });

    // Also consider visible images with alt text (covers)
    const imgs = document.querySelectorAll("img[alt]");
    imgs.forEach((img) => {
      const card = img.closest("article, li, .card, .movie, .pelicula, .grid-item, .swiper-slide, .slick-slide, .card-body, .card-container");
      if (card) {
        candidates.add(card);
      }
    });

    console.log("candidates", candidates);

    // Filter only those with a plausible title
    return Array.from(candidates).filter((card) => selectTitleFromCard(card));
  }

  function ensurePositioning(card) {
    const style = window.getComputedStyle(card);
    if (style.position === "static") {
      card.style.position = "relative";
    }
  }

  function createBadgeWrapper(card) {
    let wrapper = card.querySelector(`.${BADGE_WRAPPER_CLASS}`);
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = BADGE_WRAPPER_CLASS;
      card.appendChild(wrapper);
    }
    return wrapper;
  }

  function scoreToColor(score100) {
    if (score100 == null || isNaN(score100)) return "#888";
    if (score100 >= 61) return "#2ecc71"; // green
    if (score100 >= 40) return "#f1c40f"; // yellow
    return "#e74c3c"; // red
  }

  function renderBadge(wrapper, title, critic, user) {
    // critic 0-100, user 0-10; we render both as-is but color by 100-scale
    const criticColor = scoreToColor(typeof critic === "number" ? critic : null);
    const user100 = typeof user === "number" ? Math.round(user * 10) : null;
    const userColor = scoreToColor(user100);

    wrapper.innerHTML = "";

    const container = document.createElement("div");
    container.className = BADGE_CLASS;
    container.title = `Metacritic scores for ${title}`;

    const criticEl = document.createElement("div");
    criticEl.className = "ch-mc-pill ch-mc-critic";
    criticEl.style.backgroundColor = criticColor;
    criticEl.textContent = critic != null ? `MC ${critic}` : "MC …";

    const userEl = document.createElement("div");
    userEl.className = "ch-mc-pill ch-mc-user";
    userEl.style.backgroundColor = userColor;
    userEl.textContent = user != null ? `USER ${user.toFixed(1)}` : "USER …";

    container.appendChild(criticEl);
    container.appendChild(userEl);
    wrapper.appendChild(container);
  }

  function requestScores(title) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_METACRITIC_SCORES", title }, (resp) => {
        if (!resp || !resp.ok) return resolve({ critic: null, user: null });
        resolve(resp.data || { critic: null, user: null });
      });
    });
  }

  async function processCard(card) {
    if (card.getAttribute(SCANNED_ATTR) === "1") return;
    const title = selectTitleFromCard(card);
    console.log("processCard", title);
    if (!title) return;
    ensurePositioning(card);
    const wrapper = createBadgeWrapper(card);
    renderBadge(wrapper, title, null, null); // show placeholders
    card.setAttribute(SCANNED_ATTR, "1");
    const { critic, user } = await requestScores(title);
    renderBadge(wrapper, title, critic, user);
  }

  const scanAll = debounce(() => {
    const cards = findMovieCards();
    console.log("scanAll cards", cards);
    cards.forEach(processCard);
  }, 200);

  console.log("scanAll");
  // Initial scan
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scanAll);
    console.log("scanAll document.readyState === 'loading'");
  } else {
    console.log("scanAll else");
    scanAll();
  }

  // Observe dynamic content changes
  console.log("scanAll observer");
  /*const observer = new MutationObserver(() => scanAll());
  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });*/
})();

