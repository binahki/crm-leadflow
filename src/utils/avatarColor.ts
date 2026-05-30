const AVATAR_COLORS = [
  '#0044fd', // azul
  '#b8fd2f', // verde lima
  '#fd4c04', // laranja
  '#7e3beb', // roxo
  '#ff2a4c', // vermelho
  '#f3f3f2', // cinza claro (base — adaptado por tema)
];

export function getAvatarColor(name: string): string {
  if (!name || typeof name !== 'string') return AVATAR_COLORS[0];
  const clean = name.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // força 32-bit
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Adapta o cinza ao tema para manter contraste: claro→#141416, escuro→#f3f3f2
export function getAvatarColorForTheme(name: string, dark: boolean): string {
  const cor = getAvatarColor(name);
  if (cor === '#f3f3f2') return dark ? '#f3f3f2' : '#141416';
  return cor;
}

// Cores claras precisam de texto escuro
export function getAvatarTextColor(bgColor: string): string {
  if (bgColor === '#b8fd2f' || bgColor === '#f3f3f2') return '#111111';
  return '#ffffff';
}
