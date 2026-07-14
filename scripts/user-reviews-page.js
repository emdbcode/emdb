(function () {
  'use strict';

  const SUPABASE_URL = 'https://lbxpucsgwgtamolvjuep.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxieHB1Y3Nnd2d0YW1vbHZqdWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTM1MjcsImV4cCI6MjA4NzA2OTUyN30.KvC6zRMZtE8owQiXleNqlQvaoKoYL-NQQJr0928K3iY';
  const DEFAULT_AVATAR = '/images/avatars/avatar-1.jpg';

  function getClient() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return null;
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  function normalizeAvatarPath(value) {
    const raw = String(value || '').trim().replace(/\\/g, '/');
    if (!raw) return DEFAULT_AVATAR;
    const avatarMatch = raw.match(/avatar[_-]?(\d+)\.(?:jpe?g|png|webp|gif)$/i);
    if (avatarMatch) return '/images/avatars/avatar-' + Number(avatarMatch[1]) + '.jpg';
    if (/^\/images\/avatars\/avatar-\d+\.jpg$/i.test(raw)) return raw.toLowerCase();
    return DEFAULT_AVATAR;
  }

  function injectStyles() {
    if (document.getElementById('ur-page-styles')) return;
    const style = document.createElement('style');
    style.id = 'ur-page-styles';
    style.textContent = `
body {
  margin: 0;
  background: #0b0b0b;
  font-family: Arial, Helvetica, sans-serif;
  color: #eaeaea;
}

.reviews-page {
  max-width: 920px;
  margin: 2rem auto;
  padding: 0 1rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  align-items: center;
  box-sizing: border-box;
}

.reviews-page .hero {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 12px;
}

.reviews-page .hero .album-cover {
  flex: 0 0 auto;
}

.reviews-page .hero .hero-text {
  min-width: 0;
  flex: 1 1 auto;
}

.reviews-page .hero .hero-text h1 {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reviews-page .hero .hero-actions {
  flex: 0 0 auto;
}

.title-row {
  width: 100%;
  max-width: 700px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: clamp(12px, 3vw, 18px);
  padding-left: clamp(16px, 4vw, 24px);
  padding-right: clamp(16px, 4vw, 24px);
  box-sizing: border-box;
  background: transparent !important;
  border: none !important;
  margin-bottom: 0;
}

.title-main {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: clamp(10px, 2.5vw, 14px);
  flex-wrap: nowrap;
  min-width: 0;
  width: 100%;
}

.title-main.is-long-title {
  width: 100%;
}

.cover-thumb {
  width: auto;
  height: calc(3 * clamp(22px, 5vw, 32px) * 1.2);
  max-height: 180px;
  min-height: 64px;
  aspect-ratio: 1 / 1;
  border-radius: 6px;
  object-fit: cover;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  border: 1px solid #222;
  background: #000;
}

.cover-link {
  display: inline-flex;
  line-height: 0;
}

.page-title {
  font-size: clamp(22px, 5vw, 32px);
  margin: 0;
  color: #eaeaea;
  line-height: 1.2;
  text-align: left;
  font-weight: 700;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title-album-link {
  color: inherit;
  text-decoration: none;
}

.title-album-link:hover,
.title-album-link:focus,
.title-album-link:active {
  color: #E21C21;
  text-decoration: none;
}

@media (min-width: 521px) {
  .title-main.is-long-title {
    flex-wrap: nowrap;
    align-items: flex-start;
  }

  .title-main.is-long-title .page-title {
    min-width: 0;
    flex: 1 1 auto;
  }

  .title-main.is-long-title .title-album-link.title-album-link--reveal {
    display: block;
    max-width: 100%;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
  }

  .title-main.is-long-title .title-album-link.title-album-link--reveal.is-expanded {
    text-overflow: clip;
  }

  .title-main.is-long-title .title-album-text {
    display: inline-block;
    padding-right: 24px;
    transition: transform 0.3s ease;
  }
}

@media (max-width: 520px) {
  .reviews-page .hero {
    flex-wrap: nowrap;
  }

  .reviews-page .hero .hero-text h1 {
    white-space: nowrap;
  }

  .title-main.is-long-title .title-album-link.title-album-link--reveal {
    display: block;
    max-width: 100%;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
  }

  .title-main.is-long-title .title-album-link.title-album-link--reveal.is-expanded {
    text-overflow: clip;
  }

  .title-main.is-long-title .title-album-text {
    display: inline-block;
    padding-right: 24px;
    transition: transform 0.3s ease;
  }
}

.page-title a {
  color: inherit;
  text-decoration: none;
  transition: color .12s ease;
}

.page-title a:hover,
.page-title a:focus,
.page-title a:active {
  color: #E21C21 !important;
  text-decoration: none;
}

.title-link {
  color: inherit;
  text-decoration: none;
}

.title-link:hover,
.title-link:focus,
.title-link:active {
  color: #E21C21;
  text-decoration: none;
}

.page-subtitle {
  margin: 6px 0 0;
  color: #aaa;
  font-size: 13px;
}

.review-list {
  width: 100%;
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filter-bar {
  width: 100%;
  max-width: 900px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: -2px 0 2px 0;
}

.filter-btn {
  border: 1px solid #222;
  background: #111;
  color: #aaa;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease;
}

.filter-btn:hover,
.filter-btn:focus-visible {
  color: #eaeaea;
  border-color: #444;
  outline: none;
}

.filter-btn.is-active {
  color: #eaeaea;
  border-color: #E21C21;
}

.review-card {
  background: #111;
  border: 1px solid #222;
  border-radius: 10px;
  padding: 14px 16px;
}

.review-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
  background: #0d0d12;
}

.meta {
  flex: 1;
  min-width: 0;
}

.user {
  font-size: 14px;
  font-weight: 600;
  color: #f2f2f2;
  line-height: 1.25;
}

.user-level {
  display: inline-block;
  margin-left: 6px;
  color: #aaa;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.user-link {
  color: inherit;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.user-link:hover .user,
.user-link:focus .user {
  color: #E21C21;
}

.user-link:hover,
.user-link:focus,
.user-link:active {
  text-decoration: none;
}

.date {
  font-size: 12px;
  color: #666;
  margin-top: 1px;
}

.rating {
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  flex-shrink: 0;
}

.rating-star {
  color: #f5c518;
}

.text {
  font-size: 15px;
  color: #cfd2d9;
  line-height: 1.58;
  margin: 0 0 10px;
  white-space: pre-wrap;
  word-break: break-word;
}

.text--clamped {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: normal;
}

.more-btn {
  background: transparent;
  border: none;
  color: #E21C21;
  font-size: 12px;
  padding: 0;
  margin-bottom: 8px;
  display: block;
  cursor: pointer;
}

.more-btn:hover {
  text-decoration: underline;
}

.review-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.vote-group {
  display: inline-flex;
  align-items: center;
  gap: 0;
  border: 1px solid #2a2a2a;
  border-radius: 999px;
  overflow: hidden;
}

.vote-btn {
  background: transparent;
  border: none;
  color: #aaa;
  font-size: 12px;
  padding: 2px 8px;
  min-height: 22px;
  min-width: 24px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: color 120ms ease, background 120ms ease;
  font-weight: 600;
}

.vote-btn:hover:not(:disabled) {
  color: #eee;
  background: rgba(255,255,255,0.04);
}

.vote-btn:disabled {
  opacity: 0.28;
  cursor: default;
}

.vote-btn.voted-up {
  color: #4CAF50;
}

.vote-btn.voted-down {
  color: #E21C21;
}

.vote-score {
  font-size: 12px;
  color: #cfd2d9;
  padding: 0 5px;
  min-width: 20px;
  text-align: center;
}

.empty {
  color: #aaa;
  margin: 0;
  background: #151515;
  border: 1px solid #222;
  border-radius: 8px;
  padding: 12px;
}

@media (max-width: 520px) {
  .title-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
`;
    document.head.appendChild(style);
  }

  function wireExpandToggle(card) {
    const textEl = card.querySelector('.text');
    const btn = card.querySelector('.more-btn');
    if (!textEl || !btn) return;

    const setup = () => {
      if (!textEl.classList.contains('text--clamped')) {
        textEl.classList.add('text--clamped');
      }

      const needsToggle = textEl.scrollHeight > (textEl.clientHeight + 1);
      if (!needsToggle) {
        btn.remove();
        textEl.classList.remove('text--clamped');
        return;
      }

      if (btn.dataset.wired === '1') return;
      btn.dataset.wired = '1';
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        const isClamped = textEl.classList.contains('text--clamped');
        textEl.classList.toggle('text--clamped', !isClamped);
        btn.textContent = isClamped ? 'Less' : 'More';
      });
    };

    if (document.body.contains(card)) {
      window.requestAnimationFrame(setup);
    } else {
      window.setTimeout(setup, 0);
    }
  }

  function getScore(votes) {
    return Math.max(0, (votes.likes || 0) - (votes.dislikes || 0));
  }

  function getProfileHref(userId) {
    if (!userId) return '';
    return '/profile.html?user=' + encodeURIComponent(userId);
  }

  function getReviewPageArtistLabel(albumSlug) {
    switch (String(albumSlug || '').trim()) {
      case 'd12-world':
      case 'devils-night':
      case 'underground-ep':
        return 'D12';
      case 'hell-the-sequel':
        return 'Bad Meets Evil';
      case '8-mile-soundtrack':
      case 'southpaw-soundtrack':
      case 're-up':
      case 'shadyxv':
        return 'Various Artists';
      default:
        return 'Eminem';
    }
  }

  function isLongReviewTitleSlug(albumSlug) {
    return new Set([
      'snippet-tape-sslp',
      'snippet-tape-mmlp',
      'marshall-mathers-lp-2'
    ]).has(String(albumSlug || '').trim());
  }

  function wireExpandableTitle(link) {
    if (!link) return;
    const textSpan = link.querySelector('.title-album-text');
    if (!textSpan) return;

    let collapseTimer = null;
    link.addEventListener('click', (event) => {
      if (!link.classList.contains('title-album-link--reveal')) return;

      if (link.classList.contains('is-expanded')) {
        return;
      }

      if (textSpan.scrollWidth <= link.clientWidth + 1) return;

      event.preventDefault();
      const overflow = Math.max(0, textSpan.scrollWidth - link.clientWidth);
      link.classList.add('is-expanded');
      textSpan.style.transform = overflow > 0 ? `translateX(-${overflow}px)` : 'translateX(0)';

      if (collapseTimer) clearTimeout(collapseTimer);
      collapseTimer = window.setTimeout(() => {
        link.classList.remove('is-expanded');
        textSpan.style.transform = 'translateX(0)';
        collapseTimer = null;
      }, 1600);
    });
  }

  function getProfileLevel(profile) {
    if (!profile || typeof profile !== 'object') return '';
    return profile.level || profile.user_level || profile.rank || '';
  }

  async function fetchProfilesByIds(client, ids) {
    if (!client || !ids || !ids.length) return [];

    const withLevel = await client
      .from('profiles')
      .select('id, username, avatar_url, level')
      .in('id', ids);

    if (!withLevel.error) return withLevel.data || [];

    const fallback = await client
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', ids);

    if (fallback.error) {
      console.error('Reviewer profiles load error:', fallback.error);
      return [];
    }

    return fallback.data || [];
  }

  async function initUserReviewsPage() {
    const root = document.getElementById('userReviewsPage');
    if (!root) return;

    const albumSlug = String(root.dataset.albumSlug || '').trim();
    const releasePath = String(root.dataset.releasePath || ('../releases/' + albumSlug + '.html'));
    const list = document.getElementById('reviewList');
    const title = document.getElementById('reviewsTitle');
    const subtitle = document.getElementById('reviewsSubtitle');
    const hero = root.querySelector('.hero');
    const cover = root.querySelector('.album-cover');
    const heroText = root.querySelector('.hero-text');
    const heroActions = root.querySelector('.hero-actions');
    let activeSort = 'score';

    if (!albumSlug || !list || !title || !subtitle) return;

    injectStyles();

    if (hero) {
      hero.classList.add('title-row');
      if (heroActions) heroActions.remove();
      if (cover) cover.classList.add('cover-thumb');
      if (title) title.classList.add('page-title');
      if (subtitle) subtitle.classList.add('page-subtitle');

      if (heroText) {
        const titleMain = document.createElement('div');
        titleMain.className = 'title-main';

        if (cover && releasePath) {
          const coverLink = document.createElement('a');
          coverLink.className = 'cover-link';
          coverLink.href = releasePath;
          coverLink.setAttribute('aria-label', 'Open album page');
          coverLink.appendChild(cover);
          titleMain.appendChild(coverLink);
        } else if (cover) {
          titleMain.appendChild(cover);
        }

        titleMain.appendChild(heroText);
        hero.innerHTML = '';
        hero.appendChild(titleMain);
      }
    }

    const client = getClient();
    if (!client) {
      list.innerHTML = '<p class="empty">Could not load reviews right now.</p>';
      return;
    }

    let userId = null;
    try {
      const { data: sessionData } = await client.auth.getSession();
      userId = sessionData && sessionData.session ? sessionData.session.user.id : null;
    } catch (e) {
      userId = null;
    }

    client.auth.onAuthStateChange((_event, session) => {
      userId = session ? session.user.id : null;
    });

    const { data: album, error: albumError } = await client
      .from('albums')
      .select('id, title')
      .eq('slug', albumSlug)
      .maybeSingle();

    if (albumError || !album) {
      title.textContent = 'User Reviews';
      subtitle.textContent = 'Album not found in database.';
      list.innerHTML = '<p class="empty">No reviews to show.</p>';
      return;
    }

    const albumId = album.id;
    if (releasePath) {
      const albumLabel = esc(album.title || 'Album');
      const artistLabel = esc(getReviewPageArtistLabel(albumSlug));
      const longTitle = isLongReviewTitleSlug(albumSlug);
      const albumLinkClass = 'title-album-link' + (longTitle ? ' title-album-link--reveal' : '');
      title.innerHTML = artistLabel + '<br><a class="' + albumLinkClass + '" href="' + esc(releasePath) + '"><span class="title-album-text">' + albumLabel + '</span></a><br><a href="/user-reviews/index-user-reviews.html">User Reviews</a>';
      if (longTitle) {
        title.classList.add('is-long-title');
        wireExpandableTitle(title.querySelector('.title-album-link--reveal'));
      }
      const linkedCover = root.querySelector('.cover-link');
      if (linkedCover) {
        linkedCover.setAttribute('aria-label', 'Open ' + (album.title || 'album') + ' page');
      }
    } else {
      title.textContent = (album.title || 'Album') + ' User Reviews';
    }

    const { data: reviews, error: reviewError } = await client
      .from('album_reviews')
      .select('id, user_id, review_text, created_at')
      .eq('album_id', albumId)
      .order('created_at', { ascending: false });

    if (reviewError || !Array.isArray(reviews)) {
      subtitle.textContent = 'Could not load reviews.';
      list.innerHTML = '<p class="empty">No reviews to show.</p>';
      return;
    }

    if (!reviews.length) {
      subtitle.textContent = '0 reviews';
      list.innerHTML = '<p class="empty">No reviews yet. Be the first to add one on the album page.</p>';
      return;
    }

    const filterBar = document.createElement('div');
    filterBar.className = 'filter-bar';
    filterBar.setAttribute('role', 'group');
    filterBar.setAttribute('aria-label', 'Sort reviews');
    filterBar.innerHTML = ''
      + '<button class="filter-btn is-active" type="button" data-sort="score" aria-pressed="true">Score</button>'
      + '<button class="filter-btn" type="button" data-sort="newest" aria-pressed="false">Newest</button>';
    root.insertBefore(filterBar, list);

    const userIds = [...new Set(reviews.map((r) => r.user_id).filter(Boolean))];
    const reviewIds = reviews.map((r) => r.id).filter(Boolean);

    const [profileRows, ratingsRes, votesRes] = await Promise.all([
      userIds.length
        ? fetchProfilesByIds(client, userIds)
        : Promise.resolve([]),
      userIds.length
        ? client.from('album_ratings').select('user_id, rating').eq('album_id', albumId).in('user_id', userIds)
        : Promise.resolve({ data: [] }),
      reviewIds.length
        ? client.from('album_review_votes').select('review_id, user_id, vote').in('review_id', reviewIds)
        : Promise.resolve({ data: [] })
    ]);

    const profileMap = {};
    (profileRows || []).forEach((p) => {
      profileMap[p.id] = p;
    });

    const ratingMap = {};
    (ratingsRes.data || []).forEach((r) => {
      ratingMap[r.user_id] = r.rating;
    });

    const voteMap = {};
    const seenVoteKeys = new Set();
    (votesRes.data || []).forEach((v) => {
      const voteKey = `${v.review_id}:${v.user_id}`;
      if (seenVoteKeys.has(voteKey)) return;
      seenVoteKeys.add(voteKey);
      if (!voteMap[v.review_id]) voteMap[v.review_id] = { likes: 0, dislikes: 0 };
      if (v.vote === 1) voteMap[v.review_id].likes += 1;
      if (v.vote === -1) voteMap[v.review_id].dislikes += 1;
    });

    const userVoteMap = {};
    if (userId && reviewIds.length) {
      const { data: userVotesRes } = await client
        .from('album_review_votes')
        .select('review_id, user_id, vote')
        .eq('user_id', userId)
        .in('review_id', reviewIds);
      (userVotesRes || []).forEach((row) => {
        userVoteMap[row.review_id] = row.vote;
      });
    }

    function renderReviews() {
      const sortedReviews = reviews.slice().sort((a, b) => {
        const votesA = voteMap[a.id] || { likes: 0, dislikes: 0 };
        const votesB = voteMap[b.id] || { likes: 0, dislikes: 0 };
        const scoreA = getScore(votesA);
        const scoreB = getScore(votesB);
        const timeA = new Date(a.created_at).getTime() || 0;
        const timeB = new Date(b.created_at).getTime() || 0;

        if (activeSort === 'newest') {
          return timeB - timeA;
        }

        if (scoreB !== scoreA) return scoreB - scoreA;
        return timeB - timeA;
      });

      list.innerHTML = sortedReviews.map((review) => {
        const profile = profileMap[review.user_id] || {};
        const votes = voteMap[review.id] || { likes: 0, dislikes: 0 };
        const score = getScore(votes);
        const rating = ratingMap[review.user_id];
        const uv = userVoteMap[review.id];
        const isOwnReview = !!userId && review.user_id === userId;
        const profileHref = getProfileHref(review.user_id);
        const level = getProfileLevel(profile);
        const levelHtml = level ? '<span class="user-level">' + esc(level) + '</span>' : '';
        const avatarHtml = profileHref
          ? '<a class="user-link" href="' + esc(profileHref) + '" aria-label="View ' + esc(profile.username || 'user') + ' profile"><img class="avatar" src="' + esc(normalizeAvatarPath(profile.avatar_url)) + '" alt="' + esc(profile.username || 'User') + ' avatar"></a>'
          : '<img class="avatar" src="' + esc(normalizeAvatarPath(profile.avatar_url)) + '" alt="' + esc(profile.username || 'User') + ' avatar">';
        const userHtml = profileHref
          ? '<a class="user-link" href="' + esc(profileHref) + '"><span class="user">' + esc(profile.username || 'Anonymous') + '</span></a>'
          : '<span class="user">' + esc(profile.username || 'Anonymous') + '</span>';

        return '<article class="review-card" data-review-id="' + esc(review.id) + '">'
          + '<div class="review-head">'
          + avatarHtml
          + '<div class="meta">'
          + userHtml + levelHtml
          + '<div class="date">' + esc(formatDate(review.created_at)) + '</div>'
          + '</div>'
          + '<div class="rating"><span class="rating-star">★</span> ' + (rating == null ? '-' : esc(rating)) + '</div>'
          + '</div>'
          + '<p class="text text--clamped">' + esc(review.review_text || '') + '</p>'
          + '<button type="button" class="more-btn">More</button>'
          + '<div class="review-foot">'
          + '<div class="vote-group">'
            + '<button type="button" class="vote-btn' + (uv === 1 ? ' voted-up' : '') + '" data-vote="1" aria-label="Upvote"' + (isOwnReview ? ' disabled' : '') + '>↑</button>'
          + '<span class="vote-score">' + score + '</span>'
            + '<button type="button" class="vote-btn' + (uv === -1 ? ' voted-down' : '') + '" data-vote="-1" aria-label="Downvote"' + (isOwnReview || score === 0 ? ' disabled' : '') + '>↓</button>'
          + '</div>'
          + '</div>'
          + '</article>';
      }).join('');

      list.querySelectorAll('.review-card').forEach((card) => {
        wireExpandToggle(card);

        card.querySelectorAll('.vote-btn').forEach((btn) => {
          btn.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (review.user_id === userId) return;
            if (!userId) {
              window.location.href = '/sign-in.html';
              return;
            }

            const reviewId = Number(card.getAttribute('data-review-id'));
            const vote = Number(btn.getAttribute('data-vote'));
            const currentVote = userVoteMap[reviewId] || 0;
            let nextVote = currentVote;
            let dbError = null;

            if (currentVote === vote) {
              const { error } = await client
                .from('album_review_votes')
                .delete()
                .eq('review_id', reviewId)
                .eq('user_id', userId);
              dbError = error || null;
              nextVote = 0;
            } else if (currentVote === 0) {
              const { error } = await client
                .from('album_review_votes')
                .insert({ review_id: reviewId, user_id: userId, vote: vote });
              dbError = error || null;
              nextVote = vote;
            } else {
              const { error } = await client
                .from('album_review_votes')
                .update({ vote: vote })
                .eq('review_id', reviewId)
                .eq('user_id', userId);
              dbError = error || null;
              nextVote = vote;
            }

            if (dbError) {
              console.error('Vote update failed:', dbError);
              return;
            }

            if (!voteMap[reviewId]) voteMap[reviewId] = { likes: 0, dislikes: 0 };
            if (currentVote === 1) voteMap[reviewId].likes = Math.max(0, voteMap[reviewId].likes - 1);
            if (currentVote === -1) voteMap[reviewId].dislikes = Math.max(0, voteMap[reviewId].dislikes - 1);
            if (nextVote === 1) voteMap[reviewId].likes += 1;
            if (nextVote === -1) voteMap[reviewId].dislikes += 1;

            if (nextVote === 0) delete userVoteMap[reviewId];
            else userVoteMap[reviewId] = nextVote;

            renderReviews();
          });
        });
      });
    }

    filterBar.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextSort = String(btn.dataset.sort || 'score');
        if (nextSort === activeSort) return;
        activeSort = nextSort;
        filterBar.querySelectorAll('.filter-btn').forEach((b) => {
          const isActive = b === btn;
          b.classList.toggle('is-active', isActive);
          b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        renderReviews();
      });
    });

    subtitle.textContent = reviews.length + ' review' + (reviews.length === 1 ? '' : 's');
    renderReviews();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUserReviewsPage);
  } else {
    initUserReviewsPage();
  }
})();
