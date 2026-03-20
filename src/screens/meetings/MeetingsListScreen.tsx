import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MeetingsService, TasksService } from '../../api/services';
import ManagedViewBanner from '../../components/managed/ManagedViewBanner';
import { EmptyState, Screen, Skeleton } from '../../components/ui';
import { useAuthStore } from '../../context/authStore';
import type { Meeting } from '../../types/models';
import { getMeetingContactName, getMeetingDisplayDate, getMeetingDisplayTime, mergeMeetingsWithTaskMeetings } from '../../utils/meetingTasks';
import type { MeetingsStackParamList } from '../../navigation/app/AppNavigator';
import { useTheme } from '../../theme/ThemeProvider';
import { getManagedCandidateName, isManagedViewActive, stripManagedViewState } from '../../utils/managedView';

type Props = NativeStackScreenProps<MeetingsStackParamList, 'MeetingsList'>;

const isVirtualMeeting = (meeting: Meeting) =>
  ['Zoom', 'Google Meet', 'Microsoft Teams'].includes(String(meeting?.locationType || '').trim());

const isRemoteMeeting = (meeting: Meeting) => {
  const locationType = String(meeting?.locationType || '').trim();
  return !!locationType && locationType !== 'Physical';
};

const toneForStatus = (status?: string) => {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'completed') return { bg: '#D8F2E3', text: '#118D4C', chip: '#EAF8F0' };
  if (value === 'scheduled') return { bg: '#DFEBFF', text: '#1D5FD2', chip: '#EEF4FF' };
  if (value === 'canceled' || value === 'cancelled') return { bg: '#FDE1E1', text: '#D12B2B', chip: '#FFF1F1' };
  return { bg: '#E8EDF8', text: '#4E628E', chip: '#F2F5FB' };
};

const locationIcon = (locationType?: string): keyof typeof Feather.glyphMap => {
  const normalized = String(locationType || '').trim();
  if (normalized === 'Physical') return 'map-pin';
  if (['Zoom', 'Google Meet', 'Microsoft Teams'].includes(normalized)) return 'video';
  return 'phone';
};

const meetingTypeOptions = ['Zoom', 'Google Meet', 'Microsoft Teams', 'Phone', 'Physical'] as const;
const meetingStatusOptions = ['Scheduled', 'Completed', 'Canceled'] as const;

const getManagedCandidateId = (user: any) =>
  String(user?.managedCandidate?._id || user?.managedCandidateId || user?.selectedManagedCandidateId || user?.managedCandidate?._id || '').trim();

