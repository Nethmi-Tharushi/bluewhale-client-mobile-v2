import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, Screen } from '../../components/ui';
import { JobsService } from '../../api/services';
import type { Job } from '../../types/models';
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
  const { jobId } = route.params;
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await JobsService.get(jobId);
        setJob(data);
      } catch {
        setJob(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId]);

  const title = pickString(job, ['title', 'jobTitle', 'position'], loading ? 'Loading...' : 'Job details');
  const company = pickString(job, ['company', 'companyName', 'employer', 'organization'], 'Company');
  const location = pickString(job, ['location', 'city', 'jobLocation'], 'Location not specified');
  const jobType = pickString(job, ['type', 'jobType', 'employmentType'], 'Not specified');
  const salary = pickString(job, ['salary', 'salaryRange', 'salaryText'], 'Not specified');
  const closingDateRaw = pickString(job, ['closingDate', 'applicationDeadline', 'deadline', 'expiryDate'], '');
  const closingDate = closingDateRaw ? formatDateValue(closingDateRaw) : 'Not specified';
  const description = pickString(job, ['description', 'jobDescription', 'overview'], 'No description provided.');

  const requirements = useMemo(() => {
    const list = [
      ...listFromAny((job as any)?.requirements),
      ...listFromAny((job as any)?.requirement),
      ...listFromAny((job as any)?.qualifications),
    ];
    return Array.from(new Set(list));
  }, [job]);

  const skills = useMemo(() => {
    const list = [...listFromAny((job as any)?.skills), ...listFromAny((job as any)?.skillSet), ...listFromAny((job as any)?.tags)];
    return Array.from(new Set(list));
  }, [job]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text style={[styles.title, { color: t.colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: t.colors.textMuted }]}>{`${company} · ${location}`}</Text>
        </Card>

        <Card style={styles.gapTop}>
          <Text style={[styles.sectionTitle, { color: t.colors.primary }]}>Overview</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.metaKey, { color: t.colors.textMuted }]}>Job type</Text>
            <Text style={[styles.metaValue, { color: t.colors.text }]}>{jobType}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.metaKey, { color: t.colors.textMuted }]}>Salary</Text>
            <Text style={[styles.metaValue, { color: t.colors.text }]}>{salary}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.metaKey, { color: t.colors.textMuted }]}>Closing date</Text>
            <Text style={[styles.metaValue, { color: t.colors.text }]}>{closingDate}</Text>
          </View>
        </Card>

        <Card style={styles.gapTop}>
          <Text style={[styles.sectionTitle, { color: t.colors.primary }]}>Description</Text>
          <Text style={[styles.bodyText, { color: t.colors.text }]}>{description}</Text>
        </Card>

        <Card style={styles.gapTop}>
          <Text style={[styles.sectionTitle, { color: t.colors.primary }]}>Requirements</Text>
          {requirements.length ? (
            requirements.map((item) => (
              <Text key={item} style={[styles.listItem, { color: t.colors.text }]}>
                {`\u2022 ${item}`}
              </Text>
            ))
          ) : (
            <Text style={[styles.bodyText, { color: t.colors.textMuted }]}>No requirements provided.</Text>
          )}
        </Card>

        {skills.length ? (
          <Card style={styles.gapTop}>
            <Text style={[styles.sectionTitle, { color: t.colors.primary }]}>Skills</Text>
            <View style={styles.chipWrap}>
              {skills.map((item) => (
                <View key={item} style={[styles.chip, { borderColor: t.colors.borderStrong, backgroundColor: t.colors.surfaceMuted }]}>
                  <Text style={[styles.chipText, { color: t.colors.text }]}>{item}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        <View style={styles.actions}>
          <Button title="Apply now" onPress={() => navigation.navigate('ApplyJob', { jobId })} />
          <View style={{ height: 10 }} />
          <Button
            title="Ask a question"
            variant="outline"
            onPress={() =>
              (navigation.getParent() as any)?.navigate('Inquiries', {
                screen: 'CreateInquiry',
                params: { jobId },
              })
            }
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120,
  },
  gapTop: {
    marginTop: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metaKey: {
    fontSize: 13,
    fontWeight: '600',
  },
  metaValue: {
    flex: 1,
    marginLeft: 12,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
  },
  bodyText: {
    lineHeight: 22,
    fontSize: 14,
    fontWeight: '500',
  },
  listItem: {
    lineHeight: 22,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    marginTop: 10,
  },
});
