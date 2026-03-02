import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { useAuthStore } from './src/context/authStore';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

function ThemedApp() {
  const t = useTheme();
  const navTheme = t.isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: t.colors.background,
          card: t.colors.surface,
          text: t.colors.text,
          border: t.colors.border,
          primary: t.colors.primary,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: t.colors.background,
          card: t.colors.surface,
          text: t.colors.text,
          border: t.colors.border,
          primary: t.colors.primary,
        },
      };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}
