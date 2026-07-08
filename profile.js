function getSupabaseClient() {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    return window.supabase.createClient(
      "https://lbxpucsgwgtamolvjuep.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxieHB1Y3Nnd2d0YW1vbHZqdWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTM1MjcsImV4cCI6MjA4NzA2OTUyN30.KvC6zRMZtE8owQiXleNqlQvaoKoYL-NQQJr0928K3iY"
    );
  }
  return null;
}

const supabaseClient = getSupabaseClient();

const statusEl = document.getElementById('profileStatus');
const usernameEl = document.getElementById('profileUsername');
const joinDateEl = document.getElementById('profileJoinDate');
const levelEl = document.getElementById('profileLevel');
const xpEl = document.getElementById('profileXp');
const xpProgressEl = document.getElementById('profileXpProgress');
const avatarImg = document.getElementById('profileAvatar');
const favoriteSongsEl = document.getElementById('favoriteSongs');
const favoritePickerEl = document.getElementById('favoritePicker');
const favoritePickerCloseEl = document.getElementById('favoritePickerClose');
const favoritePickerTitleEl = document.getElementById('favoritePickerTitle');
const favoritePickerBodyEl = favoritePickerEl ? favoritePickerEl.querySelector('.favorite-picker-body') : null;
const favoriteSearchInputEl = document.getElementById('favoriteSearchInput');
const favoriteSearchResultsEl = document.getElementById('favoriteSearchResults');
const settingsToggleEl = document.querySelector('.settings-toggle');

const setStatus = (text, tone = 'neutral') => {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.dataset.tone = tone;
};

const albumRatingsState = {
  items: [],
  sortBy: 'date',
  sortDir: 'desc'
};

const songRatingsState = {
  items: [],
  sortBy: 'date',
  sortDir: 'desc'
};

const reviewsState = {
  sortBy: 'date',
  sortDir: 'desc'
};

const thoughtsState = {
  sortBy: 'date',
  sortDir: 'desc'
};

let activeProfileUserId = null;
let isOwnProfileView = true;
let topFiveActionMenuEl = null;
let topFiveActionMenuSlot = null;

const favoriteSongsState = {
  userId: null,
  items: [null, null, null, null, null],
  activeSlot: null,
  catalog: null,
  catalogPromise: null,
  mode: 'albums'
};

const favoriteAlbumsState = {
  items: [null, null, null, null, null],
  catalog: null,
  catalogPromise: null
};

const top5XpSlotsState = {
  userId: null,
  slots: [false, false, false, false, false]
};

const EXCLUDED_TOP5_ALBUM_SLUGS = new Set([
  'songs-featuring-eminem',
  'feat',
  'non-album-tracks',
  'non-album',
  'production-discography',
  'produced-only'
]);

const formatScore = (value) => {
  const num = Number(value) || 0;
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
};

