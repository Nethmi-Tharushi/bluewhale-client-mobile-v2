import React, { createContext, useContext, useMemo, useState } from 'react';
import { buildTheme, type AppTheme, type ColorMode, type ThemeContextValue } from './theme';

const ThemeContext = createContext<ThemeContextValue>({
  theme: buildTheme('light'),
  colorMode: 'light',
  setColorMode: () => undefined,
  toggleColorMode: () => undefined,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorMode, setColorMode] = useState<ColorMode>('light');
  const value = useMemo<ThemeContextValue>(() => {
    const nextTheme = buildTheme(colorMode);
    return {
      theme: nextTheme,
      colorMode,
      setColorMode,
      toggleColorMode: () => setColorMode((prev) => (prev === 'light' ? 'dark' : 'light')),
    };
  }, [colorMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext).theme;
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  return {
    colorMode: ctx.colorMode,
    setColorMode: ctx.setColorMode,
    toggleColorMode: ctx.toggleColorMode,
    isDark: ctx.colorMode === 'dark',
  };
}
