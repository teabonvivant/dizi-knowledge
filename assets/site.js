/* Optional reading enhancements; navigation and content remain usable without JS. */
(() => {
  const revealAnchor = () => {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { return; }
    const target = id && document.getElementById(id);
    if (!target) return;
    let parent = target.parentElement;
    let opened = false;
    while (parent) {
      if (parent.tagName === 'DETAILS' && !parent.open) { parent.open = true; opened = true; }
      parent = parent.parentElement;
    }
    if (opened) requestAnimationFrame(() => target.scrollIntoView({block: 'start'}));
  };
  window.addEventListener('hashchange', revealAnchor);
  revealAnchor();
  const menu = document.querySelector('.nav-disclosure');
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu?.open) {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
  });
  document.addEventListener('click', event => {
    if (menu?.open && !menu.contains(event.target)) menu.open = false;
  });
  const tools = document.querySelector('.reading-tools');
  if (tools) {
    tools.hidden = false;
    const button = tools.querySelector('[data-type-toggle]');
    const setType = large => {
      document.body.classList.toggle('large-type', large);
      button.setAttribute('aria-pressed', String(large));
      button.textContent = large ? '標準字級' : '放大正文';
    };
    try { setType(localStorage.getItem('dizi-large-type') === 'true'); } catch (_) { /* Storage is optional. */ }
    button.addEventListener('click', () => {
      const large = !document.body.classList.contains('large-type');
      setType(large);
      try { localStorage.setItem('dizi-large-type', String(large)); } catch (_) { /* Storage is optional. */ }
    });
  }
})();
