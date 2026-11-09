(function setupComingSoonLinks() {
  const dialog = document.createElement('dialog');
  dialog.className = 'coming-soon-dialog';
  dialog.id = 'comingSoonDialog';
  dialog.setAttribute('aria-labelledby', 'comingSoonMessage');
  dialog.innerHTML = '<p id="comingSoonMessage">Coming soon: This will become a clickable link to a dedicated page.</p><button type="button" autofocus>Close</button>';
  document.body.appendChild(dialog);

  document.querySelectorAll('button.coming-soon-link').forEach(button => {
    const link = document.createElement('a');
    for (const attribute of button.attributes) {
      if (attribute.name !== 'type') link.setAttribute(attribute.name, attribute.value);
    }
    link.href = '#comingSoonDialog';
    link.setAttribute('role', 'button');
    link.setAttribute('aria-haspopup', 'dialog');
    link.setAttribute('aria-controls', dialog.id);
    link.append(...button.childNodes);
    button.replaceWith(link);
  });
  document.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('.coming-soon-link')) {
      event.preventDefault();
      dialog.showModal();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === ' ' && event.target instanceof Element && event.target.matches('a.coming-soon-link')) {
      event.preventDefault();
      event.target.click();
    }
  });
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') dialog.close();
  });
})();
