const AVATAR_COLORS = [
  '#0044fd', // azul
  '#fd4c04', // laranja
  '#b8fd2f', // verde
  '#ff2a4c', // vermelho
  '#7e3beb', // roxo
  '#f3f3f2', // cinza (adaptado por tema)
];

// FNV-1a hash — distribui bem entre 6 cores
function fnv1a(s: string): number {
  let hash = 2166136261;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export function getAvatarColor(name: string): string {
  if (!name || typeof name !== 'string') return AVATAR_COLORS[0];
  return AVATAR_COLORS[fnv1a(name.trim().toLowerCase()) % AVATAR_COLORS.length];
}

// Função padrão para TODAS as páginas — mesmo nome = mesma cor em todo o app
export function getAvatarColorForTheme(name: string, dark: boolean): string {
  const cor = getAvatarColor(name);
  if (cor === '#f3f3f2') return dark ? '#f3f3f2' : '#4a4a4f';
  return cor;
}

// Cor do texto: branco para fundos escuros/coloridos, preto para fundos claros
export function getAvatarTextColor(bgColor: string): string {
  if (bgColor === '#b8fd2f' || bgColor === '#f3f3f2') return '#111111';
  return '#ffffff';
}
