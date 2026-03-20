import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ManagedViewBanner from '../../components/managed/ManagedViewBanner';
import { EmptyState, Screen } from '../../components/ui';
import { Spacing } from '../../constants/theme';
import { InquiriesService } from '../../api/services';
import type { Inquiry } from '../../types/models';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InquiryStackParamList } from '../../navigation/app/AppNavigator';
import { formatDate } from '../../utils/format';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../context/authStore';
import { getManagedCandidateId, getManagedCandidateName, isManagedViewActive, stripManagedViewState } from '../../utils/managedView';

type Props = NativeStackScreenProps<InquiryStackParamList, 'InquiryList'>;

const statusTone = (status?: string) => {
  const value = String(status || 'Open').toLowerCase();
  if (value.includes('close') || value.includes('resolved')) return { bg: '#E4F7EC', border: '#BFE7CF', text: '#118D4C' };
  if (value.includes('pending') || value.includes('waiting')) return { bg: '#FFF0E1', border: '#F3D4AA', text: '#C26A13' };
  return { bg: '#EEF4FF', border: '#D5E0F5', text: '#1D5FD2' };
};

const hasInquiryReply = (item: Inquiry) => {
  const response = (item as any)?.response;
  if (response && typeof response === 'object' && String(response?.message || '').trim()) return true;
  const replies = Array.isArray((item as any)?.replies) ? (item as any).replies : [];
  return replies.some((reply: any) => String(reply?.message || '').trim());
};

const getInquiryStatusBucket = (item: Inquiry) => {
  const status = String(item?.status || '').trim().toLowerCase();
  if (status.includes('respond') || status.includes('close') || status.includes('resolved') || hasInquiryReply(item)) return 'Responded';
  return 'Pending';
};

const getManagedCandidateIdFromInquiry = (item: Inquiry) =>
  String(
    (item as any)?.managedCandidate?.candidateId?._id ||
      (item as any)?.managedCandidate?.candidateId?.id ||
      (item as any)?.managedCandidate?.candidateId ||
      (item as any)?.managedCandidateId ||
      (item as any)?.candidateId ||
      ''
  ).trim();