const normalizeAzTitle = (value) => {
  return (value || '')
    .toLowerCase()
    .replace(/[’‘']/g, '')
    .replace(/^\s*(the|a|an)\s+/, '')
    .trim();
};

const updateSectionCount = (countId, value) => {
  const el = document.getElementById(countId);
  if (!el) return;
  const n = Number.isFinite(Number(value)) ? Number(value) : 0;
  el.textContent = `(${Math.max(0, n)})`;
};

const sortRatedItems = (items, sortBy, sortDir = 'desc') => {
  const dir = sortDir === 'asc' ? 1 : -1;
  const sorted = items.slice();
  if (sortBy === 'date') {
    sorted.sort((a, b) => {
      const left = new Date(a.dateAdded || 0).getTime() || 0;
      const right = new Date(b.dateAdded || 0).getTime() || 0;
      const diff = (left - right) * dir;
      if (diff !== 0) return diff;
      return (a.title || '').localeCompare(b.title || '');
    });
    return sorted;
  }

  if (sortBy === 'az') {
    sorted.sort((a, b) => {
      const left = normalizeAzTitle(a.title);
      const right = normalizeAzTitle(b.title);
      const diff = left.localeCompare(right) * dir;
      if (diff !== 0) return diff;
      return (a.title || '').localeCompare(b.title || '');
    });
    return sorted;
  }

  if (sortBy === 'emdb') {
    sorted.sort((a, b) => {
      const diff = ((a.emdbRating || 0) - (b.emdbRating || 0)) * dir;
      if (diff !== 0) return diff;
      return (a.title || '').localeCompare(b.title || '');
    });
    return sorted;
  }

  if (sortBy === 'count') {
    sorted.sort((a, b) => {
      const diff = ((a.ratingCount || 0) - (b.ratingCount || 0)) * dir;
      if (diff !== 0) return diff;
      return (a.title || '').localeCompare(b.title || '');
    });
    return sorted;
  }

  sorted.sort((a, b) => {
    const diff = ((a.userRating || 0) - (b.userRating || 0)) * dir;
    if (diff !== 0) return diff;
    return (a.title || '').localeCompare(b.title || '');
  });
  return sorted;
};

const ratingCountLabel = (count) => (count === 1 ? '1 rating' : `${count} ratings`);

const renderEmpty = (container, label) => {
  if (!container) return;
  container.innerHTML = `<p class="ratings-empty">No ${label} rated yet.</p>`;
};

const formatDate = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const fallbackCalculateLevel = (xp) => {
  const safeXp = Math.max(0, Number(xp) || 0);
  return Math.min(11, Math.floor(safeXp / 100) + 1);
};

const renderXpState = (xpValue, levelValue) => {
  const safeXp = Math.max(0, Number(xpValue) || 0);
  const calcLevel = window.EMDbXP && typeof window.EMDbXP.calculateLevel === 'function'
    ? window.EMDbXP.calculateLevel
    : fallbackCalculateLevel;
  const computedLevel = calcLevel(safeXp);
  const safeLevel = Math.max(1, Math.min(11, Number(levelValue) || computedLevel));
  const levelName = window.EMDbXP && typeof window.EMDbXP.getLevelName === 'function'
    ? window.EMDbXP.getLevelName(safeLevel)
    : (safeLevel === 11 ? 'Stan' : `Level ${safeLevel}`);

  const block = document.getElementById('profileXpBlock');
  const barFill = document.getElementById('profileXpBarFill');

  if (levelEl) levelEl.textContent = `${levelName}`;
  if (xpEl) xpEl.textContent = `(${safeXp})`;

  if (safeLevel >= 11) {
    if (xpProgressEl) xpProgressEl.textContent = '';
    if (barFill) barFill.style.width = '100%';
    if (block) block.style.display = '';
    return;
  }

  const currentLevelStart = (safeLevel - 1) * 100;
  const nextLevelXp = safeLevel * 100;
  const inLevel = Math.max(0, safeXp - currentLevelStart);
  const need = Math.max(1, nextLevelXp - currentLevelStart);
  const pct = Math.min(100, Math.round((inLevel / need) * 100));

  if (barFill) barFill.style.width = `${pct}%`;
  if (xpProgressEl) xpProgressEl.textContent = '';
  if (block) block.style.display = '';
};

const getTop5XpSlotsKey = (userId) => `emdb_top5_xp_slots_v1_${userId || 'anon'}`;

const persistTop5XpSlotsState = () => {
  if (!top5XpSlotsState.userId) return;
  localStorage.setItem(getTop5XpSlotsKey(top5XpSlotsState.userId), JSON.stringify(top5XpSlotsState.slots));
};

const syncTop5XpSlotsWithCurrentItems = () => {
  favoriteAlbumsState.items.forEach((item, idx) => {
    if (item) top5XpSlotsState.slots[idx] = true;
  });
};

const initTop5XpSlotsState = (userId) => {
  top5XpSlotsState.userId = userId || null;
  top5XpSlotsState.slots = [false, false, false, false, false];
  if (!userId) return;
  try {
    const raw = localStorage.getItem(getTop5XpSlotsKey(userId));
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    top5XpSlotsState.slots = [0, 1, 2, 3, 4].map((idx) => !!parsed[idx]);
  } catch (err) {
    // ignore malformed local cache
  }
};

const refreshOwnXpState = async () => {
  if (!supabaseClient || !isOwnProfileView || !activeProfileUserId) return;
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('xp, level')
    .eq('id', activeProfileUserId)
    .maybeSingle();
  if (error || !data) return;
  renderXpState(data.xp, data.level);
};

const countRowsForUser = async (table, userId) => {
  if (!supabaseClient || !userId) return 0;
  const { count, error } = await supabaseClient
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) {
    console.error(`[XP] count failed for ${table}:`, error);
    return 0;
  }
  return Math.max(0, Number(count) || 0);
};

const reconcileHistoricalXp = async (userId, profileData) => {
  if (!supabaseClient || !userId || !profileData) return profileData;

  const [songRatingsCount, albumRatingsCount, albumReviewsCount, songReviewsCount] = await Promise.all([
    countRowsForUser('song_ratings', userId),
    countRowsForUser('album_ratings', userId),
    countRowsForUser('album_reviews', userId),
    countRowsForUser('song_reviews', userId)
  ]);

  const topAlbumsFilled = normalizeTopIdArray(profileData.topAlbums).filter((id) => Number.isInteger(id)).length;

  const expectedXp = (songRatingsCount * 1)
    + (albumRatingsCount * 10)
    + (albumReviewsCount * 10)
    + (songReviewsCount * 1)
    + (topAlbumsFilled * 2);

  const currentXp = Math.max(0, Number(profileData.xp) || 0);
  if (currentXp >= expectedXp) return profileData;

  const nextLevel = window.EMDbXP && typeof window.EMDbXP.calculateLevel === 'function'
    ? window.EMDbXP.calculateLevel(expectedXp)
    : fallbackCalculateLevel(expectedXp);

  const { error } = await supabaseClient
    .from('profiles')
    .update({
      xp: expectedXp,
      level: nextLevel,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (error) {
    console.error('[XP] historical reconcile failed:', { userId, expectedXp, error });
    return profileData;
  }

  console.log('[XP] historical reconcile applied', {
    userId,
    fromXp: currentXp,
    toXp: expectedXp,
    fromLevel: Number(profileData.level) || fallbackCalculateLevel(currentXp),
    toLevel: nextLevel,
    sources: {
      songRatingsCount,
      albumRatingsCount,
      albumReviewsCount,
      songReviewsCount,
      topAlbumsFilled
    }
  });

  return {
    ...profileData,
    xp: expectedXp,
    level: nextLevel
  };
};

const deriveUsername = (email) => {
  if (!email) return 'listener';
  const base = email.split('@')[0] || 'listener';
  return base.slice(0, 32);
};

const normalizeAvatar = (path) => {
  const raw = String(path || '').trim().replace(/\\/g, '/');
  if (!raw) return '/images/avatars/avatar-1.jpg';
  if (raw.startsWith('/images/album-covers-tn/')) return raw;
  const avatarMatch = raw.match(/avatar[_-]?(\d+)\.(?:jpe?g|png|webp|gif)$/i);
  if (avatarMatch) return `/images/avatars/avatar-${Number(avatarMatch[1])}.jpg`;
  if (/^\/images\/avatars\/avatar-\d+\.jpg$/i.test(raw)) return raw.toLowerCase();
  return '/images/avatars/avatar-1.jpg';
};

const normalizeText = (value) => (value || '')
  .toLowerCase()
  .replace(/[’‘']/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const FAVORITES_COUNT = 5;
const DEFAULT_SONG_COVER = '/images/logos/songs-with-cover.jpg';

const normalizeTopIdArray = (arr) => {
  const normalized = Array.isArray(arr)
    ? arr.slice(0, FAVORITES_COUNT).map((id) => (Number.isInteger(id) ? id : null))
    : [];
  while (normalized.length < FAVORITES_COUNT) normalized.push(null);
  return normalized;
};

const persistTopIds = async (column, items) => {
  if (!supabaseClient || !favoriteSongsState.userId) return false;
  const payload = items.slice(0, FAVORITES_COUNT).map((item) => (
    item && Number.isInteger(item.id) ? item.id : null
  ));
  const { error } = await supabaseClient
    .from('profiles')
    .update({
      [column]: payload,
      updated_at: new Date().toISOString()
    })
    .eq('id', favoriteSongsState.userId);
  if (error) {
    console.error(`Failed updating ${column}:`, error);
    return false;
  }
  return true;
};

const formatSongUrl = (songSlug, albumSlugRaw) => {
  if (!songSlug || !albumSlugRaw) return '';
  const albumSlugOverrides = {
    'non-album-tracks': 'non-album',
    'songs-featuring-eminem': 'feat',
    'production-discography': 'produced-only',
    'songs-underground-ep': 'underground-ep'
  };
  const albumSlug = albumSlugOverrides[albumSlugRaw] || albumSlugRaw;
  return `/songs/${albumSlug}/${songSlug}.html`;
};

const mapSongRowToTopItem = (song) => {
  const albumList = Array.isArray(song.albums)
    ? song.albums
    : (song.albums ? [song.albums] : []);
  const album = albumList[0] || null;
  const url = formatSongUrl(song.slug || '', album && album.slug ? album.slug : '');
  if (!url) return null;
  return {
    id: Number(song.id),
    title: song.title || 'Untitled song',
    url,
    cover_url: song.cover_url || (album && album.cover_url ? album.cover_url : '') || ''
  };
};

const mapAlbumRowToTopItem = (album) => {
  const slug = album.slug || '';
  if (!slug) return null;
  return {
    id: Number(album.id),
    title: album.title || 'Untitled album',
    url: `/releases/${slug}.html`,
    cover_url: album.cover_url || ''
  };
};

const fetchSongMapByIds = async (ids) => {
  if (!supabaseClient || !ids.length) return new Map();
  const { data, error } = await supabaseClient
    .from('songs')
    .select('id,title,slug,cover_url,albums!inner(slug,cover_url)')
    .in('id', ids);
  if (error || !data) {
    if (error) console.error('Failed fetching top songs by ids:', error);
    return new Map();
  }
  const map = new Map();
  data.forEach((row) => {
    const item = mapSongRowToTopItem(row);
    if (!item) return;
    map.set(item.id, item);
  });
  return map;
};

const fetchAlbumMapByIds = async (ids) => {
  if (!supabaseClient || !ids.length) return new Map();
  const { data, error } = await supabaseClient
    .from('albums')
    .select('id,title,slug,cover_url')
    .in('id', ids);
  if (error || !data) {
    if (error) console.error('Failed fetching top albums by ids:', error);
    return new Map();
  }
  const map = new Map();
  data.forEach((row) => {
    const item = mapAlbumRowToTopItem(row);
    if (!item) return;
    map.set(item.id, item);
  });
  return map;
};

const resolveTopItemsFromProfile = async (profileData) => {
  const albumSlots = normalizeTopIdArray(profileData && profileData.topAlbums);
  const albumIds = [...new Set(albumSlots.filter((id) => Number.isInteger(id)))];

  const albumMap = await fetchAlbumMapByIds(albumIds);

  favoriteAlbumsState.items = albumSlots.map((id) => (
    Number.isInteger(id) && albumMap.has(id) ? albumMap.get(id) : null
  ));
};

const fetchFavoriteSongCatalog = async () => {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from('songs')
    .select('id,title,slug,cover_url,albums!inner(slug,cover_url)')
    .order('title', { ascending: true })
    .limit(5000);
  if (error || !data) return [];

  const mapped = data.map((song) => {
    const albumList = Array.isArray(song.albums)
      ? song.albums
      : (song.albums ? [song.albums] : []);
    const album = albumList[0] || null;
    const url = formatSongUrl(song.slug || '', album && album.slug ? album.slug : '');
    if (!url) return null;
    return {
      id: Number(song.id),
      title: song.title || 'Untitled song',
      url,
      cover_url: song.cover_url || (album && album.cover_url ? album.cover_url : '') || '',
      search: normalizeText(song.title || '')
    };
  }).filter(Boolean);

  const seen = new Set();
  return mapped.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
};

const fetchFavoriteAlbumCatalog = async () => {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from('albums')
    .select('id,title,slug,cover_url')
    .order('title', { ascending: true })
    .limit(5000);
  if (error || !data) return [];

  return data
    .map((album) => {
      const slug = album.slug || '';
      if (!slug) return null;
      if (EXCLUDED_TOP5_ALBUM_SLUGS.has(slug)) return null;
      return {
        id: Number(album.id),
        title: album.title || 'Untitled album',
        url: `/releases/${slug}.html`,
        cover_url: album.cover_url || '',
        search: normalizeText(album.title || '')
      };
    })
    .filter(Boolean);
};

const ensureFavoriteSongCatalog = async () => {
  if (favoriteSongsState.catalog) return favoriteSongsState.catalog;
  if (!favoriteSongsState.catalogPromise) {
    favoriteSongsState.catalogPromise = fetchFavoriteSongCatalog()
      .then((items) => {
        favoriteSongsState.catalog = items;
        return items;
      })
      .catch(() => {
        favoriteSongsState.catalog = [];
        return [];
      });
  }
  return favoriteSongsState.catalogPromise;
};

const ensureFavoriteAlbumCatalog = async () => {
  if (favoriteAlbumsState.catalog) return favoriteAlbumsState.catalog;
  if (!favoriteAlbumsState.catalogPromise) {
    favoriteAlbumsState.catalogPromise = fetchFavoriteAlbumCatalog()
      .then((items) => {
        favoriteAlbumsState.catalog = items;
        return items;
      })
      .catch(() => {
        favoriteAlbumsState.catalog = [];
        return [];
      });
  }
  return favoriteAlbumsState.catalogPromise;
};

const getTopFiveItems = () => favoriteAlbumsState.items;

const closeTopFiveActionMenu = () => {
  if (!topFiveActionMenuEl) return;
  topFiveActionMenuEl.classList.remove('open');
  topFiveActionMenuEl.setAttribute('aria-hidden', 'true');
  topFiveActionMenuEl.innerHTML = '';
  topFiveActionMenuSlot = null;
};

const ensureTopFiveActionMenu = () => {
  if (topFiveActionMenuEl) return topFiveActionMenuEl;
  const menu = document.createElement('div');
  menu.className = 'top5-action-menu';
  menu.setAttribute('aria-hidden', 'true');
  document.body.appendChild(menu);
  topFiveActionMenuEl = menu;
  return menu;
};

const openTopFiveActionMenu = (slotIndex, item, anchorEl) => {
  if (!item || !anchorEl) return;
  const menu = ensureTopFiveActionMenu();
  topFiveActionMenuSlot = slotIndex;

  menu.innerHTML = `
    <button type="button" class="top5-action-item" data-top5-action="open">Go to album</button>
    <button type="button" class="top5-action-item" data-top5-action="change">Change album</button>
    <button type="button" class="top5-action-item top5-action-item--danger" data-top5-action="remove">Remove album</button>
  `;

  menu.classList.add('open');
  menu.setAttribute('aria-hidden', 'false');

  menu.querySelectorAll('.top5-action-item').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const action = btn.dataset.top5Action;
      closeTopFiveActionMenu();

      if (action === 'open' && item.url) {
        window.location.href = item.url;
        return;
      }

      if (action === 'change') {
        openFavoritePicker(slotIndex);
        return;
      }

      if (action === 'remove') {
        favoriteAlbumsState.items[slotIndex] = null;
        await persistTopIds('top_albums', favoriteAlbumsState.items);
        renderFavoriteSongs();
      }
    });
  });
};

const updateTopFiveModeUi = () => {
  if (favoriteSongsEl) {
    favoriteSongsEl.setAttribute('aria-label', 'Top 5 albums');
  }
};

const renderFavoriteSongs = () => {
  if (!favoriteSongsEl) return;
  favoriteSongsEl.innerHTML = '';

  const activeItems = getTopFiveItems();

  activeItems.forEach((item, index) => {
    const itemWrap = document.createElement('div');
    itemWrap.className = 'favorite-item';

    const slot = document.createElement('div');
    slot.className = `favorite-slot ${item ? 'filled' : 'empty'}`;
    const typeLabel = 'album';
    slot.setAttribute('aria-label', item ? `${isOwnProfileView ? 'Change' : 'Top'} ${typeLabel} ${index + 1}` : `Add top ${typeLabel} ${index + 1}`);
    slot.dataset.slot = String(index);
    slot.style.cursor = isOwnProfileView ? 'pointer' : 'default';

    if (isOwnProfileView) {
      slot.setAttribute('role', 'button');
      slot.setAttribute('tabindex', '0');
    }

    if (item) {
      const img = document.createElement('img');
      img.src = item.cover_url || DEFAULT_SONG_COVER;
      img.alt = item.title;
      slot.appendChild(img);
    }

    if (isOwnProfileView) {
      const onSlotAction = () => {
        if (item) {
          openTopFiveActionMenu(index, item, slot);
          return;
        }
        openFavoritePicker(index);
      };
      slot.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onSlotAction();
      });
      slot.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSlotAction();
        }
      });
    }

    const title = document.createElement('p');
    title.className = 'favorite-title';
    title.textContent = item ? item.title : '';

    itemWrap.appendChild(slot);
    itemWrap.appendChild(title);
    favoriteSongsEl.appendChild(itemWrap);
  });
};

