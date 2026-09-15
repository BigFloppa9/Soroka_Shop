const api = (() => {
  function readCache(url) {
    try {
      const raw = sessionStorage.getItem('soroka-cache:' + url);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function writeCache(url, data) {
    try { sessionStorage.setItem('soroka-cache:' + url, JSON.stringify(data)); } catch (e) {}
  }

  async function request(method, url, body) {
    const opts = {
      method,
      headers: {},
      credentials: 'same-origin',
    };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    let data = null;
    try { data = await res.json(); } catch (e) { /* пустой ответ */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || 'Ошибка запроса');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function getCached(url, { onUpdate } = {}) {
    const cached = readCache(url);
    const fresh = request('GET', url).then(data => {
      const changed = !cached || JSON.stringify(data) !== JSON.stringify(cached);
      writeCache(url, data);
      if (changed && onUpdate) onUpdate(data);
      return data;
    });
    if (cached) {
      fresh.catch(() => {});
      return Promise.resolve(cached);
    }
    return fresh;
  }

  return {
    get: (url, opts) => (opts && opts.cache) ? getCached(url, opts) : request('GET', url),
    post: (url, body) => request('POST', url, body || {}),
    put: (url, body) => request('PUT', url, body || {}),
    del: (url) => request('DELETE', url),
  };
})();
