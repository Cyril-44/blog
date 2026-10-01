document.addEventListener('DOMContentLoaded', () => {
  const page = document.querySelector('.full-search');
  if (!page) return;

  const form = document.getElementById('full-search-form');
  const input = document.getElementById('full-search-input');
  const status = document.getElementById('full-search-status');
  const results = document.getElementById('full-search-results');
  const siteRoot = new URL(page.dataset.indexUrl, location.href).pathname.replace(/[^/]*$/, '');
  let indexPromise;
  let timer;
  let requestId = 0;

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(page.dataset.indexUrl)
        .then(response => {
          if (!response.ok) throw new Error(`Search index returned ${response.status}`);
          return response.json();
        })
        .then(data => {
          if (!Array.isArray(data)) throw new Error('Invalid search index');
          return data.map((item, order) => {
            const title = String(item.title || '无标题');
            const content = String(item.content || '');
            const metadata = [...(Array.isArray(item.categories) ? item.categories : []),
              ...(Array.isArray(item.tags) ? item.tags : [])].join(' ');
            return {
              title,
              content,
              url: String(item.url || ''),
              metadata,
              titleLower: title.toLocaleLowerCase(),
              contentLower: content.toLocaleLowerCase(),
              metadataLower: metadata.toLocaleLowerCase(),
              order
            };
          }).filter(item => resultUrl(item.url));
        })
        .catch(error => {
          indexPromise = null; // A later search can retry a failed request.
          throw error;
        });
    }
    return indexPromise;
  }

  function appendHighlighted(parent, value, terms) {
    const lower = value.toLocaleLowerCase();
    let offset = 0;
    while (offset < value.length) {
      let next = -1;
      let length = 0;
      for (const term of terms) {
        const found = lower.indexOf(term, offset);
        if (found !== -1 && (next === -1 || found < next || (found === next && term.length > length))) {
          next = found;
          length = term.length;
        }
      }
      if (next === -1) {
        parent.append(document.createTextNode(value.slice(offset)));
        break;
      }
      if (next > offset) parent.append(document.createTextNode(value.slice(offset, next)));
      const mark = document.createElement('mark');
      mark.textContent = value.slice(next, next + length);
      parent.append(mark);
      offset = next + length;
    }
  }

  function excerpt(post, terms) {
    const matches = terms.map(term => post.contentLower.indexOf(term)).filter(index => index >= 0);
    const start = matches.length ? Math.max(0, Math.min(...matches) - 55) : 0;
    const end = Math.min(post.content.length, start + 175);
    const text = post.content.slice(start, end).replace(/\s+/g, ' ').trim();
    return `${start ? '…' : ''}${text}${end < post.content.length ? '…' : ''}`;
  }

  function resultUrl(path) {
    if (!path) return null;
    try {
      const url = new URL(path, location.href);
      return url.origin === location.origin && url.pathname.startsWith(siteRoot) ? url.href : null;
    } catch {
      return null;
    }
  }

  function renderResults(posts, terms) {
    results.replaceChildren();
    const fragment = document.createDocumentFragment();
    for (const post of posts) {
      const href = resultUrl(post.url);
      if (!href) continue;
      const card = document.createElement('article');
      card.className = 'full-search-result';
      const heading = document.createElement('h2');
      const link = document.createElement('a');
      link.href = href;
      appendHighlighted(link, post.title, terms);
      heading.append(link);
      card.append(heading);
      if (post.metadata) {
        const meta = document.createElement('p');
        meta.className = 'full-search-result-meta';
        appendHighlighted(meta, post.metadata, terms);
        card.append(meta);
      }
      const snippet = excerpt(post, terms);
      if (snippet) {
        const description = document.createElement('p');
        description.className = 'full-search-result-snippet';
        appendHighlighted(description, snippet, terms);
        card.append(description);
      }
      fragment.append(card);
    }
    results.append(fragment);
  }

  async function search() {
    const currentRequest = ++requestId;
    const query = input.value.trim();
    const url = new URL(location.href);
    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    history.replaceState(null, '', url);

    if (!query) {
      results.replaceChildren();
      status.textContent = '输入关键词后开始搜索。';
      return;
    }

    const terms = [...new Set(query.toLocaleLowerCase().split(/\s+/u).filter(Boolean))];
    status.textContent = '正在搜索…';
    try {
      const posts = await loadIndex();
      if (currentRequest !== requestId) return;
      const matches = posts.map(post => {
        const score = terms.reduce((sum, term) => {
          if (post.titleLower.includes(term)) return sum + 100;
          if (post.metadataLower.includes(term)) return sum + 30;
          if (post.contentLower.includes(term)) return sum + 1;
          return -Infinity;
        }, 0);
        return { post, score };
      }).filter(match => Number.isFinite(match.score));
      matches.sort((a, b) => b.score - a.score || a.post.order - b.post.order);
      renderResults(matches.map(match => match.post), terms);
      status.textContent = matches.length ? `找到 ${matches.length} 篇文章。` : '没有找到匹配的文章。';
    } catch {
      if (currentRequest !== requestId) return;
      results.replaceChildren();
      status.textContent = '搜索索引加载失败，请检查网络后重试。';
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    clearTimeout(timer);
    search();
  });
  input.addEventListener('input', () => {
    clearTimeout(timer);
    ++requestId; // Ignore a previous fetch while the next query is debounced.
    if (!input.value.trim()) {
      search();
      return;
    }
    timer = setTimeout(search, 160);
  });
  window.addEventListener('popstate', () => {
    input.value = new URLSearchParams(location.search).get('q') || '';
    clearTimeout(timer);
    search();
  });

  input.value = new URLSearchParams(location.search).get('q') || '';
  if (input.value.trim()) search();
});
