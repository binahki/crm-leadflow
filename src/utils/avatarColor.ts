const COLORS = [
  '#0044fd', // azul
  '#fd4c04', // laranja
  '#b8fd2f', // verde
  '#ff2a4c', // vermelho
  '#7e3beb', // roxo
  '#f3f3f2', // cinza (adaptado por tema)
];

// Única função pública de cor — mesma entrada = mesma saída em TODAS as páginas
// Usa hash FNV-1a sobre name+UUID para distribuição aleatória uniforme entre as cores
export function getAvatarColor(name: string, dark: boolean, id?: string): string {
  if (!name) return COLORS[0];
  const input = id ? `${id}|${name}` : name;
  let h = 0x811c9dc5;
  const s = input.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const cor = COLORS[(h >>> 0) % COLORS.length];
  if (cor === '#f3f3f2') return dark ? '#f3f3f2' : '#4a4a4f';
  return cor;
}

// #b8fd2f (verde neon) e #f3f3f2 (cinza claro) → texto escuro; todo o resto → branco
export function getAvatarTextColor(bgColor: string): string {
  return bgColor === '#b8fd2f' || bgColor === '#f3f3f2' ? '#111111' : '#ffffff';
}
