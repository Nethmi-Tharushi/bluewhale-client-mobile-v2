import { darkColors, lightColors, type Colors } from './colors';
import { spacing } from './spacing';
import { typography } from './typography';
import { radius } from './radius';

export type ColorMode = 'light' | 'dark';

const shadowByMode = {
  light: {
    card: {
      shadowColor: '#183399',
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 5,
    },
  },
  dark: {
    card: {
      shadowColor: '#020917',
      shadowOpacity: 0.35,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
  },
} as const;

export function buildTheme(mode: ColorMode) {
  const colors: Colors = mode === 'dark' ? darkColors : lightColors;
  return {
    mode,
    isDark: mode === 'dark',
    statusBarStyle: mode === 'dark' ? 'light' : 'dark',
    colors,
    spacing,
    typography,
    radius,
    shadow: shadowByMode[mode],
  } as const;
}

export const theme = buildTheme('light');

export type AppTheme = ReturnType<typeof buildTheme>;

export type ThemeContextValue = {
  theme: AppTheme;
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;
};
