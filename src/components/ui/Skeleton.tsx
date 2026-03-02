import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export default function UISkeleton({ height = 16, width = '100%', radius }: { height?: number; width?: any; radius?: number }) {
  const t = useTheme();
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={[styles.base, { height, width, borderRadius: radius ?? t.radius.md, backgroundColor: t.colors.border }]}>
      <Animated.View style={[styles.fill, { opacity: pulse, backgroundColor: t.colors.surface }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFillObject },
});
