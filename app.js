// ==========================================
// 3. MAIN APP ENGINE (Clean Normal Reader + Top Contents Box)
// ==========================================
let isFetchingMore = false;
let selectedAppLang = 'en';
let selectedAppLangName = 'English';
let currentActiveArticleTitle = '';

window.onload = () => {
  if (typeof initAudioEngine === 'function') initAudioEngine();
  loadHomeFeedWithCacheFirst();
  setupInfiniteScroll();

  // Handle Mobile / Browser Back Button (Step-by-Step Navigation)
  window.onpopstate = (event) => {
    const state = event.state;
    if (!state || state.view === 'home') {
      if (typeof stopSpeech === 'function') stopSpeech();
      const audioBar = document.getElementById('audioPlayerBar');
      const reader = document.getElementById('readerView');
      const home = document.getElementById('homeView');
      const box = document.getElementById('suggestionsBox');
      const searchInput = document.getElementById('searchInput');

      if (audioBar) audioBar.classList.add('hidden');
      if (reader) reader.classList.add('hidden');
      if (home) home.classList.remove('hidden');
      if (box) box.classList.add('hidden');
      if (searchInput) searchInput.value = '';
    } else if (state.view === 'search') {
      if (typeof stopSpeech === 'function') stopSpeech();
      const audioBar = document.getElementById('audioPlayerBar');
      const reader = document.getElementById('readerView');
      const home = document.getElementById('homeView');
      const searchInput = document.getElementById('searchInput');

      if (audioBar) audioBar.classList.add('hidden');
      if (reader) reader.classList.add('hidden');
      if (home) home.classList.remove('hidden');
      if (searchInput) searchInput.value = state.query || '';
      if (state.query && typeof handleSearchInput === 'function') {
        handleSearchInput(state.query);
      }
    } else if (state.view === 'article') {
      openArticle(state.title, state.lang, false);
    }
  };

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#searchInput') && !e.target.closest('#suggestionsBox')) {
      const box = document.getElementById('suggestionsBox');
      if (box) box.classList.add('hidden');
    }
  });
};

// Language Modal Controls
function openLanguageModal() {
  const modal = document.getElementById('languageModal');
  if (modal) modal.classList.remove('hidden');
}

function closeLanguageModal(e) {
  const modal = document.getElementById('languageModal');
  if (!modal) return;
  if (!e || e.target.id === 'languageModal' || e.target.closest('button')) {
    modal.classList.add('hidden');
  }
}

function setAppLanguage(langCode, langName) {
  selectedAppLang = langCode;
  selectedAppLangName = langName;
  
  const langBtnText = document.getElementById('langButtonText');
  if (langBtnText) langBtnText.innerText = langName;

  const articleLangText = document.getElementById('articleLangText');
  if (articleLangText) articleLangText.innerText = langName;
  
  closeLanguageModal();

  const readerView = document.getElementById('readerView');
  if (readerView && !readerView.classList.contains('hidden') && currentActiveArticleTitle) {
    switchToArticleLanguage(currentActiveArticleTitle, langCode);
  } else {
    if (typeof CACHE_KEYS !== 'undefined') {
      localStorage.removeItem(`${CACHE_KEYS.HOME_FEED}_${selectedAppLang}`);
    }
    loadHomeFeedWithCacheFirst();
  }
}

