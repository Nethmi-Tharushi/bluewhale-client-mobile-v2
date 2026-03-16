import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as ExpoLinking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { useAuthStore } from './src/context/authStore';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { ensureApiReady } from './src/api/client';

// Keep the native splash visible until auth storage hydration finishes.
SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({
  duration: 350,
  fade: true,
});

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

  const linking = {
    prefixes: [ExpoLinking.createURL('/'), 'bluewhale-agent://'],
    config: {
      screens: {
        App: {
          screens: {
            Home: {
              screens: {
                JobsList: 'jobs',
                JobDetails: 'jobs/:jobId',
              },
            },
          },
        },
      },
    },
  };

  return (
    <NavigationContainer theme={navTheme} linking={linking as any}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!bootstrapped) return;

    SplashScreen.hideAsync().catch(() => undefined);
  }, [bootstrapped]);

  useEffect(() => {
    // Warm backend on app start to reduce first-action latency (e.g., first login on cold server).
    ensureApiReady({ timeoutMs: 20000, background: true }).catch(() => undefined);
  }, []);

  if (!bootstrapped) {
    return null;
  }

  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}
