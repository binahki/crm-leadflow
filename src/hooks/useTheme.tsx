import { useEffect, useLayoutEffect } from 'react';
import { useAppStore } from '@/stores/appStore';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function useTheme() {
  const { theme, toggleTheme: _toggleTheme } = useAppStore();

  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  function toggleTheme() {
    const root = document.documentElement;
    root.style.transition = 'opacity 0.12s ease';
    root.style.opacity = '0.85';
    requestAnimationFrame(() => {
      _toggleTheme();
      root.style.opacity = '1';
      setTimeout(() => {
        root.style.transition = '';
      }, 150);
    });
  }

  return { theme, toggleTheme };
}
