(function initGalleryEnhancements() {
  const run = function () {
    const path = String(window.location.pathname || '');
    if (!path.includes('/gallery/')) return;

    const body = document.body;
    if (!body) return;

    const main = document.querySelector('main') || body;
    body.classList.add('gallery-page');

    const containers = Array.from((main || body).querySelectorAll('.gallery-container, .sample-page'));
    const allIframes = Array.from((main || body).querySelectorAll('iframe'));
    const isMultiVideoPage = allIframes.length > 1;

    if (!document.getElementById('gallery-page-enhancer-style')) {
      const style = document.createElement('style');
      style.id = 'gallery-page-enhancer-style';
      style.textContent = [
        'body.gallery-page main h1,',
        'body.gallery-page main h2,',
        'body.gallery-page main h3,',
        'body.gallery-page h1,',
        'body.gallery-page h2,',
        'body.gallery-page h3 {',
        '  font-size: 1.35rem !important;',
        '  line-height: 1.3;',
        '}',
        'body.gallery-page .gallery-back-wrap {',
        '  max-width: 900px;',
        '  margin: 1rem auto 0;',
        '  padding: 0 1rem;',
        '}',
        'body.gallery-page .gallery-back-btn {',
        '  display: inline-block;',
        '  background: #111;',
        '  color: #eaeaea;',
        '  border: 1px solid #333;',
        '  border-radius: 8px;',
        '  padding: 0.45rem 0.8rem;',
        '  font-size: 0.9rem;',
        '  cursor: pointer;',
        '}',
        'body.gallery-page .gallery-back-btn:hover,',
        'body.gallery-page .gallery-back-btn:focus-visible {',
        '  border-color: #E21C21;',
        '  color: #fff;',
        '  text-decoration: none;',
        '}',
        'body.gallery-page .gallery-container,',
        'body.gallery-page .sample-page {',
        '  background: #222 !important;',
        '  color: #ddd !important;',
        '  border: 0 !important;',
        '  border-radius: 6px !important;',
        '}',
        'body.gallery-page main .gallery-container img,',
        'body.gallery-page main .sample-page img,',
        'body.gallery-page .gallery-image img,',
        'body.gallery-page main > img {',
        '  display: block;',
        '  margin-left: auto !important;',
        '  margin-right: auto !important;',
        '}'
      ].join('\n');
      document.head.appendChild(style);
    }

    containers.forEach((container) => {
      container.style.setProperty('max-width', '900px', 'important');
      container.style.setProperty('margin', '2rem auto', 'important');
      container.style.setProperty('padding', '1.5rem', 'important');
      container.style.setProperty('background-color', '#222', 'important');
      container.style.setProperty('border-radius', '6px', 'important');
      container.style.setProperty('border', '0', 'important');
      container.style.setProperty('color', '#ddd', 'important');

      if (!isMultiVideoPage) {
        const mediaFrames = Array.from(container.querySelectorAll('iframe'));
        mediaFrames.forEach((frame) => {
          const wrap = frame.parentElement;
          if (wrap) {
            wrap.style.setProperty('max-width', '620px', 'important');
            wrap.style.setProperty('margin', '1.25rem auto 0', 'important');
            wrap.style.setProperty('width', '100%', 'important');
            wrap.style.setProperty('aspect-ratio', '16/9', 'important');
            wrap.style.setProperty('border-radius', '6px', 'important');
            wrap.style.setProperty('overflow', 'hidden', 'important');
          }
          frame.style.setProperty('width', '100%', 'important');
          frame.style.setProperty('height', '100%', 'important');
          frame.style.setProperty('display', 'block', 'important');
        });

        const mediaImages = Array.from(container.querySelectorAll('img'));
        mediaImages.forEach((img) => {
          const src = String(img.getAttribute('src') || '');
          if (src.includes('/images/logos/') || src.includes('x-logo') || src.includes('facebook') || src.includes('instagram') || src.includes('youtube') || src.includes('paypal')) {
            return;
          }
          img.style.setProperty('max-width', '620px', 'important');
          img.style.setProperty('width', '100%', 'important');
          img.style.setProperty('height', 'auto', 'important');
          img.style.setProperty('display', 'block', 'important');
          img.style.setProperty('margin-left', 'auto', 'important');
          img.style.setProperty('margin-right', 'auto', 'important');
          img.style.setProperty('border-radius', '6px', 'important');
        });
      }
    });

    const goBack = function () {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      const ref = document.referrer || '/index.html';
      window.location.href = ref;
    };

    const existingBackLink = main.querySelector('.back-link') || body.querySelector('.back-link');
    if (existingBackLink) {
      existingBackLink.classList.add('gallery-back-btn');
      existingBackLink.textContent = 'Back';
      if (existingBackLink.dataset.backBound !== 'true') {
        existingBackLink.dataset.backBound = 'true';
        existingBackLink.addEventListener('click', function (event) {
          event.preventDefault();
          goBack();
        });
      }
    }

    if (!existingBackLink && !main.querySelector('.gallery-back-wrap')) {
      const backWrap = document.createElement('div');
      backWrap.className = 'gallery-back-wrap';

      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'gallery-back-btn';
      backBtn.textContent = 'Back';
      backBtn.addEventListener('click', goBack);

      backWrap.appendChild(backBtn);
      main.insertBefore(backWrap, main.firstChild);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
