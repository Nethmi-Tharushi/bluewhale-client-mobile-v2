import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { JobsService } from '../../api/services';
import type { Job } from '../../types/models';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { JobsStackParamList } from '../../navigation/app/AppNavigator';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<JobsStackParamList, 'JobDetails'>;

const pickString = (obj: any, keys: string[], fallback = '') => {
  for (const key of keys) {
    const v = obj?.[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return fallback;
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
  const { jobId } = route.params;
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

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

  const title = pickString(job, ['title', 'jobTitle', 'position'], loading ? 'Loading...' : 'Job Details');
  const company = pickString(job, ['company', 'companyName', 'employer', 'organization'], 'Company');
  const location = pickString(job, ['location', 'city', 'jobLocation'], 'Location');
  const jobType = pickString(job, ['type', 'jobType', 'employmentType'], 'N/A');
  const pricing = pickString(job, ['pricing', 'price', 'cost'], 'N/A');
  const salary = pickString(job, ['salary', 'salaryRange', 'salaryText'], 'N/A');
  const closingDateRaw = pickString(job, ['closingDate', 'applicationDeadline', 'deadline', 'expiryDate'], 'N/A');
  const closingDate = closingDateRaw === 'N/A' ? 'N/A' : formatDateValue(closingDateRaw);
  const ageLimit =
    pickString(job, ['ageLimit', 'ageRange'], '') ||
    (() => {
      const min = pickString(job, ['minAge'], '');
      const max = pickString(job, ['maxAge'], '');
      return min || max ? `${min || '?'} - ${max || '?'} years` : 'N/A';
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
    (navigation.getParent() as any)?.navigate('Inquiries', {
      screen: 'CreateInquiry',
      params: { jobId },
    });

  const onShare = async () => {
    try {
      await Share.share({
        message: `${title} at ${company}${websiteUrl ? `\n${websiteUrl}` : ''}`,
      });
    } catch {}
  };

  const onSave = () => Alert.alert('Saved', 'Job saved successfully.');

  return (
    <LinearGradient colors={t.colors.gradientBackground as any} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: Math.max(8, insets.top + 4), paddingBottom: 220 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
              <Feather name="arrow-left" size={26} color="#132A74" />
            </Pressable>
            <View style={styles.titleWrap}>
              <Text style={[styles.title, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={[styles.subtitle, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                {`${company} · ${location}`}
              </Text>
            </View>
            <View style={styles.flagBtn}>
              <Feather name="flag" size={19} color="#3C57A4" />
            </View>
          </View>

          <View style={styles.companyCard}>
            <LinearGradient colors={['#233F97', '#0F79C5']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.heroStrip}>
              <Feather name="briefcase" size={24} color="#FFFFFF" />
              <Text style={[styles.heroStripText, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                {title}
              </Text>
            </LinearGradient>

            <View style={styles.companyBody}>
              <Text style={[styles.companyName, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                {company}
              </Text>
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={16} color="#7C85A8" />
                <Text style={[styles.locationText, { fontFamily: t.typography.fontFamily.medium }]}>{location}</Text>
              </View>

              <View style={styles.badgesRow}>
                {badges.map((item) => (
                  <View key={item} style={styles.badgePill}>
                    <Text style={[styles.badgeText, { fontFamily: t.typography.fontFamily.medium }]}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.companyDivider} />
            <View style={styles.actionRow}>
              <Pressable style={styles.actionCell} onPress={onSave}>
                <Feather name="bookmark" size={22} color="#1F4BA7" />
                <Text style={[styles.actionText, { fontFamily: t.typography.fontFamily.medium }]}>Save</Text>
              </Pressable>
              <View style={styles.actionDivider} />
              <Pressable style={styles.actionCell} onPress={onShare}>
                <Feather name="share-2" size={22} color="#1F4BA7" />
                <Text style={[styles.actionText, { fontFamily: t.typography.fontFamily.bold }]}>Share</Text>
              </Pressable>
              <View style={styles.actionDivider} />
              <Pressable style={styles.actionCell} onPress={() => websiteUrl && Linking.openURL(websiteUrl)} disabled={!websiteUrl}>
                <Feather name="log-out" size={22} color="#1F4BA7" />
                <Text style={[styles.actionText, { fontFamily: t.typography.fontFamily.medium }]}>Visit Website</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.metricsCard}>
            <Text style={[styles.metricsTitle, { fontFamily: t.typography.fontFamily.bold }]}>Job Details</Text>
            <View style={styles.metricsGrid}>
              {[
                { key: 'Location', value: location, icon: 'map-pin' as const },
                { key: 'Pricing', value: pricing, icon: 'clock' as const },
                { key: 'Salary', value: salary, icon: 'dollar-sign' as const },
                { key: 'Closing Date', value: closingDate, icon: 'calendar' as const },
                { key: 'Age Limit', value: ageLimit, icon: 'users' as const },
                { key: 'Job Type', value: jobType, icon: 'briefcase' as const },
              ].map((item) => (
                <View key={item.key} style={styles.metricCell}>
                  <View style={styles.metricLabelRow}>
                    <Feather name={item.icon} size={14} color="#1F4BA7" />
                    <Text style={[styles.metricLabel, { fontFamily: t.typography.fontFamily.medium }]}>{item.key}</Text>
                  </View>
                  <Text style={[styles.metricValue, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={2}>
                    {item.value || 'N/A'}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Feather name="file-text" size={20} color="#4794EC" />
              <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Job Description</Text>
            </View>
            <Text style={[styles.sectionText, { fontFamily: t.typography.fontFamily.medium }]}>{description}</Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Feather name="check-circle" size={20} color="#4794EC" />
              <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Requirements</Text>
            </View>
            <View style={styles.requirementsWrap}>
              {requirements.map((item) => (
                <View key={item} style={styles.reqRow}>
                  <Feather name="check-circle" size={18} color="#1A84DE" />
                  <Text style={[styles.reqText, { fontFamily: t.typography.fontFamily.medium }]}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          {skills.length ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <Feather name="star" size={20} color="#4794EC" />
                <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Skills</Text>
              </View>
              <View style={styles.skillsWrap}>
                {skills.map((item) => (
                  <View key={item} style={styles.skillPill}>
                    <Text style={[styles.skillText, { fontFamily: t.typography.fontFamily.medium }]}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {benefits.length ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <Feather name="award" size={20} color="#4794EC" />
                <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Benefits</Text>
              </View>
              <View style={styles.requirementsWrap}>
                {benefits.map((item) => (
                  <View key={item} style={styles.reqRow}>
                    <Feather name="check-circle" size={18} color="#1A84DE" />
                    <Text style={[styles.reqText, { fontFamily: t.typography.fontFamily.medium }]}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.bottomCard, { bottom: 104 + insets.bottom }]}>
          <Pressable onPress={onApply} style={({ pressed }) => [pressed && { opacity: 0.95 }]}>
            <LinearGradient colors={['#FF8A1E', '#FF5D0A']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.applyBtn}>
              <Feather name="mail" size={22} color="#FFFFFF" />
              <Text style={[styles.applyText, { fontFamily: t.typography.fontFamily.bold }]}>Apply Now</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={onAsk}>
            <Text style={[styles.askText, { fontFamily: t.typography.fontFamily.bold }]}>Ask a question</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    gap: 14,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  backBtn: {
    width: 46,
    alignItems: 'flex-start',
  },
  titleWrap: {
    flex: 1,
    marginLeft: 4,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    color: '#122A74',
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 3,
    fontSize: 15,
    lineHeight: 20,
    color: '#293974',
    fontWeight: '600',
  },
  flagBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D9E3F5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7B8DBA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 3,
  },
  companyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D8E3F7',
    overflow: 'hidden',
    shadowColor: '#7289BA',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  heroStrip: {
    minHeight: 92,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStripText: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
    textAlign: 'center',
  },
  companyBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  companyName: {
    fontSize: 20,
    lineHeight: 25,
    color: '#122A74',
    fontWeight: '900',
  },
  locationRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    marginLeft: 6,
    fontSize: 14,
    lineHeight: 19,
    color: '#6E789D',
    fontWeight: '600',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 6,
  },
  badgePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FDEAEA',
    borderWidth: 1,
    borderColor: '#F6CDCD',
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
    marginTop: 10,
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  actionCell: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#1E3F8C',
    fontWeight: '700',
  },
  actionDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#DCE5F6',
  },
  metricsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D8E3F7',
    padding: 14,
    shadowColor: '#7289BA',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 3,
  },
  metricsTitle: {
    color: '#0F2E7A',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    marginBottom: 10,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCell: {
    width: '48%',
    minHeight: 70,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CFE0F8',
    backgroundColor: '#EAF2FF',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricLabel: {
    marginLeft: 5,
    color: '#234287',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  metricValue: {
    marginTop: 5,
    color: '#0C1E4F',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D8E3F7',
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#7289BA',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  sectionTitle: {
    color: '#1A388D',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  sectionText: {
    color: '#171F34',
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '500',
  },
  requirementsWrap: {
    gap: 8,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reqText: {
    flex: 1,
    color: '#1A2238',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '500',
    marginLeft: 8,
  },
  skillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#DCEBFF',
  },
  skillText: {
    color: '#1B3B89',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  bottomCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D8E3F7',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
    shadowColor: '#7289BA',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 5,
  },
  applyBtn: {
    height: 68,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  applyText: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  askText: {
    marginTop: 12,
    textAlign: 'center',
    color: '#1A3E8D',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
});
