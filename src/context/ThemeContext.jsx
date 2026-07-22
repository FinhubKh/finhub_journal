import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const ThemeContext = createContext(null);

const THEME_KEY = 'nxuu_theme';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  // Default to dark mode for trading experience if system prefers or unspecified
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyThemeToDocument(theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);
  const auth = useAuth();
  const isAuthenticated = Boolean(auth?.isAuthenticated);

  // Unauthenticated users always see light theme. Authenticated users see their chosen theme.
  const effectiveTheme = isAuthenticated ? theme : 'light';

  useEffect(() => {
    applyThemeToDocument(effectiveTheme);
    if (isAuthenticated) {
      localStorage.setItem(THEME_KEY, theme);
    }
  }, [theme, isAuthenticated, effectiveTheme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setTheme = useCallback((newTheme) => {
    if (newTheme === 'dark' || newTheme === 'light') {
      setThemeState(newTheme);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: effectiveTheme, userTheme: theme, isDark: effectiveTheme === 'dark', toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback if accessed outside ThemeProvider
    return {
      theme: 'light',
      isDark: false,
      toggleTheme: () => {},
      setTheme: () => {},
    };
  }
  return ctx;
}
