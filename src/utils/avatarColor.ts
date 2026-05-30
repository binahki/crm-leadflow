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
  // djb2-xor forward
  let hash = 5381;
  for (let i = 0; i < clean.length; i++) {
    hash = ((hash << 5) + hash) ^ clean.charCodeAt(i);
    hash = hash >>> 0; // unsigned 32-bit
  }
  // djb2-xor backward — quebra padrões de nomes sequenciais
  let hash2 = 0;
  for (let i = clean.length - 1; i >= 0; i--) {
    hash2 = ((hash2 << 3) + hash2) ^ clean.charCodeAt(i);
    hash2 = hash2 >>> 0;
  }
  const combined = (hash ^ (hash2 << 16)) >>> 0;
  return AVATAR_COLORS[combined % AVATAR_COLORS.length];
}

// Cinza: light→#4a4a4f (cinza médio-escuro), dark→#f3f3f2 (quase branco)
export function getAvatarColorForTheme(name: string, dark: boolean): string {
  const cor = getAvatarColor(name);
  if (cor === '#f3f3f2') return dark ? '#f3f3f2' : '#4a4a4f';
  return cor;
}

// Cores claras (#b8fd2f, #f3f3f2) → texto escuro. Resto → texto branco.
export function getAvatarTextColor(bgColor: string): string {
  if (bgColor === '#b8fd2f' || bgColor === '#f3f3f2') return '#111111';
  return '#ffffff';
}