const renderFavoriteSearchResults = (query) => {
  if (!favoriteSearchResultsEl) return;
  const q = normalizeText(query);
  const all = favoriteAlbumsState.catalog || [];
  const activeSlot = favoriteSongsState.activeSlot;
  const usedIds = new Set(
    favoriteAlbumsState.items
      .filter((entry, idx) => idx !== activeSlot && entry && Number.isInteger(entry.id))
      .map((entry) => entry.id)
  );
  const available = all.filter((item) => !usedIds.has(item.id));
  const filtered = q ? available.filter((item) => item.search.includes(q)).slice(0, 400) : available.slice(0, 400);

  favoriteSearchResultsEl.innerHTML = '';
  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'favorite-empty';
    empty.textContent = 'No albums found.';
    favoriteSearchResultsEl.appendChild(empty);
    return;
  }

  filtered.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'favorite-result-btn';
    btn.innerHTML = `
      <img class="favorite-result-thumb" src="${item.cover_url || DEFAULT_SONG_COVER}" alt="${item.title} cover">
      <div>
        <div class="favorite-result-title">${item.title}</div>
        <div class="favorite-result-meta">Album</div>
      </div>
    `;
    btn.addEventListener('click', async () => {
      const slot = favoriteSongsState.activeSlot;
      if (slot === null || slot < 0 || slot >= FAVORITES_COUNT) return;
      const wasEmpty = !favoriteAlbumsState.items[slot];
      const alreadyAwardedForSlot = !!top5XpSlotsState.slots[slot];
      const payload = {
        id: Number(item.id),
        title: item.title,
        url: item.url,
        cover_url: item.cover_url || ''
      };
      favoriteAlbumsState.items[slot] = payload;
      const saved = await persistTopIds('top_albums', favoriteAlbumsState.items);
      if (!saved) {
        return;
      }

      if (
        wasEmpty
        && !alreadyAwardedForSlot
        && favoriteSongsState.userId
        && window.EMDbXP
        && typeof window.EMDbXP.awardXP === 'function'
      ) {
        await window.EMDbXP.awardXP(favoriteSongsState.userId, 2, {
          action: 'top5_album_slot_first_fill',
          slot
        }, supabaseClient);
        top5XpSlotsState.slots[slot] = true;
        persistTop5XpSlotsState();
        await refreshOwnXpState();
      }

      renderFavoriteSongs();
      closeFavoritePicker();
    });
    favoriteSearchResultsEl.appendChild(btn);
  });
};

