/**
 * album-reviews.js
 * Reviews system: add/edit reviews, voting, preview section on album pages,
 * and user reviews section on the profile page.
 */
(function () {
  'use strict';

  const SUPABASE_URL = 'https://lbxpucsgwgtamolvjuep.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxieHB1Y3Nnd2d0YW1vbHZqdWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTM1MjcsImV4cCI6MjA4NzA2OTUyN30.KvC6zRMZtE8owQiXleNqlQvaoKoYL-NQQJr0928K3iY';
  const DEFAULT_AVATAR = '/images/avatars/avatar-1.jpg';
  const DEFAULT_COVER = '/images/logos/songs-with-cover.jpg';
  const DEFAULT_MIN_REVIEW_LENGTH = 300;
  const DEFAULT_MAX_REVIEW_LENGTH = 10000;

  function getClient() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return null;
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeAvatarPath(value) {
    const raw = String(value || '').trim().replace(/\\/g, '/');
    if (!raw) return DEFAULT_AVATAR;
    const avatarMatch = raw.match(/avatar[_-]?(\d+)\.(?:jpe?g|png|webp|gif)$/i);
    if (avatarMatch) return `/images/avatars/avatar-${Number(avatarMatch[1])}.jpg`;
    if (/^\/images\/avatars\/avatar-\d+\.jpg$/i.test(raw)) return raw.toLowerCase();
    return DEFAULT_AVATAR;
  }

  function getFileRootPrefix() {
    const path = String(window.location.pathname || '');
    const segments = path.split('/').filter(Boolean);
    const rootFolders = new Set([
      'releases', 'songs', 'charts', 'artists', 'collections', 'images',
      'legal', 'news', 'partials', 'samples', 'scripts', 'txt'
    ]);
    const rootIdx = segments.findIndex((seg) => rootFolders.has(seg));
    if (rootIdx === -1) return './';
    const depth = Math.max(0, segments.length - rootIdx - 1);
    return depth > 0 ? '../'.repeat(depth) : './';
  }

  function getSiteHref(pathFromRoot) {
    const clean = String(pathFromRoot || '').replace(/^\/+/, '');
    if (window.location.protocol !== 'file:') return `/${clean}`;
    return `${getFileRootPrefix()}${clean}`;
  }

  function getProfileHref(userId) {
    if (!userId) return '';
    return `${getSiteHref('profile.html')}?user=${encodeURIComponent(userId)}`;
  }

  function getReleaseHref(slug) {
    if (!slug) return '';
    return getSiteHref(`releases/${slug}.html`);
  }

  function getSongHref(songSlug, albumSlug) {
    if (!songSlug || !albumSlug) return '';
    return getSiteHref(`songs/${albumSlug}/${songSlug}.html`);
  }

  function getAlbumSlugFromUrl() {
    const parts = window.location.pathname.split('/');
    return (parts[parts.length - 1] || '').replace(/\.html$/, '');
  }

  function getAlbumTitleFromPage() {
    const heading = document.querySelector('.album-name');
    if (heading && heading.textContent) return heading.textContent.trim();
    const title = document.title || '';
    return title.split('|')[0].trim();
  }

  function getReviewValidationMessage(length) {
    if (length < _minReviewLength) {
      return `Minimum ${_minReviewLength} characters. You have ${length}.`;
    }
    if (length > _maxReviewLength) {
      return `Maximum ${_maxReviewLength} characters. You have ${length}.`;
    }
    return '';
  }

  function normalizeVoteValue(value) {
    const vote = Number(value);
    return vote === 1 || vote === -1 ? vote : 0;
  }

  function getVoteDisplayScore(voteMap) {
    return (voteMap && voteMap.likes) || 0;
  }

  // ── Module state ────────────────────────────────────────────────────────────
  let _client = null;
  let _userId = null;
  let _albumId = null;
  let _albumTitle = '';
  let _albumCover = '';
  let _userAlbumRating = null;
  let _existingReview = null;
  let _reviews = [];
  let _voteMap = {};
  let _userVotes = {};
  let _reviewEntityType = 'album';
  let _reviewTable = 'album_reviews';
  let _voteTable = 'album_review_votes';
  let _ratingTable = 'album_ratings';
  let _entityIdField = 'album_id';
  let _sectionTitle = 'User Reviews';
  let _entityLabel = 'album';
  let _minReviewLength = DEFAULT_MIN_REVIEW_LENGTH;
  let _maxReviewLength = DEFAULT_MAX_REVIEW_LENGTH;
  let _deletedReviews = {}; // Track deletions to prevent XP farming: { "user_id:entity_id": timestamp }
  let _awardedReviewXp = {}; // Persist awarded review XP: { "user_id:entity_type:entity_id": timestamp }

  // Load deletion tracking from localStorage
  function loadDeletedReviewsCache() {
    try {
      const cached = localStorage.getItem('emdb_deleted_reviews_xp_track') || '{}';
      _deletedReviews = JSON.parse(cached);
      // Clean up entries older than 2 hours
      const now = Date.now();
      const maxAge = 2 * 60 * 60 * 1000;
      Object.keys(_deletedReviews).forEach(key => {
        if ((now - _deletedReviews[key]) > maxAge) {
          delete _deletedReviews[key];
        }
      });
      localStorage.setItem('emdb_deleted_reviews_xp_track', JSON.stringify(_deletedReviews));
    } catch (err) {
      console.log('[AR] deletion cache load failed:', err);
    }
  }

  function saveDeletedReviewsCache() {
    try {
      localStorage.setItem('emdb_deleted_reviews_xp_track', JSON.stringify(_deletedReviews));
    } catch (err) {
      console.log('[AR] deletion cache save failed:', err);
    }
  }

  function loadAwardedReviewXpCache() {
    try {
      const cached = localStorage.getItem('emdb_awarded_review_xp_track') || '{}';
      _awardedReviewXp = JSON.parse(cached);
    } catch (err) {
      _awardedReviewXp = {};
      console.log('[AR] awarded XP cache load failed:', err);
    }
  }

  function saveAwardedReviewXpCache() {
    try {
      localStorage.setItem('emdb_awarded_review_xp_track', JSON.stringify(_awardedReviewXp));
    } catch (err) {
      console.log('[AR] awarded XP cache save failed:', err);
    }
  }

  function getSongSlugFromUrl() {
    const parts = window.location.pathname.split('/');
    return (parts[parts.length - 1] || '').replace(/\.html$/, '');
  }

  function configureModeFromSection() {
    const section = document.getElementById('arReviewsSection');
    const kind = (section && section.dataset && section.dataset.reviewKind
      ? String(section.dataset.reviewKind)
      : 'album').toLowerCase();

    const isSong = kind === 'song';
    _reviewEntityType = isSong ? 'song' : 'album';
    _reviewTable = isSong ? 'song_reviews' : 'album_reviews';
    _voteTable = isSong ? 'song_review_votes' : 'album_review_votes';
    _ratingTable = isSong ? 'song_ratings' : 'album_ratings';
    _entityIdField = isSong ? 'song_id' : 'album_id';
    _entityLabel = isSong ? 'song' : 'album';
    _sectionTitle = (section && section.dataset && section.dataset.reviewTitle) || (isSong ? 'User Thoughts' : 'User Reviews');

    const minFromData = Number(section && section.dataset ? section.dataset.minLength : NaN);
    const maxFromData = Number(section && section.dataset ? section.dataset.maxLength : NaN);
    _minReviewLength = Number.isFinite(minFromData) ? Math.max(0, minFromData) : (isSong ? 0 : DEFAULT_MIN_REVIEW_LENGTH);
    _maxReviewLength = Number.isFinite(maxFromData) ? Math.max(_minReviewLength, maxFromData) : DEFAULT_MAX_REVIEW_LENGTH;
  }

  // ── Inject CSS once ──────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('emdb-ar-styles')) return;
    const s = document.createElement('style');
    s.id = 'emdb-ar-styles';
    s.textContent = `
/* ─── Album Review Section ────────────────────────────────────────────── */
.ar-section {
  background-color: #151515;
  padding: 1.5rem;
  margin: 2rem auto;
  border-radius: 6px;
  max-width: 900px;
  border: 1px solid #222;
  box-sizing: border-box;
}
.ar-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  gap: 10px;
}
.ar-section-title {
  font-family: Arial, sans-serif;
  font-size: clamp(16px, 5vw, 20px);
  font-weight: 700;
  color: #fff;
  margin: 0;
  line-height: 1.2;
}
.ar-view-all-btn {
  background: transparent;
  border: 1px solid #333;
  color: #aaa;
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease;
  font-family: Arial, sans-serif;
  white-space: nowrap;
  flex-shrink: 0;
}
.ar-view-all-btn:hover { color: #E21C21; border-color: #E21C21; }

/* ─── Review card ──────────────────────────────────────────────────────── */
.ar-card {
  background: #111;
  border: 1px solid #222;
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 12px;
}
.ar-card:last-child { margin-bottom: 0; }
.ar-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.ar-avatar {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
  background: #0d0d12;
}
.ar-user-link {
  color: inherit;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}
.ar-user-link:hover,
.ar-user-link:focus,
.ar-user-link:active { text-decoration: none; }
.ar-user-meta { flex: 1; min-width: 0; }
.ar-username {
  font-size: 14px;
  font-weight: 600;
  color: #f2f2f2;
  line-height: 1.25;
  font-family: Arial, sans-serif;
}
.ar-user-link:hover .ar-username { color: #E21C21; }
.ar-date {
  font-size: 12px;
  color: #666;
  margin-top: 1px;
  font-family: Arial, sans-serif;
}
.ar-user-rating {
  font-size: 14px;
  font-weight: 700;
  color: #E21C21;
  white-space: nowrap;
  flex-shrink: 0;
  font-family: Arial, sans-serif;
}
.ar-rating-star { color: #f5c518; }
.ar-rating-value { color: #fff; }
.ar-text {
  font-size: 15px;
  color: #cfd2d9;
  line-height: 1.58;
  margin: 0 0 10px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: Arial, sans-serif;
}
.ar-text--clamped {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: normal;
}
.ar-card-foot { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.ar-more-btn {
  background: transparent;
  border: none;
  color: #E21C21;
  font-size: 12px;
  padding: 0;
  margin-bottom: 8px;
  display: block;
  cursor: pointer;
  font-family: Arial, sans-serif;
}
.ar-more-btn:hover { text-decoration: underline; }
.ar-vote-group {
  display: inline-flex;
  align-items: center;
  gap: 0;
  border: 1px solid #2a2a2a;
  border-radius: 999px;
  overflow: hidden;
  font-family: Arial, sans-serif;
}
.ar-vote-btn {
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
  font-family: system-ui, -apple-system, "Segoe UI", "Noto Sans", sans-serif;
  font-weight: 600;
}
.ar-vote-btn:hover:not(:disabled) { color: #eee; background: rgba(255,255,255,0.04); }
.ar-vote-btn:disabled { opacity: 0.28; cursor: default; }
.ar-vote-btn.ar-voted-up { color: #4CAF50; }
.ar-vote-btn.ar-voted-down { color: #E21C21; }
.ar-vote-btn[data-ar-vote="-1"],
.ar-vote-btn.ar-voted-down { display: none !important; }
.ar-vote-score {
  font-size: 12px;
  color: #cfd2d9;
  padding: 0 5px;
  min-width: 20px;
  text-align: center;
  font-family: Arial, sans-serif;
  border-left: 1px solid #2a2a2a;
  border-right: 1px solid #2a2a2a;
  line-height: 1.55;
}
.ar-no-reviews {
  color: #666;
  font-size: 14px;
  margin: 0;
  font-family: Arial, sans-serif;
}

/* ─── Review modals ────────────────────────────────────────────────────── */
.ar-modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.78);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  padding: 16px;
  box-sizing: border-box;
}
.ar-modal.open { display: flex; }
.ar-modal-panel {
  background: #111;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  width: min(640px, 100%);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ar-modal-panel--wide { width: min(780px, 100%); }
.ar-modal-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #222;
  flex-shrink: 0;
}
.ar-modal-thumb {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
  background: #0f0f0f;
}
.ar-modal-album-info { flex: 1; min-width: 0; }
.ar-modal-title {
  font-size: 16px;
  font-weight: 700;
  color: #f2f2f2;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: Arial, sans-serif;
}
.ar-modal-subtitle {
  font-size: 13px;
  color: #aaa;
  margin-top: 3px;
  font-family: Arial, sans-serif;
}
.ar-modal-subtitle strong { color: #E21C21; }
.ar-modal-close {
  border: 1px solid #2a2a2a;
  background: #161616;
  color: #f2f2f2;
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  font-size: 14px;
  font-family: Arial, sans-serif;
  transition: border-color 120ms ease;
  margin-left: auto;
}
.ar-modal-close:hover { border-color: #E21C21; color: #E21C21; }
.ar-modal-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
.ar-no-rating-box {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 13px;
  color: #aaa;
  font-family: Arial, sans-serif;
  line-height: 1.5;
}
.ar-textarea {
  width: 100%;
  min-height: 160px;
  background: #0f0f0f;
  color: #f2f2f2;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.55;
  resize: vertical;
  box-sizing: border-box;
  font-family: Arial, sans-serif;
}
.ar-textarea:focus { outline: none; border-color: #444; }
.ar-char-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.ar-char-count {
  font-size: 12px;
  color: #666;
  font-family: Arial, sans-serif;
  white-space: nowrap;
  flex-shrink: 0;
  padding-top: 2px;
}
.ar-char-count.ar-ok { color: #4CAF50; }
.ar-validation {
  font-size: 13px;
  color: #E21C21;
  margin: 0;
  min-height: 0;
  font-family: Arial, sans-serif;
  flex: 1;
}
.ar-submit-btn {
  background: transparent;
  border: 1px solid #333;
  color: #aaa;
  font-size: 13px;
  font-weight: 600;
  border-radius: 6px;
  padding: 6px 14px;
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease;
  align-self: flex-end;
  font-family: Arial, sans-serif;
}
.ar-submit-btn:disabled { opacity: 0.45; cursor: default; }
.ar-submit-btn:hover:not(:disabled) { color: #E21C21; border-color: #E21C21; }
.ar-write-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.ar-write-delete-btn {
  background: transparent;
  border: 1px solid #3a3a3a;
  color: #aaa;
  font-size: 13px;
  font-weight: 600;
  border-radius: 6px;
  padding: 6px 14px;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  font-family: Arial, sans-serif;
}
.ar-write-delete-btn:hover:not(:disabled) {
  background: rgba(226, 28, 33, 0.12);
  border-color: #E21C21;
  color: #E21C21;
}
.ar-write-delete-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

/* ─── Song thoughts inline composer ───────────────────────────────────── */
.ar-song-compose {
  background: #101010;
  border: 1px solid #222;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 12px;
}
.ar-song-compose textarea {
  width: 100%;
  min-height: 72px;
  max-height: 140px;
  resize: vertical;
  background: #0b0b0b;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  color: #eaeaea;
  padding: 10px;
  box-sizing: border-box;
  font-size: 13px;
  line-height: 1.45;
  font-family: Arial, sans-serif;
}
.ar-song-compose textarea:focus {
  outline: none;
  border-color: #444;
}
.ar-song-compose-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 8px;
}
.ar-song-compose-meta {
  color: #888;
  font-size: 12px;
  font-family: Arial, sans-serif;
}
.ar-song-compose-meta.ar-ok { color: #4CAF50; }
.ar-song-compose-submit {
  background: transparent;
  border: 1px solid #333;
  color: #aaa;
  font-size: 12px;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  font-family: Arial, sans-serif;
  font-weight: 600;
}
.ar-song-compose-submit:hover:not(:disabled) { color: #E21C21; border-color: #E21C21; }
.ar-song-compose-submit:disabled { opacity: 0.45; cursor: default; }
.ar-song-compose-msg {
  margin-top: 8px;
  font-size: 12px;
  color: #E21C21;
  min-height: 14px;
  font-family: Arial, sans-serif;
}
.ar-song-signin {
  color: #aaa;
  font-size: 13px;
  margin-bottom: 8px;
  font-family: Arial, sans-serif;
}
.ar-song-signin a {
  color: #E21C21;
  text-decoration: none;
}
.ar-song-level {
  display: inline-block;
  margin-left: 6px;
  color: #aaa;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.ar-song-card .ar-card-foot {
  margin-top: 8px;
  display: flex;
}
.ar-song-delete-btn {
  margin-left: auto;
  background: transparent;
  border: 1px solid #3a3a3a;
  color: #aaa;
  border-radius: 6px;
  padding: 5px 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  font-family: Arial, sans-serif;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
}
.ar-song-delete-btn:hover:not(:disabled) {
  background: rgba(226, 28, 33, 0.12);
  border-color: #E21C21;
  color: #E21C21;
}
.ar-song-delete-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
    `;
    document.head.appendChild(s);
  }

  function getProfileLevel(profile) {
    if (!profile || typeof profile !== 'object') return '';
    return profile.level || profile.user_level || profile.rank || '';
  }

  function getSignInHref() {
    return getSiteHref('sign-in.html');
  }

  async function fetchProfilesByIds(ids) {
    if (!_client || !ids || !ids.length) return [];

    const withLevel = await _client.from('profiles')
      .select('id, username, avatar_url, level')
      .in('id', ids);

    if (!withLevel.error) return withLevel.data || [];
    console.error('Reviewer profiles load error (with level):', withLevel.error);

    const fallback = await _client.from('profiles')
      .select('id, username, avatar_url')
      .in('id', ids);

    if (fallback.error) {
      console.error('Reviewer profiles load error:', fallback.error);
      return [];
    }

    return fallback.data || [];
  }

  // ── Build write modal (once) ────────────────────────────────────────────────
  function ensureWriteModal() {
    if (document.getElementById('arWriteModal')) return;
    const div = document.createElement('div');
    div.id = 'arWriteModal';
    div.className = 'ar-modal';
    div.setAttribute('aria-hidden', 'true');
    div.innerHTML = `
<div class="ar-modal-panel" role="dialog" aria-modal="true" aria-labelledby="arWriteModalTitle">
  <div class="ar-modal-head">
    <img id="arWriteThumb" class="ar-modal-thumb" src="" alt="">
    <div class="ar-modal-album-info">
      <h3 id="arWriteModalTitle" class="ar-modal-title"></h3>
      <div id="arWriteRatingLine" class="ar-modal-subtitle"></div>
    </div>
    <button type="button" class="ar-modal-close" id="arWriteClose" aria-label="Close">✕</button>
  </div>
  <div class="ar-modal-body" id="arWriteBody">
    <div id="arNoRatingBox" class="ar-no-rating-box"></div>
    <textarea id="arWriteTextarea" class="ar-textarea" placeholder="Write your review (${_minReviewLength}-${_maxReviewLength} characters)…"></textarea>
    <div class="ar-char-row">
      <p class="ar-validation" id="arWriteValidation"></p>
      <span class="ar-char-count" id="arWriteCharCount">0 / ${_maxReviewLength}</span>
    </div>
    <div class="ar-write-actions">
      <button type="button" class="ar-write-delete-btn" id="arWriteDelete" style="display:none;">Delete Review</button>
      <button type="button" class="ar-submit-btn" id="arWriteSubmit" disabled>Submit Review</button>
    </div>
  </div>
</div>`;
    document.body.appendChild(div);

    const ta = div.querySelector('#arWriteTextarea');
    const cc = div.querySelector('#arWriteCharCount');
    const sb = div.querySelector('#arWriteSubmit');
    const db = div.querySelector('#arWriteDelete');
    const val = div.querySelector('#arWriteValidation');

    ta.addEventListener('input', () => {
      const len = ta.value.length;
      cc.textContent = `${len} / ${_maxReviewLength}`;
      cc.classList.toggle('ar-ok', len >= _minReviewLength && len <= _maxReviewLength);
      sb.disabled = len < _minReviewLength || len > _maxReviewLength;
      val.textContent = len === 0 ? '' : getReviewValidationMessage(len);
    });

    sb.addEventListener('click', async () => {
      const text = ta.value.trim();
      if (text.length < _minReviewLength) {
        val.textContent = getReviewValidationMessage(text.length);
        return;
      }
      if (text.length > _maxReviewLength) {
        val.textContent = getReviewValidationMessage(text.length);
        return;
      }
      val.textContent = '';
      sb.disabled = true;
      const origLabel = sb.textContent;
      sb.textContent = 'Saving…';
      await submitReview(text);
      sb.textContent = origLabel;
    });

    db.addEventListener('click', async () => {
      if (!_existingReview || !_existingReview.id) return;
      const reviewId = _existingReview.id;
      const origLabel = db.textContent;
      db.disabled = true;
      sb.disabled = true;
      db.textContent = 'Deleting...';
      val.textContent = '';
      await handleDeleteReview(reviewId, { buttonEl: db, messageEl: val });
      db.textContent = origLabel;
      db.disabled = false;
      if (!_existingReview) closeWriteModal();
    });

    div.querySelector('#arWriteClose').addEventListener('click', closeWriteModal);
    div.addEventListener('click', (e) => { if (e.target === div) closeWriteModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && div.classList.contains('open')) closeWriteModal();
    });
  }

  // ── Build all-reviews modal (once) ──────────────────────────────────────────
  function ensureAllModal() {
    if (document.getElementById('arAllModal')) return;
    const div = document.createElement('div');
    div.id = 'arAllModal';
    div.className = 'ar-modal';
    div.setAttribute('aria-hidden', 'true');
    div.innerHTML = `
<div class="ar-modal-panel ar-modal-panel--wide" role="dialog" aria-modal="true" aria-labelledby="arAllModalTitle">
  <div class="ar-modal-head">
    <h3 id="arAllModalTitle" class="ar-modal-title">User Reviews</h3>
    <button type="button" class="ar-modal-close" id="arAllClose" aria-label="Close">✕</button>
  </div>
  <div class="ar-modal-body" id="arAllBody"></div>
</div>`;
    document.body.appendChild(div);
    div.querySelector('#arAllClose').addEventListener('click', closeAllModal);
    div.addEventListener('click', (e) => { if (e.target === div) closeAllModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && div.classList.contains('open')) closeAllModal();
    });
  }

  // ── Open write modal ────────────────────────────────────────────────────────
  async function openWriteModal() {
    injectStyles();
    ensureWriteModal();
    await fetchUserAlbumRating();

    const modal = document.getElementById('arWriteModal');
    const thumb = document.getElementById('arWriteThumb');
    const titleEl = document.getElementById('arWriteModalTitle');
    const ratingLine = document.getElementById('arWriteRatingLine');
    const noRatingBox = document.getElementById('arNoRatingBox');
    const ta = document.getElementById('arWriteTextarea');
    const cc = document.getElementById('arWriteCharCount');
    const sb = document.getElementById('arWriteSubmit');
    const db = document.getElementById('arWriteDelete');
    const charRow = document.querySelector('.ar-char-row');

    thumb.src = _albumCover || DEFAULT_COVER;
    thumb.alt = esc(_albumTitle);
    titleEl.textContent = _albumTitle || 'Write a Review';

    if (_userAlbumRating) {
      ratingLine.innerHTML = `Your rating: <span class="ar-rating-star">★</span> <span class="ar-rating-value">${_userAlbumRating}</span>`;
      noRatingBox.style.display = 'none';
      ta.style.display = '';
      if (charRow) charRow.style.display = '';
      sb.style.display = '';
      ta.value = _existingReview ? _existingReview.review_text : '';
      const len = ta.value.length;
      cc.textContent = `${len} / ${_maxReviewLength}`;
      cc.classList.toggle('ar-ok', len >= _minReviewLength && len <= _maxReviewLength);
      sb.disabled = len < _minReviewLength || len > _maxReviewLength;
      sb.textContent = _existingReview ? 'Update Review' : 'Submit Review';
      db.textContent = _reviewEntityType === 'song' ? 'Delete Thought' : 'Delete Review';
      db.style.display = _existingReview ? '' : 'none';
      db.disabled = false;
    } else {
      ratingLine.innerHTML = 'No rating yet';
      noRatingBox.innerHTML = `You need to rate this ${esc(_entityLabel)} before writing a review. Use the <strong>★ Your Rating</strong> button above to add your score first, then come back here.`;
      noRatingBox.style.display = '';
      ta.style.display = 'none';
      if (charRow) charRow.style.display = 'none';
      sb.style.display = 'none';
      db.style.display = 'none';
    }

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    if (_userAlbumRating) setTimeout(() => ta.focus(), 80);
  }

  function closeWriteModal() {
    const modal = document.getElementById('arWriteModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    const val = document.getElementById('arWriteValidation');
    if (val) val.textContent = '';
  }

  // ── Open all-reviews modal ──────────────────────────────────────────────────
  function openAllModal() {
    injectStyles();
    ensureAllModal();
    const body = document.getElementById('arAllBody');
    const titleEl = document.getElementById('arAllModalTitle');
    if (titleEl) titleEl.textContent = _sectionTitle;
    body.innerHTML = '';
    if (!_reviews.length) {
      body.innerHTML = '<p class="ar-no-reviews">No reviews yet.</p>';
    } else {
      _reviews.forEach((r) => body.appendChild(buildReviewCard(r, true)));
    }
    const modal = document.getElementById('arAllModal');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeAllModal() {
    const modal = document.getElementById('arAllModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  // ── Submit / update review ──────────────────────────────────────────────────
  async function submitReview(text, options) {
    const opts = options || {};
    const val = opts.validationEl || document.getElementById('arWriteValidation');
    const sb = opts.buttonEl || document.getElementById('arWriteSubmit');
    const requiresRating = _reviewEntityType !== 'song';
    const trimmed = (text || '').trim();

    if (!_client || !_userId || !_albumId || (requiresRating && !_userAlbumRating)) {
      if (val) val.textContent = 'Unable to submit. Please refresh and try again.';
      if (sb) sb.disabled = false;
      return;
    }

    if (_reviewEntityType === 'song' && trimmed.length === 0) {
      if (val) val.textContent = 'Thought cannot be empty.';
      if (sb) sb.disabled = false;
      return;
    }

    if (trimmed.length < _minReviewLength || trimmed.length > _maxReviewLength) {
      if (val) {
        val.textContent = getReviewValidationMessage(trimmed.length);
      }
      if (sb) sb.disabled = false;
      return;
    }

    const now = new Date().toISOString();
    const hadExistingReview = Boolean(_existingReview && _existingReview.id);
    let result;

    if (_reviewEntityType === 'song' && _existingReview) {
      if (val) val.textContent = 'Delete your current thought to post a new one.';
      if (sb) sb.disabled = false;
      return;
    }

    if (hadExistingReview) {
      console.log('[AR-SUBMIT] update payload', {
        review_table: _reviewTable,
        review_id: _existingReview.id,
        user_id: _userId,
        text: trimmed,
        entity_field: _entityIdField,
        entity_id: _albumId
      });
      result = await _client.from(_reviewTable)
          .update({ review_text: trimmed, updated_at: now })
        .eq('id', _existingReview.id)
        .eq('user_id', _userId);
    } else {
      console.log('[AR-SUBMIT] insert payload', {
        review_table: _reviewTable,
        user_id: _userId,
        text: trimmed,
        entity_field: _entityIdField,
        entity_id: _albumId
      });
      result = await _client.from(_reviewTable)
        .insert({
          user_id: _userId,
          [_entityIdField]: _albumId,
          review_text: trimmed,
          updated_at: now
        });
    }

    if (result.error) {
      console.error('Review submit error:', result.error);
      const msg = result.error.message || result.error.details || result.error.code || 'Unknown error';
      if (val) val.textContent = `Save failed: ${msg}`;
      if (sb) sb.disabled = false;
      return;
    }

    if (!hadExistingReview && window.EMDbXP && typeof window.EMDbXP.awardXP === 'function') {
      const delKey = `${_userId}:${_albumId}`;
      const deletionTime = _deletedReviews[delKey];
      const now = Date.now();
      const recentDeletionWindow = 2 * 60 * 60 * 1000; // 2 hours
      const xpKey = `${_userId}:${_reviewEntityType}:${_albumId}`;
      const alreadyAwarded = Boolean(_awardedReviewXp[xpKey]);
      
      // Prevent XP farming and duplicate awards on retries/double submits.
      if ((!deletionTime || (now - deletionTime) > recentDeletionWindow) && !alreadyAwarded) {
        // Re-read data-review-kind from DOM at submit time to avoid stale module state.
        const _xpSection = document.getElementById('arReviewsSection');
        const _xpKind = (_xpSection && _xpSection.dataset && _xpSection.dataset.reviewKind
          ? String(_xpSection.dataset.reviewKind) : 'album').toLowerCase();
        const xpAmount = _xpKind === 'song' ? 1 : 10; // 1 XP for song thought, 10 XP for album review
        const xpAction = _xpKind === 'song' ? 'song_review_create' : 'album_review_create';
        await window.EMDbXP.awardXP(_userId, xpAmount, {
          action: xpAction,
          entityType: _xpKind,
          entityId: _albumId
        }, _client);
        _awardedReviewXp[xpKey] = Date.now();
        saveAwardedReviewXpCache();
      }
    }

    if (!opts.inline) closeWriteModal();
    await loadReviews();
    renderReviewSection();
  }

  async function handleDeleteReview(reviewId, opts) {
    const options = opts || {};
    const triggerBtn = options.buttonEl || null;
    const messageEl = options.messageEl || null;

    if (!_client || !_userId || !reviewId) return;

    const label = _reviewEntityType === 'song' ? 'thought' : 'review';
    if (!window.confirm(`Delete your ${label}?`)) return;

    if (triggerBtn) triggerBtn.disabled = true;
    if (messageEl) messageEl.textContent = '';

    const { error } = await _client.from(_reviewTable)
      .delete()
      .eq('id', reviewId)
      .eq('user_id', _userId)
      .eq(_entityIdField, _albumId);

    if (error) {
      console.error('Review delete error:', error);
      if (messageEl) messageEl.textContent = `Could not delete ${label}. Please try again.`;
      if (triggerBtn) triggerBtn.disabled = false;
      return;
    }

    // Track deletion to prevent XP farming on re-post
    const delKey = `${_userId}:${_albumId}`;
    _deletedReviews[delKey] = Date.now();
    saveDeletedReviewsCache();

    await loadReviews();
    renderReviewSection();
  }

  // ── Voting ──────────────────────────────────────────────────────────────────
  async function handleVote(reviewId, vote, options) {
    const opts = options || {};
    const voteTable = opts.voteTable || _voteTable;
    if (!_client) return;
    console.log('[AR-VOTE] click', { review_id: reviewId, vote, cached_user_id: _userId });

    // Re-check session in case it resolved after init
    if (!_userId) {
      const { data: sd } = await _client.auth.getSession();
      _userId = sd && sd.session ? sd.session.user.id : null;
      console.log('[AR-VOTE] session check', {
        has_session: !!(sd && sd.session),
        user_id: _userId || null
      });
    }
    if (!_userId) {
      console.warn('[AR-VOTE] blocked: no session/user id available');
      showVoteSignInPrompt(reviewId);
      return;
    }
    vote = normalizeVoteValue(vote);
    if (vote !== 1 && vote !== -1) return;
    if (!_voteMap[reviewId]) _voteMap[reviewId] = { likes: 0, dislikes: 0 };
    const vm = _voteMap[reviewId];
    const existing = normalizeVoteValue(_userVotes[reviewId]);

    if (existing === vote) {
      // Toggle off – remove vote
      const deletePayload = { review_id: reviewId, user_id: _userId, vote };
      console.log('[AR-VOTE] delete payload', deletePayload);
      const { data, error } = await _client.from(voteTable)
        .delete().eq('review_id', reviewId).eq('user_id', _userId)
        .select('review_id,user_id,vote');
      if (error) {
        console.error('[AR-VOTE] delete error', {
          review_id: reviewId,
          user_id: _userId,
          vote,
          error
        });
        return;
      }
      console.log('[AR-VOTE] delete response', data || null);
      delete _userVotes[reviewId];
      if (vote === 1) vm.likes = Math.max(0, vm.likes - 1);
      else vm.dislikes = Math.max(0, vm.dislikes - 1);
    } else if (existing) {
      // Change vote
      const updatePayload = { review_id: reviewId, user_id: _userId, vote };
      console.log('[AR-VOTE] update payload', updatePayload);
      const { data, error } = await _client.from(voteTable)
        .upsert(updatePayload, { onConflict: 'review_id,user_id' })
        .select('review_id,user_id,vote');
      if (error) {
        console.error('[AR-VOTE] update error', {
          review_id: reviewId,
          user_id: _userId,
          vote,
          error
        });
        return;
      }
      console.log('[AR-VOTE] update response', data || null);
      if (existing === 1) { vm.likes = Math.max(0, vm.likes - 1); vm.dislikes += 1; }
      else { vm.dislikes = Math.max(0, vm.dislikes - 1); vm.likes += 1; }
      _userVotes[reviewId] = vote;
    } else {
      // New vote
      const insertPayload = { review_id: reviewId, user_id: _userId, vote };
      console.log('[AR-VOTE] insert payload', insertPayload);
      const { data, error } = await _client.from(voteTable)
        .insert(insertPayload)
        .select('review_id,user_id,vote');
      if (error) {
        console.error('[AR-VOTE] insert error', {
          review_id: reviewId,
          user_id: _userId,
          vote,
          error
        });
        return;
      }
      console.log('[AR-VOTE] insert response', data || null);
      if (vote === 1) vm.likes += 1;
      else vm.dislikes += 1;
      _userVotes[reviewId] = vote;
    }

    console.log('[AR-VOTE] local map after write', {
      review_id: reviewId,
      user_vote: _userVotes[reviewId] || null,
      likes: vm.likes,
      dislikes: vm.dislikes,
      real_score: vm.likes - vm.dislikes,
      ui_score: getVoteDisplayScore(vm)
    });
    if (_reviewEntityType === 'song' && !opts.profileMode) {
      await loadReviews();
      renderReviewSection();
      return;
    }
    refreshVoteUi(reviewId);
  }

  function refreshVoteUi(reviewId) {
    const vm = _voteMap[reviewId] || { likes: 0, dislikes: 0 };
    const uv = normalizeVoteValue(_userVotes[reviewId]);
    const score = getVoteDisplayScore(vm);
    document.querySelectorAll(`[data-review-id="${reviewId}"]`).forEach((card) => {
      const upBtn = card.querySelector('[data-ar-vote="1"]');
      const scoreEl = card.querySelector('.ar-vote-score');
      if (upBtn) {
        upBtn.classList.toggle('ar-voted-up', uv === 1);
      }
      if (scoreEl) scoreEl.textContent = score;
    });
  }

  function showVoteSignInPrompt(reviewId) {
    document.querySelectorAll(`[data-review-id="${reviewId}"]`).forEach((card) => {
      let msg = card.querySelector('.ar-signin-msg');
      if (msg) return;
      msg = document.createElement('span');
      msg.className = 'ar-signin-msg';
      msg.style.cssText = 'font-size:12px;color:#aaa;font-family:Arial,sans-serif;margin-left:8px;';
      msg.innerHTML = `<a href="${esc(getSignInHref())}" style="color:#E21C21;text-decoration:none;">Sign in</a> to vote`;
      const foot = card.querySelector('.ar-card-foot');
      if (foot) foot.appendChild(msg);
      setTimeout(() => msg.remove(), 4000);
    });
  }

  function wireExpandToggle(card) {
    const textEl = card.querySelector('.ar-text');
    const btn = card.querySelector('.ar-more-btn');
    if (!textEl || !btn) return;

    const setup = () => {
      if (!textEl.classList.contains('ar-text--clamped')) {
        textEl.classList.add('ar-text--clamped');
      }

      const needsToggle = textEl.scrollHeight > (textEl.clientHeight + 1);
      if (!needsToggle) {
        btn.remove();
        textEl.classList.remove('ar-text--clamped');
        return;
      }

      if (btn.dataset.wired === '1') return;
      btn.dataset.wired = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const isClamped = textEl.classList.contains('ar-text--clamped');
        textEl.classList.toggle('ar-text--clamped', !isClamped);
        btn.textContent = isClamped ? 'Less' : 'More';
      });
    };

    if (document.body.contains(card)) {
      window.requestAnimationFrame(setup);
    } else {
      window.setTimeout(setup, 0);
    }
  }

  // ── Load reviews (entity page) ──────────────────────────────────────────────
  async function loadReviews() {
    if (!_client || !_albumId) return;

    const { data: rows, error } = await _client.from(_reviewTable)
      .select(`
        id, user_id, ${_entityIdField}, review_text, created_at, updated_at
      `)
      .eq(_entityIdField, _albumId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Reviews load error:', error);
      _reviews = [];
      _existingReview = null;
      return;
    }
    if (!rows || !rows.length) { _reviews = []; _existingReview = null; return; }

    console.log('[AR-VOTE] loadReviews rows', {
      album_id: _albumId,
      count: rows.length,
      review_ids: rows.map((r) => r.id)
    });

    const ids = rows.map((r) => r.id);
    const reviewerIds = [...new Set(rows.map((r) => r.user_id))];

    const [voteRes, userVoteRes, ratingRes, profileRows] = await Promise.all([
      _client.from(_voteTable).select('review_id, user_id, vote').in('review_id', ids),
      _userId
        ? _client.from(_voteTable).select('review_id, user_id, vote').eq('user_id', _userId).in('review_id', ids)
        : Promise.resolve({ data: [], error: null }),
      _reviewEntityType !== 'song'
        ? _client.from(_ratingTable).select('user_id, rating')
          .eq(_entityIdField, _albumId)
          .in('user_id', reviewerIds)
        : Promise.resolve({ data: [], error: null }),
      reviewerIds.length
        ? fetchProfilesByIds(reviewerIds)
        : Promise.resolve([])
    ]);

    if (voteRes.error) console.error('Votes load error:', voteRes.error);
    if (userVoteRes.error) console.error('User votes load error:', userVoteRes.error);
    if (ratingRes.error) console.error('Reviewer ratings load error:', ratingRes.error);
    if (Array.isArray(profileRows) === false) {
      console.error('Reviewer profiles load error: unexpected profile payload');
    }

    console.log('[AR-VOTE] vote aggregation source', {
      all_votes: voteRes.data || [],
      user_votes: userVoteRes.data || []
    });

    const reviewerRatingMap = {};
    (ratingRes.data || []).forEach((r) => { reviewerRatingMap[r.user_id] = r.rating; });

    const profileMap = {};
    (Array.isArray(profileRows) ? profileRows : []).forEach((p) => { profileMap[p.id] = p; });

    _voteMap = {};
    const seenVoteKeys = new Set();
    (voteRes.data || []).forEach((v) => {
      const voteKey = `${v.review_id}:${v.user_id}`;
      if (seenVoteKeys.has(voteKey)) return;
      seenVoteKeys.add(voteKey);
      if (!_voteMap[v.review_id]) _voteMap[v.review_id] = { likes: 0, dislikes: 0 };
      const vote = normalizeVoteValue(v.vote);
      if (vote === 1) _voteMap[v.review_id].likes += 1;
      else if (vote === -1) _voteMap[v.review_id].dislikes += 1;
    });

    _userVotes = {};
    (userVoteRes.data || []).forEach((v) => { _userVotes[v.review_id] = normalizeVoteValue(v.vote); });

    console.log('[AR-VOTE] vote maps', {
      vote_map: _voteMap,
      user_votes: _userVotes
    });

    _reviews = rows.map((r) => ({
      ...r,
      profiles: profileMap[r.user_id] || null,
      rating: reviewerRatingMap[r.user_id] || null,
      score: ((_voteMap[r.id] || {}).likes || 0)
    })).sort((a, b) => {
      if (_reviewEntityType === 'song') {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.created_at) - new Date(a.created_at);
      }
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    _existingReview = _userId ? (_reviews.find((r) => r.user_id === _userId) || null) : null;

    console.log('[AR-VOTE] reviews ranked', _reviews.map((r) => ({
      review_id: r.id,
      user_id: r.user_id,
      likes: (_voteMap[r.id] || {}).likes || 0,
      dislikes: (_voteMap[r.id] || {}).dislikes || 0,
      real_score: ((_voteMap[r.id] || {}).likes || 0) - ((_voteMap[r.id] || {}).dislikes || 0),
      user_vote: _userVotes[r.id] || null
    })));
  }

  // ── Fetch user's rating for this album ──────────────────────────────────────
  async function fetchUserAlbumRating() {
    _userAlbumRating = null;
    if (!_client || !_userId || !_albumId) return;
    const { data, error } = await _client.from(_ratingTable)
      .select('rating').eq('user_id', _userId).eq(_entityIdField, _albumId).maybeSingle();
    if (error) { console.error('Fetch album rating error:', error); return; }
    _userAlbumRating = data ? data.rating : null;
  }

  // ── Build a review card element ─────────────────────────────────────────────
  function buildReviewCard(review, clamped) {
    const profile = review.profiles || {};
    const vm = _voteMap[review.id] || { likes: 0, dislikes: 0 };
    const uv = normalizeVoteValue(_userVotes[review.id]);
    const isOwnReview = !!_userId && review.user_id === _userId;
    const profileHref = getProfileHref(review.user_id);
    const avatarSrc = normalizeAvatarPath(profile.avatar_url || DEFAULT_AVATAR);
    const avatarHtml = profileHref
      ? `<a class="ar-user-link" href="${esc(profileHref)}" aria-label="View ${esc(profile.username || 'user')} profile"><img class="ar-avatar" src="${esc(avatarSrc)}" alt="${esc(profile.username || 'User')}'s avatar"></a>`
      : `<img class="ar-avatar" src="${esc(avatarSrc)}" alt="${esc(profile.username || 'User')}'s avatar">`;
    const usernameHtml = profileHref
      ? `<a class="ar-user-link" href="${esc(profileHref)}">${esc(profile.username || 'Anonymous')}</a>`
      : esc(profile.username || 'Anonymous');
    const level = getProfileLevel(profile);
    const levelHtml = level ? `<span class="ar-song-level">${esc(level)}</span>` : '';

    const canDeleteSongThought = _reviewEntityType === 'song' && !!_userId && review.user_id === _userId;

    const card = document.createElement('div');
    card.className = `ar-card${_reviewEntityType === 'song' ? ' ar-song-card' : ''}`;
    card.setAttribute('data-review-id', String(review.id));
    card.innerHTML = `
<div class="ar-card-head">
  ${avatarHtml}
  <div class="ar-user-meta">
    <div class="ar-username">${usernameHtml}${levelHtml}</div>
    <div class="ar-date">${formatDate(review.created_at)}</div>
  </div>
  ${_reviewEntityType === 'song' ? '' : `<div class="ar-user-rating"><span class="ar-rating-star">★</span> <span class="ar-rating-value">${review.rating ?? '-'}</span></div>`}
</div>
<p class="ar-text${clamped && _reviewEntityType !== 'song' ? ' ar-text--clamped' : ''}">${esc(review.review_text || '')}</p>
${clamped && _reviewEntityType !== 'song' ? '<button type="button" class="ar-more-btn">More</button>' : ''}
<div class="ar-card-foot">
  <div class="ar-vote-group">
    <button type="button" class="ar-vote-btn${uv === 1 ? ' ar-voted-up' : ''}" data-ar-vote="1" aria-label="Upvote"${isOwnReview ? ' disabled' : ''}>↑</button>
    <span class="ar-vote-score">${getVoteDisplayScore(vm)}</span>
  </div>
  ${canDeleteSongThought ? '<button type="button" class="ar-song-delete-btn" data-ar-delete="1" aria-label="Delete" title="Delete">Delete</button>' : ''}
</div>`;

    card.querySelectorAll('.ar-vote-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isOwnReview) return;
        console.log('[AR-VOTE] button handler', {
          review_id: review.id,
          vote: Number(btn.dataset.arVote)
        });
        handleVote(review.id, Number(btn.dataset.arVote));
      });
    });

    if (clamped && _reviewEntityType !== 'song') wireExpandToggle(card);

    if (canDeleteSongThought) {
      const deleteBtn = card.querySelector('[data-ar-delete="1"]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleDeleteReview(review.id, { buttonEl: deleteBtn });
        });
      }
    }

    return card;
  }

  function buildSongComposer() {
    const wrap = document.createElement('div');
    wrap.className = 'ar-song-compose';
    const thought = '';
    const signedIn = !!_userId;
    const signInHref = getSignInHref();

    wrap.innerHTML = `
${signedIn ? '' : `<div class="ar-song-signin"><a href="${esc(signInHref)}">Sign in</a> to share your thought.</div>`}
<textarea id="arSongThoughtInput" maxlength="${_maxReviewLength}" placeholder="Share your thought (max ${_maxReviewLength} characters)"${signedIn ? '' : ' disabled'}>${esc(thought)}</textarea>
<div class="ar-song-compose-row">
  <span class="ar-song-compose-meta" id="arSongThoughtCount">${thought.length} / ${_maxReviewLength}</span>
  <button type="button" class="ar-song-compose-submit" id="arSongThoughtSubmit"${signedIn ? '' : ' disabled'}>Post Thought</button>
</div>
<div class="ar-song-compose-msg" id="arSongThoughtMsg"></div>`;

    const input = wrap.querySelector('#arSongThoughtInput');
    const count = wrap.querySelector('#arSongThoughtCount');
    const submit = wrap.querySelector('#arSongThoughtSubmit');
    const msg = wrap.querySelector('#arSongThoughtMsg');

    if (!input || !count || !submit || !msg) return wrap;

    function sync() {
      const len = input.value.length;
      count.textContent = `${len} / ${_maxReviewLength}`;
      const isEmpty = input.value.trim().length === 0;
      const tooLong = len > _maxReviewLength;
      count.classList.toggle('ar-ok', !isEmpty && !tooLong);
      submit.disabled = !signedIn || isEmpty || tooLong;
      if (tooLong) msg.textContent = getReviewValidationMessage(len);
      else if (!isEmpty) msg.textContent = '';
    }

    input.addEventListener('input', sync);

    submit.addEventListener('click', async () => {
      const raw = input.value || '';
      const trimmed = raw.trim();
      if (!signedIn) {
        msg.textContent = 'Sign in to post a thought.';
        return;
      }
      if (trimmed.length === 0) {
        msg.textContent = 'Thought cannot be empty.';
        sync();
        return;
      }
      if (raw.length > _maxReviewLength) {
        msg.textContent = getReviewValidationMessage(raw.length);
        sync();
        return;
      }

      submit.disabled = true;
      const oldLabel = submit.textContent;
      submit.textContent = 'Saving…';
      msg.textContent = '';
      await submitReview(trimmed, { inline: true, validationEl: msg, buttonEl: submit });
      submit.textContent = oldLabel;
      sync();
    });

    sync();
    return wrap;
  }

  // ── Render preview section on entity page ───────────────────────────────────
  function renderReviewSection() {
    const section = document.getElementById('arReviewsSection');
    if (!section) return;
    section.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'ar-section-head';

    const h2 = document.createElement('h2');
    h2.className = 'ar-section-title';
    h2.textContent = _sectionTitle;
    head.appendChild(h2);

    if (_reviewEntityType !== 'song' && _reviews.length > 0) {
      const viewBtn = document.createElement('button');
      viewBtn.type = 'button';
      viewBtn.className = 'ar-view-all-btn';
      viewBtn.textContent = _reviews.length > 3
        ? `View All (${_reviews.length})`
        : `All reviews (${_reviews.length})`;
      const albumContainer = document.querySelector('.album-container');
      const reviewsUrl = albumContainer && albumContainer.dataset
        ? (albumContainer.dataset.userReviews || albumContainer.dataset.reviews || '')
        : '';
      if (reviewsUrl) {
        viewBtn.addEventListener('click', () => { window.location.href = reviewsUrl; });
      } else {
        viewBtn.addEventListener('click', openAllModal);
      }
      head.appendChild(viewBtn);
    }

    section.appendChild(head);

    const ownReviewInThread = (_reviewEntityType === 'song' && _userId)
      ? (_reviews.find((r) => r.user_id === _userId) || null)
      : null;

    if (_reviewEntityType === 'song' && !ownReviewInThread) {
      section.appendChild(buildSongComposer());
    }

    if (!_reviews.length) {
      if (_reviewEntityType === 'song') return;
      const p = document.createElement('p');
      p.className = 'ar-no-reviews';
      p.textContent = 'No reviews yet. Be the first to add one.';
      section.appendChild(p);
    } else {
      if (_reviewEntityType === 'song') {
        const ownReview = ownReviewInThread;
        const otherReviews = ownReview
          ? _reviews.filter((r) => r.id !== ownReview.id)
          : _reviews.slice();

        if (ownReview) {
          section.appendChild(buildReviewCard(ownReview, false));
        }
        otherReviews.forEach((r) => section.appendChild(buildReviewCard(r, false)));
      } else {
        _reviews.slice(0, 3).forEach((r) => section.appendChild(buildReviewCard(r, true)));
      }
    }
  }

  // ── Fetch album by slug ─────────────────────────────────────────────────────
  async function fetchAlbumBySlug(slug) {
    if (!_client) return null;
    const { data, error } = await _client.from('albums')
      .select('id, title, cover_url').eq('slug', slug).maybeSingle();
    if (error) { console.error('Album fetch by slug error:', error); return null; }
    if (data) return data;

    const pageTitle = getAlbumTitleFromPage();
    if (!pageTitle) return null;

    const { data: byTitle, error: titleError } = await _client.from('albums')
      .select('id, title, cover_url').eq('title', pageTitle).maybeSingle();
    if (titleError) { console.error('Album fetch by title error:', titleError); return null; }
    return byTitle || null;
  }

  async function fetchSongBySlug(slug) {
    if (!_client) return null;
    const { data, error } = await _client.from('songs')
      .select('id, title')
      .eq('slug', slug)
      .maybeSingle();
    if (error) { console.error('Song fetch by slug error:', error); return null; }
    return data || null;
  }

  // ── Wire "Add a Review" button in nav popover ───────────────────────────────
  function wireReviewButton() {
    const btn = document.getElementById('userReviewsBtn');
    if (!btn) return;
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
      const popover = document.getElementById('albumNavPopover');
      const songPopover = document.getElementById('songNavPopover');
      if (popover) {
        popover.classList.remove('open');
        popover.setAttribute('aria-hidden', 'true');
        const toggle = document.getElementById('albumNavToggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      }
      if (songPopover) {
        songPopover.classList.remove('open');
        songPopover.setAttribute('aria-hidden', 'true');
        const songToggle = document.getElementById('songNavToggle');
        if (songToggle) songToggle.setAttribute('aria-expanded', 'false');
      }
      await openWriteModal();
    }, true);
  }

  // ── Init on album pages ─────────────────────────────────────────────────────
  async function initAlbumPage() {
    _client = getClient();
    if (!_client) return;

    configureModeFromSection();
    loadDeletedReviewsCache();
    loadAwardedReviewXpCache();

    const { data: sd } = await _client.auth.getSession();
    _userId = sd && sd.session ? sd.session.user.id : null;

    // Keep _userId in sync if auth state resolves late (e.g. file:// context)
    _client.auth.onAuthStateChange((_event, session) => {
      _userId = session ? session.user.id : null;
    });

    const slug = getAlbumSlugFromUrl();
    if (!slug) return;

    const album = await fetchAlbumBySlug(slug);
    if (!album) return;

    _albumId = album.id;
    _albumTitle = album.title || '';
    _albumCover = album.cover_url || '';

    await Promise.all([loadReviews(), fetchUserAlbumRating()]);

    injectStyles();
    renderReviewSection();
    wireReviewButton();
  }

  async function initSongPage() {
    _client = getClient();
    if (!_client) return;

    configureModeFromSection();
    loadDeletedReviewsCache();
    loadAwardedReviewXpCache();

    const { data: sd } = await _client.auth.getSession();
    _userId = sd && sd.session ? sd.session.user.id : null;

    _client.auth.onAuthStateChange((_event, session) => {
      _userId = session ? session.user.id : null;
    });

    const slug = getSongSlugFromUrl();
    if (!slug) return;

    const song = await fetchSongBySlug(slug);
    if (song && Number.isFinite(Number(song.id))) {
      _albumId = Number(song.id);
      _albumTitle = song.title || getAlbumTitleFromPage() || '';
    } else {
      const directSongId = Number(window.songId);
      if (!Number.isFinite(directSongId) || directSongId <= 0) return;
      _albumId = directSongId;
      _albumTitle = getAlbumTitleFromPage() || 'Song';
    }

    const coverImg = document.querySelector('#songCover img');
    _albumCover = coverImg ? (coverImg.getAttribute('src') || '') : '';

    await Promise.all([loadReviews(), fetchUserAlbumRating()]);

    injectStyles();
    renderReviewSection();
    wireReviewButton();
  }

  // ── Profile: load user's reviews ────────────────────────────────────────────
  async function loadUserReviews(userId, containerId, options) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const sortBy = options && options.sortBy ? options.sortBy : 'date';
    const sortDir = options && options.sortDir === 'asc' ? 'asc' : 'desc';
    const dir = sortDir === 'asc' ? 1 : -1;

    const client = getClient();
    if (!client) {
      container.innerHTML = '<p style="color:#666;font-size:14px">Could not load reviews.</p>';
      return;
    }
    _client = client;

    const { data: sessionData } = await client.auth.getSession();
    _userId = sessionData && sessionData.session ? sessionData.session.user.id : null;

    const { data, error } = await client.from('album_reviews')
      .select(`
        id, user_id, album_id, review_text, created_at,
        albums!album_id (title, slug, cover_url)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) { console.error('User reviews fetch error:', error); return; }

  const reviewIds = [...new Set((data || []).map((r) => r.id).filter(Boolean))];

    const albumIds = [...new Set((data || []).map((r) => r.album_id).filter(Boolean))];
    let ratingMap = {};
    if (albumIds.length) {
      const { data: ratingRows, error: ratingError } = await client.from('album_ratings')
        .select('album_id, rating')
        .eq('user_id', userId)
        .in('album_id', albumIds);
      if (ratingError) {
        console.error('User review ratings fetch error:', ratingError);
      } else {
        (ratingRows || []).forEach((row) => { ratingMap[row.album_id] = row.rating; });
      }
    }

    _voteMap = {};
    _userVotes = {};

    let voteMap = {};
    if (reviewIds.length) {
      const { data: voteRows, error: voteError } = await client.from('album_review_votes')
        .select('review_id, vote')
        .in('review_id', reviewIds);
      if (voteError) {
        console.error('User review votes fetch error:', voteError);
      } else {
        (voteRows || []).forEach((row) => {
          if (!voteMap[row.review_id]) voteMap[row.review_id] = { likes: 0, dislikes: 0 };
          const vote = normalizeVoteValue(row.vote);
          if (vote === 1) voteMap[row.review_id].likes += 1;
          if (vote === -1) voteMap[row.review_id].dislikes += 1;
        });
      }

      if (_userId) {
        const { data: userVoteRows, error: userVoteError } = await client.from('album_review_votes')
          .select('review_id, vote')
          .eq('user_id', _userId)
          .in('review_id', reviewIds);
        if (userVoteError) {
          console.error('User review viewer votes fetch error:', userVoteError);
        } else {
          (userVoteRows || []).forEach((row) => { _userVotes[row.review_id] = normalizeVoteValue(row.vote); });
        }
      }
    }

    const reviews = (data || []).map((review) => {
      const votes = voteMap[review.id] || { likes: 0, dislikes: 0 };
      _voteMap[review.id] = votes;
      return {
        ...review,
        rating: ratingMap[review.album_id] ?? null,
        likes: votes.likes,
        dislikes: votes.dislikes,
        score: votes.likes - votes.dislikes
      };
    });

    reviews.sort((a, b) => {
      if (sortBy === 'likes') {
        const scoreDiff = (a.score - b.score) * dir;
        if (scoreDiff !== 0) return scoreDiff;
        return (new Date(a.created_at) - new Date(b.created_at)) * dir;
      }
      if (sortBy === 'rating') {
        const ratingDiff = ((a.rating || 0) - (b.rating || 0)) * dir;
        if (ratingDiff !== 0) return ratingDiff;
        return (new Date(a.created_at) - new Date(b.created_at)) * dir;
      }
      return (new Date(a.created_at) - new Date(b.created_at)) * dir;
    });

    injectStyles();
    container.innerHTML = '';

    if (!reviews.length) {
      container.innerHTML = '<p style="color:#666;font-size:14px;padding:4px 0">No reviews written yet.</p>';
      return;
    }

    reviews.forEach((review) => {
      const album = review.albums || {};
      const link = album.slug ? getReleaseHref(album.slug) : '';
      const titleHtml = link
        ? `<a href="${esc(link)}" style="color:#f2f2f2;text-decoration:none;">${esc(album.title || 'Album')}</a>`
        : esc(album.title || 'Album');
      const uv = normalizeVoteValue(_userVotes[review.id]);
      const score = Math.max(0, review.likes || 0);

      const card = document.createElement('div');
      card.className = 'ar-card';
      card.setAttribute('data-review-id', String(review.id));
      card.innerHTML = `
<div class="ar-card-head">
  ${link
    ? `<a href="${esc(link)}" aria-label="${esc(album.title || 'Album')}"><img class="ar-avatar" src="${esc(album.cover_url || DEFAULT_COVER)}" alt="${esc(album.title || '')} cover" style="border-radius:6px"></a>`
    : `<img class="ar-avatar" src="${esc(album.cover_url || DEFAULT_COVER)}" alt="${esc(album.title || '')} cover" style="border-radius:6px">`}
  <div class="ar-user-meta">
    <div class="ar-username">${titleHtml}</div>
    <div class="ar-date">${formatDate(review.created_at)}</div>
  </div>
  <div class="ar-user-rating"><span class="ar-rating-star">★</span> <span class="ar-rating-value">${review.rating ?? '-'}</span></div>
</div>
<p class="ar-text ar-text--clamped">${esc(review.review_text || '')}</p>
<button type="button" class="ar-more-btn">More</button>
<div class="ar-card-foot">
  <div class="ar-vote-group">
    <button type="button" class="ar-vote-btn${uv === 1 ? ' ar-voted-up' : ''}" data-ar-vote="1" aria-label="Upvote">↑</button>
    <span class="ar-vote-score">${score}</span>
  </div>
</div>`;

      card.querySelectorAll('.ar-vote-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleVote(review.id, Number(btn.dataset.arVote), { voteTable: 'album_review_votes', profileMode: true });
        });
      });

      wireExpandToggle(card);
      container.appendChild(card);
    });
  }

  async function loadUserThoughts(userId, containerId, options) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const sortBy = options && options.sortBy ? options.sortBy : 'date';
    const sortDir = options && options.sortDir === 'asc' ? 'asc' : 'desc';
    const dir = sortDir === 'asc' ? 1 : -1;

    const client = getClient();
    if (!client) {
      container.innerHTML = '<p style="color:#666;font-size:14px">Could not load thoughts.</p>';
      return;
    }
    _client = client;

    const { data: sessionData } = await client.auth.getSession();
    _userId = sessionData && sessionData.session ? sessionData.session.user.id : null;

    const { data, error } = await client.from('song_reviews')
      .select(`
        id, user_id, song_id, review_text, created_at,
        songs:song_id (
          id,
          title,
          slug,
          cover_url,
          albums!inner (
            slug,
            cover_url,
            title
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('User thoughts fetch error:', error);
      return;
    }

    const thoughtIds = [...new Set((data || []).map((r) => r.id).filter(Boolean))];
    const songIds = [...new Set((data || []).map((r) => r.song_id).filter(Boolean))];

    let ratingMap = {};
    if (songIds.length) {
      const { data: ratingRows, error: ratingError } = await client.from('song_ratings')
        .select('song_id, rating')
        .eq('user_id', userId)
        .in('song_id', songIds);
      if (ratingError) {
        console.error('User thought ratings fetch error:', ratingError);
      } else {
        (ratingRows || []).forEach((row) => { ratingMap[row.song_id] = row.rating; });
      }
    }

    _voteMap = {};
    _userVotes = {};

    let voteMap = {};
    if (thoughtIds.length) {
      const { data: voteRows, error: voteError } = await client.from('song_review_votes')
        .select('review_id, vote')
        .in('review_id', thoughtIds);
      if (voteError) {
        console.error('User thought votes fetch error:', voteError);
      } else {
        (voteRows || []).forEach((row) => {
          if (!voteMap[row.review_id]) voteMap[row.review_id] = { likes: 0, dislikes: 0 };
          const vote = normalizeVoteValue(row.vote);
          if (vote === 1) voteMap[row.review_id].likes += 1;
          if (vote === -1) voteMap[row.review_id].dislikes += 1;
        });
      }

      if (_userId) {
        const { data: userVoteRows, error: userVoteError } = await client.from('song_review_votes')
          .select('review_id, vote')
          .eq('user_id', _userId)
          .in('review_id', thoughtIds);
        if (userVoteError) {
          console.error('User thought viewer votes fetch error:', userVoteError);
        } else {
          (userVoteRows || []).forEach((row) => { _userVotes[row.review_id] = normalizeVoteValue(row.vote); });
        }
      }
    }

    const thoughts = (data || []).map((thought) => {
      const votes = voteMap[thought.id] || { likes: 0, dislikes: 0 };
      _voteMap[thought.id] = votes;
      return {
        ...thought,
        rating: ratingMap[thought.song_id] ?? null,
        likes: votes.likes,
        dislikes: votes.dislikes,
        score: votes.likes
      };
    });

    thoughts.sort((a, b) => {
      if (sortBy === 'likes') {
        const scoreDiff = (a.score - b.score) * dir;
        if (scoreDiff !== 0) return scoreDiff;
        return (new Date(a.created_at) - new Date(b.created_at)) * dir;
      }
      if (sortBy === 'rating') {
        const ratingDiff = ((a.rating || 0) - (b.rating || 0)) * dir;
        if (ratingDiff !== 0) return ratingDiff;
        return (new Date(a.created_at) - new Date(b.created_at)) * dir;
      }
      return (new Date(a.created_at) - new Date(b.created_at)) * dir;
    });

    injectStyles();
    container.innerHTML = '';

    if (!thoughts.length) {
      container.innerHTML = '<p style="color:#666;font-size:14px;padding:4px 0">No thoughts written yet.</p>';
      return;
    }

    thoughts.forEach((thought) => {
      const song = thought.songs || {};
      const albums = Array.isArray(song.albums) ? song.albums : (song.albums ? [song.albums] : []);
      const album = albums[0] || null;
      const link = song.slug && album && album.slug ? getSongHref(song.slug, album.slug) : '';
      const titleHtml = link
        ? `<a href="${esc(link)}" style="color:#f2f2f2;text-decoration:none;">${esc(song.title || 'Song')}</a>`
        : esc(song.title || 'Song');
      const coverUrl = song.cover_url || (album && album.cover_url) || DEFAULT_COVER;
      const uv = normalizeVoteValue(_userVotes[thought.id]);
      const score = Math.max(0, thought.likes || 0);

      const card = document.createElement('div');
      card.className = 'ar-card';
      card.setAttribute('data-review-id', String(thought.id));
      card.innerHTML = `
<div class="ar-card-head">
  ${link
    ? `<a href="${esc(link)}" aria-label="${esc(song.title || 'Song')}"><img class="ar-avatar" src="${esc(coverUrl)}" alt="${esc(song.title || '')} cover" style="border-radius:6px"></a>`
    : `<img class="ar-avatar" src="${esc(coverUrl)}" alt="${esc(song.title || '')} cover" style="border-radius:6px">`}
  <div class="ar-user-meta">
    <div class="ar-username">${titleHtml}</div>
    <div class="ar-date">${formatDate(thought.created_at)}</div>
  </div>
  <div class="ar-user-rating"><span class="ar-rating-star">★</span> <span class="ar-rating-value">${thought.rating ?? '-'}</span></div>
</div>
<p class="ar-text">${esc(thought.review_text || '')}</p>
<div class="ar-card-foot">
  <div class="ar-vote-group">
    <button type="button" class="ar-vote-btn${uv === 1 ? ' ar-voted-up' : ''}" data-ar-vote="1" aria-label="Upvote">↑</button>
    <span class="ar-vote-score">${score}</span>
  </div>
</div>`;

      card.querySelectorAll('.ar-vote-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleVote(thought.id, Number(btn.dataset.arVote), { voteTable: 'song_review_votes', profileMode: true });
        });
      });

      container.appendChild(card);
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────────
  window.AlbumReviews = { init: initAlbumPage, loadUserReviews, loadUserThoughts };

  // ── Auto-init on album pages ────────────────────────────────────────────────
  const _path = window.location.pathname;
  const _href = window.location.href;
  const _isAlbumPage = /\/releases\/[^/]+\.html/.test(_path) || /releases\/[^/]+\.html/.test(_href);
  const _isSongPage = (/\/songs\/[^/]+\/[^/]+\.html/.test(_path) || /songs\/[^/]+\/[^/]+\.html/.test(_href))
    && !!document.getElementById('arReviewsSection');

  if (_isAlbumPage) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAlbumPage);
    } else {
      initAlbumPage();
    }
  } else if (_isSongPage) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initSongPage);
    } else {
      initSongPage();
    }
  }
})();
