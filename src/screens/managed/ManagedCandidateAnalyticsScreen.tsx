import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ApplicationsService, DocumentsService, InquiriesService, MeetingsService, OverviewService, TasksService, WishlistService } from '../../api/services';
import ManagedViewBanner from '../../components/managed/ManagedViewBanner';
import { EmptyState, Screen } from '../../components/ui';
import { useAuthStore } from '../../context/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import type { Application, DocumentGroups, Inquiry, Meeting, SavedJobEntry, Task, WishlistStats } from '../../types/models';
import { formatDate } from '../../utils/format';
import { getManagedCandidate, getManagedCandidateId, getManagedCandidateName, stripManagedViewState } from '../../utils/managedView';

const pickPath = (obj: any, path: string) => (path.includes('.') ? path.split('.').reduce((acc: any, part: string) => acc?.[part], obj) : obj?.[path]);
const pickString = (obj: any, keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = pickPath(obj, key);
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
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
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const formatCompactNumber = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1000) {
    try {
      return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
    } catch {}
  }
  return String(Math.round(value * 10) / 10).replace(/\.0$/, '');
};
const formatPercent = (value: number, decimals = 0) => `${Number.isFinite(value) ? value.toFixed(decimals) : '0'}%`;
const toDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const countDocuments = (groups?: DocumentGroups | null) =>
  groups ? ['photo', 'passport', 'drivingLicense', 'cv'].reduce((sum, key) => sum + (Array.isArray((groups as any)?.[key]) ? (groups as any)[key].length : 0), 0) : 0;
const countDocumentTypes = (groups?: DocumentGroups | null) =>
  groups ? ['photo', 'passport', 'drivingLicense', 'cv'].filter((key) => Array.isArray((groups as any)?.[key]) && (groups as any)[key].length > 0).length : 0;
const hasInquiryReply = (item: Inquiry) => {
  const response = (item as any)?.response;
  if (response && typeof response === 'object' && String(response?.message || '').trim()) return true;
  const replies = Array.isArray((item as any)?.replies) ? (item as any).replies : [];
  return replies.some((reply: any) => String(reply?.message || '').trim());
};
const getInquiryStatusBucket = (item: Inquiry) => {
  const status = String(item?.status || '').trim().toLowerCase();
  if (status.includes('respond') || status.includes('close') || status.includes('resolved') || hasInquiryReply(item)) return 'responded';
  return 'pending';
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
const getApplicationStatusBucket = (status?: string) => {
  const value = String(status || '').trim().toLowerCase();
  if (!value || value.includes('pending') || value.includes('submitted') || value.includes('new') || value.includes('applied')) return 'pending';
  if (value.includes('review') || value.includes('screen') || value.includes('shortlist') || value.includes('progress') || value.includes('processing')) return 'reviewed';
  if (value.includes('accept') || value.includes('approve') || value.includes('hired') || value.includes('success') || value.includes('complete')) return 'approved';
  if (value.includes('reject') || value.includes('declin') || value.includes('cancel') || value.includes('fail')) return 'rejected';
  return 'pending';
};
const getTaskStatusBucket = (item: Task) => {
  const value = String(item?.status || '').trim().toLowerCase();
  if (value.includes('complete')) return 'completed';
  if (value.includes('cancel')) return 'cancelled';
  return 'open';
};
const getMeetingStatusBucket = (item: Meeting) => {
  const value = String(item?.status || '').trim().toLowerCase();
  if (value.includes('complete')) return 'completed';
  if (value.includes('cancel')) return 'cancelled';
  const meetingDate = toDate(pickString(item, ['date', 'scheduledAt', 'startTime', 'createdAt']));
  if (meetingDate && meetingDate.getTime() < Date.now()) return 'completed';
  return 'upcoming';
};
const getSavedJobDate = (item: SavedJobEntry) => pickString(item, ['savedAt', 'createdAt', 'updatedAt']);
const getApplicationDate = (item: Application) => pickString(item, ['appliedAt', 'createdAt', 'updatedAt']);
const getInquiryDate = (item: Inquiry) => pickString(item, ['createdAt', 'updatedAt']);
const getMeetingDate = (item: Meeting) => pickString(item, ['date', 'scheduledAt', 'startTime', 'createdAt']);
const getTaskDate = (item: Task) => pickString(item, ['dueDate', 'updatedAt', 'createdAt']);
const makeMonthBuckets = (count = 6) => {
  const items: Array<{ key: string; label: string; start: Date; end: Date }> = [];
  const now = new Date();
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    const label = start.toLocaleString(undefined, { month: 'short' });
    items.push({ key, label, start, end });
  }
  return items;
};
const bucketMonthlyCounts = <T,>(items: T[], getValue: (item: T) => string, buckets: Array<{ start: Date; end: Date }>) =>
  buckets.map((bucket) =>
    items.reduce((total, item) => {
      const date = toDate(getValue(item));
      if (!date) return total;
      return date >= bucket.start && date < bucket.end ? total + 1 : total;
    }, 0)
  );
