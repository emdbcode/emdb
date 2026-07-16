// XP/Level helper shared across pages.
(function initEmdbXp() {
  if (window.EMDbXP) return;

  const SUPABASE_URL = 'https://lbxpucsgwgtamolvjuep.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxieHB1Y3Nnd2d0YW1vbHZqdWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTM1MjcsImV4cCI6MjA4NzA2OTUyN30.KvC6zRMZtE8owQiXleNqlQvaoKoYL-NQQJr0928K3iY';
  const XP_THRESHOLDS = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  const MAX_LEVEL = 11;

  function getClient() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') return null;
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  function calculateLevel(xp) {
    const safeXp = Math.max(0, Number(xp) || 0);
    const idx = Math.min(10, Math.floor(safeXp / 100));
    return Math.min(MAX_LEVEL, idx + 1);
  }

  function getLevelName(level) {
    const safeLevel = Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1));
    return safeLevel === MAX_LEVEL ? 'Stan' : `Level ${safeLevel}`;
  }

  function getProgress(xp) {
    const safeXp = Math.max(0, Number(xp) || 0);
    const level = calculateLevel(safeXp);
    if (level >= MAX_LEVEL) {
      return {
        level,
        currentXp: safeXp,
        currentLevelStartXp: XP_THRESHOLDS[MAX_LEVEL - 1],
        nextLevelXp: XP_THRESHOLDS[MAX_LEVEL - 1],
        progressInLevel: 0,
        neededInLevel: 0,
        isMax: true
      };
    }
    const currentLevelStartXp = XP_THRESHOLDS[level - 1];
    const nextLevelXp = XP_THRESHOLDS[level];
    return {
      level,
      currentXp: safeXp,
      currentLevelStartXp,
      nextLevelXp,
      progressInLevel: Math.max(0, safeXp - currentLevelStartXp),
      neededInLevel: Math.max(1, nextLevelXp - currentLevelStartXp),
      isMax: false
    };
  }

  async function awardXP(userId, amount, meta, clientOverride) {
    const xpAmount = Number(amount) || 0;
    if (!userId || xpAmount <= 0) return null;

    const client = clientOverride || getClient();
    if (!client) {
      console.warn('[XP] award skipped: Supabase unavailable', { userId, amount: xpAmount, meta: meta || null });
      return null;
    }

    const { data: profile, error: fetchError } = await client
      .from('profiles')
      .select('id, xp, level')
      .eq('id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('[XP] fetch profile failed', { userId, amount: xpAmount, error: fetchError, meta: meta || null });
      return null;
    }
    if (!profile) {
      console.warn('[XP] award skipped: profile missing', { userId, amount: xpAmount, meta: meta || null });
      return null;
    }

    const currentXp = Math.max(0, Number(profile.xp) || 0);
    const newXp = currentXp + xpAmount;
    const newLevel = calculateLevel(newXp);

    const { error: updateError } = await client
      .from('profiles')
      .update({
        xp: newXp,
        level: newLevel,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('[XP] update profile failed', {
        userId,
        amount: xpAmount,
        fromXp: currentXp,
        toXp: newXp,
        fromLevel: Number(profile.level) || calculateLevel(currentXp),
        toLevel: newLevel,
        error: updateError,
        meta: meta || null
      });
      return null;
    }

    const fromLevel = Number(profile.level) || calculateLevel(currentXp);
    console.log('[XP] XP awarded', {
      userId,
      amount: xpAmount,
      fromXp: currentXp,
      toXp: newXp,
      fromLevel,
      toLevel: newLevel,
      levelChanged: newLevel !== fromLevel,
      meta: meta || null
    });

    console.log('[XP] before/after', {
      userId,
      xpBefore: currentXp,
      xpAfter: newXp,
      levelBefore: fromLevel,
      levelAfter: newLevel
    });

    if (newLevel !== fromLevel) {
      console.log('[XP] level changed', {
        userId,
        fromLevel,
        toLevel: newLevel
      });
    }

    return { xp: newXp, level: newLevel };
  }

  window.EMDbXP = {
    XP_THRESHOLDS,
    MAX_LEVEL,
    calculateLevel,
    getLevelName,
    getProgress,
    awardXP
  };
})();

function getFileRootPrefix() {
  const path = String(window.location.pathname || '');
  const segments = path.split('/').filter(Boolean);
  const rootFolders = new Set([
    'releases', 'songs', 'charts', 'artists', 'collections', 'images',
    'legal', 'news', 'partials', 'scripts', 'samples', 'txt'
  ]);
  const rootIdx = segments.findIndex((seg) => rootFolders.has(seg));
  if (rootIdx === -1) return './';
  const depth = Math.max(0, segments.length - rootIdx - 1);
  return depth > 0 ? '../'.repeat(depth) : './';
}

function getPartialHref(name) {
  const clean = String(name || '').replace(/^\/+/, '');
  if (window.location.protocol !== 'file:') return `/partials/${clean}`;
  return `${getFileRootPrefix()}partials/${clean}`;
}

const HEADER_CACHE_KEY = 'emdb_header_partial_v1';

function getEmbeddedHeaderHtml() {
  return `
<header class="site-header">
  <div class="header-inner">
    <a class="brand" href="/">
      <img src="/images/logos/emdb-logo.png" alt="EMDb logo">
      <div class="logo-caption" id="logoCaption" aria-hidden="true">EMINEM MUSIC DATABASE</div>
    </a>

    <button class="menu-toggle" id="menuToggle" aria-expanded="false" aria-controls="menuPanel" aria-label="Toggle menu">
      <span class="menu-icon" aria-hidden="true">
        <span></span><span></span><span></span>
      </span>
    </button>

    <nav class="menu-inline" aria-label="Primary navigation">
      <a href="/news/news-index.html">News</a>
      <a href="/articles/articles-index.html">Articles</a>
      <a href="/releases/releases-index.html">Discography</a>
      <div class="menu-inline-group">
        <button class="menu-inline-parent" type="button" aria-expanded="false">Rankings ▾</button>
        <div class="menu-inline-sub" role="menu">
          <a href="/rankings/albums-ranked.html" role="menuitem">Albums Ranked</a>
          <a href="/rankings/top-100-eminem-songs.html" role="menuitem">Top 100 Eminem Songs</a>
          <a href="/rankings/top-100-eminem-features.html" role="menuitem">Top 100 Eminem Features</a>
          <a href="/rankings/all-songs-top-200.html" role="menuitem">All Songs Top 200</a>
        </div>
      </div>
      <div class="menu-inline-group">
        <button class="menu-inline-parent" type="button" aria-expanded="false">More ▾</button>
        <div class="menu-inline-sub" role="menu">
          <a href="/charts/awards.html" role="menuitem">Awards</a>
          <a href="/charts/index-charts.html" role="menuitem">Charts</a>
          <a href="/charts/index-critic-scores.html" role="menuitem">Critic Scores</a>
          <a href="/user-reviews/index-user-reviews.html" role="menuitem">User Reviews</a>
        </div>
      </div>
    </nav>

    <div class="search-wrap">
      <input
        type="search"
        id="siteSearch"
        placeholder="Search EMDb"
        aria-label="Search EMDb"
        autocomplete="off"
        autocapitalize="none"
        autocorrect="off"
        spellcheck="false"
        inputmode="search"
      >
      <div class="search-suggestions" id="searchSuggestions" role="listbox" aria-label="Search suggestions">
        <div class="suggestion-title">Popular</div>
        <button class="suggestion" role="option">Detroit Vs. Everybody</button>
        <button class="suggestion" role="option">The Eminem Show</button>
        <button class="suggestion" role="option">Royce da 5'9\"</button>
        <button class="suggestion" role="option">Top 100 Eminem Features</button>
      </div>
    </div>

    <div class="user-area" aria-label="User area">
      <a class="sign-in-btn" id="sign-in-btn" href="/sign-in.html">Sign in</a>
      <div id="profile-area" aria-live="polite"></div>
      <div class="user-avatar" id="userAvatar" aria-hidden="true"></div>
    </div>
  </div>

  <nav class="menu-panel" id="menuPanel" aria-label="Primary navigation">
    <button class="menu-close" id="menuClose" aria-label="Close menu">✕</button>
    <div class="menu-links">
      <a href="/news/news-index.html">News</a>
      <a href="/articles/articles-index.html">Articles</a>
      <a href="/releases/releases-index.html">Discography</a>
    </div>
    <div class="menu-group">
      <span class="menu-group-title">Rankings</span>
      <a href="/rankings/albums-ranked.html">Albums Ranked</a>
      <a href="/rankings/top-100-eminem-songs.html">Top 100 Eminem Songs</a>
      <a href="/rankings/top-100-eminem-features.html">Top 100 Eminem Features</a>
      <a href="/rankings/all-songs-top-200.html">All Songs Top 200</a>
    </div>
    <div class="menu-group">
      <span class="menu-group-title">More</span>
      <a href="/charts/awards.html">Awards</a>
      <a href="/charts/index-charts.html">Charts</a>
      <a href="/charts/index-critic-scores.html">Critic Scores</a>
      <a href="/user-reviews/index-user-reviews.html">User Reviews</a>
    </div>
    <div class="menu-social" aria-label="Social links">
      <a class="social-link" href="#" aria-label="Facebook">
        <img src="/images/logos/facebook-logo.png" alt="Facebook">
      </a>
      <a class="social-link" href="#" aria-label="Instagram">
        <img src="/images/logos/instagram-logo.png" alt="Instagram">
      </a>
      <a class="social-link" href="#" aria-label="X">
        <img src="/images/logos/x-logo.png" alt="X">
      </a>
      <a class="social-link" href="#" aria-label="YouTube">
        <img src="/images/logos/youtube-logo_2.png" alt="YouTube">
      </a>
    </div>
  </nav>
</header>`;
}

function readCachedHeaderHtml() {
  try {
    return localStorage.getItem(HEADER_CACHE_KEY) || '';
  } catch (err) {
    return '';
  }
}

function writeCachedHeaderHtml(html) {
  const next = String(html || '');
  if (!next) return;
  try {
    localStorage.setItem(HEADER_CACHE_KEY, next);
  } catch (err) {
    // Ignore cache write errors (private mode/quota limits).
  }
}

async function loadSiteHeader() {
  const container = document.getElementById('site-header');
  if (!container) return;

  const cachedHtml = readCachedHeaderHtml();
  const fallbackHtml = getEmbeddedHeaderHtml();
  const initialHtml = cachedHtml || fallbackHtml;
  const renderedFromLocal = !!initialHtml;

  if (renderedFromLocal) {
    container.innerHTML = initialHtml;
    initHeaderInteractions();
  }

  try {
    const response = await fetch(getPartialHref('header.html'));
    if (!response.ok) throw new Error('Failed to fetch header');
    const html = await response.text();
    writeCachedHeaderHtml(html);

    // Only render fetched markup when nothing local could be rendered immediately.
    if (!renderedFromLocal) {
      container.innerHTML = html;
      initHeaderInteractions();
    }
  } catch (error) {
    console.error('Header load error:', error);
  }
}

async function loadSiteFooter() {
  const container = document.getElementById('site-footer');
  if (!container) return;

  try {
    const response = await fetch(getPartialHref('footer.html'));
    if (!response.ok) throw new Error('Failed to fetch footer');
    const html = await response.text();
    container.innerHTML = html;
  } catch (error) {
    console.error('Footer load error:', error);
  }
}

