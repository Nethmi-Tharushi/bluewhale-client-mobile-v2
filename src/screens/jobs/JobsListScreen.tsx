import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ApplicationsService, AuthService, JobsService, WishlistService } from '../../api/services';
import { api } from '../../api/client';
import ManagedViewBanner from '../../components/managed/ManagedViewBanner';
import { EmptyState, Screen, Skeleton } from '../../components/ui';
import { useAuthStore } from '../../context/authStore';
import type { Job } from '../../types/models';
import type { JobsStackParamList } from '../../navigation/app/AppNavigator';
import { formatDate } from '../../utils/format';
import { useTheme } from '../../theme/ThemeProvider';
import { getManagedAppliedJobIds, getManagedCandidate, getManagedCandidateId, getManagedCandidateName, isManagedViewActive, stripManagedViewState } from '../../utils/managedView';

type Props = NativeStackScreenProps<JobsStackParamList, 'JobsList'>;

const splitList = (v: any) => {
  if (Array.isArray(v)) return v.map((x) => String(typeof x === 'string' ? x : x?.name || x || '').trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(/\r?\n|,|;|â€¢|Ã¢â‚¬Â¢/).map((x) => x.replace(/^[-*\d.)\s]+/, '').trim()).filter(Boolean);
  return [] as string[];
};