const openFavoritePicker = async (slotIndex) => {
  if (!favoritePickerEl) return;
  favoriteSongsState.activeSlot = slotIndex;
  favoritePickerEl.classList.add('open');
  favoritePickerEl.setAttribute('aria-hidden', 'false');

  if (favoritePickerTitleEl) {
    favoritePickerTitleEl.textContent = 'Pick a Top 5 Album';
  }
  if (favoriteSearchInputEl) {
    favoriteSearchInputEl.placeholder = 'Search albums...';
    favoriteSearchInputEl.value = '';
  }
  if (favoritePickerBodyEl) {
    favoritePickerBodyEl.classList.add('no-search');
  }

  if (favoriteSearchResultsEl) {
    favoriteSearchResultsEl.innerHTML = '<div class="favorite-empty">Loading albums...</div>';
  }

  const catalog = await ensureFavoriteAlbumCatalog();
  if (!catalog.length && favoriteSearchResultsEl) {
    favoriteSearchResultsEl.innerHTML = '<div class="favorite-empty">Could not load albums right now.</div>';
  } else {
    renderFavoriteSearchResults('');
  }
};

const closeFavoritePicker = () => {
  if (!favoritePickerEl) return;
  favoritePickerEl.classList.remove('open');
  favoritePickerEl.setAttribute('aria-hidden', 'true');
  favoriteSongsState.activeSlot = null;
};

