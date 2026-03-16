import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../theme/ThemeProvider';

export default function SplashScreen() {
  const t = useTheme();
  return (
    <LinearGradient colors={['#06133C', '#0A2A78', '#04112F']} style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <View style={styles.center}>
        <View style={styles.logoShell}>
          <Image source={require('../../assets/icon.png')} style={styles.mark} resizeMode="contain" />
        </View>
        <Text style={styles.logo}>BLUE WHALE</Text>
        <Text style={styles.wordmark}>MIGRATION</Text>
        <Text style={styles.sub}>Client Mobile App</Text>

        <View style={styles.loaderRow}>
          <ActivityIndicator color={t.colors.textOnPrimary} size="small" />
          <Text style={styles.loaderText}>Preparing your workspace</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#06133C',
  },
  glowTop: {
    position: 'absolute',
    top: -110,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(79, 156, 255, 0.18)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -140,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(0, 194, 255, 0.14)',
  },
  center: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoShell: {
    width: 136,
    height: 136,
    borderRadius: 32,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  mark: {
    width: 102,
    height: 102,
  },
  logo: {
    color: '#D8EEFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  wordmark: {
    color: '#8DD7FF',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 7,
    marginTop: 6,
    marginLeft: 8,
  },
  sub: {
    color: 'rgba(230, 243, 255, 0.78)',
    fontSize: 14,
    marginTop: 18,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  loaderText: {
    marginLeft: 10,
    color: '#F3F8FF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
