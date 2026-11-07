(function setupSectionMenu(){
  const menu = document.getElementById('sectionMenu');
  const closeButton = menu.querySelector('.section-menu-close');
  const mobile = window.matchMedia('(max-width: 767px)');
  let touchStart = null;
  let previousFocus = null;

  function openMenu(){
    if (!mobile.matches || menu.classList.contains('open')) return;
    previousFocus = document.activeElement;
    menu.inert = false;
    menu.setAttribute('aria-hidden', 'false');
    menu.classList.add('open');
    closeButton.classList.add('initial-focus');
    closeButton.focus({preventScroll:true});
  }

  function closeMenu(restoreFocus = true){
    if (!menu.classList.contains('open')) return;
    if (restoreFocus && previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus({preventScroll:true});
    else if (menu.contains(document.activeElement)) document.activeElement.blur();
    menu.classList.remove('open');
    menu.inert = true;
    menu.setAttribute('aria-hidden', 'true');
    previousFocus = null;
  }

  closeButton.addEventListener('click', () => closeMenu());
  closeButton.addEventListener('blur', () => closeButton.classList.remove('initial-focus'));
  document.addEventListener('click', event => {
    if (menu.classList.contains('open') && !menu.contains(event.target)) closeMenu();
  });
  menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      const target = document.getElementById(link.hash.slice(1));
      closeMenu(false);
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus({preventScroll:true});
      }
    });
  });
  document.addEventListener('keydown', event => {
    if (!menu.classList.contains('open')) return;
    if (event.key === 'Tab') closeButton.classList.remove('initial-focus');
    if (event.key === 'Escape') {
      closeMenu();
    } else if (event.key === 'Tab') {
      const items = menu.querySelectorAll('a[href], button');
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  document.addEventListener('touchstart', event => {
    if (!mobile.matches || event.touches.length !== 1) {
      touchStart = null;
      return;
    }
    const touch = event.touches[0];
    touchStart = {x:touch.clientX, y:touch.clientY, edge:touch.clientX >= window.innerWidth - 24};
  }, {passive:true});
  document.addEventListener('touchend', event => {
    if (!touchStart || event.changedTouches.length !== 1) {
      touchStart = null;
      return;
    }
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    if (Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (!menu.classList.contains('open') && touchStart.edge && dx < 0) openMenu();
      else if (menu.classList.contains('open') && dx > 0) closeMenu();
    }
    touchStart = null;
  }, {passive:true});
  document.addEventListener('touchcancel', () => { touchStart = null; }, {passive:true});
  window.addEventListener('resize', () => { if (!mobile.matches) closeMenu(false); });
})();
