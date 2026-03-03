import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { JobsService } from '../../api/services';
import { ApplicationsService } from '../../api/services';
import { api } from '../../api/client';
import { Card, EmptyState, Screen, Skeleton } from '../../components/ui';
import { useAuthStore } from '../../context/authStore';
import { Radius, Spacing } from '../../constants/theme';
import type { Job } from '../../types/models';
import type { JobsStackParamList } from '../../navigation/app/AppNavigator';
import { formatDate } from '../../utils/format';
import { useTheme } from '../../theme/ThemeProvider';
import { getSavedJobs, setSavedJobs } from '../../utils/savedJobsStorage';

type Props = NativeStackScreenProps<JobsStackParamList, 'JobsList'>;

const splitList = (v: any) => {
  if (Array.isArray(v)) return v.map((x) => String(typeof x === 'string' ? x : x?.name || x || '').trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(/\r?\n|,|;|•|â€¢/).map((x) => x.replace(/^[-*\d.)\s]+/, '').trim()).filter(Boolean);
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

const jobKey = (j: any) =>
  String(j?._id || j?.id || `${pick(j, ['title'])}-${pick(j, ['company'])}-${pick(j, ['location'])}`).toLowerCase();

export default function JobsListScreen({ navigation }: Props) {
  const t = useTheme();
  const user = useAuthStore((s) => s.user);
  const { width } = useWindowDimensions();
  const [q, setQ] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [jobTypeOpen, setJobTypeOpen] = useState(false);
  const [countryDraft, setCountryDraft] = useState('All Countries');
  const [jobTypeDraft, setJobTypeDraft] = useState('All Job Types');
  const [countryFilter, setCountryFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const cardSize = Math.min(104, Math.floor((width - 56) / 3));
  const userId = String((user as any)?._id || (user as any)?.id || '').trim() || 'guest';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const countryOptions = useMemo(() => {
    const base = ['USA', 'UK', 'Canada', 'Germany', 'Remote'];
    const fromJobs = jobs
      .map((j) => pick(j as any, ['location', 'city', 'jobLocation'], ''))
      .filter(Boolean)
      .map((x) => x.split(',')[0].trim());
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
      const requirements = [
        ...splitList((j as any)?.requirements),
        ...splitList((j as any)?.requirement),
        ...splitList((j as any)?.qualifications),
      ].join(' ');
      const searchable =
        `${pick(j as any, ['title', 'jobTitle', 'position'])} ` +
        `${pick(j as any, ['company', 'companyName'])} ` +
        `${pick(j as any, ['location', 'city', 'jobLocation'])} ` +
        `${pick(j as any, ['type', 'jobType', 'employmentType'])} ` +
        `${pick(j as any, ['salary', 'salaryRange', 'salaryText'])} ` +
        `${pick(j as any, ['pricing', 'price', 'cost'])} ` +
        `${splitList((j as any)?.tags).join(' ')} ` +
        `${splitList((j as any)?.skills).join(' ')} ` +
        `${splitList((j as any)?.benefits).join(' ')} ` +
        `${requirements}`.toLowerCase();

      const jobLocation = pick(j as any, ['location', 'city', 'jobLocation']).toLowerCase();
      const jobType = pick(j as any, ['type', 'jobType', 'employmentType']).toLowerCase();
      const matchesText = !term || searchable.includes(term);
      const matchesCountry = !cFilter || jobLocation.includes(cFilter);
      const matchesType = !tFilter || jobType.includes(tFilter);
      return matchesText && matchesCountry && matchesType;
    });
  }, [jobs, q, countryFilter, jobTypeFilter]);

  const displayName = useMemo(() => {
    const firstLast = `${String(user?.firstName || '').trim()} ${String(user?.lastName || '').trim()}`.trim();
    const full = String(user?.name || user?.fullName || firstLast || '').trim();
    if (full) return full;
    const emailName = String(user?.email || '').split('@')[0].trim();
    return emailName || 'User';
  }, [user]);

  const avatarUri = useMemo(() => {
    const candidate = String(
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
    return candidate.startsWith('/') ? `${origin}${candidate}` : `${origin}/uploads/${candidate}`;
  }, [user]);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUri]);

  useEffect(() => {
    (async () => {
      const saved = await getSavedJobs(userId);
      setSavedIds(saved.map((j) => jobKey(j)).filter(Boolean));
    })();
  }, [userId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await ApplicationsService.my();
        const arr: any[] = Array.isArray(res) ? res : (res as any)?.applications || (res as any)?.items || [];
        const ids = arr
          .map((a: any) => a?.job?._id || a?.job?.id || a?.jobId || a?.job)
          .map((x: any) => String(x || '').trim())
          .filter(Boolean);
        setAppliedIds(Array.from(new Set(ids)));
      } catch {
        setAppliedIds([]);
      }
    })();
  }, []);

  return (
    <Screen padded={false}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: 10 }]}
        data={filtered}
        keyExtractor={(item) => item._id}
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
            <View style={styles.centerBrandWrap}>
              <Image source={require('../../../assets/blue-whale-logo.webp')} style={styles.centerBrandLogo} resizeMode="contain" />
            </View>

            <View style={styles.heroTop}>
              <View>
                <Text allowFontScaling={false} style={[styles.hello, { color: '#1B3890', fontFamily: t.typography.fontFamily.regular }]}>
                  Hello,
                </Text>
                <Text allowFontScaling={false} style={[styles.name, { color: '#1B3890', fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                  {displayName}
                </Text>
              </View>
              <View style={styles.avatarWrap}>
                {avatarUri && !avatarFailed ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} onError={() => setAvatarFailed(true)} />
                ) : (
                  <Feather name="user" size={20} color="#6B6F70" />
                )}
              </View>
            </View>

            <View style={styles.brandWelcomeRow}>
              <Text style={[styles.brandWelcomeText, { color: '#1B3890', fontFamily: t.typography.fontFamily.bold }]}>Welcome to Blue Whale Migration!</Text>
              <Image source={require('../../../assets/blue-whale-favicon.png')} style={styles.brandWelcomeBadge} resizeMode="contain" />
            </View>

            <View style={styles.searchBox}>
              <Feather name="search" size={24} color="#6E79A0" />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search jobs (title, company, salary, requirements...)"
                placeholderTextColor="#6B6F70"
                style={[styles.search, { color: '#111827', fontFamily: t.typography.fontFamily.medium }]}
                returnKeyType="search"
                onSubmitEditing={() => load({ silent: true })}
              />
            </View>

            <View style={styles.filterRow}>
              <Pressable
                style={styles.filterSelect}
                onPress={() => {
                  setCountryOpen((v) => !v);
                  setJobTypeOpen(false);
                }}
              >
                <Feather name="map-pin" size={16} color="#1A67BA" />
                <Text style={[styles.filterSelectText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                  {countryDraft}
                </Text>
                <Feather name={countryOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#4B648F" />
              </Pressable>

              <Pressable
                style={styles.filterSelect}
                onPress={() => {
                  setJobTypeOpen((v) => !v);
                  setCountryOpen(false);
                }}
              >
                <Feather name="briefcase" size={16} color="#1A67BA" />
                <Text style={[styles.filterSelectText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                  {jobTypeDraft}
                </Text>
                <Feather name={jobTypeOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#4B648F" />
              </Pressable>

              <Pressable
                style={styles.filterBtn}
                onPress={() => {
                  setCountryFilter(countryDraft === 'All Countries' ? '' : countryDraft);
                  setJobTypeFilter(jobTypeDraft === 'All Job Types' ? '' : jobTypeDraft);
                  setCountryOpen(false);
                  setJobTypeOpen(false);
                }}
              >
                <Text style={[styles.filterBtnText, { fontFamily: t.typography.fontFamily.bold }]}>Filter</Text>
              </Pressable>

              <Pressable
                style={styles.resetBtn}
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
                <Text style={[styles.resetBtnText, { fontFamily: t.typography.fontFamily.bold }]}>Reset</Text>
              </Pressable>
            </View>

            {countryOpen ? (
              <View style={styles.dropdownPanel}>
                {countryOptions.map((option) => (
                  <Pressable
                    key={option}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setCountryDraft(option);
                      setCountryOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        { fontFamily: option === countryDraft ? t.typography.fontFamily.bold : t.typography.fontFamily.medium },
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {jobTypeOpen ? (
              <View style={styles.dropdownPanel}>
                {jobTypeOptions.map((option) => (
                  <Pressable
                    key={option}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setJobTypeDraft(option);
                      setJobTypeOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        { fontFamily: option === jobTypeDraft ? t.typography.fontFamily.bold : t.typography.fontFamily.medium },
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Image source={require('../../../assets/home_image.png')} resizeMode="cover" style={styles.homeImage} />

            <Text allowFontScaling={false} style={[styles.sectionTitle, { color: '#1B3890', fontFamily: t.typography.fontFamily.bold }]}>
              Recommended for you
            </Text>
            <View style={styles.quickRow}>
              {[
                { key: 'Jobs', icon: 'briefcase' as const, active: true, action: () => navigation.getParent()?.navigate('Home' as never) },
                { key: 'Applications', icon: 'file-text' as const, active: false, action: () => navigation.getParent()?.navigate('Jobs' as never) },
                {
                  key: 'Inquiries',
                  icon: 'help-circle' as const,
                  active: false,
                  action: () =>
                    (navigation.getParent() as any)?.navigate('Inquiries', {
                      screen: 'InquiryList',
                    }),
                },
              ].map((item) => (
                <Pressable
                  key={item.key}
                  onPress={item.action}
                  style={[
                    styles.quickCard,
                    { width: cardSize, height: cardSize - 4 },
                    item.active ? styles.quickCardActive : styles.quickCardIdle,
                  ]}
                >
                  <View style={styles.quickIconChip}>
                    <Feather name={item.icon} size={20} color="#F8FAFC" />
                  </View>
                  <Text
                    style={[
                      styles.quickText,
                      { color: item.active ? '#1B3890' : '#22325E', fontFamily: t.typography.fontFamily.bold },
                    ]}
                    numberOfLines={1}
                  >
                    {item.key}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.categoryRow}>
              <Text allowFontScaling={false} style={[styles.categoryTitle, { color: '#1B3890', fontFamily: t.typography.fontFamily.bold }]}>
                Job Categories
              </Text>
              <Text allowFontScaling={false} style={[styles.viewAll, { color: '#5D7BBE', fontFamily: t.typography.fontFamily.medium }]}>
                View all
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: Spacing.sm }}>
              <Skeleton height={84} />
              <Skeleton height={84} />
            </View>
          ) : (
            <EmptyState
              icon="o"
              title={errorMessage ? 'Unable to load jobs' : 'No jobs found'}
              message={errorMessage || 'Try different keywords or refresh.'}
            />
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.jobCard}>
            <View style={styles.jobTopRow}>
              <View style={styles.jobIconWrap}>
                <Feather name="briefcase" size={19} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.jobTitle, { color: '#122A74', fontFamily: t.typography.fontFamily.bold }]} numberOfLines={2}>
                  {pick(item, ['title', 'jobTitle', 'position'], 'Untitled role')}
                </Text>
                <View style={styles.typePill}>
                  <Text style={[styles.typePillText, { fontFamily: t.typography.fontFamily.medium }]}>
                    {pick(item, ['type', 'jobType', 'employmentType'], 'Type')}
                  </Text>
                </View>
              </View>
              <Pressable
                style={[
                  styles.favWrap,
                  savedIds.includes(jobKey(item)) && styles.favWrapSaved,
                ]}
                hitSlop={12}
                onPress={async () => {
                  const k = jobKey(item);
                  const wasSaved = savedIds.includes(k);
                  const optimistic = wasSaved ? savedIds.filter((x) => x !== k) : [k, ...savedIds];
                  setSavedIds(optimistic);
                  try {
                    const current = await getSavedJobs(userId);
                    const exists = current.some((j) => jobKey(j) === k);
                    const next = exists ? current.filter((j) => jobKey(j) !== k) : [item, ...current];
                    await setSavedJobs(userId, next);
                    setSavedIds(next.map((j) => jobKey(j)).filter(Boolean));
                  } catch {
                    setSavedIds(wasSaved ? [...savedIds] : savedIds.filter((x) => x !== k));
                  }
                }}
              >
                <Feather
                  name="heart"
                  size={18}
                  color={savedIds.includes(jobKey(item)) ? '#FF3B45' : '#B7C0D4'}
                />
              </Pressable>
            </View>

            <Pressable onPress={() => navigation.navigate('JobDetails', { jobId: item._id })} style={({ pressed }) => [pressed && { opacity: 0.97 }]}>
            <View style={styles.badgesRow}>
              {(() => {
                const tags = splitList((item as any)?.tags).map((x) => x.toLowerCase());
                const b: string[] = [];
                if ((item as any)?.featured || tags.includes('featured')) b.push('Featured');
                if ((item as any)?.urgent || tags.includes('urgent')) b.push('Urgent');
                if ((item as any)?.visaSponsored || (item as any)?.visa_sponsored || tags.includes('visa sponsored')) b.push('Visa Sponsored');
                return b.slice(0, 3).map((x) => (
                  <View key={`${item._id}-${x}`} style={styles.badgePill}>
                    <Text style={[styles.badgeText, { fontFamily: t.typography.fontFamily.medium }]}>{x}</Text>
                  </View>
                ));
              })()}
            </View>

            <View style={styles.metaWrap}>
              <View style={styles.metaPill}>
                <Feather name="map-pin" size={14} color="#1A7DD5" />
                <Text style={[styles.metaText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                  {pick(item, ['location', 'city', 'jobLocation'], 'N/A')}
                </Text>
              </View>
              <View style={[styles.metaPill, styles.metaPillPurple]}>
                <Feather name="dollar-sign" size={14} color="#7C2BC4" />
                <Text style={[styles.metaText, styles.metaTextPurple, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                  {`Salary: ${pick(item, ['salary', 'salaryRange', 'salaryText'], 'N/A')}`}
                </Text>
              </View>
            </View>

            <View style={styles.metaWrap}>
              <View style={[styles.metaPill, styles.metaPillGreen]}>
                <Feather name="clock" size={14} color="#03A561" />
                <Text style={[styles.metaText, styles.metaTextGreen, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                  {`Pricing: ${pick(item, ['pricing', 'price', 'cost'], 'N/A')}`}
                </Text>
              </View>
              <View style={[styles.metaPill, styles.metaPillOrange]}>
                <Feather name="calendar" size={14} color="#DF5C0D" />
                <Text style={[styles.metaText, styles.metaTextOrange, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                  {`Expires: ${(() => {
                    const raw = pick(item, ['closingDate', 'applicationDeadline', 'deadline', 'expiryDate'], '');
                    return raw ? formatDate(raw) || raw : 'N/A';
                  })()}`}
                </Text>
              </View>
            </View>

            <Text style={[styles.reqHeading, { color: '#1D2D4F', fontFamily: t.typography.fontFamily.bold }]}>Requirements:</Text>
            <View style={styles.reqList}>
              {(() => {
                const all = [
                  ...splitList((item as any)?.requirements),
                  ...splitList((item as any)?.requirement),
                  ...splitList((item as any)?.qualifications),
                ];
                const unique = Array.from(new Set(all)).slice(0, 2);
                if (!unique.length) {
                  return <Text style={[styles.reqMore, { fontFamily: t.typography.fontFamily.medium }]}>No requirements listed</Text>;
                }
                return (
                  <>
                    {unique.map((r) => (
                      <View key={`${item._id}-${r}`} style={styles.reqRow}>
                        <Feather name="check-circle" size={17} color="#10B963" />
                        <Text style={[styles.reqText, { fontFamily: t.typography.fontFamily.medium }]}>{r}</Text>
                      </View>
                    ))}
                    {all.length > unique.length ? (
                      <Text style={[styles.reqMore, { fontFamily: t.typography.fontFamily.bold }]}>{`+${all.length - unique.length} more requirements`}</Text>
                    ) : null}
                  </>
                );
              })()}
            </View>
            </Pressable>

            <View style={styles.cardButtonsRow}>
              <Pressable
                style={styles.detailsBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  navigation.navigate('JobDetails', { jobId: item._id });
                }}
              >
                <Feather name="file-text" size={16} color="#2170C7" />
                <Text style={[styles.detailsBtnText, { fontFamily: t.typography.fontFamily.bold }]}>Details</Text>
              </Pressable>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  if (!appliedIds.includes(String(item._id))) {
                    navigation.navigate('ApplyJob', { jobId: item._id });
                  }
                }}
                style={{ flex: 1 }}
              >
                {appliedIds.includes(String(item._id)) ? (
                  <View style={styles.appliedBtn}>
                    <Feather name="check-circle" size={16} color="#119A4F" />
                    <Text style={[styles.appliedBtnText, { fontFamily: t.typography.fontFamily.bold }]}>Applied</Text>
                  </View>
                ) : (
                  <LinearGradient colors={['#1B3890', '#0F79C5']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.applyBtn}>
                    <Feather name="send" size={16} color="#FFFFFF" />
                    <Text style={[styles.applyBtnText, { fontFamily: t.typography.fontFamily.bold }]}>Apply</Text>
                  </LinearGradient>
                )}
              </Pressable>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 130,
  },
  brandWelcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#D5DEF3',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  brandWelcomeText: {
    flex: 1,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  brandWelcomeBadge: {
    width: 28,
    height: 28,
    marginLeft: 10,
    borderRadius: 8,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  centerBrandWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  centerBrandLogo: {
    width: 220,
    height: 72,
  },
  hello: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '400',
  },
  name: {
    marginTop: 2,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  avatarWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5ECFA',
    borderWidth: 1,
    borderColor: '#D4DDF2',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  searchBox: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D3DDF4',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  search: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    marginLeft: 10,
    marginRight: 4,
    fontWeight: '500',
  },
  filterRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterSelect: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D8F3',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterSelectText: {
    flex: 1,
    marginLeft: 6,
    marginRight: 4,
    color: '#29477E',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  filterBtn: {
    minHeight: 44,
    minWidth: 64,
    borderRadius: 12,
    backgroundColor: '#165EAC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  filterBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  resetBtn: {
    minHeight: 44,
    minWidth: 64,
    borderRadius: 12,
    backgroundColor: '#EFF3F9',
    borderWidth: 1,
    borderColor: '#D2DDF2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  resetBtnText: {
    color: '#37507D',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  dropdownPanel: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BCD0F1',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  dropdownItem: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#DFE8F8',
  },
  dropdownItemText: {
    color: '#203D73',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  homeImage: {
    width: '100%',
    height: 138,
    borderRadius: 18,
    marginTop: 10,
  },
  sectionTitle: {
    marginTop: 12,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 10,
  },
  quickCard: {
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  quickCardActive: {
    backgroundColor: '#DDEBFD',
    borderColor: '#CBD8F0',
    shadowColor: '#7BA2DE',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  quickCardIdle: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD8F0',
  },
  quickIconChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0F79C5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  viewAll: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  jobCard: {
    marginBottom: Spacing.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: '#D5DEF3',
    borderRadius: Radius.lg + 2,
    backgroundColor: '#F8FAFC',
    shadowColor: '#5F82BA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  jobTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  jobIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: '#196FC0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  jobTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  typePill: {
    marginTop: 7,
    alignSelf: 'flex-start',
    backgroundColor: '#DCEBFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  typePillText: {
    color: '#1A66B8',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  favWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F0F4FB',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    elevation: 2,
  },
  favWrapSaved: {
    backgroundColor: '#FAD9DD',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FDEAEA',
    borderWidth: 1,
    borderColor: '#F8CFCF',
  },
  badgeText: {
    color: '#BD212A',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  metaWrap: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  metaPill: {
    flex: 1,
    borderRadius: 11,
    paddingHorizontal: 9,
    paddingVertical: 8,
    backgroundColor: '#EEF4FE',
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaPillPurple: {
    backgroundColor: '#F1EAFD',
  },
  metaPillGreen: {
    backgroundColor: '#E7F8EF',
  },
  metaPillOrange: {
    backgroundColor: '#FCEFDF',
  },
  metaText: {
    marginLeft: 5,
    color: '#23407F',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
    flex: 1,
  },
  metaTextPurple: {
    color: '#7D2EC4',
  },
  metaTextGreen: {
    color: '#049A5A',
  },
  metaTextOrange: {
    color: '#D25913',
  },
  reqHeading: {
    marginTop: 2,
    marginBottom: 6,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  reqList: {
    marginBottom: 10,
    gap: 6,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  reqText: {
    flex: 1,
    marginLeft: 8,
    color: '#33435F',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },
  reqMore: {
    color: '#1D6FC7',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  cardButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  detailsBtn: {
    flex: 1,
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#5EA1E4',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  detailsBtnText: {
    color: '#1F73CA',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  applyBtn: {
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
  appliedBtn: {
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#33C16D',
    backgroundColor: '#CDEEDB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  appliedBtnText: {
    color: '#128A4A',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
});
