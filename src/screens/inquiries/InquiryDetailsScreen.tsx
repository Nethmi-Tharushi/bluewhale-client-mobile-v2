import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ManagedViewBanner from '../../components/managed/ManagedViewBanner';
import { Badge, EmptyState, Screen } from '../../components/ui';
import { Spacing } from '../../constants/theme';
import { InquiriesService } from '../../api/services';
import type { Inquiry } from '../../types/models';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InquiryStackParamList } from '../../navigation/app/AppNavigator';
import { formatDate } from '../../utils/format';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../context/authStore';
import { getManagedCandidateId, getManagedCandidateName, isManagedViewActive, stripManagedViewState } from '../../utils/managedView';

type Props = NativeStackScreenProps<InquiryStackParamList, 'InquiryDetails'>;

const normalizeReplyBy = (value: any) => {
  const raw = String(value || '').trim();
  if (!raw) return 'Support';
  if (/^[a-f0-9]{24}$/i.test(raw) || /^[a-f0-9-]{32,}$/i.test(raw)) return 'Support';
  return raw;
};

const statusTone = (status?: string) => {
  const value = String(status || 'Open').toLowerCase();
  if (value.includes('close') || value.includes('resolved')) return { bg: '#E4F7EC', border: '#BFE7CF', text: '#118D4C' };
  if (value.includes('pending') || value.includes('waiting')) return { bg: '#FFF0E1', border: '#F3D4AA', text: '#C26A13' };
  return { bg: '#EEF4FF', border: '#D5E0F5', text: '#1D5FD2' };
};

const hasInquiryReply = (item: Inquiry | null) => {
  const response = (item as any)?.response;
  if (response && typeof response === 'object' && String(response?.message || '').trim()) return true;
  const replies = Array.isArray((item as any)?.replies) ? (item as any).replies : [];
  return replies.some((reply: any) => String(reply?.message || '').trim());
};

const getInquiryStatusBucket = (item: Inquiry | null) => {
  const status = String(item?.status || '').trim().toLowerCase();
  if (status.includes('respond') || status.includes('close') || status.includes('resolved') || hasInquiryReply(item)) return 'Responded';
  return 'Pending';
};

const getManagedCandidateIdFromInquiry = (item: Inquiry | null) =>
  String(
    (item as any)?.managedCandidate?.candidateId?._id ||
      (item as any)?.managedCandidate?.candidateId?.id ||
      (item as any)?.managedCandidate?.candidateId ||
      (item as any)?.managedCandidateId ||
      (item as any)?.candidateId ||
      ''
  ).trim();

