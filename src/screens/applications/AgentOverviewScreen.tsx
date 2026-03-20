import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ApplicationsService, AuthService, DocumentsService, InquiriesService, JobsService, OverviewService } from '../../api/services';
import ManagedViewBanner from '../../components/managed/ManagedViewBanner';
import { Screen } from '../../components/ui';
import { useAuthStore } from '../../context/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import type { Application, DocumentGroups, Inquiry, Job } from '../../types/models';
import { formatDate } from '../../utils/format';
import { getManagedCandidate, getManagedCandidateId, getManagedCandidateName, isManagedViewActive, stripManagedViewState } from '../../utils/managedView';

const pickString = (values: any[], fallback = '') => {
  for (const value of values) {
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

const pickNumber = (obj: any, keys: string[], fallback = 0) => {
  for (const key of keys) {
    const value = pickPath(obj, key);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
};

const resolveUser = (payload: any) => payload?.user || payload?.data || payload || null;

const getCompanyName = (user: any) =>
  pickString([user?.companyName, user?.company?.name, user?.businessName, user?.agencyName, user?.organizationName, user?.name, user?.fullName], 'Agent workspace');

const getGreetingName = (user: any) => {
  const firstLast = `${String(user?.firstName || '').trim()} ${String(user?.lastName || '').trim()}`.trim();
  return pickString([user?.contactPerson, user?.fullName, user?.name, firstLast, String(user?.email || '').split('@')[0]], 'there');
};

const countDocuments = (groups?: DocumentGroups | null) => {
  if (!groups || typeof groups !== 'object') return 0;
  return ['photo', 'passport', 'drivingLicense', 'cv'].reduce((total, key) => total + (Array.isArray((groups as any)?.[key]) ? (groups as any)[key].length : 0), 0);
};

const isVerifiedAgent = (user: any) =>
  Boolean(
    user?.isVerified ||
      user?.verified ||
      user?.companyVerified ||
      String(user?.verificationStatus || user?.status || '').toLowerCase().includes('verified')
  );

const extractCandidates = (profile: any) => {
  const keys = ['managedCandidates', 'candidates', 'recentCandidates', 'candidateList'];
  for (const key of keys) {
    if (Array.isArray(profile?.[key])) return profile[key];
  }
  return [] as any[];
};

const getStatusBucket = (status: string) => {
  const value = String(status || '').trim().toLowerCase();
  if (!value || value.includes('pending') || value.includes('submitted') || value.includes('new') || value.includes('applied')) return 'pending';
  if (value.includes('review') || value.includes('screen') || value.includes('shortlist') || value.includes('progress') || value.includes('processing')) return 'reviewed';
  if (value.includes('accept') || value.includes('approve') || value.includes('hired') || value.includes('success') || value.includes('complete')) return 'approved';
  if (value.includes('reject') || value.includes('declin') || value.includes('cancel') || value.includes('fail')) return 'rejected';
  return 'pending';
};

const getProfileCompletion = (user: any) => {
  const checkpoints = [
    pickString([user?.companyName, user?.company?.name]),
    pickString([user?.contactPerson, user?.name, user?.fullName]),
    pickString([user?.email]),
    pickString([user?.phone]),
    pickString([user?.companyAddress, user?.address, user?.location]),
    pickString([user?.companyLogo, user?.logo, user?.avatarUrl, user?.profileImage]),
    pickString([user?.about, user?.aboutMe, user?.description, user?.companyDescription]),
  ];
  const complete = checkpoints.filter(Boolean).length;
  return Math.max(12, Math.round((complete / checkpoints.length) * 100));
};

const quickLinks = [
  { key: 'overview', label: 'Overview', caption: 'Dashboard home', icon: 'activity' as const, action: null, gradient: ['#0B7A75', '#30C7B5'] as const, tint: '#E9FBF7' },
  { key: 'candidates', label: 'Managed Candidates', caption: 'Manage profiles', icon: 'users' as const, action: 'Candidates', gradient: ['#1B4AA3', '#1279C5'] as const, tint: '#EAF1FF' },
  { key: 'profile', label: 'Profile', caption: 'Your account', icon: 'user' as const, action: 'Me', gradient: ['#A61E4D', '#F7677A'] as const, tint: '#FFF1F3' },
  { key: 'roles', label: 'Roles', caption: 'Browse jobs', icon: 'briefcase' as const, action: 'Home', gradient: ['#155EEF', '#46A6FF'] as const, tint: '#EAF3FF' },
  { key: 'analytics', label: 'Analytics', caption: 'Review insights', icon: 'bar-chart-2' as const, action: 'Analytics', gradient: ['#6F3FF5', '#B77CFF'] as const, tint: '#F4EEFF' },
  { key: 'chat', label: 'Chat', caption: 'Team threads', icon: 'message-circle' as const, action: 'Chat', gradient: ['#6F3FF5', '#B77CFF'] as const, tint: '#F4EEFF' },
];

const managedQuickActionMeta = [
  { key: 'overview', label: 'Overview', caption: 'Candidate summary', icon: 'activity' as const, gradient: ['#2C7BE5', '#7CC6FF'] as const, tint: '#EEF6FF' },
  { key: 'applications', label: 'Applications', caption: 'Track pipeline', icon: 'file-text' as const, gradient: ['#1B4AA3', '#1279C5'] as const, tint: '#EAF1FF' },
  { key: 'analytics', label: 'Analytics', caption: 'Review insights', icon: 'bar-chart-2' as const, gradient: ['#0B7A75', '#30C7B5'] as const, tint: '#E9FBF7' },
  { key: 'chat', label: 'Chat', caption: 'Candidate threads', icon: 'message-circle' as const, gradient: ['#6F3FF5', '#B77CFF'] as const, tint: '#F4EEFF' },
  { key: 'inquiries', label: 'Inquiries', caption: 'Candidate questions', icon: 'help-circle' as const, gradient: ['#C77719', '#F4A340'] as const, tint: '#FFF5E8' },
  { key: 'me', label: 'Profile', caption: 'Candidate profile', icon: 'user' as const, gradient: ['#A61E4D', '#F7677A'] as const, tint: '#FFF1F3' },
  { key: 'documents', label: 'Documents', caption: 'Stored files', icon: 'folder' as const, gradient: ['#1B4AA3', '#1279C5'] as const, tint: '#EAF1FF' },
  { key: 'tasks', label: 'Tasks', caption: 'Open follow-ups', icon: 'check-square' as const, gradient: ['#0B7A75', '#30C7B5'] as const, tint: '#E9FBF7' },
  { key: 'meetings', label: 'Meetings', caption: 'Upcoming sessions', icon: 'calendar' as const, gradient: ['#6F3FF5', '#B77CFF'] as const, tint: '#F4EEFF' },
  { key: 'invoices', label: 'Invoices', caption: 'Billing records', icon: 'credit-card' as const, gradient: ['#A61E4D', '#F7677A'] as const, tint: '#FFF1F3' },
];

const candidateStatusPillMeta = {
  pending: { label: 'Pending', bg: '#FFF6D8', border: '#F6E39A', text: '#B57206', icon: 'clock' as const },
  reviewed: { label: 'Reviewed', bg: '#E8F1FF', border: '#BCD4FB', text: '#2969D8', icon: 'eye' as const },
  approved: { label: 'Approved', bg: '#E8F8EC', border: '#BFE8CB', text: '#159451', icon: 'check-circle' as const },
  rejected: { label: 'Rejected', bg: '#FFF0F2', border: '#F4CCD4', text: '#D63655', icon: 'x-circle' as const },
};

const applicationStatusPillMeta = {
  pending: { label: 'Pending', bg: '#FFF6D8', border: '#F6E39A', text: '#B57206', icon: 'clock' as const },
  reviewed: { label: 'In Review', bg: '#E8F1FF', border: '#BCD4FB', text: '#2969D8', icon: 'eye' as const },
  approved: { label: 'Accepted', bg: '#E8F8EC', border: '#BFE8CB', text: '#159451', icon: 'check-circle' as const },
  rejected: { label: 'Rejected', bg: '#FFF0F2', border: '#F4CCD4', text: '#D63655', icon: 'x-circle' as const },
};

export default function AgentOverviewScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const storeUser = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const signIn = useAuthStore((s) => s.signIn);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(storeUser || null);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [documents, setDocuments] = useState<DocumentGroups | null>(null);
  const [shortcutPressedKey, setShortcutPressedKey] = useState<string | null>(null);
  const [managedPressedKey, setManagedPressedKey] = useState<string | null>(null);
  const managedViewActive = useMemo(() => isManagedViewActive(storeUser), [storeUser]);
  const managedCandidateId = useMemo(() => getManagedCandidateId(storeUser), [storeUser]);
  const managedCandidate = useMemo(() => getManagedCandidate(storeUser), [storeUser]);
  const managedCandidateName = useMemo(() => getManagedCandidateName(storeUser), [storeUser]);
  const entrance = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);

    const [overviewRes, profileRes, applicationsRes, jobsRes, inquiriesRes, documentsRes] = await Promise.allSettled([
      managedViewActive && managedCandidateId ? OverviewService.getManagedCandidateDashboard(managedCandidateId) : OverviewService.getAgentDashboard(),
      managedViewActive ? Promise.resolve(managedCandidate || storeUser || null) : AuthService.getProfile(),
      ApplicationsService.my(managedCandidateId ? { candidateId: managedCandidateId, managedCandidateId } : undefined),
      JobsService.list(),
      InquiriesService.listMine(),
      DocumentsService.list(managedCandidateId ? { managedCandidateId } : undefined),
    ]);

    setOverviewData(overviewRes.status === 'fulfilled' ? overviewRes.value : null);
    setProfile(
      overviewRes.status === 'fulfilled' && overviewRes.value?.user
        ? resolveUser(overviewRes.value?.user)
        : profileRes.status === 'fulfilled'
          ? resolveUser(profileRes.value)
          : managedViewActive
            ? managedCandidate || storeUser || null
            : storeUser || null
    );
    setApplications(applicationsRes.status === 'fulfilled' ? (Array.isArray(applicationsRes.value) ? applicationsRes.value : (applicationsRes.value as any)?.applications || []) : []);
    setJobs(jobsRes.status === 'fulfilled' ? (Array.isArray(jobsRes.value) ? jobsRes.value : (jobsRes.value as any)?.jobs || []) : []);
    setInquiries(inquiriesRes.status === 'fulfilled' ? (Array.isArray(inquiriesRes.value) ? inquiriesRes.value : (inquiriesRes.value as any)?.inquiries || []) : []);
    setDocuments(documentsRes.status === 'fulfilled' ? (documentsRes.value as DocumentGroups) : null);

    if (!opts?.silent) setLoading(false);
  }, [managedCandidate, managedCandidateId, managedViewActive, storeUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  React.useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 520, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [entrance, float]);

  const statsColumns = width >= 840 ? 4 : 2;
  const splitLayout = width >= 840;
  const managedQuickCardWidth = Math.max(102, Math.min(138, Math.floor((width - 44) / 3)));
  const candidateStats = overviewData?.candidateStats || {};
  const applicationStats = overviewData?.applicationStats || {};
  const inquiryStats = overviewData?.inquiryStats || {};
  const documentStats = overviewData?.documentStats || {};
  const recentMessagesCount = useMemo(
    () => pickNumber(overviewData, ['recentMessagesCount', 'recentMessages.length'], Array.isArray(overviewData?.recentMessages) ? overviewData.recentMessages.length : 0),
    [overviewData]
  );
  const candidateList = useMemo(() => {
    if (Array.isArray(overviewData?.recentCandidates)) return overviewData.recentCandidates;
    return extractCandidates(profile);
  }, [overviewData, profile]);
  const documentCount = useMemo(() => countDocuments(documents), [documents]);
  const companyName = useMemo(() => getCompanyName(profile), [profile]);
  const greetingName = useMemo(() => getGreetingName(profile), [profile]);
  const profileCompletion = useMemo(() => {
    const fromOverview = pickNumber(overviewData, ['profileCompletion'], -1);
    return fromOverview >= 0 ? fromOverview : getProfileCompletion(profile);
  }, [overviewData, profile]);
  const verifiedAgent = useMemo(() => isVerifiedAgent(profile), [profile]);

  const applicationCounts = useMemo(() => {
    const counts = {
      pending: pickNumber(applicationStats, ['pending', 'pendingCount', 'submitted', 'submittedCount'], 0),
      reviewed: pickNumber(applicationStats, ['inReview', 'reviewed', 'reviewedCount', 'inReviewCount', 'screening'], 0),
      approved: pickNumber(applicationStats, ['accepted', 'approved', 'acceptedCount', 'approvedCount'], 0),
      rejected: pickNumber(applicationStats, ['rejected', 'rejectedCount'], 0),
    };
    if (counts.pending || counts.reviewed || counts.approved || counts.rejected) return counts;
    applications.forEach((item) => {
      counts[getStatusBucket(String(item?.status || 'pending')) as keyof typeof counts] += 1;
    });
    return counts;
  }, [applicationStats, applications]);

  const candidateCounts = useMemo(() => {
    const counts = {
      pending: pickNumber(candidateStats, ['pending', 'pendingCount'], 0),
      reviewed: pickNumber(candidateStats, ['reviewed', 'inReview', 'reviewedCount', 'inReviewCount'], 0),
      approved: pickNumber(candidateStats, ['approved', 'accepted', 'approvedCount', 'acceptedCount'], 0),
      rejected: pickNumber(candidateStats, ['rejected', 'rejectedCount'], 0),
    };
    if (counts.pending || counts.reviewed || counts.approved || counts.rejected) return counts;
    candidateList.forEach((item: any) => {
      counts[getStatusBucket(String(item?.status || 'pending')) as keyof typeof counts] += 1;
    });
    return counts;
  }, [candidateList, candidateStats]);

  const recentApplications = useMemo(() => {
    if (Array.isArray(overviewData?.recentApplications)) return overviewData.recentApplications.slice(0, 5);
    return [...applications].sort((a: any, b: any) => new Date(b?.appliedAt || b?.createdAt || 0).getTime() - new Date(a?.appliedAt || a?.createdAt || 0).getTime()).slice(0, 5);
  }, [overviewData, applications]);

  const recentCandidates = useMemo(
    () => [...candidateList].sort((a: any, b: any) => new Date(b?.createdAt || b?.addedAt || 0).getTime() - new Date(a?.createdAt || a?.addedAt || 0).getTime()).slice(0, 3),
    [candidateList]
  );

  const totalApplicationCount =
    pickNumber(applicationStats, ['total', 'totalApplications', 'count'], applications.length) || applications.length;
  const totalCandidateCount =
    pickNumber(candidateStats, ['total', 'totalCandidates', 'count', 'managedCandidates'], candidateList.length) || candidateList.length;
  const totalJobs = pickNumber(overviewData, ['totalJobs'], jobs.length) || jobs.length;
  const totalInquiries = pickNumber(inquiryStats, ['total', 'totalInquiries', 'count'], inquiries.length) || inquiries.length;
  const totalDocuments = pickNumber(documentStats, ['total', 'totalDocuments', 'count'], documentCount) || documentCount;
  const successRate = totalApplicationCount ? Math.round((applicationCounts.approved / totalApplicationCount) * 100) : 0;
  const translateY = entrance.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  const exitManagedView = useCallback(async () => {
    if (!token || !storeUser) return;
    await signIn({ token, user: stripManagedViewState(storeUser) });
    navigation.getParent()?.navigate('Candidates' as never);
  }, [navigation, signIn, storeUser, token]);

  const handleOverviewBack = useCallback(async () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (navigation.getParent()?.canGoBack()) {
      navigation.getParent()?.goBack();
      return;
    }
    if (managedViewActive) {
      await exitManagedView();
      return;
    }
    navigation.navigate('Home');
  }, [exitManagedView, managedViewActive, navigation]);

  const overviewStats = [
    { key: 'candidates', label: 'Managed Candidates', value: String(totalCandidateCount), note: totalCandidateCount ? `${candidateCounts.approved} approved` : 'Sync when API is ready', badge: 'Live KPI', icon: 'users' as const, iconBg: '#DDEBFF', iconColor: '#1C6ED5', accent: '#1C6ED5', cardTint: '#F7FBFF' },
    { key: 'applications', label: 'Applications', value: String(totalApplicationCount), note: `${applicationCounts.approved} accepted`, badge: 'Live KPI', icon: 'clipboard' as const, iconBg: '#DCF8E5', iconColor: '#159451', accent: '#159451', cardTint: '#F6FFF9' },
    {
      key: 'inquiries',
      label: 'Inquiries',
      value: String(totalInquiries),
      note: `${pickNumber(inquiryStats, ['pending', 'pendingCount'], 0)} pending`,
      badge: 'Attention',
      icon: 'message-square' as const,
      iconBg: '#FFF3C6',
      iconColor: '#C07A06',
      accent: '#C07A06',
      cardTint: '#FFFBF2',
    },
    {
      key: 'documents',
      label: 'Documents',
      value: String(totalDocuments),
      note: `${pickNumber(documentStats, ['pendingReview', 'pendingReviewCount', 'pending'], 0)} pending review`,
      badge: 'Review',
      icon: 'file-text' as const,
      iconBg: '#F1E2FF',
      iconColor: '#8A46E6',
      accent: '#8A46E6',
      cardTint: '#FBF7FF',
    },
  ];

  const footerStats = [
    { key: 'roles', label: 'Available Roles', value: String(totalJobs), tone: '#1E4AA8' },
    { key: 'messages', label: 'Recent Messages', value: String(recentMessagesCount), tone: '#1A7B83' },
    { key: 'success', label: 'Success Rate', value: `${successRate}%`, tone: '#1D5FC7' },
  ];

  const managedOverviewUser = useMemo(() => resolveUser(overviewData?.user) || managedCandidate || profile || {}, [managedCandidate, overviewData, profile]);
  const managedDisplayName = useMemo(() => pickString([managedOverviewUser?.name, managedCandidateName], 'Managed candidate'), [managedCandidateName, managedOverviewUser]);
  const managedVisaStatus = useMemo(() => pickString([managedOverviewUser?.visaStatus, managedCandidate?.visaStatus], 'Not Started'), [managedCandidate, managedOverviewUser]);
  const managedSavedJobs = useMemo(() => pickNumber(overviewData, ['stats.savedJobs', 'stats.savedJobsCount'], Array.isArray(managedCandidate?.savedJobs) ? managedCandidate.savedJobs.length : 0), [managedCandidate, overviewData]);
  const managedTotalApplications = useMemo(() => pickNumber(overviewData, ['stats.totalApplications', 'stats.totalApplicationsCount'], totalApplicationCount), [overviewData, totalApplicationCount]);
  const managedAcceptedApplications = useMemo(() => pickNumber(overviewData, ['stats.acceptedApplications', 'stats.acceptedApplicationsCount'], applicationCounts.approved), [applicationCounts.approved, overviewData]);
  const managedInReviewApplications = useMemo(() => pickNumber(overviewData, ['stats.inReviewApplications', 'stats.reviewedApplications', 'stats.reviewed'], applicationCounts.reviewed), [applicationCounts.reviewed, overviewData]);
  const managedPendingApplications = useMemo(() => pickNumber(overviewData, ['stats.pendingApplications', 'stats.pending'], applicationCounts.pending), [applicationCounts.pending, overviewData]);
  const managedRejectedApplications = useMemo(() => pickNumber(overviewData, ['stats.rejectedApplications', 'stats.rejected'], applicationCounts.rejected), [applicationCounts.rejected, overviewData]);
  const managedResponseRate = managedTotalApplications ? Math.round(((managedAcceptedApplications + managedInReviewApplications) / managedTotalApplications) * 100) : 0;
  const managedOverviewStats = [
    { key: 'applications', label: 'Total Applications', value: String(managedTotalApplications), note: `${managedAcceptedApplications} accepted`, badge: 'Live KPI', icon: 'clipboard' as const, iconBg: '#DDEBFF', iconColor: '#1C6ED5', accent: '#1C6ED5', cardTint: '#F7FBFF' },
    { key: 'saved', label: 'Saved Jobs', value: String(managedSavedJobs), note: "Jobs you're interested in", badge: 'Tracked', icon: 'heart' as const, iconBg: '#FFE4E7', iconColor: '#E23F63', accent: '#E23F63', cardTint: '#FFF7FA' },
    { key: 'roles', label: 'Available Jobs', value: String(totalJobs), note: 'Jobs you can apply for', badge: 'Browse', icon: 'briefcase' as const, iconBg: '#DCF8E5', iconColor: '#159451', accent: '#159451', cardTint: '#F6FFF9' },
    { key: 'visa', label: 'Visa Status', value: managedVisaStatus, note: 'Current immigration stage', badge: 'Status', icon: 'globe' as const, iconBg: '#E6EAFF', iconColor: '#4E5CF2', accent: '#4E5CF2', cardTint: '#F7F8FF' },
  ];
  const managedQuickLinks = managedQuickActionMeta.map((item) => ({
    ...item,
    active: item.key === 'overview',
    action:
      item.key === 'applications'
        ? () => navigation.navigate('Applications')
        : item.key === 'analytics'
          ? () => navigation.navigate('Analytics')
          : item.key === 'chat'
            ? () => navigation.navigate('Chat', { screen: 'ChatList' })
            : item.key === 'inquiries'
              ? () => navigation.navigate('Inquiries', { screen: 'InquiryList' })
            : item.key === 'me'
              ? () => navigation.navigate('Me', { screen: 'ProfileHome' })
              : item.key === 'documents'
                ? () => navigation.navigate('Documents', { screen: 'DocumentsHome' })
                : item.key === 'tasks'
                  ? () => navigation.navigate('Tasks', { screen: 'TasksList' })
                  : item.key === 'meetings'
                    ? () => navigation.navigate('Meetings', { screen: 'MeetingsList' })
                    : item.key === 'invoices'
                      ? () => navigation.navigate('Invoices', { screen: 'InvoicesList' })
                    : undefined,
  }));
  const candidateSnapshot = [
    { key: 'email', label: 'Email', value: pickString([managedOverviewUser?.email, managedCandidate?.email], 'Not provided'), icon: 'mail' as const },
    { key: 'phone', label: 'Phone', value: pickString([managedOverviewUser?.phone, managedCandidate?.phone], 'Not provided'), icon: 'phone' as const },
    { key: 'location', label: 'Location', value: pickString([managedOverviewUser?.location, managedCandidate?.location, managedCandidate?.country], 'Not provided'), icon: 'map-pin' as const },
    { key: 'profession', label: 'Profession', value: pickString([managedOverviewUser?.profession, managedCandidate?.profession], 'Not provided'), icon: 'briefcase' as const },
    { key: 'qualification', label: 'Qualification', value: pickString([managedOverviewUser?.qualification, managedCandidate?.qualification], 'Not provided'), icon: 'award' as const },
    { key: 'experience', label: 'Experience', value: pickString([managedOverviewUser?.experience, managedCandidate?.experience], 'Not provided'), icon: 'clock' as const },
  ];

  if (managedViewActive) {
    return (
      <Screen padded={false}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
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
        >
          <Animated.View style={[styles.topBar, { opacity: entrance, transform: [{ translateY }] }]}>
            <Pressable onPress={handleOverviewBack} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
              <Feather name="arrow-left" size={18} color="#1B3890" />
            </Pressable>
            <View style={styles.topCopy}>
              <Text style={[styles.topEyebrow, { color: t.colors.textMuted, fontFamily: t.typography.fontFamily.bold }]}>Candidate workspace</Text>
              <Text style={[styles.topTitle, { fontFamily: t.typography.fontFamily.bold }]}>Managed overview</Text>
            </View>
            <View style={styles.liveChipSolid}>
              <View style={styles.liveDot} />
              <Text style={[styles.liveChipText, { fontFamily: t.typography.fontFamily.bold }]}>{loading ? 'Syncing' : 'Live'}</Text>
            </View>
          </Animated.View>

          <ManagedViewBanner
            candidateName={managedDisplayName}
            subtitle={`Managing candidate profile for ${managedDisplayName}`}
            actionLabel="Return to Agent Dashboard"
            onExit={exitManagedView}
          />

          <Animated.View style={{ opacity: entrance, transform: [{ translateY }] }}>
            <LinearGradient colors={t.colors.gradientHeader as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
              <View style={styles.heroGlowBlue} />
              <Animated.View style={[styles.heroGlowSoft, { transform: [{ translateY: floatY }] }]} />

              <View style={styles.eyebrowRow}>
                <View style={styles.eyebrowPill}>
                  <Feather name="activity" size={13} color="#FFFFFF" />
                  <Text style={[styles.eyebrowText, { fontFamily: t.typography.fontFamily.bold }]}>Managed candidate overview</Text>
                </View>
                <View style={styles.livePill}>
                  <View style={styles.liveDot} />
                  <Text style={[styles.liveText, { fontFamily: t.typography.fontFamily.bold }]}>{loading ? 'Syncing' : 'Live'}</Text>
                </View>
              </View>

              <View style={[styles.heroHeader, splitLayout && styles.heroHeaderWide]}>
                <View style={styles.heroCopy}>
                  <Text style={[styles.heroGreeting, { fontFamily: t.typography.fontFamily.medium }]}>Dashboard Overview</Text>
                  <View style={styles.heroTitleWrap}>
                    <View style={styles.heroTitleGlow} />
                    <Text style={[styles.heroTitle, { fontFamily: t.typography.fontFamily.bold }]}>Welcome back, {managedDisplayName}</Text>
                  </View>
                  <Text style={[styles.heroBody, { fontFamily: t.typography.fontFamily.medium }]}>This candidate dashboard is running in managed mode under the current agent session.</Text>
                </View>

                <View style={styles.companyCard}>
                  <View style={styles.companyIconWrap}>
                    <Feather name="user" size={20} color="#4868A8" />
                  </View>
                  <View style={styles.companyCopy}>
                    <Text style={[styles.companyName, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={2}>{managedDisplayName}</Text>
                    <View style={styles.verifiedRow}>
                      <Feather name="user" size={14} color="rgba(255,255,255,0.82)" />
                      <Text style={[styles.verifiedText, { color: 'rgba(255,255,255,0.82)', fontFamily: t.typography.fontFamily.bold }]}>Candidate</Text>
                    </View>
                  </View>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.managedQuickActionsHeader}>
              <Text style={[styles.managedQuickActionsTitle, { fontFamily: t.typography.fontFamily.bold }]}>Quick actions</Text>
              <Text style={[styles.managedQuickActionsBody, { fontFamily: t.typography.fontFamily.medium }]}>Jump into candidate-specific sections from one rail.</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.managedQuickRow}>
              {managedQuickLinks.map((item) => {
                const activeCard = item.active;
                const pressedCard = managedPressedKey === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={item.action}
                    onPressIn={() => item.action && setManagedPressedKey(item.key)}
                    onPressOut={() => setManagedPressedKey((current) => (current === item.key ? null : current))}
                    disabled={!item.action}
                    style={({ pressed }) => [
                      styles.managedQuickCard,
                      {
                        width: managedQuickCardWidth,
                        backgroundColor: item.tint,
                        borderColor: pressedCard ? item.gradient[0] : activeCard ? '#C8D9F7' : '#D8E4F6',
                      },
                      activeCard ? styles.managedQuickCardActive : styles.managedQuickCardIdle,
                      pressedCard && styles.managedQuickCardPressedSoft,
                      pressed && item.action && styles.pressed,
                    ]}
                  >
                    <View style={styles.managedQuickCardFill}>
                      <LinearGradient colors={item.gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.managedQuickGlow} />
                      <LinearGradient colors={item.gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.managedQuickIconChip}>
                        <Feather name={item.icon} size={16} color="#F8FAFC" />
                      </LinearGradient>
                      <Text style={[styles.managedQuickText, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{item.label}</Text>
                      <Text style={[styles.managedQuickCaption, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{item.caption}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.statsGrid}>
              {managedOverviewStats.map((item) => (
                <View key={item.key} style={[styles.statCard, { width: statsColumns === 4 ? '22.8%' : '47.2%', backgroundColor: item.cardTint, borderColor: `${item.accent}22` }]}>
                  <View style={[styles.statAccentBar, { backgroundColor: item.accent }]} />
                  <View style={[styles.statGlowOrb, { backgroundColor: `${item.accent}12` }]} />
                  <View style={styles.statCardTop}>
                    <View style={[styles.statIcon, styles.statIconElevated, { backgroundColor: item.iconBg, borderColor: `${item.accent}22` }] }>
                      <Feather name={item.icon} size={15} color={item.iconColor} />
                    </View>
                    <View style={styles.statValueWrap}>
                      <Text style={[styles.statValue, { color: item.accent, fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{item.value}</Text>
                      <View style={[styles.statBadge, { backgroundColor: `${item.accent}12`, borderColor: `${item.accent}20` }]}><View style={[styles.statBadgeDot, { backgroundColor: item.accent }]} /><Text style={[styles.statBadgeText, { color: item.accent, fontFamily: t.typography.fontFamily.bold }]}>{item.badge}</Text></View>
                    </View>
                  </View>
                  <Text style={[styles.statLabel, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{item.label}</Text>
                  <View style={[styles.statNotePill, { backgroundColor: `${item.accent}10`, borderColor: `${item.accent}18` }]}><Text style={[styles.statNote, { color: item.accent, fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{item.note}</Text></View>
                </View>
              ))}
            </View>

            <View style={styles.panelCard}>
              <View style={styles.panelHeader}>
                <Text style={[styles.panelTitle, { fontFamily: t.typography.fontFamily.bold }]}>Application Status Breakdown</Text>
              </View>
              <View style={styles.pillGrid}>
                {([
                  { key: 'pending', label: 'Pending', value: managedPendingApplications, meta: applicationStatusPillMeta.pending },
                  { key: 'reviewed', label: 'In Review', value: managedInReviewApplications, meta: applicationStatusPillMeta.reviewed },
                  { key: 'approved', label: 'Accepted', value: managedAcceptedApplications, meta: applicationStatusPillMeta.approved },
                  { key: 'rejected', label: 'Rejected', value: managedRejectedApplications, meta: applicationStatusPillMeta.rejected },
                ] as const).map((item) => (
                  <View key={item.key} style={[styles.statusPill, { backgroundColor: item.meta.bg, borderColor: item.meta.border }]}>
                    <Feather name={item.meta.icon} size={15} color={item.meta.text} />
                    <Text style={[styles.statusPillValue, { color: item.meta.text, fontFamily: t.typography.fontFamily.bold }]}>{item.value}</Text>
                    <Text style={[styles.statusPillLabel, { color: item.meta.text, fontFamily: t.typography.fontFamily.bold }]}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.profileCard}>
              <View style={styles.profileHeader}>
                <Text style={[styles.profileTitle, { fontFamily: t.typography.fontFamily.bold }]}>Profile Completion</Text>
                <Text style={[styles.profilePercent, { fontFamily: t.typography.fontFamily.bold }]}>{profileCompletion}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${profileCompletion}%` }]} />
              </View>
              <Text style={[styles.profileBody, { fontFamily: t.typography.fontFamily.medium }]}>This score comes from the managed candidate profile fields returned by the backend overview endpoint.</Text>
              <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={() => navigation.navigate('Me', { screen: 'ProfileHome' })}>
                <LinearGradient colors={['#1B4AA3', '#1279C5']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.primaryButtonFill}>
                  <Feather name="user" size={16} color="#FFFFFF" />
                  <Text style={[styles.primaryButtonText, { fontFamily: t.typography.fontFamily.bold }]}>Complete Profile</Text>
                </LinearGradient>
              </Pressable>
            </View>

            <View style={[styles.dualSection, splitLayout && styles.dualSectionWide]}>
              <View style={[styles.listPanel, splitLayout && styles.panelHalf]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Recent Applications</Text>
                  <Pressable onPress={() => navigation.navigate('Applications')} style={({ pressed }) => pressed && styles.pressed}>
                    <Text style={[styles.sectionLink, { fontFamily: t.typography.fontFamily.bold }]}>View All</Text>
                  </Pressable>
                </View>

                {recentApplications.length ? recentApplications.map((item: any) => {
                  const job = item?.job || {};
                  const jobId = String(job?._id || item?.jobId || '').trim();
                  const statusKey = getStatusBucket(String(item?.status || 'pending')) as keyof typeof applicationStatusPillMeta;
                  const statusMeta = applicationStatusPillMeta[statusKey];
                  const title = pickString([job?.title, job?.jobTitle, job?.position], 'Application');
                  const company = pickString([job?.company, job?.companyName], 'Company');
                  const location = pickString([job?.location, job?.city, job?.jobLocation], 'Location');
                  const appliedDate = formatDate(item?.appliedAt || item?.createdAt) || 'Recent';

                  return (
                    <Pressable
                      key={String(item?._id || jobId || title)}
                      style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}
                      onPress={() => {
                        if (jobId) navigation.navigate('Home', { screen: 'JobDetails', params: { jobId } });
                      }}
                    >
                      <View style={styles.listCardTop}>
                        <View style={styles.listCardCopy}>
                          <Text style={[styles.listTitle, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{title}</Text>
                          <Text style={[styles.listSub, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{company}</Text>
                        </View>
                        <View style={[styles.inlineBadge, { backgroundColor: statusMeta.bg, borderColor: statusMeta.border }]}>
                          <Text style={[styles.inlineBadgeText, { color: statusMeta.text, fontFamily: t.typography.fontFamily.bold }]}>{pickString([item?.status], statusMeta.label)}</Text>
                        </View>
                      </View>
                      <View style={styles.metaRow}>
                        <View style={styles.metaBox}>
                          <Feather name="map-pin" size={14} color="#1B6DC7" />
                          <Text style={[styles.metaBoxText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{location}</Text>
                        </View>
                        <View style={styles.metaBox}>
                          <Feather name="clock" size={14} color="#8D4DE8" />
                          <Text style={[styles.metaBoxText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{appliedDate}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                }) : (
                  <View style={styles.placeholderCard}>
                    <Feather name="clipboard" size={20} color="#5E7DB0" />
                    <Text style={[styles.placeholderTitle, { fontFamily: t.typography.fontFamily.bold }]}>No recent applications</Text>
                    <Text style={[styles.placeholderBody, { fontFamily: t.typography.fontFamily.medium }]}>Submitted applications will appear here once the first managed candidate submission is recorded.</Text>
                  </View>
                )}
              </View>

              <View style={[styles.listPanel, splitLayout && styles.panelHalf]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Candidate Snapshot</Text>
                  <Pressable onPress={() => navigation.navigate('Me', { screen: 'ProfileHome' })} style={({ pressed }) => pressed && styles.pressed}>
                    <Text style={[styles.sectionLink, { fontFamily: t.typography.fontFamily.bold }]}>Open Profile</Text>
                  </Pressable>
                </View>

                {candidateSnapshot.map((item) => (
                  <View key={item.key} style={styles.listCard}>
                    <View style={styles.metaBox}>
                      <Feather name={item.icon} size={14} color="#1B6DC7" />
                      <Text style={[styles.metaBoxText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{item.label}</Text>
                    </View>
                    <Text style={[styles.listTitle, { fontFamily: t.typography.fontFamily.bold, marginTop: 10 }]} numberOfLines={2}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.footerStats, width >= 840 && styles.footerStatsWide]}>
              {[
                { key: 'success', label: 'Success Rate', value: `${successRate}%`, tone: '#1D5FC7' },
                { key: 'response', label: 'Response Rate', value: `${managedResponseRate}%`, tone: '#15835D' },
                { key: 'jobs', label: 'Available Jobs', value: String(totalJobs), tone: '#1E4AA8' },
              ].map((item) => (
                <View key={item.key} style={styles.footerStatCard}>
                  <Text style={[styles.footerStatValue, { color: item.tone, fontFamily: t.typography.fontFamily.bold }]}>{item.value}</Text>
                  <Text style={[styles.footerStatLabel, { fontFamily: t.typography.fontFamily.medium }]}>{item.label}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </ScrollView>
      </Screen>
    );
  }
  return (
    <Screen padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
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
      >
        {managedViewActive ? (
          <ManagedViewBanner
            candidateName={managedCandidateName}
            subtitle="Overview, applications, and documents are scoped to the active managed candidate"
            onExit={exitManagedView}
          />
        ) : null}

        <Animated.View style={{ opacity: entrance, transform: [{ translateY }] }}>
          <LinearGradient colors={t.colors.gradientHeader as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
            <View style={styles.heroGlowBlue} />
            <Animated.View style={[styles.heroGlowSoft, { transform: [{ translateY: floatY }] }]} />

            <View style={styles.heroTopBar}>
              <View style={styles.heroNavCluster}>
                <Pressable onPress={handleOverviewBack} style={({ pressed }) => [styles.heroBackBtn, pressed && styles.pressed]}>
                  <Feather name="arrow-left" size={18} color="#FFFFFF" />
                </Pressable>
                <View style={styles.eyebrowPill}>
                  <Feather name="activity" size={13} color="#FFFFFF" />
                  <Text style={[styles.eyebrowText, { fontFamily: t.typography.fontFamily.bold }]}>Agent overview</Text>
                </View>
              </View>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={[styles.liveText, { fontFamily: t.typography.fontFamily.bold }]}>{loading ? 'Syncing' : 'Live'}</Text>
              </View>
            </View>

            <View style={[styles.heroHeader, splitLayout && styles.heroHeaderWide]}>
              <View style={styles.heroCopy}>
                <Text style={[styles.heroGreeting, { fontFamily: t.typography.fontFamily.medium }]}>{`Hi ${greetingName}`}</Text>
                <View style={styles.heroTitleWrap}>
                  <View style={styles.heroTitleGlow} />
                  <Text style={[styles.heroTitle, { fontFamily: t.typography.fontFamily.bold }]}>Dashboard Overview</Text>
                </View>
                <Text style={[styles.heroBody, { fontFamily: t.typography.fontFamily.medium }]}>Welcome back, {companyName}. Track submissions, document flow, and agent activity from one place.</Text>
              </View>

              <View style={styles.companyCard}>
                <View style={styles.companyIconWrap}>
                  <Feather name="briefcase" size={20} color="#4868A8" />
                </View>
                <View style={styles.companyCopy}>
                  <Text style={[styles.companyName, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={2}>{companyName}</Text>
                  <View
                    style={[
                      styles.verifiedRow,
                      styles.heroStatusBadge,
                      verifiedAgent ? styles.heroStatusBadgeVerified : styles.heroStatusBadgePending,
                    ]}
                  >
                    <Feather name={verifiedAgent ? 'check-circle' : 'clock'} size={14} color={verifiedAgent ? '#E8FFF1' : '#FFF5DE'} />
                    <Text style={[styles.verifiedText, { color: verifiedAgent ? '#E8FFF1' : '#FFF5DE', fontFamily: t.typography.fontFamily.bold }]}>
                      {verifiedAgent ? 'Verified Agent' : 'Verification Pending'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </LinearGradient>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcutRow}>
            {quickLinks.map((item) => {
              const active = item.key === 'overview';
              const pressedCard = shortcutPressedKey === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={item.action ? () => navigation.navigate(item.action) : undefined}
                  onPressIn={() => item.action && setShortcutPressedKey(item.key)}
                  onPressOut={() => setShortcutPressedKey((current) => (current === item.key ? null : current))}
                  disabled={!item.action}
                  style={({ pressed }) => [
                    styles.shortcutCard,
                    {
                      width: managedQuickCardWidth,
                      backgroundColor: item.tint,
                      borderColor: pressedCard ? item.gradient[0] : active ? '#C8D9F7' : '#D8E4F6',
                    },
                    active ? styles.shortcutCardActive : styles.shortcutCardIdle,
                    pressedCard && styles.shortcutCardPressedSoft,
                    pressed && item.action && styles.pressed,
                  ]}
                >
                  <View style={styles.shortcutCardFill}>
                    <LinearGradient colors={item.gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.shortcutGlow} />
                    <LinearGradient colors={item.gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.shortcutIconChip}>
                      <Feather name={item.icon} size={16} color="#F8FAFC" />
                    </LinearGradient>
                    <Text style={[styles.shortcutText, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={2}>{item.label}</Text>
                    <Text style={[styles.shortcutCaption, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{item.caption}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.statsGrid}>
            {overviewStats.map((item) => (
              <View key={item.key} style={[styles.statCard, { width: statsColumns === 4 ? '22.8%' : '47.2%', backgroundColor: item.cardTint, borderColor: `${item.accent}22` }]}>
                <View style={[styles.statAccentBar, { backgroundColor: item.accent }]} />
                <View style={[styles.statGlowOrb, { backgroundColor: `${item.accent}12` }]} />
                <View style={styles.statCardTop}>
                  <View style={[styles.statIcon, styles.statIconElevated, { backgroundColor: item.iconBg, borderColor: `${item.accent}22` }] }>
                    <Feather name={item.icon} size={15} color={item.iconColor} />
                  </View>
                  <View style={styles.statValueWrap}>
                    <Text style={[styles.statValue, { color: item.accent, fontFamily: t.typography.fontFamily.bold }]}>{item.value}</Text>
                    <View style={[styles.statBadge, { backgroundColor: `${item.accent}12`, borderColor: `${item.accent}20` }]}><View style={[styles.statBadgeDot, { backgroundColor: item.accent }]} /><Text style={[styles.statBadgeText, { color: item.accent, fontFamily: t.typography.fontFamily.bold }]}>{item.badge}</Text></View>
                  </View>
                </View>
                <Text style={[styles.statLabel, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{item.label}</Text>
                <View style={[styles.statNotePill, { backgroundColor: `${item.accent}10`, borderColor: `${item.accent}18` }]}><Text style={[styles.statNote, { color: item.accent, fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{item.note}</Text></View>
              </View>
            ))}
          </View>

          <View style={[styles.dualSection, splitLayout && styles.dualSectionWide]}>
            <View style={[styles.panelCard, splitLayout && styles.panelHalf]}>
              <View style={styles.panelHeader}>
                <Text style={[styles.panelTitle, { fontFamily: t.typography.fontFamily.bold }]}>Candidate Status Breakdown</Text>
              </View>
              <View style={styles.pillGrid}>
                {(Object.keys(candidateStatusPillMeta) as Array<keyof typeof candidateStatusPillMeta>).map((key) => {
                  const meta = candidateStatusPillMeta[key];
                  return (
                    <View key={key} style={[styles.statusPill, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                      <Feather name={meta.icon} size={15} color={meta.text} />
                      <Text style={[styles.statusPillValue, { color: meta.text, fontFamily: t.typography.fontFamily.bold }]}>{candidateCounts[key]}</Text>
                      <Text style={[styles.statusPillLabel, { color: meta.text, fontFamily: t.typography.fontFamily.bold }]}>{meta.label}</Text>
                    </View>
                  );
                })}
              </View>
              {!candidateList.length ? (
                <Text style={[styles.panelNote, { fontFamily: t.typography.fontFamily.medium }]}>Managed candidate data will fill in here once the agent candidate API is connected.</Text>
              ) : null}
            </View>

            <View style={[styles.panelCard, splitLayout && styles.panelHalf]}>
              <View style={styles.panelHeader}>
                <Text style={[styles.panelTitle, { fontFamily: t.typography.fontFamily.bold }]}>Application Status Breakdown</Text>
              </View>
              <View style={styles.pillGrid}>
                {(Object.keys(applicationStatusPillMeta) as Array<keyof typeof applicationStatusPillMeta>).map((key) => {
                  const meta = applicationStatusPillMeta[key];
                  return (
                    <View key={key} style={[styles.statusPill, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                      <Feather name={meta.icon} size={15} color={meta.text} />
                      <Text style={[styles.statusPillValue, { color: meta.text, fontFamily: t.typography.fontFamily.bold }]}>{applicationCounts[key]}</Text>
                      <Text style={[styles.statusPillLabel, { color: meta.text, fontFamily: t.typography.fontFamily.bold }]}>{meta.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <Text style={[styles.profileTitle, { fontFamily: t.typography.fontFamily.bold }]}>Profile Completion</Text>
              <Text style={[styles.profilePercent, { fontFamily: t.typography.fontFamily.bold }]}>{profileCompletion}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${profileCompletion}%` }]} />
            </View>
            <Text style={[styles.profileBody, { fontFamily: t.typography.fontFamily.medium }]}>Complete your company details to strengthen trust and speed up candidate handling.</Text>
            <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={() => navigation.navigate('Me', { screen: 'EditProfile' })}>
              <LinearGradient colors={['#1B4AA3', '#1279C5']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.primaryButtonFill}>
                <Feather name="user" size={16} color="#FFFFFF" />
                <Text style={[styles.primaryButtonText, { fontFamily: t.typography.fontFamily.bold }]}>Complete Profile</Text>
              </LinearGradient>
            </Pressable>
          </View>

          <View style={[styles.dualSection, splitLayout && styles.dualSectionWide]}>
            <View style={[styles.listPanel, splitLayout && styles.panelHalf]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Recent Applications</Text>
                <Pressable onPress={() => navigation.navigate('Applications')} style={({ pressed }) => pressed && styles.pressed}>
                  <Text style={[styles.sectionLink, { fontFamily: t.typography.fontFamily.bold }]}>View All</Text>
                </Pressable>
              </View>

              {recentApplications.length ? recentApplications.map((item: any) => {
                const job = item?.job || {};
                const jobId = String(job?._id || item?.jobId || '').trim();
                const statusKey = getStatusBucket(String(item?.status || 'pending')) as keyof typeof applicationStatusPillMeta;
                const statusMeta = applicationStatusPillMeta[statusKey];
                const title = pickString([job?.title, job?.jobTitle, job?.position], 'Application');
                const company = pickString([job?.company, job?.companyName], 'Company');
                const location = pickString([job?.location, job?.city, job?.jobLocation], 'Location');
                const appliedDate = formatDate(item?.appliedAt || item?.createdAt) || 'Recent';

                return (
                  <Pressable
                    key={String(item?._id || jobId || title)}
                    style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}
                    onPress={() => {
                      if (jobId) navigation.navigate('Home', { screen: 'JobDetails', params: { jobId } });
                    }}
                  >
                    <View style={styles.listCardTop}>
                      <View style={styles.listCardCopy}>
                        <Text style={[styles.listTitle, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{title}</Text>
                        <Text style={[styles.listSub, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{company}</Text>
                      </View>
                      <View style={[styles.inlineBadge, { backgroundColor: statusMeta.bg, borderColor: statusMeta.border }]}>
                        <Text style={[styles.inlineBadgeText, { color: statusMeta.text, fontFamily: t.typography.fontFamily.bold }]}>{pickString([item?.status], statusMeta.label)}</Text>
                      </View>
                    </View>
                    <View style={styles.metaRow}>
                      <View style={styles.metaBox}>
                        <Feather name="map-pin" size={14} color="#1B6DC7" />
                        <Text style={[styles.metaBoxText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{location}</Text>
                      </View>
                      <View style={styles.metaBox}>
                        <Feather name="clock" size={14} color="#8D4DE8" />
                        <Text style={[styles.metaBoxText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{appliedDate}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              }) : (
                <View style={styles.placeholderCard}>
                  <Feather name="clipboard" size={20} color="#5E7DB0" />
                  <Text style={[styles.placeholderTitle, { fontFamily: t.typography.fontFamily.bold }]}>No recent applications</Text>
                  <Text style={[styles.placeholderBody, { fontFamily: t.typography.fontFamily.medium }]}>Submitted applications will appear here once your first agent submission is recorded.</Text>
                </View>
              )}
            </View>

            <View style={[styles.listPanel, splitLayout && styles.panelHalf]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Recent Candidates</Text>
                <Pressable onPress={() => navigation.navigate('Candidates')} style={({ pressed }) => pressed && styles.pressed}>
                  <Text style={[styles.sectionLink, { fontFamily: t.typography.fontFamily.bold }]}>View All</Text>
                </Pressable>
              </View>

              {recentCandidates.length ? recentCandidates.map((candidate: any, index: number) => {
                const statusKey = getStatusBucket(String(candidate?.status || 'pending')) as keyof typeof candidateStatusPillMeta;
                const statusMeta = candidateStatusPillMeta[statusKey];
                const name = pickString([candidate?.name, candidate?.fullName], `Candidate ${index + 1}`);
                const email = pickString([candidate?.email], 'No email');
                const experience = pickAny(candidate, ['experience', 'yearsOfExperience'], 'N/A');
                const addedDate = formatDate(candidate?.createdAt || candidate?.addedAt) || 'Recent';

                return (
                  <View key={String(candidate?._id || candidate?.id || name)} style={styles.listCard}>
                    <View style={styles.listCardTop}>
                      <View style={styles.listCardCopy}>
                        <Text style={[styles.listTitle, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{name}</Text>
                        <Text style={[styles.listSub, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{email}</Text>
                      </View>
                      <View style={[styles.inlineBadge, { backgroundColor: statusMeta.bg, borderColor: statusMeta.border }]}>
                        <Text style={[styles.inlineBadgeText, { color: statusMeta.text, fontFamily: t.typography.fontFamily.bold }]}>{pickString([candidate?.status], statusMeta.label)}</Text>
                      </View>
                    </View>
                    <View style={styles.metaRow}>
                      <View style={styles.metaBox}>
                        <Feather name="award" size={14} color="#1BA266" />
                        <Text style={[styles.metaBoxText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{experience}</Text>
                      </View>
                      <View style={styles.metaBox}>
                        <Feather name="clock" size={14} color="#8D4DE8" />
                        <Text style={[styles.metaBoxText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{addedDate}</Text>
                      </View>
                    </View>
                  </View>
                );
              }) : (
                <View style={styles.placeholderCard}>
                  <Feather name="users" size={20} color="#5E7DB0" />
                  <Text style={[styles.placeholderTitle, { fontFamily: t.typography.fontFamily.bold }]}>Candidate feed pending</Text>
                  <Text style={[styles.placeholderBody, { fontFamily: t.typography.fontFamily.medium }]}>Managed candidate cards will appear here as soon as the mobile app is connected to that backend flow.</Text>
                </View>
              )}
            </View>
          </View>

          <View style={[styles.footerStats, width >= 840 && styles.footerStatsWide]}>
            {footerStats.map((item) => (
              <View key={item.key} style={styles.footerStatCard}>
                <Text style={[styles.footerStatValue, { color: item.tone, fontFamily: t.typography.fontFamily.bold }]}>{item.value}</Text>
                <Text style={[styles.footerStatLabel, { fontFamily: t.typography.fontFamily.medium }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 108 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
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
  topCopy: { flex: 1 },
  topEyebrow: { fontSize: 11, lineHeight: 14, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '700' },
  topTitle: { marginTop: 4, color: '#13306F', fontSize: 20, lineHeight: 24, fontWeight: '900', letterSpacing: -0.4 },
  liveChipSolid: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#F5F8FD', borderWidth: 1, borderColor: '#D7E4F7' },
  liveChipText: { color: '#194A9A', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  heroCard: { borderRadius: 28, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, overflow: 'hidden' },
  heroGlowBlue: { position: 'absolute', top: -26, right: -16, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroGlowSoft: { position: 'absolute', bottom: -50, left: -24, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(167,243,208,0.14)' },
  heroTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  heroNavCluster: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroBackBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  eyebrowRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  eyebrowPill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  eyebrowText: { color: '#FFFFFF', fontSize: 11, lineHeight: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C57D' },
  liveText: { color: '#FFFFFF', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  heroHeader: { marginTop: 8, gap: 12 },
  heroHeaderWide: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroCopy: { flex: 1, paddingRight: 10 },
  heroGreeting: { color: 'rgba(255,255,255,0.84)', fontSize: 11, lineHeight: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  heroTitleWrap: { marginTop: 8, position: 'relative', paddingRight: 4 },
  heroTitleGlow: { position: 'absolute', left: -6, right: 24, top: 8, height: 22, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 30, fontWeight: '900', letterSpacing: -0.6 },
  heroBody: { marginTop: 4, color: 'rgba(255,255,255,0.82)', fontSize: 11, lineHeight: 15, fontWeight: '600', maxWidth: 540 },
  companyCard: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 9, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', minWidth: 220 },
  companyIconWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  companyCopy: { flex: 1 },
  companyName: { color: '#FFFFFF', fontSize: 15, lineHeight: 19, fontWeight: '900' },
  verifiedRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroStatusBadge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  heroStatusBadgeVerified: { backgroundColor: 'rgba(22,163,74,0.18)', borderColor: 'rgba(134,239,172,0.3)' },
  heroStatusBadgePending: { backgroundColor: 'rgba(217,119,6,0.18)', borderColor: 'rgba(253,230,138,0.3)' },
  verifiedText: { fontSize: 11, lineHeight: 14, fontWeight: '800' },
  shortcutRow: { paddingTop: 14, paddingBottom: 6, paddingRight: 8, gap: 10 },
  shortcutCard: { minWidth: 102, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  shortcutCardActive: { shadowColor: '#315CA8', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  shortcutCardIdle: { shadowColor: '#7290C3', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  shortcutCardPressedSoft: { shadowOpacity: 0.16, shadowRadius: 14, elevation: 4 },
  shortcutCardFill: { minHeight: 82, paddingHorizontal: 8, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  shortcutGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 5 },
  shortcutIconChip: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  shortcutText: { color: '#15306F', fontSize: 11, lineHeight: 14, fontWeight: '800', textAlign: 'center' },
  shortcutCaption: { marginTop: 2, color: '#65789A', fontSize: 9, lineHeight: 11, fontWeight: '600', textAlign: 'center' },
  managedQuickActionsHeader: { paddingTop: 14, gap: 4 },
  managedQuickActionsTitle: { color: '#173271', fontSize: 16, lineHeight: 20, fontWeight: '900' },
  managedQuickActionsBody: { color: '#60708A', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  managedQuickRow: { marginTop: 10, marginBottom: 2, gap: 10, paddingRight: 8, paddingBottom: 6 },
  managedQuickCard: { minWidth: 102, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  managedQuickCardActive: { shadowColor: '#315CA8', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  managedQuickCardIdle: { shadowColor: '#7290C3', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  managedQuickCardPressedSoft: { shadowOpacity: 0.16, shadowRadius: 14, elevation: 4 },
  managedQuickCardFill: { minHeight: 82, paddingHorizontal: 8, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  managedQuickGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 5 },
  managedQuickIconChip: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  managedQuickText: { color: '#15306F', fontSize: 11, lineHeight: 14, fontWeight: '800', textAlign: 'center' },
  managedQuickCaption: { marginTop: 2, color: '#65789A', fontSize: 9, lineHeight: 11, fontWeight: '600', textAlign: 'center' },
  statsGrid: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  statCard: { borderRadius: 22, paddingHorizontal: 11, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: '#DCE7F6', shadowColor: '#4B74A7', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 3, position: 'relative', overflow: 'hidden' },
  statAccentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 5 },
  statGlowOrb: { position: 'absolute', top: -18, right: -10, width: 88, height: 88, borderRadius: 44 },
  statCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statIcon: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statIconElevated: { borderWidth: 1, shadowColor: '#173A72', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  statValueWrap: { flex: 1, gap: 5 },
  statValue: { color: '#1D2944', fontSize: 21, lineHeight: 23, fontWeight: '900', flexShrink: 1, letterSpacing: -0.3 },
  statBadge: { alignSelf: 'flex-start', minHeight: 22, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  statBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  statBadgeText: { fontSize: 9, lineHeight: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.35 },
  statLabel: { marginTop: 9, color: '#44546E', fontSize: 11, lineHeight: 13, fontWeight: '800' },
  statNotePill: { marginTop: 8, borderRadius: 13, paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1 },
  statNote: { color: '#7A879C', fontSize: 9, lineHeight: 11, fontWeight: '700' },
  dualSection: { marginTop: 14, gap: 14 },
  dualSectionWide: { flexDirection: 'row', alignItems: 'flex-start' },
  panelHalf: { flex: 1 },
  panelCard: { borderRadius: 28, padding: 16, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: '#D8E4F6', shadowColor: '#4B74A7', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  panelHeader: { marginBottom: 14 },
  panelTitle: { color: '#1E2942', fontSize: 16, lineHeight: 20, fontWeight: '900' },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statusPill: { minWidth: '47%', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1 },
  statusPillValue: { fontSize: 14, lineHeight: 16, fontWeight: '900' },
  statusPillLabel: { fontSize: 13, lineHeight: 16, fontWeight: '800' },
  panelNote: { marginTop: 12, color: '#72829B', fontSize: 12, lineHeight: 17, fontWeight: '500' },
  profileCard: { marginTop: 14, borderRadius: 28, padding: 16, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: '#D8E4F6', shadowColor: '#4B74A7', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  profileTitle: { color: '#1E2942', fontSize: 16, lineHeight: 20, fontWeight: '900' },
  profilePercent: { color: '#156CC9', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  progressTrack: { marginTop: 14, height: 10, borderRadius: 999, backgroundColor: '#DBE4F3', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#2546A3' },
  profileBody: { marginTop: 12, color: '#62728C', fontSize: 13, lineHeight: 18, fontWeight: '500' },
  primaryButton: { marginTop: 16, alignSelf: 'flex-start', borderRadius: 18, overflow: 'hidden' },
  primaryButtonFill: { minHeight: 50, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, lineHeight: 18, fontWeight: '800' },
  listPanel: { borderRadius: 28, padding: 16, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: '#D8E4F6', shadowColor: '#4B74A7', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 },
  sectionTitle: { color: '#1E2942', fontSize: 16, lineHeight: 20, fontWeight: '900' },
  sectionLink: { color: '#1670C3', fontSize: 14, lineHeight: 18, fontWeight: '800' },
  listCard: { borderRadius: 22, padding: 14, backgroundColor: '#FBFDFF', borderWidth: 1, borderColor: '#DCE7F6', marginBottom: 12 },
  listCardTop: { flexDirection: 'row', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start' },
  listCardCopy: { flex: 1 },
  listTitle: { color: '#1E2A45', fontSize: 15, lineHeight: 19, fontWeight: '900' },
  listSub: { marginTop: 4, color: '#6E7E97', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  inlineBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1 },
  inlineBadgeText: { fontSize: 11, lineHeight: 13, fontWeight: '800' },
  metaRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  metaBox: { flex: 1, minHeight: 48, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F6FAFF', borderWidth: 1, borderColor: '#E2EBF6', flexDirection: 'row', alignItems: 'center' },
  metaBoxText: { marginLeft: 8, flex: 1, color: '#596D8A', fontSize: 12, lineHeight: 15, fontWeight: '600' },
  placeholderCard: { borderRadius: 22, padding: 18, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#DCE7F6', alignItems: 'flex-start' },
  placeholderTitle: { marginTop: 12, color: '#213049', fontSize: 15, lineHeight: 18, fontWeight: '800' },
  placeholderBody: { marginTop: 8, color: '#6F809A', fontSize: 13, lineHeight: 18, fontWeight: '500' },
  footerStats: { marginTop: 14, gap: 12 },
  footerStatsWide: { flexDirection: 'row' },
  footerStatCard: { flex: 1, borderRadius: 24, paddingVertical: 20, paddingHorizontal: 18, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: '#D8E4F6', alignItems: 'center', justifyContent: 'center' },
  footerStatValue: { fontSize: 34, lineHeight: 38, fontWeight: '900' },
  footerStatLabel: { marginTop: 8, color: '#35558C', fontSize: 13, lineHeight: 17, fontWeight: '600' },
  pressed: { opacity: 0.88 },
});