const setupFavoriteSongsUi = () => {
  if (favoritePickerCloseEl) {
    favoritePickerCloseEl.addEventListener('click', closeFavoritePicker);
  }

  if (favoritePickerEl) {
    favoritePickerEl.addEventListener('click', (e) => {
      if (e.target === favoritePickerEl) closeFavoritePicker();
    });
  }

  document.addEventListener('click', (e) => {
    if (!topFiveActionMenuEl || !topFiveActionMenuEl.classList.contains('open')) return;
    if (topFiveActionMenuEl.contains(e.target)) return;

    const slotEl = e.target.closest('.favorite-slot');
    if (slotEl) {
      const slot = Number(slotEl.dataset.slot);
      if (Number.isInteger(slot) && slot === topFiveActionMenuSlot) return;
    }
    closeTopFiveActionMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTopFiveActionMenu();
  });

  window.addEventListener('resize', closeTopFiveActionMenu);
  window.addEventListener('scroll', closeTopFiveActionMenu, true);

  if (favoriteSearchInputEl) {
    favoriteSearchInputEl.addEventListener('input', () => {
      renderFavoriteSearchResults(favoriteSearchInputEl.value || '');
    });
    favoriteSearchInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeFavoritePicker();
    });
  }

};

const initFavoriteSongs = (userId) => {
  closeTopFiveActionMenu();
  favoriteSongsState.userId = userId;
  initTop5XpSlotsState(userId);
  favoriteSongsState.mode = 'albums';
  updateTopFiveModeUi();
  renderFavoriteSongs();
};

const getRequestedProfileUserId = () => {
  const params = new URLSearchParams(window.location.search);
  const value = params.get('user');
  return value ? value.trim() : '';
};

async function fetchProfileById(userId) {
  const defaultProfile = {
    username: 'Profile',
    avatarUrl: '/images/avatars/avatar-1.jpg',
    joinedAt: '',
    xp: 0,
    level: 1,
    topSongs: [],
    topAlbums: []
  };

  if (!supabaseClient || !userId) return null;

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('username, avatar_url, joined_at, top_songs, top_albums, xp, level')
    .eq('id', userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Profile fetch error:', error);
    return null;
  }

  if (!data) return null;

  return {
    username: data.username || defaultProfile.username,
    avatarUrl: normalizeAvatar(data.avatar_url || defaultProfile.avatarUrl),
    joinedAt: data.joined_at || defaultProfile.joinedAt,
    xp: Math.max(0, Number(data.xp) || 0),
    level: Math.max(1, Math.min(11, Number(data.level) || fallbackCalculateLevel(Number(data.xp) || 0))),
    topSongs: Array.isArray(data.top_songs) ? data.top_songs : [],
    topAlbums: Array.isArray(data.top_albums) ? data.top_albums : []
  };
}

async function loadProfile() {
  if (!supabaseClient) {
    setStatus('Supabase not available. Please refresh.', 'error');
    return;
  }

  setStatus('', 'neutral');

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError) {
    setStatus('Session error: ' + sessionError.message, 'error');
    return;
  }

  const session = sessionData ? sessionData.session : null;
  const requestedUserId = getRequestedProfileUserId();

  if (!session && !requestedUserId) {
    window.location.href = '/sign-in.html?next=/profile.html';
    return;
  }

  const sessionUser = session ? session.user : null;
  activeProfileUserId = requestedUserId || (sessionUser ? sessionUser.id : '');
  isOwnProfileView = !!sessionUser && sessionUser.id === activeProfileUserId;

  let profileData = null;
  if (isOwnProfileView) {
    profileData = await getOrCreateProfile(sessionUser);
    profileData = await reconcileHistoricalXp(activeProfileUserId, profileData);
  } else {
    profileData = await fetchProfileById(activeProfileUserId);
  }

  if (!profileData) {
    setStatus('Profile not found.', 'error');
    return;
  }

  if (usernameEl) usernameEl.textContent = profileData.username || (isOwnProfileView ? 'Your Profile' : 'Profile');
  if (joinDateEl) joinDateEl.textContent = profileData.joinedAt ? `Joined ${formatDate(profileData.joinedAt)}` : '';
  renderXpState(profileData.xp, profileData.level);
  const normalizedAvatar = normalizeAvatar(profileData.avatarUrl);
  if (avatarImg) avatarImg.src = normalizedAvatar;
  if (settingsToggleEl) settingsToggleEl.style.display = isOwnProfileView ? '' : 'none';

  if (isOwnProfileView && sessionUser) {
    localStorage.setItem('emdb_logged_in', 'true');
    if (sessionUser.email) localStorage.setItem('emdb_user_email', sessionUser.email);
    if (sessionUser.id) localStorage.setItem('emdb_user_id', sessionUser.id);
    if (profileData.username) localStorage.setItem('emdb_user_name', profileData.username);
    if (normalizedAvatar) localStorage.setItem('emdb_user_avatar', normalizedAvatar);
  }

  setStatus('');

  initFavoriteSongs(isOwnProfileView ? activeProfileUserId : null);
  await resolveTopItemsFromProfile(profileData);
  syncTop5XpSlotsWithCurrentItems();
  persistTop5XpSlotsState();
  renderFavoriteSongs();

  await Promise.all([
    loadAlbumRatings(activeProfileUserId),
    loadSongRatings(activeProfileUserId),
    (window.AlbumReviews && typeof window.AlbumReviews.loadUserReviews === 'function')
      ? window.AlbumReviews.loadUserReviews(activeProfileUserId, 'userReviewsContainer', { sortBy: reviewsState.sortBy, sortDir: reviewsState.sortDir })
      : Promise.resolve(),
    (window.AlbumReviews && typeof window.AlbumReviews.loadUserThoughts === 'function')
      ? window.AlbumReviews.loadUserThoughts(activeProfileUserId, 'userThoughtsContainer', { sortBy: thoughtsState.sortBy, sortDir: thoughtsState.sortDir })
      : Promise.resolve()
  ]);

  updateSectionCount('reviewsCount', document.querySelectorAll('#userReviewsContainer .ar-card').length);
  updateSectionCount('thoughtsCount', document.querySelectorAll('#userThoughtsContainer .ar-card').length);
}

