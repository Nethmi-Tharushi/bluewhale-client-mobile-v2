import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeProvider';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';
type Size = 'md' | 'sm';

export default function UIButton({
  title,
  onPress,
  loading,
  variant = 'primary',
  size = 'md',
  disabled,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  size?: Size;
}) {
  const t = useTheme();
  const isDisabled = disabled || loading;
  const textColor = variant === 'primary' ? t.colors.textOnPrimary : variant === 'secondary' ? '#118D4C' : '#2A78CC';
  const isSmall = size === 'sm';
  const buttonStyle = isSmall ? styles.baseSm : styles.base;
  const primaryButtonStyle = isSmall ? styles.primaryBaseSm : styles.primaryBase;
  const textStyle = isSmall ? styles.textSm : styles.text;

  if (variant === 'primary') {
    return (
      <Pressable onPress={onPress} disabled={isDisabled} style={({ pressed }) => [pressed && { opacity: 0.92 }, isDisabled && styles.disabled]}>
        <LinearGradient colors={['#233E9B', '#168EE5']} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 1 }} style={primaryButtonStyle}>
          <View style={styles.row}>{loading ? <ActivityIndicator color={t.colors.textOnPrimary} /> : <Text style={[textStyle, { color: textColor }]}>{title}</Text>}</View>
        </LinearGradient>
      </Pressable>
    );
  }

  const backgroundColor = variant === 'secondary' ? '#CFEEDA' : variant === 'ghost' ? 'transparent' : '#F8FBFF';
  const borderColor = variant === 'secondary' ? '#34C16C' : variant === 'ghost' ? 'transparent' : '#5AA0E8';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        buttonStyle,
        { backgroundColor, borderColor, borderWidth: variant === 'ghost' ? 0 : 1 },
        pressed && { opacity: 0.92 },
        isDisabled && styles.disabled,
      ]}
    >
      <View style={styles.row}>{loading ? <ActivityIndicator color={textColor} /> : <Text style={[textStyle, { color: textColor }]}>{title}</Text>}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  primaryBase: {
    minHeight: 56,
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
    shadowColor: '#1F4B9F',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  baseSm: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  primaryBaseSm: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 14,
    justifyContent: 'center',
    shadowColor: '#1F4B9F',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  row: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  text: { fontSize: 17, fontWeight: '800' },
  textSm: { fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.55 },
});
