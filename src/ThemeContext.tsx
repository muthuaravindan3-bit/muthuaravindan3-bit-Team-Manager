import React, { createContext, useContext, useLayoutEffect, useState } from 'react';
import palettes from './theme/palettes.json';
export type ThemeId = keyof typeof palettes;
export const THEME_OPTIONS = Object.entries(palettes).map(([id, colors]) => ({ id: id as ThemeId, name: colors.name, mode: id === 'warm-obsidian-light' ? 'light' : 'dark', description: colors.name, primaryColor: colors.accent, surfaceColor: colors.card, borderColor: colors.border, textColor: colors.text }));
export type ThemeOption = typeof THEME_OPTIONS[number];
interface ThemeContextType { theme: ThemeId; isDark: boolean; setTheme: (theme: ThemeId) => void; toggleTheme: () => void; availableThemes: ThemeOption[] }
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeId>(() => {
    try { const saved = localStorage.getItem('shiftsync_theme_slate_v1'); if (saved && Object.hasOwn(palettes,saved)) return saved as ThemeId; } catch { /* Preferences may be blocked. */ }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'warm-obsidian-dark' : 'warm-obsidian-light';
  });
  useLayoutEffect(() => { const root=document.documentElement;root.dataset.theme=theme;root.classList.toggle('dark',theme!=='warm-obsidian-light');root.classList.toggle('light',theme==='warm-obsidian-light');try { localStorage.setItem('shiftsync_theme_slate_v1',theme); } catch { /* Theme works without storage. */ } },[theme]);
  const toggleTheme=()=>setTheme((current)=>current==='warm-obsidian-light'?'warm-obsidian-dark':current==='warm-obsidian-dark'?'amoled':'warm-obsidian-light');
  return <ThemeContext.Provider value={{theme,isDark:theme!=='warm-obsidian-light',setTheme,toggleTheme,availableThemes:THEME_OPTIONS}}>{children}</ThemeContext.Provider>;
}
export function useTheme() { const value=useContext(ThemeContext);if(!value)throw new Error('ThemeProvider required');return value; }
