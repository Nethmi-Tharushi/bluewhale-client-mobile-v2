import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';

export default function SplashScreen() {
  const t = useTheme();
  return (
    <LinearGradient colors={t.colors.gradientHeader as any} style={styles.root}>
      <View style={styles.center}>
        <Image source={require('../../assets/icon.png')} style={styles.mark} resizeMode="contain" />
        <Text style={styles.logo}>Blue Whale</Text>
        <Text style={styles.sub}>Client Mobile App</Text>
        <ActivityIndicator color={t.colors.textOnPrimary} style={{ marginTop: 18 }} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  mark: { width: 88, height: 88, marginBottom: 12 },
  logo: { color: 'white', fontSize: 34, fontWeight: '800', letterSpacing: 0.2 },
  sub: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 4, fontWeight: '600' },
});
