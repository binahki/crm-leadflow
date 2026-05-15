const TTL = 5 * 60 * 1000; // 5 minutos

export function getMetaCache(key: string) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > TTL) { sessionStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

export function setMetaCache(key: string, data: any) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export function clearMetaCache(key: string) {
  try { sessionStorage.removeItem(key); } catch {}
}