const pick = (obj: any, keys: string[], fallback = '') => {
  for (const k of keys) {
    const v = obj?.[k];
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
    const value = pickPath(obj, key);
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
};

const getCompanyName = (user: any) =>
  pickAny(user, ['companyName', 'company.name', 'businessName', 'agencyName', 'organizationName'], '');

const getPricingForCard = (job: any, user: any) => {
  const pricing = job?.pricing;
  if (pricing && typeof pricing === 'object') {
    const role = String(user?.userType || user?.role || '').toLowerCase();
    const isAgentOrManagedView = role.includes('agent') || role.includes('managed');
    const amount = isAgentOrManagedView ? pricing?.agentPrice ?? pricing?.candidatePrice : pricing?.candidatePrice ?? pricing?.agentPrice;
    if (amount !== undefined && amount !== null && String(amount).trim() !== '') {
      const currency = String(pricing?.currency || 'USD').trim() || 'USD';
      return `${currency} ${String(amount).trim()}`;
    }
  }
  return pickAny(
    job,
    ['pricing', 'price', 'cost', 'pricingText', 'priceText', 'serviceFee', 'service_fee', 'applicationFee', 'application_fee', 'budget', 'rate', 'hourlyRate', 'dailyRate', 'pricing.value', 'pricing.amount', 'pricing.price', 'compensation.amount', 'compensation.value'],
    'N/A',
  );
};

const jobKey = (j: any) => String(j?._id || j?.id || `${pick(j, ['title'])}-${pick(j, ['company'])}-${pick(j, ['location'])}`).toLowerCase();

const QUICK_ACTION_META = [
  { key: 'Roles', caption: 'Browse jobs', icon: 'briefcase' as const, active: true, gradient: ['#155EEF', '#46A6FF'] as const, tint: '#EAF3FF' },
  { key: 'Managed Candidates', caption: 'Manage profiles', icon: 'users' as const, active: false, gradient: ['#1B4AA3', '#1279C5'] as const, tint: '#EAF1FF' },
  { key: 'Overview', caption: 'Track pipeline', icon: 'activity' as const, active: false, gradient: ['#0B7A75', '#30C7B5'] as const, tint: '#E9FBF7' },
  { key: 'Analytics', caption: 'Review insights', icon: 'bar-chart-2' as const, active: false, gradient: ['#6F3FF5', '#B77CFF'] as const, tint: '#F4EEFF' },
];

const MANAGED_HOME_QUICK_ACTION_META = [
  { key: 'Roles', caption: 'Browse jobs', icon: 'briefcase' as const, active: true, gradient: ['#155EEF', '#46A6FF'] as const, tint: '#EAF3FF' },
  { key: 'Overview', caption: 'Candidate hub', icon: 'activity' as const, active: false, gradient: ['#0B7A75', '#30C7B5'] as const, tint: '#E9FBF7' },
  { key: 'Applications', caption: 'My submissions', icon: 'file-text' as const, active: false, gradient: ['#1B4AA3', '#1279C5'] as const, tint: '#EAF1FF' },
  { key: 'Documents', caption: 'Stored files', icon: 'folder' as const, active: false, gradient: ['#3B82F6', '#60A5FA'] as const, tint: '#EEF5FF' },
  { key: 'Tasks', caption: 'Action items', icon: 'check-square' as const, active: false, gradient: ['#0B7A75', '#30C7B5'] as const, tint: '#E9FBF7' },
  { key: 'Meetings', caption: 'Upcoming calls', icon: 'calendar' as const, active: false, gradient: ['#6F3FF5', '#B77CFF'] as const, tint: '#F4EEFF' },
  { key: 'Inquiries', caption: 'Support tickets', icon: 'help-circle' as const, active: false, gradient: ['#C77719', '#F4A340'] as const, tint: '#FFF5E8' },
  { key: 'Invoices', caption: 'Billing items', icon: 'credit-card' as const, active: false, gradient: ['#A61E4D', '#F7677A'] as const, tint: '#FFF1F3' },
];

const MAX_HOME_QUICK_ACTIONS = Math.max(QUICK_ACTION_META.length, MANAGED_HOME_QUICK_ACTION_META.length);

export default function JobsListScreen({ navigation }: Props) {
  const t = useTheme();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const signIn = useAuthStore((s) => s.signIn);
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<Job> | null>(null);
  const [q, setQ] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [serverAvatarRaw, setServerAvatarRaw] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const [jobTypeOpen, setJobTypeOpen] = useState(false);
  const [countryDraft, setCountryDraft] = useState('All Countries');
  const [jobTypeDraft, setJobTypeDraft] = useState('All Job Types');
  const [countryFilter, setCountryFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [jobsSectionOffset, setJobsSectionOffset] = useState(0);
  const [pressedQuickAction, setPressedQuickAction] = useState<string | null>(null);

  const quickCardWidth = Math.max(102, Math.min(138, Math.floor((width - 44) / 3)));
  const shortScreen = height < 780;
  const veryShortScreen = height < 720;
  const managedViewActive = useMemo(() => isManagedViewActive(user), [user]);
  const managedCandidate = useMemo(() => getManagedCandidate(user), [user]);
  const managedCandidateId = useMemo(() => getManagedCandidateId(user), [user]);
  const managedCandidateName = useMemo(() => getManagedCandidateName(user), [user]);
  const managedAppliedJobIds = useMemo(() => getManagedAppliedJobIds(user), [user]);

  const heroEntrance = useRef(new Animated.Value(0)).current;
  const filtersEntrance = useRef(new Animated.Value(0)).current;
  const orbFloat = useRef(new Animated.Value(0)).current;
  const badgeFloatA = useRef(new Animated.Value(0)).current;
  const badgeFloatB = useRef(new Animated.Value(0)).current;
  const shimmerTranslate = useRef(new Animated.Value(0)).current;
  const pulseDot = useRef(new Animated.Value(0)).current;
  const ambientRibbon = useRef(new Animated.Value(0)).current;
  const headlineFloat = useRef(new Animated.Value(0)).current;
  const quickAnimationsRef = useRef<Animated.Value[]>(Array.from({ length: MAX_HOME_QUICK_ACTIONS }, () => new Animated.Value(0)));
  while (quickAnimationsRef.current.length < MAX_HOME_QUICK_ACTIONS) {
    quickAnimationsRef.current.push(new Animated.Value(0));
  }
  const quickAnimations = quickAnimationsRef.current;
  const statAnimations = useRef(Array.from({ length: 3 }, () => new Animated.Value(0))).current;

  const load = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setErrorMessage(null);
    try {
      const baseUrl = String(api.defaults.baseURL || '').replace(/\/+$/, '');
      console.log(`[Jobs] GET ${baseUrl}/jobs`, { q: q.trim() || undefined });
      const list = await JobsService.list({ q: q.trim() || undefined });
      setJobs(Array.isArray(list) ? list : (list as any)?.jobs || []);
    } catch (err: any) {
      const msg = String(err?.userMessage || err?.message || 'Unable to load jobs');
      setErrorMessage(msg);
      setJobs([]);
      console.warn('[Jobs] Failed to load jobs', msg);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroEntrance, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(filtersEntrance, { toValue: 1, duration: 760, delay: 120, useNativeDriver: true }),
      Animated.stagger(85, quickAnimations.map((value) => Animated.timing(value, { toValue: 1, duration: 420, useNativeDriver: true }))),
      Animated.stagger(100, statAnimations.map((value) => Animated.timing(value, { toValue: 1, duration: 420, useNativeDriver: true }))),
    ]).start();

    const loops = [
      Animated.loop(Animated.sequence([Animated.timing(orbFloat, { toValue: 1, duration: 2600, useNativeDriver: true }), Animated.timing(orbFloat, { toValue: 0, duration: 2600, useNativeDriver: true })])),
      Animated.loop(Animated.sequence([Animated.timing(badgeFloatA, { toValue: 1, duration: 2200, useNativeDriver: true }), Animated.timing(badgeFloatA, { toValue: 0, duration: 2200, useNativeDriver: true })])),
      Animated.loop(Animated.sequence([Animated.timing(badgeFloatB, { toValue: 1, duration: 2800, useNativeDriver: true }), Animated.timing(badgeFloatB, { toValue: 0, duration: 2800, useNativeDriver: true })])),
      Animated.loop(Animated.sequence([Animated.timing(shimmerTranslate, { toValue: 1, duration: 2200, delay: 800, useNativeDriver: true }), Animated.timing(shimmerTranslate, { toValue: 0, duration: 0, useNativeDriver: true })])),
      Animated.loop(Animated.sequence([Animated.timing(pulseDot, { toValue: 1, duration: 1500, useNativeDriver: true }), Animated.timing(pulseDot, { toValue: 0, duration: 1500, useNativeDriver: true })])),
      Animated.loop(Animated.sequence([Animated.timing(ambientRibbon, { toValue: 1, duration: 4200, useNativeDriver: true }), Animated.timing(ambientRibbon, { toValue: 0, duration: 4200, useNativeDriver: true })])),
      Animated.loop(Animated.sequence([Animated.timing(headlineFloat, { toValue: 1, duration: 2600, useNativeDriver: true }), Animated.timing(headlineFloat, { toValue: 0, duration: 2600, useNativeDriver: true })])),
    ];

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [ambientRibbon, badgeFloatA, badgeFloatB, filtersEntrance, headlineFloat, heroEntrance, orbFloat, pulseDot, quickAnimations, shimmerTranslate, statAnimations]);

  const countryOptions = useMemo(() => {
    const base = ['USA', 'UK', 'Canada', 'Germany', 'Remote'];
    const fromJobs = jobs.map((j) => pick(j as any, ['location', 'city', 'jobLocation'], '')).filter(Boolean).map((x) => x.split(',')[0].trim());
    return ['All Countries', ...Array.from(new Set([...base, ...fromJobs]))];
  }, [jobs]);

  const jobTypeOptions = useMemo(() => {
    const base = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Remote'];
    const fromJobs = jobs.map((j) => pick(j as any, ['type', 'jobType', 'employmentType'], '')).filter(Boolean);
    return ['All Job Types', ...Array.from(new Set([...base, ...fromJobs]))];
  }, [jobs]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const cFilter = countryFilter.trim().toLowerCase();
    const tFilter = jobTypeFilter.trim().toLowerCase();

    return jobs.filter((j) => {
      const requirements = [...splitList((j as any)?.requirements), ...splitList((j as any)?.requirement), ...splitList((j as any)?.qualifications)].join(' ');
      const searchable =
        `${pick(j as any, ['title', 'jobTitle', 'position'])} ` +
        `${pick(j as any, ['company', 'companyName'])} ` +
        `${pick(j as any, ['location', 'city', 'jobLocation'])} ` +
        `${pick(j as any, ['type', 'jobType', 'employmentType'])} ` +
        `${pick(j as any, ['salary', 'salaryRange', 'salaryText'])} ` +
        `${getPricingForCard(j as any, user)} ` +
        `${pickAny(j as any, ['expiringAt', 'expiring_at', 'expiryDate', 'deadline'])} ` +
        `${splitList((j as any)?.tags).join(' ')} ` +
        `${splitList((j as any)?.skills).join(' ')} ` +
        `${splitList((j as any)?.benefits).join(' ')} ` +
        `${requirements}`.toLowerCase();

      const jobLocation = pick(j as any, ['location', 'city', 'jobLocation']).toLowerCase();
      const jobType = pick(j as any, ['type', 'jobType', 'employmentType']).toLowerCase();
      return (!term || searchable.includes(term)) && (!cFilter || jobLocation.includes(cFilter)) && (!tFilter || jobType.includes(tFilter));
    });
  }, [jobs, q, countryFilter, jobTypeFilter, user]);

  const displayName = useMemo(() => {
    if (managedViewActive) return managedCandidateName;
    const firstLast = `${String(user?.firstName || '').trim()} ${String(user?.lastName || '').trim()}`.trim();
    const full = String(user?.name || user?.fullName || firstLast || '').trim();
    if (full) return full;
    const emailName = String(user?.email || '').split('@')[0].trim();
    return emailName || 'User';
  }, [managedCandidateName, managedViewActive, user]);

  const companyName = useMemo(() => {
    if (managedViewActive) return managedCandidateName;
    const resolved = getCompanyName(user);
    return resolved || displayName || 'Agent workspace';
  }, [displayName, managedCandidateName, managedViewActive, user]);

  const supportLabel = useMemo(() => {
    if (managedViewActive) {
      const role = pickAny(managedCandidate, ['profession', 'jobInterest', 'qualification']);
      const location = pickAny(managedCandidate, ['location', 'country']);
      const visa = pickAny(managedCandidate, ['visaStatus']);
      if (role && location) return `${role} - ${location}`;
      if (role) return `${role} candidate desk`;
      if (location) return `Working toward roles in ${location}`;
      if (visa) return `Visa status - ${visa}`;
      return 'Managed candidate job search desk';
    }
    const lead = String(user?.contactPerson || displayName || '').trim();
    return lead && lead !== companyName ? `Workspace lead - ${lead}` : 'Managed candidate operations';
  }, [companyName, displayName, managedCandidate, managedViewActive, user]);

  const exitManagedView = useCallback(async () => {
    if (!managedViewActive || !token || !user) return;
    await signIn({ token, user: stripManagedViewState(user) });
    navigation.getParent()?.navigate('Candidates' as never);
  }, [managedViewActive, navigation, signIn, token, user]);

  const avatarUri = useMemo(() => {
    const candidate = String(
      serverAvatarRaw ||
        user?.companyLogo ||
        user?.avatarUrl ||
        user?.avatar ||
        user?.picture ||
        user?.profileImage ||
        user?.profilePic ||
        user?.profilePicture ||
        user?.photoUrl ||
        user?.photo ||
        user?.image ||
        ''
    ).trim();
    if (!candidate) return '';
    if (/^https?:\/\//i.test(candidate)) return candidate;
    const base = String(api.defaults.baseURL || '').replace(/\/+$/, '');
    const origin = base.replace(/\/api$/i, '');
    if (!origin) return '';
    if (candidate.startsWith('/')) return `${origin}${candidate}`;
    if (/^uploads\//i.test(candidate)) return `${origin}/${candidate}`;
    return `${origin}/uploads/${candidate}`;
  }, [serverAvatarRaw, user]);

  useEffect(() => setAvatarFailed(false), [avatarUri]);

  useEffect(() => {
    const loadProfileAvatar = async () => {
      try {
        const profile = await AuthService.getProfile();
        const u = (profile as any)?.user || profile;
        const raw = String(
          u?.companyLogo ||
            u?.picture ||
            u?.avatarUrl ||
            u?.avatar ||
            u?.profileImage ||
            u?.profilePic ||
            u?.profilePicture ||
            u?.photoUrl ||
            u?.photo ||
            u?.image ||
            ''
        ).trim();
        setServerAvatarRaw(raw);
      } catch {
        // keep existing fallback
      }
    };

    const unsub = navigation.addListener('focus', loadProfileAvatar);
    loadProfileAvatar();
    return unsub;
  }, [navigation]);

  useEffect(() => {
    const loadSavedIds = async () => {
      try {
        const saved = await WishlistService.list(managedCandidateId ? { managedCandidateId } : undefined);
        setSavedIds(saved.map((item) => jobKey(item?.job || item)).filter(Boolean));
      } catch {
        setSavedIds([]);
      }
    };

    const unsub = navigation.addListener('focus', loadSavedIds);
    loadSavedIds();
    return unsub;
  }, [managedCandidateId, navigation]);

  useEffect(() => {
    (async () => {
      try {
        const res = await ApplicationsService.my(managedCandidateId ? { candidateId: managedCandidateId, managedCandidateId } : undefined);
        const arr: any[] = Array.isArray(res) ? res : (res as any)?.applications || (res as any)?.items || [];
        const ids = arr.map((a: any) => a?.job?._id || a?.job?.id || a?.jobId || a?.job).map((x: any) => String(x || '').trim()).filter(Boolean);
        setAppliedIds(Array.from(new Set([...(managedViewActive ? managedAppliedJobIds : []), ...ids])));
      } catch {
        setAppliedIds(managedViewActive ? managedAppliedJobIds : []);
      }
    })();
  }, [managedAppliedJobIds, managedCandidateId, managedViewActive]);

  const scrollToJobsSection = () => {
    listRef.current?.scrollToOffset({
      offset: Math.max(0, jobsSectionOffset - 12),
      animated: true,
    });
  };

  const toggleSavedJob = useCallback(
    async (job: Job, cardKey: string) => {
      const jobId = String(job?._id || (job as any)?.id || '').trim();
      if (!jobId) return;

      const previous = savedIds;
      const wasSaved = previous.includes(cardKey);
      const optimistic = wasSaved ? previous.filter((x) => x !== cardKey) : [cardKey, ...previous];
      setSavedIds(optimistic);

      try {
        if (wasSaved) {
          await WishlistService.remove(jobId, managedCandidateId ? { managedCandidateId } : undefined);
        } else {
          await WishlistService.save(jobId, managedCandidateId ? { managedCandidateId } : undefined);
        }
      } catch {
        setSavedIds(previous);
      }
    },
    [managedCandidateId, savedIds]
  );

  const quickActions = managedViewActive
    ? [
        { ...MANAGED_HOME_QUICK_ACTION_META[0], action: scrollToJobsSection },
        { ...MANAGED_HOME_QUICK_ACTION_META[1], action: () => navigation.getParent()?.navigate('Overview' as never) },
        { ...MANAGED_HOME_QUICK_ACTION_META[2], action: () => navigation.getParent()?.navigate('Applications' as never) },
        { ...MANAGED_HOME_QUICK_ACTION_META[3], action: () => navigation.getParent()?.navigate('Documents' as never) },
        { ...MANAGED_HOME_QUICK_ACTION_META[4], action: () => navigation.getParent()?.navigate('Tasks' as never) },
        { ...MANAGED_HOME_QUICK_ACTION_META[5], action: () => navigation.getParent()?.navigate('Meetings' as never) },
        { ...MANAGED_HOME_QUICK_ACTION_META[6], action: () => navigation.getParent()?.navigate('Inquiries' as never) },
        { ...MANAGED_HOME_QUICK_ACTION_META[7], action: () => navigation.getParent()?.navigate('Invoices' as never) },
      ]
    : [
        { ...QUICK_ACTION_META[0], action: scrollToJobsSection },
        { ...QUICK_ACTION_META[1], action: () => navigation.getParent()?.navigate('Candidates' as never) },
        { ...QUICK_ACTION_META[2], action: () => navigation.getParent()?.navigate('Overview' as never) },
        { ...QUICK_ACTION_META[3], action: () => navigation.getParent()?.navigate('Analytics' as never) },
      ];

  const featuredCount = useMemo(() => filtered.filter((item) => {
    const tags = splitList((item as any)?.tags).map((x) => x.toLowerCase());
    return Boolean((item as any)?.featured || tags.includes('featured'));
  }).length, [filtered]);

  const remoteCount = useMemo(() => filtered.filter((item) => {
    const location = pick(item as any, ['location', 'city', 'jobLocation']).toLowerCase();
    const type = pick(item as any, ['type', 'jobType', 'employmentType']).toLowerCase();
    return location.includes('remote') || type.includes('remote');
  }).length, [filtered]);

  const activeFilterCount = [countryFilter, jobTypeFilter, q.trim()].filter(Boolean).length;
  const heroStats = managedViewActive
    ? [
        { label: 'Open roles', value: String(filtered.length || jobs.length), icon: 'briefcase' as const },
        { label: 'Applied', value: String(appliedIds.length), icon: 'file-text' as const },
        { label: 'Saved roles', value: String(savedIds.length), icon: 'bookmark' as const },
      ]
    : [
        { label: 'Open roles', value: String(filtered.length || jobs.length), icon: 'briefcase' as const },
        { label: 'Featured', value: String(featuredCount), icon: 'star' as const },
        { label: 'Saved roles', value: String(savedIds.length), icon: 'bookmark' as const },
      ];

  const heroTranslateY = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });
  const heroOpacity = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const filtersTranslateY = filtersEntrance.interpolate({ inputRange: [0, 1], outputRange: [34, 0] });
  const orbTranslateY = orbFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const badgeTranslateYA = badgeFloatA.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const badgeTranslateYB = badgeFloatB.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const shimmerX = shimmerTranslate.interpolate({ inputRange: [0, 1], outputRange: [-220, 220] });
  const pulseScale = pulseDot.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const pulseOpacity = pulseDot.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  const heroGlowTopTranslateX = badgeFloatB.interpolate({ inputRange: [0, 1], outputRange: [-8, 10] });
  const heroGlowBottomTranslateY = badgeFloatA.interpolate({ inputRange: [0, 1], outputRange: [0, 8] });
  const heroSweepOpacity = pulseDot.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.18] });
  const brandMarkScale = pulseDot.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const visualScale = pulseDot.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });
  const statsTranslateY = badgeFloatB.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const avatarHaloScale = pulseDot.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const visualScanX = shimmerTranslate.interpolate({ inputRange: [0, 1], outputRange: [-90, 90] });
  const microFloatA = badgeFloatA.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const microFloatB = badgeFloatB.interpolate({ inputRange: [0, 1], outputRange: [0, 8] });
  const avatarOrbitRotate = shimmerTranslate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const signalBarOne = pulseDot.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const signalBarTwo = badgeFloatA.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  const signalBarThree = badgeFloatB.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] });
  const brandUnderlineScale = pulseDot.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  const ambientRibbonX = ambientRibbon.interpolate({ inputRange: [0, 1], outputRange: [-36, 26] });
  const ambientRibbonReverseX = ambientRibbon.interpolate({ inputRange: [0, 1], outputRange: [22, -20] });
  const ambientRibbonRotate = ambientRibbon.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '12deg'] });
  const headlineTranslateY = headlineFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const headlineGlowOpacity = headlineFloat.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.26] });

  const renderEmpty = () => loading ? (
    <View style={styles.skeletonWrap}>
      <Skeleton height={160} />
      <Skeleton height={160} />
    </View>
  ) : (
    <EmptyState icon="o" title={errorMessage ? 'Unable to load roles' : 'No roles found'} message={errorMessage || 'Try different keywords or refresh.'} />
  );

  return (
    <Screen padded={false}>
      <FlatList
        ref={listRef}
        contentContainerStyle={styles.content}
        data={filtered}
        keyExtractor={(item) => String(item._id || (item as any)?.id || jobKey(item))}
        showsVerticalScrollIndicator={false}
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
          <View>
            {managedViewActive ? (
              <ManagedViewBanner
                candidateName={managedCandidateName}
                subtitle="Browsing live roles for the active managed candidate under your agent session."
                actionLabel="Change Agent Desk"
                onExit={exitManagedView}
              />
            ) : null}
            <Animated.View style={[styles.heroShell, { opacity: heroOpacity, transform: [{ translateY: heroTranslateY }] }]}>
              <LinearGradient colors={t.colors.gradientHeader as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
                <Animated.View pointerEvents="none" style={[styles.heroShimmer, { opacity: heroSweepOpacity, transform: [{ translateX: shimmerX }, { rotate: '18deg' }] }]}>
                  <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']} style={styles.heroShimmerFill} />
                </Animated.View>
                <Animated.View style={[styles.heroGlowTop, { transform: [{ translateX: heroGlowTopTranslateX }, { scale: visualScale }] }]} />
                <Animated.View style={[styles.heroGlowBottom, { transform: [{ translateY: heroGlowBottomTranslateY }] }]} />
                <Animated.View style={[styles.heroMicroOrb, styles.heroMicroOrbLeft, { transform: [{ translateY: microFloatA }, { scale: brandMarkScale }] }]} />
                <Animated.View style={[styles.heroMicroOrb, styles.heroMicroOrbRight, { transform: [{ translateY: microFloatB }] }]} />
                <Animated.View pointerEvents="none" style={[styles.heroAmbientRibbon, { opacity: heroSweepOpacity, transform: [{ translateX: ambientRibbonX }, { rotate: ambientRibbonRotate }] }]} />
                <Animated.View pointerEvents="none" style={[styles.heroAmbientRibbonSecondary, { opacity: headlineGlowOpacity, transform: [{ translateX: ambientRibbonReverseX }, { translateY: heroGlowBottomTranslateY }, { rotate: '-22deg' }] }]} />

                <View style={styles.heroBrandRow}>
                  <View style={styles.brandPill}>
                    <Animated.View style={[styles.brandPillMark, { transform: [{ scale: brandMarkScale }] }]}>
                      <View style={styles.brandPillMarkGlow} />
                      <Image source={require('../../../assets/blue-whale-favicon.png')} style={styles.brandPillIcon} resizeMode="contain" />
                    </Animated.View>
                    <Text style={[styles.brandPillText, { fontFamily: t.typography.fontFamily.bold }]}>{managedViewActive ? 'Blue Whale Managed Desk' : 'Blue Whale Agent Desk'}</Text>
                  </View>
                  <View style={styles.heroBrandControls}>
                    {managedViewActive ? (
                      <Pressable onPress={exitManagedView} style={({ pressed }) => [styles.heroDeskButton, pressed && styles.pressed]}>
                        <Feather name="repeat" size={13} color="#1B4E9D" />
                        <Text style={[styles.heroDeskButtonText, { fontFamily: t.typography.fontFamily.bold }]}>Change Agent Desk</Text>
                      </Pressable>
                    ) : null}
                    <View style={styles.heroAvatarWrap}>
                      <Animated.View pointerEvents="none" style={[styles.heroAvatarOrbit, { transform: [{ rotate: avatarOrbitRotate }] }]}>
                        <View style={styles.heroAvatarOrbitDot} />
                      </Animated.View>
                      <Animated.View pointerEvents="none" style={[styles.heroAvatarHalo, { transform: [{ scale: avatarHaloScale }], opacity: pulseOpacity }]} />
                      {avatarUri && !avatarFailed ? (
                        <Image source={{ uri: avatarUri }} style={styles.avatarImage} onError={() => setAvatarFailed(true)} />
                      ) : (
                        <Feather name="user" size={18} color="#E9F1FF" />
                      )}
                    </View>
                  </View>
                </View>

                <View style={styles.heroMainRow}>
                  <View style={styles.heroTextColumn}>
                    <Text style={[styles.heroEyebrow, { fontFamily: t.typography.fontFamily.medium }]}>{managedViewActive ? 'Managed candidate jobs desk' : 'Candidate operations hub'}</Text>
                    <Animated.View style={[styles.heroTitleWrap, { transform: [{ translateY: headlineTranslateY }] }]}>
                      <Animated.View pointerEvents="none" style={[styles.heroTitleGlow, { opacity: headlineGlowOpacity, transform: [{ scale: brandMarkScale }] }]} />
                      <Text style={[styles.heroTitle, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.82}>
                        {companyName}
                      </Text>
                    </Animated.View>
                    <Animated.View style={[styles.heroSupportPill, { transform: [{ translateY: badgeTranslateYB }] }]}>
                      <Animated.View style={[styles.heroSupportDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                      <Text style={[styles.heroSupportText, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{supportLabel}</Text>
                    </Animated.View>
{!veryShortScreen ? (
                      <Text style={[styles.heroSubtitle, { fontFamily: t.typography.fontFamily.medium }]}>
                        {managedViewActive
                          ? `Welcome back to ${managedCandidateName}'s home desk. Review live roles, compare agent pricing, and manage this candidate's next steps.`
                          : `Welcome back, ${displayName}. Review open roles, compare agent pricing, and manage submissions for your candidates.`}
                      </Text>
                    ) : null}
                    <View style={[styles.heroSignalBars, veryShortScreen && styles.heroSignalBarsCompact]}>
                      <Animated.View style={[styles.heroSignalBar, { transform: [{ scaleY: signalBarOne }] }]} />
                      <Animated.View style={[styles.heroSignalBar, styles.heroSignalBarMid, { transform: [{ scaleY: signalBarTwo }] }]} />
                      <Animated.View style={[styles.heroSignalBar, styles.heroSignalBarTall, { transform: [{ scaleY: signalBarThree }] }]} />
                      <Animated.View style={[styles.heroSignalUnderline, { transform: [{ scaleX: brandUnderlineScale }] }]} />
                    </View>
                  </View>

                  <View style={styles.heroVisualPanel}>
                    <Animated.View style={[styles.heroVisualCard, { transform: [{ translateY: orbTranslateY }, { scale: visualScale }] }]}>
                      <Animated.View pointerEvents="none" style={[styles.heroVisualScan, { transform: [{ translateX: visualScanX }, { rotate: '24deg' }] }]}>
                        <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.34)', 'rgba(255,255,255,0)']} style={styles.heroVisualScanFill} />
                      </Animated.View>
                      <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.1)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroVisualFill}>
                        <Animated.View style={[styles.heroVisualSpark, { opacity: pulseOpacity, transform: [{ scale: brandMarkScale }] }]} />
                        <Animated.View style={[styles.heroVisualAccent, { transform: [{ scaleX: brandUnderlineScale }] }]} />
                        <View style={styles.heroLogoTile}>
                          <Image source={require('../../../assets/blue-whale-favicon.png')} style={styles.heroLogoMark} resizeMode="contain" />
                        </View>
                        
                      </LinearGradient>
                    </Animated.View>
                    <Animated.View style={[styles.heroSignalPill, { transform: [{ translateY: badgeTranslateYA }, { translateX: heroGlowTopTranslateX }] }]}>
                      <Animated.View style={[styles.heroSignalDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                      <Text style={styles.heroSignalText}>Live roles</Text>
                    </Animated.View>
                  </View>
                </View>

                {!veryShortScreen ? (
                  <Animated.View style={[styles.heroStatsRow, { transform: [{ translateY: statsTranslateY }] }]}>
                    {heroStats.map((stat, index) => {
                      const translateY = statAnimations[index].interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
                      return (
                        <Animated.View key={stat.label} style={[styles.heroStatCard, shortScreen && styles.heroStatCardCompact, { opacity: statAnimations[index], transform: [{ translateY }] }]}>
                          <View style={[styles.heroStatIcon, shortScreen && styles.heroStatIconCompact]}>
                            <Feather name={stat.icon} size={shortScreen ? 10 : 12} color="#FFFFFF" />
                          </View>
                          <Text style={[styles.heroStatValue, shortScreen && styles.heroStatValueCompact, { fontFamily: t.typography.fontFamily.bold }]}>{stat.value}</Text>
                          <Text style={[styles.heroStatLabel, shortScreen && styles.heroStatLabelCompact, { fontFamily: t.typography.fontFamily.medium }]}>{stat.label}</Text>
                        </Animated.View>
                      );
                    })}
                  </Animated.View>
                ) : null}
              </LinearGradient>
            </Animated.View>

            {!veryShortScreen ? (
              <View style={styles.quickActionsHeader}>
                <View>
                  <Text style={[styles.sectionTitle, shortScreen && styles.sectionTitleCompact, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]}>{managedViewActive ? 'Candidate shortcuts' : 'Agent shortcuts'}</Text>
                </View>
              </View>
            ) : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickRow}
            >
              {quickActions.map((item, index) => {
                const translateY = quickAnimations[index].interpolate({ inputRange: [0, 1], outputRange: [22, 0] });
                const isPressed = pressedQuickAction === item.key;
                return (
                  <Animated.View key={item.key} style={{ opacity: quickAnimations[index], transform: [{ translateY }] }}>
                    <Pressable
                      onPress={item.action}
                      onPressIn={() => setPressedQuickAction(item.key)}
                      onPressOut={() => setPressedQuickAction((current) => (current === item.key ? null : current))}
                      style={({ pressed }) => [
                        styles.quickCard,
                        {
                          width: quickCardWidth,
                          backgroundColor: item.tint,
                          borderColor: isPressed ? item.gradient[0] : item.active ? '#C8D9F7' : '#D8E4F6',
                        },
                        item.active ? styles.quickCardActive : styles.quickCardIdle,
                        isPressed && styles.quickCardPressedSoft,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.quickCardFill}>
                        <LinearGradient colors={item.gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quickCardGlow} />
                        <LinearGradient colors={item.gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quickIconChip}>
                          <Feather name={item.icon} size={16} color="#F8FAFC" />
                        </LinearGradient>
                        <Text style={[styles.quickText, { color: '#15306F', fontFamily: t.typography.fontFamily.bold }]} numberOfLines={2}>
                          {item.key}
                        </Text>
                        <Text style={[styles.quickCaption, { color: '#65789A', fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{item.caption}</Text>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </ScrollView>

            <Animated.View
              style={[
                styles.discoveryPanel,
                {
                  opacity: heroOpacity,
                  transform: [{ translateY: filtersTranslateY }],
                  backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.88)' : 'rgba(248, 250, 252, 0.88)',
                  borderColor: t.colors.border,
                },
                t.shadow.card,
              ]}
            >
              <LinearGradient
                colors={t.isDark ? (['rgba(79, 113, 210, 0.18)', 'rgba(15, 121, 197, 0.06)'] as any) : (['rgba(27, 56, 144, 0.08)', 'rgba(15, 121, 197, 0.03)'] as any)}
                style={styles.discoveryTint}
              />
              <Animated.View pointerEvents="none" style={[styles.discoveryShimmer, { transform: [{ translateX: shimmerX }, { rotate: '18deg' }] }]}>
                <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']} style={styles.discoveryShimmerFill} />
              </Animated.View>

              {!shortScreen ? <View style={styles.discoveryTopRow}>
                <View style={styles.discoveryCopy}>
                  <Text style={[styles.discoveryTitle, { fontFamily: t.typography.fontFamily.bold }]}>Search roles for your candidates with faster filtering.</Text>
                </View>
                <View style={[styles.discoveryLivePill, { backgroundColor: t.isDark ? 'rgba(79, 113, 210, 0.2)' : 'rgba(15, 121, 197, 0.1)' }]}>
                  <Animated.View style={[styles.discoveryPulseDot, { backgroundColor: t.colors.secondary, opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                  <Text style={[styles.discoveryLiveText, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]}>Live</Text>
                </View>
              </View> : null}

              <View style={[styles.searchBox, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF', borderColor: searchFocused ? t.colors.secondary : t.colors.borderStrong }]}>
                <View style={[styles.searchIconWrap, { backgroundColor: t.isDark ? 'rgba(79, 113, 210, 0.18)' : 'rgba(15, 121, 197, 0.08)' }]}>
                  <Feather name="search" size={18} color={t.colors.secondary} />
                </View>
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Search roles, company, salary, or requirements..."
                  placeholderTextColor={t.colors.grayMutedDark}
                  style={[styles.search, { color: t.colors.text, fontFamily: t.typography.fontFamily.medium }]}
                  returnKeyType="search"
                  onSubmitEditing={() => load({ silent: true })}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
                <Pressable onPress={() => load({ silent: true })} style={({ pressed }) => [styles.searchAction, pressed && styles.pressed]}>
                  <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.searchActionFill}>
                    <Feather name="arrow-right" size={16} color="#FFFFFF" />
                  </LinearGradient>
                </Pressable>
              </View>

              <View style={styles.filterRow}>
                <Pressable
                  style={[styles.filterSelect, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF', borderColor: countryOpen ? t.colors.secondary : t.colors.border }]}
                  onPress={() => {
                    setCountryOpen((v) => !v);
                    setJobTypeOpen(false);
                  }}
                >
                  <Feather name="map-pin" size={16} color={t.colors.secondary} />
                  <Text style={[styles.filterSelectText, { color: t.colors.text, fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                    {countryDraft}
                  </Text>
                  <Feather name={countryOpen ? 'chevron-up' : 'chevron-down'} size={16} color={t.colors.primary} />
                </Pressable>

                <Pressable
                  style={[styles.filterSelect, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF', borderColor: jobTypeOpen ? t.colors.secondary : t.colors.border }]}
                  onPress={() => {
                    setJobTypeOpen((v) => !v);
                    setCountryOpen(false);
                  }}
                >
                  <Feather name="briefcase" size={16} color={t.colors.secondary} />
                  <Text style={[styles.filterSelectText, { color: t.colors.text, fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                    {jobTypeDraft}
                  </Text>
                  <Feather name={jobTypeOpen ? 'chevron-up' : 'chevron-down'} size={16} color={t.colors.primary} />
                </Pressable>
              </View>

              <View style={[styles.actionRow, shortScreen && styles.actionRowCompact]}>
                <Pressable
                  style={({ pressed }) => [styles.primaryActionWrap, pressed && styles.pressed]}
                  onPress={() => {
                    setCountryFilter(countryDraft === 'All Countries' ? '' : countryDraft);
                    setJobTypeFilter(jobTypeDraft === 'All Job Types' ? '' : jobTypeDraft);
                    setCountryOpen(false);
                    setJobTypeOpen(false);
                  }}
                >
                  <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[styles.primaryActionFill, shortScreen && styles.primaryActionFillCompact]}>
                    <Feather name="sliders" size={16} color="#FFFFFF" />
                    <Text style={[styles.primaryActionText, { fontFamily: t.typography.fontFamily.bold }]}>Apply filters</Text>
                  </LinearGradient>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.secondaryAction, shortScreen && styles.secondaryActionCompact, { borderColor: t.colors.borderStrong, backgroundColor: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.76)' }, pressed && styles.pressed]}
                  onPress={() => {
                    setQ('');
                    setCountryDraft('All Countries');
                    setJobTypeDraft('All Job Types');
                    setCountryFilter('');
                    setJobTypeFilter('');
                    setCountryOpen(false);
                    setJobTypeOpen(false);
                  }}
                >
                  <Feather name="rotate-ccw" size={15} color={t.colors.primary} />
                  <Text style={[styles.secondaryActionText, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]}>Reset</Text>
                </Pressable>
              </View>

              {countryOpen ? (
                <View style={[styles.dropdownPanel, { backgroundColor: t.isDark ? 'rgba(11, 18, 32, 0.96)' : '#FFFFFF', borderColor: t.colors.border }]}>
                  {countryOptions.map((option) => (
                    <Pressable
                      key={option}
                      style={({ pressed }) => [styles.dropdownItem, { borderBottomColor: t.colors.border }, option === countryDraft && { backgroundColor: t.isDark ? 'rgba(79, 113, 210, 0.18)' : 'rgba(15, 121, 197, 0.08)' }, pressed && styles.pressed]}
                      onPress={() => {
                        setCountryDraft(option);
                        setCountryOpen(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: t.colors.text, fontFamily: option === countryDraft ? t.typography.fontFamily.bold : t.typography.fontFamily.medium }]}>{option}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {jobTypeOpen ? (
                <View style={[styles.dropdownPanel, { backgroundColor: t.isDark ? 'rgba(11, 18, 32, 0.96)' : '#FFFFFF', borderColor: t.colors.border }]}>
                  {jobTypeOptions.map((option) => (
                    <Pressable
                      key={option}
                      style={({ pressed }) => [styles.dropdownItem, { borderBottomColor: t.colors.border }, option === jobTypeDraft && { backgroundColor: t.isDark ? 'rgba(79, 113, 210, 0.18)' : 'rgba(15, 121, 197, 0.08)' }, pressed && styles.pressed]}
                      onPress={() => {
                        setJobTypeDraft(option);
                        setJobTypeOpen(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: t.colors.text, fontFamily: option === jobTypeDraft ? t.typography.fontFamily.bold : t.typography.fontFamily.medium }]}>{option}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {!shortScreen ? <View style={styles.filterInsightsRow}>
                <View style={[styles.insightChip, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.82)', borderColor: t.colors.border }]}>
                  <Text style={[styles.insightValue, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]}>{filtered.length}</Text>
                  <Text style={[styles.insightLabel, { color: t.colors.grayMutedDark, fontFamily: t.typography.fontFamily.medium }]}>matched roles</Text>
                </View>
                <View style={[styles.insightChip, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.82)', borderColor: t.colors.border }]}>
                  <Text style={[styles.insightValue, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]}>{remoteCount}</Text>
                  <Text style={[styles.insightLabel, { color: t.colors.grayMutedDark, fontFamily: t.typography.fontFamily.medium }]}>remote roles</Text>
                </View>
                <View style={[styles.insightChip, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.82)', borderColor: t.colors.border }]}>
                  <Text style={[styles.insightValue, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]}>{activeFilterCount}</Text>
                  <Text style={[styles.insightLabel, { color: t.colors.grayMutedDark, fontFamily: t.typography.fontFamily.medium }]}>filters</Text>
                </View>
              </View> : null}
            </Animated.View>

            <View
              style={styles.listHeaderRow}
              onLayout={(event) => {
                setJobsSectionOffset(event.nativeEvent.layout.y);
              }}
            >
              <View>
                <Text style={[styles.listHeaderTitle, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]}>Available Roles</Text>
              </View>
              <View style={[styles.listHeaderPill, { backgroundColor: t.isDark ? 'rgba(79, 113, 210, 0.2)' : 'rgba(15, 121, 197, 0.1)' }]}>
                <Text style={[styles.listHeaderPillText, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]}>{`${filtered.length} roles found`}</Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={renderEmpty}
        renderItem={({ item }) => {
          const title = pick(item, ['title', 'jobTitle', 'position'], 'Untitled role');
          const company = pick(item, ['company', 'companyName'], 'Company');
          const location = pick(item, ['location', 'city', 'jobLocation'], 'N/A');
          const jobType = pick(item, ['type', 'jobType', 'employmentType'], 'Type');
          const salary = pick(item, ['salary', 'salaryRange', 'salaryText'], 'N/A');
          const pricing = getPricingForCard(item, user);
          const tags = splitList((item as any)?.tags).map((x) => x.toLowerCase());
          const flags: string[] = [];
          if ((item as any)?.featured || tags.includes('featured')) flags.push('Featured');
          if ((item as any)?.urgent || tags.includes('urgent')) flags.push('Urgent');
          if ((item as any)?.visaSponsored || (item as any)?.visa_sponsored || tags.includes('visa sponsored')) flags.push('Visa Sponsored');
          const requirements = Array.from(new Set([...splitList((item as any)?.requirements), ...splitList((item as any)?.requirement), ...splitList((item as any)?.qualifications)]));
          const expiresRaw = pickAny(item, ['expiringAt', 'expiring_at', 'expiringDate', 'closingDate', 'applicationDeadline', 'deadline', 'expiryDate', 'expiry_date', 'expiresAt', 'expires_at', 'expireDate', 'endDate', 'end_date', 'lastDate', 'closeDate', 'closing_date', 'validTill', 'validUntil', 'availability.endDate'], '');
          const cardKey = jobKey(item);
          const isSaved = savedIds.includes(cardKey);
          const isApplied = appliedIds.includes(String(item._id || (item as any)?.id));

          return (
            <View style={{ ...styles.jobCard, backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.9)' : 'rgba(248, 250, 252, 0.82)', borderColor: t.colors.border }}>
              <View style={styles.jobTopRow}>
                <View style={styles.jobLeadRow}>
                  <Animated.View style={{ transform: [{ translateY: badgeTranslateYA }] }}>
                    <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.jobIconWrap}>
                      <Feather name="briefcase" size={18} color="#FFFFFF" />
                    </LinearGradient>
                  </Animated.View>
                  <View style={styles.jobCopy}>
                    <Text style={[styles.jobTitle, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                      {title}
                    </Text>
                    <View style={styles.badgeRow}>
                      <View style={styles.typePill}>
                        <Text style={[styles.typePillText, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                          {jobType}
                        </Text>
                      </View>
                      {flags.slice(0, 2).map((flag) => (
                        <View key={`${item._id}-${flag}`} style={[styles.badgePill, flag === 'Urgent' ? styles.badgeUrgent : flag === 'Visa Sponsored' ? styles.badgeVisa : styles.badgeFeatured]}>
                          <Text
                            style={[
                              styles.badgeText,
                              flag === 'Urgent' ? styles.badgeTextUrgent : flag === 'Visa Sponsored' ? styles.badgeTextVisa : styles.badgeTextFeatured,
                              { fontFamily: t.typography.fontFamily.bold },
                            ]}
                            numberOfLines={1}
                          >
                            {flag}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.favWrap, { backgroundColor: isSaved ? 'rgba(255, 84, 105, 0.14)' : t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.86)', borderColor: isSaved ? 'rgba(255, 84, 105, 0.22)' : t.colors.border }, pressed && styles.pressed]}
                  hitSlop={12}
                  onPress={() => toggleSavedJob(item, cardKey)}
                >
                  <Animated.View pointerEvents="none" style={[styles.favGlow, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                  <Feather name="heart" size={18} color={isSaved ? '#FF3B45' : t.colors.grayMutedDark} />
                </Pressable>
              </View>

              <Pressable onPress={() => navigation.navigate('JobDetails', { jobId: item._id })} style={({ pressed }) => [pressed && styles.pressed]}>
                <View style={styles.metaGrid}>
                  <View style={[styles.metaCard, styles.metaCardBlue]}>
                    <Feather name="map-pin" size={14} color={t.colors.secondary} />
                    <Text style={[styles.metaLineText, { color: '#23407F', fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{location}</Text>
                  </View>

                  <View style={[styles.metaCard, styles.metaCardPurple]}>
                    <Feather name="dollar-sign" size={14} color="#8E44AD" />
                    <Text style={[styles.metaLineText, styles.metaLineTextPurple, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{`Salary: ${salary}`}</Text>
                  </View>

                  <View style={[styles.metaCard, styles.metaCardGreen]}>
                    <Feather name="clock" size={14} color="#18A564" />
                    <Text style={[styles.metaLineText, styles.metaLineTextGreen, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{`Agent price: ${pricing}`}</Text>
                  </View>

                  <View style={[styles.metaCard, styles.metaCardOrange]}>
                    <Feather name="calendar" size={14} color="#D97706" />
                    <Text style={[styles.metaLineText, styles.metaLineTextOrange, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{`Expires: ${expiresRaw ? formatDate(expiresRaw) || expiresRaw : 'N/A'}`}</Text>
                  </View>
                </View>

                <View style={styles.requirementsBlock}>
                  <Text style={[styles.reqHeading, { color: '#1D2D4F', fontFamily: t.typography.fontFamily.bold }]}>Requirements:</Text>
                  <View style={styles.reqList}>
                    {requirements.length ? (
                      <>
                        {requirements.slice(0, 2).map((r) => (
                          <View key={`${item._id}-${r}`} style={styles.reqRow}>
                            <View style={styles.reqIcon}>
                              <Feather name="check-circle" size={17} color="#23BA6C" />
                            </View>
                            <Text style={[styles.reqText, { color: '#33435F', fontFamily: t.typography.fontFamily.medium }]}>{r}</Text>
                          </View>
                        ))}
                        {requirements.length > 2 ? <Text style={[styles.reqMore, { color: '#1D6FC7', fontFamily: t.typography.fontFamily.bold }]}>{`+${requirements.length - 2} more requirements`}</Text> : null}
                      </>
                    ) : (
                      <Text style={[styles.reqText, { color: '#33435F', fontFamily: t.typography.fontFamily.medium }]}>No requirements listed</Text>
                    )}
                  </View>
                </View>
              </Pressable>

              <View style={styles.cardButtonsRow}>
                <Pressable
                  style={({ pressed }) => [styles.detailsBtn, styles.detailsBtnFull, pressed && styles.pressed]}
                  onPress={(e) => {
                    e.stopPropagation();
                    navigation.navigate('JobDetails', { jobId: item._id });
                  }}
                >
                  <Feather name="file-text" size={16} color={t.colors.primary} />
                  <Text style={[styles.detailsBtnText, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]}>Review</Text>
                </Pressable>
              </View>
            </View>
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
    paddingBottom: 108,
  },
  skeletonWrap: {
    gap: 12,
  },
  heroShell: {
    marginBottom: 16,
  },
  heroCard: {
    borderRadius: 28,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  heroShimmer: {
    position: 'absolute',
    top: -40,
    left: 0,
    width: 120,
    height: 220,
  },
  heroShimmerFill: {
    flex: 1,
  },
  heroGlowTop: {
    position: 'absolute',
    top: -72,
    right: -24,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroGlowBottom: {
    position: 'absolute',
    bottom: -54,
    left: -28,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroMicroOrb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  heroMicroOrbLeft: {
    top: 54,
    right: 118,
  },
  heroMicroOrbRight: {
    bottom: 54,
    right: 90,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(167, 243, 208, 0.5)',
  },
  heroAmbientRibbon: {
    position: 'absolute',
    top: 78,
    left: -28,
    width: 180,
    height: 54,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroAmbientRibbonSecondary: {
    position: 'absolute',
    top: 26,
    right: 28,
    width: 120,
    height: 34,
    borderRadius: 20,
    backgroundColor: 'rgba(167,243,208,0.16)',
  },
  heroBrandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  brandPillMark: {
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    overflow: 'hidden',
  },
  brandPillMarkGlow: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(15,121,197,0.16)',
  },
  brandPillIcon: {
    width: 14,
    height: 14,
  },
  brandPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  heroBrandControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroDeskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroDeskButtonText: {
    color: '#1B4E9D',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  heroAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroAvatarOrbit: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  heroAvatarOrbitDot: {
    position: 'absolute',
    top: -2,
    left: 18,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#A7F3D0',
  },
  heroAvatarHalo: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTextColumn: {
    flex: 1,
    paddingRight: 10,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  heroTitleWrap: {
    marginTop: 8,
    position: 'relative',
    paddingRight: 4,
  },
  heroTitleGlow: {
    position: 'absolute',
    left: -6,
    right: 24,
    top: 8,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  heroSupportPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    maxWidth: '96%',
  },
  heroSupportDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 7,
    backgroundColor: '#A7F3D0',
  },
  heroSupportText: {
    color: '#F4F8FF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  heroSubtitle: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  heroSignalBars: {
    marginTop: 7,
    height: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  heroSignalBarsCompact: {
    marginTop: 4,
  },
  heroSignalBar: {
    width: 4,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  heroSignalBarMid: {
    height: 11,
    backgroundColor: 'rgba(255,255,255,0.68)',
  },
  heroSignalBarTall: {
    height: 14,
    backgroundColor: '#A7F3D0',
  },
  heroSignalUnderline: {
    marginLeft: 6,
    width: 34,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  heroVisualPanel: {
    width: 98,
    alignItems: 'flex-end',
  },
  heroVisualCard: {
    width: 94,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#09205A',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  heroVisualScan: {
    position: 'absolute',
    top: -10,
    left: 0,
    width: 34,
    height: 120,
    zIndex: 2,
  },
  heroVisualScanFill: {
    flex: 1,
  },
  heroVisualFill: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  heroVisualAccent: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(167, 243, 208, 0.85)',
  },
  heroVisualSpark: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  heroLogoTile: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLogoMark: {
    width: 24,
    height: 24,
  },
  heroLogo: {
    width: 70,
    height: 16,
    marginTop: 8,
  },
  heroSignalPill: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroSignalDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
    backgroundColor: '#A7F3D0',
  },
  heroSignalText: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  heroStatCard: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  heroStatIcon: {
    width: 22,
    height: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroStatValue: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '900',
  },
  heroStatLabel: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.76)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  heroStatCardCompact: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  heroStatIconCompact: {
    width: 18,
    height: 18,
    borderRadius: 7,
    marginBottom: 5,
  },
  heroStatValueCompact: {
    fontSize: 16,
    lineHeight: 18,
  },
  heroStatLabelCompact: {
    fontSize: 10,
    lineHeight: 12,
  },
  quickActionsHeader: {
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  sectionTitleCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  quickRow: {
    paddingTop: 14,
    paddingRight: 8,
    gap: 10,
    paddingBottom: 6,
  },
  quickCard: {
    minWidth: 102,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  quickCardActive: {
    shadowColor: '#315CA8',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  quickCardIdle: {
    shadowColor: '#7290C3',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  quickCardPressedSoft: {
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 4,
  },
  quickCardGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
  },
  quickCardFill: {
    minHeight: 82,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIconChip: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    textAlign: 'center',
    minHeight: 28,
  },
  quickCaption: {
    marginTop: 2,
    color: '#65789A',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '600',
    textAlign: 'center',
    minHeight: 11,
  },
  discoveryPanel: {
    borderWidth: 1,
    borderRadius: 26,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 12,
  },
  discoveryTint: {
    ...StyleSheet.absoluteFillObject,
  },
  discoveryShimmer: {
    position: 'absolute',
    top: -40,
    left: 0,
    width: 120,
    height: 380,
  },
  discoveryShimmerFill: {
    flex: 1,
  },
  discoveryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  discoveryCopy: {
    flex: 1,
  },
  discoveryTitle: {
    color: '#173B8E',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  discoveryLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  discoveryPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 7,
  },
  discoveryLiveText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  searchBox: {
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  searchAction: {
    borderRadius: 16,
  },
  searchActionFill: {
    width: 34,
    height: 34,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  filterSelect: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterSelectText: {
    flex: 1,
    marginLeft: 8,
    marginRight: 6,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionRowCompact: {
    gap: 6,
    marginTop: 8,
  },
  primaryActionWrap: {
    flex: 1,
    borderRadius: 18,
  },
  primaryActionFill: {
    minHeight: 42,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionFillCompact: {
    minHeight: 38,
    borderRadius: 14,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  secondaryAction: {
    minWidth: 104,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionCompact: {
    minWidth: 86,
    minHeight: 38,
    borderRadius: 14,
    paddingHorizontal: 10,
  },
  secondaryActionText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  dropdownPanel: {
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dropdownItem: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  dropdownItemText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  filterInsightsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  insightChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  insightValue: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '900',
  },
  insightLabel: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 12,
  },
  listHeaderTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  listHeaderPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  listHeaderPillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  jobCard: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },
  jobCardTint: {
    ...StyleSheet.absoluteFillObject,
  },
  jobCardSheen: {
    position: 'absolute',
    top: -30,
    left: 0,
    width: 90,
    height: 220,
  },
  jobCardSheenFill: {
    flex: 1,
  },
  jobTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  jobLeadRow: {
    flexDirection: 'row',
    flex: 1,
    paddingRight: 8,
  },
  jobIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  jobCopy: {
    flex: 1,
  },
  jobTitle: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
  },
  favWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFD',
    borderColor: '#DCE2F0',
    overflow: 'hidden',
  },
  favGlow: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 84, 105, 0.12)',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  typePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#DCEBFF',
  },
  typePillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    color: '#1A66B8',
  },
  badgePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  badgeFeatured: {
    backgroundColor: '#FDEAEA',
    borderColor: '#F8CFCF',
  },
  badgeUrgent: {
    backgroundColor: '#FFF1E8',
    borderColor: '#FFD8BF',
  },
  badgeVisa: {
    backgroundColor: '#FFF7DD',
    borderColor: '#F5E2A8',
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  badgeTextFeatured: {
    color: '#BD212A',
  },
  badgeTextUrgent: {
    color: '#D25913',
  },
  badgeTextVisa: {
    color: '#9A6A00',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaCard: {
    width: '48.5%',
    minHeight: 40,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaCardBlue: {
    backgroundColor: '#EAF4FF',
  },
  metaCardPurple: {
    backgroundColor: '#F1EAFD',
  },
  metaCardGreen: {
    backgroundColor: '#E7F8EF',
  },
  metaCardOrange: {
    backgroundColor: '#FCEFDF',
  },
  metaLineText: {
    marginLeft: 6,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    flex: 1,
  },
  metaLineTextPurple: {
    color: '#7D2EC4',
  },
  metaLineTextGreen: {
    color: '#049A5A',
  },
  metaLineTextOrange: {
    color: '#D25913',
  },
  requirementsBlock: {
    marginTop: 10,
  },
  reqHeading: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
    marginBottom: 6,
  },
  requirementsCount: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  reqList: {
    gap: 8,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  reqIcon: {
    marginTop: 1,
  },
  reqText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  reqMore: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  cardButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  detailsBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#5EA1E4',
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  detailsBtnFull: {
    flex: 1,
  },
  detailsBtnText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  applyBtn: {
    minHeight: 38,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  appliedBtn: {
    minHeight: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#33C16D',
    backgroundColor: '#CDEEDB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  appliedBtnText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.92,
  },
});









