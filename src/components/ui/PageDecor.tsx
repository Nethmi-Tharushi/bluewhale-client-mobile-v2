import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeProvider';

export default function PageDecor() {
  const t = useTheme();
  const topGlow = t.isDark ? ['rgba(79, 156, 255, 0.18)', 'rgba(79, 156, 255, 0.02)'] : ['rgba(132, 206, 255, 0.22)', 'rgba(132, 206, 255, 0.02)'];
  const bottomGlow = t.isDark ? ['rgba(15, 121, 197, 0.2)', 'rgba(27, 56, 144, 0.02)'] : ['rgba(15, 121, 197, 0.16)', 'rgba(27, 56, 144, 0.02)'];
  const ringColor = t.isDark ? 'rgba(153, 192, 255, 0.12)' : 'rgba(27, 56, 144, 0.12)';

  return (
    <View pointerEvents="none" style={styles.layer}>
      <LinearGradient colors={topGlow as any} style={styles.topGlow} />
      <LinearGradient colors={bottomGlow as any} style={styles.bottomGlow} />
      <View style={[styles.bottomRing, { borderColor: ringColor }]} />
      <View style={[styles.bottomRingSmall, { borderColor: ringColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  topGlow: {
    position: 'absolute',
    top: 32,
    left: -24,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: -48,
    right: -54,
    width: 290,
    height: 290,
    borderRadius: 145,
    transform: [{ scaleX: 1.2 }],
  },
  bottomRing: {
    position: 'absolute',
    bottom: 88,
    left: -46,
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1,
  },
  bottomRingSmall: {
    position: 'absolute',
    bottom: 142,
    right: 58,
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 1,
  },
});
