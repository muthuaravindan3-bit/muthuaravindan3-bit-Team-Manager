import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeId = 'warm-obsidian-dark' | 'warm-obsidian-light';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  mode: 'dark' | 'light';
  description: string;
  primaryColor: string;
  surfaceColor: string;
  borderColor: string;
  textColor: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'warm-obsidian-light',
    name: 'Crisp Daylight Slate',
    mode: 'light',
    description: 'Clean daylight alabaster and cool slate borders with royal blue accents',
    primaryColor: '#2563eb',
    surfaceColor: '#f8fafc',
    borderColor: '#e2e8f0',
    textColor: '#0f172a',
  },
  {
    id: 'warm-obsidian-dark',
    name: 'Deep Slate Dark',
    mode: 'dark',
    description: 'Refined deep slate canvas with subtle hairline borders and crisp blue accents',
    primaryColor: '#3b82f6',
    surfaceColor: '#0b0f17',
    borderColor: '#1e293b',
    textColor: '#f8fafc',
  },
];

interface ThemeContextType {
  theme: ThemeId;
  isDark: boolean;
  setTheme: (theme: ThemeId) => void;
  toggleTheme: () => void;
  availableThemes: ThemeOption[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'shiftsync_theme_slate_v1';
const DEFAULT_THEME: ThemeId = 'warm-obsidian-light';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
        if (
          stored &&
          (stored === 'warm-obsidian-dark' || stored === 'warm-obsidian-light')
        ) {
          return stored;
        }
      } catch {
        // localStorage may be blocked in sandboxed iframe contexts
      }
    }
    return DEFAULT_THEME;
  });

  const isDark = theme === 'warm-obsidian-dark';

  const applyTheme = (targetTheme: ThemeId) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', targetTheme);
      if (targetTheme === 'warm-obsidian-dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      }
    }
  };

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage may fail in hermetic/sandbox contexts
    }
  }, [theme]);

  const setTheme = (newTheme: ThemeId) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) =>
      prev === 'warm-obsidian-dark'
        ? 'warm-obsidian-light'
        : 'warm-obsidian-dark'
    );
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        setTheme,
        toggleTheme,
        availableThemes: THEME_OPTIONS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
