(async function () {
  const resources = {
    '/eventos': 'events',
    '/noticias': 'news',
    '/public/events-public.html': 'events',
    '/public/news.html': 'news'
  };
  const page = location.pathname;
  const resource = resources[page];
  if (!resource || !window.fetch) return;
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    originalSetItem.call(this, key, value);
    if (key !== `compex-${resource}`) return;
    try {
      const record = JSON.parse(value)[0];
      if (record && !record.id) fetch(`/api/${resource}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) }).catch(() => {});
    } catch {}
  };
  try {
    const response = await fetch(`/api/${resource}`);
    if (!response.ok) return;
    const records = await response.json();
    if (!records.length) return;
    originalSetItem.call(localStorage, `compex-${resource}`, JSON.stringify(records));
  } catch {}
})();
