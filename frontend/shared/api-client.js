const CompexAPI = {
  async request(resource, options = {}) {
    const response = await fetch(`/api/${resource}`, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    if (!response.ok) throw new Error(`Erro ${response.status} ao acessar ${resource}`);
    return response.json();
  },
  list(resource) { return this.request(resource); },
  create(resource, data) { return this.request(resource, { method: 'POST', body: JSON.stringify(data) }); },
  update(resource, data) { return this.request(resource, { method: 'PUT', body: JSON.stringify(data) }); },
  remove(resource, id) { return this.request(resource, { method: 'DELETE', body: JSON.stringify({ id }) }); },
  health() { return this.request('health'); },
  me(token = sessionStorage.getItem('compex-token')) { return this.request('auth/me', { headers: { Authorization: `Bearer ${token}` } }); },
  stats() { return this.request('stats'); }
};
if (typeof window !== 'undefined') window.CompexAPI = CompexAPI;