async function getOrCreateProfile(user) {
  const defaultProfile = {
    username: deriveUsername(user.email),
    avatarUrl: '/images/avatars/avatar-1.jpg',
    joinedAt: user.created_at,
    xp: 0,
    level: 1
  };

  if (!supabaseClient) return defaultProfile;

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('username, avatar_url, joined_at, top_songs, top_albums, xp, level')
    .eq('id', user.id)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Profile fetch error:', error);
    return defaultProfile;
  }

  if (!data) {
    await supabaseClient.from('profiles').upsert({
      id: user.id,
      username: defaultProfile.username,
      avatar_url: defaultProfile.avatarUrl,
      joined_at: defaultProfile.joinedAt,
      xp: defaultProfile.xp,
      level: defaultProfile.level,
      top_songs: [],
      top_albums: [],
      updated_at: new Date().toISOString(),
    });
    return {
      ...defaultProfile,
      topSongs: [],
      topAlbums: []
    };
  }

  const xp = Math.max(0, Number(data.xp) || 0);
  const derivedLevel = window.EMDbXP && typeof window.EMDbXP.calculateLevel === 'function'
    ? window.EMDbXP.calculateLevel(xp)
    : fallbackCalculateLevel(xp);
  const storedLevel = Math.max(1, Math.min(11, Number(data.level) || derivedLevel));

  if (storedLevel !== derivedLevel) {
    await supabaseClient
      .from('profiles')
      .update({ level: derivedLevel, updated_at: new Date().toISOString() })
      .eq('id', user.id);
  }

  return {
    username: data.username || defaultProfile.username,
    avatarUrl: normalizeAvatar(data.avatar_url || defaultProfile.avatarUrl),
    joinedAt: data.joined_at || defaultProfile.joinedAt,
    xp,
    level: derivedLevel,
    topSongs: Array.isArray(data.top_songs) ? data.top_songs : [],
    topAlbums: Array.isArray(data.top_albums) ? data.top_albums : [],
  };
}

async function loadAlbumRatings(userId) {
  const container = document.getElementById('album-ratings');
  if (!supabaseClient) return renderEmpty(container, 'albums');

  const { data, error } = await supabaseClient
    .from('album_ratings')
    .select(`
      rating,
      review,
      created_at,
      albums:album_id (
        id,
        title,
        slug,
        cover_url,
        release_date
      )
    `)
    .eq('user_id', userId)
    .order('rating', { ascending: false });

  if (error) {
    setStatus('Error loading album ratings: ' + error.message, 'error');
    return;
  }

  if (!data || data.length === 0) {
    renderEmpty(container, 'albums');
    return;
  }

  if (!container) return;

  // Fetch aggregated ratings for all albums shown so we can display EMDb (overall) scores
  const albumIds = [...new Set(data.map((item) => (item.albums && item.albums.id) || null).filter(Boolean))];
  let albumStats = new Map();
  if (albumIds.length) {
    const { data: ratingsAll, error: ratingsError } = await supabaseClient
      .from('album_ratings')
      .select('album_id, rating')
      .in('album_id', albumIds);

    if (!ratingsError && ratingsAll && ratingsAll.length) {
      const stats = {};
      ratingsAll.forEach((r) => {
        const id = r.album_id;
        if (!stats[id]) stats[id] = { sum: 0, count: 0 };
        stats[id].sum += Number(r.rating || 0);
        stats[id].count += 1;
      });
      Object.keys(stats).forEach((id) => {
        const s = stats[id];
        const avg = s.count ? s.sum / s.count : 0;
        const rounded = s.count ? Math.round(avg * 10) / 10 : 0;
        const display = s.count ? (rounded >= 10 ? '10' : rounded.toFixed(1)) : '0.0';
        albumStats.set(Number(id), { avg, rounded, display, count: s.count });
      });
    }
  }

  const resolveCover = (album) => {
    if (!album) return '';
    if (album.cover_url) return album.cover_url;
    if (album.cover) return album.cover;
    if (album.slug) return `/images/album-covers/${album.slug}/${album.slug}-cover.jpg`;
    return '';
  };

  albumRatingsState.items = data.map((item) => {
    const album = item.albums || {};
    const slug = album.slug || '';
    const title = album.title || 'Untitled album';
    const cover = resolveCover(album);
    const albumLink = slug ? `/releases/${slug}.html` : '';

    const stats = album && album.id ? albumStats.get(album.id) : null;
    return {
      title,
      link: albumLink,
      cover,
      userRating: Number(item.rating || 0),
      dateAdded: item.created_at || null,
      emdbRating: stats ? Number(stats.rounded || 0) : 0,
      emdbDisplay: stats ? stats.display : '0.0',
      ratingCount: stats ? stats.count : 0,
      review: item.review || ''
    };
  });

  renderAlbumRatings();
}

function renderAlbumRatings() {
  const container = document.getElementById('album-ratings');
  if (!container) return;
  if (!albumRatingsState.items.length) {
    updateSectionCount('albumsCount', 0);
    renderEmpty(container, 'albums');
    return;
  }

  container.innerHTML = '';
  const sorted = sortRatedItems(albumRatingsState.items, albumRatingsState.sortBy, albumRatingsState.sortDir);

  sorted.forEach((item) => {
    const fallbackInitial = (item.title || '').trim().charAt(0).toUpperCase() || 'A';
    const coverMarkup = item.cover
      ? `<img class="album-cover" src="${item.cover}" alt="${item.title} cover">`
      : `<div class="album-cover-fallback" aria-hidden="true">${fallbackInitial}</div>`;
    const titleMarkup = item.link
      ? `<a class="album-title-link" href="${item.link}">${item.title}</a>`
      : item.title;

    const div = document.createElement('div');
    div.classList.add('rating-card', 'album-card');
    div.innerHTML = `
      <div class="album-card-body">
        <div class="album-thumb">${coverMarkup}</div>
        <div class="album-info">
          <div class="album-top">
            <h3 class="album-title">${titleMarkup}</h3>
          </div>
          <div class="album-meta-row">
            <div class="album-scores">
              <span class="emdb-score" aria-label="EMDb rating"><span class="score-star">★</span> ${item.emdbDisplay}</span>
              <span class="user-inline-score" aria-label="Your score"><span class="score-star">★</span> ${formatScore(item.userRating)}</span>
            </div>
          </div>
          <p class="rating-count">${ratingCountLabel(item.ratingCount)}</p>
          <p class="rating-date">Date added: ${formatDate(item.dateAdded)}</p>
          ${item.review ? `<p class="album-review">${item.review}</p>` : ''}
        </div>
      </div>
    `;
    container.appendChild(div);
  });
  updateSectionCount('albumsCount', sorted.length);
}

