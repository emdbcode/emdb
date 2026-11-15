(function () {
  const swipeThreshold = 40;

  window.setupBeatlesCoverIndicator = (buttons) => {
    let animations = [];
    return (previousIndex, currentIndex, lastIndex) => {
      animations.forEach((animation) => animation.cancel());
      animations = [];
      if (previousIndex === currentIndex || previousIndex <= 0 || currentIndex <= 0 ||
          previousIndex >= lastIndex || currentIndex >= lastIndex) return;

      animations = [
        buttons[1].animate([{ color: '#777' }, { color: '#777' }], 180),
        buttons[2].animate([{ color: '#fff' }, { color: '#fff' }], 180),
      ];
    };
  };

  window.setupBeatlesCoverSwipe = (cover, onSwipe) => {
    let gesture = null;
    cover.style.touchAction = 'pan-y';

    cover.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 1) {
        gesture = null;
        return;
      }
      const touch = event.touches[0];
      gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, swiping: false };
    }, { passive: true });

    cover.addEventListener('touchmove', (event) => {
      if (!gesture || event.touches.length !== 1) {
        gesture = null;
        return;
      }
      const touch = event.touches[0];
      if (touch.identifier !== gesture.id) return;
      const dx = touch.clientX - gesture.x;
      const dy = touch.clientY - gesture.y;
      if (Math.abs(dx) >= swipeThreshold && Math.abs(dx) > Math.abs(dy) * 1.2) {
        gesture.swiping = true;
      }
      if (gesture.swiping && event.cancelable) event.preventDefault();
    }, { passive: false });

    cover.addEventListener('touchend', (event) => {
      if (!gesture) return;
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === gesture.id);
      if (!touch) return;
      const dx = touch.clientX - gesture.x;
      const dy = touch.clientY - gesture.y;
      const isSwipe = Math.abs(dx) >= swipeThreshold && Math.abs(dx) > Math.abs(dy) * 1.2;
      if (gesture.swiping || isSwipe) {
        if (event.cancelable) event.preventDefault();
        if (isSwipe) onSwipe(dx < 0 ? 1 : -1);
      }
      gesture = null;
    }, { passive: false });

    cover.addEventListener('touchcancel', () => {
      gesture = null;
    });
  };
})();
