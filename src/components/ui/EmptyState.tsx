import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import UIButton from './Button';

export default function UIEmptyState({
  icon = 'o',
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.wrap, { borderColor: t.colors.border, backgroundColor: t.colors.surfaceMuted, borderRadius: t.radius.lg }]}>
      <Text style={[styles.icon, { color: t.colors.secondary }]}>{icon}</Text>
      <Text style={[styles.title, { color: t.colors.primary }]}>{title}</Text>
      {message ? <Text style={[styles.message, { color: t.colors.textMuted }]}>{message}</Text> : null}
      {actionLabel && onAction ? <View style={{ marginTop: t.spacing.sm }}><UIButton title={actionLabel} variant="outline" onPress={onAction} /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, padding: 18, alignItems: 'center' },
  icon: { fontSize: 22, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  message: { marginTop: 6, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
});

