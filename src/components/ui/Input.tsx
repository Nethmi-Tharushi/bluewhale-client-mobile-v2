import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export default function UIInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  multiline,
  error,
  icon,
}: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
  multiline?: boolean;
  error?: string;
  icon?: React.ReactNode;
}) {
  const t = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const hidePassword = useMemo(() => !!secureTextEntry && !showPassword, [secureTextEntry, showPassword]);
  return (
    <View style={{ marginBottom: t.spacing.sm }}>
      {label ? <Text style={[styles.label, { color: t.colors.text }]}>{label}</Text> : null}
      <View
        style={[
          styles.fieldWrap,
          {
            borderColor: error ? t.colors.error : t.colors.borderStrong,
            backgroundColor: t.colors.surface,
            borderRadius: t.radius.md,
          },
        ]}
      >
        {icon ? <View style={styles.leftIcon}>{icon}</View> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.colors.textMuted}
          secureTextEntry={hidePassword}
          keyboardType={keyboardType}
          multiline={multiline}
          style={[
            styles.input,
            { color: t.colors.text },
            multiline && { minHeight: 120, textAlignVertical: 'top', paddingTop: 12, paddingBottom: 12 },
          ]}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8} style={styles.toggle}>
            <Text style={{ color: t.colors.primary, fontWeight: '700' }}>{showPassword ? 'Hide' : 'Show'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[styles.error, { color: t.colors.error }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '700', fontSize: 13, marginBottom: 6 },
  fieldWrap: {
    borderWidth: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftIcon: { marginLeft: 12, marginRight: 6 },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontWeight: '600' },
  toggle: { paddingHorizontal: 10, paddingVertical: 10 },
  error: { marginTop: 6, fontSize: 12, fontWeight: '600' },
});
