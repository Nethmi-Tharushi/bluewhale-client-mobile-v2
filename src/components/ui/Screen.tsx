import React from 'react';
import { KeyboardAvoidingView, Platform, StatusBar, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';

export default function Screen({
  children,
  padded = true,
  keyboard = false,
  header,
}: {
  children: React.ReactNode;
  padded?: boolean;
  keyboard?: boolean;
  header?: React.ReactNode;
}) {
  const t = useTheme();
  const content = (
    <View style={[styles.content, padded && { paddingHorizontal: t.spacing.md }]}>{children}</View>
  );

  return (
    <LinearGradient colors={t.colors.gradientBackground as any} style={styles.root}>
      <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={styles.safe} edges={['left', 'right']}>
        {header}
        {keyboard ? (
          <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {content}
          </KeyboardAvoidingView>
        ) : (
          content
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: { flex: 1 },
});
