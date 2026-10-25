import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeId = 'warm-obsidian-dark' | 'warm-obsidian-light';
export type DensityMode = 'comfort' | 'ultra-dense';
export type ShiftPhaseAura = 'first' | 'second' | 'third' | 'sandbox';

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
    id: 'warm-obsidian-dark',
    name: 'Deep Carbon Obsidian & Electric Cyan',
    mode: 'dark',
    description:
      'Futuristic carbon obsidian canvas with refractive glass, electric cyan focus, and bioluminescent mint telemetry',
    primaryColor: '#06b6d4',
    surfaceColor: '#05080d',
    borderColor: '#16263b',
    textColor: '#f1f7fc',
  },
  {
    id: 'warm-obsidian-light',
    name: 'Titanium Daylight & Electric Cyan',
    mode: 'light',
    description:
      'High-contrast titanium alabaster canvas with anodized slate borders and electric cyan accents',
    primaryColor: '#0284c7',
    surfaceColor: '#f4f7fb',
    borderColor: '#cbd5e1',
    textColor: '#09111e',
  },
];

interface ThemeContextType {
  theme: ThemeId;
  isDark: boolean;
  setTheme: (theme: ThemeId) => void;
  toggleTheme: () => void;
  availableThemes: ThemeOption[];
  density: DensityMode;
  setDensity: (density: DensityMode) => void;
  toggleDensity: () => void;
  isZenMode: boolean;
  setIsZenMode: (zen: boolean) => void;
  toggleZenMode: () => void;
  shiftPhaseAura: ShiftPhaseAura;
  setShiftPhaseAura: (phase: ShiftPhaseAura) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'shiftsync_theme_cyber_v2';
const DENSITY_STORAGE_KEY = 'shiftsync_density_v2';
const DEFAULT_THEME: ThemeId = 'warm-obsidian-dark';

function detectInitialShiftPhase(): ShiftPhaseAura {
  const hr = new Date().getHours();
  if (hr >= 6 && hr < 14) return 'first';
  if (hr >= 14 && hr < 22) return 'second';
  return 'third';
}

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
        // Ignore sandbox storage restrictions
      }
    }
    return DEFAULT_THEME;
  });

  const [density, setDensityState] = useState<DensityMode>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(
          DENSITY_STORAGE_KEY
        ) as DensityMode | null;
        if (stored === 'comfort' || stored === 'ultra-dense') {
          return stored;
        }
      } catch {
        // Ignore sandbox storage restrictions
      }
    }
    return 'comfort';
  });

  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [shiftPhaseAura, setShiftPhaseAura] = useState<ShiftPhaseAura>(() =>
    detectInitialShiftPhase()
  );

  const isDark = theme === 'warm-obsidian-dark';

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      if (theme === 'warm-obsidian-dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      }
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore sandbox storage restrictions
    }
  }, [theme]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-density', density);
    }
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, density);
    } catch {
      // Ignore sandbox storage restrictions
    }
  }, [density]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-shift-phase', shiftPhaseAura);
    }
  }, [shiftPhaseAura]);

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

  const setDensity = (next: DensityMode) => {
    setDensityState(next);
  };

  const toggleDensity = () => {
    setDensityState((prev) => (prev === 'comfort' ? 'ultra-dense' : 'comfort'));
  };

  const toggleZenMode = () => {
    setIsZenMode((prev) => !prev);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        setTheme,
        toggleTheme,
        availableThemes: THEME_OPTIONS,
        density,
        setDensity,
        toggleDensity,
        isZenMode,
        setIsZenMode,
        toggleZenMode,
        shiftPhaseAura,
        setShiftPhaseAura,
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