async function switchToArticleLanguage(title, targetLang) {
  showLoader(true);
  try {
    const langLinkRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=langlinks&lllang=${targetLang}&format=json&origin=*`);
    const langData = await langLinkRes.json();
    const pages = langData.query?.pages;
    
    let targetTitle = title;
    if (pages) {
      const pageId = Object.keys(pages)[0];
      const langlinks = pages[pageId]?.langlinks;
      if (langlinks && langlinks.length > 0) {
        targetTitle = langlinks[0]['*'];
      }
    }
    openArticle(targetTitle, targetLang, false);
  } catch (err) {
    console.error("Language switch error:", err);
    openArticle(title, targetLang, false);
  } finally {
    showLoader(false);
  }
}

async function fetchTrendingArticles() {
  try {
    const today = new Date();
    const year = today.getUTCFullYear();
    const month = String(today.getUTCMonth() + 1).padStart(2, '0');
    const day = String(today.getUTCDate() - 1).padStart(2, '0');

    const res = await fetch(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${selectedAppLang}.wikipedia/all-access/${year}/${month}/${day}`);
    if (!res.ok) throw new Error('Trending API error');
    const data = await res.json();

    if (data.items && data.items[0] && data.items[0].articles) {
      let topArticles = data.items[0].articles
        .filter(art => !art.article.includes(':') && !['Main_Page', 'Special:Search', 'Search'].includes(art.article))
        .slice(0, 12);

      const detailedArticles = [];
      for (let item of topArticles) {
        try {
          const sumRes = await fetch(`https://${selectedAppLang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(item.article)}`);
          if (sumRes.ok) {
            const sumData = await sumRes.json();
            if (sumData.title && sumData.extract) {
              detailedArticles.push(sumData);
            }
          }
        } catch (err) {}
        if (detailedArticles.length >= 6) break;
      }

      if (detailedArticles.length > 0) return detailedArticles;
    }
  } catch (e) {
    console.warn("Trending fetch failed, falling back to random:", e);
  }

  try {
    const res = await fetch(`https://${selectedAppLang}.wikipedia.org/w/api.php?action=query&generator=random&grnnamespace=0&grnlimit=6&prop=pageimages|extracts&exintro=1&explaintext=1&exchars=200&piprop=thumbnail&pithumbsize=500&format=json&origin=*`);
    const data = await res.json();
    if (data.query && data.query.pages) {
      return Object.values(data.query.pages);
    }
  } catch (err) {
    console.error("Fallback error:", err);
  }
  return [];
}

async function loadHomeFeedWithCacheFirst() {
  const feedGrid = document.getElementById('feedGrid');
  if (!feedGrid) return;

  const cacheKey = typeof CACHE_KEYS !== 'undefined' ? `${CACHE_KEYS.HOME_FEED}_${selectedAppLang}` : `home_feed_${selectedAppLang}`;
  const cachedFeed = typeof getFromCache === 'function' ? getFromCache(cacheKey) : null;
  
  if (cachedFeed && cachedFeed.length > 0) {
    renderFeedCards(cachedFeed, false);
  } else {
    showLoader(true);
  }

  const freshArticles = await fetchTrendingArticles();
  if (freshArticles.length > 0) {
    if (typeof saveToCache === 'function') {
      saveToCache(cacheKey, freshArticles);
    }
    renderFeedCards(freshArticles, cachedFeed ? false : true);
  }
  
  showLoader(false);
}

function renderFeedCards(articles, animate = false) {
  const feedGrid = document.getElementById('feedGrid');
  if (!feedGrid) return;
  feedGrid.innerHTML = '';

  articles.forEach(art => {
    const card = document.createElement('div');
    card.className = "article-card p-4 rounded-2xl cursor-pointer flex flex-col justify-between transition-all duration-300";
    if (animate) card.classList.add('opacity-0', 'translate-y-2');
    
    card.onclick = () => openArticle(art.title, selectedAppLang, true);
    const imgUrl = art.thumbnail ? art.thumbnail.source : (art.originalimage ? art.originalimage.source : '');

    card.innerHTML = `
      <div>
        ${imgUrl ? `<div class="w-full h-40 mb-3 overflow-hidden rounded-xl bg-zinc-900 flex items-center justify-center"><img src="${imgUrl}" loading="lazy" class="w-full h-full object-cover" alt="${art.title}"></div>` : ''}
        <h3 class="text-lg font-bold text-white mb-1.5">${art.title}</h3>
        <p class="text-gray-400 text-xs line-clamp-3 leading-relaxed">${art.extract || 'Tap to read full article...'}</p>
      </div>
      <div class="mt-3 flex items-center text-xs font-semibold text-blue-400">
        Read Full Article →
      </div>
    `;
    feedGrid.appendChild(card);
    
    if (animate) {
      setTimeout(() => {
        card.classList.remove('opacity-0', 'translate-y-2');
      }, 50);
    }
  });
}

function setupInfiniteScroll() {
  window.addEventListener('scroll', async () => {
    const readerView = document.getElementById('readerView');
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
      if (!isFetchingMore && readerView && readerView.classList.contains('hidden')) {
        isFetchingMore = true;
        showLoader(true);
        const newArticles = await fetchTrendingArticles();
        newArticles.slice(0, 4).forEach(art => renderSingleCard(art));
        showLoader(false);
        isFetchingMore = false;
      }
    }
  });
}

