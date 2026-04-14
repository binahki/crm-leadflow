import { useEffect, useLayoutEffect } from 'react';
import { useAppStore } from '@/stores/appStore';

// useLayoutEffect para aplicar o tema ANTES da primeira pintura — evita flash
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function useTheme() {
  const { theme, toggleTheme } = useAppStore();

  // Aplica classe no <html> com useLayoutEffect para evitar flash
  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    // Remove ambas antes de adicionar — garante troca simultânea
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Se precisar usar apenas isso em componentes, sem o store inteiro
  return { theme, toggleTheme };
}
