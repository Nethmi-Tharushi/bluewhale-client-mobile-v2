import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeProvider';

export default function AppHeader({
  title,
  subtitle,
  onBack,
  rightAction,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <LinearGradient colors={t.colors.gradientHeader as any} style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.side}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              style={({ pressed }) => [styles.back, { borderColor: 'rgba(255,255,255,0.38)' }, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.backText}>{"<"}</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.center}>
          <Text style={[styles.title, { fontSize: t.typography.size.xxl }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={[styles.side, { alignItems: 'flex-end' }]}>{rightAction}</View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  side: { width: 56 },
  center: { flex: 1, alignItems: 'center' },
  title: { color: 'white', fontWeight: '900' },
  subtitle: { color: 'rgba(255,255,255,0.84)', marginTop: 4, fontWeight: '700', fontSize: 16 },
  back: {
    minHeight: 40,
    minWidth: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  backText: { color: 'white', fontWeight: '900', fontSize: 16 },
});
