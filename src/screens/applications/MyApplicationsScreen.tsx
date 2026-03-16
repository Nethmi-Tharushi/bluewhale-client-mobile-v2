import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Pressable, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { EmptyState, Screen } from '../../components/ui';
import { ApplicationsService } from '../../api/services';
import type { Application, Job } from '../../types/models';
import { formatDate } from '../../utils/format';
import { useTheme } from '../../theme/ThemeProvider';
import { getSavedJobs, setSavedJobs as persistSavedJobs } from '../../utils/savedJobsStorage';
import { useAuthStore } from '../../context/authStore';

const pick = (obj: any, keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = obj?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
};

const pickPath = (obj: any, path: string) => {
  if (!path.includes('.')) return obj?.[path];
  return path.split('.').reduce((acc: any, part: string) => acc?.[part], obj);
};

const pickAny = (obj: any, keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = pickPath(obj, key);
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const getExpiryMeta = (job: any) => {
  const raw = pickAny(
    job,
    [
      'expiringAt',
      'expiring_at',
      'expiringDate',
      'expiresAt',
      'expires_at',
      'expiryDate',
      'expiry_date',
      'expireAt',
      'expireDate',
      'expiresOn',
      'expiry',
      'closingDate',
      'closing_date',
      'closeDate',
      'applicationDeadline',
      'deadline',
      'deadlineDate',
      'endDate',
      'end_date',
      'lastDate',
      'validTill',
      'validUntil',
      'availability.endDate',
      'meta.expiresAt',
      'meta.expiryDate',
      'details.expiryDate',
    ],
    '',
  );

  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);

  const daysRemaining = Math.ceil((parsed.getTime() - today.getTime()) / DAY_MS);
  return {
    date: parsed,
    formatted: formatDate(parsed.toISOString()),
    daysRemaining,
    isSoon: daysRemaining >= 0 && daysRemaining <= 3,
  };
};

const getStatusTone = (value: string) => {
  const status = value.toLowerCase();
  if (status.includes('accept') || status.includes('approved') || status.includes('shortlist')) return { bg: '#F3FBF6', border: '#CFE9D9', text: '#14804A' };
  if (status.includes('reject') || status.includes('declin')) return { bg: '#FFF4F6', border: '#F4D7DD', text: '#C53754' };
  if (status.includes('review') || status.includes('screen')) return { bg: '#FFF9EF', border: '#F3E4C4', text: '#A86B12' };
  return { bg: '#F4F8FF', border: '#D8E3F5', text: '#1F5FB7' };
};

