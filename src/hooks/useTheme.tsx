import { useEffect, useLayoutEffect } from 'react';
import { useAppStore } from '@/stores/appStore';

// useLayoutEffect para aplicar o tema ANTES da primeira pintura — evita flash
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function useTheme() {
  const { theme, toggleTheme: _toggleTheme } = useAppStore();

  // Aplica classe no <html> com useLayoutEffect para evitar flash na carga inicial
  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  function toggleTheme() {
    const root = document.documentElement;
    root.style.transition = 'opacity 0.15s ease';
    root.style.opacity = '0.7';
    setTimeout(() => {
      _toggleTheme();
      root.style.opacity = '1';
      setTimeout(() => {
        root.style.transition = '';
      }, 200);
    }, 80);
  }

  return { theme, toggleTheme };
}
