const COLORS = [
  '#0044fd', // azul
  '#fd4c04', // laranja
  '#b8fd2f', // verde
  '#ff2a4c', // vermelho
  '#7e3beb', // roxo
  '#f3f3f2', // cinza (adaptado por tema)
];

// Mapa global lead ID → índice da cor (round-robin = sem repetições sequenciais)
const colorMap = new Map<string, number>();
let nextColor = 0;

// Única função pública de cor — mesma entrada = mesma saída em TODAS as páginas
// Usa round-robin persistente em memória: cada lead recebe a próxima cor disponível
export function getAvatarColor(name: string, dark: boolean, id?: string): string {
  if (!name) return COLORS[0];

  if (id) {
    if (!colorMap.has(id)) {
      colorMap.set(id, nextColor % COLORS.length);
      nextColor = (nextColor + 1) % COLORS.length;
    }
    const idx = colorMap.get(id)!;
    const cor = COLORS[idx];
    if (cor === '#f3f3f2') return dark ? '#f3f3f2' : '#4a4a4f';
    return cor;
  }

  // Fallback: hash do nome
  let h = 0;
  const s = name.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  h ^= (h >>> 16);
  h = Math.imul(h, 0x45d9f3b);
  h ^= (h >>> 16);
  const cor = COLORS[Math.abs(h) % COLORS.length];
  if (cor === '#f3f3f2') return dark ? '#f3f3f2' : '#4a4a4f';
  return cor;
}

// #b8fd2f (verde neon) e #f3f3f2 (cinza claro) → texto escuro; todo o resto → branco
export function getAvatarTextColor(bgColor: string): string {
  return bgColor === '#b8fd2f' || bgColor === '#f3f3f2' ? '#111111' : '#ffffff';
}
