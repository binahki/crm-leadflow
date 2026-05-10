export function safeName(str: any): string {
  if (!str || typeof str !== 'string') return '';
  const clean = str.trim();
  if (/^[^a-zA-ZÀ-ú0-9]+$/.test(clean)) return '';
  return clean;
}

export function safeInitials(n: string): string {
  const safe = safeName(n);
  if (!safe) return '?';
  return safe.split(' ').filter(w => w.length > 0).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?';
}
