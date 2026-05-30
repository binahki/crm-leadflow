const AVATAR_COLORS = [
  '#0044fd', // azul
  '#ff2a4c', // vermelho
  '#b8fd2f', // verde
  '#7e3beb', // roxo
  '#fd4c04', // laranja
  '#f3f3f2', // cinza (adaptado por tema)
];

export function getAvatarColor(name: string): string {
  if (!name || typeof name !== 'string') return '#0044fd';
  const clean = name.trim().toLowerCase();

  // Hash primário — djb2 modificado
  let h1 = 5381;
  for (let i = 0; i < clean.length; i++) {
    h1 = Math.imul(h1, 31) ^ clean.charCodeAt(i);
    h1 = h1 >>> 0;
  }

  // Hash secundário — FNV-1a simplificado (percorre ao contrário)
  let h2 = 2166136261;
  for (let i = clean.length - 1; i >= 0; i--) {
    h2 ^= clean.charCodeAt(i);
    h2 = Math.imul(h2, 16777619);
    h2 = h2 >>> 0;
  }

  // Hash terciário — posição × valor × Knuth multiplicative
  let h3 = 0;
  for (let i = 0; i < clean.length; i++) {
    h3 += clean.charCodeAt(i) * (i + 1) * 2654435761;
    h3 = h3 >>> 0;
  }

  const combined = ((h1 ^ (h2 << 11)) ^ (h3 >> 5)) >>> 0;
  return AVATAR_COLORS[combined % AVATAR_COLORS.length];
}

// Cinza: light→#4a4a4f (cinza médio-escuro), dark→#f3f3f2 (quase branco)
export function getAvatarColorForTheme(name: string, dark: boolean): string {
  const cor = getAvatarColor(name);
  if (cor === '#f3f3f2') return dark ? '#f3f3f2' : '#4a4a4f';
  return cor;
}

// Cores claras (#b8fd2f, #f3f3f2, #4a4a4f) → texto escuro. Resto → texto branco.
export function getAvatarTextColor(bgColor: string): string {
  if (bgColor === '#b8fd2f' || bgColor === '#f3f3f2') return '#111111';
  return '#ffffff';
}
