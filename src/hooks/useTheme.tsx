import { useEffect, useLayoutEffect } from 'react';
import { useAppStore } from '@/stores/appStore';

// useLayoutEffect para aplicar o tema ANTES da primeira pintura — evita flash
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const TRANSITION_ID = '__theme-transition';

function injectThemeTransition() {
  if (document.getElementById(TRANSITION_ID)) return;
  // Transição direta no root para elementos com background inline
  document.documentElement.style.transition = 'background-color 0.3s ease, color 0.2s ease';
  document.body.style.transition = 'background-color 0.3s ease';
  const style = document.createElement('style');
  style.id = TRANSITION_ID;
  style.textContent = `
    *, *::before, *::after {
      transition:
        background-color 0.25s ease,
        border-color 0.2s ease,
        color 0.15s ease,
        box-shadow 0.25s ease !important;
    }
  `;
  document.head.appendChild(style);
  setTimeout(() => {
    document.getElementById(TRANSITION_ID)?.remove();
    document.documentElement.style.transition = '';
    document.body.style.transition = '';
  }, 380);
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
