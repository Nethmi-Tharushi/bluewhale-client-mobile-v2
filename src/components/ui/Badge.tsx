import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

const getTone = (status: string, t: ReturnType<typeof useTheme>) => {
  const s = status.toLowerCase();
  if (['paid', 'completed', 'approved', 'resolved'].includes(s)) return t.colors.success;
  if (['pending', 'in progress', 'processing', 'sent', 'draft'].includes(s)) return t.colors.warning;
  if (['rejected', 'cancelled', 'overdue', 'failed'].includes(s)) return t.colors.error;
  return t.colors.secondary;
};

export default function UIBadge({ text }: { text: string }) {
  const t = useTheme();
  const tone = getTone(text || 'Unknown', t);
  return (
    <View style={[styles.badge, { borderColor: `${tone}44`, backgroundColor: `${tone}18` }]}>
      <Text style={[styles.text, { color: tone }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  text: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
});
