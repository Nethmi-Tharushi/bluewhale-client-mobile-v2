import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeProvider';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';

export default function UIButton({
  title,
  onPress,
  loading,
  variant = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
}) {
  const t = useTheme();
  const isDisabled = disabled || loading;
  const textColor = variant === 'primary' || variant === 'secondary' ? t.colors.textOnPrimary : t.colors.primary;

  if (variant === 'primary') {
    return (
      <Pressable onPress={onPress} disabled={isDisabled} style={({ pressed }) => [pressed && { opacity: 0.9 }, isDisabled && styles.disabled]}>
        <LinearGradient colors={t.colors.gradientButton as any} style={[styles.base, { borderRadius: t.radius.md }]}>
          <View style={styles.row}>{loading ? <ActivityIndicator color={t.colors.textOnPrimary} /> : <Text style={[styles.text, { color: textColor }]}>{title}</Text>}</View>
        </LinearGradient>
      </Pressable>
    );
  }

  const backgroundColor = variant === 'secondary' ? t.colors.secondary : variant === 'ghost' ? 'transparent' : t.colors.surface;
  const borderColor = variant === 'ghost' ? 'transparent' : t.colors.borderStrong;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { borderRadius: t.radius.md, backgroundColor, borderColor, borderWidth: 1 },
        pressed && { opacity: 0.9 },
        isDisabled && styles.disabled,
      ]}
    >
      <View style={styles.row}>{loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.text, { color: variant === 'secondary' ? t.colors.textOnPrimary : textColor }]}>{title}</Text>}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  row: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  text: { fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.55 },
});
