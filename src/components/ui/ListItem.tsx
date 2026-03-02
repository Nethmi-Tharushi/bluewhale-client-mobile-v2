import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export default function UIListItem({
  title,
  subtitle,
  meta,
  onPress,
  right,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  const t = useTheme();
  const body = (
    <View style={[styles.wrap, { borderColor: t.colors.border, backgroundColor: t.colors.surface, borderRadius: t.radius.md }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: t.colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: t.colors.textMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? <Text style={[styles.meta, { color: t.colors.secondary }]}>{meta}</Text> : null}
      </View>
      {right ? <View style={{ marginLeft: 12 }}>{right}</View> : null}
    </View>
  );

  if (!onPress) return body;
  return <Pressable onPress={onPress}>{body}</Pressable>;
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, minHeight: 72, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '800' },
  subtitle: { marginTop: 4, fontWeight: '600', lineHeight: 19 },
  meta: { marginTop: 6, fontWeight: '700', fontSize: 12 },
});
