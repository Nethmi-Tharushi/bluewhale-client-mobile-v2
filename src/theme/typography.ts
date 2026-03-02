import { Platform } from 'react-native';

const systemSans = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

export const typography = {
  fontFamily: {
    regular: systemSans,
    medium: Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'System' }),
    bold: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
    mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    hero: 34,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
    black: '900' as const,
  },
  lineHeight: {
    sm: 18,
    md: 22,
    lg: 28,
  },
} as const;

export type Typography = typeof typography;