export default function MyApplicationsScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const { width } = useWindowDimensions();

  const [tab, setTab] = useState<'applied' | 'saved'>('applied');
  const [items, setItems] = useState<Application[]>([]);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const userId = String((user as any)?._id || (user as any)?.id || (user as any)?.email || (user as any)?.phone || token || '').trim() || 'guest';
  const tabWidth = Math.max(120, Math.floor((width - 44) / 2));

  const heroEntrance = useRef(new Animated.Value(0)).current;
  const cardsEntrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const tabShift = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setLoading(true);
    let applied: Application[] = [];
    let saved: Job[] = [];

    try {
      const res = await ApplicationsService.my();
      const raw = res as any;
      applied = Array.isArray(raw) ? raw : raw?.applications || raw?.items || raw?.rows || raw?.data || [];
      if (!Array.isArray(applied)) applied = [];
    } catch {
      applied = [];
    }

    try {
      const res = await getSavedJobs(userId);
      saved = Array.isArray(res) ? res : [];
    } catch {
      saved = [];
    }

    setItems(applied);
    setSavedJobs(saved);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroEntrance, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(cardsEntrance, { toValue: 1, duration: 760, delay: 110, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    const loops = [
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 2200, delay: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])),
    ];

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [cardsEntrance, float, heroEntrance, pulse, sweep]);

  useEffect(() => {
    Animated.spring(tabShift, {
      toValue: tab === 'saved' ? tabWidth : 0,
      stiffness: 180,
      damping: 20,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [tab, tabShift, tabWidth]);

  const listData = tab === 'applied' ? items : savedJobs;
  const appliedCount = items.length;
  const savedCount = savedJobs.length;
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.52] });
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-180, 250] });
  const heroY = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  const headerCards = useMemo(
    () => [
      { label: 'Applied', value: String(appliedCount), tone: '#1A66B8', icon: 'file-text' as const, iconBg: '#EAF2FF' },
      { label: 'Saved', value: String(savedCount), tone: '#138E79', icon: 'bookmark' as const, iconBg: '#EAF8F4' },
      { label: tab === 'applied' ? 'Focus' : 'Next', value: tab === 'applied' ? 'Status' : 'Apply', tone: '#C97C18', icon: 'activity' as const, iconBg: '#FFF4E4' },
    ],
    [appliedCount, savedCount, tab]
  );
  const appliedJobIds = useMemo(
    () =>
      new Set(
        items
          .map((application: any) => application?.job?._id || application?.job?.id || application?.jobId || application?.job)
          .map((value: any) => String(value || '').trim())
          .filter(Boolean)
      ),
    [items]
  );

  const openJobDetails = (jobId: string) => navigation.navigate('Home', { screen: 'JobDetails', params: { jobId } });
  const openApply = (jobId: string) => navigation.navigate('Home', { screen: 'ApplyJob', params: { jobId } });
  const removeSavedJob = useCallback(
    async (jobId: string) => {
      const normalizedId = String(jobId || '').trim();
      if (!normalizedId) return;

      const nextSavedJobs = savedJobs.filter((savedJob: any) => String(savedJob?._id || savedJob?.id || '').trim() !== normalizedId);
      setSavedJobs(nextSavedJobs);
      await persistSavedJobs(userId, nextSavedJobs);
    },
    [savedJobs, userId]
  );

  return (
    <Screen padded={false}>
      <FlatList
        data={listData}
        keyExtractor={(it: any, index) => String(it?._id || it?.id || it?.job?._id || it?.jobId || `application-${index}`)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, !listData.length && styles.contentEmpty]}
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
              <Pressable onPress={() => navigation.canGoBack() && navigation.goBack()} style={({ pressed }) => [styles.backBtn, !navigation.canGoBack() && styles.hidden, pressed && styles.pressed]} disabled={!navigation.canGoBack()}>
                <Feather name="arrow-left" size={18} color="#173E91" />
              </Pressable>
              <View style={styles.topCopy}>
                <Text style={[styles.topEyebrow, { color: t.colors.textMuted, fontFamily: t.typography.fontFamily.bold }]}>Candidate workspace</Text>
                <Text style={[styles.topTitle, { fontFamily: t.typography.fontFamily.bold }]}>My applications</Text>
              </View>
              <View style={styles.liveChip}>
                <Animated.View style={[styles.liveDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                <Text style={[styles.liveText, { fontFamily: t.typography.fontFamily.bold }]}>{tab === 'applied' ? 'Tracking' : 'Saved'}</Text>
              </View>
            </Animated.View>

            <Animated.View style={[styles.heroCard, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
              <View style={styles.heroGlow} />
              <Animated.View style={[styles.heroPulse, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
              <Animated.View style={[styles.heroSweep, { transform: [{ translateX: sweepX }, { rotate: '18deg' }] }]} />

              <View style={styles.heroHeaderRow}>
                <View style={styles.heroPill}>
                  <Feather name="activity" size={13} color="#1766B5" />
                  <Text style={[styles.heroPillText, { fontFamily: t.typography.fontFamily.bold }]}>Activity board</Text>
                </View>
                <View style={styles.heroSignal}>
                  <View style={styles.heroSignalDot} />
                  <Text style={[styles.heroSignalText, { fontFamily: t.typography.fontFamily.bold }]}>Live sync</Text>
                </View>
              </View>

              <View style={styles.heroMain}>
                <View style={styles.heroCopy}>
                  <Text style={[styles.heroTitle, { fontFamily: t.typography.fontFamily.bold }]}>{tab === 'applied' ? 'Application activity' : 'Saved shortlist'}</Text>
                  <Text style={[styles.heroBody, { fontFamily: t.typography.fontFamily.medium }]}>
                    {tab === 'applied'
                      ? 'Track status and revisit roles.'
                      : 'Keep strong roles ready to apply.'}
                  </Text>
                </View>

                <Animated.View style={[styles.heroVisual, { transform: [{ translateY: floatY }] }]}>
                  <View style={styles.heroVisualCard}>
                    <View style={styles.visualIcon}>
                      <Feather name={tab === 'applied' ? 'file-text' : 'bookmark'} size={18} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.visualTitle, { fontFamily: t.typography.fontFamily.bold }]}>{tab === 'applied' ? 'Status lane' : 'Priority stack'}</Text>
                    <Text style={[styles.visualBody, { fontFamily: t.typography.fontFamily.medium }]}>{tab === 'applied' ? 'Review and move.' : 'Inspect and apply.'}</Text>
                    <View style={styles.visualBars}>
                      <View style={[styles.visualBar, styles.visualBarWide]} />
                      <View style={[styles.visualBar, styles.visualBarActive]} />
                      <View style={[styles.visualBar, styles.visualBarShort]} />
                    </View>
                  </View>
                </Animated.View>
              </View>

              <View style={styles.statsRowWide}>
                {headerCards.map((item) => (
                  <View key={item.label} style={styles.statCardWide}>
                    <View style={[styles.statIconWide, { backgroundColor: item.iconBg }]}>
                      <Feather name={item.icon} size={12} color={item.tone} />
                    </View>
                    <Text style={[styles.statValueWide, { color: item.tone, fontFamily: t.typography.fontFamily.bold }]}>{item.value}</Text>
                    <Text style={[styles.statLabelWide, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={2}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            </Animated.View>

            <Animated.View style={[styles.tabRail, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
              <Animated.View style={[styles.tabActive, { width: tabWidth, transform: [{ translateX: tabShift }] }]} />
              <Pressable style={styles.tabBtn} onPress={() => setTab('applied')}>
                <View style={[styles.tabIcon, tab === 'applied' && styles.tabIconBlue]}>
                  <Feather name="file-text" size={15} color={tab === 'applied' ? '#FFFFFF' : '#2B6FBE'} />
                </View>
                <View style={styles.tabCopy}>
                  <Text style={[styles.tabTitle, tab === 'applied' && styles.tabTitleActive, { fontFamily: t.typography.fontFamily.bold }]}>Applied jobs</Text>
                  <Text style={[styles.tabCaption, { fontFamily: t.typography.fontFamily.medium }]}>{appliedCount} active records</Text>
                </View>
              </Pressable>
              <Pressable style={styles.tabBtn} onPress={() => setTab('saved')}>
                <View style={[styles.tabIcon, tab === 'saved' && styles.tabIconGreen]}>
                  <Feather name="bookmark" size={15} color={tab === 'saved' ? '#FFFFFF' : '#16967E'} />
                </View>
                <View style={styles.tabCopy}>
                  <Text style={[styles.tabTitle, tab === 'saved' && styles.tabTitleActive, { fontFamily: t.typography.fontFamily.bold }]}>Saved jobs</Text>
                  <Text style={[styles.tabCaption, { fontFamily: t.typography.fontFamily.medium }]}>{savedCount} ready to revisit</Text>
                </View>
              </Pressable>
            </Animated.View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="o"
              title={loading ? 'Loading...' : tab === 'applied' ? 'No applications yet' : 'No saved jobs yet'}
              message={loading ? 'Please wait' : tab === 'applied' ? 'Applied jobs show up here.' : 'Saved jobs show up here.'}
            />
          </View>
        }
        renderItem={({ item, index }: { item: any; index: number }) => {
          const itemY = cardsEntrance.interpolate({ inputRange: [0, 1], outputRange: [18 + Math.min(index, 4) * 8, 0] });

          if (tab === 'applied') {
            const job = item.job as any;
            const status = String(item?.status || 'Pending');
            const tone = getStatusTone(status);
            const roleTitle = pick(job, ['title', 'jobTitle', 'position'], 'Job application');
            const company = pick(job, ['company', 'companyName'], 'Company');
            const location = pick(job, ['location', 'city', 'jobLocation'], 'Location');
            const submittedAt = formatDate(item.createdAt) || 'recently';
            const jobId = String(job?._id || item?.jobId || item?.job || '').trim();

            return (
              <Animated.View style={{ opacity: cardsEntrance, transform: [{ translateY: itemY }] }}>
                <View style={styles.itemCard}>
                  <LinearGradient colors={['rgba(20, 86, 176, 0.08)', 'rgba(66, 194, 255, 0.02)']} style={styles.itemTint} />
                  <View style={styles.itemTop}>
                    <View style={styles.itemIconBlue}><Feather name="briefcase" size={18} color="#FFFFFF" /></View>
                    <View style={styles.itemText}>
                      <Text style={[styles.itemTitle, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{roleTitle}</Text>
                      <Text style={[styles.itemSub, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{company}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                      <Text style={[styles.statusBadgeText, { color: tone.text, fontFamily: t.typography.fontFamily.bold }]}>{status}</Text>
                    </View>
                  </View>
                  <View style={styles.metaRow}>
                    <View style={[styles.metaChip, styles.metaBlue]}><Feather name="map-pin" size={14} color="#1D77C9" /><Text style={[styles.metaText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{location}</Text></View>
                    <View style={[styles.metaChip, styles.metaLavender]}><Feather name="clock" size={14} color="#8B50B8" /><Text style={[styles.metaText, styles.metaTextLavender, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{`Submitted ${submittedAt}`}</Text></View>
                  </View>
                  <View style={[styles.actionsRow, styles.actionsRowFlush]}>
                    <Pressable style={({ pressed }) => [styles.appliedDetailsAction, pressed && styles.pressed]} onPress={() => openJobDetails(jobId)}>
                      <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.appliedDetailsFill}>
                        <Animated.View pointerEvents="none" style={[styles.appliedDetailsSweep, { transform: [{ translateX: sweepX }, { rotate: '16deg' }] }]} />
                        <View style={styles.appliedDetailsIcon}>
                          <Feather name="file-text" size={16} color="#FFFFFF" />
                        </View>
                        <View style={styles.appliedDetailsCopy}>
                          <Text numberOfLines={1} style={[styles.appliedDetailsTitle, { fontFamily: t.typography.fontFamily.bold }]}>View details</Text>
                          <Text numberOfLines={1} style={[styles.appliedDetailsText, { fontFamily: t.typography.fontFamily.medium }]}>Open</Text>
                        </View>
                        <Animated.View style={{ opacity: pulseOpacity, transform: [{ scale: pulseScale }] }}>
                          <Feather name="arrow-right" size={16} color="#FFFFFF" />
                        </Animated.View>
                      </LinearGradient>
                    </Pressable>
                    <View style={styles.appliedStamp}>
                      <View style={styles.appliedStampIcon}>
                        <Feather name="check-circle" size={15} color="#14945B" />
                      </View>
                      <View style={styles.appliedStampCopy}>
                        <Text numberOfLines={1} style={[styles.appliedStampTitle, { fontFamily: t.typography.fontFamily.bold }]}>Applied</Text>
                        <Text numberOfLines={1} style={[styles.appliedStampText, { fontFamily: t.typography.fontFamily.medium }]}>Application sent</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </Animated.View>
            );
          }

          const roleTitle = pick(item, ['title', 'jobTitle', 'position'], 'Saved job');
          const company = pick(item, ['company', 'companyName'], 'Company');
          const location = pick(item, ['location', 'city', 'jobLocation'], 'Location');
          const jobType = pick(item, ['type', 'jobType', 'employmentType'], 'Type');
          const salary = pick(item, ['salary', 'salaryRange', 'salaryText'], 'N/A');
          const savedId = String(item?._id || item?.id || '').trim();
          const isApplied = appliedJobIds.has(savedId);
          const expiry = getExpiryMeta(item);
          const expiryLabel =
            expiry && expiry.daysRemaining >= 0
              ? expiry.daysRemaining === 0
                ? 'Closes today'
                : expiry.daysRemaining === 1
                  ? 'Only 1 day remaining'
                  : `Only ${expiry.daysRemaining} days remaining`
              : 'Review the role soon';

          return (
            <Animated.View style={{ opacity: cardsEntrance, transform: [{ translateY: itemY }] }}>
              <View style={styles.itemCard}>
                <LinearGradient colors={['rgba(17, 160, 135, 0.08)', 'rgba(38, 122, 208, 0.02)']} style={styles.itemTint} />
                <View style={styles.itemTop}>
                  <View style={styles.itemIconGreen}><Feather name="bookmark" size={18} color="#FFFFFF" /></View>
                  <View style={styles.itemText}>
                    <Text style={[styles.itemTitle, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{roleTitle}</Text>
                    <Text style={[styles.itemSub, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{company}</Text>
                  </View>
                  <View style={styles.savedBadge}>
                    <Text style={[styles.savedBadgeText, { fontFamily: t.typography.fontFamily.bold }]}>Saved</Text>
                  </View>
                </View>
                <View style={styles.metaRow}>
                  <View style={[styles.metaChip, styles.metaMint]}><Feather name="briefcase" size={14} color="#13907A" /><Text style={[styles.metaText, styles.metaTextMint, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{jobType}</Text></View>
                  <View style={[styles.metaChip, styles.metaBlue]}><Feather name="map-pin" size={14} color="#1D77C9" /><Text style={[styles.metaText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{location}</Text></View>
                  <View style={[styles.metaChip, styles.metaGold, styles.metaChipFull]}><Feather name="dollar-sign" size={14} color="#C67D12" /><Text style={[styles.metaText, styles.metaTextGold, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{`Salary ${salary}`}</Text></View>
                </View>
                {expiry?.isSoon ? (
                  <View style={styles.expiryBanner}>
                    <View style={styles.expiryBannerIcon}>
                      <Feather name="clock" size={16} color="#F06418" />
                    </View>
                    <View style={styles.expiryBannerCopy}>
                      <Text style={[styles.expiryBannerTitle, { fontFamily: t.typography.fontFamily.bold }]}>Expires soon</Text>
                      <Text style={[styles.expiryBannerText, { fontFamily: t.typography.fontFamily.medium }]}>{expiryLabel}</Text>
                    </View>
                    {!!expiry.formatted && (
                      <Text style={[styles.expiryBannerDate, { fontFamily: t.typography.fontFamily.bold }]}>{expiry.formatted}</Text>
                    )}
                  </View>
                ) : null}
                <View style={styles.actionsStack}>
                  <View style={styles.actionsRow}>
                    <Pressable style={({ pressed }) => [styles.appliedDetailsAction, pressed && styles.pressed]} onPress={() => openJobDetails(savedId)}>
                      <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.appliedDetailsFill}>
                        <Animated.View pointerEvents="none" style={[styles.appliedDetailsSweep, { transform: [{ translateX: sweepX }, { rotate: '16deg' }] }]} />
                        <View style={styles.appliedDetailsIcon}>
                          <Feather name="file-text" size={16} color="#FFFFFF" />
                        </View>
                        <View style={styles.appliedDetailsCopy}>
                          <Text numberOfLines={1} style={[styles.appliedDetailsTitle, { fontFamily: t.typography.fontFamily.bold }]}>View job</Text>
                          <Text numberOfLines={1} style={[styles.appliedDetailsText, { fontFamily: t.typography.fontFamily.medium }]}>Open</Text>
                        </View>
                        <Animated.View style={{ opacity: pulseOpacity, transform: [{ scale: pulseScale }] }}>
                          <Feather name="arrow-right" size={16} color="#FFFFFF" />
                        </Animated.View>
                      </LinearGradient>
                    </Pressable>
                    {isApplied ? (
                      <View style={styles.appliedStamp}>
                        <View style={styles.appliedStampIcon}>
                          <Feather name="check-circle" size={15} color="#14945B" />
                        </View>
                        <View style={styles.appliedStampCopy}>
                          <Text style={[styles.appliedStampTitle, { fontFamily: t.typography.fontFamily.bold }]}>Applied</Text>
                          <Text style={[styles.appliedStampText, { fontFamily: t.typography.fontFamily.medium }]}>Already submitted</Text>
                        </View>
                      </View>
                    ) : (
                      <Pressable style={({ pressed }) => [{ flex: 1 }, pressed && styles.pressed]} onPress={() => openApply(savedId)}>
                        <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.actionFilled}>
                          <Feather name="send" size={15} color="#FFFFFF" />
                          <Text style={[styles.actionFilledText, { fontFamily: t.typography.fontFamily.bold }]}>Apply now</Text>
                        </LinearGradient>
                      </Pressable>
                    )}
                  </View>
                  <Pressable style={({ pressed }) => [styles.removeAction, pressed && styles.pressed]} onPress={() => removeSavedJob(savedId)}>
                    <Feather name="trash-2" size={15} color="#EA3E4C" />
                    <Text style={[styles.removeActionText, { fontFamily: t.typography.fontFamily.bold }]}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 170 },
  contentEmpty: { flexGrow: 1 },
  headerWrap: { marginBottom: 14 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F8FF', borderWidth: 1, borderColor: '#BFD6F6', shadowColor: '#2F66B4', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 2 },
  hidden: { opacity: 0 },
  pressed: { opacity: 0.88 },
  topCopy: { flex: 1 },
  topEyebrow: { fontSize: 10, lineHeight: 12, textTransform: 'uppercase', letterSpacing: 1.1, fontWeight: '800' },
  topTitle: { marginTop: 3, color: '#13306F', fontSize: 22, lineHeight: 26, fontWeight: '900' },
  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#F5F8FD', borderWidth: 1, borderColor: '#D7E4F7' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1EC97D' },
  liveText: { color: '#194A9A', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  heroCard: { marginBottom: 12, padding: 16, borderRadius: 28, borderWidth: 1, borderColor: '#C6D9F6', backgroundColor: '#F4F8FF', overflow: 'hidden', shadowColor: '#5F81B8', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 5 },
  heroGlow: { position: 'absolute', top: -70, right: -24, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(42, 123, 209, 0.14)' },
  heroPulse: { position: 'absolute', bottom: -28, left: -16, width: 136, height: 136, borderRadius: 68, backgroundColor: 'rgba(18, 164, 135, 0.1)' },
  heroSweep: { position: 'absolute', top: -40, bottom: -40, width: 88, backgroundColor: 'rgba(255,255,255,0.38)' },
  heroHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 1, borderColor: '#CCDCF4' },
  heroPillText: { color: '#1A66B8', fontSize: 10, lineHeight: 12, textTransform: 'uppercase', letterSpacing: 0.9, fontWeight: '800' },
  heroSignal: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CCDCF4' },
  heroSignalDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1BCB82' },
  heroSignalText: { color: '#15458F', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  heroMain: { marginTop: 16, flexDirection: 'row', gap: 14 },
  heroCopy: { flex: 1 },
  heroTitle: { color: '#123070', fontSize: 22, lineHeight: 26, fontWeight: '900' },
  heroBody: { marginTop: 8, color: '#5B6A88', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  statsRowWide: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statCardWide: { flex: 1, minHeight: 78, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1, borderColor: '#D8E3F2', justifyContent: 'center' },
  statIconWide: { width: 24, height: 24, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValueWide: { fontSize: 16, lineHeight: 18, fontWeight: '900' },
  statLabelWide: { marginTop: 5, color: '#57708C', fontSize: 10, lineHeight: 12, fontWeight: '700' },
  heroVisual: { width: 148, justifyContent: 'center' },
  heroVisualCard: { borderRadius: 24, padding: 14, backgroundColor: 'rgba(255,255,255,0.86)', borderWidth: 1, borderColor: '#D7E3F3' },
  visualIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#1A68B8', alignItems: 'center', justifyContent: 'center' },
  visualTitle: { marginTop: 10, color: '#123071', fontSize: 14, lineHeight: 16, fontWeight: '900' },
  visualBody: { marginTop: 4, color: '#6B7894', fontSize: 10, lineHeight: 12, fontWeight: '500' },
  visualBars: { marginTop: 16, gap: 8 },
  visualBar: { height: 10, borderRadius: 999, backgroundColor: '#E3EDF9' },
  visualBarWide: { width: '82%' },
  visualBarActive: { width: '96%', backgroundColor: '#CFE4FB' },
  visualBarShort: { width: '68%' },
  tabRail: { position: 'relative', flexDirection: 'row', gap: 8, borderRadius: 24, padding: 6, backgroundColor: '#EDF4FD', borderWidth: 1, borderColor: '#D6E2F5', overflow: 'hidden' },
  tabActive: { position: 'absolute', top: 6, left: 6, bottom: 6, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BCD2EE', shadowColor: '#2F6ABB', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 2 },
  tabBtn: { flex: 1, minHeight: 70, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 1 },
  tabIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#E4F0FF', alignItems: 'center', justifyContent: 'center' },
  tabIconBlue: { backgroundColor: '#1C6FC4' },
  tabIconGreen: { backgroundColor: '#13917B' },
  tabCopy: { flex: 1 },
  tabTitle: { color: '#1D4D99', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  tabTitleActive: { color: '#12316E' },
  tabCaption: { marginTop: 4, color: '#6C8098', fontSize: 10, lineHeight: 12, fontWeight: '500' },
  itemCard: { marginBottom: 12, borderRadius: 24, padding: 14, backgroundColor: 'rgba(248, 250, 252, 0.9)', borderWidth: 1, borderColor: '#D8E3F5', overflow: 'hidden', shadowColor: '#6F8BB3', shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 3 },
  itemTint: { ...StyleSheet.absoluteFillObject },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  itemIconBlue: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#1B6FC1', alignItems: 'center', justifyContent: 'center' },
  itemIconGreen: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#15917C', alignItems: 'center', justifyContent: 'center' },
  itemText: { flex: 1 },
  itemTitle: { color: '#112C73', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  itemSub: { marginTop: 4, color: '#667893', fontSize: 10, lineHeight: 12, fontWeight: '600' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  statusBadgeText: { fontSize: 10, lineHeight: 12, fontWeight: '800' },
  savedBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F3FBF8', borderWidth: 1, borderColor: '#D4EDE5' },
  savedBadgeText: { color: '#168E79', fontSize: 10, lineHeight: 12, fontWeight: '800' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaChip: { flex: 1, minWidth: '48%', minHeight: 42, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  metaChipFull: { minWidth: '100%' },
  metaBlue: { backgroundColor: '#F7FAFE', borderColor: '#E2EBF6' },
  metaLavender: { backgroundColor: '#FAF7FE', borderColor: '#ECE4F7' },
  metaMint: { backgroundColor: '#F5FBF9', borderColor: '#DDEFEA' },
  metaGold: { backgroundColor: '#FFFAF2', borderColor: '#F3E7CE' },
  metaText: { marginLeft: 6, flex: 1, color: '#5D7091', fontSize: 10, lineHeight: 12, fontWeight: '600' },
  metaTextLavender: { color: '#7A6492' },
  metaTextMint: { color: '#5B7E78' },
  metaTextGold: { color: '#987A4E' },
  expiryBanner: { marginTop: 12, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#FFFBF5', borderWidth: 1, borderColor: '#F0E2C9', flexDirection: 'row', alignItems: 'center', gap: 10 },
  expiryBannerIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFF2E3', alignItems: 'center', justifyContent: 'center' },
  expiryBannerCopy: { flex: 1 },
  expiryBannerTitle: { color: '#C25412', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  expiryBannerText: { marginTop: 2, color: '#9F773F', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  expiryBannerDate: { color: '#B56B1B', fontSize: 10, lineHeight: 12, fontWeight: '800' },
  actionsStack: { marginTop: 12, gap: 10 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionsRowFlush: { marginTop: 8 },
  appliedDetailsAction: { flex: 1.25, minHeight: 54, borderRadius: 16, overflow: 'hidden', shadowColor: '#1F63B7', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.24, shadowRadius: 18, elevation: 5 },
  appliedDetailsFill: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10, overflow: 'hidden' },
  appliedDetailsSweep: { position: 'absolute', top: -20, bottom: -20, width: 64, backgroundColor: 'rgba(255,255,255,0.22)' },
  appliedDetailsIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  appliedDetailsCopy: { flex: 1, minWidth: 0 },
  appliedDetailsTitle: { color: '#FFFFFF', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  appliedDetailsText: { marginTop: 2, color: 'rgba(255,255,255,0.8)', fontSize: 10, lineHeight: 12, fontWeight: '600' },
  actionGhost: { flex: 1, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: '#8FB7E8', backgroundColor: '#F4F9FF', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, shadowColor: '#3A70B9', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 2 },
  actionGhostText: { color: '#1B6EC4', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  appliedStamp: { flex: 0.85, minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: '#D4EBDD', backgroundColor: '#F7FCF9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
  appliedStampIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECF8F1' },
  appliedStampCopy: { flex: 1, minWidth: 0 },
  appliedStampTitle: { color: '#148A4D', fontSize: 12, lineHeight: 14, fontWeight: '800' },
  appliedStampText: { marginTop: 1, color: '#708A7D', fontSize: 9, lineHeight: 11, fontWeight: '600' },
  actionFilled: { minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, shadowColor: '#1F63B7', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 14, elevation: 4 },
  actionFilledText: { color: '#FFFFFF', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  removeAction: { minHeight: 42, borderRadius: 14, borderWidth: 1, borderColor: '#F09BA6', backgroundColor: '#FFF3F5', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, shadowColor: '#D95367', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 1 },
  removeActionText: { color: '#E2404E', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  emptyWrap: { flex: 1, justifyContent: 'center', paddingTop: 40 },
});
