import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import PageDecor from './ui/PageDecor';

export default function GradientScreen({
  children,
  style,
  variant = 'soft',
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'soft' | 'brand';
}) {
  const t = useTheme();
  const colors = variant === 'brand' ? (t.colors.gradientHeader as any) : (t.colors.gradientBackground as any);
  return (
    <LinearGradient colors={colors} style={[styles.root, style]}>
      <PageDecor />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
});
