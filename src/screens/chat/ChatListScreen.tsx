import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Image, ImageSourcePropType, Pressable, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatService } from '../../api/services';
import type { ChatAdmin } from '../../types/models';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatStackParamList } from '../../navigation/app/AppNavigator';
import { useTheme } from '../../theme/ThemeProvider';
import { PageDecor } from '../../components/ui';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatList'>;

export default function ChatListScreen({ navigation }: Props) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const [items, setItems] = useState<ChatAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const heroEntrance = useRef(new Animated.Value(0)).current;
  const listEntrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  const avatarGradients = useMemo(
    () =>
      [
        ['#4A92FF', '#4EE2CF'],
        ['#508DFF', '#78C8FF'],
        ['#4AA8FF', '#6BE4E1'],
      ] as const,
    []
  );
  const salesAdminAvatar = require('../../../assets/sales_admin.png');
  const superAdminAvatar = require('../../../assets/super_admin.png');

  const resolveAvatar = (item: ChatAdmin, index: number): ImageSourcePropType => {
    const haystack = `${item.fullName || ''} ${item.name || ''} ${item.email || ''} ${item.role || ''}`.toLowerCase();
    if (haystack.includes('super')) return superAdminAvatar;
    if (haystack.includes('sales')) return salesAdminAvatar;
    return index % 2 === 0 ? salesAdminAvatar : superAdminAvatar;
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await ChatService.listAdmins();
      setItems(Array.isArray(res) ? res : (res as any)?.admins || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroEntrance, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(listEntrance, {
        toValue: 1,
        duration: 760,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(drift, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(drift, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(sweep, { toValue: 1, duration: 2400, delay: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ),
    ];

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [drift, heroEntrance, listEntrance, pulse, sweep]);

  const activeCount = items.length;
  const heroY = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const listY = listEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.46] });
  const driftY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-180, 300] });
  const heroStats = [
    { key: 'admins', value: String(activeCount), label: 'Admins', color: '#1667B7', icon: 'users' as const, iconBg: '#EAF2FF' },
    { key: 'status', value: 'Live', label: 'Status', color: '#11856E', icon: 'activity' as const, iconBg: '#EAF8F3' },
    { key: 'threads', value: '1:1', label: 'Threads', color: '#8257DA', icon: 'message-circle' as const, iconBg: '#F3EDFF' },
  ];
  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.getParent()?.navigate('Home' as never);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <PageDecor />
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={items}
        keyExtractor={(it) => it._id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <Animated.View style={[styles.topBar, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
              <Pressable
                onPress={handleBack}
                style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
              >
                <Feather name="arrow-left" size={18} color="#24408D" />
              </Pressable>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.topEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>Support inbox</Text>
                <Text style={[styles.heading, { fontFamily: t.typography.fontFamily.bold }]}>Chat</Text>
                <Text style={[styles.sub, { fontFamily: t.typography.fontFamily.medium }]}>Message your assigned admins here.</Text>
              </View>
              <View style={styles.liveChip}>
                <Animated.View style={[styles.liveDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                <Text style={[styles.liveChipText, { fontFamily: t.typography.fontFamily.bold }]}>Online</Text>
              </View>
            </Animated.View>

            <Animated.View style={[styles.heroCard, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
              <View style={styles.heroGlowA} />
              <View style={styles.heroGlowB} />
              <Animated.View style={[styles.heroSweep, { transform: [{ translateX: sweepX }, { rotate: '18deg' }] }]} />

              <View style={styles.heroTopRow}>
                <View style={styles.heroBadge}>
                  <Feather name="message-circle" size={13} color="#1460AD" />
                  <Text style={[styles.heroBadgeText, { fontFamily: t.typography.fontFamily.bold }]}>Conversation desk</Text>
                </View>
                <View style={styles.heroSignal}>
                  <View style={styles.heroSignalDot} />
                  <Text style={[styles.heroSignalText, { fontFamily: t.typography.fontFamily.bold }]}>Fast replies</Text>
                </View>
              </View>

              <View style={styles.heroMain}>
                <View style={styles.heroCopyBlock}>
                  <Text style={[styles.heroTitle, compact && styles.heroTitleCompact, { fontFamily: t.typography.fontFamily.bold }]}>
                    Message support without losing context.
                  </Text>
                  <Text style={[styles.heroBody, { fontFamily: t.typography.fontFamily.medium }]}>
                    Open a thread and continue the same chat.
                  </Text>

                  <View style={[styles.heroStatsRow, compact && styles.heroStatsRowCompact]}>
                    {heroStats.map((item) => (
                      <View key={item.key} style={[styles.heroStatCard, compact && styles.heroStatCardCompact]}>
                        <View style={[styles.heroStatIcon, compact && styles.heroStatIconCompact, { backgroundColor: item.iconBg }]}>
                          <Feather name={item.icon} size={compact ? 11 : 12} color={item.color} />
                        </View>
                        <Text numberOfLines={1} style={[styles.heroStatValue, compact && styles.heroStatValueCompact, { color: item.color, fontFamily: t.typography.fontFamily.bold }]}>
                          {item.value}
                        </Text>
                        <Text numberOfLines={1} style={[styles.heroStatLabel, compact && styles.heroStatLabelCompact, { fontFamily: t.typography.fontFamily.medium }]}>
                          {item.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                <Animated.View style={[styles.heroVisual, { transform: [{ translateY: driftY }] }]}>
                  <View style={styles.heroOrbitalBack} />
                  <View style={styles.heroVisualCard}>
                    <Animated.View style={[styles.heroVisualPulse, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                    <View style={[styles.messageBubble, styles.messageBubblePrimary]}>
                      <Feather name="send" size={12} color="#1768B8" />
                      <Text style={[styles.messageBubbleText, { fontFamily: t.typography.fontFamily.bold }]}>New thread</Text>
                    </View>
                    <View style={[styles.messageBubble, styles.messageBubbleNeutral]}>
                      <Text style={[styles.messageBubbleTextMuted, { fontFamily: t.typography.fontFamily.medium }]}>Assigned admin ready</Text>
                    </View>
                    <View style={[styles.waveRow, compact && styles.waveRowCompact]}>
                      <View style={[styles.waveBar, styles.waveBarShort]} />
                      <View style={[styles.waveBar, styles.waveBarMid]} />
                      <View style={[styles.waveBar, styles.waveBarTall]} />
                      <View style={[styles.waveBar, styles.waveBarMid]} />
                    </View>
                    <View style={styles.heroFooterChip}>
                      <Feather name="clock" size={12} color="#11856E" />
                      <Text style={[styles.heroFooterText, { fontFamily: t.typography.fontFamily.bold }]}>Live queue</Text>
                    </View>
                  </View>
                </Animated.View>
              </View>
            </Animated.View>

            <Animated.View style={[styles.sectionRow, { opacity: listEntrance, transform: [{ translateY: listY }] }]}>
              <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Available admins</Text>
              <View style={styles.sectionPill}>
                <Text style={[styles.sectionPillText, { fontFamily: t.typography.fontFamily.bold }]}>{activeCount} listed</Text>
              </View>
            </Animated.View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={[styles.emptyTitle, { fontFamily: t.typography.fontFamily.bold }]}>{loading ? 'Loading...' : 'No admins found'}</Text>
            <Text style={[styles.emptyBody, { fontFamily: t.typography.fontFamily.medium }]}>
              {loading ? 'Please wait' : 'Assigned admins show up here.'}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const cardY = listEntrance.interpolate({ inputRange: [0, 1], outputRange: [22 + Math.min(index, 4) * 8, 0] });
          const cardOpacity = listEntrance.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
          const roleText = item.role || 'Support admin';
          const emailText = item.email || 'support@bluewhale.com';

          return (
            <Animated.View style={{ opacity: cardOpacity, transform: [{ translateY: cardY }] }}>
              <Pressable
                style={({ pressed }) => [styles.cardShell, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Open chat with ${item.fullName || item.name || 'support'}`}
                onPress={() =>
                  navigation.navigate('ChatRoom', {
                    adminId: (item as any)?.userId || (item as any)?.user?._id || (item as any)?.adminId || item._id,
                    title: item.fullName || item.name || 'Chat',
                    adminEmail: item.email || '',
                    adminRole: item.role || '',
                  })
                }
              >
                <View style={styles.cardTint} />
                <Animated.View style={[styles.cardSweep, { transform: [{ translateX: sweepX }, { rotate: '18deg' }] }]} />

                <View style={styles.cardTopRow}>
                  <LinearGradient
                    colors={avatarGradients[index % avatarGradients.length]}
                    start={{ x: 0, y: 0.1 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatarWrap}
                  >
                    <Image source={resolveAvatar(item, index)} style={styles.avatarImage} resizeMode="cover" />
                  </LinearGradient>

                  <View style={styles.meta}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.name, { color: t.colors.text, fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                        {item.fullName || item.name || 'Support User'}
                      </Text>
                      <View style={styles.onlinePill}>
                        <Animated.View style={[styles.onlineDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                        <Text style={[styles.onlineText, { fontFamily: t.typography.fontFamily.bold }]}>Live</Text>
                      </View>
                    </View>
                    <Text style={[styles.email, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                      {emailText}
                    </Text>

                    <View style={styles.metaChipRow}>
                      <View style={styles.metaChip}>
                        <Feather name="briefcase" size={12} color="#1768B8" />
                        <Text style={[styles.metaChipText, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                          {roleText}
                        </Text>
                      </View>
                      <View style={styles.metaChipSoft}>
                        <Feather name="message-square" size={12} color="#11856E" />
                        <Text style={[styles.metaChipSoftText, { fontFamily: t.typography.fontFamily.bold }]}>Open thread</Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.cardSignal}>
                    <View style={styles.cardSignalLine} />
                    <Animated.View style={[styles.cardSignalPulse, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                  </View>
                  <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.chatButton}>
                    <Text style={[styles.chatButtonText, { fontFamily: t.typography.fontFamily.bold }]}>Open chat</Text>
                    <Feather name="arrow-up-right" size={15} color="#FFFFFF" />
                  </LinearGradient>
                </View>
              </Pressable>
            </Animated.View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EEF3FB' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 130 },
  headerWrap: { marginTop: 22, marginBottom: 8 },
  pressed: { opacity: 0.9 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#D2DFF5',
  },
  headerTextWrap: { flex: 1 },
  topEyebrow: {
    color: '#6A7F99',
    fontSize: 10,
    lineHeight: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    fontWeight: '800',
  },
  heading: {
    marginTop: 3,
    color: '#1A347F',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
  },
  sub: {
    marginTop: 2,
    color: '#526886',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#F8FBFF',
    borderWidth: 1,
    borderColor: '#D4E1F4',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1FCA7B',
  },
  liveChipText: {
    color: '#16529A',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  heroCard: {
    borderRadius: 28,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: '#D3DFF0',
    backgroundColor: '#F9FBFE',
    overflow: 'hidden',
  },
  heroGlowA: {
    position: 'absolute',
    top: -84,
    right: -16,
    width: 178,
    height: 178,
    borderRadius: 89,
    backgroundColor: 'rgba(67, 153, 255, 0.1)',
  },
  heroGlowB: {
    position: 'absolute',
    bottom: -30,
    left: -18,
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(79, 222, 200, 0.09)',
  },
  heroSweep: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 80,
    backgroundColor: 'rgba(255,255,255,0.36)',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5E2F3',
  },
  heroBadgeText: {
    color: '#1460AD',
    fontSize: 10,
    lineHeight: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontWeight: '800',
  },
  heroSignal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5E2F3',
  },
  heroSignalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1FCA7B',
  },
  heroSignalText: {
    color: '#11856E',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  heroMain: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 12,
  },
  heroCopyBlock: { flex: 1 },
  heroTitle: {
    color: '#19367C',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '900',
  },
  heroTitleCompact: {
    fontSize: 16,
    lineHeight: 18,
  },
  heroBody: {
    marginTop: 6,
    color: '#586C89',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  heroStatsRowCompact: {
    gap: 5,
  },
  heroStatCard: {
    flex: 1,
    minHeight: 62,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5E1F2',
    justifyContent: 'center',
    minWidth: 0,
  },
  heroStatCardCompact: {
    minHeight: 56,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  heroStatIcon: {
    width: 22,
    height: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  heroStatIconCompact: {
    width: 18,
    height: 18,
    borderRadius: 7,
    marginBottom: 5,
  },
  heroStatValue: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '900',
  },
  heroStatValueCompact: {
    fontSize: 14,
    lineHeight: 16,
  },
  heroStatLabel: {
    marginTop: 3,
    color: '#6B7D98',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
  },
  heroStatLabelCompact: {
    marginTop: 2,
    fontSize: 9,
    lineHeight: 11,
  },
  heroVisual: {
    width: 118,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOrbitalBack: {
    position: 'absolute',
    width: 102,
    height: 142,
    borderRadius: 22,
    backgroundColor: '#EAF1FA',
    borderWidth: 1,
    borderColor: '#D4E0F2',
  },
  heroVisualCard: {
    width: 110,
    minHeight: 142,
    borderRadius: 22,
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5E1F2',
    overflow: 'hidden',
  },
  heroVisualPulse: {
    position: 'absolute',
    top: 26,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(77, 149, 255, 0.12)',
  },
  messageBubble: {
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderWidth: 1,
  },
  messageBubblePrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EEF6FF',
    borderColor: '#D8E7FA',
    alignSelf: 'flex-start',
  },
  messageBubbleNeutral: {
    marginTop: 7,
    backgroundColor: '#F8FBFE',
    borderColor: '#E3ECF7',
    alignSelf: 'flex-end',
  },
  messageBubbleText: {
    color: '#1768B8',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  messageBubbleTextMuted: {
    color: '#637795',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    marginTop: 10,
    height: 28,
  },
  waveRowCompact: {
    gap: 4,
  },
  waveBar: {
    width: 8,
    borderRadius: 999,
    backgroundColor: '#CFE2FB',
  },
  waveBarShort: { height: 10 },
  waveBarMid: { height: 16 },
  waveBarTall: { height: 22, backgroundColor: '#5EAEFF' },
  heroFooterChip: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#EAF9F6',
    borderWidth: 1,
    borderColor: '#D1EEE7',
  },
  heroFooterText: {
    color: '#11856E',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  sectionRow: {
    marginTop: 12,
    marginBottom: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    color: '#24408D',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  sectionPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F2F7FF',
    borderWidth: 1,
    borderColor: '#D7E3F4',
  },
  sectionPillText: {
    color: '#5E7397',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  cardShell: {
    marginTop: 12,
    borderRadius: 24,
    padding: 12,
    backgroundColor: 'rgba(249,251,254,0.94)',
    borderWidth: 1,
    borderColor: '#D2DDEC',
    overflow: 'hidden',
  },
  cardTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  cardSweep: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 72,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  meta: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#EEF9F3',
    borderWidth: 1,
    borderColor: '#D5EEE2',
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#1FCA7B',
  },
  onlineText: {
    color: '#11856E',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  email: {
    marginTop: 4,
    color: '#5C6E92',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  metaChipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 9,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: '#EEF6FF',
    borderWidth: 1,
    borderColor: '#D7E6F8',
  },
  metaChipSoft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: '#EAF9F6',
    borderWidth: 1,
    borderColor: '#D1EEE7',
  },
  metaChipText: {
    flex: 1,
    color: '#1768B8',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  metaChipSoftText: {
    color: '#11856E',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  cardFooter: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardSignal: {
    flex: 1,
    height: 18,
    justifyContent: 'center',
    position: 'relative',
  },
  cardSignalLine: {
    height: 2,
    borderRadius: 999,
    backgroundColor: '#D9E4F4',
  },
  cardSignalPulse: {
    position: 'absolute',
    left: 22,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4AA8FF',
  },
  chatButton: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  chatButtonText: {
    color: '#F4FAFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  emptyCard: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D0DBEC',
    backgroundColor: 'rgba(249,251,254,0.9)',
    padding: 16,
  },
  emptyTitle: {
    color: '#263966',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  emptyBody: {
    marginTop: 4,
    color: '#5C6E92',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
});
