import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeProvider';

type Props = {
  candidateName?: string;
  subtitle?: string;
  actionLabel?: string;
  onExit?: () => void;
};

export default function ManagedViewBanner({
  candidateName = 'Managed candidate',
  subtitle = 'Agent session + candidate context',
  actionLabel = 'Return to Agent Dashboard',
  onExit,
}: Props) {
  const t = useTheme();

  return (
    <LinearGradient
      colors={['#F5F9FF', '#EEF6FF', '#F8FBFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.banner}
    >
      <View style={styles.glowA} />
      <View style={styles.glowB} />
      <View style={styles.row}>
        <View style={styles.copyWrap}>
          <View style={styles.pill}>
            <Feather name="shuffle" size={12} color="#1659B7" />
            <Text style={[styles.pillText, { fontFamily: t.typography.fontFamily.bold }]}>Managed Candidate View</Text>
          </View>
          <Text style={[styles.title, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={2}>
            {candidateName}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: t.typography.fontFamily.medium }]}>{subtitle}</Text>
        </View>
        {onExit ? (
          <Pressable onPress={onExit} style={({ pressed }) => [styles.exitButton, pressed && styles.pressed]}>
            <Feather name="log-out" size={14} color="#1A4E9B" />
            <Text style={[styles.exitText, { fontFamily: t.typography.fontFamily.bold }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  banner: {
    overflow: 'hidden',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#D5E4FA',
    backgroundColor: '#F7FBFF',
    marginBottom: 14,
  },
  glowA: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -40,
    left: -24,
    backgroundColor: 'rgba(83, 157, 255, 0.16)',
  },
  glowB: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    right: -34,
    bottom: -54,
    backgroundColor: 'rgba(28, 111, 213, 0.12)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copyWrap: {
    flex: 1,
    gap: 6,
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: '#D7E6FB',
  },
  pillText: {
    fontSize: 11,
    color: '#1659B7',
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    color: '#153B82',
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#5D719C',
  },
  exitButton: {
    minWidth: 84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#D3E2F8',
  },
  exitText: {
    fontSize: 13,
    color: '#1A4E9B',
  },
  pressed: {
    opacity: 0.82,
  },
});

