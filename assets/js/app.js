(() => {
  // Shared helpers for the Jawa Profit Tracker static site.
  // -------------------------------------------------------------------------
  // Point API_BASE at your deployed Render backend. Override per page by
  // setting window.JAWA = { apiBase: '...' } before this script runs.
  //   <script>window.JAWA = { apiBase: 'https://jawa-profit-tracker.onrender.com/api' };</script>
  const elementCache = new Map();
  const $ = (id) => {
    if (elementCache.has(id)) return elementCache.get(id);
    const el = document.getElementById(id);
    if (el) { elementCache.set(id, el); return el; }
    const noop = () => {};
    const stub = new Proxy({}, {
      get: (_t, prop) => {
        if (prop === 'classList') return { add: noop, remove: noop, toggle: () => false, contains: () => false };
        if (['addEventListener','removeEventListener','appendChild','remove','focus','click','scrollIntoView'].includes(prop)) return noop;
        if (prop === 'dataset') return {};
        if (prop === 'style') return {};
        if (prop === 'parentElement' || prop === 'nextSibling') return null;
        if (['value','textContent','innerHTML','className','id'].includes(prop)) return '';
        return '';
      },
      set: (_t, prop, value) => { _t[prop] = value; return true; },
    });
    elementCache.set(id, stub);
    return stub;
  };

  const DEFAULT_API_BASE = 'http://localhost:3001/api';
  const API_BASE = (window.JAWA && window.JAWA.apiBase) || DEFAULT_API_BASE;

  function showToast(message, type = 'ok', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast' + (type === 'error' ? ' error' : '');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, duration);
  }

  async function api(path, opts = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(API_BASE + path, {
      ...opts,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    clearTimeout(timer);
    let data;
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || 'Request failed (HTTP ' + res.status + ')');
    }
    return data;
  }

  // Expose for inline page scripts
  window.Jawa = window.Jawa || {};
  window.Jawa.API_BASE = API_BASE;
  window.Jawa.api = api;
  window.Jawa.showToast = showToast;
  window.Jawa.$ = $;

  // Also expose as plain globals so inline page scripts work directly
  window.API_BASE = API_BASE;
  window.showToast = showToast;
  window.$ = $;

})();
