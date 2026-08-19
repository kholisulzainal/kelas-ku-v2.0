import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function getUserThemeKey(): string {
  const isLoggedIn = localStorage.getItem('is_logged_in') === 'true';
  if (!isLoggedIn) {
    return 'user_theme_guest';
  }
  const role = localStorage.getItem('current_user_role') || 'guest';
  const id = localStorage.getItem('current_user_id') || 'default';
  return `user_theme_${role}_${id}`;
}

export function getStoredUserTheme(): ThemeMode {
  const key = getUserThemeKey();
  const saved = localStorage.getItem(key);
  if (saved === 'dark' || saved === 'light' || saved === 'system') {
    return saved as ThemeMode;
  }
  return 'system';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => getStoredUserTheme());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  // React to user session changes or localStorage sync
  useEffect(() => {
    const handleSessionChange = () => {
      const activeUserTheme = getStoredUserTheme();
      setThemeState(activeUserTheme);
    };

    window.addEventListener('user-session-changed', handleSessionChange);
    window.addEventListener('storage', handleSessionChange);

    return () => {
      window.removeEventListener('user-session-changed', handleSessionChange);
      window.removeEventListener('storage', handleSessionChange);
    };
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = () => {
      if (theme === 'system') {
        // Dapodik Authentic Theme (Default System)
        setResolvedTheme('light');
        root.classList.add('theme-dapodik');
        root.classList.remove('theme-light');
        root.classList.remove('dark');
        document.body.classList.add('theme-dapodik');
        document.body.classList.remove('dark');
        root.style.colorScheme = 'light';
      } else if (theme === 'dark') {
        // Pure Dark Theme
        setResolvedTheme('dark');
        root.classList.remove('theme-dapodik');
        root.classList.remove('theme-light');
        root.classList.add('dark');
        document.body.classList.remove('theme-dapodik');
        document.body.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        // Pure Light Theme
        setResolvedTheme('light');
        root.classList.remove('theme-dapodik');
        root.classList.remove('dark');
        root.classList.add('theme-light');
        document.body.classList.remove('theme-dapodik');
        document.body.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    };

    applyTheme();

    const currentKey = getUserThemeKey();
    localStorage.setItem(currentKey, theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  const setTheme = (mode: ThemeMode) => {
    const currentKey = getUserThemeKey();
    localStorage.setItem(currentKey, mode);
    setThemeState(mode);
  };

  const toggleTheme = () => {
    setThemeState(prev => {
      let next: ThemeMode = 'light';
      if (prev === 'light') next = 'dark';
      else if (prev === 'dark') next = 'system';
      else next = 'light';

      const currentKey = getUserThemeKey();
      localStorage.setItem(currentKey, next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

