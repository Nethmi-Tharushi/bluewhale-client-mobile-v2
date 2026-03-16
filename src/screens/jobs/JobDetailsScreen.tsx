import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApplicationsService, JobsService } from '../../api/services';
import type { Job } from '../../types/models';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { JobsStackParamList } from '../../navigation/app/AppNavigator';
import { useTheme } from '../../theme/ThemeProvider';
import { getSavedJobs, setSavedJobs } from '../../utils/savedJobsStorage';
import { useAuthStore } from '../../context/authStore';
import { PageDecor } from '../../components/ui';

type Props = NativeStackScreenProps<JobsStackParamList, 'JobDetails'>;

const pickString = (obj: any, keys: string[], fallback = '') => {
  for (const key of keys) {
    const v = obj?.[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return fallback;
};

const pickPath = (obj: any, path: string) => {
  if (!path.includes('.')) return obj?.[path];
  return path.split('.').reduce((acc: any, part: string) => acc?.[part], obj);
};

const pickAny = (obj: any, keys: string[], fallback = '') => {
  for (const key of keys) {
    const v = pickPath(obj, key);
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return fallback;
};

const getPricingForDetails = (job: any, user: any) => {
  const pricing = job?.pricing;
  if (pricing && typeof pricing === 'object') {
    const role = String(user?.userType || user?.role || '').toLowerCase();
    const isAgentOrManagedView = role.includes('agent') || role.includes('managed');
    const amount = isAgentOrManagedView
      ? pricing?.agentPrice ?? pricing?.candidatePrice
      : pricing?.candidatePrice ?? pricing?.agentPrice;
    if (amount !== undefined && amount !== null && String(amount).trim() !== '') {
      const currency = String(pricing?.currency || 'USD').trim() || 'USD';
      return `${currency} ${String(amount).trim()}`;
    }
  }
  return pickAny(
    job,
    [
      'pricing',
      'price',
      'cost',
      'pricingText',
      'priceText',
      'serviceFee',
      'service_fee',
      'applicationFee',
      'application_fee',
      'budget',
      'rate',
      'hourlyRate',
      'dailyRate',
      'pricing.value',
      'pricing.amount',
      'pricing.price',
      'compensation.amount',
      'compensation.value',
    ],
    'N/A'
  );
};

const listFromAny = (value: any): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((x) => String(typeof x === 'string' ? x : x?.name || x?.label || x?.title || x || '').trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,|;|•/)
      .map((x) => x.replace(/^[-*\d.)\s]+/, '').trim())
      .filter(Boolean);
  }
  return [];
};

const formatDateValue = (v: string) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString();
};

