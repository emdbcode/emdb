(function setupRankingsPage() {
  const SUPABASE_URL = 'https://lbxpucsgwgtamolvjuep.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxieHB1Y3Nnd2d0YW1vbHZqdWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTM1MjcsImV4cCI6MjA4NzA2OTUyN30.KvC6zRMZtE8owQiXleNqlQvaoKoYL-NQQJr0928K3iY';

  const ALBUM_SLUG_OVERRIDES = {
    'non-album-tracks': 'non-album',
    'songs-featuring-eminem': 'feat',
    'production-discography': 'produced-only',
    'songs-underground-ep': 'underground-ep'
  };

  const EXCLUDED_ALBUM_SLUGS = new Set([
    'feat',
    'songs-featuring-eminem',
    'non-album',
    'non-album-tracks',
    'produced-only',
    'production-discography'
  ]);

  const config = window.EMDbRankingsPage || {};
  const listEl = document.getElementById('rankingsList');
  const statusEl = document.getElementById('rankingsStatus');

  if (!listEl || !statusEl) return;

  function setStatus(message, isError) {
    statusEl.textContent = message || '';
    statusEl.classList.toggle('is-error', !!isError);
  }

  function formatScore(score) {
    if (!Number.isFinite(score)) return 'N/A';
    const rounded = Math.round(score * 10) / 10;
    return rounded >= 10 ? '10' : rounded.toFixed(1);
  }

  function formatInlineScore(score) {
    if (!Number.isFinite(score)) return '-';
    const rounded = Math.round(score * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  function createClient() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('Supabase is unavailable.');
    }
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  async function fetchAll(query) {
    const results = [];
    const pageSize = 1000;
    let from = 0;

    while (true) {
      const { data, error } = await query.range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || !data.length) break;
      results.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    return results;
  }

  function buildRatingMap(rows, keyName) {
    const totals = new Map();
    rows.forEach((row) => {
      const id = row[keyName];
      const rating = Number(row.rating);
      if (!id || !Number.isFinite(rating)) return;
      const current = totals.get(id) || { total: 0, count: 0 };
      current.total += rating;
      current.count += 1;
      totals.set(id, current);
    });

    const ratings = new Map();
    totals.forEach((value, id) => {
      ratings.set(id, {
        score: value.count ? value.total / value.count : null,
        ratingCount: value.count
      });
    });
    return ratings;
  }

  function normalizeAlbumRelation(albumRelation) {
    if (Array.isArray(albumRelation)) return albumRelation[0] || null;
    return albumRelation || null;
  }

  function mapAlbum(album, ratingMap, userRatingMap) {
    const rating = ratingMap.get(album.id) || { score: null, ratingCount: 0 };
    return {
      id: album.id,
      title: album.title || 'Untitled Album',
      url: `/releases/${album.slug}.html`,
      coverUrl: album.cover_url || '/images/logos/songs-with-cover.jpg',
      score: rating.score,
      ratingCount: rating.ratingCount,
      userScore: userRatingMap.get(album.id)
    };
  }

  function mapSong(song, ratingMap, userRatingMap) {
    const album = normalizeAlbumRelation(song.albums);
    const rawAlbumSlug = album && album.slug ? album.slug : '';
    const albumSlug = ALBUM_SLUG_OVERRIDES[rawAlbumSlug] || rawAlbumSlug;
    const rating = ratingMap.get(song.id) || { score: null, ratingCount: 0 };
    return {
      id: song.id,
      title: song.title || 'Untitled Song',
      url: albumSlug && song.slug ? `/songs/${albumSlug}/${song.slug}.html` : '',
      coverUrl: song.cover_url || (album && album.cover_url) || '/images/logos/songs-with-cover.jpg',
      score: rating.score,
      ratingCount: rating.ratingCount,
      userScore: userRatingMap.get(song.id)
    };
  }

  function sortByRanking(a, b) {
    const aRated = Number.isFinite(a.score);
    const bRated = Number.isFinite(b.score);
    if (aRated !== bRated) return aRated ? -1 : 1;
    if (aRated && bRated && b.score !== a.score) return b.score - a.score;
    if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
    return a.title.localeCompare(b.title);
  }

  function render(items) {
    listEl.innerHTML = '';
    if (!items.length) {
      setStatus('No rankings available yet.', false);
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((item, index) => {
      const row = document.createElement('li');
      row.className = 'ranking-row';

      const position = document.createElement('div');
      position.className = 'ranking-position';
      position.textContent = `#${index + 1}`;

      const thumbLink = document.createElement('a');
      thumbLink.className = 'ranking-thumb-link';
      thumbLink.href = item.url;
      thumbLink.setAttribute('aria-label', item.title);

      const thumb = document.createElement('img');
      thumb.className = 'ranking-thumb';
      thumb.src = item.coverUrl;
      thumb.alt = '';
      thumb.loading = index < 12 ? 'eager' : 'lazy';
      thumbLink.appendChild(thumb);

      const main = document.createElement('div');
      main.className = 'ranking-main';

      const title = document.createElement('a');
      title.className = 'ranking-title';
      title.href = item.url;
      title.textContent = item.title;
      main.appendChild(title);

      const score = document.createElement('div');
      score.className = 'ranking-score';

      const emdbScore = document.createElement('span');
      emdbScore.className = 'emdb-score';
      emdbScore.innerHTML = `<span class="score-star" aria-hidden="true">★</span><span class="score-value">${formatInlineScore(item.score)}</span>`;
      score.appendChild(emdbScore);

      const userScore = document.createElement('span');
      userScore.className = 'user-inline-score';
      const userInlineValue = formatInlineScore(item.userScore);
      if (userInlineValue === '-') userScore.classList.add('is-empty');
      userScore.innerHTML = `<span class="score-star" aria-hidden="true">★</span><span class="score-value">${userInlineValue}</span>`;
      score.appendChild(userScore);

      main.appendChild(score);

      const ratingCount = document.createElement('div');
      ratingCount.className = 'ranking-rating-count';
      const count = Number(item.ratingCount) || 0;
      ratingCount.textContent = `${count} Rating${count === 1 ? '' : 's'}`;
      main.appendChild(ratingCount);

      row.appendChild(position);
      row.appendChild(thumbLink);
      row.appendChild(main);
      fragment.appendChild(row);
    });

    listEl.appendChild(fragment);
    setStatus('', false);
  }

  async function loadAlbums(client, userId) {
    const [albums, ratings, userRatings] = await Promise.all([
      fetchAll(client.from('albums').select('id,title,slug,cover_url').order('title', { ascending: true })),
      fetchAll(client.from('album_ratings').select('album_id,rating')),
      userId
        ? fetchAll(client.from('album_ratings').select('album_id,rating').eq('user_id', userId))
        : Promise.resolve([])
    ]);
    const ratingMap = buildRatingMap(ratings, 'album_id');
    const userRatingMap = new Map(userRatings.map((row) => [row.album_id, Number(row.rating)]));
    return albums
      .filter((album) => !EXCLUDED_ALBUM_SLUGS.has(String(album.slug || '').toLowerCase()))
      .map((album) => mapAlbum(album, ratingMap, userRatingMap));
  }

  async function loadSongs(client, userId) {
    let query = client
      .from('songs')
      .select('id,title,slug,cover_url,is_not_eminem,feat_eminem,is_bme,is_d12,is_interlude,albums!inner(slug,cover_url)')
      .order('title', { ascending: true });

    if (config.kind === 'eminem-songs') {
      query = query
        .eq('is_not_eminem', false)
        .eq('feat_eminem', false)
        .eq('is_bme', false)
        .eq('is_d12', false)
        .eq('is_interlude', false);
    }

    if (config.kind === 'eminem-features') {
      query = query
        .eq('feat_eminem', true)
        .eq('is_interlude', false);
    }

    const [songs, ratings, userRatings] = await Promise.all([
      fetchAll(query),
      fetchAll(client.from('song_ratings').select('song_id,rating')),
      userId
        ? fetchAll(client.from('song_ratings').select('song_id,rating').eq('user_id', userId))
        : Promise.resolve([])
    ]);
    const ratingMap = buildRatingMap(ratings, 'song_id');
    const userRatingMap = new Map(userRatings.map((row) => [row.song_id, Number(row.rating)]));
    return songs.map((song) => mapSong(song, ratingMap, userRatingMap)).filter((song) => song.url);
  }

  async function init() {
    try {
      setStatus('Loading rankings...', false);
      const client = createClient();
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData && sessionData.session && sessionData.session.user
        ? sessionData.session.user.id
        : null;
      const rawItems = config.type === 'albums'
        ? await loadAlbums(client, userId)
        : await loadSongs(client, userId);
      const limit = Number(config.limit) || rawItems.length;
      const ranked = rawItems.sort(sortByRanking).slice(0, limit);
      render(ranked);
    } catch (error) {
      console.error('Rankings load error:', error);
      listEl.innerHTML = '';
      setStatus('Rankings could not be loaded. Please refresh and try again.', true);
    }
  }

  init();
})();
