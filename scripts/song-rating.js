(function setupSongRating() {
  const SUPABASE_URL = "https://lbxpucsgwgtamolvjuep.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxieHB1Y3Nnd2d0YW1vbHZqdWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTM1MjcsImV4cCI6MjA4NzA2OTUyN30.KvC6zRMZtE8owQiXleNqlQvaoKoYL-NQQJr0928K3iY";

  const userStar = document.getElementById('userStar');
  const userRatingText = document.getElementById('userRatingText');
  const emdbScore = document.getElementById('emdbScore');
  const emdbVotes = document.getElementById('emdbVotes');
  const popup = document.getElementById('ratingPopup');
  const popupStars = document.getElementById('popupStars');
  const removeRatingBtn = document.getElementById('removeRatingBtn');

  if (!userStar || !userRatingText || !popup || !popupStars) return;
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.warn('Supabase not available; ratings disabled.');
    return;
  }

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const supabaseReadClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    }
  });

  const slug = (() => {
    // allow pages to reuse another song's slug for ratings (e.g., alternates/edits)
    if (typeof window !== 'undefined' && window.overrideSlug) {
      return String(window.overrideSlug).toLowerCase();
    }

    const last = (window.location.pathname.split('/').filter(Boolean).pop() || '').toLowerCase();
    return last.replace(/\.html?$/i, '');
  })();

  let songId = null;
  let user = null;
  let currentRating = 0;
  let _deletedRatings = {}; // Track rating deletions to prevent XP farming: { "user_id:song_id": timestamp }

  // Load deletion tracking from localStorage
  function loadDeletedRatingsCache() {
    try {
      const cached = localStorage.getItem('emdb_deleted_song_ratings_xp_track') || '{}';
      _deletedRatings = JSON.parse(cached);
      // Clean up entries older than 2 hours
      const now = Date.now();
      const maxAge = 2 * 60 * 60 * 1000;
      Object.keys(_deletedRatings).forEach(key => {
        if ((now - _deletedRatings[key]) > maxAge) {
          delete _deletedRatings[key];
        }
      });
      localStorage.setItem('emdb_deleted_song_ratings_xp_track', JSON.stringify(_deletedRatings));
    } catch (err) {
      console.log('[SR-RATING] deletion cache load failed:', err);
    }
  }

  function saveDeletedRatingsCache() {
    try {
      localStorage.setItem('emdb_deleted_song_ratings_xp_track', JSON.stringify(_deletedRatings));
    } catch (err) {
      console.log('[SR-RATING] deletion cache save failed:', err);
    }
  }

  const ensureScoreStyling = (scoreEl) => {
    if (!scoreEl || !scoreEl.parentNode) return null;

    scoreEl.classList.add('score-number');

    let sibling = scoreEl.nextSibling;
    while (sibling && sibling.nodeType === Node.TEXT_NODE) {
      const text = sibling.textContent || '';
      if (!text.trim()) {
        const toRemove = sibling;
        sibling = sibling.nextSibling;
        toRemove.remove();
        continue;
      }
      if (text.trim() === '/10') {
        const toRemove = sibling;
        sibling = sibling.nextSibling;
        toRemove.remove();
        continue;
      }
      break;
    }

    let suffix = scoreEl.nextElementSibling;
    if (!suffix || !suffix.classList.contains('score-suffix')) {
      suffix = document.createElement('span');
      suffix.className = 'score-suffix';
      suffix.textContent = '/10';
      scoreEl.parentNode.insertBefore(suffix, scoreEl.nextSibling);
    }

    return suffix;
  };

  const setUserText = (html) => {
    if (userRatingText) userRatingText.innerHTML = html;
  };

  const applyUserRating = (value) => {
    const num = Number(value) || 0;
    if (num > 0) userStar.classList.add('active');
    else userStar.classList.remove('active');
    setUserText(num > 0 ? `<span class="score-number">${num}</span><span class="score-suffix">/10</span>` : 'Rate this song');
    popupStars.querySelectorAll('.star').forEach((star) => {
      const val = Number(star.dataset.value || 0);
      star.classList.toggle('active', val <= num);
    });
  };

  const setPopupHoverState = (value) => {
    popupStars.querySelectorAll('.star').forEach((star) => {
      const val = Number(star.dataset.value || 0);
      star.classList.toggle('active', val <= value);
    });
  };

  const closePopup = () => {
    popup.style.display = 'none';
  };

  const openPopup = async () => {
    if (!user) {
      user = await fetchSessionUser();
      if (!user) {
        window.location.href = '/sign-in.html';
        return;
      }
    }
    popup.style.display = 'flex';
    setPopupHoverState(currentRating || 0);
  };

  popup.addEventListener('click', (e) => {
    if (e.target === popup) closePopup();
  });

  const fetchSessionUser = async () => {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      console.error('Session error:', error);
      setUserText('Session error.');
      return null;
    }
    return data && data.session ? data.session.user : null;
  };

  const ensureSongId = async () => {
    const { data: song, error } = await supabaseClient
      .from('songs')
      .select('id')
      .eq('slug', slug)
      .single();

    if (error) {
      console.error('Song not found:', error);
      setUserText('Song not found.');
      return null;
    }

    return song ? song.id : null;
  };

  const fetchExistingRating = async () => {
    if (!songId || !user) return 0;
    const { data, error } = await supabaseClient
      .from('song_ratings')
      .select('rating')
      .eq('song_id', songId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Rating fetch error:', error);
      return 0;
    }

    return data && data.rating ? Number(data.rating) : 0;
  };

  const fetchOverallRating = async () => {
    const renderOverall = (count, avgValue) => {
      const rounded = count ? Math.round(avgValue * 10) / 10 : 0;
      if (emdbScore) {
        const displayScore = count ? (rounded >= 10 ? '10' : rounded.toFixed(1)) : '0.0';
        emdbScore.textContent = displayScore;
        ensureScoreStyling(emdbScore);
      }
      if (emdbVotes) emdbVotes.textContent = count ? `${count} Rating${count === 1 ? '' : 's'}` : '0 Ratings';
    };

    if (!songId) {
      renderOverall(0, 0);
      return;
    }

    try {
      const { data, error } = await supabaseReadClient
        .from('song_ratings')
        .select('rating')
        .eq('song_id', songId);

      if (error) {
        console.error('Overall rating fetch error:', error);
        renderOverall(0, 0);
        return;
      }

      const count = Array.isArray(data) ? data.length : 0;
      const avg = count ? (data.reduce((sum, r) => sum + Number(r.rating || 0), 0) / count) : 0;
      renderOverall(count, avg);
    } catch (err) {
      console.error('Overall rating fetch failed:', err);
      renderOverall(0, 0);
    }
  };

  const saveRating = async (value) => {
    if (!user) {
      user = await fetchSessionUser();
      if (!user) {
        window.location.href = '/sign-in.html';
        return;
      }
    }
    if (!songId) return;
    const isFirstRating = currentRating <= 0;

    setUserText('Saving...');
    const { error } = await supabaseClient.from('song_ratings').upsert({
      song_id: songId,
      user_id: user.id,
      rating: value,
    }, { onConflict: 'song_id,user_id' });

    if (error) {
      console.error('Error saving rating:', error);
      setUserText('Error saving rating');
      return;
    }

    if (isFirstRating && window.EMDbXP && typeof window.EMDbXP.awardXP === 'function') {
      const delKey = `${user.id}:${songId}`;
      const deletionTime = _deletedRatings[delKey];
      const now = Date.now();
      const recentDeletionWindow = 2 * 60 * 60 * 1000; // 2 hours
      
      // Prevent XP farming: don't award if user just deleted this rating
      if (!deletionTime || (now - deletionTime) > recentDeletionWindow) {
        await window.EMDbXP.awardXP(user.id, 1, {
          action: 'song_rating_create',
          songId
        }, supabaseClient);
      }
    }

    currentRating = value;
    applyUserRating(value);
    fetchOverallRating();
    closePopup();
  };

  const removeRating = async () => {
    if (!user) {
      user = await fetchSessionUser();
      if (!user) {
        window.location.href = '/sign-in.html';
        return;
      }
    }
    if (!songId) return;
    setUserText('Removing...');
    const { error } = await supabaseClient
      .from('song_ratings')
      .delete()
      .eq('song_id', songId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error removing rating:', error);
      setUserText('Error removing rating');
      return;
    }

    // Track deletion to prevent XP farming on re-rating
    const delKey = `${user.id}:${songId}`;
    _deletedRatings[delKey] = Date.now();
    saveDeletedRatingsCache();

    currentRating = 0;
    applyUserRating(0);
    fetchOverallRating();
    closePopup();
  };

  const buildPopupStars = () => {
    popupStars.innerHTML = '';
    for (let i = 1; i <= 10; i += 1) {
      const item = document.createElement('div');
      item.className = 'star-item';

      const star = document.createElement('span');
      star.className = 'star';
      star.textContent = '★';
      star.dataset.value = String(i);

      const label = document.createElement('div');
      label.className = 'star-number';
      label.textContent = String(i);

      star.addEventListener('click', () => saveRating(i));
      star.addEventListener('mouseenter', () => setPopupHoverState(i));

      item.appendChild(star);
      item.appendChild(label);
      popupStars.appendChild(item);
    }

    popupStars.addEventListener('mouseleave', () => {
      setPopupHoverState(currentRating || 0);
    });
  };

  if (removeRatingBtn) {
    removeRatingBtn.addEventListener('click', removeRating);
  }

  userStar.addEventListener('click', openPopup);

  (async function init() {
    buildPopupStars();
    loadDeletedRatingsCache();

    ensureScoreStyling(emdbScore);

    songId = await ensureSongId();
    if (!songId) return;

    // Overall EMDb rating should be visible to everyone, including signed-out users.
    await fetchOverallRating();

    user = await fetchSessionUser();
    if (!user) {
      applyUserRating(0);
      setUserText('Sign in to rate');
      if (emdbScore && !String(emdbScore.textContent || '').trim()) {
        emdbScore.textContent = '0.0';
        ensureScoreStyling(emdbScore);
      }
      if (emdbVotes && /n\/a/i.test(String(emdbVotes.textContent || ''))) {
        emdbVotes.textContent = '0 Ratings';
      }
      return;
    }

    currentRating = await fetchExistingRating();
    applyUserRating(currentRating);

    // Refresh the overall/EMDb rating display
    fetchOverallRating();
  })();
})();
