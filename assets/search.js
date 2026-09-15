(() => {
  const form = document.querySelector('#search-form');
  const input = document.querySelector('#query');
  const type = document.querySelector('#record-type');
  const language = document.querySelector('#language');
  const output = document.querySelector('#search-results');
  const summary = document.querySelector('#search-summary');
  const more = document.querySelector('#search-more');
  const searchShell = document.querySelector('[data-search-index-url]');
  if (!form || !input || !type || !language || !output || !summary || !more) return;

  const PAGE_SIZE = 50;
  const indexUrl = (searchShell && searchShell.dataset.searchIndexUrl) || 'search_index/index.json';
  const esc = value => String(value ?? '').replace(/[&<>"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
  const normal = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('zh-Hant').replace(/\s+/g, ' ').trim();
  const params = new URLSearchParams(location.search);
  let items = null;
  let filtered = [];
  let visibleLimit = PAGE_SIZE;

  input.value = params.get('q') || '';
  type.value = params.get('type') || '';
  language.value = params.get('language') || '';

  function setState(state) {
    more.innerHTML = '';
    if (state === 'loading') {
      summary.textContent = '正在載入搜尋索引…';
      output.innerHTML = '<div class="search-state" data-state="loading" role="status">正在載入搜尋索引…</div>';
    } else if (state === 'error') {
      summary.textContent = '搜尋索引暫時無法使用';
      output.innerHTML = '<div class="search-state search-error" data-state="error" role="alert"><strong>暫時無法搜尋</strong><span>索引載入失敗，請重新載入，或使用下方入口。</span><button type="button" class="button secondary" id="search-retry">重新載入索引</button></div>';
      output.querySelector('#search-retry').addEventListener('click', loadIndex);
    }
  }

  function syncUrl() {
    const next = new URLSearchParams();
    if (input.value.trim()) next.set('q', input.value.trim());
    if (type.value) next.set('type', type.value);
    if (language.value) next.set('language', language.value);
    history.replaceState(null, '', location.pathname + (next.toString() ? '?' + next.toString() : ''));
  }

  function renderCard(item) {
    const byline = (item.authors || []).join('、') || item.publisher || (item.record_type === 'source' ? '未署名' : '');
    const states = [
      item.maturity_level ? '<span class="badge verified">' + esc(item.maturity_level) + '</span>' : '',
      item.verification_label ? '<span class="badge verified">' + esc(item.verification_label) + '</span>' : '',
      item.rights_label ? '<span class="badge rights">' + esc(item.rights_label) + '</span>' : '',
    ].join('');
    const tags = (item.top_level_topic_labels || item.top_level_topics || [])
      .map(tag => '<span class="micro-tag">' + esc(tag) + '</span>').join('');
    return '<article class="source-card"><div class="source-axis" aria-hidden="true"></div><div>' +
      '<p class="eyebrow">' + esc(item.type_label || item.source_type) +
      (item.publication_date ? ' · ' + esc(item.publication_date) : '') + '</p>' +
      '<h3><a href="' + esc(item.route) + '">' + esc(item.title) + '</a></h3>' +
      (byline ? '<p>' + esc(byline) + '</p>' : '') +
      '<div class="tag-row">' + tags + '</div></div><div class="card-state">' + states + '</div></article>';
  }

  function renderResults() {
    if (!filtered.length) {
      summary.textContent = '找到 0 筆資料';
      output.innerHTML = '<div class="empty" data-state="empty"><strong>沒有相符資料</strong><span>請縮短關鍵詞，或取消內容類型及語言篩選。</span></div>';
      more.innerHTML = '';
      return;
    }
    const visible = filtered.slice(0, visibleLimit);
    summary.textContent = '找到 ' + filtered.length + ' 筆資料，現顯示 ' + visible.length + ' 筆';
    output.innerHTML = visible.map(renderCard).join('');
    more.innerHTML = '';
    if (visible.length < filtered.length) {
      more.innerHTML = '<button id="search-more-button" class="button secondary" type="button">顯示更多</button>';
      more.querySelector('#search-more-button').addEventListener('click', () => {
        const previousCount = visibleLimit;
        visibleLimit += PAGE_SIZE;
        renderResults();
        output.querySelectorAll('h3 a')[previousCount]?.focus();
      });
    }
  }

  function render() {
    if (!Array.isArray(items)) return;
    visibleLimit = PAGE_SIZE;
    const q = normal(input.value);
    const terms = q.split(' ').filter(Boolean).flatMap(term => /[\u3400-\u9fff]{2,}/u.test(term) ? Array.from(term) : [term]);
    filtered = items.filter(item => {
      const haystack = normal([item.title, ...(item.authors || []), item.publisher, ...(item.aliases || []), ...(item.topics || []), ...(item.claim_text || [])].join(' '));
      return terms.every(term => haystack.includes(term)) && (!type.value || item.filter_type === type.value) && (!language.value || item.language === language.value);
    }).sort((a, b) => {
      if (!q) return String(b.publication_date).localeCompare(String(a.publication_date));
      const score = item => normal(item.title) === q ? 3 : normal(item.title).startsWith(q) ? 2 : normal(item.title).includes(q) ? 1 : 0;
      return score(b) - score(a) || String(a.title).localeCompare(String(b.title), 'zh-Hant');
    });
    syncUrl();
    renderResults();
  }

  form.addEventListener('submit', event => { event.preventDefault(); render(); });
  form.addEventListener('reset', event => {
    // Native reset defaults run after event dispatch; render explicit cleared values.
    event.preventDefault();
    clearTimeout(typingTimer);
    input.value = '';
    type.value = '';
    language.value = '';
    render();
    input.focus();
  });
  let typingTimer;
  input.addEventListener('input', event => {
    if (event.isComposing) return;
    clearTimeout(typingTimer);
    typingTimer = setTimeout(render, 160);
  });
  input.addEventListener('compositionend', render);
  type.addEventListener('change', render);
  language.addEventListener('change', render);

  async function loadIndex() {
    setState('loading');
    try {
      const response = await fetch(new URL(indexUrl, document.baseURI), {headers: {accept: 'application/json'}});
      if (!response.ok) throw new Error('search index request failed: ' + response.status);
      const payload = await response.json();
      items = Array.isArray(payload) ? payload : payload.items;
      if (!Array.isArray(items)) throw new Error('search index payload is invalid');
      render();
    } catch (error) {
      items = null;
      setState('error');
    }
  }

  loadIndex();
})();