const buildBreakdown = (items: any[], getKey: (item: any) => string, limit = 4) => {
  const map = new Map<string, number>();
  items.forEach((item) => {
    const key = getKey(item);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
};
const getReadinessScore = (candidate: any, documents?: DocumentGroups | null) => {
  const checkpoints = [
    pickString(candidate, ['name', 'fullName']),
    pickString(candidate, ['email']),
    pickString(candidate, ['phone']),
    pickString(candidate, ['location', 'country']),
    pickString(candidate, ['profession', 'jobInterest']),
    pickString(candidate, ['qualification', 'experience']),
    pickString(candidate, ['visaStatus', 'status']),
    pickString(candidate, ['aboutMe']),
  ];
  const documentScore = countDocumentTypes(documents);
  const complete = checkpoints.filter(Boolean).length + documentScore;
  return Math.round((complete / (checkpoints.length + 4)) * 100);
};
const getTimelineItems = (applications: Application[], inquiries: Inquiry[], tasks: Task[], meetings: Meeting[]) => {
  const items = [
    ...applications.map((item) => ({
      key: `application-${item._id}`,
      type: 'Application',
      icon: 'file-text' as const,
      color: '#1D63D4',
      title: pickString(item, ['job.title', 'job.jobTitle', 'job.position'], 'Application submitted'),
      meta: pickString(item, ['job.company', 'job.companyName', 'status'], 'Candidate application'),
      date: getApplicationDate(item),
    })),
    ...inquiries.map((item) => ({
      key: `inquiry-${item._id}`,
      type: 'Inquiry',
      icon: 'help-circle' as const,
      color: '#C46C15',
      title: pickString(item, ['subject'], 'Inquiry thread'),
      meta: getInquiryStatusBucket(item) === 'responded' ? 'Responded by team' : 'Awaiting response',
      date: getInquiryDate(item),
    })),
    ...tasks.map((item) => ({
      key: `task-${item._id}`,
      type: 'Task',
      icon: 'check-square' as const,
      color: '#0F8A6A',
      title: pickString(item, ['title'], 'Task updated'),
      meta: pickString(item, ['status', 'type'], 'Candidate task'),
      date: getTaskDate(item),
    })),
    ...meetings.map((item) => ({
      key: `meeting-${item._id}`,
      type: 'Meeting',
      icon: 'calendar' as const,
      color: '#7A45F4',
      title: pickString(item, ['title', 'clientName'], 'Meeting scheduled'),
      meta: pickString(item, ['status', 'locationType', 'location'], 'Candidate meeting'),
      date: getMeetingDate(item),
    })),
  ];
  return items.sort((a, b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0)).slice(0, 8);
};

function MetricCard({ icon, value, label, note, iconBg, iconColor, accent, cardTint }: { icon: keyof typeof Feather.glyphMap; value: string; label: string; note: string; iconBg: string; iconColor: string; accent: string; cardTint: string }) {
  return (
    <View style={[styles.metricCard, { backgroundColor: cardTint, borderColor: `${accent}22` }]}>
      <View style={[styles.metricAccentBar, { backgroundColor: accent }]} />
      <View style={[styles.metricGlowOrb, { backgroundColor: `${accent}12` }]} />
      <View style={styles.metricTopRow}>
        <View style={[styles.metricIconWrap, styles.metricIconWrapElevated, { backgroundColor: iconBg, borderColor: `${accent}22` }]}>
          <Feather name={icon} size={17} color={iconColor} />
        </View>
        <View style={styles.metricValueWrap}>
          <Text style={[styles.metricValue, { color: accent }]} numberOfLines={1}>{value}</Text>
          <View style={[styles.metricBadge, { backgroundColor: `${accent}12`, borderColor: `${accent}22` }]}><View style={[styles.metricBadgeDot, { backgroundColor: accent }]} /><Text style={[styles.metricBadgeText, { color: accent }]}>Spotlight</Text></View>
        </View>
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={[styles.metricNotePill, { backgroundColor: `${accent}10`, borderColor: `${accent}20` }]}><Text style={[styles.metricNote, { color: accent }]} numberOfLines={2}>{note}</Text></View>
    </View>
  );
}

function StatusPill({ label, value, bg, border, color, icon }: { label: string; value: number; bg: string; border: string; color: string; icon: keyof typeof Feather.glyphMap }) {
  return (
    <View style={[styles.statusPill, { backgroundColor: bg, borderColor: border }]}>
      <Feather name={icon} size={14} color={color} />
      <Text style={[styles.statusPillValue, { color }]}>{formatCompactNumber(value)}</Text>
      <Text style={[styles.statusPillText, { color }]}>{label}</Text>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function SimpleLineChart({ labels, series, height = 192 }: { labels: string[]; series: Array<{ label: string; color: string; values: number[] }>; height?: number }) {
  const [width, setWidth] = useState(0);
  const padX = 18;
  const padTop = 16;
  const padBottom = 28;
  const plotHeight = height - padTop - padBottom;
  const maxValue = Math.max(1, ...series.flatMap((item) => item.values).map((value) => Number(value) || 0));
  const count = Math.max(labels.length, ...series.map((item) => item.values.length), 1);
  const plotWidth = Math.max(width - padX * 2, 1);
  const stepX = count > 1 ? plotWidth / (count - 1) : 0;
  const pointAt = (index: number, value: number) => ({
    x: padX + (count > 1 ? index * stepX : plotWidth / 2),
    y: padTop + plotHeight - clamp((value / maxValue) * plotHeight, 0, plotHeight),
  });

  return (
    <View>
      <View style={[styles.chartFrame, { height }]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {Array.from({ length: 4 }).map((_, index) => (
          <View key={index} style={[styles.chartGridLine, { top: padTop + (plotHeight / 3) * index }]} />
        ))}
        {width > 0
          ? series.map((item) =>
              item.values.map((value, index) => {
                const point = pointAt(index, Number(value) || 0);
                const nextValue = item.values[index + 1];
                const nextPoint = nextValue == null ? null : pointAt(index + 1, Number(nextValue) || 0);
                const lineWidth = nextPoint ? Math.sqrt((nextPoint.x - point.x) ** 2 + (nextPoint.y - point.y) ** 2) : 0;
                const lineAngle = nextPoint ? Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x) : 0;
                return (
                  <React.Fragment key={`${item.label}-${index}`}>
                    {nextPoint ? <View style={[styles.chartLine, { width: lineWidth, backgroundColor: item.color, left: (point.x + nextPoint.x) / 2 - lineWidth / 2, top: (point.y + nextPoint.y) / 2 - 1, transform: [{ rotateZ: `${lineAngle}rad` }] }]} /> : null}
                    <View style={[styles.chartPointGlow, { left: point.x - 6, top: point.y - 6, backgroundColor: item.color }]}><View style={styles.chartPointCore} /></View>
                  </React.Fragment>
                );
              })
            )
          : null}
      </View>
      <View style={styles.chartLabelsRow}>
        {labels.map((label, index) => (
          <Text key={`${label}-${index}`} style={[styles.chartLabel, index === 0 ? styles.chartLabelStart : index === labels.length - 1 ? styles.chartLabelEnd : styles.chartLabelCenter]} numberOfLines={1}>{label}</Text>
        ))}
      </View>
      <View style={styles.legendRow}>
        {series.map((item) => <LegendItem key={item.label} color={item.color} label={item.label} />)}
      </View>
    </View>
  );
}

export default function ManagedCandidateAnalyticsScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const signIn = useAuthStore((s) => s.signIn);
  const candidate = useMemo(() => getManagedCandidate(user), [user]);
  const managedCandidateId = useMemo(() => getManagedCandidateId(user), [user]);
  const candidateName = useMemo(() => getManagedCandidateName(user), [user]);

  const [overview, setOverview] = useState<any>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [documents, setDocuments] = useState<DocumentGroups | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [savedJobs, setSavedJobs] = useState<SavedJobEntry[]>([]);
  const [wishlistStats, setWishlistStats] = useState<WishlistStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const entrance = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!managedCandidateId) {
      setErrorMessage('No managed candidate is active.');
      setLoading(false);
      return;
    }
    if (!opts?.silent) setLoading(true);
    setErrorMessage(null);

    const [overviewRes, applicationsRes, documentsRes, tasksRes, meetingsRes, inquiriesRes, savedRes, savedStatsRes] = await Promise.allSettled([
      OverviewService.getManagedCandidateDashboard(managedCandidateId),
      ApplicationsService.my({ candidateId: managedCandidateId, managedCandidateId }),
      DocumentsService.list({ managedCandidateId }),
      TasksService.list({ managedCandidateId }),
      MeetingsService.list({ managedCandidateId }),
      InquiriesService.listMine(),
      WishlistService.list({ managedCandidateId }),
      WishlistService.stats({ managedCandidateId }),
    ]);

    const nextOverview = overviewRes.status === 'fulfilled' ? overviewRes.value : null;
    const nextApplications = applicationsRes.status === 'fulfilled' && Array.isArray(applicationsRes.value) ? applicationsRes.value : [];
    const nextDocuments = documentsRes.status === 'fulfilled' ? documentsRes.value : null;
    const nextTasks = tasksRes.status === 'fulfilled' && Array.isArray(tasksRes.value) ? tasksRes.value : [];
    const nextMeetings = meetingsRes.status === 'fulfilled' && Array.isArray(meetingsRes.value) ? meetingsRes.value : [];
    const nextInquiries = inquiriesRes.status === 'fulfilled' && Array.isArray(inquiriesRes.value) ? inquiriesRes.value : [];
    const nextSaved = savedRes.status === 'fulfilled' && Array.isArray(savedRes.value) ? savedRes.value : [];
    const nextSavedStats = savedStatsRes.status === 'fulfilled' ? savedStatsRes.value : null;

    setOverview(nextOverview);
    setApplications(nextApplications);
    setDocuments(nextDocuments);
    setTasks(nextTasks);
    setMeetings(nextMeetings);
    setInquiries(nextInquiries);
    setSavedJobs(nextSaved);
    setWishlistStats(nextSavedStats);

    const hasData = Boolean(nextOverview || nextApplications.length || nextTasks.length || nextMeetings.length || nextInquiries.length || nextSaved.length || countDocuments(nextDocuments));
    if (!hasData) setErrorMessage('Candidate analytics could not be built from the currently available workspace data.');
    if (!opts?.silent) setLoading(false);
  }, [managedCandidateId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!managedCandidateId) setLoading(false);
  }, [managedCandidateId]);

  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 520, useNativeDriver: true }).start();
    const floatLoop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 2600, useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 2600, useNativeDriver: true }),
    ]));
    const sweepLoop = Animated.loop(Animated.sequence([
      Animated.timing(sweep, { toValue: 1, duration: 2400, useNativeDriver: true }),
      Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay(600),
    ]));
    floatLoop.start();
    sweepLoop.start();
    return () => {
      floatLoop.stop();
      sweepLoop.stop();
    };
  }, [entrance, float, sweep]);

  const exitManagedView = useCallback(async () => {
    if (!token || !user) return;
    await signIn({ token, user: stripManagedViewState(user) });
  }, [signIn, token, user]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (navigation.getParent()?.canGoBack()) {
      navigation.getParent()?.goBack();
      return;
    }
    navigation.navigate('Overview');
  }, [navigation]);

  const visibleInquiries = useMemo(() => {
    if (!managedCandidateId) return [];
    return inquiries.filter((item) => {
      const candidateType = String((item as any)?.candidateType || '').trim().toUpperCase();
      return candidateType === 'B2B' && getManagedCandidateIdFromInquiry(item) === managedCandidateId;
    });
  }, [inquiries, managedCandidateId]);

  const applicationCounts = useMemo(() => {
    const counts = {
      pending: pickNumber(overview, ['applicationStats.pending', 'stats.pendingApplications'], 0),
      reviewed: pickNumber(overview, ['applicationStats.inReview', 'applicationStats.reviewed', 'stats.inReviewApplications'], 0),
      approved: pickNumber(overview, ['applicationStats.accepted', 'applicationStats.approved', 'stats.acceptedApplications'], 0),
      rejected: pickNumber(overview, ['applicationStats.rejected', 'stats.rejectedApplications'], 0),
    };
    if (counts.pending || counts.reviewed || counts.approved || counts.rejected) return counts;
    return applications.reduce(
      (acc, item) => {
        acc[getApplicationStatusBucket(item?.status) as keyof typeof acc] += 1;
        return acc;
      },
      { pending: 0, reviewed: 0, approved: 0, rejected: 0 }
    );
  }, [applications, overview]);

  const inquiryCounts = useMemo(() => {
    return visibleInquiries.reduce(
      (acc, item) => {
        acc[getInquiryStatusBucket(item) as keyof typeof acc] += 1;
        return acc;
      },
      { pending: 0, responded: 0 }
    );
  }, [visibleInquiries]);

  const taskCounts = useMemo(() => {
    return tasks.reduce(
      (acc, item) => {
        const bucket = getTaskStatusBucket(item);
        if (bucket === 'completed') acc.completed += 1;
        else if (bucket === 'cancelled') acc.cancelled += 1;
        else acc.open += 1;
        const dueDate = toDate(getTaskDate(item));
        if (bucket === 'open' && dueDate && dueDate.getTime() < Date.now()) acc.overdue += 1;
        return acc;
      },
      { open: 0, completed: 0, cancelled: 0, overdue: 0 }
    );
  }, [tasks]);

  const meetingCounts = useMemo(() => {
    return meetings.reduce(
      (acc, item) => {
        const bucket = getMeetingStatusBucket(item);
        if (bucket === 'completed') acc.completed += 1;
        else if (bucket === 'cancelled') acc.cancelled += 1;
        else acc.upcoming += 1;
        return acc;
      },
      { upcoming: 0, completed: 0, cancelled: 0 }
    );
  }, [meetings]);

  const documentCount = useMemo(() => countDocuments(documents), [documents]);
  const documentTypesCovered = useMemo(() => countDocumentTypes(documents), [documents]);
  const readinessScore = useMemo(() => getReadinessScore(candidate, documents), [candidate, documents]);
  const savedThisWeek = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return savedJobs.filter((item) => {
      const date = toDate(getSavedJobDate(item));
      return Boolean(date && date.getTime() >= sevenDaysAgo);
    }).length;
  }, [savedJobs]);
  const responseRate = useMemo(() => {
    if (!visibleInquiries.length) return 0;
    return (inquiryCounts.responded / visibleInquiries.length) * 100;
  }, [inquiryCounts.responded, visibleInquiries.length]);

  const statCards = useMemo(() => [
    { key: 'applications', icon: 'file-text' as const, value: formatCompactNumber(applications.length || applicationCounts.pending + applicationCounts.reviewed + applicationCounts.approved + applicationCounts.rejected), label: 'Applications', note: `${formatCompactNumber(applicationCounts.pending + applicationCounts.reviewed)} active in pipeline`, iconBg: '#DCEAFF', iconColor: '#2166D5', accent: '#2166D5', cardTint: '#F7FBFF' },
    { key: 'saved', icon: 'heart' as const, value: formatCompactNumber(wishlistStats?.totalSaved ?? savedJobs.length), label: 'Saved Jobs', note: `${formatCompactNumber(wishlistStats?.expiringThisWeek ?? 0)} expiring soon`, iconBg: '#FEE7EF', iconColor: '#D63D6C', accent: '#D63D6C', cardTint: '#FFF7FA' },
    { key: 'response', icon: 'message-circle' as const, value: formatPercent(responseRate), label: 'Inquiry Response Rate', note: `${formatCompactNumber(inquiryCounts.responded)} responded threads`, iconBg: '#E7F8F1', iconColor: '#0F9D63', accent: '#0F9D63', cardTint: '#F5FFF9' },
    { key: 'readiness', icon: 'target' as const, value: formatPercent(readinessScore), label: 'Profile Readiness', note: `${documentTypesCovered}/4 document groups uploaded`, iconBg: '#FFF0DD', iconColor: '#D97706', accent: '#D97706', cardTint: '#FFF9F2' },
  ], [applicationCounts, applications.length, documentTypesCovered, inquiryCounts.responded, readinessScore, responseRate, savedJobs.length, wishlistStats]);

  const totalApplicationStatuses = applicationCounts.pending + applicationCounts.reviewed + applicationCounts.approved + applicationCounts.rejected;
  const conversionStages = useMemo(() => [
    { key: 'saved', label: 'Saved', value: wishlistStats?.totalSaved ?? savedJobs.length, color: '#E85D8E' },
    { key: 'applied', label: 'Applied', value: applications.length || totalApplicationStatuses, color: '#3478F6' },
    { key: 'accepted', label: 'Accepted', value: applicationCounts.approved, color: '#11A755' },
  ], [applicationCounts.approved, applications.length, savedJobs.length, totalApplicationStatuses, wishlistStats]);

  const monthBuckets = useMemo(() => makeMonthBuckets(6), []);
  const trendLabels = useMemo(() => monthBuckets.map((bucket) => bucket.label), [monthBuckets]);
  const trendSeries = useMemo(() => [
    { label: 'Applications', color: '#3478F6', values: bucketMonthlyCounts(applications, getApplicationDate, monthBuckets) },
    { label: 'Saved Jobs', color: '#E85D8E', values: bucketMonthlyCounts(savedJobs, getSavedJobDate, monthBuckets) },
    { label: 'Inquiries', color: '#D97706', values: bucketMonthlyCounts(visibleInquiries, getInquiryDate, monthBuckets) },
  ], [applications, monthBuckets, savedJobs, visibleInquiries]);

  const workflowKpis = useMemo(() => [
    { key: 'tasks', label: 'Open Tasks', value: formatCompactNumber(taskCounts.open), tone: '#1366D6' },
    { key: 'overdue', label: 'Overdue Tasks', value: formatCompactNumber(taskCounts.overdue), tone: taskCounts.overdue ? '#D93856' : '#64748B' },
    { key: 'meetings', label: 'Upcoming Meetings', value: formatCompactNumber(meetingCounts.upcoming), tone: '#7A45F4' },
    { key: 'saved-this-week', label: 'Saved This Week', value: formatCompactNumber(wishlistStats?.recentlySaved ?? savedThisWeek), tone: '#E85D8E' },
  ], [meetingCounts.upcoming, savedThisWeek, taskCounts.open, taskCounts.overdue, wishlistStats]);

  const savedTypeBreakdown = useMemo(() => {
    if (Array.isArray(wishlistStats?.byType) && wishlistStats?.byType?.length) {
      return wishlistStats.byType.map((item: any) => ({ label: String(item?.type || 'Other'), value: Number(item?.count || 0) })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value).slice(0, 4);
    }
    return buildBreakdown(savedJobs, (item) => pickString(item, ['job.type', 'job.jobType', 'job.employmentType'], 'Other'));
  }, [savedJobs, wishlistStats]);

  const savedCountryBreakdown = useMemo(() => {
    if (Array.isArray(wishlistStats?.byCountry) && wishlistStats?.byCountry?.length) {
      return wishlistStats.byCountry.map((item: any) => ({ label: String(item?.country || 'Other'), value: Number(item?.count || 0) })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value).slice(0, 4);
    }
    return buildBreakdown(savedJobs, (item) => pickString(item, ['job.country', 'job.location'], 'Other'));
  }, [savedJobs, wishlistStats]);

  const recentActivity = useMemo(() => getTimelineItems(applications, visibleInquiries, tasks, meetings), [applications, meetings, tasks, visibleInquiries]);
  const candidateSummary = [
    { key: 'profession', icon: 'briefcase' as const, label: pickString(candidate, ['profession', 'jobInterest'], 'Role not set') },
    { key: 'location', icon: 'map-pin' as const, label: pickString(candidate, ['location', 'country'], 'Location pending') },
    { key: 'visa', icon: 'globe' as const, label: pickString(candidate, ['visaStatus', 'status'], 'Visa status pending') },
  ];
  const heroHighlights = [
    { key: 'apps', value: formatCompactNumber(applications.length || totalApplicationStatuses), label: 'Applications' },
    { key: 'docs', value: formatCompactNumber(documentCount), label: 'Documents' },
    { key: 'ready', value: formatPercent(readinessScore), label: 'Readiness' },
  ];
  const splitSections = width >= 920;
  const heroOpacity = entrance;
  const heroY = entrance.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const orbShift = float.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-170, width >= 640 ? 520 : 320] });
  const getEntranceMotion = (delay: number, distance = 18) => ({
    opacity: entrance.interpolate({ inputRange: [0, delay, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: entrance.interpolate({ inputRange: [0, delay, 1], outputRange: [distance, distance, 0], extrapolate: 'clamp' }) }],
  });
  const topCardWidth = width >= 960 ? '48.5%' : '48.5%';
  const maxSavedType = Math.max(1, ...savedTypeBreakdown.map((item) => item.value), 1);
  const maxSavedCountry = Math.max(1, ...savedCountryBreakdown.map((item) => item.value), 1);
  const hasAnyData = Boolean(overview || applications.length || savedJobs.length || visibleInquiries.length || tasks.length || meetings.length || documentCount);

  if (!managedCandidateId) {
    return <Screen padded={false}><View style={styles.root}><EmptyState title="Candidate analytics unavailable" message="Open a managed candidate first to view this dashboard." /></View></Screen>;
  }

  if (!loading && !hasAnyData && errorMessage) {
    return <Screen padded={false}><View style={styles.root}><EmptyState title="Candidate analytics unavailable" message={errorMessage} actionLabel="Retry" onAction={() => load()} /></View></Screen>;
  }

  return (
    <Screen padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load({ silent: true }); setRefreshing(false); }} />}
      >
        <ManagedViewBanner candidateName={candidateName} subtitle="This dashboard is generated from the active candidate's existing workspace data." onExit={exitManagedView} />

        <Animated.View style={[styles.heroCard, { opacity: heroOpacity, transform: [{ translateY: heroY }] }]}>
          <LinearGradient colors={['#F8FCFF', '#EDF7FF', '#F4FFFC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroFill}>
            <Animated.View style={[styles.heroGlowA, { transform: [{ translateY: orbShift }] }]} />
            <View style={styles.heroGlowB} />
            <Animated.View style={[styles.heroSweep, { transform: [{ translateX: sweepX }, { rotate: '18deg' }] }]} />
            <View style={styles.heroTopBar}>
              <View style={styles.heroNavCluster}>
                <Pressable onPress={handleBack} style={({ pressed }) => [styles.heroBackBtn, pressed && styles.pressed]}>
                  <Feather name="arrow-left" size={18} color="#24408D" />
                </Pressable>
                <View style={styles.heroTopPill}>
                  <Feather name="bar-chart-2" size={14} color="#1768B8" />
                  <Text style={[styles.heroTopPillText, { fontFamily: t.typography.fontFamily.bold }]}>Candidate analytics</Text>
                </View>
              </View>
              <View style={styles.heroLiveChip}>
                <View style={styles.liveDot} />
                <Text style={[styles.heroLiveChipText, { fontFamily: t.typography.fontFamily.bold }]}>{loading ? 'Syncing' : 'Live'}</Text>
              </View>
            </View>
            <View style={styles.heroCopy}>
              <Text style={[styles.heroTitle, { fontFamily: t.typography.fontFamily.bold }]}>{candidateName}</Text>
              <Text style={[styles.heroSubtitle, { fontFamily: t.typography.fontFamily.medium }]}>A compact live workspace for applications, saved roles, documents, meetings, and follow-ups tied to this candidate.</Text>
            </View>
            <View style={styles.heroSummaryRow}>
              {candidateSummary.map((item) => (
                <View key={item.key} style={styles.heroSummaryChip}>
                  <Feather name={item.icon} size={14} color="#1768B8" />
                  <Text style={[styles.heroSummaryText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{item.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.heroHighlightsRow}>{heroHighlights.map((item) => <View key={item.key} style={styles.heroHighlightCard}><Text style={[styles.heroHighlightValue, { fontFamily: t.typography.fontFamily.bold }]}>{item.value}</Text><Text style={[styles.heroHighlightLabel, { fontFamily: t.typography.fontFamily.medium }]}>{item.label}</Text></View>)}</View>
            <View style={styles.heroActions}>
              <Pressable onPress={() => navigation.navigate('Applications')} style={({ pressed }) => [styles.headerButton, styles.headerButtonPrimary, pressed && styles.pressed]}>
                <Feather name="file-text" size={16} color="#0D55BD" />
                <Text style={[styles.headerButtonText, styles.headerButtonTextPrimary, { fontFamily: t.typography.fontFamily.bold }]}>Applications</Text>
              </Pressable>
              <Pressable onPress={() => navigation.navigate('Documents')} style={({ pressed }) => [styles.headerButton, styles.headerButtonSecondary, pressed && styles.pressed]}>
                <Feather name="folder" size={16} color="#1768B8" />
                <Text style={[styles.headerButtonText, styles.headerButtonTextSecondary, { fontFamily: t.typography.fontFamily.bold }]}>Documents</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View style={[styles.metricsRow, getEntranceMotion(0.12)]}>
          {statCards.map(({ key, ...item }) => (
            <View key={key} style={[styles.metricSlot, { width: topCardWidth }]}>
              <MetricCard {...item} />
            </View>
          ))}
        </Animated.View>

        <Animated.View style={[styles.sectionCard, getEntranceMotion(0.22)]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Feather name="pie-chart" size={20} color="#1E68C3" />
              <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Application Pipeline</Text>
            </View>
            <Text style={[styles.sectionCaption, { fontFamily: t.typography.fontFamily.medium }]}>Status distribution for the active candidate's application flow, derived from current application records.</Text>
          </View>
          <View style={styles.statusRow}>
            <StatusPill label="Pending" value={applicationCounts.pending} bg="#FFF6D8" border="#F6E39A" color="#B57206" icon="clock" />
            <StatusPill label="In Review" value={applicationCounts.reviewed} bg="#E8F1FF" border="#BCD4FB" color="#2969D8" icon="eye" />
            <StatusPill label="Accepted" value={applicationCounts.approved} bg="#E8F8EC" border="#BFE8CB" color="#159451" icon="check-circle" />
            <StatusPill label="Rejected" value={applicationCounts.rejected} bg="#FFF0F2" border="#F4CCD4" color="#D63655" icon="x-circle" />
          </View>
          <View style={styles.distributionShell}>
            {totalApplicationStatuses > 0 ? (
              <>
                <View style={styles.distributionBarTrack}>
                  <View style={[styles.distributionBarSegment, { flex: applicationCounts.pending || 0, backgroundColor: '#FACC15' }]} />
                  <View style={[styles.distributionBarSegment, { flex: applicationCounts.reviewed || 0, backgroundColor: '#60A5FA' }]} />
                  <View style={[styles.distributionBarSegment, { flex: applicationCounts.approved || 0, backgroundColor: '#34D399' }]} />
                  <View style={[styles.distributionBarSegment, { flex: applicationCounts.rejected || 0, backgroundColor: '#FB7185' }]} />
                </View>
                <View style={styles.distributionLegend}>
                  <LegendItem color="#FACC15" label={`${formatPercent((applicationCounts.pending / totalApplicationStatuses) * 100)} pending`} />
                  <LegendItem color="#60A5FA" label={`${formatPercent((applicationCounts.reviewed / totalApplicationStatuses) * 100)} in review`} />
                  <LegendItem color="#34D399" label={`${formatPercent((applicationCounts.approved / totalApplicationStatuses) * 100)} accepted`} />
                  <LegendItem color="#FB7185" label={`${formatPercent((applicationCounts.rejected / totalApplicationStatuses) * 100)} rejected`} />
                </View>
              </>
            ) : <EmptyState title="No application pipeline yet" message="Status distribution will appear once this candidate has application activity." />}
          </View>
          <View style={styles.funnelRow}>
            {conversionStages.map((item) => <View key={item.key} style={styles.funnelCard}><Text style={[styles.funnelValue, { color: item.color, fontFamily: t.typography.fontFamily.bold }]}>{formatCompactNumber(item.value)}</Text><Text style={[styles.funnelLabel, { fontFamily: t.typography.fontFamily.medium }]}>{item.label}</Text></View>)}
          </View>
        </Animated.View>

        <View style={[styles.twoUpRow, splitSections && styles.twoUpRowSplit]}>
          <Animated.View style={[styles.twoUpCard, splitSections ? styles.twoUpHalf : styles.twoUpFull, getEntranceMotion(0.32)]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Feather name="activity" size={20} color="#1E68C3" />
                <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Monthly Trends</Text>
              </View>
              <Text style={[styles.sectionCaption, { fontFamily: t.typography.fontFamily.medium }]}>Six-month activity trend based on saved jobs, applications, and inquiries already stored for this candidate.</Text>
            </View>
            {trendSeries.some((item) => item.values.some((value) => value > 0)) ? <SimpleLineChart labels={trendLabels} series={trendSeries} /> : <EmptyState title="No trend history yet" message="Monthly trend lines will appear after activity accumulates across the current six-month window." />}
          </Animated.View>

          <Animated.View style={[styles.twoUpCard, splitSections ? styles.twoUpHalf : styles.twoUpFull, getEntranceMotion(0.38)]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Feather name="target" size={20} color="#1E68C3" />
                <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Workflow Health</Text>
              </View>
              <Text style={[styles.sectionCaption, { fontFamily: t.typography.fontFamily.medium }]}>Fast indicators for candidate readiness, follow-ups, and upcoming scheduling needs.</Text>
            </View>
            <View style={styles.kpiGrid}>
              {workflowKpis.map((item) => <View key={item.key} style={styles.kpiCard}><Text style={[styles.kpiLabel, { fontFamily: t.typography.fontFamily.medium }]}>{item.label}</Text><Text style={[styles.kpiValue, { color: item.tone, fontFamily: t.typography.fontFamily.bold }]}>{item.value}</Text></View>)}
            </View>
            <View style={styles.workflowFooter}>
              <View style={styles.workflowChip}><Feather name="folder" size={14} color="#1366D6" /><Text style={[styles.workflowChipText, { fontFamily: t.typography.fontFamily.bold }]}>{`${documentCount} documents uploaded`}</Text></View>
              <View style={styles.workflowChip}><Feather name="message-square" size={14} color="#0F9D63" /><Text style={[styles.workflowChipText, { fontFamily: t.typography.fontFamily.bold }]}>{`${visibleInquiries.length} inquiry threads tracked`}</Text></View>
            </View>
          </Animated.View>
        </View>

        <View style={[styles.twoUpRow, splitSections && styles.twoUpRowSplit]}>
          <Animated.View style={[styles.twoUpCard, splitSections ? styles.twoUpHalf : styles.twoUpFull, getEntranceMotion(0.48)]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Feather name="bookmark" size={20} color="#1E68C3" />
                <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Saved Job Focus</Text>
              </View>
              <Text style={[styles.sectionCaption, { fontFamily: t.typography.fontFamily.medium }]}>Top job types the candidate has saved most often.</Text>
            </View>
            <View style={styles.breakdownList}>
              {savedTypeBreakdown.length ? savedTypeBreakdown.map((item) => <View key={item.label} style={styles.breakdownRow}><View style={styles.breakdownLabelRow}><Text style={[styles.breakdownLabel, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{item.label}</Text><Text style={[styles.breakdownValue, { fontFamily: t.typography.fontFamily.bold }]}>{formatCompactNumber(item.value)}</Text></View><View style={styles.breakdownTrack}><View style={[styles.breakdownFill, { width: `${(item.value / maxSavedType) * 100}%`, backgroundColor: '#3478F6' }]} /></View></View>) : <EmptyState title="No saved-job type data" message="Type breakdown appears after the candidate saves jobs with category metadata." />}
            </View>
          </Animated.View>

          <Animated.View style={[styles.twoUpCard, splitSections ? styles.twoUpHalf : styles.twoUpFull, getEntranceMotion(0.56)]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Feather name="map" size={20} color="#1E68C3" />
                <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Geography Interest</Text>
              </View>
              <Text style={[styles.sectionCaption, { fontFamily: t.typography.fontFamily.medium }]}>Countries or locations most represented in the candidate's saved jobs.</Text>
            </View>
            <View style={styles.breakdownList}>
              {savedCountryBreakdown.length ? savedCountryBreakdown.map((item) => <View key={item.label} style={styles.breakdownRow}><View style={styles.breakdownLabelRow}><Text style={[styles.breakdownLabel, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{item.label}</Text><Text style={[styles.breakdownValue, { fontFamily: t.typography.fontFamily.bold }]}>{formatCompactNumber(item.value)}</Text></View><View style={styles.breakdownTrack}><View style={[styles.breakdownFill, { width: `${(item.value / maxSavedCountry) * 100}%`, backgroundColor: '#11A755' }]} /></View></View>) : <EmptyState title="No geography data yet" message="Location interest will appear once saved jobs include country or location details." />}
            </View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.sectionCard, getEntranceMotion(0.68)]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Feather name="clock" size={20} color="#1E68C3" />
              <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Recent Activity</Text>
            </View>
            <Text style={[styles.sectionCaption, { fontFamily: t.typography.fontFamily.medium }]}>Latest candidate events pulled from applications, inquiries, meetings, and tasks.</Text>
          </View>
          <View style={styles.timelineList}>
            {recentActivity.length ? recentActivity.map((item) => <View key={item.key} style={styles.timelineRow}><View style={[styles.timelineIconWrap, { backgroundColor: `${item.color}1A` }]}><Feather name={item.icon} size={16} color={item.color} /></View><View style={styles.timelineCopy}><View style={styles.timelineTitleRow}><Text style={[styles.timelineTitle, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{item.title}</Text><View style={styles.timelineTypeBadge}><Text style={[styles.timelineTypeText, { fontFamily: t.typography.fontFamily.bold }]}>{item.type}</Text></View></View><Text style={[styles.timelineMeta, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{item.meta}</Text></View><Text style={[styles.timelineDate, { fontFamily: t.typography.fontFamily.bold }]}>{formatDate(item.date) || 'Recent'}</Text></View>) : <EmptyState title="No recent activity yet" message="As this candidate starts using more parts of the workspace, recent events will appear here." />}
          </View>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: '#F3F7FC' },
  content: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 136, gap: 12, backgroundColor: '#F2F6FD' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7FAFF', borderWidth: 1, borderColor: '#D8E5F6', shadowColor: '#173A72', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  topCopy: { flex: 1 },
  eyebrow: { color: '#6A7F99', fontSize: 10, lineHeight: 12, letterSpacing: 1.1, textTransform: 'uppercase', fontWeight: '800' },
  title: { marginTop: 2, color: '#1A347F', fontSize: 22, lineHeight: 26, fontWeight: '900' },
  heroCard: { borderRadius: 30, overflow: 'hidden', borderWidth: 1, borderColor: '#D7E3F2', shadowColor: '#0C3C89', shadowOpacity: 0.24, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 9 },
  heroFill: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, position: 'relative', overflow: 'hidden' },
  heroTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  heroNavCluster: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroBackBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: 'rgba(216,229,246,0.92)', shadowColor: '#173A72', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  heroTopPill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: 'rgba(215,227,242,0.95)' },
  heroTopPillText: { color: '#1768B8', fontSize: 10, lineHeight: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroLiveChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: 'rgba(215,228,247,0.95)' },
  heroLiveChipText: { color: '#194A9A', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C57D' },
  heroGlowA: { position: 'absolute', top: -78, right: -22, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.14)' },
  heroGlowB: { position: 'absolute', bottom: -38, left: -20, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(97, 255, 214, 0.16)' },
  heroSweep: { position: 'absolute', top: -54, bottom: -44, width: 80, backgroundColor: 'rgba(255,255,255,0.46)' },
  heroCopy: { gap: 6 },
  heroPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E3F2' },
  heroPillText: { color: '#1768B8', fontSize: 10, lineHeight: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroTitle: { color: '#19367C', fontSize: 24, lineHeight: 28, fontWeight: '900', letterSpacing: -0.7 },
  heroSubtitle: { color: '#536987', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  heroSummaryRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroSummaryChip: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E3F2' },
  heroSummaryText: { maxWidth: 220, color: '#4E6482', fontSize: 10, lineHeight: 12, fontWeight: '800' },
  heroHighlightsRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  heroHighlightCard: { flex: 1, minWidth: 98, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.88)', borderWidth: 1, borderColor: '#DCE7F6' },
  heroHighlightValue: { color: '#19367C', fontSize: 20, lineHeight: 22, fontWeight: '900', letterSpacing: -0.4 },
  heroHighlightLabel: { marginTop: 4, color: '#5B6F89', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  heroActions: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  headerButton: { minHeight: 40, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1 },
  headerButtonPrimary: { backgroundColor: '#1B63C8', borderColor: '#1B63C8' },
  headerButtonSecondary: { backgroundColor: '#FFFFFF', borderColor: '#D7E3F2' },
  headerButtonText: { fontSize: 13, lineHeight: 16, fontWeight: '800' },
  headerButtonTextPrimary: { color: '#FFFFFF' },
  headerButtonTextSecondary: { color: '#1768B8' },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  metricSlot: { minWidth: 0 },
  metricCard: { minHeight: 128, borderRadius: 24, padding: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DEE8F5', shadowColor: '#163B79', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 5, position: 'relative', overflow: 'hidden' },
  metricAccentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 5 },
  metricGlowOrb: { position: 'absolute', top: -18, right: -10, width: 92, height: 92, borderRadius: 46 },
  metricTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metricIconWrap: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  metricIconWrapElevated: { borderWidth: 1, shadowColor: '#173A72', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  metricValueWrap: { flex: 1, gap: 6 },
  metricValue: { color: '#1B2E4B', fontSize: 30, lineHeight: 33, fontWeight: '900', letterSpacing: -0.7 },
  metricBadge: { alignSelf: 'flex-start', minHeight: 24, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricBadgeDot: { width: 7, height: 7, borderRadius: 3.5 },
  metricBadgeText: { fontSize: 10, lineHeight: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  metricLabel: { marginTop: 10, color: '#344966', fontSize: 13, lineHeight: 16, fontWeight: '900' },
  metricNotePill: { marginTop: 10, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, alignSelf: 'stretch' },
  metricNote: { color: '#637791', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  sectionCard: { borderRadius: 22, padding: 10, backgroundColor: '#FEFFFF', borderWidth: 1, borderColor: '#DEE8F6', shadowColor: '#183A73', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
  sectionHeader: { gap: 6 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { color: '#152B50', fontSize: 18, lineHeight: 22, fontWeight: '900', letterSpacing: -0.3 },
  sectionCaption: { color: '#6B7D98', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  statusRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusPill: { minHeight: 48, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 9, shadowColor: '#173A72', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  statusPillValue: { fontSize: 15, lineHeight: 18, fontWeight: '900' },
  statusPillText: { fontSize: 12, lineHeight: 15, fontWeight: '800', letterSpacing: -0.1 },
  distributionShell: { marginTop: 10, borderRadius: 20, borderWidth: 1, borderColor: '#E3ECF7', backgroundColor: '#F7FAFF', padding: 12 },
  distributionBarTrack: { height: 16, borderRadius: 999, overflow: 'hidden', backgroundColor: '#E7EEF8', flexDirection: 'row' },
  distributionBarSegment: { height: '100%' },
  distributionLegend: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  funnelRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  funnelCard: { flex: 1, minWidth: 96, borderRadius: 18, padding: 10, backgroundColor: '#F6FAFF', borderWidth: 1, borderColor: '#E3ECF7' },
  funnelValue: { fontSize: 22, lineHeight: 26, fontWeight: '900', letterSpacing: -0.2 },
  funnelLabel: { marginTop: 6, color: '#62748E', fontSize: 12, lineHeight: 15, fontWeight: '700' },
  twoUpRow: { gap: 12 },
  twoUpRowSplit: { flexDirection: 'row', alignItems: 'stretch' },
  twoUpCard: { borderRadius: 22, padding: 10, backgroundColor: '#FEFFFF', borderWidth: 1, borderColor: '#DEE8F6', shadowColor: '#183A73', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
  twoUpHalf: { width: '48.8%' },
  twoUpFull: { width: '100%' },
  chartFrame: { marginTop: 10, borderRadius: 20, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#E2EBF8', overflow: 'hidden' },
  chartGridLine: { position: 'absolute', left: 16, right: 16, height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: '#E4EBF7' },
  chartLine: { position: 'absolute', height: 2, borderRadius: 999 },
  chartPointGlow: { position: 'absolute', width: 12, height: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  chartPointCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  chartLabelsRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  chartLabel: { flex: 1, color: '#62748E', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  chartLabelStart: { textAlign: 'left' },
  chartLabelCenter: { textAlign: 'center' },
  chartLabelEnd: { textAlign: 'right' },
  legendRow: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 9, height: 9, borderRadius: 4.5 },
  legendText: { color: '#465B78', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  kpiGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpiCard: { width: '48.5%', minHeight: 70, borderRadius: 18, padding: 11, backgroundColor: '#F5F9FF', borderWidth: 1, borderColor: '#E2EBF7', justifyContent: 'space-between' },
  kpiLabel: { color: '#3A4F6B', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  kpiValue: { marginTop: 10, fontSize: 19, lineHeight: 22, fontWeight: '900', letterSpacing: -0.2 },
  workflowFooter: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  workflowChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F7FAFF', borderWidth: 1, borderColor: '#E0EAF6' },
  workflowChipText: { color: '#2F4E70', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  breakdownList: { marginTop: 10, gap: 8 },
  breakdownRow: { borderRadius: 18, padding: 10, backgroundColor: '#F6FAFF', borderWidth: 1, borderColor: '#E3ECF7' },
  breakdownLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  breakdownLabel: { flex: 1, color: '#20334E', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  breakdownValue: { color: '#28405E', fontSize: 12, lineHeight: 15, fontWeight: '900' },
  breakdownTrack: { marginTop: 10, height: 9, borderRadius: 999, overflow: 'hidden', backgroundColor: '#E8EEF7' },
  breakdownFill: { height: '100%', borderRadius: 999 },
  timelineList: { marginTop: 10, gap: 8 },
  timelineRow: { borderRadius: 20, padding: 10, backgroundColor: '#F6FAFF', borderWidth: 1, borderColor: '#E3ECF7', flexDirection: 'row', alignItems: 'center', gap: 10 },
  timelineIconWrap: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  timelineCopy: { flex: 1, gap: 3 },
  timelineTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timelineTitle: { flex: 1, color: '#20324A', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  timelineTypeBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE7F5' },
  timelineTypeText: { color: '#5E7392', fontSize: 10, lineHeight: 12, fontWeight: '800', textTransform: 'uppercase' },
  timelineMeta: { color: '#667993', fontSize: 12, lineHeight: 15, fontWeight: '600' },
  timelineDate: { color: '#1E63C8', fontSize: 11, lineHeight: 14, fontWeight: '900' },
  pressed: { opacity: 0.9 },
});


