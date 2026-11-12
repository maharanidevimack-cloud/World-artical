// ==========================================
// 1. CACHE & STORAGE MANAGER
// ==========================================
const CACHE_KEYS = {
  HOME_FEED: 'wiki_minimal_home_feed_v1',
  ARTICLE_PREFIX: 'wiki_article_'
};

// Save data to localStorage safely
function saveToCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({
      timestamp: Date.now(),
      data: data
    }));
  } catch (e) {
    console.warn("Cache storage full or disabled", e);
  }
}

// Get data from localStorage
function getFromCache(key) {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    return parsed.data;
  } catch (e) {
    console.warn("Error reading cache", e);
    return null;
  }
}

// Clear old article cache if needed
function clearArticleCache() {
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(CACHE_KEYS.ARTICLE_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
}