function initHeaderInteractions() {
  (function ensureHeaderSignInStyles() {
    if (document.getElementById('emdb-signin-btn-style')) return;
    const style = document.createElement('style');
    style.id = 'emdb-signin-btn-style';
    style.textContent = [
      '.user-area .sign-in-btn {',
      '  background: transparent;',
      '  color: #E21C21;',
      '  border: 1px solid #E21C21;',
      '  border-radius: 8px;',
      '  padding: 8px 12px;',
      '  font-size: 13px;',
      '  text-decoration: none;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  transition: background-color 0.15s ease, color 0.15s ease, transform 0.12s ease;',
      '}',
      '.user-area .sign-in-btn:hover,',
      '.user-area .sign-in-btn:focus-visible {',
      '  background: #E21C21;',
      '  color: #fff;',
      '  transform: translateY(-1px);',
      '  text-decoration: none;',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  })();

  const menuToggle = document.getElementById('menuToggle');
  const menuPanel = document.getElementById('menuPanel');

  if (menuToggle && menuPanel) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menuPanel.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(open));
    });

    const menuClose = document.getElementById('menuClose');
    if (menuClose) {
      menuClose.addEventListener('click', (e) => {
        e.stopPropagation();
        menuPanel.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    }

    document.addEventListener('click', (e) => {
      if (!menuPanel.classList.contains('open')) return;
      if (!menuPanel.contains(e.target) && e.target !== menuToggle) {
        menuPanel.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        menuPanel.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const searchInput = document.getElementById('siteSearch');
  const searchSuggestions = document.getElementById('searchSuggestions');
  if (searchInput && searchSuggestions) {
    const openSuggestions = () => searchSuggestions.classList.add('open');
    const closeSuggestions = () => searchSuggestions.classList.remove('open');
    const STORAGE_KEY = 'emdb_search_index_v27';
    const STORAGE_META = 'emdb_search_index_meta_v27';
    const SEARCH_CACHE_SCHEMA_VERSION = 27;
    const SUPABASE_URL = 'https://lbxpucsgwgtamolvjuep.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxieHB1Y3Nnd2d0YW1vbHZqdWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTM1MjcsImV4cCI6MjA4NzA2OTUyN30.KvC6zRMZtE8owQiXleNqlQvaoKoYL-NQQJr0928K3iY';
    const RESULT_LIMIT = 500;
    const INDEX_BATCH_SIZE = 12;
    const TYPE_LABELS = ['Songs', 'Albums', 'Collections', 'Articles'];
    const DEFAULT_THUMB = '/images/logos/songs-with-cover.jpg';
    const COLLECTION_DEFAULT_COVER = '/images/logos/songs-with-cover.jpg';

    let searchIndex = null;
    let indexPromise = null;
    let lastResults = [];
    let lastFilter = 'All';
    let lastQuery = '';
    let suppressBlurClose = false;
    let searchRequestVersion = 0;
    let searchInputFrame = 0;

    let supabaseClient = null;
    let supabaseClientPromise = null;

    const storageGet = (key) => {
      try {
        return localStorage.getItem(key);
      } catch (err) {
        return null;
      }
    };

    const storageSet = (key, value) => {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (err) {
        return false;
      }
    };

    const storageRemove = (key) => {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        // ignore storage removal failures
      }
    };

    const isCacheLikelyComplete = (items) => {
      if (!Array.isArray(items)) return false;
      if (items.length < 200) return false;
      const songCount = items.reduce((count, item) => (
        item && item.type === 'Songs' ? count + 1 : count
      ), 0);
      const albumCount = items.reduce((count, item) => (
        item && item.type === 'Albums' ? count + 1 : count
      ), 0);
      return songCount >= 100 && albumCount >= 20;
    };

    const getSupabaseClient = async () => {
      if (supabaseClient) return supabaseClient;

      if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return supabaseClient;
      }

      if (!supabaseClientPromise) {
        supabaseClientPromise = (async () => {
          try {
            await new Promise((resolve, reject) => {
              const existing = document.querySelector('script[data-emdb-supabase="true"]');
              if (existing) {
                if (window.supabase && typeof window.supabase.createClient === 'function') {
                  resolve();
                  return;
                }
                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener('error', () => reject(new Error('Failed to load Supabase client')), { once: true });
                return;
              }

              const script = document.createElement('script');
              script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
              script.async = true;
              script.defer = true;
              script.dataset.emdbSupabase = 'true';
              script.addEventListener('load', () => resolve(), { once: true });
              script.addEventListener('error', () => reject(new Error('Failed to load Supabase client')), { once: true });
              document.head.appendChild(script);
            });
          } catch (err) {
            return null;
          }

          if (window.supabase && typeof window.supabase.createClient === 'function') {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            return supabaseClient;
          }
          return null;
        })();
      }

      return supabaseClientPromise;
    };

    const normalizeText = (text) => (text || '')
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

    const SYNONYMS = new Map([
      ['tupac', '2pac'],
      ['shakur', '2pac'],
      ['tupac shakur', '2pac'],
      ['andre young', 'dr dre'],
      ['curtis jackson', '50 cent'],
      ['kon artis', 'denaun porter'],
      ['mr porter', 'denaun porter'],
      ['denine porter', 'denaun porter'],
      ['mmlp', 'marshall mathers lp'],
      ['mmlp2', 'marshall mathers lp 2'],
      ['mtbmb', 'music to be murdered by'],
      ['doss', 'death of slim shady'],
      ['sslp', 'slim shady lp'],
      ['ssep', 'slim shady ep'],
      ['tes', 'eminem show'],
      ['deshaun', 'proof'],
      ['deshaun holton', 'proof'],
      ['deshaun dupree holton', 'proof'],
      ['skyler gray', 'skylar grey'],
      ['dina rey', 'dina rae'],
      ['dina ray', 'dina rae'],
      ['horseshoe gang', 'shoe gang'],
      ['shoe gang', 'horseshoe gang'],
      ['biggie', 'notorious b.i.g.'],
      ['christopher reeve', 'christopher reeves'],
      ['fbt', 'f.b.t.']
    ]);

    const ALBUM_QUERY_PREFERENCES = new Map([
      ['mmlp', ['marshall mathers lp', 'marshall mathers lp 2']],
      ['marshall mathers', ['marshall mathers lp', 'marshall mathers lp 2']],
      ['mmlp2', ['marshall mathers lp 2']],
      ['mtbmb', ['music to be murdered by']],
      ['doss', ['death of slim shady']],
      ['d12 world', ['d12 world']],
      ['kamikaze', ['kamikaze']],
      ['sslp', ['slim shady lp', 'slim shady ep']],
      ['tes', ['eminem show']],
      ['eminem', ['eminem show']]
    ]);

    const applySynonyms = (normalizedText) => {
      if (!normalizedText) return '';
      const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let expanded = normalizedText;
      SYNONYMS.forEach((target, source) => {
        const pattern = new RegExp(`\\b${escapeRegExp(source)}\\b`, 'g');
        expanded = expanded.replace(pattern, `${source} ${target}`);
      });
      return expanded;
    };

    const normalizeSearchAliasQuery = (query) => {
      const raw = String(query || '').trim();
      if (!raw) return '';
      if (/^swift$/i.test(raw)) {
        return 'Swifty McVay';
      }
      if (/^cashis$/i.test(raw)) {
        return 'Ca$his';
      }
      if (/^(?:stretch|streatch)\s+a(?:\b|$)/i.test(raw)) {
        return 'Stretch Armstrong';
      }
      if (/^encore\s+studios\s*\(\s*burbank\s*,\s*ca\s*\)$/i.test(raw)) {
        return 'Encore Studios';
      }
      return raw;
    };

    const shouldIncludeTrivia = (query) => {
      const normalizedQuery = normalizeText(query);
      if (!normalizedQuery) return false;
      const allowed = [
        'benzino',
        'ja rule',
        'canibus',
        'jermaine dupri',
        'everlast',
        'whitey ford',
        'insane clown posse',
        'limp bizkit',
        'fred durst',
        'guess whos back',
        'beef',
        'diss',
        'diss track',
        'kim',
        'kim scott',
        'hailie',
        'mother',
        'john guerra',
        'tyler the creator',
        'the source',
        'bugz'
      ];
      return allowed.some((term) => {
        if (term.startsWith('christopher reeve')) {
          return (
            normalizedQuery.length > 7
            && (normalizedQuery.includes(term) || term.startsWith(normalizedQuery))
          );
        }
        return (
          normalizedQuery.includes(term)
          || (normalizedQuery.length >= 3 && term.startsWith(normalizedQuery))
        );
      });
    };

    const shouldIncludeEncoreStudio = (query) => {
      const normalizedQuery = normalizeText(query);
      if (!normalizedQuery) return false;
      return (
        normalizedQuery.includes('encore studio')
        || normalizedQuery.includes('encore studios')
        || normalizedQuery.includes('burbank')
      );
    };

    const shouldIncludeMarshallsHouse = (query) => {
      const normalizedQuery = normalizeText(query);
      if (!normalizedQuery) return false;
      return (
        normalizedQuery.includes('marshalls house')
        || normalizedQuery.includes("marshalls house")
        || normalizedQuery.includes('detroit')
      );
    };

    const tokensFromText = (text) => {
      const normalized = applySynonyms(normalizeText(text));
      if (!normalized) return [];
      const tokens = normalized.split(' ').filter(Boolean);
      const uniq = Array.from(new Set(tokens));
      return uniq.slice(0, 2200);
    };

    const phraseTokensFromText = (text) => {
      const normalized = normalizeText(text);
      if (!normalized) return [];
      const words = normalized.split(' ').filter(Boolean);
      if (words.length < 2) return [];
      const phrases = new Set();
      const maxPhraseSize = 4;
      const maxPhrases = 900;
      for (let size = 2; size <= maxPhraseSize; size += 1) {
        for (let i = 0; i <= words.length - size; i += 1) {
          phrases.add(words.slice(i, i + size).join(' '));
          if (phrases.size >= maxPhrases) {
            return Array.from(phrases);
          }
        }
      }
      return Array.from(phrases);
    };

    const buildQueryTokens = (query) => {
      const normalizedQuery = normalizeText(query);
      if (!normalizedQuery) return [];
      const baseTokens = normalizedQuery.split(' ').filter(Boolean);
      const expandedTokens = new Set(tokensFromText(normalizedQuery));
      baseTokens.forEach((token) => expandedTokens.add(token));
      SYNONYMS.forEach((target, source) => {
        const sourceTokens = source.split(' ');
        const targetTokens = target.split(' ');
        const hasPrefix = baseTokens.some((token) => (
          token.length >= 3 && sourceTokens.some((part) => part.startsWith(token))
        ));
        if (hasPrefix) {
          targetTokens.forEach((targetToken) => expandedTokens.add(targetToken));
        }
      });
      return Array.from(expandedTokens);
    };

    const matchesTitleTarget = (normalizedTitle, target) => {
      if (!normalizedTitle || !target) return false;
      if (normalizedTitle === target) return true;
      const pattern = new RegExp(`\\b${target}\\b`);
      return pattern.test(normalizedTitle);
    };

    const getAlbumTargetsForQuery = (normalizedQuery) => {
      if (!normalizedQuery) return null;
      if (ALBUM_QUERY_PREFERENCES.has(normalizedQuery)) {
        return ALBUM_QUERY_PREFERENCES.get(normalizedQuery);
      }
      for (const [key, targets] of ALBUM_QUERY_PREFERENCES.entries()) {
        if (key.startsWith(normalizedQuery) && normalizedQuery.length >= 2) {
          return targets;
        }
      }
      return null;
    };

    const applyAlbumQueryBoosts = (normalizedQuery, entry) => {
      if (entry.item.type !== 'Albums') return entry;
      const albumTargets = getAlbumTargetsForQuery(normalizedQuery);
      if (!albumTargets) return entry;
      const normalizedTitle = normalizeText(entry.item.title);
      if (albumTargets.some((target) => matchesTitleTarget(normalizedTitle, target))) {
        return { ...entry, score: entry.score + 200 };
      }
      return entry;
    };

    const formatUrl = (slug, basePath) => {
      if (!slug) return '';
      if (slug.startsWith('http://') || slug.startsWith('https://')) return slug;
      let clean = slug.trim();
      if (clean.startsWith('/')) clean = clean.slice(1);
      const base = (basePath || '').replace(/^\/+/, '');
      const withHtml = clean.endsWith('.html') ? clean : `${clean}.html`;
      if (base && !withHtml.startsWith(base)) {
        return `/${base}${withHtml}`;
      }
      return `/${withHtml}`;
    };

    const getTypeBasePath = (type) => {
      if (type === 'Songs') return '/songs/';
      if (type === 'Albums') return '/releases/';
      if (type === 'Collections') return '/collections/';
      if (type === 'Articles') return '/news/';
      return '';
    };

    const normalizeResultUrl = (rawUrl, basePath = '') => {
      const raw = String(rawUrl || '').trim();
      if (!raw) return '';
      if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;

      let clean = raw
        .split('#')[0]
        .split('?')[0]
        .trim();

      while (clean.startsWith('./')) clean = clean.slice(2);
      while (clean.startsWith('../')) clean = clean.slice(3);
      clean = clean.replace(/^\/+/, '');

      const normalizedBase = String(basePath || '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');
      if (normalizedBase && !clean.includes('/')) {
        clean = `${normalizedBase}/${clean}`;
      }
      return `/${clean}`;
    };

    const getNavigationUrl = (item) => {
      const basePath = getTypeBasePath(item && item.type);
      return normalizeResultUrl(item && item.url, basePath);
    };

    const dedupeByUrl = (items) => {
      const seen = new Set();
      return items.filter((item) => {
        if (!item.url || seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      });
    };

    const groupByType = (items) => items.reduce((acc, item) => {
      const key = item.type || 'Other';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    const createFilterRow = (counts) => {
      const row = document.createElement('div');
      row.className = 'search-filters';
      const allCount = Object.values(counts).reduce((sum, value) => sum + value, 0);
      const options = ['All', ...TYPE_LABELS];
      options.forEach((label) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'search-filter';
        btn.setAttribute('data-filter', label);
        btn.setAttribute('aria-pressed', String(lastFilter === label));
        const count = label === 'All' ? allCount : (counts[label] || 0);
        btn.textContent = `${label} (${count})`;
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        btn.addEventListener('click', () => {
          lastFilter = label;
          renderResults(lastResults);
        });
        row.appendChild(btn);
      });
      return row;
    };

    const renderResults = (items, meta = {}) => {
      const shouldOpen = document.activeElement === searchInput || !!searchInput.value.trim();
      if (shouldOpen) openSuggestions();
      searchSuggestions.innerHTML = '';
      const counts = meta.counts || TYPE_LABELS.reduce((acc, type) => {
        acc[type] = items.filter((item) => item.type === type).length;
        return acc;
      }, {});

      searchSuggestions.appendChild(createFilterRow(counts));

      if (meta.status) {
        const status = document.createElement('div');
        status.className = 'suggestion-status';
        status.textContent = meta.status;
        searchSuggestions.appendChild(status);
      }

      if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'suggestion empty';
        empty.textContent = meta.emptyMessage || 'No matches found';
        empty.setAttribute('role', 'option');
        empty.setAttribute('aria-disabled', 'true');
        searchSuggestions.appendChild(empty);
        return;
      }

      const filtered = lastFilter === 'All'
        ? items
        : items.filter((item) => item.type === lastFilter);

      const grouped = groupByType(filtered);
      Object.keys(grouped).forEach((type) => {
        const title = document.createElement('div');
        title.className = 'suggestion-title';
        title.textContent = type;
        searchSuggestions.appendChild(title);

        grouped[type].forEach((item) => {
          const targetUrl = getNavigationUrl(item);
          if (!targetUrl) return;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'suggestion suggestion-item';
          btn.setAttribute('role', 'option');
          btn.dataset.url = targetUrl;

          const thumb = document.createElement('img');
          thumb.className = 'suggestion-thumb';
          thumb.src = item.cover_url || DEFAULT_THUMB;
          thumb.alt = '';
          thumb.loading = 'lazy';
          thumb.addEventListener('error', () => {
            if (thumb.dataset.fallbackApplied === 'true') {
              thumb.style.visibility = 'hidden';
              return;
            }
            thumb.dataset.fallbackApplied = 'true';
            thumb.src = DEFAULT_THUMB;
          });

          const meta = document.createElement('div');
          meta.className = 'suggestion-meta';

          const label = document.createElement('div');
          label.className = 'suggestion-label';
          label.textContent = item.title;

          const sub = document.createElement('div');
          sub.className = 'suggestion-sub';
          sub.textContent = item.type;

          meta.appendChild(label);
          meta.appendChild(sub);
          btn.appendChild(thumb);
          btn.appendChild(meta);
          btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            searchInput.value = item.title;
            window.location.href = targetUrl;
          });
          searchSuggestions.appendChild(btn);
        });
      });
    };

    const fetchAll = async (query) => {
      const results = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await query.range(from, from + pageSize - 1);
        if (error || !data || !data.length) break;
        results.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return results;
    };

    const fetchSongs = async () => {
      const fallbackFromSongsAZ = async () => {
        try {
          const response = await fetch('/collections/songs-a-z.html');
          if (!response.ok) return [];
          const html = await response.text();
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const links = Array.from(doc.querySelectorAll('li.song-row a'));
          return links
            .map((link) => ({
              title: (link.textContent || '').trim(),
              url: normalizeResultUrl(link.getAttribute('href') || '', '/songs/'),
              type: 'Songs',
              cover_url: ''
            }))
            .filter((item) => item.url && item.url.includes('/songs/'));
        } catch (err) {
          return [];
        }
      };

      const client = await getSupabaseClient();
      if (!client) return fallbackFromSongsAZ();
      const songs = await fetchAll(
        client
          .from('songs')
          .select('title,slug,cover_url,albums!inner(slug,cover_url)')
          .order('title', { ascending: true })
      );
      const albumSlugOverrides = {
        'non-album-tracks': 'non-album',
        'songs-featuring-eminem': 'feat',
        'production-discography': 'produced-only',
        'songs-underground-ep': 'underground-ep'
      };
      const mappedSongs = songs.map((song) => {
        const albumList = Array.isArray(song.albums)
          ? song.albums
          : (song.albums ? [song.albums] : []);
        const overrideAlbum = albumList.find((album) => album && albumSlugOverrides[album.slug]);
        const fallbackAlbum = albumList[0];
        const rawAlbumSlug = overrideAlbum
          ? overrideAlbum.slug
          : (fallbackAlbum && fallbackAlbum.slug ? fallbackAlbum.slug : '');
        const albumSlug = albumSlugOverrides[rawAlbumSlug] || rawAlbumSlug;
        const songSlug = song.slug || '';
        const url = albumSlug && songSlug ? `/songs/${albumSlug}/${songSlug}.html` : '';
        const albumCover = (overrideAlbum && overrideAlbum.cover_url)
          || (fallbackAlbum && fallbackAlbum.cover_url)
          || '';
        return {
          title: song.title,
          url,
          type: 'Songs',
          cover_url: song.cover_url || albumCover
        };
      }).filter((song) => song.url);

      if (mappedSongs.length) return mappedSongs;
      return fallbackFromSongsAZ();
    };

    const fetchAlbums = async () => {
      const fallbackFromReleasesIndex = async () => {
        try {
          const response = await fetch('/releases/releases-index.html');
          if (!response.ok) return [];
          const html = await response.text();
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const links = Array.from(doc.querySelectorAll('main a'));
          return links
            .map((link) => {
              const href = String(link.getAttribute('href') || '').trim();
              const title = String(link.textContent || '').trim();
              if (!href || !title) return null;
              if (!href.includes('/releases/')) return null;
              return {
                title,
                url: normalizeResultUrl(href, '/releases/'),
                type: 'Albums',
                cover_url: ''
              };
            })
            .filter(Boolean);
        } catch (err) {
          return [];
        }
      };

      const client = await getSupabaseClient();
      if (!client) return fallbackFromReleasesIndex();
      const albums = await fetchAll(
        client
          .from('albums')
          .select('title,slug,cover_url')
          .order('title', { ascending: true })
      );
      const excludedAlbumSlugs = new Set([
        'non-album',
        'feat',
        'produced-only',
        'non-album-tracks',
        'songs-featuring-eminem',
        'production-discography'
      ]);
      const excludedAlbumTitles = new Set([
        'non album',
        'non album tracks',
        'songs featuring eminem',
        'production discography'
      ]);
      const mappedAlbums = albums
        .filter((album) => {
          const slug = (album.slug || '').toLowerCase();
          if (excludedAlbumSlugs.has(slug)) return false;
          const normalizedTitle = normalizeText(album.title || '');
          if (excludedAlbumTitles.has(normalizedTitle)) return false;
          return true;
        })
        .map((album) => ({
        title: album.title,
        url: formatUrl(album.slug, '/releases/'),
        type: 'Albums',
        cover_url: album.cover_url || ''
        }));

      if (mappedAlbums.length) return mappedAlbums;
      return fallbackFromReleasesIndex();
    };

    const fetchArticles = async () => {
      const client = await getSupabaseClient();
      if (!client) return [];
      const { data, error } = await client
        .from('articles')
        .select('title,slug,cover_url,published_at,content,excerpt')
        .order('published_at', { ascending: false });
      if (error || !data) return [];
      return data
        .filter((article) => article.published_at)
        .map((article) => ({
          title: article.title,
          url: formatUrl(article.slug, '/news/'),
          type: 'Articles',
          cover_url: article.cover_url || '',
          content: article.content || article.excerpt || ''
        }));
    };

    const fetchCollections = async () => {
      try {
        const response = await fetch('/releases/releases-index.html');
        if (!response.ok) return [];
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const isCollectionHref = (href) => {
          const value = String(href || '').trim().toLowerCase();
          if (!value) return false;
          if (value.startsWith('http://') || value.startsWith('https://')) {
            return value.includes('/collections/');
          }
          return value.includes('/collections/') || value.startsWith('collections/');
        };
        const links = Array.from(doc.querySelectorAll('main a'))
          .map((link) => ({
            title: (link.textContent || '').trim(),
            href: String(link.getAttribute('href') || '').trim()
          }))
          .filter((item) => item.title && isCollectionHref(item.href))
          .map((item) => ({
            title: item.title,
            url: normalizeResultUrl(item.href, '/collections/')
          }));
        return links.map((item) => ({
          title: item.title,
          url: item.url,
          type: 'Collections',
          cover_url: COLLECTION_DEFAULT_COVER
        }));
      } catch (err) {
        return [];
      }
    };

    const fetchPageText = async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) return { text: '', triviaText: '', encoreStudioText: '', marshallsHouseText: '', creditsText: '', coverUrl: '' };
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const resolveCoverUrl = () => {
          const og = doc.querySelector('meta[property="og:image"]')?.getAttribute('content')
            || doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
          const image = og
            || doc.querySelector('.song-cover img')?.getAttribute('src')
            || doc.querySelector('.release-cover img')?.getAttribute('src')
            || doc.querySelector('main img')?.getAttribute('src')
            || '';
          if (!image) return '';
          if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/')) {
            return image;
          }
          return `/${image.replace(/^\/+/, '')}`;
        };
        const coverUrl = resolveCoverUrl();
        doc.querySelectorAll('script, style, noscript').forEach((node) => node.remove());
        const triviaParts = [];
        const headings = Array.from(doc.querySelectorAll('h3'));
        headings.forEach((heading) => {
          const headingText = normalizeText(heading.textContent);
          if (!headingText) return;
          const section = heading.closest('.song-extra') || heading.parentElement;
          if (!section) return;
          if (headingText.includes('trivia')) {
            if (section.textContent) triviaParts.push(section.textContent);
            section.remove();
            return;
          }
          if (headingText.includes('words from')) {
            section.remove();
          }
        });
        doc.querySelectorAll('.lyrics-section').forEach((node) => node.remove());
        const main = doc.querySelector('main') || doc.body;
        const textSources = [];
        if (main && main.textContent) textSources.push(main.textContent);
        const sampleBlocks = doc.querySelectorAll('.song-samples, .sample-entry, .sample-title');
        sampleBlocks.forEach((block) => {
          if (block.textContent) textSources.push(block.textContent);
        });

        // Capture structured credit names so person searches can match exactly.
        const creditValues = [];
        doc.querySelectorAll('.album-artist, .meta-name, .written-by .meta-value, .credit-pair .meta-value').forEach((node) => {
          const value = String(node.textContent || '').trim();
          if (value) creditValues.push(value);
        });

        const joinedText = textSources.join(' ') || '';
        const creditsText = creditValues.join(' ');
        const encoreStudioText = /encore studios\s*\(burbank,\s*ca\)/i.test(joinedText)
          ? 'Encore Studios (Burbank, CA)'
          : '';
        const marshallsHouseText = /marshall[’']?s house\s*\(detroit,\s*mi\)/i.test(joinedText)
          ? "Marshall's House (Detroit, MI)"
          : '';
        const albumCreditExclusions = [
          'From Encore',
          'From The Eminem Show',
          'From The Slim Shady LP',
          'From 8 Mile (Music from and Inspired by the Motion Picture)',
          'From 8 Mile (soundtrack)',
          'From Devil’s Night (Special Edition)',
          'From Music To Be Murdered By',
          'From Kamikaze',
          'From Hell: The Sequel',
          'From Music To Be Murdered By: Side B (Deluxe Edition)',
          'From Recovery',
          'From Revival',
          'From Southpaw (Music From And Inspired By The Motion Picture)',
          'From Southpaw (soundtrack)',
          'From Curtain Call: The Hits',
          'From Devil’s Night',
          'From Eminem Presents: The Re-Up',
          'From Slaughterhouse’s album Welcome To: Our House',
          'From 50 Cent’s album Get Rich or Die Tryin’',
          'From D12 World',
          'From Obie Trice’s album Second Round’s On Me',
          'From Obie Trice’s album Cheers',
          'From 50 Cent’s album Curtis',
          'From Relapse'
        ];
        const sanitizedText = joinedText
          .replace(/Marshall B\.?\s*Mathers\s*III/gi, ' ')
          .replace(/From The Marshall Mathers LP 2/gi, ' ')
          .replace(/From The Marshall Mathers LP/gi, ' ')
          .replace(/Encore Studios\s*\(Burbank,\s*CA\)/gi, ' ')
          .replace(/Marshall[’']?s House\s*\(Detroit,\s*MI\)/gi, ' ');
        const cleanedText = albumCreditExclusions.reduce((currentText, phrase) => {
          const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return currentText.replace(new RegExp(escaped, 'gi'), ' ');
        }, sanitizedText);
        return {
          text: cleanedText,
          triviaText: triviaParts.join(' ') || '',
          encoreStudioText,
          marshallsHouseText,
          creditsText,
          coverUrl
        };
      } catch (err) {
        return { text: '', triviaText: '', encoreStudioText: '', marshallsHouseText: '', creditsText: '', coverUrl: '' };
      }
    };

    const buildIndex = async () => {
      const cached = storageGet(STORAGE_KEY);
      const cachedMeta = storageGet(STORAGE_META);
      if (cached && cachedMeta) {
        try {
          const parsed = JSON.parse(cached);
          const parsedMeta = JSON.parse(cachedMeta);
          const hasCurrentSchema = Number(parsedMeta && parsedMeta.version) === SEARCH_CACHE_SCHEMA_VERSION;
          // Guard against stale/partial cache writes that can make Safari look like it has missing results.
          if (hasCurrentSchema && isCacheLikelyComplete(parsed)) {
            searchIndex = parsed;
            return searchIndex;
          }
          storageRemove(STORAGE_KEY);
          storageRemove(STORAGE_META);
        } catch (err) {
          storageRemove(STORAGE_KEY);
          storageRemove(STORAGE_META);
        }
      }

      const [songsResult, albumsResult, collectionsResult, articlesResult] = await Promise.allSettled([
        fetchSongs(),
        fetchAlbums(),
        fetchCollections(),
        fetchArticles()
      ]);

      const songs = songsResult.status === 'fulfilled' ? songsResult.value : [];
      const albums = albumsResult.status === 'fulfilled' ? albumsResult.value : [];
      const collections = collectionsResult.status === 'fulfilled' ? collectionsResult.value : [];
      const articles = articlesResult.status === 'fulfilled' ? articlesResult.value : [];

      const staticIndexItems = [
        {
          title: 'Charts',
          url: '/charts/index-charts.html',
          type: 'Collections',
          cover_url: '/images/logos/charts-cover.jpg'
        },
        {
          title: 'Album Critic Scores',
          url: '/charts/index-critic-scores.html',
          type: 'Collections',
          cover_url: '/images/logos/critic-score-cover.jpg'
        }
      ];

      const baseItems = dedupeByUrl([...songs, ...albums, ...collections, ...staticIndexItems]);
      const articleItems = articles.map((article) => ({
        ...article,
        tokens: tokensFromText(`${article.title} ${article.content || ''}`),
        title_tokens: tokensFromText(article.title),
        phrase_tokens: phraseTokensFromText(`${article.title} ${article.content || ''}`),
        trivia_tokens: [],
        encore_tokens: [],
        marshalls_house_tokens: []
      }));

      const items = [];
      let processed = 0;
      for (let i = 0; i < baseItems.length; i += INDEX_BATCH_SIZE) {
        const batch = baseItems.slice(i, i + INDEX_BATCH_SIZE);
        const texts = await Promise.all(batch.map((item) => (
          item.type === 'Collections'
            ? Promise.resolve({ text: '', triviaText: '', encoreStudioText: '', marshallsHouseText: '', creditsText: '', coverUrl: '' })
            : fetchPageText(item.url)
        )));
        texts.forEach((pageData, idx) => {
          const item = batch[idx];
          const titleTokens = tokensFromText(item.title);
          const baseText = item.type === 'Collections' ? '' : (pageData.text || '');
          const creditsText = item.type === 'Collections' ? '' : (pageData.creditsText || '');
          const tokens = item.type === 'Collections'
            ? titleTokens
            : tokensFromText(`${item.title} ${baseText} ${creditsText}`);
          const triviaTokens = item.type === 'Collections'
            ? []
            : tokensFromText(pageData.triviaText || '');
          const encoreTokens = item.type === 'Collections'
            ? []
            : tokensFromText(pageData.encoreStudioText || '');
          const marshallsHouseTokens = item.type === 'Collections'
            ? []
            : tokensFromText(pageData.marshallsHouseText || '');
          const phraseTokens = item.type === 'Collections'
            ? phraseTokensFromText(item.title)
            : phraseTokensFromText(`${item.title} ${baseText} ${creditsText}`);
          items.push({
            title: item.title,
            url: item.url,
            type: item.type,
            cover_url: item.cover_url || pageData.coverUrl || '',
            tokens,
            title_tokens: titleTokens,
            phrase_tokens: phraseTokens,
            trivia_tokens: triviaTokens,
            encore_tokens: encoreTokens,
            marshalls_house_tokens: marshallsHouseTokens
          });
        });
        processed += batch.length;
      }

      searchIndex = dedupeByUrl([...items, ...articleItems]);
      if (isCacheLikelyComplete(searchIndex)) {
        const savedIndex = storageSet(STORAGE_KEY, JSON.stringify(searchIndex));
        const savedMeta = storageSet(STORAGE_META, JSON.stringify({
          builtAt: Date.now(),
          version: SEARCH_CACHE_SCHEMA_VERSION,
          itemCount: searchIndex.length
        }));
        if (!savedIndex || !savedMeta) {
          storageRemove(STORAGE_KEY);
          storageRemove(STORAGE_META);
        }
      } else {
        storageRemove(STORAGE_KEY);
        storageRemove(STORAGE_META);
      }
      return searchIndex;
    };

    const countTokenMatches = (queryTokens, itemTokens, options = {}) => {
      const allowPrefixMatch = options.allowPrefixMatch !== false;
      if (!queryTokens.length || !itemTokens.length) return 0;
      const tokenBlob = ` ${itemTokens.join(' ')} `;
      let matches = 0;
      queryTokens.forEach((token) => {
        if (tokenBlob.includes(` ${token} `)) {
          matches += 1;
          return;
        }
        if (allowPrefixMatch && token.length >= 1 && itemTokens.some((itemToken) => itemToken.startsWith(token))) {
          matches += 1;
        }
      });
      return matches;
    };

    const tokenMatchScore = (queryTokens, itemTokens, title, options = {}) => {
      const allowPrefixMatch = options.allowPrefixMatch !== false;
      if (!queryTokens.length) return 0;
      const tokenBlob = ` ${itemTokens.join(' ')} `;
      let score = 0;
      queryTokens.forEach((token) => {
        if (tokenBlob.includes(` ${token} `)) score += 2;
        else if (allowPrefixMatch && token.length >= 1 && itemTokens.some((itemToken) => itemToken.startsWith(token))) score += 1;
      });
      const normalizedTitle = normalizeText(title);
      const joinedQuery = queryTokens.join(' ');
      if (normalizedTitle.includes(joinedQuery)) score += 4;
      if (normalizedTitle.startsWith(joinedQuery)) score += 2;
      return score;
    };

    const searchIndexForQuery = (query, items) => {
      const tokens = buildQueryTokens(query);
      if (!tokens.length) return [];
      const normalizedQuery = normalizeText(query);
      const rawQuery = String(query || '');
      const includeTrivia = shouldIncludeTrivia(query);
      const includeEncoreStudio = shouldIncludeEncoreStudio(query);
      const includeMarshallsHouse = shouldIncludeMarshallsHouse(query);
      const forcedExactState = window.__emdbSearchExact;
      const forceExactMatch = !!(
        forcedExactState
        && forcedExactState.query === normalizedQuery
        && Date.now() <= Number(forcedExactState.expiresAt || 0)
      );
      const queryWordCount = normalizedQuery.split(' ').filter(Boolean).length;
      const hasPunctuationSignal = /["'’\-]/.test(rawQuery);
      const strictPhraseMode = !forceExactMatch
        && queryWordCount >= 2
        && queryWordCount <= 4
        && !includeTrivia
        && !includeEncoreStudio
        && !includeMarshallsHouse
        && (hasPunctuationSignal || queryWordCount <= 3);
      const forceExactPhraseMode = (
        forceExactMatch
        && queryWordCount >= 2
        && queryWordCount <= 4
        && !includeTrivia
        && !includeEncoreStudio
        && !includeMarshallsHouse
      );
      const strictPhrases = (() => {
        const phrases = new Set();
        if (normalizedQuery) phrases.add(normalizedQuery);
        if (SYNONYMS.has(normalizedQuery)) {
          phrases.add(normalizeText(SYNONYMS.get(normalizedQuery)));
        }
        return Array.from(phrases).filter(Boolean);
      })();
      const runtimeUtilityCollections = [
        {
          title: 'Charts',
          url: '/charts/index-charts.html',
          type: 'Collections',
          cover_url: '/images/logos/charts-cover.jpg'
        },
        {
          title: 'Album Critic Scores',
          url: '/charts/index-critic-scores.html',
          type: 'Collections',
          cover_url: '/images/logos/critic-score-cover.jpg'
        }
      ];
      items = dedupeByUrl([...items, ...runtimeUtilityCollections]);
      const pseudoAlbumUrls = new Set([
        '/releases/non-album.html',
        '/releases/feat.html',
        '/releases/produced-only.html',
        '/releases/non-album-tracks.html',
        '/releases/songs-featuring-eminem.html',
        '/releases/production-discography.html'
      ]);
      const pseudoAlbumTitles = new Set([
        'non album',
        'non album tracks',
        'songs featuring eminem',
        'production discography'
      ]);
      items = items.filter((item) => {
        if (item.type !== 'Albums') return true;
        if (pseudoAlbumUrls.has(item.url)) return false;
        return !pseudoAlbumTitles.has(normalizeText(item.title || ''));
      });
      const chartsCollection = runtimeUtilityCollections[0];
      const criticScoresCollection = runtimeUtilityCollections[1];
      const isChartsQuery = normalizedQuery.length >= 3 && 'charts'.startsWith(normalizedQuery);
      const isCriticScoresQuery = (
        normalizedQuery.includes('critic score')
        || normalizedQuery.includes('critic scores')
        || normalizedQuery.includes('album critic')
        || normalizedQuery === 'critic'
        || normalizedQuery === 'scores'
      );
      if (isChartsQuery) {
        return [chartsCollection];
      }
      if (isCriticScoresQuery) {
        return [criticScoresCollection];
      }
      const isMgkQuery = normalizedQuery === 'machine gun kelly' || normalizedQuery === 'mgk';
      if (isMgkQuery) {
        const mgkSongUrls = new Set([
          '/songs/non-album/killshot.html',
          '/songs/kamikaze/not-alike.html',
          '/songs/kamikaze/ringer.html',
          '/songs/music-to-be-murdered-by/gnat.html',
          '/songs/music-to-be-murdered-by/marsh.html'
        ]);
        return items.filter((item) => item.type === 'Songs' && mgkSongUrls.has(item.url));
      }
      const isOutlawzQuery = (
        normalizedQuery === 'outlawz'
        || normalizedQuery === 'the outlawz'
      );
      if (isOutlawzQuery) {
        const outlawzSongUrls = new Set([
          '/songs/feat/one-day-at-a-time.html',
          '/songs/produced-only/uppercut.html',
          '/songs/feat/black-cotton.html'
        ]);
        return items.filter((item) => item.type === 'Songs' && outlawzSongUrls.has(item.url));
      }
      const isKenKaniffQuery = (
        normalizedQuery === 'ken kaniff'
        || normalizedQuery === 'ken kanif'
      );
      if (isKenKaniffQuery) {
        const kenKaniffSongUrls = new Set([
          '/songs/snippet-tape-sslp/cock-massage.html',
          '/songs/snippet-tape-mmlp/men-with-van.html',
          '/songs/snippet-tape-mmlp/rex.html',
          '/songs/slim-shady-lp/ken-kaniff-skit.html',
          '/songs/marshall-mathers-lp/ken-kaniff-skit-2.html',
          '/songs/eminem-show/curtains-close-skit.html',
          '/songs/relapse/underground.html',
          '/songs/feat/eminem-intro.html',
          '/songs/marshall-mathers-lp-2/evil-twin.html',
          '/songs/marshall-mathers-lp-2/wicked-ways.html',
          '/songs/death-of-slim-shady/guess-whos-back-skit.html'
        ]);
        return items.filter((item) => item.type === 'Songs' && kenKaniffSongUrls.has(item.url));
      }
      if (normalizedQuery === 'd12') {
        const matchesTargetUrl = (item, targetUrl) => (
          item && typeof item.url === 'string' && (
            item.url === targetUrl || item.url.endsWith(targetUrl)
          )
        );
        const topItems = [
          '/collections/songs-with-d12.html',
          '/releases/d12-world.html',
          '/releases/devils-night.html',
          '/releases/underground-ep.html'
        ]
          .map((url) => items.find((item) => matchesTargetUrl(item, url)))
          .filter(Boolean);
        const topIds = new Set(topItems.map((item) => item.url));
        const songItems = items.filter((item) => (
          item.type === 'Songs'
          && !topIds.has(item.url)
          && Array.isArray(item.tokens)
          && item.tokens.includes('d12')
        ));
        songItems.sort((a, b) => a.title.localeCompare(b.title));
        return [...topItems, ...songItems].slice(0, RESULT_LIMIT);
      }
      if (normalizedQuery === 'track 13') {
        const preferredSongs = new Set([
          '/songs/slim-shady-lp/cum-on-everybody.html',
          '/songs/marshall-mathers-lp/drug-ballad.html',
          '/songs/devils-night/pimp-like-me.html',
          '/songs/eminem-show/superman.html'
        ]);
        const songResults = items.filter((item) => item.type === 'Songs' && preferredSongs.has(item.url));
        const albumSlugs = new Set([
          '/releases/slim-shady-lp.html',
          '/releases/marshall-mathers-lp.html',
          '/releases/devils-night.html',
          '/releases/eminem-show.html'
        ]);
        const albumResults = items.filter((item) => item.type === 'Albums' && albumSlugs.has(item.url));
        return [...songResults, ...albumResults];
      }
      if (normalizedQuery === 'track 13 girl') {
        const preferredSongs = new Set([
          '/songs/slim-shady-lp/cum-on-everybody.html',
          '/songs/marshall-mathers-lp/drug-ballad.html',
          '/songs/music-to-be-murdered-by/pale-moonlight.html',
          '/songs/devils-night/pimp-like-me.html',
          '/songs/eminem-show/superman.html',
          '/songs/eminem-show/white-america.html'
        ]);
        return items.filter((item) => item.type === 'Songs' && preferredSongs.has(item.url));
      }
      if (normalizedQuery === 'kevin wilder') {
        const preferredUrls = new Set([
          '/releases/infinite.html',
          '/songs/infinite/infinite-song.html',
          '/songs/infinite/wego.html',
          '/songs/infinite/its-ok.html',
          '/songs/infinite/tonite.html',
          '/songs/infinite/313.html',
          '/songs/infinite/maxine.html',
          '/songs/infinite/open-mic.html',
          '/songs/infinite/never-2-far.html',
          '/songs/infinite/searchin.html',
          '/songs/infinite/backstabber.html',
          '/songs/infinite/jealousy-woes-ii.html'
        ]);
        return items.filter((item) => preferredUrls.has(item.url));
      }
      const isJeffBassQuery = (
        normalizedQuery === 'jeff bass'
        || normalizedQuery === 'f b t'
        || normalizedQuery === 'fbt'
        || normalizedQuery === 'fb'
      );
      if (isJeffBassQuery) {
        const topCollectionUrl = '/collections/songs-with-fbt.html';
        const excludedUrls = new Set([
          '/songs/marshall-mathers-lp/ken-kaniff-skit-2.html',
          '/songs/feat/public-service-announcement-obie-trice.html',
          '/songs/obie-trice/public-service-announcement-obie-trice.html'
        ]);
        const songTitles = new Set([
          "Just Don't Give A Fuck",
          'Brain Damage',
          'If I Had',
          "97 Bonnie & Clyde",
          'My Fault',
          'Cum On Everybody',
          'Rock Bottom',
          'As The World Turns',
          "I'm Shady",
          'Bad Meets Evil',
          "Still Don't Give A Fuck",
          'Bad Influence',
          'My Fault (Pizza Mix)',
          'Murder Murder Remix',
          'Marshall Mathers',
          'Drug Ballad',
          'Amityville',
          'Kim',
          'Under The Influence',
          'Criminal',
          'The Kids',
          'I Remember (Dedication To Whitey Ford)',
          'Purple Pills',
          'American Psycho',
          'Pimp Like Me',
          'Blow My Buzz',
          "Devil's Night",
          'These Drugs',
          'Without Me',
          'White America',
          "Cleanin' Out My Closet",
          'Sing For The Moment',
          'Superman',
          'Stimulate',
          'Lose Yourself',
          "Gatman And Robbin'",
          'Drama Setter',
          'Touchdown',
          'Beautiful',
          'Lose Yourself (Original Demo Version)',
          'Infinite (F.B.T. Remix)',
          'Intro (Slim Shady)',
          'Low Down, Dirty',
          'If I Had...',
          "Just Don't Give a Fuck",
          'Mommy',
          'Just The Two Of Us',
          "No One's Iller",
          'Murder, Murder',
          'Public Service Announcement',
          'Ken Kaniff (Skit)',
          'Soap (Skit)',
          'Public Service Announcement 2000',
          'Shit Can Happen',
          'Pistol Pistol',
          "That's How...",
          'Square Dance',
          'Drips',
          'The Cross',
          'Nightmares',
          'The Pain',
          'When Darkness Falls',
          'Pass Me A Lighter',
          'Never Forget Ya',
          'Lord Have Mercy',
          'Gun Rule',
          "Pistol Poppin'",
          'Thoughts Of Suicide',
          'Lac Motion',
          'Crazy'
        ].map((title) => normalizeText(title)));
        const albumTitles = new Set([
          'Infinite',
          'Infinite (Album)',
          'Slim Shady EP',
          'The Slim Shady LP',
          'Slim Shady LP',
          'The Marshall Mathers LP',
          'Marshall Mathers LP',
          "Devil's Night",
          'Devils Night',
          'The Eminem Show',
          'Eminem Show',
          '8 Mile (Soundtrack)',
          '8 Mile Soundtrack',
          'Relapse'
        ].map((title) => normalizeText(title)));
        const filtered = items.filter((item) => {
          if (excludedUrls.has(item.url)) return false;
          const normalizedTitle = normalizeText(item.title || '');
          if (item.type === 'Songs') return songTitles.has(normalizedTitle);
          if (item.type === 'Albums') return albumTitles.has(normalizedTitle);
          return false;
        });
        const topCollection = items.find((item) => item.url === topCollectionUrl) || {
          title: 'Songs with Jeff Bass & F.B.T.',
          url: topCollectionUrl,
          type: 'Collections',
          cover_url: ''
        };
        return [topCollection, ...filtered.filter((item) => item.url !== topCollectionUrl)];
      }
      const isBassBrothersQuery = (
        normalizedQuery === 'mark bass'
        || normalizedQuery === 'bass brothers'
        || normalizedQuery === 'bass bros'
        || normalizedQuery === 'bass b'
        || normalizedQuery === 'bass br'
        || normalizedQuery === 'bass bro'
        || normalizedQuery === 'mark bas'
      );
      if (isBassBrothersQuery) {
        const topCollectionUrl = '/collections/songs-with-fbt.html';
        const excludedUrls = new Set([
          '/songs/marshall-mathers-lp/ken-kaniff-skit-2.html',
          '/songs/feat/public-service-announcement-obie-trice.html'
        ]);
        const songTitles = new Set([
          "Just Don't Give A Fuck",
          'Brain Damage',
          'If I Had',
          "97 Bonnie & Clyde",
          'My Fault',
          'Cum On Everybody',
          'Rock Bottom',
          'As The World Turns',
          "I'm Shady",
          'Bad Meets Evil',
          "Still Don't Give A Fuck",
          'Bad Influence',
          'My Fault (Pizza Mix)',
          'Murder Murder Remix',
          'Marshall Mathers',
          'Drug Ballad',
          'Amityville',
          'Kim',
          'Under The Influence',
          'Criminal',
          'The Kids',
          'I Remember (Dedication To Whitey Ford)',
          "Gatman And Robbin'",
          'Infinite (F.B.T. Remix)',
          'Intro (Slim Shady)',
          'Low Down, Dirty',
          'If I Had...',
          "Just Don't Give a Fuck",
          'Mommy',
          'Just The Two Of Us',
          "No One's Iller",
          'Murder, Murder',
          'Public Service Announcement',
          'Ken Kaniff (Skit)',
          'Soap (Skit)',
          'Public Service Announcement 2000',
          'Nightmares',
          'The Pain',
          'When Darkness Falls',
          'Pass Me A Lighter'
        ].map((title) => normalizeText(title)));
        const albumTitles = new Set([
          'Infinite',
          'Infinite (Album)',
          'Slim Shady EP',
          'The Slim Shady LP',
          'Slim Shady LP',
          'The Marshall Mathers LP',
          'Marshall Mathers LP'
        ].map((title) => normalizeText(title)));
        const filtered = items.filter((item) => {
          if (excludedUrls.has(item.url)) return false;
          const normalizedTitle = normalizeText(item.title || '');
          if (item.type === 'Songs') return songTitles.has(normalizedTitle);
          if (item.type === 'Albums') return albumTitles.has(normalizedTitle);
          return false;
        });
        const topCollection = items.find((item) => item.url === topCollectionUrl) || {
          title: 'Songs with Jeff Bass & F.B.T.',
          url: topCollectionUrl,
          type: 'Collections',
          cover_url: ''
        };
        return [topCollection, ...filtered.filter((item) => item.url !== topCollectionUrl)];
      }
      const isChristopherReevePrefix = normalizedQuery.length > 7 && (
        'christopher reeve'.startsWith(normalizedQuery)
        || 'christopher reeves'.startsWith(normalizedQuery)
        || normalizedQuery.startsWith('christopher reeve')
        || normalizedQuery.startsWith('christopher reeves')
      );
      const isStretchQuery = normalizedQuery === 'stretch';
      const stretchExcludedUrls = new Set([
        '/songs/snippet-tape-mmlp/intro-mmlp-snippet.html',
        '/songs/snippet-tape-sslp/intro-sslp-snippet.html',
        '/songs/non-album/my-name-is-rock-star-remix.html'
      ]);
      const hasReeveKeyword = normalizedQuery.includes('reev')
        || normalizedQuery.includes('reeve')
        || normalizedQuery.includes('reeves');
      const isChristopherReeveQuery = isChristopherReevePrefix || hasReeveKeyword;
      if (isChristopherReeveQuery) {
        const preferredSongs = new Set([
          '/songs/death-of-slim-shady/brand-new-dance.html',
          '/songs/death-of-slim-shady/guilty-conscience-2.html',
          '/songs/marshall-mathers-lp/im-back.html',
          '/songs/encore/my-1st-single.html',
          '/songs/relapse/medicine-ball.html',
          '/songs/relapse/paul-skit-5.html',
          '/songs/death-of-slim-shady/road-rage.html',
          '/songs/encore/rain-man.html',
          '/songs/marshall-mathers-lp/who-knew.html'
        ]);
        return items.filter((item) => item.type === 'Songs' && preferredSongs.has(item.url));
      }
      if (normalizedQuery === 'ja rule') {
        const preferredSongs = new Set([
          '/songs/feat/ja-rule-freestyle.html',
          '/songs/non-album/doe-rae-me.html',
          '/songs/non-album/hail-mary.html',
          '/songs/non-album/bully.html',
          '/songs/eminem-show/bump-heads.html',
          '/songs/non-album/go-to-sleep.html',
          '/songs/non-album/invasion.html',
          '/songs/encore/like-toy-soldiers.html',
          '/songs/feat/shit-hits-the-fan.html',
          '/songs/feat/outro-cheers.html'
        ]);
        return items
          .filter((item) => item.type === 'Songs' && preferredSongs.has(item.url))
          .sort((a, b) => a.title.localeCompare(b.title));
      }
      const scored = items.map((item) => {
        const baseTokens = Array.isArray(item.tokens) ? item.tokens : [];
        const triviaTokens = includeTrivia && Array.isArray(item.trivia_tokens)
          ? item.trivia_tokens
          : [];
        const encoreTokens = includeEncoreStudio && Array.isArray(item.encore_tokens)
          ? item.encore_tokens
          : [];
        const marshallsHouseTokens = includeMarshallsHouse && Array.isArray(item.marshalls_house_tokens)
          ? item.marshalls_house_tokens
          : [];
        const combinedTokens = Array.from(new Set([
          ...baseTokens,
          ...triviaTokens,
          ...encoreTokens,
          ...marshallsHouseTokens
        ]));
        const isLivingProof = typeof item.url === 'string' && item.url.includes('/songs/hell-the-sequel/living-proof.html');
        if (isLivingProof && (
          normalizedQuery === 'proof'
          || normalizedQuery.includes('deshaun holton')
          || normalizedQuery.includes('deshaun dupree holton')
        )) {
          return { item, score: 0, matchCount: 0 };
        }
        const matchCount = countTokenMatches(tokens, combinedTokens, { allowPrefixMatch: !forceExactMatch });
        let score = tokenMatchScore(tokens, combinedTokens, item.title, { allowPrefixMatch: !forceExactMatch });
        const titleTokens = Array.isArray(item.title_tokens) ? item.title_tokens : tokensFromText(item.title);
        const phraseTokens = Array.isArray(item.phrase_tokens) ? item.phrase_tokens : [];
        const titleMatch = tokens.some((token) => titleTokens.includes(token));
        const normalizedTitle = normalizeText(item.title || '');
        const titleStartsWithQuery = normalizedQuery && normalizedTitle.startsWith(normalizedQuery);
        const titleContainsQuery = normalizedQuery && normalizedTitle.includes(normalizedQuery);
        const phraseExactMatch = strictPhrases.some((phrase) => (
          normalizedTitle.includes(phrase) || phraseTokens.includes(phrase)
        ));
        if ((strictPhraseMode || forceExactPhraseMode) && !phraseExactMatch) {
          return { item, score: 0, matchCount: 0 };
        }
        if (titleMatch) score += 20;
        if (titleContainsQuery) score += 120;
        if (titleStartsWithQuery) score += 80;
        if (phraseExactMatch) score += 140;
        if (item.type === 'Collections' && titleMatch) score += 100;
        return { item, score, matchCount };
      }).filter((entry) => entry.score > 0);
      const originalTokens = normalizeText(query).split(' ').filter(Boolean);
      const uniqueOriginalTokens = Array.from(new Set(originalTokens));
      const hasShortOriginalToken = originalTokens.some((token) => token.length < 3);
      const minMatchCount = forceExactMatch
        ? Math.max(1, uniqueOriginalTokens.length)
        : (originalTokens.length > 1
          ? (hasShortOriginalToken ? 1 : Math.min(2, originalTokens.length))
          : 1);
      const filtered = scored.filter((entry) => entry.matchCount >= minMatchCount)
        .map((entry) => applyAlbumQueryBoosts(normalizedQuery, entry));
      filtered.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
      let finalResults = filtered.slice(0, RESULT_LIMIT).map((entry) => entry.item);
      if (isStretchQuery) {
        finalResults = finalResults.filter((item) => !stretchExcludedUrls.has(item.url));
      }
      return finalResults;
    };

    const ensureIndex = async () => {
      if (searchIndex) return searchIndex;
      if (indexPromise) return indexPromise;
      indexPromise = buildIndex().catch((err) => {
        indexPromise = null;
        throw err;
      });
      return indexPromise;
    };

    const handleSearchInput = async (requestVersion) => {
      const query = searchInput.value.trim();
      const effectiveQuery = normalizeSearchAliasQuery(query);
      const normalizedInputQuery = normalizeText(effectiveQuery);
      const forcedExactState = window.__emdbSearchExact;
      if (forcedExactState && forcedExactState.query !== normalizedInputQuery) {
        delete window.__emdbSearchExact;
      }

      if (effectiveQuery !== lastQuery) {
        lastFilter = 'All';
        lastQuery = effectiveQuery;
      }

      if (!effectiveQuery) {
        lastResults = [];
        searchSuggestions.innerHTML = '';
        closeSuggestions();
        return;
      }

      openSuggestions();

      const buildCurrentPageFallback = () => {
        const normalizedQuery = normalizeText(effectiveQuery);
        if (!normalizedQuery) return null;
        const path = String(window.location.pathname || '');
        if (!path.includes('/songs/') && !path.includes('/releases/')) return null;

        const getCleanPageTitle = () => {
          const ownText = (node) => Array.from(node ? node.childNodes : [])
            .filter((child) => child && child.nodeType === Node.TEXT_NODE)
            .map((child) => String(child.nodeValue || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .join(' ')
            .trim();

          const albumName = document.querySelector('.album-name');
          if (albumName) {
            const direct = ownText(albumName);
            if (direct) return direct;

            const clone = albumName.cloneNode(true);
            clone.querySelectorAll('.nav-popover, .album-nav-popover, .album-edit-note, .toggle-arrow').forEach((node) => node.remove());
            const text = String(clone.textContent || '').replace(/\s+/g, ' ').trim();
            if (text) return text;
          }

          const albumTitle = document.querySelector('.album-title');
          if (albumTitle) {
            const clone = albumTitle.cloneNode(true);
            clone.querySelectorAll('.nav-popover, .album-nav-popover, .album-edit-note, .toggle-arrow').forEach((node) => node.remove());
            const text = String(clone.textContent || '').replace(/\s+/g, ' ').trim();
            if (text) return text;
          }

          const h1 = document.querySelector('h1');
          if (h1) {
            const text = String(h1.textContent || '').replace(/\s+/g, ' ').trim();
            if (text) return text;
          }

          return String(document.title || '').replace(/\s*\|\s*EMDb\s*$/i, '').trim();
        };

        const currentTitle = getCleanPageTitle();
        const creditNodes = Array.from(document.querySelectorAll('.meta-name, .written-by .meta-value, .credit-pair .meta-value, .track-details, .track-feat, .track-note'));
        const creditText = normalizeText(creditNodes.map((node) => node.textContent || '').join(' '));
        if (!creditText.includes(normalizedQuery)) return null;

        const cover =
          document.querySelector('.album-single img')?.getAttribute('src')
          || document.querySelector('.song-cover img')?.getAttribute('src')
          || '';
        const coverUrl = cover
          ? (cover.startsWith('http://') || cover.startsWith('https://') || cover.startsWith('/') ? cover : `/${cover.replace(/^\/+/, '')}`)
          : '';

        return {
          title: String(currentTitle).replace(/\s*\|\s*EMDb\s*$/i, '').trim(),
          url: path,
          type: path.includes('/releases/') ? 'Albums' : 'Songs',
          cover_url: coverUrl
        };
      };

      const fallbackItem = buildCurrentPageFallback();

      renderResults([], { status: `Searching for "${effectiveQuery}"...`, emptyMessage: 'Searching...' });
      try {
        const index = await ensureIndex();
        if (requestVersion !== searchRequestVersion) return;
        lastResults = searchIndexForQuery(effectiveQuery, index);
        if (fallbackItem && !lastResults.some((item) => item.url === fallbackItem.url)) {
          lastResults = [fallbackItem, ...lastResults];
        }
        renderResults(lastResults, { emptyMessage: 'No matches found' });
      } catch (err) {
        console.error('Search error:', err);
        renderResults([], { status: 'Search failed. Please refresh.', emptyMessage: 'Search failed' });
      }
    };

    const scheduleSearch = () => {
      searchRequestVersion += 1;
      const requestVersion = searchRequestVersion;
      if (searchInputFrame) cancelAnimationFrame(searchInputFrame);
      searchInputFrame = requestAnimationFrame(() => {
        searchInputFrame = 0;
        handleSearchInput(requestVersion);
      });
    };

    searchInput.addEventListener('focus', () => {
      warmIndex();
      if (!searchInput.value.trim()) {
        lastResults = [];
        searchSuggestions.innerHTML = '';
        closeSuggestions();
        return;
      }
      openSuggestions();
    });
    searchInput.addEventListener('input', scheduleSearch);
    searchInput.addEventListener('keyup', scheduleSearch);
    searchInput.addEventListener('search', scheduleSearch);
    searchInput.addEventListener('blur', () => {
      setTimeout(() => {
        if (suppressBlurClose) return;
        if (searchSuggestions.contains(document.activeElement)) return;
        closeSuggestions();
      }, 160);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (lastResults.length) {
          e.preventDefault();
          const targetUrl = getNavigationUrl(lastResults[0]);
          if (targetUrl) window.location.href = targetUrl;
        }
      }
    });

    searchSuggestions.addEventListener('mousedown', (e) => {
      suppressBlurClose = true;
      e.preventDefault();
      e.stopPropagation();
      setTimeout(() => {
        suppressBlurClose = false;
      }, 0);
    });

    searchSuggestions.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    document.addEventListener('click', (e) => {
      if (!searchSuggestions.classList.contains('open')) return;
      if (!searchSuggestions.contains(e.target) && e.target !== searchInput) {
        closeSuggestions();
      }
    });

    const warmIndex = () => {
      if (searchIndex || indexPromise) return;
      void ensureIndex().catch(() => {});
    };
    warmIndex();
  }

  (function setupLogoCaption() {
    const caption = document.getElementById('logoCaption');
    if (!caption) return;
    let isShowing = false;

    function showCaption() {
      if (isShowing) return;
      isShowing = true;
      caption.classList.add('show');
      caption.setAttribute('aria-hidden', 'false');
      setTimeout(() => {
        caption.classList.remove('show');
        caption.setAttribute('aria-hidden', 'true');
        isShowing = false;
      }, 3400);
    }

    showCaption();
      setInterval(showCaption, 10000);
  })();

  document.querySelectorAll('.menu-inline-group').forEach((group) => {
    let closeTimer = null;
    const submenu = group.querySelector('.menu-inline-sub');

    function open() {
      clearTimeout(closeTimer);
      group.classList.add('open');
    }
    function close() {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => group.classList.remove('open'), 260);
    }

    group.addEventListener('mouseenter', open);
    group.addEventListener('mouseleave', close);
    group.addEventListener('focusin', open);
    group.addEventListener('focusout', close);

    if (submenu) {
      submenu.addEventListener('mouseenter', open);
      submenu.addEventListener('mouseleave', close);
    }
  });

  // Mobile drawer: collapse/expand drawer groups (e.g. Rankings, More)
  (function setupMobileMenuGroups() {
    const menuPanel = document.getElementById('menuPanel');
    if (!menuPanel) return;
    const groups = Array.from(menuPanel.querySelectorAll('.menu-group'));
    if (!groups.length) return;

    groups.forEach((group) => {
      const title = group.querySelector('.menu-group-title');
      if (!title) return;

      const setExpanded = (expanded) => {
        group.classList.toggle('open', expanded);
        title.setAttribute('aria-expanded', String(expanded));
      };

      // start collapsed
      setExpanded(false);

      const toggle = () => setExpanded(!group.classList.contains('open'));

      title.setAttribute('role', 'button');
      title.setAttribute('tabindex', '0');
      title.addEventListener('click', toggle);
      title.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });

      // Also toggle when clicking the group container, excluding links and title.
      group.addEventListener('click', (e) => {
        if (e.target === title || title.contains(e.target)) return;
        if (e.target.tagName === 'A') return;
        toggle();
      });
    });
  })();

  // Auth state: swap sign-in link for profile info when logged in
  (function setupAuthState() {
    const STORAGE_KEY = 'emdb_logged_in';
    const STORAGE_USER_EMAIL = 'emdb_user_email';
    const STORAGE_USER_AVATAR = 'emdb_user_avatar';

    const userArea = document.querySelector('.user-area');
    const signInBtn = document.getElementById('sign-in-btn');
    const profileArea = document.getElementById('profile-area');
    const avatar = document.getElementById('userAvatar');

    if (!userArea) return;

    const isLoggedIn = () => localStorage.getItem(STORAGE_KEY) === 'true';
    const userEmail = () => localStorage.getItem(STORAGE_USER_EMAIL);
    const normalizeAvatarPath = (value) => {
      const raw = String(value || '').trim().replace(/\\/g, '/');
      if (!raw) return '/images/avatars/avatar-1.jpg';
      const avatarMatch = raw.match(/avatar[_-]?(\d+)\.(?:jpe?g|png|webp|gif)$/i);
      if (avatarMatch) return `/images/avatars/avatar-${Number(avatarMatch[1])}.jpg`;
      if (/^\/images\/avatars\/avatar-\d+\.jpg$/i.test(raw)) return raw.toLowerCase();
      return '/images/avatars/avatar-1.jpg';
    };
    const userAvatar = () => normalizeAvatarPath(localStorage.getItem(STORAGE_USER_AVATAR));

    const renderLoggedOut = () => {
      userArea.classList.remove('logged-in');
      if (signInBtn) signInBtn.style.display = 'inline-flex';
      if (profileArea) profileArea.innerHTML = '';
      if (avatar) avatar.style.backgroundImage = '';
    };

    const renderLoggedIn = () => {
      userArea.classList.add('logged-in');
      if (signInBtn) signInBtn.style.display = 'none';
      if (profileArea) profileArea.innerHTML = '';
      if (avatar) avatar.style.backgroundImage = `url(${userAvatar()})`;
    };

    const handleAvatarClick = () => {
      if (isLoggedIn()) {
        window.location.href = '/profile.html';
      } else {
        window.location.href = '/sign-in.html';
      }
    };

    if (avatar) {
      avatar.setAttribute('role', 'button');
      avatar.setAttribute('tabindex', '0');
      avatar.addEventListener('click', handleAvatarClick);
      avatar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleAvatarClick();
        }
      });
    }

    if (isLoggedIn() && userEmail()) {
      renderLoggedIn();
    } else {
      renderLoggedOut();
    }
  })();
}

