import { useState, useEffect, useLayoutEffect } from 'react';

// useLayoutEffect para aplicar o tema ANTES da primeira pintura — evita flash
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  // Aplica classe no <html> com useLayoutEffect para evitar flash
  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    // Remove ambas antes de adicionar — garante troca simultânea
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  return { theme, toggleTheme };
}