export default function InquiryDetailsScreen({ navigation, route }: Props) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const { inquiryId } = route.params;
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const signIn = useAuthStore((s) => s.signIn);
  const [item, setItem] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const managedViewActive = useMemo(() => isManagedViewActive(user), [user]);
  const managedCandidateId = useMemo(() => getManagedCandidateId(user), [user]);
  const managedCandidateName = useMemo(() => getManagedCandidateName(user), [user]);

  const heroEntrance = useRef(new Animated.Value(0)).current;
  const sectionsEntrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await InquiriesService.listMine();
        const list = Array.isArray(res) ? res : (res as any)?.inquiries || [];
        const visible = managedViewActive && managedCandidateId
          ? list.filter((entry: any) => {
              const candidateType = String(entry?.candidateType || '').trim().toUpperCase();
              return candidateType === 'B2B' && getManagedCandidateIdFromInquiry(entry) === managedCandidateId;
            })
          : list;
        const found = visible.find((x: any) => x._id === inquiryId);
        setItem(found || null);
      } catch {
        setItem(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [inquiryId, managedCandidateId, managedViewActive]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroEntrance, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sectionsEntrance, {
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
          Animated.timing(drift, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(drift, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
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
  }, [drift, heroEntrance, pulse, sectionsEntrance, sweep]);

  const displayedReplies = useMemo(() => {
    const list: Array<{ by?: string; message?: string; createdAt?: string }> = [];
    const response = (item as any)?.response;
    if (response && typeof response === 'object' && String(response?.message || '').trim()) {
      list.push({
        by: normalizeReplyBy(response?.repliedBy || response?.by),
        message: String(response?.message || '').trim(),
        createdAt: String(response?.repliedAt || response?.createdAt || '').trim() || undefined,
      });
    }

    const replies = Array.isArray((item as any)?.replies) ? (item as any).replies : [];
    for (const r of replies) {
      if (!r || !String(r?.message || '').trim()) continue;
      list.push({
        by: normalizeReplyBy(r?.by || r?.repliedBy),
        message: String(r?.message || '').trim(),
        createdAt: String(r?.createdAt || r?.repliedAt || '').trim() || undefined,
      });
    }
    return list;
  }, [item]);

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

  const statusLabel = getInquiryStatusBucket(item);
  const tone = statusTone(statusLabel || (loading ? 'Loading' : 'Open'));
  const heroY = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const sectionY = sectionsEntrance.interpolate({ inputRange: [0, 1], outputRange: [26, 0] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.48] });
  const driftY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-180, 260] });

  if (!item && !loading) {
    return (
      <Screen padded={false}>
        <EmptyState title="Inquiry not found" message="It may have been removed or you do not have access." icon="o" />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {managedViewActive ? (
          <ManagedViewBanner
            candidateName={managedCandidateName}
            subtitle="Inquiry details are scoped to the active managed candidate"
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
            <Text style={[styles.eyebrow, { fontFamily: t.typography.fontFamily.bold }]}>INQUIRY THREAD</Text>
            <Text style={[styles.pageTitle, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]}>Inquiry Details</Text>
            <Text style={[styles.pageSub, { fontFamily: t.typography.fontFamily.medium }]}>Review the original question and latest support updates in one thread view.</Text>
          </View>
          <View style={[styles.headerStatusChip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
            <Animated.View style={[styles.headerStatusDot, { backgroundColor: tone.text, opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
            <Text style={[styles.headerStatusText, { color: tone.text, fontFamily: t.typography.fontFamily.bold }]}>{statusLabel || (loading ? 'Loading...' : 'Pending')}</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.heroCard, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
          <View style={styles.heroGlowA} />
          <Animated.View style={[styles.heroGlowB, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
          <Animated.View style={[styles.heroSweep, { transform: [{ translateX: sweepX }, { rotate: '18deg' }] }]} />

          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Feather name="life-buoy" size={13} color="#1768B8" />
              <Text style={[styles.heroBadgeText, { fontFamily: t.typography.fontFamily.bold }]}>Support lane</Text>
            </View>
            <Badge text={item?.status || (loading ? 'Loading...' : 'Open')} />
          </View>

          <View style={[styles.heroMain, compact && styles.heroMainCompact]}>
            <View style={styles.heroCopyBlock}>
              <Text style={[styles.heroTitle, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={2}>
                {item?.subject || item?.category || 'Inquiry'}
              </Text>
              <Text style={[styles.heroMeta, { fontFamily: t.typography.fontFamily.medium }]}>
                {loading ? 'Loading details...' : `Created ${formatDate(item?.createdAt) || 'recently'}`}
              </Text>
              <Text style={[styles.heroBody, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={4}>
                {item?.message || 'No message provided.'}
              </Text>
            </View>

            <Animated.View style={[styles.heroVisual, { transform: [{ translateY: driftY }] }]}>
              <View style={styles.heroVisualPanel}>
                <View style={styles.heroBubblePrimary}>
                  <Feather name="send" size={12} color="#1768B8" />
                  <Text style={[styles.heroBubblePrimaryText, { fontFamily: t.typography.fontFamily.bold }]}>Inquiry sent</Text>
                </View>
                <View style={styles.heroBubbleSecondary}>
                  <Text style={[styles.heroBubbleSecondaryText, { fontFamily: t.typography.fontFamily.medium }]}>
                    {displayedReplies.length ? `${displayedReplies.length} support update${displayedReplies.length > 1 ? 's' : ''}` : 'Waiting for support'}
                  </Text>
                </View>
                <View style={styles.heroTimeline}>
                  <View style={[styles.heroTimelineBar, styles.heroTimelineBarWide]} />
                  <View style={[styles.heroTimelineBar, styles.heroTimelineBarMid]} />
                  <View style={[styles.heroTimelineBar, styles.heroTimelineBarShort]} />
                </View>
                <View style={styles.heroFooterChip}>
                  <Feather name="corner-down-right" size={12} color="#118D4C" />
                  <Text style={[styles.heroFooterChipText, { fontFamily: t.typography.fontFamily.bold }]}>Thread tracked</Text>
                </View>
              </View>
            </Animated.View>
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: sectionsEntrance, transform: [{ translateY: sectionY }] }}>
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>ORIGINAL MESSAGE</Text>
              <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Your Inquiry</Text>
            </View>
              <View style={styles.sectionMetaChip}>
                <Feather name="calendar" size={12} color="#1D5FD2" />
                <Text style={[styles.sectionMetaText, { fontFamily: t.typography.fontFamily.bold }]}>{formatDate(item?.createdAt) || '-'}</Text>
              </View>
            </View>

            <View style={styles.messageCard}>
              <View style={styles.messageIcon}>
                <Feather name="help-circle" size={18} color="#1D5FD2" />
              </View>
              <View style={styles.messageCopy}>
                <Text style={[styles.messageLabel, { fontFamily: t.typography.fontFamily.bold }]}>Question</Text>
                <Text style={[styles.messageBody, { fontFamily: t.typography.fontFamily.medium }]}>{item?.message || ''}</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>TICKET SUMMARY</Text>
                <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Reference</Text>
              </View>
              <View style={[styles.sectionMetaChip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                <Feather name="tag" size={12} color={tone.text} />
                <Text style={[styles.sectionMetaText, { color: tone.text, fontFamily: t.typography.fontFamily.bold }]}>{statusLabel}</Text>
              </View>
            </View>

            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryLabel, { fontFamily: t.typography.fontFamily.bold }]}>Email</Text>
                <Text style={[styles.summaryValue, { fontFamily: t.typography.fontFamily.medium }]}>{(item as any)?.email || '-'}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryLabel, { fontFamily: t.typography.fontFamily.bold }]}>Submitted</Text>
                <Text style={[styles.summaryValue, { fontFamily: t.typography.fontFamily.medium }]}>{formatDate(item?.createdAt) || '-'}</Text>
              </View>
            </View>

            {(item as any)?.job ? (
              <View style={styles.jobSummaryCard}>
                <View style={styles.jobSummaryIcon}>
                  <Feather name="briefcase" size={15} color="#1D5FD2" />
                </View>
                <View style={styles.jobSummaryCopy}>
                  <Text style={[styles.jobSummaryTitle, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                    {String((item as any)?.job?.title || 'Job reference')}
                  </Text>
                  <Text style={[styles.jobSummaryMeta, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                    {String((item as any)?.job?.company || '').trim() || 'Company'}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>SUPPORT REPLIES</Text>
                <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Thread Updates</Text>
              </View>
              <View style={styles.sectionMetaChip}>
                <Feather name="message-circle" size={12} color="#1D5FD2" />
                <Text style={[styles.sectionMetaText, { fontFamily: t.typography.fontFamily.bold }]}>{displayedReplies.length}</Text>
              </View>
            </View>

            {displayedReplies.length ? (
              displayedReplies.map((r, idx) => (
                <View key={idx} style={styles.replyCard}>
                  <View style={styles.replyHeader}>
                    <View style={styles.replyAvatar}>
                      <Feather name="shield" size={14} color="#1D5FD2" />
                    </View>
                    <View style={styles.replyCopy}>
                      <Text style={[styles.replyBy, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]}>{r.by || 'Support'}</Text>
                      <Text style={[styles.replyTime, { fontFamily: t.typography.fontFamily.medium }]}>{r.createdAt ? formatDate(r.createdAt) : ''}</Text>
                    </View>
                  </View>
                  <Text style={[styles.replyMsg, { color: t.colors.text, fontFamily: t.typography.fontFamily.medium }]}>{r.message}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyReplyState}>
                <Feather name="clock" size={18} color="#7A8FB6" />
                <Text style={[styles.emptyReplyText, { fontFamily: t.typography.fontFamily.medium }]}>No replies yet.</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 130 },
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
  pageTitle: { marginTop: 3, fontSize: 20, lineHeight: 24, fontWeight: '900' },
  pageSub: { marginTop: 4, color: '#5E6F95', fontWeight: '700', fontSize: 10, lineHeight: 15 },
  headerStatusChip: {
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  headerStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerStatusText: { fontSize: 10, lineHeight: 13, fontWeight: '800' },
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
  heroMain: { marginTop: 16, flexDirection: 'row', gap: 14 },
  heroMainCompact: { gap: 10 },
  heroCopyBlock: { flex: 1 },
  heroTitle: { color: '#153375', fontSize: 21, lineHeight: 25, fontWeight: '900', maxWidth: 228 },
  heroMeta: { marginTop: 6, color: '#5E7198', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  heroBody: { marginTop: 8, color: '#5D7096', fontSize: 11, lineHeight: 16, fontWeight: '700', maxWidth: 236 },
  heroVisual: {
    width: 154,
    alignItems: 'stretch',
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
  sectionCard: {
    borderRadius: 22,
    backgroundColor: 'rgba(249,251,255,0.96)',
    borderWidth: 1,
    borderColor: '#D6E0F3',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#5373AA',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  sectionEyebrow: {
    color: '#7485A8',
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 1.9,
    fontWeight: '900',
  },
  sectionTitle: { marginTop: 3, color: '#153375', fontSize: 15, lineHeight: 18, fontWeight: '900' },
  sectionMetaChip: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#D5E0F4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionMetaText: { color: '#1D5FD2', fontSize: 9, lineHeight: 11, fontWeight: '800' },
  summaryGrid: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  summaryCard: { flex: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#F7FAFF', borderWidth: 1, borderColor: '#DDE7F6' },
  summaryLabel: { color: '#1D5FD2', fontSize: 10, lineHeight: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  summaryValue: { marginTop: 6, color: '#4B6188', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  jobSummaryCard: { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#F7FAFF', borderWidth: 1, borderColor: '#DDE7F6', flexDirection: 'row', alignItems: 'center', gap: 10 },
  jobSummaryIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF2FF' },
  jobSummaryCopy: { flex: 1 },
  jobSummaryTitle: { color: '#163171', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  jobSummaryMeta: { marginTop: 3, color: '#6B7EA5', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  messageCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D7E2F4',
    backgroundColor: '#FFFFFF',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  messageIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageCopy: { flex: 1 },
  messageLabel: { color: '#173271', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  messageBody: { marginTop: 5, color: '#2F456F', fontSize: 11, lineHeight: 16, fontWeight: '600' },
  replyCard: {
    marginTop: Spacing.sm,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#F7FAFF',
    borderWidth: 1,
    borderColor: '#D5E0F4',
  },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  replyAvatar: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyCopy: { flex: 1 },
  replyBy: { fontWeight: '900', fontSize: 11, lineHeight: 14 },
  replyTime: { marginTop: 2, color: '#5C6E92', fontWeight: '700', fontSize: 9, lineHeight: 11 },
  replyMsg: { marginTop: 10, fontWeight: '700', lineHeight: 16, fontSize: 11 },
  emptyReplyState: {
    minHeight: 74,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D7E2F4',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyReplyText: {
    color: '#6E81A7',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
  },
});