function renderSingleCard(art) {
  const feedGrid = document.getElementById('feedGrid');
  if (!feedGrid) return;

  const card = document.createElement('div');
  card.className = "article-card p-4 rounded-2xl cursor-pointer flex flex-col justify-between";
  card.onclick = () => openArticle(art.title, selectedAppLang, true);
  const imgUrl = art.thumbnail ? art.thumbnail.source : (art.originalimage ? art.originalimage.source : '');

  card.innerHTML = `
    <div>
      ${imgUrl ? `<div class="w-full h-40 mb-3 overflow-hidden rounded-xl bg-zinc-900 flex items-center justify-center"><img src="${imgUrl}" loading="lazy" class="w-full h-full object-cover"></div>` : ''}
      <h3 class="text-lg font-bold text-white mb-1.5">${art.title}</h3>
      <p class="text-gray-400 text-xs line-clamp-3 leading-relaxed">${art.extract || ''}</p>
    </div>
    <div class="mt-3 flex items-center text-xs font-semibold text-blue-400">Read Full Article →</div>
  `;
  feedGrid.appendChild(card);
}

async function openArticle(title, lang = 'en', pushHistory = true) {
  showLoader(true);
  if (typeof stopSpeech === 'function') stopSpeech();
  
  currentActiveArticleTitle = title;
  const articleLangText = document.getElementById('articleLangText');
  if (articleLangText) articleLangText.innerText = selectedAppLangName;

  const homeView = document.getElementById('homeView');
  const suggestionsBox = document.getElementById('suggestionsBox');
  if (homeView) homeView.classList.add('hidden');
  if (suggestionsBox) suggestionsBox.classList.add('hidden');

  if (pushHistory) {
    history.pushState({ view: 'article', title: title, lang: lang }, '', '');
  }

  const cacheKey = typeof CACHE_KEYS !== 'undefined' ? `${CACHE_KEYS.ARTICLE_PREFIX}_${lang}_${title}` : `article_${lang}_${title}`;
  const cachedArticle = typeof getFromCache === 'function' ? getFromCache(cacheKey) : null;

  if (cachedArticle) {
    renderReader(cachedArticle.summary, cachedArticle.rawHtml, lang);
    showLoader(false);
    return;
  }

  try {
    const summaryRes = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!summaryRes.ok) throw new Error('Not found');
    const summaryData = await summaryRes.json();

    const contentRes = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&format=json&origin=*&prop=text|images`);
    const contentData = await contentRes.json();

    if (contentData.parse) {
      const rawHtml = contentData.parse.text['*'];
      if (typeof saveToCache === 'function') {
        saveToCache(cacheKey, { summary: summaryData, rawHtml: rawHtml });
      }
      renderReader(summaryData, rawHtml, lang);
    } else {
      alert('Article not found!');
      resetToHome();
    }
  } catch (err) {
    console.error(err);
    alert('Failed to load article.');
    resetToHome();
  } finally {
    showLoader(false);
  }
}

// CLEAN READER WITH TOP CONTENTS BOX (No boxes in content, clean text view)
function renderReader(summary, rawHtml, lang) {
  const articleTitle = document.getElementById('articleTitle');
  const articleDescription = document.getElementById('articleDescription');
  const sourceTag = document.getElementById('sourceTag');
  const audioPlayerBar = document.getElementById('audioPlayerBar');

  if (articleTitle) articleTitle.innerText = summary.title;
  if (articleDescription) articleDescription.innerText = summary.description || '';
  if (sourceTag) sourceTag.innerText = `${lang.toUpperCase()} WIKIPEDIA SOURCE`;
  if (audioPlayerBar) audioPlayerBar.classList.remove('hidden');

  const heroImgContainer = document.getElementById('heroImageContainer');
  const heroImg = document.getElementById('heroImage');

  if (heroImg && heroImgContainer) {
    if (summary.originalimage) {
      heroImg.src = summary.originalimage.source;
      heroImgContainer.classList.remove('hidden');
    } else if (summary.thumbnail) {
      heroImg.src = summary.thumbnail.source;
      heroImgContainer.classList.remove('hidden');
    } else {
      heroImgContainer.classList.add('hidden');
    }
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  // Remove Wikipedia junk, infoboxes, navboxes, references, etc.
  doc.querySelectorAll('.mw-editsection, .infobox, .navbox, .sidebar, .reflist, .reference, .noprint, #toc, .toc, .portal, .ambox, .sistersitebox, .metadata, .catlinks, .printfooter, .mw-hidden-catlinks').forEach(el => el.remove());

  doc.querySelectorAll('a').forEach(a => {
    a.removeAttribute('href');
    a.style.color = '#f5f5f7';
    a.style.textDecoration = 'none';
  });

  doc.querySelectorAll('img').forEach(img => {
    let src = img.getAttribute('src');
    if (src && src.startsWith('//')) img.setAttribute('src', 'https:' + src);
    else if (src && src.startsWith('/')) img.setAttribute('src', `https://${lang}.wikipedia.org` + src);
    
    img.className = "article-inline-image mx-auto my-6 rounded-2xl max-w-full h-auto object-contain border border-zinc-800 shadow-lg block cursor-zoom-in";
    img.loading = "lazy";
    img.onclick = (e) => { 
      e.stopPropagation(); 
      if (typeof openImageModal === 'function') openImageModal(img.src); 
    };
  });

  const unwantedHeadings = [
    'सन्दर्भ', 'references', 'external links', 'notes', 'see also', 
    'इन्हें भी देखें', 'बाहरी कड़ियाँ', 'टिप्पणी', 'sources', 
    'bibliography', 'further reading', 'references and notes', 
    'external links and resources', 'sister projects', 'references cited',
    'references & notes', 'footnotes', 'reference notes', 'gallery'
  ];

  // Remove unwanted sections and everything after them from the DOM completely
  const allHeadings = doc.body.querySelectorAll('h2, h3');
  allHeadings.forEach(h => {
    let t = h.innerText ? h.innerText.replace(/\[edit\]/g, '').trim().toLowerCase() : '';
    if (unwantedHeadings.some(bad => t.includes(bad))) {
      let curr = h;
      while (curr) {
        let nxt = curr.nextElementSibling;
        curr.remove();
        curr = nxt;
      }
    }
  });

  // BUILD TOP CONTENTS BOX (Table of Contents)
  const tocList = document.getElementById('tocList');
  const tocBox = document.getElementById('tableOfContentsBox');
  const sideIndex = document.getElementById('sideScrollIndex');

  if (tocList) tocList.innerHTML = '';
  if (sideIndex) sideIndex.innerHTML = '';

  const validHeadings = Array.from(doc.body.querySelectorAll('h2'));

  if (validHeadings.length > 0 && tocBox) {
    tocBox.classList.remove('hidden');
    if (sideIndex) sideIndex.classList.add('hidden'); // Keep side dots hidden for clean look

    validHeadings.forEach((h2, index) => {
      const headingText = h2.innerText.replace(/\[edit\]/g, '').trim();
      if (!headingText) return;
      const sectionId = `section-${index}`;
      h2.id = sectionId; // Assign id to heading for smooth scrolling

      const tocItem = document.createElement('div');
      tocItem.className = "text-gray-300 hover:text-blue-400 cursor-pointer truncate py-1 px-2 rounded-lg hover:bg-zinc-800/55 transition text-xs flex items-center space-x-2";
      tocItem.innerHTML = `<span class="text-blue-400">•</span> <span class="truncate">${headingText}</span>`;
      tocItem.onclick = () => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      };
      tocList.appendChild(tocItem);
    });
  } else {
    if (tocBox) tocBox.classList.add('hidden');
    if (sideIndex) sideIndex.classList.add('hidden');
  }

  const articleBody = document.getElementById('articleBody');
  const readerView = document.getElementById('readerView');
  if (articleBody) {
    articleBody.innerHTML = doc.body.innerHTML;
  }
  if (readerView) readerView.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeArticle() {
  window.history.back();
}

function resetToHome() {
  if (typeof stopSpeech === 'function') stopSpeech();
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  window.history.back();
}

function showLoader(show) {
  const loader = document.getElementById('loader');
  if (!loader) return;
  if (show) loader.classList.remove('hidden');
  else loader.classList.add('hidden');
  }
