import { getAccessToken } from './auth.js';

function buildUrl(url, query) {
  if (!query) return url;
  const u = new URL(url);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    u.searchParams.set(k, v);
  }
  return u.toString();
}

async function doFetch(url, opts, token) {
  const headers = { Authorization: `Bearer ${token}` };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(url, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

export async function gfetch(url, { method = 'GET', body, query } = {}) {
  const fullUrl = buildUrl(url, query);
  let token = await getAccessToken();
  let res = await doFetch(fullUrl, { method, body }, token);
  if (res.status === 401) {
    token = await getAccessToken({ force: true });
    res = await doFetch(fullUrl, { method, body }, token);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data?.error?.message || `Google API error (${res.status})`;
    throw new Error(message);
  }
  return data;
}