function bootstrapLayoutPartials() {
  enforceTriviaBullets();
  setupSampleBackButton();
  setupSampleJumpButtonLayout();
  linkifyEminemDotComMentions();
  setupSongCreditsNameSearch();
  loadSiteHeader();
  loadSiteFooter();
}

function setupSampleBackButton() {
  const path = String(window.location.pathname || '');
  if (!path.includes('/samples/')) return;

  const main = document.querySelector('main') || document.body;
  if (!main) return;

  if (!document.getElementById('sample-back-btn-style')) {
    const style = document.createElement('style');
    style.id = 'sample-back-btn-style';
    style.textContent = [
      '.gallery-back-wrap {',
      '  max-width: 900px;',
      '  margin: 1rem auto 0;',
      '  padding: 0 1rem;',
      '}',
      '.gallery-back-btn {',
      '  display: inline-block;',
      '  background: #111;',
      '  color: #eaeaea;',
      '  border: 1px solid #333;',
      '  border-radius: 8px;',
      '  padding: 0.45rem 0.8rem;',
      '  font-size: 0.9rem;',
      '  cursor: pointer;',
      '}',
      '.gallery-back-btn:hover,',
      '.gallery-back-btn:focus-visible {',
      '  border-color: #E21C21;',
      '  color: #fff;',
      '  text-decoration: none;',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  const goBack = function () {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    const ref = document.referrer || '/index.html';
    window.location.href = ref;
  };

  const bindBack = (node) => {
    if (!node || node.dataset.backBound === 'true') return;
    node.dataset.backBound = 'true';
    node.addEventListener('click', (event) => {
      event.preventDefault();
      goBack();
    });
  };

  const existingLink = main.querySelector('.back-link');
  if (existingLink) {
    existingLink.classList.add('gallery-back-btn');
    existingLink.textContent = 'Back';
    bindBack(existingLink);
    return;
  }

  const existingBtn = main.querySelector('.gallery-back-wrap .gallery-back-btn');
  if (existingBtn) {
    bindBack(existingBtn);
    return;
  }

  const backWrap = document.createElement('div');
  backWrap.className = 'gallery-back-wrap';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'gallery-back-btn';
  backBtn.textContent = 'Back';
  bindBack(backBtn);

  backWrap.appendChild(backBtn);
  main.insertBefore(backWrap, main.firstChild);
}

function setupSampleJumpButtonLayout() {
  const path = String(window.location.pathname || '');
  if (!path.includes('/samples/')) return;

  if (!document.getElementById('sample-jump-btn-style')) {
    const style = document.createElement('style');
    style.id = 'sample-jump-btn-style';
    style.textContent = [
      '.sample-page .sample-inline-video .sample-jump-wrap {',
      '  color: #ccc;',
      '  font-size: 0.95rem;',
      '  display: flex;',
      '  gap: 8px;',
      '  align-items: center;',
      '  flex-wrap: wrap;',
      '  margin-top: 6px;',
      '}',
      '.sample-page .sample-inline-video .sample-jump-wrap button {',
      '  background: #E21C21;',
      '  color: #fff;',
      '  border: 0;',
      '  padding: 4px 6px;',
      '  border-radius: 4px;',
      '  cursor: pointer;',
      '  font-size: 0.85rem;',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  const sampleBlocks = Array.from(document.querySelectorAll('.sample-page .sample-inline-video'));
  sampleBlocks.forEach((block) => {
    const buttons = Array.from(block.querySelectorAll('button[id^="seekSampleBtn"]'));
    if (!buttons.length) return;

    const iframe = block.querySelector('iframe');
    if (!iframe) return;
    const iframeWrap = iframe.parentElement;
    if (!iframeWrap) return;

    let jumpWrap = block.querySelector(':scope > .sample-jump-wrap');
    if (!jumpWrap) {
      jumpWrap = document.createElement('div');
      jumpWrap.className = 'sample-jump-wrap';
      iframeWrap.insertAdjacentElement('afterend', jumpWrap);
    }

    buttons.forEach((btn) => {
      const row = btn.parentElement;
      const timeSpan = row ? row.querySelector('span') : null;
      const rawTime = timeSpan
        ? String(timeSpan.textContent || '').replace('@', '').trim()
        : '';
      const btnText = String(btn.textContent || '').trim();

      if (rawTime) {
        btn.textContent = `Jump ${rawTime}`;
      } else if (/^jump$/i.test(btnText)) {
        btn.textContent = 'Jump';
      }

      if (timeSpan) {
        timeSpan.remove();
      }

      jumpWrap.appendChild(btn);

      if (row && row !== jumpWrap && row.childElementCount === 0) {
        row.remove();
      }
    });
  });
}

function linkifyEminemDotComMentions() {
  const mentionRegex = /(^|[^@\w./-])((?:https?:\/\/)?(?:www\.)?eminem\.com(?:\/[^\s<)]*)?)/gi;
  const skipTags = new Set(['A', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'BUTTON', 'CODE', 'PRE']);

  const isEminemComHref = (href) => {
    const value = String(href || '').trim();
    if (!value) return false;
    try {
      const parsed = new URL(value, window.location.origin);
      const host = String(parsed.hostname || '').toLowerCase();
      return host === 'eminem.com' || host === 'www.eminem.com' || host.endsWith('.eminem.com');
    } catch (err) {
      return false;
    }
  };

  const enforceNewTabForExistingLinks = (root) => {
    if (!root) return;
    if (root.nodeType === Node.ELEMENT_NODE && root.tagName === 'A') {
      if (isEminemComHref(root.getAttribute('href'))) {
        root.target = '_blank';
        root.rel = 'noopener noreferrer';
      }
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    root.querySelectorAll('a[href]').forEach((link) => {
      if (!isEminemComHref(link.getAttribute('href'))) return;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
  };

  const normalizeHref = (mention) => {
    const value = String(mention || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    return `https://${value.replace(/^\/+/, '')}`;
  };

  const processTextNode = (node) => {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const parent = node.parentElement;
    if (!parent || skipTags.has(parent.tagName)) return;
    if (parent.closest('a, script, style, noscript, textarea, button, code, pre')) return;

    const text = String(node.nodeValue || '');
    mentionRegex.lastIndex = 0;
    if (!mentionRegex.test(text)) return;

    mentionRegex.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let cursor = 0;
    let match;

    while ((match = mentionRegex.exec(text))) {
      const fullStart = match.index;
      const prefix = match[1] || '';
      const mentionRaw = match[2] || '';
      const mentionStart = fullStart + prefix.length;
      const mentionEnd = mentionStart + mentionRaw.length;

      if (fullStart > cursor) {
        frag.appendChild(document.createTextNode(text.slice(cursor, fullStart)));
      }
      if (prefix) {
        frag.appendChild(document.createTextNode(prefix));
      }

      let mention = mentionRaw;
      let trailing = '';
      while (mention && /[.,!?;:]$/.test(mention)) {
        trailing = mention.slice(-1) + trailing;
        mention = mention.slice(0, -1);
      }

      if (mention) {
        const link = document.createElement('a');
        link.href = normalizeHref(mention);
        link.textContent = mention;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        frag.appendChild(link);
      }
      if (trailing) {
        frag.appendChild(document.createTextNode(trailing));
      }

      cursor = mentionEnd;
    }

    if (cursor < text.length) {
      frag.appendChild(document.createTextNode(text.slice(cursor)));
    }

    node.parentNode.replaceChild(frag, node);
  };

  const processRoot = (root) => {
    if (!root) return;
    enforceNewTabForExistingLinks(root);
    if (root.nodeType === Node.TEXT_NODE) {
      processTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const targets = [];
    let current;
    while ((current = walker.nextNode())) targets.push(current);
    targets.forEach(processTextNode);
  };

  processRoot(document.body);

  if (window.__emdbEminemComLinkObserverBound) return;
  window.__emdbEminemComLinkObserverBound = true;

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => processRoot(node));
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function setupSongCreditsNameSearch() {
  const path = String(window.location.pathname || '');
  const isCollectionPage = path.includes('/collections/');
  const isArticlePage = path.includes('/articles/');
  const isNewsPage = path.includes('/news/');
  const isExcludedCollectionPage = /\/collections\/(?:songs-a-z|albums-discography)\.html$/i.test(path);
  if (!path.includes('/songs/') && !path.includes('/releases/') && !isCollectionPage && !isArticlePage && !isNewsPage) return;
  if (isExcludedCollectionPage) return;

  const normalize = (value) =>
    String(value || '')
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const blockedNames = new Set(['eminem']);
  const nonSplittableActs = new Set([
    'sway & king tech',
    'sway and king tech',
    'night & day',
    'night and day',
    'witt & pep',
    'witt and pep'
  ]);
  const searchAliases = new Map([
    ['slim', 'Kevin Wilder'],
    ['swift', 'Swifty McVay'],
    ['puff daddy', 'Diddy'],
    ['sean diddy combs', 'Diddy'],
    ['sean "diddy" combs', 'Diddy'],
    ['sean “diddy” combs', 'Diddy'],
    ['mark & jeff bass', 'Bass Brothers'],
    ['mark jeff bass', 'Bass Brothers'],
    ['mark and jeff bass', 'Bass Brothers']
  ]);

  const releaseLineMatchers = [
    { pattern: /\bthe\s+slim\s+shady\s+lp\b|\bslim\s+shady\s+lp\b/i, href: '/releases/slim-shady-lp.html' },
    { pattern: /\bthe\s+marshall\s+mathers\s+lp\s*2\b|\bmarshall\s+mathers\s+lp\s*2\b/i, href: '/releases/marshall-mathers-lp-2.html' },
    { pattern: /\bthe\s+marshall\s+mathers\s+lp\b|\bmarshall\s+mathers\s+lp\b/i, href: '/releases/marshall-mathers-lp.html' },
    { pattern: /\bthe\s+eminem\s+show\b|\beminem\s+show\b/i, href: '/releases/eminem-show.html' },
    { pattern: /\bencore\b/i, href: '/releases/encore.html' },
    { pattern: /\bdevil[\'’]?s\s+night\b|\bdevils\s+night\b/i, href: '/releases/devils-night.html' },
    { pattern: /\bd12\s+world\b/i, href: '/releases/d12-world.html' },
    { pattern: /\brelapse\b/i, href: '/releases/relapse.html' },
    { pattern: /\brecovery\b/i, href: '/releases/recovery.html' },
    { pattern: /\brevival\b/i, href: '/releases/revival.html' },
    { pattern: /\bkamikaze\b/i, href: '/releases/kamikaze.html' },
    { pattern: /\bmusic\s+to\s+be\s+murdered\s+by\b/i, href: '/releases/music-to-be-murdered-by.html' },
    { pattern: /\bhell\s*:\s*the\s+sequel\b|\bhell\s+the\s+sequel\b/i, href: '/releases/hell-the-sequel.html' },
    { pattern: /\bsouthpaw\b/i, href: '/releases/southpaw-soundtrack.html' },
    { pattern: /\b8\s*mile\b/i, href: '/releases/8-mile-soundtrack.html' },
    { pattern: /\beminem\s+presents\s*:\s*the\s+re\s*[-\u2011\u2013\u2014]?\s*up\b|\bthe\s+re\s*[-\u2011\u2013\u2014]?\s*up\b/i, href: '/releases/re-up.html' },
    { pattern: /\bcurtain\s+call\s*:?\s*the\s+hits\b|\bcurtain\s+call\b/i, href: '/releases/curtain-call.html' },
    { pattern: /\bcurtain\s+call\s*2\b/i, href: '/releases/curtain-call-2.html' },
    { pattern: /\bshady\s*xv\b|\bshadyxv\b/i, href: '/releases/shadyxv.html' },
    { pattern: /\bstans\s*\(\s*soundtrack\s*\)\b|\bstans\b/i, href: '/releases/stans-soundtrack.html' },
    { pattern: /\bfortnite\s+radio\b/i, href: '/releases/fortnite-radio.html' }
  ];

  const isCopyrightContext = (node) => {
    if (!node) return false;
    if (node.closest('.meta-inline')) return true;
    const txt = String(node.textContent || '');
    return txt.includes('℗') || /copyright|all rights reserved/i.test(txt);
  };

  const isLikelyPersonName = (name) => {
    const value = String(name || '').trim();
    if (!value) return false;
    if (/^n\/?a$/i.test(value)) return false;
    if (value.length < 2) return false;
    if (/^(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(value)) return false;
    if (/^circa\b/i.test(value)) return false;
    if (/^(produced|written|released|mixed|vocals|additional|co-produced|performed|label)\b/i.test(value)) return false;
    if (!/[A-Za-z]/.test(value)) return false;
    if (/^\d+$/.test(value)) return false;
    return true;
  };

  const ensureNameSearchStyles = () => {
    if (document.getElementById('emdb-credit-name-search-style')) return;
    const style = document.createElement('style');
    style.id = 'emdb-credit-name-search-style';
    style.textContent = [
      '.credit-name-search-global {',
      '  all: unset;',
      '  display: inline;',
      '  color: inherit;',
      '  cursor: pointer;',
      '}',
      '.credit-name-search-global:hover,',
      '.credit-name-search-global:focus-visible {',
      '  color: #E21C21;',
      '}',
      '.release-credit-value,',
      '.release-credit-value .credit-name-search-global {',
      '  color: #ddd;',
      '}',
      '.release-credit-value .credit-name-search-global:hover,',
      '.release-credit-value .credit-name-search-global:focus-visible {',
      '  color: #E21C21;',
      '}',
      '.track-details em a.track-release-link,',
      '.track-details em a.track-release-link:visited,',
      '.track-details em a.track-release-link {',
      '  color: inherit;',
      '  text-decoration: none;',
      '}',
      '.track-details em a.track-release-link:hover,',
      '.track-details em a.track-release-link:focus-visible {',
      '  color: #E21C21;',
      '  text-decoration: none;',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  };

  const triggerSiteSearch = (term) => {
    const raw = String(term || '').trim();
    const query = searchAliases.get(normalize(raw)) || raw;
    if (!query) return;

    const normalizeSearchQuery = (value) => String(value || '')
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

    const isExact = true;
    if (isExact) {
      const normalizedExactQuery = normalizeSearchQuery(query);
      if (normalizedExactQuery) {
        window.__emdbSearchExact = {
          query: normalizedExactQuery,
          expiresAt: Date.now() + 120000
        };
      }
    }

    const apply = (input) => {
      input.value = query;
      input.focus();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('search', { bubbles: true }));
      requestAnimationFrame(() => input.focus());
    };

    const existing = document.getElementById('siteSearch');
    if (existing) {
      apply(existing);
      return;
    }

    let attempts = 0;
    const maxAttempts = 20;
    const retry = () => {
      const input = document.getElementById('siteSearch');
      if (input) {
        apply(input);
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) setTimeout(retry, 120);
    };
    retry();
  };

  const setupDelegatedCreditNameSearch = () => {
    if (window.__emdbCreditNameDelegatedBound) return;
    window.__emdbCreditNameDelegatedBound = true;

    document.addEventListener('mousedown', (event) => {
      const target = event.target && event.target.closest
        ? event.target.closest('.credit-name-search-global')
        : null;
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    document.addEventListener('click', (event) => {
      const target = event.target && event.target.closest
        ? event.target.closest('.credit-name-search-global')
        : null;
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      const term = target.getAttribute('data-search-term') || target.textContent || '';
      triggerSiteSearch(term);
    }, true);
  };
  setupDelegatedCreditNameSearch();

  const makeNameButton = (name) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'credit-name-search-global';
    btn.textContent = name;
    btn.setAttribute('data-search-term', name);
    btn.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      triggerSiteSearch(name);
    });
    return btn;
  };

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const decodeHtml = (value) => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = String(value || '');
    return textarea.value;
  };

  const decodeHtmlDeep = (value) => {
    let out = String(value || '');
    for (let i = 0; i < 4; i += 1) {
      const next = decodeHtml(out);
      if (next === out) break;
      out = next;
    }
    return out;
  };

  const renderLinkedNames = (value, contextNode) => {
    const text = decodeHtmlDeep(String(value || '')).trim();
    if (!text) return '';
    const normalizedText = normalize(text);
    const cleanCreditNameToken = (token) => String(token || '')
      .replace(/\s*\((?:part|pt\.?)\s*[^)]*\)\s*$/i, '')
      .trim();

    // Preserve explicit alias phrases as one clickable query (e.g., Mark & Jeff Bass -> Bass Brothers).
    if (searchAliases.has(normalizedText)) {
      return makeNameButton(text).outerHTML;
    }

    // Keep known duo/group acts as one search term.
    if (nonSplittableActs.has(normalizedText)) {
      return makeNameButton(text).outerHTML;
    }

    const parts = text.split(/(\s*(?:,|•|&|\band\b)\s*)/i).filter(Boolean);
    if (parts.length <= 1) {
      const singleToken = cleanCreditNameToken(text) || text;
      return shouldLinkName(singleToken, contextNode)
        ? makeNameButton(singleToken).outerHTML
        : escapeHtml(text);
    }

    let out = '';
    parts.forEach((part, index) => {
      if (index % 2 === 1) {
        out += escapeHtml(part);
        return;
      }
      const token = part.trim();
      if (!token) {
        out += escapeHtml(part);
        return;
      }

      const cleanedToken = cleanCreditNameToken(token);

      const linkToken = cleanedToken || token;
      out += shouldLinkName(linkToken, contextNode)
        ? makeNameButton(linkToken).outerHTML
        : escapeHtml(token);
    });
    return out;
  };

  const findReleaseHrefInFromLine = (lineText) => {
    const text = decodeHtmlDeep(String(lineText || '')).trim();
    if (!/^from\b/i.test(text)) return null;

    const remainder = text.replace(/^from\s+/i, '').trim();
    if (!remainder) return null;

    for (let i = 0; i < releaseLineMatchers.length; i += 1) {
      const entry = releaseLineMatchers[i];
      if (entry.pattern.test(remainder)) {
        return entry.href;
      }
    }
    return null;
  };

  const linkReleaseTrackText = (root) => {
    root.querySelectorAll('.track-details, .track-feat, .track-note').forEach((node) => {
      if (node.querySelector('.credit-name-search-global')) return;
      if (isCopyrightContext(node)) return;
      if (node.classList.contains('disc-toggle')) return;

      const linkCreditBubbles = (container) => {
        container.querySelectorAll('.credit-bubble').forEach((bubble) => {
          if (bubble.querySelector('.credit-name-search-global')) return;
          const raw = decodeHtmlDeep(String(bubble.textContent || '')).trim();
          if (!raw) return;

          const roleMatch = raw.match(/^(verses?|chorus|hook|bridge)\s*:\s*(.+)$/i);
          if (!roleMatch) return;

          const role = roleMatch[1];
          const names = roleMatch[2];
          bubble.innerHTML = `${escapeHtml(role)}: ${renderLinkedNames(names, bubble)}`;
        });
      };

      const bubbleContainer = node.querySelector('.credit-bubbles');
      if (bubbleContainer) {
        linkCreditBubbles(bubbleContainer);
      }

      const clone = node.cloneNode(true);
      clone.querySelectorAll('.credit-bubbles').forEach((el) => el.remove());
      const html = String(clone.innerHTML || '').trim();
      if (!html) return;

      const lineParts = html
        .split(/<br\s*\/?>/i)
        .map((part) => part.trim())
        .filter(Boolean);

      if (!lineParts.length) return;

      const rebuilt = [];
      lineParts.forEach((part) => {
        const emphasized = /<\s*em\b/i.test(part);
        const text = decodeHtmlDeep(part.replace(/<[^>]+>/g, '')).trim();
        if (!text) return;

        const fromHref = findReleaseHrefInFromLine(text);
        if (fromHref) {
          const albumText = text.replace(/^from\s+/i, '').trim();
          const linked = `From <a class="track-release-link" href="${escapeHtml(fromHref)}">${escapeHtml(albumText)}</a>`;
          rebuilt.push(emphasized ? `<em>${linked}</em>` : linked);
          return;
        }

        if (/^from\b/i.test(text)) {
          rebuilt.push(emphasized ? `<em>${escapeHtml(text)}</em>` : escapeHtml(text));
          return;
        }

        // Keep dedicated-page notes as plain text (not searchable/clickable).
        if (
          /^available\s+instrumentals\s+are\s+listed\s+separately\s+on\s+the\s+instrumentals\s+page\.?$/i.test(text)
          || /^available\s+instrumentals\s+are\s+listed\s+separately\s+on\s+its\s+dedicated\s+page\.?$/i.test(text)
          || /^available\s+instrumentals\s+are\s+listed\s+separately\s+on\s+their\s+dedicated\s+page\.?$/i.test(text)
          || /^available\s+acapellas\s+and\s+instrumentals\s+are\s+listed\s+separately\s+on\s+their\s+dedicated\s+pages\.?$/i.test(text)
          || /^additional\s+instrumentals\s+are\s+listed\s+separately\s+on\s+their\s+dedicated(?:\s+page)?\.?$/i.test(text)
          || /^additional\s+acapellas\s+and\s+instrumentals\s+are\s+listed\s+separately\s+on\s+their\s+dedicated(?:\s+pages?)?\.?$/i.test(text)
        ) {
          rebuilt.push(emphasized ? `<em>${escapeHtml(text)}</em>` : escapeHtml(text));
          return;
        }

        // Keep release-note style "included on ..." lines as plain text (no search linking).
        if (/\bincluded\s+on\b/i.test(text)) {
          rebuilt.push(emphasized ? `<em>${escapeHtml(text)}</em>` : escapeHtml(text));
          return;
        }

        // Handle prose credits like:
        // "Bizarre is credited as a featured artist on the UK Limited Edition cassette"
        // Only the leading artist name should be searchable/clickable.
        const creditedAsMatch = text.match(/^(.+?)\s+is\s+credited\s+as\s+(.+)$/i);
        if (creditedAsMatch) {
          const artistName = creditedAsMatch[1].trim();
          const rest = creditedAsMatch[2].trim();
          const linkedName = shouldLinkName(artistName, node)
            ? makeNameButton(artistName).outerHTML
            : escapeHtml(artistName);
          const sentenceHtml = `${linkedName} is credited as ${escapeHtml(rest)}`;
          rebuilt.push(emphasized ? `<em>${sentenceHtml}</em>` : sentenceHtml);
          return;
        }

        // Handle inline feat phrases in track-feat/details, e.g.
        // "Bad Meets Evil feat. Bruno Mars" or
        // "Rob Bailey & The Hustle Standard feat. Busta Rhymes, KXNG Crooked & Tech N9ne".
        const inlineFeatMatch = text.match(/^(.+?)\s+(feat\.?|featuring)\s+(.+)$/i);
        if (inlineFeatMatch) {
          const leadArtists = inlineFeatMatch[1].trim();
          const featLabel = inlineFeatMatch[2].trim();
          const featuredArtists = inlineFeatMatch[3].trim();

          if (leadArtists && featuredArtists) {
            rebuilt.push(`${renderLinkedNames(leadArtists, node)} ${escapeHtml(featLabel)} ${renderLinkedNames(featuredArtists, node)}`);
            return;
          }
        }

        const prefixMatch = text.match(/^((?:performed|produced(?: and mixed)?|mixed|written|composed|recorded(?: at)?|mastered|additional production|additional vocals|engineered|co-produced)\s+by|featuring|feat\.?|feat|with|verses?|chorus|hook|bridge)\s*:?[\s]+(.+)$/i);
        if (prefixMatch) {
          const prefix = prefixMatch[1].replace(/\s+$/, '');
          const value = prefixMatch[2].trim();
          const separator = /^(verses?|chorus|hook|bridge)$/i.test(prefix) ? ': ' : ' ';
          rebuilt.push(`${escapeHtml(prefix)}${separator}${renderLinkedNames(value, node)}`);
          return;
        }

        rebuilt.push(renderLinkedNames(text, node));
      });

      if (rebuilt.length) {
        const bubbleHtml = bubbleContainer ? bubbleContainer.outerHTML : '';
        node.innerHTML = bubbleHtml + rebuilt.join('<br>');
      }
    });
  };

  const linkReleaseInfoEntities = (root) => {
    root.querySelectorAll('.release-info strong').forEach((strong) => {
      const label = normalize(strong.textContent || '');
      if (!/(released|executive producers?|studios?|mastering engineer|recorded(?: at)?|labels?)/i.test(label)) return;
      const isLabelLine = /labels?/i.test(label);

      let node = strong.nextSibling;
      while (node && node.nodeType === Node.TEXT_NODE && !String(node.nodeValue || '').trim()) {
        node = node.nextSibling;
      }

      if (!node || node.nodeType !== Node.TEXT_NODE) return;

      const text = String(node.nodeValue || '').trim();
      if (!text) return;

      const parts = text.split(/\s*•\s*/).map((part) => part.trim()).filter(Boolean);
      if (!parts.length) return;

      const fragment = document.createDocumentFragment();
      fragment.appendChild(document.createTextNode(' '));
      parts.forEach((part, index) => {
        if (index > 0) fragment.appendChild(document.createTextNode(' • '));
        const valueEl = document.createElement('span');
        valueEl.className = 'release-credit-value';
        if (!isLabelLine && shouldLinkName(part, strong)) {
          valueEl.appendChild(makeNameButton(part));
        } else {
          valueEl.textContent = part;
        }
        fragment.appendChild(valueEl);
      });

      node.parentNode.replaceChild(fragment, node);
    });
  };

  const shouldLinkName = (name, contextNode) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return false;
    if (!isLikelyPersonName(trimmed)) return false;
    if (isCopyrightContext(contextNode)) return false;
    if (blockedNames.has(normalize(trimmed))) return false;
    return true;
  };

  const linkMetaNames = (root) => {
    root.querySelectorAll('.meta-name').forEach((node) => {
      if (node.querySelector('.credit-name-search-global')) return;
      const value = (node.textContent || '').trim();
      if (!shouldLinkName(value, node)) return;
      node.textContent = '';
      node.appendChild(makeNameButton(value));
    });
  };

  const linkInlineNames = (root) => {
    root.querySelectorAll('.written-by .meta-value, .credit-pair .meta-value').forEach((node) => {
      if (node.querySelector('.credit-name-search-global')) return;
      if (isCopyrightContext(node)) return;
      const text = (node.textContent || '').trim();
      if (!text) return;

      const fragments = text.split(/\s*,\s*/).map((part) => part.trim()).filter(Boolean);
      if (!fragments.length) return;

      node.textContent = '';
      fragments.forEach((part, index) => {
        if (index > 0) node.appendChild(document.createTextNode(', '));
        if (shouldLinkName(part, node)) {
          node.appendChild(makeNameButton(part));
        } else {
          node.appendChild(document.createTextNode(part));
        }
      });
    });
  };

  const linkCollectionEntities = (root) => {
    root.querySelectorAll('.track-artist, .album-artist, .track-feat, .track-producer').forEach((node) => {
      if (!node || node.closest('.promo-note')) return;
      if (node.querySelector('.credit-name-search-global')) return;
      if (isCopyrightContext(node)) return;

      const text = decodeHtmlDeep(String(node.textContent || '')).trim();
      if (!text || /^n\/?a$/i.test(text)) return;

      const prefixedCredits = text.match(/^((?:produced(?: and mixed)?|co-produced|additional production|mixed|written|performed)\s+by|feat\.?|featuring|with)\s+(.+)$/i);
      if (prefixedCredits) {
        const prefix = prefixedCredits[1].trim();
        const value = prefixedCredits[2].trim();
        if (!value || /^n\/?a$/i.test(value)) {
          node.innerHTML = escapeHtml(text);
          return;
        }
        node.innerHTML = `${escapeHtml(prefix)} ${renderLinkedNames(value, node)}`;
        return;
      }

      const inlineFeatMatch = text.match(/^(.+?)\s+(feat\.?|featuring|with)\s+(.+)$/i);
      if (inlineFeatMatch) {
        const leadArtists = inlineFeatMatch[1].trim();
        const featLabel = inlineFeatMatch[2].trim();
        const featuredArtists = inlineFeatMatch[3].trim();
        if (!leadArtists || !featuredArtists || /^n\/?a$/i.test(featuredArtists)) {
          node.innerHTML = escapeHtml(text);
          return;
        }
        node.innerHTML = `${renderLinkedNames(leadArtists, node)} ${escapeHtml(featLabel)} ${renderLinkedNames(featuredArtists, node)}`;
        return;
      }

      node.innerHTML = renderLinkedNames(text, node);
    });
  };

  const enhanceRoot = (root) => {
    if (!root || root.dataset.creditSearchLinked === 'true') return;
    ensureNameSearchStyles();
    linkMetaNames(root);
    linkInlineNames(root);
    if (path.includes('/releases/')) {
      linkReleaseInfoEntities(root);
      linkReleaseTrackText(root);
    }
    if (isCollectionPage) {
      linkCollectionEntities(root);
    }
    root.dataset.creditSearchLinked = 'true';
  };

  const run = () => {
    const selectors = ['.release-info', '.song-meta', '.credits-collapsible', '.tracklist'];
    if (isCollectionPage) selectors.push('main');
    const roots = Array.from(document.querySelectorAll(selectors.join(', ')));
    if (!roots.length) return;
    roots.forEach(enhanceRoot);
  };

  run();

  const observer = new MutationObserver(() => run());
  observer.observe(document.body, { childList: true, subtree: true });
}

function enforceTriviaBullets() {
  const headings = Array.from(document.querySelectorAll('h2, h3'));

  headings.forEach((heading) => {
    if ((heading.textContent || '').trim().toLowerCase() !== 'trivia') return;

    const section = heading.closest('.song-extra') || heading.parentElement;
    if (!section) return;

    const list = section.querySelector('ul');
    if (!list) return;

    // Force native list rendering even when inline styles set display:flex.
    list.style.setProperty('display', 'block', 'important');
    list.style.setProperty('list-style-type', 'disc', 'important');
    list.style.setProperty('list-style-position', 'outside', 'important');
    if (!list.style.paddingLeft) {
      list.style.setProperty('padding-left', '1.1rem');
    }

    Array.from(list.querySelectorAll('li')).forEach((item, index, arr) => {
      item.style.setProperty('display', 'list-item', 'important');
      if (index < arr.length - 1) {
        item.style.setProperty('margin-bottom', '12px', 'important');
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapLayoutPartials);
} else {
  bootstrapLayoutPartials();
}
