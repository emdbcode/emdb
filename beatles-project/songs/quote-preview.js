(function setupSongQuotePreviews() {
  const previews = Array.from(document.querySelectorAll('.song-extra .fancy-quote')).map((quote, index) => {
    const text = quote.querySelector('.quote-text');
    const attribution = quote.querySelector('.quote-attrib');
    if (!text || !attribution) return null;

    text.id = text.id || `song-quote-${index + 1}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quote-preview-toggle';
    button.setAttribute('aria-controls', text.id);
    button.hidden = true;
    quote.appendChild(button);
    let expanded = false;

    function updateButton() {
      button.setAttribute('aria-expanded', String(expanded));
      button.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Read full'} quote ${attribution.textContent.trim()}`);
      button.textContent = expanded ? 'Show less' : 'Read full quote';
    }

    function toggleQuote() {
      expanded = !expanded;
      quote.classList.toggle('is-collapsed', !expanded);
      updateButton();
    }

    button.addEventListener('click', event => {
      event.stopPropagation();
      toggleQuote();
    });
    quote.addEventListener('click', event => {
      if (button.hidden || event.target.closest('a, button') || window.getSelection().toString()) return;
      toggleQuote();
    });

    return function updatePreview() {
      const style = window.getComputedStyle(text);
      const previewHeight = parseFloat(style.fontSize) * 9;
      const lineHeight = parseFloat(style.lineHeight);
      const longEnough = text.scrollHeight > previewHeight + lineHeight;
      if (!longEnough) expanded = false;
      quote.classList.toggle('quote-preview', longEnough);
      quote.classList.toggle('is-collapsed', longEnough && !expanded);
      button.hidden = !longEnough;
      updateButton();
    };
  }).filter(Boolean);

  function updatePreviews() {
    previews.forEach(update => update());
  }

  updatePreviews();
  window.addEventListener('resize', updatePreviews);
})();

(function setupSongFactsPreview() {
  const anchor = document.getElementById('section-facts');
  if (!anchor) return;
  const section = anchor.matches('.song-extra') ? anchor : anchor.closest('.song-extra');
  if (!section) return;
  const list = section.querySelector('ul');
  if (!list) return;

  const content = document.createElement('div');
  content.className = 'song-facts-content';
  content.id = 'songFactsContent';
  list.before(content);
  content.appendChild(list);
  section.classList.add('song-facts-preview');
  const links = Array.from(content.querySelectorAll('a, button'));
  const originalTabIndexes = new Map(links.map(link => [link, link.getAttribute('tabindex')]));
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'song-facts-toggle';
  button.setAttribute('aria-controls', content.id);
  section.appendChild(button);
  let expanded = false;

  function updatePreview() {
    const previewHeight = parseFloat(getComputedStyle(content).fontSize) * 9;
    const expandable = content.scrollHeight > previewHeight + 22.5;
    if (!expandable) expanded = false;
    section.classList.toggle('is-expandable', expandable);
    section.classList.toggle('is-collapsed', expandable && !expanded);
    button.hidden = !expandable;
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', expanded ? 'Show fewer song facts' : 'Read all song facts');
    button.textContent = expanded ? 'Show less' : 'Read all song facts';

    const bottom = content.getBoundingClientRect().bottom;
    links.forEach(link => {
      if (expandable && !expanded && link.getBoundingClientRect().bottom > bottom) {
        link.setAttribute('tabindex', '-1');
      } else {
        const original = originalTabIndexes.get(link);
        if (original === null) link.removeAttribute('tabindex');
        else link.setAttribute('tabindex', original);
      }
    });
  }

  function toggle() {
    expanded = !expanded;
    updatePreview();
  }

  button.addEventListener('click', event => {
    event.stopPropagation();
    toggle();
  });
  section.addEventListener('click', event => {
    if (button.hidden || event.target.closest('a, button') || window.getSelection().toString()) return;
    toggle();
  });
  updatePreview();
  window.addEventListener('resize', updatePreview);
})();
