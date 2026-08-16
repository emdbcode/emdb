(() => {
  if (window.__emdbCollectionFloatingPlayerInit) return;
  window.__emdbCollectionFloatingPlayerInit = true;

  const cards = Array.from(document.querySelectorAll('.track-card'));
  if (!cards.length) return;
  if (document.getElementById('collectionPlayer')) return;

  const styleId = 'collection-floating-player-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
.track-media-col {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  flex-shrink: 0;
}

.track-play-btn {
  display: none;
  width: 72px;
  margin-top: 2px;
  border: 1px solid #333;
  background: #101010;
  color: #cfcfcf;
  border-radius: 8px;
  padding: 5px 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease, background-color 120ms ease;
}

.track-card.show-details .track-play-btn {
  display: block;
}

.track-play-btn:hover,
.track-play-btn:focus-visible,
.track-play-btn.is-active {
  border-color: #E21C21;
  color: #fff;
  background: #1a1a1a;
  outline: none;
}

.track-play-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.track-card.is-current-track {
  border-color: #E21C21;
}

.playlist-panel { display: flex; flex-direction: column; gap: 12px; }
.playlist-player { width: 100%; }
.playlist-container {
  position: static;
  display: none;
}
.player-divider {
  width: 100%;
  height: 1px;
  background: rgba(255,255,255,0.08);
  margin: 6px 0 12px 0;
}
.playlist-container .section-heading {
  font-size: clamp(18px, 4.5vw, 22px);
  font-weight: 800;
}
.playlist-embed {
  width: 100%;
  height: 420px;
  border-radius: 4px;
  border: none;
  position: static;
  background: #000;
}
.now-playing-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border-top: 1px solid #222;
  padding-top: 10px;
  flex-wrap: nowrap;
}
.now-playing-btn {
  background: transparent;
  border: none;
  color: #E21C21;
  font-size: 22px;
  line-height: 1;
  width: 34px;
  height: 34px;
  border-radius: 4px;
  cursor: pointer;
}
.now-playing-btn:disabled { opacity: 0.4; cursor: default; }
.now-playing-title {
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  text-align: center;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}
.now-playing-title.expanded {
  overflow-x: auto;
  text-overflow: clip;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.now-playing-title.expanded::-webkit-scrollbar { display: none; }

.playlist-container.is-floating {
  display: block;
  position: fixed;
  right: 16px;
  bottom: 16px;
  width: min(420px, calc(100vw - 24px));
  margin: 0;
  padding: 10px;
  border: 1px solid #2b2b2b;
  border-radius: 10px;
  background: rgba(11, 11, 11, 0.95);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.55);
  z-index: 999;
  backdrop-filter: blur(3px);
}

.playlist-container.is-floating .player-divider {
  display: none;
}

.playlist-container.is-floating .section-heading {
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.playlist-container.is-floating.is-dragging .section-heading {
  cursor: grabbing;
}

.playlist-container.is-floating .playlist-embed {
  height: clamp(200px, 35vh, 260px);
}

@media (max-width: 520px) {
  .track-play-btn {
    width: 64px;
    font-size: 9px;
  }
}

@media (max-width: 720px){
  .playlist-embed { height: 320px; }
  .now-playing-controls { gap: 8px; }
  .now-playing-btn { font-size: 18px; width: 28px; height: 28px; }
  .playlist-container .section-heading { font-size: clamp(18px, 5vw, 20px); }
  .now-playing-title { max-width: 100%; font-size: 16px; font-weight: 800; }
  .playlist-container.is-floating {
    width: min(320px, calc(100vw - 28px));
    left: 50%;
    right: auto;
    bottom: 22px;
    transform: translateX(-50%);
    padding: 8px;
    border-radius: 8px;
  }
  .playlist-container.is-floating .section-heading {
    font-size: 15px;
    touch-action: auto;
  }
  .playlist-container.is-floating .playlist-panel {
    gap: 8px;
  }
  .playlist-container.is-floating .playlist-embed {
    height: clamp(120px, 22vh, 160px);
  }
  .playlist-container.is-floating .now-playing-controls {
    padding-top: 8px;
  }
}
`;
    document.head.appendChild(style);
  }

  const host = document.querySelector('main.non-album-page') || document.querySelector('main') || document.body;
  const playerWrapper = document.createElement('div');
  playerWrapper.className = 'singles-container playlist-container';
  playerWrapper.id = 'collectionPlayer';
  playerWrapper.setAttribute('aria-label', 'Main collection player');
  playerWrapper.innerHTML = `
    <div class="player-divider" aria-hidden="true"></div>
    <div class="section-heading" id="collectionPlayerHeading">Music Player</div>
    <div class="playlist-panel">
      <div class="video-player open playlist-player">
        <iframe class="playlist-embed" id="collectionPlaylistPlayer" src="about:blank" title="Now Playing" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      </div>
      <div class="now-playing-controls">
        <button class="now-playing-btn" id="collectionPrevBtn" type="button" aria-label="Previous track">⏮</button>
        <div class="now-playing-title" id="collectionNowPlayingTitle">Choose a track</div>
        <button class="now-playing-btn" id="collectionNextBtn" type="button" aria-label="Next track">⏭</button>
      </div>
    </div>
  `;
  host.appendChild(playerWrapper);

  const playerSection = document.getElementById('collectionPlayer');
  const playerFrame = document.getElementById('collectionPlaylistPlayer');
  const playerTitle = document.getElementById('collectionNowPlayingTitle');
  const playerHeading = document.getElementById('collectionPlayerHeading');
  const prevBtn = document.getElementById('collectionPrevBtn');
  const nextBtn = document.getElementById('collectionNextBtn');
  if (!playerSection || !playerFrame || !playerTitle || !playerHeading || !prevBtn || !nextBtn) return;

  const tracks = [];
  let currentTrack = null;
  let isPlaying = false;
  let activePointerId = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  const isMobileViewport = () => window.matchMedia('(max-width: 720px)').matches;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const clampFloatingPosition = (left, top) => {
    const rect = playerSection.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
    const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
    return {
      left: clamp(left, 8, maxLeft),
      top: clamp(top, 8, maxTop),
    };
  };

  const resetFloatingPosition = () => {
    playerSection.classList.remove('is-dragging', 'was-dragged');
    playerSection.style.left = '';
    playerSection.style.top = '';
    playerSection.style.right = '';
    playerSection.style.bottom = '';
  };

  const keepFloatingInViewport = () => {
    if (!playerSection.classList.contains('is-floating') || !playerSection.classList.contains('was-dragged')) return;
    const left = parseFloat(playerSection.style.left || '0');
    const top = parseFloat(playerSection.style.top || '0');
    if (!Number.isFinite(left) || !Number.isFinite(top)) return;
    const clamped = clampFloatingPosition(left, top);
    playerSection.style.left = `${clamped.left}px`;
    playerSection.style.top = `${clamped.top}px`;
  };

  const startPlayerDrag = (event) => {
    if (!playerSection.classList.contains('is-floating')) return;
    if (isMobileViewport()) return;
    if (event.button !== undefined && event.button !== 0) return;

    const rect = playerSection.getBoundingClientRect();
    activePointerId = event.pointerId;
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;

    playerSection.classList.add('is-dragging', 'was-dragged');
    playerSection.style.right = 'auto';
    playerSection.style.bottom = 'auto';
    playerHeading.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const movePlayerDrag = (event) => {
    if (activePointerId !== event.pointerId) return;
    const nextLeft = event.clientX - dragOffsetX;
    const nextTop = event.clientY - dragOffsetY;
    const clamped = clampFloatingPosition(nextLeft, nextTop);
    playerSection.style.left = `${clamped.left}px`;
    playerSection.style.top = `${clamped.top}px`;
  };

  const endPlayerDrag = (event) => {
    if (activePointerId !== event.pointerId) return;
    activePointerId = null;
    playerSection.classList.remove('is-dragging');
    playerHeading.releasePointerCapture?.(event.pointerId);
  };

  playerHeading.addEventListener('pointerdown', startPlayerDrag);
  playerHeading.addEventListener('pointermove', movePlayerDrag);
  playerHeading.addEventListener('pointerup', endPlayerDrag);
  playerHeading.addEventListener('pointercancel', endPlayerDrag);
  window.addEventListener('resize', keepFloatingInViewport);

  const makeAutoplaySrc = (src, autoplay) => {
    if (!src) return '';
    const cleaned = src
      .replace(/([?&])autoplay=1(&|$)/, '$1')
      .replace(/([?&])enablejsapi=1(&|$)/, '$1')
      .replace(/([?&])origin=[^&]+(&|$)/, '$1')
      .replace(/[?&]$/, '');
    const params = [];
    if (autoplay) params.push('autoplay=1');
    params.push('enablejsapi=1');
    if (window.location && window.location.origin && window.location.origin !== 'null') {
      params.push(`origin=${encodeURIComponent(window.location.origin)}`);
    }
    return `${cleaned}${cleaned.includes('?') ? '&' : '?'}${params.join('&')}`;
  };

  const postPlayerCommand = (funcName, args = []) => {
    try {
      playerFrame.contentWindow?.postMessage(JSON.stringify({
        event: 'command',
        func: funcName,
        args,
      }), '*');
    } catch (error) {
      /* best effort */
    }
  };

  const getVideoIdFromSrc = (src) => {
    if (!src) return '';
    const match = String(src).match(/\/embed\/([^?&/]+)/i);
    return match ? match[1] : '';
  };

  const bindPlayerStateListener = () => {
    postPlayerCommand('addEventListener', ['onStateChange']);
  };

  const getVisibleTracks = () => tracks.filter((track) => !track.card.hidden && track.songHref);

  const extractVideoSrcFromSongPage = (html, pageUrl) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const songVideo = doc.querySelector('#songVideo[data-video], .song-video[data-video]');
    if (songVideo && songVideo.dataset.video) {
      return `https://www.youtube.com/embed/${songVideo.dataset.video}`;
    }

    const iframe = doc.querySelector('.song-video iframe, .video-player iframe, iframe[src*="youtube.com/embed/"], iframe[src*="youtube-nocookie.com/embed/"]');
    const src = iframe ? iframe.getAttribute('src') || '' : '';
    if (!src) return '';

    const videoId = getVideoIdFromSrc(src);
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }

    try {
      return new URL(src, pageUrl).toString();
    } catch (error) {
      return src;
    }
  };

  const loadTrackVideoSrc = async (track) => {
    if (!track || !track.songHref) return '';
    if (track.src) return track.src;
    if (track.loadingPromise) return track.loadingPromise;

    const pageUrl = new URL(track.songHref, window.location.href).toString();
    track.loadingPromise = fetch(pageUrl, { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch song page (${response.status})`);
        }
        return response.text();
      })
      .then((html) => {
        const src = extractVideoSrcFromSongPage(html, pageUrl);
        if (!src) {
          throw new Error('No header video found on song page');
        }
        track.src = src;
        return src;
      })
      .finally(() => {
        track.loadingPromise = null;
      });

    return track.loadingPromise;
  };

  const setPlaybackUi = () => {
    tracks.forEach((track) => {
      const isCurrent = currentTrack && track === currentTrack;
      const button = track.playButton;

      track.card.classList.toggle('is-playing', isCurrent && isPlaying);
      track.card.classList.toggle('is-current-track', isCurrent);

      if (!button) return;
      button.classList.toggle('is-active', isCurrent);
      if (isCurrent && isPlaying) {
        button.textContent = 'Pause';
      } else {
        button.textContent = 'Play';
      }
    });

    playerHeading.textContent = isPlaying ? 'Now Playing' : 'Music Player';
    playerSection.classList.toggle('is-floating', isPlaying);
    if (!isPlaying) {
      resetFloatingPosition();
    } else {
      keepFloatingInViewport();
    }
  };

  const syncControls = () => {
    const visibleTracks = getVisibleTracks();
    if (!visibleTracks.length && !currentTrack) {
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      playerHeading.textContent = 'Music Player';
      return;
    }

    if (!currentTrack) {
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }

    if (currentTrack.card.hidden) {
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }

    const currentIndex = visibleTracks.indexOf(currentTrack);
    prevBtn.disabled = currentIndex <= 0;
    nextBtn.disabled = currentIndex >= visibleTracks.length - 1;
  };

  const openTrack = async (track, autoplay = true) => {
    if (!track || !track.songHref) return;

    const button = track.playButton;
    const previousLabel = button ? button.textContent : '';
    if (button) {
      button.disabled = true;
      button.textContent = 'Loading';
    }

    let src = '';
    try {
      src = await loadTrackVideoSrc(track);
    } catch (error) {
      if (button) {
        button.disabled = false;
        button.textContent = previousLabel || 'Play';
      }
      if (currentTrack === track) {
        isPlaying = false;
      }
      setPlaybackUi();
      syncControls();
      return;
    }

    if (button) {
      button.disabled = false;
    }

    const videoId = getVideoIdFromSrc(src);
    const frameReadyForApi = playerFrame.src && playerFrame.src !== 'about:blank';

    if (frameReadyForApi && videoId) {
      postPlayerCommand(autoplay ? 'loadVideoById' : 'cueVideoById', [videoId]);
    } else {
      playerFrame.src = makeAutoplaySrc(src, autoplay);
    }

    currentTrack = track;
    playerFrame.title = track.title;
    playerTitle.textContent = track.title;
    isPlaying = autoplay;
    setPlaybackUi();
    syncControls();
  };

  const pauseCurrentTrack = () => {
    if (!currentTrack) return;
    postPlayerCommand('pauseVideo');
    isPlaying = false;
    setPlaybackUi();
    syncControls();
  };

  const resumeCurrentTrack = () => {
    if (!currentTrack) return;
    postPlayerCommand('playVideo');
    isPlaying = true;
    setPlaybackUi();
    syncControls();
  };

  const getNextTrackForAutoplay = () => {
    if (!currentTrack) return null;

    const visibleTracks = getVisibleTracks();
    const visibleIndex = visibleTracks.indexOf(currentTrack);
    if (visibleIndex >= 0) {
      return visibleTracks[visibleIndex + 1] || null;
    }

    const allIndex = tracks.indexOf(currentTrack);
    return allIndex >= 0 ? (tracks[allIndex + 1] || null) : null;
  };

  const handlePlayerMessage = (event) => {
    if (event.source !== playerFrame.contentWindow) return;

    let payload = event.data;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (error) {
        return;
      }
    }

    if (!payload || payload.event !== 'onStateChange') return;
    if (Number(payload.info) !== 0) return;

    isPlaying = false;
    const nextTrack = getNextTrackForAutoplay();
    if (nextTrack) {
      void openTrack(nextTrack, true);
      return;
    }

    setPlaybackUi();
    syncControls();
  };

  playerFrame.addEventListener('load', bindPlayerStateListener);
  window.addEventListener('message', handlePlayerMessage);

  cards.forEach((card) => {
    const titleText = card.querySelector('.track-title')?.textContent?.trim() || 'Track';
    const titleLink = card.querySelector('.track-title a');
    const thumbLink = card.querySelector('.track-link, .track-thumb-link');
    const songHref = titleLink?.getAttribute('href') || thumbLink?.getAttribute('href') || '';

    const thumbNode = thumbLink || card.querySelector('.track-thumb');
    if (thumbNode && !card.querySelector('.track-media-col')) {
      const mediaCol = document.createElement('div');
      mediaCol.className = 'track-media-col';
      card.insertBefore(mediaCol, card.firstChild);
      mediaCol.appendChild(thumbNode);
    }

    const mediaCol = card.querySelector('.track-media-col');
    const playButton = document.createElement('button');
    playButton.type = 'button';
    playButton.className = 'track-play-btn';
    playButton.textContent = 'Play';
    playButton.setAttribute('aria-label', `Play ${titleText}`);
    if (!songHref) {
      playButton.disabled = true;
    }
    if (mediaCol) {
      mediaCol.appendChild(playButton);
    }

    const track = {
      card,
      title: titleText,
      songHref,
      src: '',
      loadingPromise: null,
      playButton,
    };
    tracks.push(track);

    playButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!track.songHref) return;

      if (currentTrack === track && isPlaying) {
        pauseCurrentTrack();
        return;
      }

      if (currentTrack === track) {
        resumeCurrentTrack();
        return;
      }

      void openTrack(track, true);
    });

    playButton.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.stopPropagation();
      }
    });
  });

  prevBtn.addEventListener('click', () => {
    const visibleTracks = getVisibleTracks();
    if (!visibleTracks.length || !currentTrack) return;
    const index = Math.max(0, visibleTracks.indexOf(currentTrack) - 1);
    void openTrack(visibleTracks[index], true);
  });

  nextBtn.addEventListener('click', () => {
    const visibleTracks = getVisibleTracks();
    if (!visibleTracks.length || !currentTrack) return;
    const index = Math.min(visibleTracks.length - 1, visibleTracks.indexOf(currentTrack) + 1);
    void openTrack(visibleTracks[index], true);
  });

  const observer = new MutationObserver(() => {
    syncControls();
  });
  cards.forEach((card) => {
    observer.observe(card, { attributes: true, attributeFilter: ['hidden', 'class'] });
  });

  window.refreshCollectionPlayer = syncControls;
  syncControls();
  setPlaybackUi();

  if (tracks[0]) {
    void loadTrackVideoSrc(tracks[0]).then((src) => {
      if (!src || currentTrack) return;
      playerFrame.src = makeAutoplaySrc(src, false);
      playerFrame.title = tracks[0].title;
    }).catch(() => {
      /* best effort preload */
    });
  }
})();