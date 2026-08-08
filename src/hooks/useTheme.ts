import { useState, useEffect } from 'react';

export type AppTheme = 'cyber' | 'ios';

const THEME_KEY = 'rider-app-theme';

function getSavedTheme(): AppTheme | null {
  try {
    const saved = localStorage.getItem(THEME_KEY) as AppTheme;
    if (saved === 'cyber' || saved === 'ios') return saved;
  } catch { /* ignore */ }
  return null;
}

function saveTheme(theme: AppTheme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch { /* ignore */ }
}

export function useTheme(externalTheme?: AppTheme) {
  const [theme, setTheme] = useState<AppTheme>(() => {
    if (externalTheme === 'cyber' || externalTheme === 'ios') return externalTheme;
    return getSavedTheme() || 'cyber';
  });

  // 外部设置变更时同步（如从 zustand settings.theme 传入）
  useEffect(() => {
    if (externalTheme === 'cyber' || externalTheme === 'ios') {
      setTheme(externalTheme);
    }
  }, [externalTheme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('cyber', 'ios', 'theme-cyber', 'theme-ios', 'light', 'dark');

    if (theme === 'ios') {
      root.classList.add('ios', 'theme-ios', 'light');
    } else {
      root.classList.add('cyber', 'theme-cyber', 'dark');
    }

    saveTheme(theme);
  }, [theme]);

  const setCyber = () => setTheme('cyber');
  const setIOS = () => setTheme('ios');
  const toggleTheme = () => setTheme(prev => prev === 'ios' ? 'cyber' : 'ios');

  return {
    theme,
    setTheme,
    setCyber,
    setIOS,
    toggleTheme,
    isIOS: theme === 'ios',
    isCyber: theme === 'cyber',
  };
}
