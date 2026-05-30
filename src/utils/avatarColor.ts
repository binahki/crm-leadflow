const COLORS = [
  '#0044fd', // azul
  '#fd4c04', // laranja
  '#b8fd2f', // verde
  '#ff2a4c', // vermelho
  '#7e3beb', // roxo
  '#f3f3f2', // cinza (adaptado por tema)
];

// Única função pública de cor — mesma entrada = mesma saída em TODAS as páginas
// Usa o UUID diretamente como índice aleatório — distribuição uniforme garantida
export function getAvatarColor(name: string, dark: boolean, id?: string): string {
  if (!name) return COLORS[0];
  let idx = 0;
  if (id) {
    const last = id.split('-').pop() || '';
    idx = parseInt(last.slice(-8), 16) % COLORS.length;
  } else {
    let h = 0x811c9dc5;
    const s = name.toLowerCase();
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    idx = (h >>> 0) % COLORS.length;
  }
  const cor = COLORS[idx];
  if (cor === '#f3f3f2') return dark ? '#f3f3f2' : '#4a4a4f';
  return cor;
}

// #b8fd2f (verde neon) e #f3f3f2 (cinza claro) → texto escuro; todo o resto → branco
export function getAvatarTextColor(bgColor: string): string {
  return bgColor === '#b8fd2f' || bgColor === '#f3f3f2' ? '#111111' : '#ffffff';
}
