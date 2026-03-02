export const palette = {
  primary: '#1B3890',
  secondary: '#0F79C5',
  accent: '#0F79C5',
  textMuted: '#A8AEAE',
  grayMutedLight: '#8F9292',
  grayMutedDark: '#6B6F70',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const lightColors = {
  background: '#F4F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  text: '#111827',
  textMuted: palette.textMuted,
  textOnPrimary: '#FFFFFF',
  border: '#D7E3F5',
  borderStrong: '#B5C8E8',
  primary: palette.primary,
  secondary: palette.secondary,
  accent: palette.accent,
  grayMutedLight: palette.grayMutedLight,
  grayMutedDark: palette.grayMutedDark,
  success: palette.success,
  warning: palette.warning,
  error: palette.error,
  gradientHeader: ['#1B3890', '#0F79C5'] as const,
  gradientButton: ['#1B3890', '#0F79C5'] as const,
  gradientSecondary: ['#0F79C5', '#1B3890'] as const,
  gradientBackground: ['#F8FAFC', '#EBF8FF', '#E0E7FF'] as const,
  tabBar: '#07112A',
} as const;

export const darkColors = {
  background: '#0B1220',
  surface: '#111D34',
  surfaceMuted: '#172641',
  text: '#E9F1FF',
  textMuted: '#A8AEAE',
  textOnPrimary: '#FFFFFF',
  border: '#2A3B5F',
  borderStrong: '#3A5486',
  primary: '#4F71D2',
  secondary: '#0F79C5',
  accent: '#0F79C5',
  grayMutedLight: '#8F9292',
  grayMutedDark: '#6B6F70',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  gradientHeader: ['#1B3890', '#0F79C5'] as const,
  gradientButton: ['#1B3890', '#0F79C5'] as const,
  gradientSecondary: ['#0F79C5', '#1B3890'] as const,
  gradientBackground: ['#0B1220', '#0F1B34', '#13223E'] as const,
  tabBar: '#040D22',
} as const;

export type Colors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  textOnPrimary: string;
  border: string;
  borderStrong: string;
  primary: string;
  secondary: string;
  accent: string;
  grayMutedLight: string;
  grayMutedDark: string;
  success: string;
  warning: string;
  error: string;
  gradientHeader: readonly [string, string];
  gradientButton: readonly [string, string];
  gradientSecondary: readonly [string, string];
  gradientBackground: readonly [string, string, string];
  tabBar: string;
};
