const AVATAR_COLORS = [
  '#0044fd', // azul
  '#b8fd2f', // verde lima
  '#fd4c04', // laranja
  '#7e3beb', // roxo
  '#ff2a4c', // vermelho
  '#f3f3f2', // cinza claro (funciona em dark e light)
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

// Cores claras (verde lima e cinza) precisam de texto escuro para contraste
export function getAvatarTextColor(bgColor: string): string {
  if (bgColor === '#b8fd2f' || bgColor === '#f3f3f2') return '#111111';
  return '#ffffff';
}
