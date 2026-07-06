import { useEffect, useState } from 'react';

const KEY = 'ootp-theme';

export const THEMES = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

// 'light' | 'dark' | 'system' — toggles the `dark` class on <html>.
// In system mode it tracks the OS preference live.
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY);
      return THEMES.some((t) => t.id === saved) ? saved : 'system';
    } catch {
      return 'system';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, theme);
    } catch { /* no storage — theme just won't persist */ }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    if (theme === 'system') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);

  return [theme, setTheme];
}
