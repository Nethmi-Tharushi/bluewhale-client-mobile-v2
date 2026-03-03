import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, EmptyState, Screen } from '../../components/ui';
import { Spacing } from '../../constants/theme';
import { ApplicationsService } from '../../api/services';
import type { Application, Job } from '../../types/models';
import { formatDate } from '../../utils/format';
import { useTheme } from '../../theme/ThemeProvider';
import { getSavedJobs } from '../../utils/savedJobsStorage';
import { useAuthStore } from '../../context/authStore';

const pick = (obj: any, keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = obj?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
};

export default function MyApplicationsScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<'applied' | 'saved'>('applied');
  const [items, setItems] = useState<Application[]>([]);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const userId = String((user as any)?._id || (user as any)?.id || '').trim() || 'guest';

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
      const s = await getSavedJobs(userId);
      saved = Array.isArray(s) ? s : [];
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

  const listData = tab === 'applied' ? items : savedJobs;

  return (
    <Screen>
      <FlatList
        contentContainerStyle={{ paddingBottom: 170 }}
        data={listData}
        keyExtractor={(it: any) => String(it?._id || it?.id || Math.random())}
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
          <View style={{ marginBottom: Spacing.sm }}>
            <View style={styles.headerBox}>
              <Text style={[styles.heading, { color: '#1B3890', fontFamily: t.typography.fontFamily.bold }]}>My Applications</Text>
              <Text style={[styles.sub, { color: '#6B7F96', fontFamily: t.typography.fontFamily.medium }]}>
                Track applied jobs and your saved opportunities
              </Text>
            </View>

            <View style={styles.tabShell}>
              <Pressable onPress={() => setTab('applied')} style={[styles.tabBtn, tab === 'applied' && styles.tabBtnActive]}>
                <Feather name="file-text" size={16} color={tab === 'applied' ? '#FFFFFF' : '#2A5EA8'} />
                <Text style={[styles.tabText, tab === 'applied' && styles.tabTextActive, { fontFamily: t.typography.fontFamily.bold }]}>Applied Jobs</Text>
              </Pressable>
              <Pressable onPress={() => setTab('saved')} style={[styles.tabBtn, tab === 'saved' && styles.tabBtnActive]}>
                <Feather name="heart" size={16} color={tab === 'saved' ? '#FFFFFF' : '#2A5EA8'} />
                <Text style={[styles.tabText, tab === 'saved' && styles.tabTextActive, { fontFamily: t.typography.fontFamily.bold }]}>Saved Jobs</Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="o"
            title={loading ? 'Loading...' : tab === 'applied' ? 'No applications yet' : 'No saved jobs yet'}
            message={loading ? 'Please wait' : tab === 'applied' ? 'Apply to jobs and they will appear here.' : 'Tap the heart icon in job listing to save jobs.'}
          />
        }
        renderItem={({ item }: { item: any }) => {
          if (tab === 'applied') {
            const job: any = item.job;
            const status = String(item?.status || 'Pending');
            return (
              <Card style={styles.itemCard}>
                <View style={styles.topRow}>
                  <View style={styles.iconChip}>
                    <Feather name="briefcase" size={18} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                      {pick(job, ['title', 'jobTitle', 'position'], 'Job application')}
                    </Text>
                    <Text style={[styles.company, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                      {pick(job, ['company', 'companyName'], 'Company')}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, status.toLowerCase().includes('accept') && styles.statusAccepted]}>
                    <Text style={[styles.statusText, { fontFamily: t.typography.fontFamily.bold }]}>{status}</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaPill}>
                    <Feather name="map-pin" size={14} color="#2B73C5" />
                    <Text style={[styles.metaText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                      {pick(job, ['location', 'city', 'jobLocation'], 'Location')}
                    </Text>
                  </View>
                  <View style={styles.metaPill}>
                    <Feather name="clock" size={14} color="#2B73C5" />
                    <Text style={[styles.metaText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                      {`Submitted ${formatDate(item.createdAt) || 'recently'}`}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionsRow}>
                  <Pressable
                    style={styles.actionOutline}
                    onPress={() => navigation.navigate('Home', { screen: 'JobDetails', params: { jobId: job?._id || item?.jobId || item?.job } })}
                  >
                    <Feather name="file-text" size={15} color="#2170C7" />
                    <Text style={[styles.actionOutlineText, { fontFamily: t.typography.fontFamily.bold }]}>Details</Text>
                  </Pressable>
                  <View style={styles.appliedBtn}>
                    <Feather name="check-circle" size={15} color="#139A52" />
                    <Text style={[styles.appliedBtnText, { fontFamily: t.typography.fontFamily.bold }]}>Applied</Text>
                  </View>
                </View>
              </Card>
            );
          }

          return (
            <Card style={styles.itemCard}>
              <View style={styles.topRow}>
                <View style={styles.iconChip}>
                  <Feather name="bookmark" size={18} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                    {pick(item, ['title', 'jobTitle', 'position'], 'Saved job')}
                  </Text>
                  <Text style={[styles.company, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                    {`${pick(item, ['company', 'companyName'], 'Company')} - ${pick(item, ['location', 'city', 'jobLocation'], 'Location')}`}
                  </Text>
                </View>
                <View style={styles.savedPill}>
                  <Text style={[styles.savedPillText, { fontFamily: t.typography.fontFamily.bold }]}>Saved</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaPill}>
                  <Feather name="briefcase" size={14} color="#2B73C5" />
                  <Text style={[styles.metaText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                    {pick(item, ['type', 'jobType', 'employmentType'], 'Type')}
                  </Text>
                </View>
                <View style={styles.metaPill}>
                  <Feather name="dollar-sign" size={14} color="#2B73C5" />
                  <Text style={[styles.metaText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                    {`Salary ${pick(item, ['salary', 'salaryRange', 'salaryText'], 'N/A')}`}
                  </Text>
                </View>
              </View>

              <View style={styles.actionsRow}>
                <Pressable
                  style={styles.actionOutline}
                  onPress={() => navigation.navigate('Home', { screen: 'JobDetails', params: { jobId: item._id } })}
                >
                  <Feather name="file-text" size={15} color="#2170C7" />
                  <Text style={[styles.actionOutlineText, { fontFamily: t.typography.fontFamily.bold }]}>Details</Text>
                </Pressable>
                <Pressable
                  onPress={() => navigation.navigate('Home', { screen: 'ApplyJob', params: { jobId: item._id } })}
                  style={{ flex: 1 }}
                >
                  <LinearGradient colors={['#1B3890', '#0F79C5']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.actionFilled}>
                    <Feather name="send" size={15} color="#FFFFFF" />
                    <Text style={[styles.actionFilledText, { fontFamily: t.typography.fontFamily.bold }]}>Apply</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBox: {
    marginTop: 30,
    marginBottom: 12,
  },
  heading: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
  },
  sub: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  tabShell: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 16,
    padding: 4,
    backgroundColor: '#EAF1FD',
    borderWidth: 1,
    borderColor: '#D1DEF5',
  },
  tabBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFD0ED',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: '#1B3890',
    borderColor: '#1B3890',
  },
  tabText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    color: '#214D98',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  itemCard: {
    marginBottom: Spacing.sm,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D5DEF3',
    backgroundColor: '#F8FAFC',
    shadowColor: '#5F82BA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    padding: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#196FC0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {
    color: '#112B73',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  company: {
    marginTop: 3,
    color: '#637792',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#D3DDF1',
    backgroundColor: '#F1F5FB',
  },
  statusAccepted: {
    borderColor: '#8FD4A9',
    backgroundColor: '#D8F3E3',
  },
  statusText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#1E4E94',
    fontWeight: '800',
  },
  savedPill: {
    marginTop: 2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#A7C8EC',
    backgroundColor: '#E5F2FF',
  },
  savedPillText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#1A74C8',
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  metaPill: {
    flex: 1,
    minHeight: 42,
    borderRadius: 11,
    paddingHorizontal: 10,
    backgroundColor: '#EEF4FE',
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    marginLeft: 6,
    color: '#2B4A81',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    flex: 1,
  },
  actionsRow: {
    marginTop: 2,
    flexDirection: 'row',
    gap: 10,
  },
  actionOutline: {
    flex: 1,
    minHeight: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#5EA1E4',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  actionOutlineText: {
    color: '#2170C7',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  actionFilled: {
    minHeight: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  actionFilledText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  appliedBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#35C070',
    backgroundColor: '#CDEEDB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  appliedBtnText: {
    color: '#118A4A',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
});