export default function MeetingsListScreen({ navigation }: Props) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const signIn = useAuthStore((s) => s.signIn);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const managedCandidateId = useMemo(() => getManagedCandidateId(user), [user]);
  const managedViewActive = useMemo(() => isManagedViewActive(user), [user]);
  const managedCandidateName = useMemo(() => getManagedCandidateName(user), [user]);
  const heroEntrance = useRef(new Animated.Value(0)).current;
  const listEntrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  const load = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setErrorMessage(null);
    try {
      const [meetingsRes, tasksRes] = await Promise.allSettled([
        MeetingsService.list(managedCandidateId ? { managedCandidateId } : undefined),
        TasksService.list(managedCandidateId ? { managedCandidateId } : undefined),
      ]);
      const meetingsList = meetingsRes.status === 'fulfilled' && Array.isArray(meetingsRes.value) ? meetingsRes.value : [];
      const tasksList = tasksRes.status === 'fulfilled' && Array.isArray(tasksRes.value) ? tasksRes.value : [];
      const mergedMeetings = mergeMeetingsWithTaskMeetings(meetingsList, tasksList);
      setMeetings(mergedMeetings);

      if (meetingsRes.status === 'rejected' && tasksRes.status === 'rejected') {
        const msg = String((meetingsRes.reason as any)?.userMessage || (meetingsRes.reason as any)?.message || 'Unable to load meetings');
        setErrorMessage(msg);
      }
    } catch (err: any) {
      const msg = String(err?.userMessage || err?.message || 'Unable to load meetings');
      setErrorMessage(msg);
      setMeetings([]);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managedCandidateId]);

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
  }, [drift, heroEntrance, listEntrance, pulse, sweep]);

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

  const stats = useMemo(() => {
    const scheduled = meetings.filter((meeting) => String(meeting?.status || '').toLowerCase() === 'scheduled').length;
    const completed = meetings.filter((meeting) => String(meeting?.status || '').toLowerCase() === 'completed').length;
    const remote = meetings.filter((meeting) => isRemoteMeeting(meeting)).length;
    return [
      { key: 'total', label: 'Total', value: meetings.length, color: '#1D5FD2', bg: '#E8F1FF', icon: 'calendar' as const },
      { key: 'scheduled', label: 'Scheduled', value: scheduled, color: '#CB6A10', bg: '#FFF1E0', icon: 'clock' as const },
      { key: 'completed', label: 'Completed', value: completed, color: '#118D4C', bg: '#E2F6EA', icon: 'check-circle' as const },
      { key: 'remote', label: 'Remote', value: remote, color: '#6A35D5', bg: '#EFE6FF', icon: 'video' as const },
    ];
  }, [meetings]);

  const supportedTypeCounts = useMemo(
    () =>
      meetingTypeOptions.map((label) => ({
        label,
        count: meetings.filter((meeting) => String(meeting?.locationType || '').trim() === label).length,
        icon: locationIcon(label),
      })),
    [meetings]
  );

  const supportedStatusCounts = useMemo(
    () =>
      meetingStatusOptions.map((label) => ({
        label,
        count: meetings.filter((meeting) => {
          const status = String(meeting?.status || '').trim().toLowerCase();
          if (label === 'Canceled') return status === 'canceled' || status === 'cancelled';
          return status === label.toLowerCase();
        }).length,
        tone: toneForStatus(label),
      })),
    [meetings]
  );

  const heroY = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.48] });
  const driftY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-180, 260] });

  return (
    <Screen padded={false}>
      <FlatList
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        data={meetings}
        keyExtractor={(item, index) => String(item?._id || `${item?.title || 'meeting'}-${index}`)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load({ silent: true });
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            {managedViewActive ? (
              <ManagedViewBanner
                candidateName={managedCandidateName}
                subtitle="Meetings are loaded for the active managed candidate"
                onExit={exitManagedView}
              />
            ) : null}
            <Animated.View style={[styles.headerRow, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
              <Pressable onPress={handleBack} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
                <Feather name="arrow-left" size={18} color="#1B3890" />
              </Pressable>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.eyebrow, { fontFamily: t.typography.fontFamily.bold }]}>AGENDA DESK</Text>
                <Text style={[styles.heading, { color: '#1B3890', fontFamily: t.typography.fontFamily.bold }]}>My Meetings</Text>
                <Text style={[styles.subheading, { fontFamily: t.typography.fontFamily.medium }]}>Review upcoming sessions, revisit past meetings, and jump into virtual calls from one schedule board.</Text>
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
                  <Feather name="columns" size={13} color="#1768B8" />
                  <Text style={[styles.heroBadgeText, { fontFamily: t.typography.fontFamily.bold }]}>Schedule lane</Text>
                </View>
                <View style={styles.heroSignal}>
                  <Feather name="radio" size={13} color="#118D4C" />
                  <Text style={[styles.heroSignalText, { fontFamily: t.typography.fontFamily.bold }]}>Join ready</Text>
                </View>
              </View>

              <View style={[styles.heroMain, compact && styles.heroMainCompact]}>
                <View style={styles.heroCopyBlock}>
                  <Text style={[styles.heroTitle, { fontFamily: t.typography.fontFamily.bold }]}>Keep every session aligned with time, place, and next step.</Text>
                  <Text style={[styles.heroBody, { fontFamily: t.typography.fontFamily.medium }]}>
                    {meetings.length
                      ? `${stats[1].value} sessions are scheduled right now. Review the agenda and open the meeting card when it is time to act.`
                      : 'Your meeting board is empty right now. New sessions will appear here automatically.'}
                  </Text>
                  <View style={styles.heroInsightRow}>
                    <View style={[styles.heroInsightChip, styles.heroInsightChipBlue]}>
                      <Feather name="zap" size={12} color="#1768B8" />
                      <Text style={[styles.heroInsightText, { color: '#1768B8', fontFamily: t.typography.fontFamily.bold }]}>
                        {stats[1].value} ready
                      </Text>
                    </View>
                    <View style={[styles.heroInsightChip, styles.heroInsightChipMint]}>
                      <Feather name="video" size={12} color="#118D4C" />
                      <Text style={[styles.heroInsightText, { color: '#118D4C', fontFamily: t.typography.fontFamily.bold }]}>
                        {stats[3].value} remote
                      </Text>
                    </View>
                    <View style={[styles.heroInsightChip, styles.heroInsightChipLavender]}>
                      <Feather name="check-circle" size={12} color="#6A35D5" />
                      <Text style={[styles.heroInsightText, { color: '#6A35D5', fontFamily: t.typography.fontFamily.bold }]}>
                        {stats[2].value} done
                      </Text>
                    </View>
                  </View>
                  <View style={styles.heroStatsRow}>
                    {stats.slice(0, 3).map((stat) => (
                      <View key={stat.key} style={styles.heroStatCard}>
                        <View style={[styles.heroStatIcon, { backgroundColor: stat.bg }]}>
                          <Feather name={stat.icon} size={14} color={stat.color} />
                        </View>
                        <Text style={[styles.heroStatValue, { color: stat.color, fontFamily: t.typography.fontFamily.bold }]}>{String(stat.value)}</Text>
                        <Text style={[styles.heroStatLabel, { fontFamily: t.typography.fontFamily.medium }]}>{stat.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <Animated.View style={[styles.heroVisual, { transform: [{ translateY: driftY }] }]}>
                  <View style={styles.heroVisualPanel}>
                    <View style={styles.heroVisualSheetBack} />
                    <View style={styles.heroVisualSheetMid} />
                    <View style={styles.heroTrack}>
                      <View style={styles.heroTrackLine} />
                      <Animated.View style={[styles.heroTrackDot, { opacity: pulseOpacity, transform: [{ translateY: driftY }, { scale: pulseScale }] }]} />
                      <View style={[styles.heroTrackNode, styles.heroTrackNodeOne]} />
                      <View style={[styles.heroTrackNode, styles.heroTrackNodeTwo]} />
                      <View style={[styles.heroTrackNode, styles.heroTrackNodeThree]} />
                    </View>
                    <View style={styles.heroVisualCard}>
                      <Text style={[styles.heroVisualTitle, { fontFamily: t.typography.fontFamily.bold }]}>Meeting flow</Text>
                      <Text style={[styles.heroVisualBody, { fontFamily: t.typography.fontFamily.medium }]}>Prep, join, follow up.</Text>
                      <View style={styles.heroWaveRow}>
                        <Animated.View style={[styles.heroWaveBar, styles.heroWaveBarShort, { opacity: pulseOpacity, transform: [{ scaleX: pulseScale }] }]} />
                        <Animated.View style={[styles.heroWaveBar, styles.heroWaveBarLong, { opacity: pulseOpacity, transform: [{ scaleX: pulseScale }] }]} />
                        <Animated.View style={[styles.heroWaveBar, styles.heroWaveBarMid, { opacity: pulseOpacity, transform: [{ scaleX: pulseScale }] }]} />
                      </View>
                    </View>
                    <View style={styles.heroVisualFooter}>
                      <Feather name="video" size={12} color="#6A35D5" />
                      <Text style={[styles.heroVisualFooterText, { fontFamily: t.typography.fontFamily.bold }]}>{stats[3].value} remote</Text>
                    </View>
                  </View>
                </Animated.View>
              </View>
            </Animated.View>

            <Animated.View style={[styles.sectionHeader, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
              <Text style={[styles.sectionTitle, { color: '#1B3890', fontFamily: t.typography.fontFamily.bold }]}>Upcoming and Past Meetings</Text>
              <Text style={[styles.sectionCount, { fontFamily: t.typography.fontFamily.medium }]}>{`${meetings.length} total`}</Text>
            </Animated.View>

            <Animated.View style={[styles.matrixCard, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
              <View style={styles.matrixSection}>
                <Text style={[styles.matrixLabel, { fontFamily: t.typography.fontFamily.bold }]}>Meeting types</Text>
                <View style={styles.matrixChipWrap}>
                  {supportedTypeCounts.map((item) => (
                    <View key={item.label} style={styles.matrixChip}>
                      <View style={styles.matrixChipIcon}>
                        <Feather name={item.icon} size={12} color="#1768B8" />
                      </View>
                      <Text style={[styles.matrixChipText, { fontFamily: t.typography.fontFamily.bold }]}>{item.label}</Text>
                      <Text style={[styles.matrixChipCount, { fontFamily: t.typography.fontFamily.bold }]}>{item.count}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.matrixDivider} />

              <View style={styles.matrixSection}>
                <Text style={[styles.matrixLabel, { fontFamily: t.typography.fontFamily.bold }]}>Statuses</Text>
                <View style={styles.matrixChipWrap}>
                  {supportedStatusCounts.map((item) => (
                    <View key={item.label} style={[styles.matrixChip, { backgroundColor: item.tone.chip }]}>
                      <View style={[styles.matrixStatusDot, { backgroundColor: item.tone.text }]} />
                      <Text style={[styles.matrixChipText, { color: item.tone.text, fontFamily: t.typography.fontFamily.bold }]}>{item.label}</Text>
                      <Text style={[styles.matrixChipCount, { color: item.tone.text, fontFamily: t.typography.fontFamily.bold }]}>{item.count}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: 10 }}>
              <Skeleton height={96} />
              <Skeleton height={96} />
            </View>
          ) : (
            <EmptyState
              icon="calendar"
              title={errorMessage ? 'Unable to load meetings' : 'No meetings scheduled'}
              message={errorMessage || "You don't have any meetings scheduled yet."}
            />
          )
        }
        renderItem={({ item, index }) => {
          const tone = toneForStatus(item?.status);
          const cardY = listEntrance.interpolate({ inputRange: [0, 1], outputRange: [20 + Math.min(index, 4) * 8, 0] });
          const contactName = getMeetingContactName(item);
          const subtitle = [contactName, item?.locationType].filter(Boolean).join(' • ') || 'Meeting';
          const meetingDate = getMeetingDisplayDate(item);
          const meetingTime = getMeetingDisplayTime(item);

          return (
            <Animated.View style={{ opacity: listEntrance, transform: [{ translateY: cardY }] }}>
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => navigation.navigate('MeetingDetails', { meetingId: String(item?._id), meeting: item })}
              >
                <LinearGradient colors={['rgba(25, 98, 182, 0.08)', 'rgba(255,255,255,0.02)']} style={styles.cardTint} />
                <Animated.View pointerEvents="none" style={[styles.cardSweep, { transform: [{ translateX: sweepX }, { rotate: '18deg' }] }]} />

                <View style={styles.cardTop}>
                  <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 1 }} style={styles.iconWrap}>
                    <Feather name={locationIcon(item?.locationType)} size={17} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={styles.cardTextWrap}>
                    <Text style={[styles.cardTitle, { color: '#142E76', fontFamily: t.typography.fontFamily.bold }]} numberOfLines={2}>
                      {item?.title || 'Meeting'}
                    </Text>
                    <Text style={[styles.cardType, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{subtitle}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.statusText, { color: tone.text, fontFamily: t.typography.fontFamily.bold }]}>{item?.status || 'Scheduled'}</Text>
                  </View>
                </View>

                <View style={styles.cardSignalRow}>
                  <View style={[styles.cardSignalChip, { backgroundColor: tone.chip }]}>
                    <Animated.View
                      style={[
                        styles.cardSignalDot,
                        { backgroundColor: tone.text, opacity: pulseOpacity, transform: [{ scale: isVirtualMeeting(item) ? pulseScale : 1 }] },
                      ]}
                    />
                    <Text style={[styles.cardSignalText, { color: tone.text, fontFamily: t.typography.fontFamily.bold }]}>
                      {isVirtualMeeting(item) ? 'Virtual session' : item?.locationType === 'Physical' ? 'On-site session' : 'Call session'}
                    </Text>
                  </View>
                  <Text style={[styles.cardSignalHint, { fontFamily: t.typography.fontFamily.medium }]}>
                    {isVirtualMeeting(item) && item?.link ? 'Join link ready' : 'Agenda ready'}
                  </Text>
                </View>

                <View style={styles.metaGrid}>
                  <View style={[styles.metaBox, styles.metaBoxBlue]}>
                    <Feather name="calendar" size={14} color="#1D5FD2" />
                    <Text style={[styles.metaText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                      {meetingDate}
                    </Text>
                  </View>
                  <View style={[styles.metaBox, styles.metaBoxLavender]}>
                    <Feather name="clock" size={14} color="#7A3ED4" />
                    <Text style={[styles.metaText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                      {meetingTime}
                    </Text>
                  </View>
                </View>

                {item?.locationType === 'Physical' && item?.location ? (
                  <View style={styles.locationRow}>
                    <Feather name="map-pin" size={14} color="#179A58" />
                    <Text style={[styles.locationText, { fontFamily: t.typography.fontFamily.medium }]}>{item.location}</Text>
                  </View>
                ) : null}

                <View style={styles.actionRow}>
                  <Pressable
                    style={({ pressed }) => [styles.detailsBtn, pressed && styles.pressed]}
                    onPress={() => navigation.navigate('MeetingDetails', { meetingId: String(item?._id), meeting: item })}
                  >
                    <Feather name="eye" size={15} color="#1E70C8" />
                    <Text style={[styles.detailsBtnText, { fontFamily: t.typography.fontFamily.bold }]}>View details</Text>
                  </Pressable>

                  {isVirtualMeeting(item) && item?.link ? (
                    <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
                      <Pressable
                      style={({ pressed }) => [styles.joinBtnWrap, pressed && styles.pressed]}
                      onPress={() => Linking.openURL(String(item.link)).catch(() => {})}
                      >
                        <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.joinBtn}>
                          <Feather name="external-link" size={15} color="#FFFFFF" />
                          <Text style={[styles.joinBtnText, { fontFamily: t.typography.fontFamily.bold }]}>Join now</Text>
                        </LinearGradient>
                      </Pressable>
                    </Animated.View>
                  ) : null}
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
  content: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 130,
    flexGrow: 1,
  },
  headerWrap: { marginBottom: 8 },
  pressed: { opacity: 0.92 },
  headerRow: {
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
    borderColor: '#D1DEF3',
  },
  headerTextWrap: { flex: 1 },
  eyebrow: {
    color: '#7485A8',
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 2.1,
    fontWeight: '900',
  },
  heading: {
    marginTop: 3,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
  },
  subheading: {
    marginTop: 4,
    color: '#697B9E',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
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
  heroTitle: { color: '#153375', fontSize: 22, lineHeight: 27, fontWeight: '900', maxWidth: 228 },
  heroBody: { marginTop: 8, color: '#5D7096', fontSize: 11, lineHeight: 17, fontWeight: '700', maxWidth: 236 },
  heroInsightRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroInsightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  heroInsightChipBlue: {
    backgroundColor: '#EFF5FF',
    borderColor: '#D7E4F8',
  },
  heroInsightChipMint: {
    backgroundColor: '#ECFAF3',
    borderColor: '#D4EEDD',
  },
  heroInsightChipLavender: {
    backgroundColor: '#F2ECFF',
    borderColor: '#E5D9FA',
  },
  heroInsightText: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
  },
  heroStatsRow: { marginTop: 14, flexDirection: 'row', gap: 9 },
  heroStatCard: {
    flex: 1,
    minHeight: 78,
    minWidth: 84,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7E2F4',
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  heroStatIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatValue: {
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  heroStatLabel: {
    color: '#657B9E',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroVisual: {
    width: 154,
    height: 238,
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
  heroVisualSheetBack: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 76,
    height: 96,
    borderRadius: 20,
    backgroundColor: '#EFF4FF',
    borderWidth: 1,
    borderColor: '#D9E3F7',
    transform: [{ rotate: '10deg' }],
  },
  heroVisualSheetMid: {
    position: 'absolute',
    top: 18,
    right: 4,
    width: 84,
    height: 108,
    borderRadius: 22,
    backgroundColor: '#F6F9FF',
    borderWidth: 1,
    borderColor: '#DCE5F6',
    transform: [{ rotate: '5deg' }],
  },
  heroTrack: {
    height: 82,
    justifyContent: 'center',
    position: 'relative',
  },
  heroTrackLine: {
    position: 'absolute',
    left: 18,
    right: 18,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#D9E4F6',
  },
  heroTrackDot: {
    position: 'absolute',
    left: 58,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1FCB7A',
    borderWidth: 3,
    borderColor: '#E8FFF4',
  },
  heroTrackNode: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#C8D8F1',
  },
  heroTrackNodeOne: { left: 14 },
  heroTrackNodeTwo: { left: '48%' },
  heroTrackNodeThree: { right: 14 },
  heroVisualCard: {
    marginTop: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D8E2F3',
    backgroundColor: '#F7FAFF',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  heroVisualTitle: { color: '#173271', fontSize: 12, lineHeight: 15, fontWeight: '900' },
  heroVisualBody: { marginTop: 3, color: '#697CA5', fontSize: 9, lineHeight: 12, fontWeight: '700' },
  heroWaveRow: {
    marginTop: 9,
    gap: 6,
  },
  heroWaveBar: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#D8E3F6',
  },
  heroWaveBarShort: { width: 52 },
  heroWaveBarMid: { width: 74 },
  heroWaveBarLong: { width: 92 },
  heroVisualFooter: {
    marginTop: 10,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F2F7FF',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroVisualFooterText: { color: '#6A35D5', fontSize: 9, lineHeight: 11, fontWeight: '800' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '800',
  },
  sectionCount: {
    marginLeft: 8,
    color: '#6A7CA2',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
  },
  matrixCard: {
    marginBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D8E2F4',
    backgroundColor: 'rgba(250,252,255,0.96)',
    padding: 12,
    gap: 10,
  },
  matrixSection: {
    gap: 8,
  },
  matrixLabel: {
    color: '#667DA7',
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.2,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  matrixChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  matrixChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D7E2F4',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  matrixChipIcon: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#EEF5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matrixStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  matrixChipText: {
    color: '#1C4E8F',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  matrixChipCount: {
    minWidth: 18,
    color: '#4B678F',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  matrixDivider: {
    height: 1,
    backgroundColor: '#E4EBF7',
  },
  card: {
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
  cardPressed: {
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
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardSignalRow: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardSignalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cardSignalDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  cardSignalText: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
  },
  cardSignalHint: {
    color: '#7A89A8',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '700',
  },
  cardTextWrap: { flex: 1 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  cardType: {
    marginTop: 4,
    color: '#5B6F97',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  statusPill: {
    marginLeft: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metaBox: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaBoxBlue: {
    backgroundColor: '#EEF4FE',
    borderColor: '#D3DDF4',
  },
  metaBoxLavender: {
    backgroundColor: '#F2ECFF',
    borderColor: '#E2D7FA',
  },
  metaText: {
    flex: 1,
    marginLeft: 6,
    color: '#27457B',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
  },
  locationRow: {
    marginTop: 8,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#E8F7EE',
    borderWidth: 1,
    borderColor: '#CFE9DA',
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    flex: 1,
    marginLeft: 6,
    color: '#1F6C49',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  detailsBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#5EA1E4',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  detailsBtnText: {
    color: '#1F73CA',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  joinBtnWrap: {
    minWidth: 118,
    borderRadius: 11,
    overflow: 'hidden',
  },
  joinBtn: {
    minHeight: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
  },
  joinBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
});


