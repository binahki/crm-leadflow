import { useEffect, useLayoutEffect } from 'react';
import { useAppStore } from '@/stores/appStore';

// useLayoutEffect para aplicar o tema ANTES da primeira pintura — evita flash
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const TRANSITION_ID = '__theme-transition';

function injectThemeTransition() {
  // Adiciona classe CSS que sincroniza TODOS os elementos (sidebar + conteúdo) ao mesmo tempo
  document.body.classList.add('theme-transitioning');
  document.documentElement.style.setProperty('transition', 'background-color 0.35s ease, color 0.35s ease');
  setTimeout(() => {
    document.body.classList.remove('theme-transitioning');
    document.documentElement.style.removeProperty('transition');
  }, 420);
}

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
    injectThemeTransition();
    _toggleTheme();
  }

  return { theme, toggleTheme };
}