// Generic section toggle (collapse/expand) behavior
function setupRatingsToggle(toggleId, iconId, listId, stateKey) {
  const toggle = document.getElementById(toggleId);
  const icon = document.getElementById(iconId);
  const list = document.getElementById(listId);
  if (!toggle || !list) return;
  const head = toggle.closest('.profile-section-head');

  // Always start collapsed on each load/refresh.
  list.classList.add('hidden');
  toggle.setAttribute('aria-expanded', 'false');
  if (icon) {
    icon.textContent = '▾';
    icon.classList.remove('open');
  }

  const toggleSection = () => {
    const isHidden = list.classList.toggle('hidden');
    const isExpanded = !isHidden;
    toggle.setAttribute('aria-expanded', String(isExpanded));
    if (icon) {
      icon.textContent = '▾';
      icon.classList.toggle('open', isExpanded);
    }
  };

  toggle.addEventListener('click', toggleSection);

  if (head) {
    head.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.list-order-wrap')) return;
      if (toggle.contains(target)) return;
      toggleSection();
    });
  }
}

// initialize toggle after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setupRatingsToggle('albumsToggle', 'albumsToggleIcon', 'album-ratings', 'emdb_albums_expanded');
  setupRatingsToggle('songsToggle', 'songsToggleIcon', 'song-ratings', 'emdb_songs_expanded');
  setupRatingsToggle('reviewsToggle', 'reviewsToggleIcon', 'userReviewsContainer', 'emdb_reviews_expanded');
  setupRatingsToggle('thoughtsToggle', 'thoughtsToggleIcon', 'userThoughtsContainer', 'emdb_thoughts_expanded');
  setupRatingsOrderControls();
  setupFavoriteSongsUi();
});

function setupRatingsOrderControls() {
  const albumsOrder = document.getElementById('albumsOrder');
  const songsOrder = document.getElementById('songsOrder');
  const reviewsOrder = document.getElementById('reviewsOrder');
  const thoughtsOrder = document.getElementById('thoughtsOrder');
  const albumsOrderDir = document.getElementById('albumsOrderDir');
  const songsOrderDir = document.getElementById('songsOrderDir');
  const reviewsOrderDir = document.getElementById('reviewsOrderDir');
  const thoughtsOrderDir = document.getElementById('thoughtsOrderDir');

  const syncDirButton = (button, dir) => {
    if (!button) return;
    const isAsc = dir === 'asc';
    button.textContent = isAsc ? '↑' : '↓';
    button.setAttribute('aria-label', isAsc ? 'Sort ascending' : 'Sort descending');
  };

  if (albumsOrder) {
    albumsOrder.value = albumRatingsState.sortBy;
    albumsOrder.addEventListener('change', () => {
      albumRatingsState.sortBy = albumsOrder.value || 'date';
      if (albumRatingsState.sortBy === 'az' && albumRatingsState.sortDir !== 'asc') {
        albumRatingsState.sortDir = 'asc';
        syncDirButton(albumsOrderDir, albumRatingsState.sortDir);
      }
      renderAlbumRatings();
    });
  }
  syncDirButton(albumsOrderDir, albumRatingsState.sortDir);
  if (albumsOrderDir) {
    albumsOrderDir.addEventListener('click', () => {
      albumRatingsState.sortDir = albumRatingsState.sortDir === 'asc' ? 'desc' : 'asc';
      syncDirButton(albumsOrderDir, albumRatingsState.sortDir);
      renderAlbumRatings();
    });
  }

  if (songsOrder) {
    songsOrder.value = songRatingsState.sortBy;
    songsOrder.addEventListener('change', () => {
      songRatingsState.sortBy = songsOrder.value || 'date';
      if (songRatingsState.sortBy === 'az' && songRatingsState.sortDir !== 'asc') {
        songRatingsState.sortDir = 'asc';
        syncDirButton(songsOrderDir, songRatingsState.sortDir);
      }
      renderSongRatings();
    });
  }
  syncDirButton(songsOrderDir, songRatingsState.sortDir);
  if (songsOrderDir) {
    songsOrderDir.addEventListener('click', () => {
      songRatingsState.sortDir = songRatingsState.sortDir === 'asc' ? 'desc' : 'asc';
      syncDirButton(songsOrderDir, songRatingsState.sortDir);
      renderSongRatings();
    });
  }

  if (reviewsOrder) {
    reviewsOrder.value = reviewsState.sortBy;
    reviewsOrder.addEventListener('change', () => {
      reviewsState.sortBy = reviewsOrder.value || 'date';
      if (activeProfileUserId && window.AlbumReviews && typeof window.AlbumReviews.loadUserReviews === 'function') {
        window.AlbumReviews.loadUserReviews(activeProfileUserId, 'userReviewsContainer', { sortBy: reviewsState.sortBy, sortDir: reviewsState.sortDir })
          .then(() => updateSectionCount('reviewsCount', document.querySelectorAll('#userReviewsContainer .ar-card').length));
      }
    });
  }
  syncDirButton(reviewsOrderDir, reviewsState.sortDir);
  if (reviewsOrderDir) {
    reviewsOrderDir.addEventListener('click', () => {
      reviewsState.sortDir = reviewsState.sortDir === 'asc' ? 'desc' : 'asc';
      syncDirButton(reviewsOrderDir, reviewsState.sortDir);
      if (activeProfileUserId && window.AlbumReviews && typeof window.AlbumReviews.loadUserReviews === 'function') {
        window.AlbumReviews.loadUserReviews(activeProfileUserId, 'userReviewsContainer', { sortBy: reviewsState.sortBy, sortDir: reviewsState.sortDir })
          .then(() => updateSectionCount('reviewsCount', document.querySelectorAll('#userReviewsContainer .ar-card').length));
      }
    });
  }

  if (thoughtsOrder) {
    thoughtsOrder.value = thoughtsState.sortBy;
    thoughtsOrder.addEventListener('change', () => {
      thoughtsState.sortBy = thoughtsOrder.value || 'date';
      if (activeProfileUserId && window.AlbumReviews && typeof window.AlbumReviews.loadUserThoughts === 'function') {
        window.AlbumReviews.loadUserThoughts(activeProfileUserId, 'userThoughtsContainer', { sortBy: thoughtsState.sortBy, sortDir: thoughtsState.sortDir })
          .then(() => updateSectionCount('thoughtsCount', document.querySelectorAll('#userThoughtsContainer .ar-card').length));
      }
    });
  }
  syncDirButton(thoughtsOrderDir, thoughtsState.sortDir);
  if (thoughtsOrderDir) {
    thoughtsOrderDir.addEventListener('click', () => {
      thoughtsState.sortDir = thoughtsState.sortDir === 'asc' ? 'desc' : 'asc';
      syncDirButton(thoughtsOrderDir, thoughtsState.sortDir);
      if (activeProfileUserId && window.AlbumReviews && typeof window.AlbumReviews.loadUserThoughts === 'function') {
        window.AlbumReviews.loadUserThoughts(activeProfileUserId, 'userThoughtsContainer', { sortBy: thoughtsState.sortBy, sortDir: thoughtsState.sortDir })
          .then(() => updateSectionCount('thoughtsCount', document.querySelectorAll('#userThoughtsContainer .ar-card').length));
      }
    });
  }
}

