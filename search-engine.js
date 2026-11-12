// ==========================================
// SEARCH ENGINE MODULE (Thumbnails, History & Pre-fetch)
// ==========================================
let searchTimeout = null;

function handleSearchInput(query) {
  clearTimeout(searchTimeout);
  const box = document.getElementById('suggestionsBox');
  if (!box) return;

  if (!query.trim()) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }

  if (!history.state || history.state.view !== 'search') {
    history.pushState({ view: 'search', query: query }, '', '');
  } else {
    history.replaceState({ view: 'search', query: query }, '', '');
  }

  searchTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`https://${selectedAppLang}.wikipedia.org/w/api.php?action=query&generator=prefixsearch&gpssearch=${encodeURIComponent(query)}&gpslimit=6&prop=pageimages|description&piprop=thumbnail&pithumbsize=100&format=json&origin=*`);
      const data = await res.json();
      
      if (data.query && data.query.pages) {
        const pages = Object.values(data.query.pages).sort((a, b) => a.index - b.index);
        let html = '';
        
        clearPreviousSearchCache();

        pages.forEach(page => {
          const title = page.title;
          const desc = page.description || (selectedAppLang === 'hi' ? 'विकिपीडिया लेख' : 'Wikipedia article');
          const thumb = page.thumbnail ? page.thumbnail.source : '';

          preFetchArticleInBackground(title, selectedAppLang);

          html += `
            <div onclick="selectSuggestion('${title.replace(/'/g, "\\'")}', '${selectedAppLang}')" class="suggestion-item px-4 py-3 cursor-pointer border-b border-zinc-800 last:border-none flex items-center space-x-3">
              <div class="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                ${thumb ? `<img src="${thumb}" loading="lazy" class="w-full h-full object-cover">` : `<svg class="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>`}
              </div>
              <div class="overflow-hidden">
                <div class="text-sm font-semibold text-white truncate">${title}</div>
                <div class="text-xs text-gray-400 truncate">${desc}</div>
              </div>
            </div>
          `;
        });

        box.innerHTML = html;
        box.classList.remove('hidden');
      } else {
        box.classList.add('hidden');
      }
    } catch (e) {
      console.error("Search error", e);
    }
  }, 300);
}

// Background Speculative Pre-fetching & Cleanup
let activeSearchCacheKeys = [];

async function preFetchArticleInBackground(title, lang) {
  const cacheKey = typeof CACHE_KEYS !== 'undefined' ? `${CACHE_KEYS.ARTICLE_PREFIX}_${lang}_${title}` : `article_${lang}_${title}`;
  
  if (!activeSearchCacheKeys.includes(cacheKey)) {
    activeSearchCacheKeys.push(cacheKey);
  }

  if (localStorage.getItem(cacheKey)) return;

  try {
    const summaryRes = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!summaryRes.ok) return;
    const summaryData = await summaryRes.json();

    const contentRes = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&format=json&origin=*&prop=text|images`);
    const contentData = await contentRes.json();

    if (contentData.parse) {
      const rawHtml = contentData.parse.text['*'];
      if (typeof saveToCache === 'function') {
        saveToCache(cacheKey, { summary: summaryData, rawHtml: rawHtml });
      }
    }
  } catch (err) {}
}

function clearPreviousSearchCache() {
  activeSearchCacheKeys.forEach(key => {
    localStorage.removeItem(key);
  });
  activeSearchCacheKeys = [];
}

function selectSuggestion(title, lang) {
  const searchInput = document.getElementById('searchInput');
  const suggestionsBox = document.getElementById('suggestionsBox');
  if (searchInput) searchInput.value = title;
  if (suggestionsBox) suggestionsBox.classList.add('hidden');
  openArticle(title, lang, true);
}

function executeSearch(query) {
  if (!query.trim()) return;
  const suggestionsBox = document.getElementById('suggestionsBox');
  if (suggestionsBox) suggestionsBox.classList.add('hidden');
  openArticle(query, selectedAppLang, true);
}
