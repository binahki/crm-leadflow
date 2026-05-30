const AVATAR_COLORS = [
  '#0044fd', // azul do sistema
  '#b8fd2f', // verde lima
  '#fd4c04', // laranja
  '#7e3beb', // violeta
  '#ff2a4c', // vermelho
];

export function getAvatarColor(name: string): string {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Verde lima exige texto escuro para contraste; os demais ficam bem com branco
export function getAvatarTextColor(bgColor: string): string {
  return bgColor === '#b8fd2f' ? '#111111' : '#ffffff';
}