async function loadSongRatings(userId) {
  const container = document.getElementById('song-ratings');
  if (!supabaseClient) return renderEmpty(container, 'songs');

  const { data, error } = await supabaseClient
    .from('song_ratings')
    .select(`
      rating,
      review,
      created_at,
      songs:song_id (
        id,
        title,
        slug,
        cover_url,
        albums!inner (
          id,
          slug,
          cover_url,
          title
        )
      )
    `)
    .eq('user_id', userId)
    .order('rating', { ascending: false });

  if (error) {
    setStatus('Error loading song ratings: ' + error.message, 'error');
    return;
  }

  if (!data || data.length === 0) {
    renderEmpty(container, 'songs');
    return;
  }

  if (!container) return;

  const songIds = [...new Set(data.map((item) => (item.songs && item.songs.id) || null).filter(Boolean))];
  let songStats = new Map();
  if (songIds.length) {
    const { data: ratingsAll, error: ratingsError } = await supabaseClient
      .from('song_ratings')
      .select('song_id, rating')
      .in('song_id', songIds);

    if (!ratingsError && ratingsAll && ratingsAll.length) {
      const stats = {};
      ratingsAll.forEach((r) => {
        const id = r.song_id;
        if (!stats[id]) stats[id] = { sum: 0, count: 0 };
        stats[id].sum += Number(r.rating || 0);
        stats[id].count += 1;
      });
      Object.keys(stats).forEach((id) => {
        const s = stats[id];
        const avg = s.count ? s.sum / s.count : 0;
        const rounded = s.count ? Math.round(avg * 10) / 10 : 0;
        const display = s.count ? (rounded >= 10 ? '10' : rounded.toFixed(1)) : '0.0';
        songStats.set(Number(id), { avg, rounded, display, count: s.count });
      });
    }
  }

  const resolveSongAlbumInfo = (song) => {
    const albumList = Array.isArray(song?.albums)
      ? song.albums
      : (song?.albums ? [song.albums] : []);

    const albumSlugOverrides = {
      'non-album-tracks': 'non-album',
      'songs-featuring-eminem': 'feat',
      'production-discography': 'produced-only',
      'songs-underground-ep': 'underground-ep'
    };

    const overrideAlbum = albumList.find((album) => album && albumSlugOverrides[album.slug]);
    const fallbackAlbum = albumList[0] || null;
    const rawAlbumSlug = overrideAlbum
      ? overrideAlbum.slug
      : (fallbackAlbum && fallbackAlbum.slug ? fallbackAlbum.slug : '');
    const albumSlug = albumSlugOverrides[rawAlbumSlug] || rawAlbumSlug;
    const albumCover = (overrideAlbum && overrideAlbum.cover_url)
      || (fallbackAlbum && fallbackAlbum.cover_url)
      || '';
    return { albumSlug, albumCover };
  };

  const sorted = data.slice().sort((a, b) => {
    const diff = (b.rating || 0) - (a.rating || 0);
    if (diff !== 0) return diff;
    const songA = a.songs || {};
    const songB = b.songs || {};
    return (songA.title || '').localeCompare(songB.title || '');
  });

  songRatingsState.items = sorted.map((item) => {
    const song = item.songs || {};
    const title = song.title || 'Untitled song';
    const songSlug = song.slug || '';
    const { albumSlug, albumCover } = resolveSongAlbumInfo(song);
    const songLink = songSlug && albumSlug ? `/songs/${albumSlug}/${songSlug}.html` : '';
    const cover = song.cover_url || albumCover || '';
    const stats = song && song.id ? songStats.get(song.id) : null;
    return {
      title,
      link: songLink,
      cover,
      userRating: Number(item.rating || 0),
      dateAdded: item.created_at || null,
      emdbRating: stats ? Number(stats.rounded || 0) : 0,
      emdbDisplay: stats ? stats.display : '0.0',
      ratingCount: stats ? stats.count : 0,
      review: item.review || ''
    };
  });

  renderSongRatings();
}

function renderSongRatings() {
  const container = document.getElementById('song-ratings');
  if (!container) return;
  if (!songRatingsState.items.length) {
    updateSectionCount('songsCount', 0);
    renderEmpty(container, 'songs');
    return;
  }

  container.innerHTML = '';
  const sorted = sortRatedItems(songRatingsState.items, songRatingsState.sortBy, songRatingsState.sortDir);

  sorted.forEach((item) => {
    const fallbackInitial = (item.title || '').trim().charAt(0).toUpperCase() || 'S';
    const coverMarkup = item.cover
      ? `<img class="album-cover" src="${item.cover}" alt="${item.title} cover">`
      : `<div class="album-cover-fallback" aria-hidden="true">${fallbackInitial}</div>`;
    const titleMarkup = item.link
      ? `<a class="album-title-link" href="${item.link}">${item.title}</a>`
      : item.title;

    const div = document.createElement('div');
    div.classList.add('rating-card', 'album-card');
    div.innerHTML = `
      <div class="album-card-body">
        <div class="album-thumb">${coverMarkup}</div>
        <div class="album-info">
          <div class="album-top">
            <h3 class="album-title">${titleMarkup}</h3>
          </div>
          <div class="album-meta-row">
            <div class="album-scores">
              <span class="emdb-score" aria-label="EMDb rating"><span class="score-star">★</span> ${item.emdbDisplay}</span>
              <span class="user-inline-score" aria-label="Your score"><span class="score-star">★</span> ${formatScore(item.userRating)}</span>
            </div>
          </div>
          <p class="rating-count">${ratingCountLabel(item.ratingCount)}</p>
          <p class="rating-date">Date added: ${formatDate(item.dateAdded)}</p>
          ${item.review ? `<p class="album-review">${item.review}</p>` : ''}
        </div>
      </div>
    `;
    container.appendChild(div);
  });
  updateSectionCount('songsCount', sorted.length);
}

loadProfile();
