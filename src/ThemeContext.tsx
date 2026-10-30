import React, { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';
import palettes from './theme/palettes.json';
export type ThemeId = keyof typeof palettes;
export const THEME_OPTIONS = Object.entries(palettes).map(([id, colors]) => ({ id: id as ThemeId, name: colors.name, mode: id === 'warm-obsidian-light' ? 'light' : 'dark', description: colors.name, primaryColor: colors.accent, surfaceColor: colors.card, borderColor: colors.border, textColor: colors.text }));
export type ThemeOption = typeof THEME_OPTIONS[number];
interface ThemeContextType { theme: ThemeId; isDark: boolean; followsSystem: boolean; setFollowSystem: () => void; setTheme: (theme: ThemeId) => void; toggleTheme: () => void; availableThemes: ThemeOption[] }
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const resolveSystemTheme = (): ThemeId => matchMedia('(prefers-color-scheme: dark)').matches ? 'warm-obsidian-dark' : 'warm-obsidian-light';
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [followsSystem, setFollowsSystemState] = useState<boolean>(() => {
    try { const saved = localStorage.getItem('shiftsync_theme_slate_v1'); return !saved || saved === 'system'; } catch { return true; }
  });
  const [theme, setThemeState] = useState<ThemeId>(() => {
    try { const saved = localStorage.getItem('shiftsync_theme_slate_v1'); if (saved && Object.hasOwn(palettes,saved)) return saved as ThemeId; } catch { /* Preferences may be blocked. */ }
    return resolveSystemTheme();
  });
  useLayoutEffect(() => {
    const root=document.documentElement;
    root.dataset.theme=theme;
    root.classList.toggle('dark',theme!=='warm-obsidian-light');
    root.classList.toggle('light',theme==='warm-obsidian-light');
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',palettes[theme]?.page ?? '#111315');
    try { if (!followsSystem) localStorage.setItem('shiftsync_theme_slate_v1',theme); } catch { /* Theme works without storage. */ }
  },[theme, followsSystem]);
  useEffect(() => {
    if (!followsSystem) return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setThemeState(event.matches ? 'warm-obsidian-dark' : 'warm-obsidian-light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [followsSystem]);
  const setTheme = (next: ThemeId) => {
    setFollowsSystemState(false);
    setThemeState(next);
    try { localStorage.setItem('shiftsync_theme_slate_v1', next); } catch { /* Theme works without storage. */ }
  };
  const setFollowSystem = () => {
    setFollowsSystemState(true);
    try { localStorage.removeItem('shiftsync_theme_slate_v1'); } catch { /* Theme works without storage. */ }
    setThemeState(resolveSystemTheme());
  };
  const toggleTheme=()=>setTheme(theme==='warm-obsidian-light'?'warm-obsidian-dark':theme==='warm-obsidian-dark'?'amoled':'warm-obsidian-light');
  return <ThemeContext.Provider value={{theme,isDark:theme!=='warm-obsidian-light',followsSystem,setFollowSystem,setTheme,toggleTheme,availableThemes:THEME_OPTIONS}}>{children}</ThemeContext.Provider>;
}
export function useTheme() { const value=useContext(ThemeContext);if(!value)throw new Error('ThemeProvider required');return value; }

