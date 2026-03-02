import { theme } from '../theme/theme';

export const Brand = {
  primary: theme.colors.primary,
  secondary: theme.colors.secondary,
  darkBg: '#0B1220',
  lightBg: theme.colors.background,
  text: theme.colors.text,
  textOnDark: theme.colors.textOnPrimary,
  muted: theme.colors.textMuted,
  success: theme.colors.success,
  warning: theme.colors.warning,
  danger: theme.colors.error,
} as const;

export const Gradients = {
  primary: theme.colors.gradientHeader,
  softLight: theme.colors.gradientBackground,
  softDark: ['#0B1220', '#101D36', '#1B2945'] as const,
} as const;

export type ThemeMode = 'light' | 'dark';

export const Spacing = theme.spacing;
export const Radius = theme.radius;
export const Shadow = theme.shadow;