export default function InquiryListScreen({ navigation }: Props) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const signIn = useAuthStore((s) => s.signIn);
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Responded'>('All');

  const managedViewActive = useMemo(() => isManagedViewActive(user), [user]);
  const managedCandidateId = useMemo(() => getManagedCandidateId(user), [user]);
  const managedCandidateName = useMemo(() => getManagedCandidateName(user), [user]);

  const heroEntrance = useRef(new Animated.Value(0)).current;
  const listEntrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  const load = async () => {
    setLoading(true);
    try {
      const res = await InquiriesService.listMine();
      setItems(Array.isArray(res) ? res : (res as any)?.inquiries || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [managedCandidateId, navigation]);

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
        delay: 110,
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
          Animated.timing(float, { toValue: 1, duration: 2700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(float, { toValue: 0, duration: 2700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(sweep, { toValue: 1, duration: 2300, delay: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ),
    ];

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [float, heroEntrance, listEntrance, pulse, sweep]);

  const heroY = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.48] });
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-180, 260] });

  const exitManagedView = useCallback(async () => {
    if (!token || !user) return;
    await signIn({ token, user: stripManagedViewState(user) });
    navigation.getParent()?.navigate('Candidates' as never);
  }, [navigation, signIn, token, user]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (navigation.getParent()?.canGoBack()) {
      navigation.getParent()?.goBack();
      return;
    }
    navigation.getParent()?.navigate('Overview' as never);
  }, [navigation]);

  const visibleItems = useMemo(() => {
    if (!managedViewActive || !managedCandidateId) return items;
    return items.filter((item) => {
      const candidateType = String((item as any)?.candidateType || '').trim().toUpperCase();
      return candidateType === 'B2B' && getManagedCandidateIdFromInquiry(item) === managedCandidateId;
    });
  }, [items, managedCandidateId, managedViewActive]);

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    return visibleItems.filter((item) => {
      const bucket = getInquiryStatusBucket(item);
      const matchesStatus = statusFilter === 'All' || bucket === statusFilter;
      const haystack = [
        String(item?.subject || ''),
        String(item?.message || ''),
        String((item as any)?.job?.title || ''),
        String(item?.email || ''),
      ]
        .join(' ')
        .toLowerCase();
      const matchesQuery = !term || haystack.includes(term);
      return matchesStatus && matchesQuery;
    });
  }, [query, statusFilter, visibleItems]);

  const stats = useMemo(() => {
    const total = visibleItems.length;
    const responded = visibleItems.filter((item) => getInquiryStatusBucket(item) === 'Responded').length;
    const pending = Math.max(total - responded, 0);
    return { total, pending, responded };
  }, [visibleItems]);
  const heroStats = [
    { key: 'threads', value: stats.total, label: 'Total Inquiries', color: '#1768B8', icon: 'message-square' as const, iconBg: '#EAF2FF' },
    { key: 'pending', value: stats.pending, label: 'Pending Response', color: '#C46C15', icon: 'clock' as const, iconBg: '#FFF4E4' },
    { key: 'responded', value: stats.responded, label: 'Responded', color: '#118D4C', icon: 'check-circle' as const, iconBg: '#EAF8F0' },
  ];

  return (
    <Screen padded={false}>
      <FlatList
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        data={filteredItems}
        keyExtractor={(it) => it._id}
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
            {managedViewActive ? (
              <ManagedViewBanner
                candidateName={managedCandidateName}
                subtitle="Inquiry threads are filtered for the active managed candidate"
                onExit={exitManagedView}
              />
            ) : null}
            <Animated.View style={[styles.headerRow, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
              <Pressable
                onPress={handleBack}
                style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
              >
                <Feather name="arrow-left" size={18} color="#1B3890" />
              </Pressable>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.eyebrow, { fontFamily: t.typography.fontFamily.bold }]}>SUPPORT DESK</Text>
                <Text style={[styles.heading, { color: '#1B3890', fontFamily: t.typography.fontFamily.bold }]}>My Inquiries</Text>
                <Text style={[styles.sub, { color: '#5E6F95', fontFamily: t.typography.fontFamily.medium }]}>
                  {managedViewActive ? 'Track managed-candidate inquiry tickets in one place.' : 'Track support threads in one place.'}
                </Text>
              </View>
              <View style={styles.liveChip}>
                <Animated.View style={[styles.liveDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                <Text style={[styles.liveText, { fontFamily: t.typography.fontFamily.bold }]}>{loading ? 'Syncing' : 'Live'}</Text>
              </View>
            </Animated.View>

            <Animated.View style={[styles.heroCard, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
              <View style={styles.heroGlowA} />
              <Animated.View style={[styles.heroGlowB, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
              <Animated.View style={[styles.heroSweep, { transform: [{ translateX: sweepX }, { rotate: '18deg' }] }]} />

              <View style={styles.heroTopRow}>
                <View style={styles.heroBadge}>
                  <Feather name="message-square" size={13} color="#1768B8" />
                  <Text style={[styles.heroBadgeText, { fontFamily: t.typography.fontFamily.bold }]}>Inquiry hub</Text>
                </View>
                <View style={styles.heroSignal}>
                  <Feather name="radio" size={13} color="#118D4C" />
                  <Text style={[styles.heroSignalText, { fontFamily: t.typography.fontFamily.bold }]}>Response ready</Text>
                </View>
              </View>

              <View style={[styles.heroMain, compact && styles.heroMainCompact]}>
                <View style={styles.heroCopyBlock}>
                  <Text style={[styles.heroTitle, { fontFamily: t.typography.fontFamily.bold }]}>Track inquiry tickets and replies.</Text>
                  <Text style={[styles.heroBody, { fontFamily: t.typography.fontFamily.medium }]}>
                    {stats.total
                      ? `${stats.pending} inquiries are waiting for a response. Open a ticket to review the latest update.`
                      : managedViewActive
                        ? 'This candidate has no job inquiries yet. Inquiries appear after submitting them from a job detail page.'
                        : 'Start a thread when you need help.'}
                  </Text>
                  <View style={styles.heroStatsRow}>
                    {heroStats.map((item) => (
                      <View key={item.key} style={styles.heroStatCard}>
                        <View style={[styles.heroStatIcon, { backgroundColor: item.iconBg }]}>
                          <Feather name={item.icon} size={12} color={item.color} />
                        </View>
                        <Text style={[styles.heroStatValue, { color: item.color, fontFamily: t.typography.fontFamily.bold }]}>{item.value}</Text>
                        <Text style={[styles.heroStatLabel, { fontFamily: t.typography.fontFamily.medium }]}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <Animated.View style={[styles.heroVisual, { transform: [{ translateY: floatY }] }]}>
                  <View style={styles.heroVisualPanel}>
                    <View style={styles.heroVisualOrb} />
                    <View style={styles.heroBubblePrimary}>
                      <Feather name="edit-3" size={12} color="#1768B8" />
                      <Text style={[styles.heroBubblePrimaryText, { fontFamily: t.typography.fontFamily.bold }]}>Draft inquiry</Text>
                    </View>
                    <View style={styles.heroBubbleSecondary}>
                      <Text style={[styles.heroBubbleSecondaryText, { fontFamily: t.typography.fontFamily.medium }]}>Support updated</Text>
                    </View>
                    <View style={styles.heroTimeline}>
                      <View style={[styles.heroTimelineBar, styles.heroTimelineBarWide]} />
                      <View style={[styles.heroTimelineBar, styles.heroTimelineBarMid]} />
                      <View style={[styles.heroTimelineBar, styles.heroTimelineBarShort]} />
                    </View>
                    <View style={styles.heroFooterChip}>
                      <Feather name="corner-down-right" size={12} color="#118D4C" />
                      <Text style={[styles.heroFooterChipText, { fontFamily: t.typography.fontFamily.bold }]}>Tracked replies</Text>
                    </View>
                  </View>
                </Animated.View>
              </View>
            </Animated.View>

            <Animated.View style={[styles.filtersWrap, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
              <View style={styles.searchBox}>
                <Feather name="search" size={16} color="#1D5FD2" />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search subject, job, message, or email"
                  placeholderTextColor="#7A8FB6"
                  style={[styles.searchInput, { fontFamily: t.typography.fontFamily.medium }]}
                />
                {query.trim() ? (
                  <Pressable onPress={() => setQuery('')} style={({ pressed }) => [styles.searchClear, pressed && styles.pressed]}>
                    <Feather name="x" size={14} color="#5D7399" />
                  </Pressable>
                ) : null}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {(['All', 'Pending', 'Responded'] as const).map((value) => {
                  const active = statusFilter === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setStatusFilter(value)}
                      style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && styles.pressed]}
                    >
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive, { fontFamily: t.typography.fontFamily.bold }]}>
                        {value}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Animated.View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="o"
            title={loading ? 'Loading...' : filteredItems.length ? 'No inquiries' : query.trim() || statusFilter !== 'All' ? 'No inquiries match' : managedViewActive ? 'No managed candidate inquiries yet' : 'No inquiries'}
            message={
              loading
                ? 'Please wait'
                : query.trim() || statusFilter !== 'All'
                  ? 'Try a different search or filter.'
                  : managedViewActive
                    ? 'Managed-candidate job inquiries appear here after they are submitted from the job detail page.'
                    : 'Start an inquiry from a job or here.'
            }
          />
        }
        renderItem={({ item, index }) => {
          const bucket = getInquiryStatusBucket(item);
          const tone = statusTone(bucket);
          const cardY = listEntrance.interpolate({ inputRange: [0, 1], outputRange: [20 + Math.min(index, 4) * 8, 0] });
          const jobTitle = String((item as any)?.job?.title || '').trim();
          const jobCompany = String((item as any)?.job?.company || '').trim();
          const responsePreview = String((item as any)?.response?.message || '').trim();

          return (
            <Animated.View style={{ opacity: listEntrance, transform: [{ translateY: cardY }] }}>
              <Pressable
                onPress={() => navigation.navigate('InquiryDetails', { inquiryId: item._id })}
                style={({ pressed }) => [styles.inquiryCard, pressed && styles.inquiryCardPressed]}
              >
                <LinearGradient colors={['rgba(25, 98, 182, 0.08)', 'rgba(255,255,255,0.02)']} style={styles.cardTint} />
                <Animated.View pointerEvents="none" style={[styles.cardSweep, { transform: [{ translateX: sweepX }, { rotate: '18deg' }] }]} />

                <View style={styles.topRow}>
                  <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 1 }} style={styles.iconWrap}>
                    <Feather name="help-circle" size={18} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={styles.titleBlock}>
                    <Text style={[styles.title, { color: '#111D3E', fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                      {item.subject || item.category || 'Inquiry'}
                    </Text>
                    <Text style={[styles.metaText, { fontFamily: t.typography.fontFamily.medium }]}>{`Created ${formatDate(item.createdAt) || 'recently'}`}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                    <Text style={[styles.statusText, { color: tone.text, fontFamily: t.typography.fontFamily.bold }]}>{bucket}</Text>
                  </View>
                </View>

                {jobTitle ? (
                  <View style={styles.jobRefCard}>
                    <View style={styles.jobRefIcon}>
                      <Feather name="briefcase" size={14} color="#1D5FD2" />
                    </View>
                    <View style={styles.jobRefCopy}>
                      <Text style={[styles.jobRefTitle, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{jobTitle}</Text>
                      {jobCompany ? <Text style={[styles.jobRefMeta, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{jobCompany}</Text> : null}
                    </View>
                  </View>
                ) : null}

                {item.message ? (
                  <Text style={[styles.message, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={2}>
                    {item.message}
                  </Text>
                ) : null}

                {bucket === 'Responded' && responsePreview ? (
                  <View style={styles.responsePreview}>
                    <Text style={[styles.responsePreviewLabel, { fontFamily: t.typography.fontFamily.bold }]}>Latest response</Text>
                    <Text style={[styles.responsePreviewText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={2}>{responsePreview}</Text>
                  </View>
                ) : null}

                <View style={styles.actionsRow}>
                  <View style={styles.tapHint}>
                    <Feather name="arrow-up-right" size={14} color="#5D7BBE" />
                    <Text style={[styles.tapHintText, { fontFamily: t.typography.fontFamily.bold }]}>View details</Text>
                  </View>
                  <View style={styles.replyChip}>
                    <Animated.View style={[styles.replyDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                    <Text style={[styles.replyChipText, { fontFamily: t.typography.fontFamily.medium }]}>{bucket === 'Responded' ? 'Reply available' : 'Waiting for reply'}</Text>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 130 },
  headerWrap: { marginBottom: Spacing.sm },
  pressed: { opacity: 0.92 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#D1DEF3',
  },
  backBtnHidden: { opacity: 0 },
  headerTextWrap: { flex: 1 },
  eyebrow: {
    color: '#7485A8',
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 2.1,
    fontWeight: '900',
  },
  heading: { marginTop: 3, fontSize: 20, lineHeight: 24, fontWeight: '900' },
  sub: { marginTop: 4, fontWeight: '700', fontSize: 10, lineHeight: 15 },
  liveChip: {
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 13,
    backgroundColor: '#F7FAFF',
    borderWidth: 1,
    borderColor: '#D4E0F2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1FCB7A',
  },
  liveText: { color: '#1B4B98', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#D3DFF3',
    backgroundColor: '#F9FBFF',
    padding: 16,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#4A6EAE',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  heroGlowA: {
    position: 'absolute',
    top: -70,
    right: -22,
    width: 188,
    height: 188,
    borderRadius: 94,
    backgroundColor: 'rgba(76, 139, 255, 0.12)',
  },
  heroGlowB: {
    position: 'absolute',
    bottom: -26,
    left: -18,
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(91, 214, 190, 0.12)',
  },
  heroSweep: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 86,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D7E2F4',
    backgroundColor: '#FFFFFF',
  },
  heroBadgeText: {
    color: '#1768B8',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroSignal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D7EAD9',
    backgroundColor: '#FFFFFF',
  },
  heroSignalText: { color: '#118D4C', fontSize: 10, lineHeight: 13, fontWeight: '800' },
  heroMain: { marginTop: 16, flexDirection: 'row', gap: 14 },
  heroMainCompact: { gap: 10 },
  heroCopyBlock: { flex: 1 },
  heroTitle: { color: '#153375', fontSize: 22, lineHeight: 26, fontWeight: '900', maxWidth: 228 },
  heroBody: { marginTop: 8, color: '#5D7096', fontSize: 11, lineHeight: 16, fontWeight: '700', maxWidth: 236 },
  heroStatsRow: { marginTop: 14, flexDirection: 'row', gap: 9 },
  heroStatCard: {
    flex: 1,
    minHeight: 76,
    minWidth: 76,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7E2F4',
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  heroStatIcon: { width: 22, height: 22, borderRadius: 8, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 4 },
  heroStatValue: { fontSize: 16, lineHeight: 19, fontWeight: '900', textAlign: 'center' },
  heroStatLabel: { color: '#657B9E', fontSize: 9, lineHeight: 11, fontWeight: '700', textAlign: 'center' },
  heroVisual: {
    width: 154,
    alignItems: 'stretch',
    height: 154,
  },
  heroVisualPanel: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E2F3',
    padding: 14,
    shadowColor: '#4168A8',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    overflow: 'hidden',
  },
  heroVisualOrb: {
    position: 'absolute',
    top: 18,
    right: 12,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(84, 145, 255, 0.08)',
  },
  heroBubblePrimary: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: '#F2F7FF',
    borderWidth: 1,
    borderColor: '#D8E4F5',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
  },
  heroBubblePrimaryText: {
    color: '#1768B8',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
  heroBubbleSecondary: {
    marginTop: 10,
    minHeight: 30,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE7F8',
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  heroBubbleSecondaryText: {
    color: '#6B7EA5',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
  },
  heroTimeline: { marginTop: 14, gap: 8 },
  heroTimelineBar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#DAE6F8',
  },
  heroTimelineBarWide: { width: '92%' },
  heroTimelineBarMid: { width: '72%' },
  heroTimelineBarShort: { width: '48%' },
  heroFooterChip: {
    marginTop: 14,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F2FCF8',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroFooterChipText: { color: '#118D4C', fontSize: 9, lineHeight: 11, fontWeight: '800' },
  filtersWrap: { marginBottom: 10, gap: 10 },
  searchBox: { minHeight: 48, borderRadius: 18, paddingHorizontal: 14, backgroundColor: '#F6FAFF', borderWidth: 1, borderColor: '#D8E4F6', flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, color: '#14316E', fontSize: 13, lineHeight: 16, paddingVertical: 0 },
  searchClear: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECF2FA' },
  filterRow: { gap: 8, paddingRight: 8 },
  filterChip: { minHeight: 34, borderRadius: 999, paddingHorizontal: 12, borderWidth: 1, borderColor: '#D8E4F6', backgroundColor: '#F7FAFF', alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { backgroundColor: '#1B6FC1', borderColor: '#1B6FC1' },
  filterChipText: { color: '#1D528F', fontSize: 12, lineHeight: 14, fontWeight: '800' },
  filterChipTextActive: { color: '#FFFFFF' },
  createWrap: { marginBottom: 10 },
  createInquiryCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#2F5EA8',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  createInquiryFill: {
    minHeight: 74,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  createInquiryCopy: { flex: 1 },
  createInquiryTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '900',
  },
  createInquiryText: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.84)',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  createInquiryIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  inquiryCard: {
    marginBottom: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(248,250,252,0.94)',
    borderWidth: 1,
    borderColor: '#D5DFF2',
    padding: 12,
    shadowColor: '#5F82BA',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    overflow: 'hidden',
  },
  inquiryCardPressed: {
    backgroundColor: '#EFF5FF',
    borderColor: '#C7D9F4',
  },
  cardTint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
  },
  cardSweep: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 82,
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  title: { fontSize: 15, lineHeight: 18, fontWeight: '900' },
  metaText: { marginTop: 2, color: '#5C6E92', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statusText: { fontSize: 9, lineHeight: 11, fontWeight: '900' },
  jobRefCard: { marginTop: 10, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#F6FAFF', borderWidth: 1, borderColor: '#DDE7F6', flexDirection: 'row', alignItems: 'center', gap: 10 },
  jobRefIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF2FF' },
  jobRefCopy: { flex: 1 },
  jobRefTitle: { color: '#15306F', fontSize: 12, lineHeight: 15, fontWeight: '800' },
  jobRefMeta: { marginTop: 2, color: '#68809A', fontSize: 10, lineHeight: 12, fontWeight: '600' },
  message: { marginTop: 8, color: '#2A3B61', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  responsePreview: { marginTop: 12, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#F7FCF9', borderWidth: 1, borderColor: '#D5EBDD' },
  responsePreviewLabel: { color: '#148A4D', fontSize: 10, lineHeight: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  responsePreviewText: { marginTop: 6, color: '#607784', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  actionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tapHintText: {
    color: '#5D7BBE',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  replyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F5F9FF',
    borderWidth: 1,
    borderColor: '#D8E4F5',
  },
  replyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1FCB7A',
  },
  replyChipText: {
    color: '#7184AA',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '700',
  },
});