export default function JobDetailsScreen({ navigation, route }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { jobId } = route.params;
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const userId = String((user as any)?._id || (user as any)?.id || (user as any)?.email || (user as any)?.phone || token || '').trim() || 'guest';
  const compact = height < 760;

  const heroEntrance = useRef(new Animated.Value(0)).current;
  const metricsEntrance = useRef(new Animated.Value(0)).current;
  const sectionsEntrance = useRef(new Animated.Value(0)).current;
  const heroFloat = useRef(new Animated.Value(0)).current;
  const shimmerTranslate = useRef(new Animated.Value(0)).current;
  const chipFloat = useRef(new Animated.Value(0)).current;
  const ctaPulse = useRef(new Animated.Value(1)).current;
  const routeProgress = useRef(new Animated.Value(0)).current;
  const beaconPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const j = await JobsService.get(jobId);
        setJob(j);
      } catch {
        setJob(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId]);

  useEffect(() => {
    (async () => {
      try {
        const all = await getSavedJobs(userId);
        const exists = all.some((j: any) => String(j?._id || j?.id || '') === String(jobId));
        setSaved(exists);
      } catch {
        setSaved(false);
      }
    })();
  }, [jobId, userId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await ApplicationsService.my();
        const arr: any[] = Array.isArray(res) ? res : (res as any)?.applications || (res as any)?.items || [];
        const appliedIds = arr
          .map((a: any) => a?.job?._id || a?.job?.id || a?.jobId || a?.job)
          .map((x: any) => String(x || '').trim())
          .filter(Boolean);
        setAlreadyApplied(appliedIds.includes(String(jobId)));
      } catch {
        setAlreadyApplied(false);
      }
    })();
  }, [jobId]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroEntrance, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(metricsEntrance, {
        toValue: 1,
        duration: 700,
        delay: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sectionsEntrance, {
        toValue: 1,
        duration: 760,
        delay: 170,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(heroFloat, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(heroFloat, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerTranslate, { toValue: 1, duration: 2200, delay: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(shimmerTranslate, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(chipFloat, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(chipFloat, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(ctaPulse, { toValue: 1.02, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(ctaPulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(routeProgress, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(routeProgress, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(beaconPulse, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(beaconPulse, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
    ];

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [beaconPulse, ctaPulse, chipFloat, heroEntrance, heroFloat, metricsEntrance, routeProgress, sectionsEntrance, shimmerTranslate]);

  const title = pickString(job, ['title', 'jobTitle', 'position'], loading ? 'Loading...' : 'Job Details');
  const company = pickString(job, ['company', 'companyName', 'employer', 'organization'], 'Company');
  const location = pickString(job, ['location', 'city', 'jobLocation'], 'Location');
  const jobType = pickString(job, ['type', 'jobType', 'employmentType'], 'N/A');
  const pricing = getPricingForDetails(job, user);
  const salary = pickString(job, ['salary', 'salaryRange', 'salaryText'], 'N/A');
  const displayJobId = String((job as any)?._id || (job as any)?.id || jobId || '').trim() || 'N/A';
  const closingDateRaw = pickAny(
    job,
    [
      'expiringAt',
      'expiring_at',
      'expiringDate',
      'closingDate',
      'applicationDeadline',
      'deadline',
      'expiryDate',
      'expiry_date',
      'expiresAt',
      'expires_at',
      'expireDate',
      'endDate',
      'end_date',
      'lastDate',
      'closeDate',
      'closing_date',
      'validTill',
      'validUntil',
      'availability.endDate',
    ],
    'N/A'
  );
  const closingDate = closingDateRaw === 'N/A' ? 'N/A' : formatDateValue(closingDateRaw);
  const ageLimit = (() => {
    const minRaw = (job as any)?.ageLimit?.min;
    const maxRaw = (job as any)?.ageLimit?.max;
    const min = minRaw !== undefined && minRaw !== null ? String(minRaw).trim() : '';
    const max = maxRaw !== undefined && maxRaw !== null ? String(maxRaw).trim() : '';
    if (min || max) return `${min || '?'} - ${max || '?'} years`;

    const legacy = pickString(job, ['ageRange', 'age_limit'], '');
    if (legacy) return legacy;

    const legacyMin = pickAny(job, ['minAge', 'age.min'], '');
    const legacyMax = pickAny(job, ['maxAge', 'age.max'], '');
    return legacyMin || legacyMax ? `${legacyMin || '?'} - ${legacyMax || '?'} years` : 'N/A';
  })();
  const description = pickString(job, ['description', 'jobDescription', 'overview'], 'No description provided.');

  const requirements = useMemo(() => {
    const list = [
      ...listFromAny((job as any)?.requirements),
      ...listFromAny((job as any)?.requirement),
      ...listFromAny((job as any)?.qualifications),
    ];
    if (list.length) return Array.from(new Set(list));
    return ['No requirements provided.'];
  }, [job]);

  const skills = useMemo(() => {
    const list = [
      ...listFromAny((job as any)?.skills),
      ...listFromAny((job as any)?.skillSet),
      ...listFromAny((job as any)?.tags),
      ...listFromAny((job as any)?.techStack),
    ];
    return Array.from(new Set(list));
  }, [job]);

  const benefits = useMemo(() => {
    const list = [
      ...listFromAny((job as any)?.benefits),
      ...listFromAny((job as any)?.perks),
      ...listFromAny((job as any)?.advantages),
    ];
    return Array.from(new Set(list));
  }, [job]);

  const badges = useMemo(() => {
    const b: string[] = [];
    const tags = listFromAny((job as any)?.tags).map((x) => x.toLowerCase());
    if ((job as any)?.featured || tags.includes('featured')) b.push('Featured');
    if ((job as any)?.urgent || tags.includes('urgent')) b.push('Urgent');
    if ((job as any)?.visaSponsored || (job as any)?.visa_sponsored || tags.includes('visa sponsored')) b.push('Visa Sponsored');
    return b;
  }, [job]);

  const websiteUrl = useMemo(() => {
    const c = pickString(job, ['website', 'url', 'companyUrl', 'applyUrl'], '');
    if (!c) return '';
    return /^https?:\/\//i.test(c) ? c : `https://${c}`;
  }, [job]);

  const onApply = () => navigation.navigate('ApplyJob', { jobId });
  const onAsk = () =>
    (navigation.getParent() as any)?.navigate({
      name: 'Inquiries',
      params: {
        screen: 'CreateInquiry',
        params: { jobId },
      },
      merge: true,
    });
  const onCopyJobId = async () => {
    if (!displayJobId || displayJobId === 'N/A') return;
    try {
      await Clipboard.setStringAsync(displayJobId);
      Alert.alert('Copied', 'Job ID copied to clipboard.');
    } catch {
      Alert.alert('Copy failed', 'Unable to copy Job ID right now.');
    }
  };

  const onShare = async () => {
    try {
      const normalizedId = encodeURIComponent(String(jobId || '').trim());
      const appDeepLink = `bluewhale://jobs/${normalizedId}`;
      const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.bluewhale.client';
      const appStoreUrl = 'https://apps.apple.com/us/search?term=Blue%20Whale%20Migration';
      const androidIntentLink = `intent://jobs/${normalizedId}#Intent;scheme=bluewhale;package=com.bluewhale.client;S.browser_fallback_url=${encodeURIComponent(playStoreUrl)};end`;
      const openLink = Platform.OS === 'android' ? androidIntentLink : appDeepLink;
      await Share.share({
        message:
          `Blue Whale Migration\n` +
          `${title} at ${company}\n\n` +
          `Open this job in app:\n${openLink}\n\n` +
          `Download Blue Whale Migration:\n` +
          `Google Play: ${playStoreUrl}\n` +
          `App Store: ${appStoreUrl}`,
        url: appDeepLink,
      });
    } catch {}
  };

  const onOpenCompanySite = async () => {
    if (!websiteUrl) return;
    try {
      await Linking.openURL(websiteUrl);
    } catch {
      Alert.alert('Unavailable', 'Unable to open the company website right now.');
    }
  };

  const onSave = async () => {
    if (!job) return;
    try {
      const all = await getSavedJobs(userId);
      const exists = all.some((j: any) => String(j?._id || j?.id || '') === String(jobId));
      const next = exists ? all.filter((j: any) => String(j?._id || j?.id || '') !== String(jobId)) : [job, ...all];
      await setSavedJobs(userId, next);
      setSaved(!exists);
      Alert.alert(exists ? 'Removed' : 'Saved', exists ? 'Job removed from saved jobs.' : 'Job added to saved jobs.');
    } catch (e: any) {
      Alert.alert('Failed', e?.userMessage || e?.message || 'Please try again');
    }
  };

  const heroTranslateY = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const heroOpacity = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const metricsTranslateY = metricsEntrance.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });
  const sectionsTranslateY = sectionsEntrance.interpolate({ inputRange: [0, 1], outputRange: [32, 0] });
  const heroFloatY = heroFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const chipTranslateY = chipFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const shimmerX = shimmerTranslate.interpolate({ inputRange: [0, 1], outputRange: [-220, 220] });
  const routeDotTranslateY = routeProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 88] });
  const beaconScale = beaconPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
  const beaconOpacity = beaconPulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.34] });

  return (
    <LinearGradient colors={t.colors.gradientBackground as any} style={styles.root}>
      <PageDecor />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: Math.max(8, insets.top + 4), paddingBottom: 220 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.topBar, { opacity: heroOpacity, transform: [{ translateY: heroTranslateY }] }]}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
              <Feather name="arrow-left" size={24} color="#132A74" />
            </Pressable>
            <View style={styles.titleWrap}>
              <Text style={[styles.title, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                Role Overview
              </Text>
              <Text style={[styles.subtitle, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                {`${company} · ${location}`}
              </Text>
            </View>
            <View style={[styles.topStatusPill, alreadyApplied ? styles.topStatusPillApplied : saved ? styles.topStatusPillSaved : styles.topStatusPillNeutral]}>
              <Feather name={alreadyApplied ? 'check-circle' : saved ? 'bookmark' : 'eye'} size={14} color={alreadyApplied ? '#119A4F' : '#1F4BA7'} />
              <Text style={[styles.topStatusText, { fontFamily: t.typography.fontFamily.bold }]}>
                {alreadyApplied ? 'Applied' : saved ? 'Saved' : 'Open'}
              </Text>
            </View>

          </Animated.View>

          <Animated.View
            style={[
              styles.companyCard,
              {
                opacity: heroOpacity,
                transform: [{ translateY: heroTranslateY }, { translateY: heroFloatY }],
              },
            ]}
          >
            <View style={styles.heroAmbientLarge} />
            <View style={styles.heroAmbientSmall} />
            <Animated.View pointerEvents="none" style={[styles.heroShimmer, { transform: [{ translateX: shimmerX }, { skewX: '-18deg' }] }]} />

            <LinearGradient
              colors={['#183B96', '#125DAE', '#1E86C8']}
              start={{ x: 0, y: 0.2 }}
              end={{ x: 1, y: 1 }}
              style={[styles.heroStrip, compact && styles.heroStripCompact]}
            >
              <View style={styles.detailHeroHeader}>
                <View style={styles.detailHeroEyebrowPill}>
                  <Feather name="layers" size={13} color="#EAF4FF" />
                  <Text style={[styles.detailHeroEyebrowText, { fontFamily: t.typography.fontFamily.bold }]}>Role preview</Text>
                </View>
                <Animated.View style={[styles.detailHeroSignalPill, { transform: [{ translateY: chipTranslateY }] }]}>
                  <View style={styles.heroSignalDot} />
                  <Text style={[styles.heroSignalText, { fontFamily: t.typography.fontFamily.bold }]}>Active opening</Text>
                </Animated.View>
              </View>

              <View style={[styles.detailHeroMainRow, compact && styles.detailHeroMainRowCompact]}>
                <View style={styles.detailHeroContent}>
                <Text style={[styles.heroEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>Career Match</Text>
                <Text style={[styles.detailHeroTitle, compact && styles.detailHeroTitleCompact, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={2}>
                  {title}
                </Text>
                <Text style={[styles.detailHeroCompany, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                  {company}
                </Text>
                <Text style={[styles.heroSubheadline, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                  {company} · {location}
                </Text>
                <Text style={[styles.detailHeroSummary, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={compact ? 2 : 3}>
                  See the role and next steps at a glance.
                </Text>
                </View>
                <Animated.View style={[styles.detailHeroVisual, compact && styles.detailHeroVisualCompact, { transform: [{ translateY: heroFloatY }] }]}>
                  <Animated.View style={[styles.detailHeroPulseRing, { opacity: beaconOpacity, transform: [{ scale: beaconScale }] }]} />
                  <Animated.View style={[styles.detailHeroGlassBack, { transform: [{ translateY: chipTranslateY }] }]} />
                  <View style={styles.detailHeroGlassFront}>
                    <View style={styles.detailHeroVisualHeader}>
                      <View style={styles.detailHeroGlyph}>
                        <Feather name="file-text" size={18} color="#FFFFFF" />
                      </View>
                      <View>
                        <Text style={[styles.detailHeroVisualLabel, { fontFamily: t.typography.fontFamily.bold }]}>Application lane</Text>
                        <Text style={[styles.detailHeroVisualCaption, { fontFamily: t.typography.fontFamily.medium }]}>
                          {alreadyApplied ? 'Submission complete' : 'Ready for review'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.detailHeroTrackWrap}>
                      <View style={styles.detailHeroTrackLine} />
                      <Animated.View style={[styles.detailHeroTrackDot, { transform: [{ translateY: routeDotTranslateY }] }]} />
                      <View style={[styles.detailHeroTrackStop, styles.detailHeroTrackStopTop]} />
                      <View style={[styles.detailHeroTrackStop, styles.detailHeroTrackStopBottom]} />
                    </View>
                    <View style={styles.detailHeroVisualFooter}>
                      <Text style={[styles.detailHeroVisualFooterLabel, { fontFamily: t.typography.fontFamily.medium }]}>Closing</Text>
                      <Text style={[styles.detailHeroVisualFooterValue, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                        {closingDate}
                      </Text>
                    </View>
                  </View>
                  {/*<Animated.View style={[styles.detailHeroMiniCard, { transform: [{ translateY: chipTranslateY }] }]}>
                    <Text style={[styles.detailHeroMiniLabel, { fontFamily: t.typography.fontFamily.medium }]}>Job ID</Text>
                    <Text style={[styles.detailHeroMiniValue, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                      {displayJobId}
                    </Text>
                  </Animated.View> */}
                  
                </Animated.View>
              </View>

              <View style={styles.detailHeroInfoRow}>
                <View style={styles.detailHeroInfoChip}>
                  <Feather name="map-pin" size={13} color="#EAF4FF" />
                  <Text style={[styles.detailHeroInfoText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                    {location}
                  </Text>
                </View>
                <View style={styles.detailHeroInfoChip}>
                  <Feather name="briefcase" size={13} color="#EAF4FF" />
                  <Text style={[styles.detailHeroInfoText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                    {jobType}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            <View style={[styles.companyBody, compact && styles.companyBodyCompact]}>
              <View style={styles.detailQuickFactsRow}>
                <View style={[styles.detailQuickFactCard, styles.detailQuickFactBlue]}>
                  <Text style={[styles.detailQuickFactLabel, { fontFamily: t.typography.fontFamily.medium }]}>Salary</Text>
                  <Text style={[styles.detailQuickFactValue, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                    {salary}
                  </Text>
                </View>
                <View style={[styles.detailQuickFactCard, styles.detailQuickFactMint]}>
                  <Text style={[styles.detailQuickFactLabel, { fontFamily: t.typography.fontFamily.medium }]}>Pricing</Text>
                  <Text style={[styles.detailQuickFactValue, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                    {pricing}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.companyDivider} />
            <View style={styles.actionRow}>
              <Pressable style={styles.actionCell} onPress={onSave}>
                <View style={[styles.actionIconWrap, saved && styles.actionIconWrapSaved]}>
                  <Feather name="bookmark" size={18} color={saved ? '#129A52' : '#1F4BA7'} />
                </View>
                <Text style={[styles.actionText, saved && styles.actionTextSaved, { fontFamily: t.typography.fontFamily.medium }]}>
                  {saved ? 'Saved' : 'Save'}
                </Text>
              </Pressable>
              <View style={styles.actionDivider} />
              <Pressable style={styles.actionCell} onPress={onShare}>
                <View style={styles.actionIconWrap}>
                  <Feather name="share-2" size={18} color="#1F4BA7" />
                </View>
                <Text style={[styles.actionText, { fontFamily: t.typography.fontFamily.bold }]}>Share</Text>
              </Pressable>
              {websiteUrl ? (
                <>
                  <View style={styles.actionDivider} />
                  <Pressable style={styles.actionCell} onPress={onOpenCompanySite}>
                    <View style={styles.actionIconWrap}>
                      <Feather name="globe" size={18} color="#1F4BA7" />
                    </View>
                    <Text style={[styles.actionText, { fontFamily: t.typography.fontFamily.bold }]}>Website</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </Animated.View>

          <Animated.View style={[styles.metricsCard, { opacity: metricsEntrance, transform: [{ translateY: metricsTranslateY }] }]}>
            <View style={styles.metricsHeader}>
              <View>
                <Text style={[styles.metricsEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>Role Snapshot</Text>
                <Text style={[styles.metricsTitle, { fontFamily: t.typography.fontFamily.bold }]}>Job Details</Text>
              </View>
              <View style={styles.metricsBadge}>
                <Feather name="activity" size={14} color="#1F4BA7" />
                <Text style={[styles.metricsBadgeText, { fontFamily: t.typography.fontFamily.bold }]}>Updated</Text>
              </View>
            </View>
            <View style={styles.metricsGrid}>
              {[
                { key: 'Job ID', value: displayJobId, icon: 'hash' as const, tone: styles.metricToneBlue },
                { key: 'Location', value: location, icon: 'map-pin' as const, tone: styles.metricToneBlue },
                { key: 'Pricing', value: pricing, icon: 'clock' as const, tone: styles.metricToneGreen },
                { key: 'Salary', value: salary, icon: 'dollar-sign' as const, tone: styles.metricTonePurple },
                { key: 'Closing Date', value: closingDate, icon: 'calendar' as const, tone: styles.metricToneOrange },
                { key: 'Age Limit', value: ageLimit, icon: 'users' as const, tone: styles.metricToneRose },
                { key: 'Job Type', value: jobType, icon: 'briefcase' as const, tone: styles.metricToneCyan },
              ].map((item) => (
                <View key={item.key} style={[styles.metricCell, item.tone]}>
                  <View style={[styles.metricLabelRow, item.key === 'Job ID' && styles.metricLabelRowWithAction]}>
                    <View style={styles.metricLabelLeft}>
                      <Feather name={item.icon} size={14} color="#1F4BA7" />
                      <Text style={[styles.metricLabel, { fontFamily: t.typography.fontFamily.medium }]}>{item.key}</Text>
                    </View>
                    {item.key === 'Job ID' ? (
                      <Pressable onPress={onCopyJobId} hitSlop={8} style={styles.copyBtn}>
                        <Feather name="copy" size={14} color="#1F4BA7" />
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={[styles.metricValue, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={item.key === 'Job ID' ? 1 : 2}>
                    {item.value || 'N/A'}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>

          <Animated.View style={{ opacity: sectionsEntrance, transform: [{ translateY: sectionsTranslateY }] }}>
            <View style={styles.sectionCard}>
              <View style={styles.sectionAccent} />
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconWrap}>
                  <Feather name="file-text" size={18} color="#4794EC" />
                </View>
                <View style={styles.sectionHeadingWrap}>
                  <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>Overview</Text>
                  <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Job Description</Text>
                </View>
              </View>
              <Text style={[styles.sectionText, { fontFamily: t.typography.fontFamily.medium }]}>{description}</Text>
            </View>

            <View style={styles.sectionCard}>
              <View style={[styles.sectionAccent, styles.sectionAccentMint]} />
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconWrap, styles.sectionIconWrapMint]}>
                  <Feather name="check-circle" size={18} color="#27A565" />
                </View>
                <View style={styles.sectionHeadingWrap}>
                  <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>Readiness</Text>
                  <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Requirements</Text>
                </View>
              </View>
              <View style={styles.requirementsWrap}>
                {requirements.map((item) => (
                  <View key={item} style={styles.reqRow}>
                    <View style={styles.reqIconWrap}>
                      <Feather name="check" size={14} color="#119A4F" />
                    </View>
                    <Text style={[styles.reqText, { fontFamily: t.typography.fontFamily.medium }]}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>

            {skills.length ? (
              <View style={styles.sectionCard}>
                <View style={[styles.sectionAccent, styles.sectionAccentPurple]} />
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionIconWrap, styles.sectionIconWrapPurple]}>
                    <Feather name="star" size={18} color="#8558D8" />
                  </View>
                  <View style={styles.sectionHeadingWrap}>
                    <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>Strengths</Text>
                    <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Skills</Text>
                  </View>
                </View>
                <View style={styles.skillsWrap}>
                  {skills.map((item, index) => (
                    <Animated.View
                      key={item}
                      style={[
                        styles.skillPill,
                        index % 3 === 0 && { transform: [{ translateY: chipTranslateY }] },
                      ]}
                    >
                      <Text style={[styles.skillText, { fontFamily: t.typography.fontFamily.medium }]}>{item}</Text>
                    </Animated.View>
                  ))}
                </View>
              </View>
            ) : null}

            {benefits.length ? (
              <View style={styles.sectionCard}>
                <View style={[styles.sectionAccent, styles.sectionAccentAmber]} />
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionIconWrap, styles.sectionIconWrapAmber]}>
                    <Feather name="award" size={18} color="#D87B16" />
                  </View>
                  <View style={styles.sectionHeadingWrap}>
                    <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>Value</Text>
                    <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Benefits</Text>
                  </View>
                </View>
                <View style={styles.requirementsWrap}>
                  {benefits.map((item) => (
                    <View key={item} style={styles.reqRow}>
                      <View style={styles.reqIconWrap}>
                        <Feather name="check" size={14} color="#119A4F" />
                      </View>
                      <Text style={[styles.reqText, { fontFamily: t.typography.fontFamily.medium }]}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </Animated.View>
        </ScrollView>

        <Animated.View style={[styles.bottomCard, { bottom: 104 + insets.bottom, transform: [{ scale: ctaPulse }] }]}>
          <Pressable onPress={onApply} disabled={alreadyApplied} style={({ pressed }) => [pressed && !alreadyApplied && { opacity: 0.95 }]}>
            {alreadyApplied ? (
              <View style={styles.appliedBtn}>
                <Feather name="check-circle" size={16} color="#119A4F" />
                <Text style={[styles.appliedText, { fontFamily: t.typography.fontFamily.bold }]}>Applied</Text>
              </View>
            ) : (
              <LinearGradient colors={['#1B3890', '#0F79C5']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.applyBtn}>
                <Feather name="send" size={16} color="#FFFFFF" />
                <Text style={[styles.applyText, { fontFamily: t.typography.fontFamily.bold }]}>Apply Now</Text>
              </LinearGradient>
            )}
          </Pressable>
          <Pressable onPress={onAsk}>
            <Text style={[styles.askText, { fontFamily: t.typography.fontFamily.bold }]}>Ask a question</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(248, 251, 255, 0.86)',
    borderWidth: 1,
    borderColor: '#D7E4F8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7B8DBA',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
  },
  titleWrap: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    lineHeight: 24,
    color: '#122A74',
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 0,
    fontSize: 12,
    lineHeight: 14,
    color: 'transparent',
    opacity: 0,
    height: 0,
    fontWeight: '600',
  },
  topStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  topStatusPillNeutral: {
    backgroundColor: '#EEF4FF',
    borderColor: '#D6E4FA',
  },
  topStatusPillSaved: {
    backgroundColor: '#EEF4FF',
    borderColor: '#D6E4FA',
  },
  topStatusPillApplied: {
    backgroundColor: '#E8F8EF',
    borderColor: '#CDEEDC',
  },
  topStatusText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#1E4392',
    fontWeight: '800',
  },
  companyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#D8E3F7',
    overflow: 'hidden',
    shadowColor: '#7289BA',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 6,
    position: 'relative',
  },
  heroAmbientLarge: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -80,
    right: -40,
  },
  heroAmbientSmall: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: 78,
    left: -28,
  },
  heroShimmer: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 70,
    backgroundColor: 'rgba(255,255,255,0.16)',
    zIndex: 3,
  },
  heroStrip: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  heroStripCompact: {
    paddingTop: 14,
    paddingBottom: 10,
  },
  detailHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailHeroEyebrowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  detailHeroEyebrowText: {
    color: '#F3F9FF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  detailHeroSignalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.94)',
    gap: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroBrandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    flex: 1,
  },
  heroBrandIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  heroBrandCopy: {
    flex: 1,
  },
  heroBrandTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  heroBrandLabel: {
    marginTop: 2,
    color: 'rgba(233, 243, 255, 0.88)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  heroSignalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.96)',
    gap: 8,
  },
  heroSignalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#33C16D',
  },
  heroSignalText: {
    color: '#18428A',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  heroHeadlineBlock: {
    gap: 6,
  },
  heroEyebrow: {
    color: 'rgba(231, 242, 255, 0.9)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroHeadline: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  heroHeadlineCompact: {
    fontSize: 22,
    lineHeight: 27,
  },
  heroSubheadline: {
    color: 'rgba(234, 243, 255, 0.95)',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    opacity: 0,
    height: 0,
  },
  heroDescription: {
    color: 'rgba(232, 241, 255, 0.86)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  detailHeroMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailHeroMainRowCompact: {
    gap: 10,
  },
  detailHeroContent: {
    gap: 7,
    flex: 1,
    paddingRight: 4,
  },
  detailHeroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  detailHeroTitleCompact: {
    fontSize: 21,
    lineHeight: 26,
  },
  detailHeroCompany: {
    color: '#F5FAFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  detailHeroSummary: {
    color: 'rgba(232, 241, 255, 0.88)',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  detailHeroVisual: {
    marginTop: 0,
    width: 150,
    minHeight: 130,
    position: 'relative',
    marginLeft: 'auto',
  },
  detailHeroVisualCompact: {
    width: 142,
    minHeight: 122,
  },
  detailHeroPulseRing: {
    position: 'absolute',
    top: 18,
    right: 8,
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  detailHeroGlassBack: {
    position: 'absolute',
    top: 12,
    right: 0,
    width: 118,
    height: 100,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  detailHeroGlassFront: {
    width: 148,
    minHeight: 118,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    justifyContent: 'space-between',
    marginLeft: 'auto',
    shadowColor: '#0D3D83',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  detailHeroVisualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailHeroGlyph: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeroVisualLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  detailHeroVisualCaption: {
    color: 'rgba(238, 245, 255, 0.84)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  detailHeroTrackWrap: {
    height: 48,
    justifyContent: 'center',
    paddingLeft: 8,
    position: 'relative',
  },
  detailHeroTrackLine: {
    position: 'absolute',
    left: 11,
    top: 6,
    bottom: 6,
    width: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  detailHeroTrackDot: {
    position: 'absolute',
    left: 5,
    top: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#2CD178',
  },
  detailHeroTrackStop: {
    position: 'absolute',
    left: 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  detailHeroTrackStopTop: {
    top: 6,
  },
  detailHeroTrackStopBottom: {
    bottom: 6,
  },
  detailHeroVisualFooter: {
    paddingTop: 4,
  },
  detailHeroVisualFooterLabel: {
    color: 'rgba(238, 245, 255, 0.78)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailHeroVisualFooterValue: {
    marginTop: 3,
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  detailHeroMiniCard: {
    position: 'absolute',
    left: 0,
    bottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(6, 31, 92, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    minWidth: 118,
  },
  detailHeroMiniLabel: {
    color: 'rgba(234, 243, 255, 0.74)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailHeroMiniValue: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  detailHeroInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 0,
  },
  detailHeroInfoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  detailHeroInfoText: {
    color: '#F5FAFF',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  heroMetaChipAction: {
    maxWidth: '100%',
  },
  heroMetaText: {
    color: '#F5FAFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  companyBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  companyBodyCompact: {
    paddingTop: 10,
  },
  detailQuickFactsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  detailQuickFactCard: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
  },
  detailQuickFactBlue: {
    backgroundColor: '#EAF2FF',
    borderColor: '#CFE0F8',
  },
  detailQuickFactMint: {
    backgroundColor: '#E8F8EF',
    borderColor: '#CDEEDC',
  },
  detailQuickFactLabel: {
    color: '#5870A6',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailQuickFactValue: {
    marginTop: 4,
    color: '#112A72',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroStatCard: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
  },
  heroStatBlue: {
    backgroundColor: '#EAF2FF',
    borderColor: '#CFE0F8',
  },
  heroStatMint: {
    backgroundColor: '#E8F8EF',
    borderColor: '#CDEEDC',
  },
  heroStatAmber: {
    backgroundColor: '#FFF2E4',
    borderColor: '#F8DDBF',
  },
  heroStatLabel: {
    color: '#5870A6',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  heroStatValue: {
    marginTop: 5,
    color: '#112A72',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  badgePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFEFF0',
    borderWidth: 1,
    borderColor: '#F6C7D0',
  },
  badgeText: {
    color: '#B4232E',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  companyDivider: {
    height: 1,
    backgroundColor: '#DCE5F6',
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionCell: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  actionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 11,
    backgroundColor: '#EDF4FF',
    borderWidth: 1,
    borderColor: '#D4E2F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconWrapSaved: {
    backgroundColor: '#E6F8EE',
    borderColor: '#CDEEDC',
  },
  actionText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#1E3F8C',
    fontWeight: '700',
  },
  actionTextSaved: {
    color: '#129A52',
  },
  actionDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#DCE5F6',
  },
  metricsCard: {
    backgroundColor: '#FAFCFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#CFDDF8',
    padding: 16,
    shadowColor: '#7289BA',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 5,
  },
  metricsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  metricsEyebrow: {
    color: '#6B7EAE',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  metricsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#D6E4FA',
  },
  metricsBadgeText: {
    color: '#1E4392',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  metricsTitle: {
    color: '#0F2E7A',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCell: {
    width: '48%',
    minHeight: 78,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CDDCF7',
    backgroundColor: '#EDF4FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricToneBlue: { backgroundColor: '#EAF2FF', borderColor: '#CFE0F8' },
  metricToneGreen: { backgroundColor: '#E8F8EF', borderColor: '#CDEEDC' },
  metricTonePurple: { backgroundColor: '#F2ECFF', borderColor: '#DCCCF9' },
  metricToneOrange: { backgroundColor: '#FFF2E4', borderColor: '#F8DDBF' },
  metricToneRose: { backgroundColor: '#FFF0F3', borderColor: '#F7D0DA' },
  metricToneCyan: { backgroundColor: '#E9F8FD', borderColor: '#CBEAF6' },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricLabelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricLabelRowWithAction: {
    justifyContent: 'space-between',
  },
  metricLabel: {
    marginLeft: 5,
    color: '#234287',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  metricValue: {
    marginTop: 5,
    color: '#0C1E4F',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  copyBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C3D7F7',
    backgroundColor: '#F4F8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: {
    backgroundColor: '#FAFCFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#CFDDF8',
    paddingHorizontal: 16,
    paddingVertical: 18,
    shadowColor: '#7289BA',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 4,
    marginBottom: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  sectionAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: '#4E92EB',
  },
  sectionAccentMint: {
    backgroundColor: '#27A565',
  },
  sectionAccentPurple: {
    backgroundColor: '#8558D8',
  },
  sectionAccentAmber: {
    backgroundColor: '#D87B16',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  sectionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#EAF3FF',
    borderWidth: 1,
    borderColor: '#D1E2FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconWrapMint: {
    backgroundColor: '#EAF8F0',
    borderColor: '#CDEEDC',
  },
  sectionIconWrapPurple: {
    backgroundColor: '#F3EEFF',
    borderColor: '#E2D5FB',
  },
  sectionIconWrapAmber: {
    backgroundColor: '#FFF2E4',
    borderColor: '#F8DDBF',
  },
  sectionHeadingWrap: {
    flex: 1,
  },
  sectionEyebrow: {
    color: '#6B7EAE',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 3,
  },
  sectionTitle: {
    color: '#1A388D',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  sectionText: {
    color: '#171F34',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  requirementsWrap: {
    gap: 10,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  reqIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E8F8EF',
    borderWidth: 1,
    borderColor: '#CDEEDC',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  reqText: {
    flex: 1,
    color: '#1A2238',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    marginLeft: 8,
  },
  skillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillPill: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E5EDFF',
    borderWidth: 1,
    borderColor: '#C5D6FA',
  },
  skillText: {
    color: '#1B3B89',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  bottomCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(248, 250, 252, 0.96)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D8E3F7',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    shadowColor: '#7289BA',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 7,
  },
  applyBtn: {
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  applyText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  appliedBtn: {
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#33C16D',
    backgroundColor: '#CDEEDB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  appliedText: {
    color: '#128A4A',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  askText: {
    marginTop: 10,
    textAlign: 'center',
    color: '#1A3E8D',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
});
