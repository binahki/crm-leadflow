import { useEffect, useLayoutEffect } from 'react';
import { useAppStore } from '@/stores/appStore';

// useLayoutEffect para aplicar o tema ANTES da primeira pintura — evita flash
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const TRANSITION_ID = '__theme-transition';

function injectThemeTransition() {
  if (document.getElementById(TRANSITION_ID)) return;
  const style = document.createElement('style');
  style.id = TRANSITION_ID;
  style.textContent = `
    *, *::before, *::after {
      transition:
        background-color 0.22s ease,
        border-color 0.18s ease,
        color 0.14s ease,
        box-shadow 0.22s ease !important;
    }
  `;
  document.head.appendChild(style);
  setTimeout(() => document.getElementById(TRANSITION_ID)?.remove(), 320);
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
