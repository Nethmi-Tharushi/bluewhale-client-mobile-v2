import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { EmptyState, Screen } from '../../components/ui';
import { TasksService } from '../../api/services';
import type { Task } from '../../types/models';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TasksStackParamList } from '../../navigation/app/AppNavigator';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<TasksStackParamList, 'TasksList'>;

const statusList = ['All', 'Pending', 'Completed'] as const;

const normalizeStatus = (status?: string) => {
  const s = String(status || '').trim();
  return s === 'In Progress' ? 'Pending' : s || 'Pending';
};

const statusTone = (status?: string) => {
  const s = normalizeStatus(status).toLowerCase();
  if (s === 'completed') return { bg: '#D8F2E3', text: '#118D4C' };
  if (s === 'pending') return { bg: '#DFEBFF', text: '#1D5FD2' };
  if (s === 'cancelled') return { bg: '#FDE1E1', text: '#D12B2B' };
  return { bg: '#E8EDF8', text: '#4E628E' };
};

const niceDate = (v?: string) => {
  if (!v) return 'N/A';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const isOverdue = (task: Task) => {
  if (!task?.dueDate) return false;
  if (String(task?.status || '').toLowerCase() === 'completed') return false;
  const d = new Date(task.dueDate);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
};

export default function TasksListScreen({ navigation }: Props) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof statusList)[number]>('All');

  const heroEntrance = useRef(new Animated.Value(0)).current;
  const listEntrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  const load = async () => {
    setLoading(true);
    try {
      const list = await TasksService.list();
      setItems(Array.isArray(list) ? list : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation]);

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
        delay: 90,
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
          Animated.timing(sweep, { toValue: 1, duration: 2200, delay: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ),
    ];

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [drift, heroEntrance, listEntrance, pulse, sweep]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((task) => {
      const title = String(task?.title || '').toLowerCase();
      const desc = String(task?.description || '').toLowerCase();
      const status = normalizeStatus(task?.status);
      const matchesSearch = !term || title.includes(term) || desc.includes(term);
      const matchesStatus = statusFilter === 'All' || status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [items, q, statusFilter]);

  const stats = useMemo(() => {
    const total = items.length;
    const pending = items.filter((x) => String(x.status || '').toLowerCase() === 'pending').length;
    const completed = items.filter((x) => String(x.status || '').toLowerCase() === 'completed').length;
    const overdue = items.filter((x) => isOverdue(x)).length;
    return { total, pending, completed, overdue };
  }, [items]);

  const heroY = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.46] });
  const driftY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-180, 240] });
  const highlightedCount = stats.pending + stats.overdue;
  const completionRate = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;

  const heroStats = [
    { label: 'Open', value: stats.pending, tone: '#1D5FD2', bg: '#E9F1FF', icon: 'clock' as const },
    { label: 'Done', value: stats.completed, tone: '#118D4C', bg: '#E1F6EA', icon: 'check-circle' as const },
    { label: 'Due soon', value: stats.overdue, tone: '#D45E16', bg: '#FFF0E4', icon: 'alert-circle' as const },
  ];

  return (
    <Screen padded={false}>
      <FlatList
        contentContainerStyle={styles.content}
        data={filtered}
        keyExtractor={(it, idx) => String(it?._id || it?.id || idx)}
        showsVerticalScrollIndicator={false}
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
            <Animated.View style={[styles.headerRow, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
              <Pressable
                onPress={() => navigation.canGoBack() && navigation.goBack()}
                style={({ pressed }) => [styles.backBtn, !navigation.canGoBack() && styles.backBtnHidden, pressed && styles.pressed]}
                disabled={!navigation.canGoBack()}
              >
                <Feather name="arrow-left" size={18} color="#1B3890" />
              </Pressable>
              <View style={styles.headerCopy}>
                <Text style={[styles.eyebrow, { fontFamily: t.typography.fontFamily.bold }]}>WORKFLOW BOARD</Text>
                <Text style={[styles.heading, { color: '#1B3890', fontFamily: t.typography.fontFamily.bold }]}>My Tasks</Text>
                <Text style={[styles.sub, { color: '#5E6F95', fontFamily: t.typography.fontFamily.medium }]}>Track priorities and deadlines in one place.</Text>
              </View>
              <View style={styles.headerChip}>
                <Animated.View style={[styles.headerDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                <Text style={[styles.headerChipText, { fontFamily: t.typography.fontFamily.bold }]}>{loading ? 'Syncing' : 'Live'}</Text>
              </View>
            </Animated.View>

            <Animated.View style={[styles.heroCard, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
              <View style={styles.heroGlowA} />
              <Animated.View style={[styles.heroGlowB, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
              <Animated.View style={[styles.heroSweep, { transform: [{ translateX: sweepX }, { rotate: '18deg' }] }]} />

              <View style={styles.heroTopRow}>
                <View style={styles.heroBadge}>
                  <Feather name="layers" size={13} color="#1968B7" />
                  <Text style={[styles.heroBadgeText, { fontFamily: t.typography.fontFamily.bold }]}>Task control</Text>
                </View>
                <View style={styles.heroStatusChip}>
                  <Feather name="zap" size={13} color="#118D4C" />
                  <Text style={[styles.heroStatusText, { fontFamily: t.typography.fontFamily.bold }]}>Focus mode</Text>
                </View>
              </View>

              <View style={[styles.heroMain, compact && styles.heroMainCompact]}>
                <View style={styles.heroCopyBlock}>
                  <Text style={[styles.heroTitle, { fontFamily: t.typography.fontFamily.bold }]}>Plan tasks and hit deadlines.</Text>
                  <Text style={[styles.heroBody, { fontFamily: t.typography.fontFamily.medium }]}>
                    {highlightedCount
                      ? `${highlightedCount} tasks need attention. Filter and act fast.`
                      : 'Your board is clear. Review finished work.'}
                  </Text>

                  <View style={styles.heroProgressRow}>
                    <View style={styles.heroProgressTrack}>
                      <View style={[styles.heroProgressFill, { width: `${completionRate}%` }]} />
                    </View>
                    <Text style={[styles.heroProgressText, { fontFamily: t.typography.fontFamily.bold }]}>{completionRate}% complete</Text>
                  </View>
                </View>

                <Animated.View style={[styles.heroVisual, { transform: [{ translateY: driftY }] }]}>
                  <View style={styles.heroVisualCard}>
                    <View style={styles.heroVisualHeader}>
                      <View style={styles.heroVisualIcon}>
                        <Feather name="activity" size={18} color="#FFFFFF" />
                      </View>
                      <View style={styles.heroVisualCopy}>
                        <Text style={[styles.heroVisualTitle, { fontFamily: t.typography.fontFamily.bold }]}>Execution lane</Text>
                        <Text style={[styles.heroVisualBody, { fontFamily: t.typography.fontFamily.medium }]}>Review, prioritize, close.</Text>
                      </View>
                    </View>
                    <View style={styles.heroRoute}>
                      <View style={styles.heroRouteLine} />
                      <Animated.View style={[styles.heroRouteDot, { opacity: pulseOpacity, transform: [{ translateY: driftY }, { scale: pulseScale }] }]} />
                      <View style={[styles.heroNode, styles.heroNodeOne]} />
                      <View style={[styles.heroNode, styles.heroNodeTwo]} />
                      <View style={[styles.heroNode, styles.heroNodeThree]} />
                    </View>
                    <View style={styles.heroVisualFooter}>
                      <Text style={[styles.heroVisualFooterText, { fontFamily: t.typography.fontFamily.bold }]}>{stats.total} tasks in workspace</Text>
                    </View>
                  </View>
                </Animated.View>
              </View>

              <View style={styles.heroStatsRow}>
                {heroStats.map((x) => (
                  <View key={x.label} style={styles.heroStatCard}>
                    <View style={[styles.heroStatIcon, { backgroundColor: x.bg }]}>
                      <Feather name={x.icon} size={15} color={x.tone} />
                    </View>
                    <Text style={[styles.heroStatValue, { color: x.tone, fontFamily: t.typography.fontFamily.bold }]}>{x.value}</Text>
                    <Text style={[styles.heroStatLabel, { fontFamily: t.typography.fontFamily.medium }]}>{x.label}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>

            <Animated.View style={[styles.controlsCard, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
              <View style={styles.searchWrap}>
                <Feather name="search" size={18} color="#6E79A0" />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Search tasks, deadlines, or notes..."
                  placeholderTextColor="#7B86A7"
                  style={[styles.searchInput, { color: '#111827', fontFamily: t.typography.fontFamily.medium }]}
                />
              </View>

              <View style={styles.filterRow}>
                {statusList.map((s) => {
                  const active = s === statusFilter;
                  return (
                    <Pressable key={s} onPress={() => setStatusFilter(s)} style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && styles.pressed]}>
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive, { fontFamily: t.typography.fontFamily.bold }]}>{s}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="o"
            title={loading ? 'Loading tasks...' : 'No tasks found'}
            message={loading ? 'Please wait' : 'No assigned tasks match your filters right now.'}
          />
        }
        renderItem={({ item, index }) => {
          const tone = statusTone(item?.status);
          const overdue = isOverdue(item);
          const taskStatus = normalizeStatus(item?.status);
          const cardY = listEntrance.interpolate({ inputRange: [0, 1], outputRange: [22 + Math.min(index, 4) * 8, 0] });
          const metaTone = overdue ? styles.metaBoxWarm : styles.metaBoxCool;

          return (
            <Animated.View style={{ opacity: listEntrance, transform: [{ translateY: cardY }] }}>
              <Pressable
                style={({ pressed }) => [styles.taskCard, pressed && styles.pressed]}
                onPress={() => navigation.navigate('TaskDetails', { taskId: String(item?._id || item?.id), task: item })}
              >
                <LinearGradient colors={['rgba(26, 102, 184, 0.07)', 'rgba(109, 193, 255, 0.015)']} style={styles.taskTint} />
                <Animated.View pointerEvents="none" style={[styles.taskSweep, { transform: [{ translateX: sweepX }, { rotate: '18deg' }] }]} />

                <View style={styles.taskHead}>
                  <View style={styles.taskHeadLeft}>
                    <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 1 }} style={styles.taskIconWrap}>
                      <Feather name={taskStatus === 'Completed' ? 'check' : overdue ? 'alert-triangle' : 'check-square'} size={17} color="#FFFFFF" />
                    </LinearGradient>
                    <View style={styles.taskContent}>
                      <View style={styles.taskTitleRow}>
                        <Text style={[styles.taskTitle, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                          {item?.title || 'Task'}
                        </Text>
                        {overdue ? (
                          <View style={styles.inlineAlert}>
                            <Feather name="alert-circle" size={12} color="#D56714" />
                            <Text style={[styles.inlineAlertText, { fontFamily: t.typography.fontFamily.bold }]}>Needs action</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.taskDesc, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={2}>
                        {item?.description || 'No description provided.'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.statusText, { color: tone.text, fontFamily: t.typography.fontFamily.bold }]}>{taskStatus}</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <View style={[styles.metaBox, metaTone]}>
                    <Feather name="calendar" size={14} color={overdue ? '#D56714' : '#2875CB'} />
                    <Text style={[styles.metaText, { fontFamily: t.typography.fontFamily.medium }]}>{`Due ${niceDate(item?.dueDate)}`}</Text>
                  </View>
                  <View style={[styles.metaBox, styles.metaBoxLavender]}>
                    <Feather name="clock" size={14} color="#7D3FC6" />
                    <Text style={[styles.metaText, { fontFamily: t.typography.fontFamily.medium }]}>{`Assigned ${niceDate(item?.createdAt)}`}</Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.cardFooterChip}>
                    <Feather name="arrow-up-right" size={13} color="#1A67B6" />
                    <Text style={[styles.cardFooterText, { fontFamily: t.typography.fontFamily.bold }]}>Open task</Text>
                  </View>
                  <View style={styles.cardFooterSignal}>
                    <Animated.View style={[styles.cardFooterDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                    <Text style={[styles.cardFooterSignalText, { fontFamily: t.typography.fontFamily.medium }]}>
                      {taskStatus === 'Completed' ? 'Archived flow' : overdue ? 'Deadline risk' : 'On track'}
                    </Text>
                  </View>
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
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 130 },
  headerWrap: { marginBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
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
  backBtnHidden: { opacity: 0 },
  pressed: { opacity: 0.92 },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: '#7485A8',
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 2.1,
    fontWeight: '900',
  },
  heading: { marginTop: 3, fontSize: 20, lineHeight: 24, fontWeight: '900' },
  sub: { marginTop: 4, fontWeight: '700', fontSize: 10, lineHeight: 15 },
  headerChip: {
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
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1FCB7A',
  },
  headerChipText: { color: '#1B4B98', fontSize: 11, lineHeight: 14, fontWeight: '800' },
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
    backgroundColor: 'rgba(89, 210, 209, 0.12)',
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
    color: '#1968B7',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroStatusChip: {
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
  heroStatusText: { color: '#118D4C', fontSize: 10, lineHeight: 13, fontWeight: '800' },
  heroMain: { marginTop: 16, flexDirection: 'row', gap: 14 },
  heroMainCompact: { gap: 10 },
  heroCopyBlock: { flex: 1 },
  heroTitle: { color: '#153375', fontSize: 22, lineHeight: 27, fontWeight: '900', maxWidth: 228 },
  heroBody: { marginTop: 8, color: '#5D7096', fontSize: 11, lineHeight: 16, fontWeight: '700', maxWidth: 236 },
  heroProgressRow: { marginTop: 14, gap: 8 },
  heroProgressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E6EEF9',
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#1D5FD2',
  },
  heroProgressText: { color: '#1A4D9C', fontSize: 10, lineHeight: 12, fontWeight: '800' },
  heroVisual: {
    width: 154,
    alignItems: 'stretch',
  },
  heroVisualCard: {
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
  },
  heroVisualHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroVisualIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#1D5FD2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroVisualCopy: { flex: 1 },
  heroVisualTitle: { color: '#173271', fontSize: 13, lineHeight: 16, fontWeight: '900' },
  heroVisualBody: { marginTop: 3, color: '#697CA5', fontSize: 9, lineHeight: 12, fontWeight: '700' },
  heroRoute: {
    marginTop: 14,
    height: 72,
    justifyContent: 'center',
  },
  heroRouteLine: {
    position: 'absolute',
    left: 20,
    right: 14,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#D9E4F6',
  },
  heroRouteDot: {
    position: 'absolute',
    left: 46,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1FCB7A',
    borderWidth: 3,
    borderColor: '#E8FFF4',
  },
  heroNode: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#C8D8F1',
  },
  heroNodeOne: { left: 16 },
  heroNodeTwo: { left: '48%' },
  heroNodeThree: { right: 12 },
  heroVisualFooter: {
    marginTop: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F2F7FF',
    alignSelf: 'flex-start',
  },
  heroVisualFooterText: { color: '#1A4E9D', fontSize: 9, lineHeight: 11, fontWeight: '800' },
  heroStatsRow: { marginTop: 14, flexDirection: 'row', gap: 9 },
  heroStatCard: {
    flex: 1,
    minHeight: 78,
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
  heroStatValue: { fontSize: 16, lineHeight: 19, fontWeight: '900' },
  heroStatLabel: { color: '#657B9E', fontSize: 9, lineHeight: 11, fontWeight: '700' },
  controlsCard: {
    borderRadius: 20,
    backgroundColor: 'rgba(250,252,255,0.96)',
    borderWidth: 1,
    borderColor: '#D6E0F3',
    padding: 12,
    marginBottom: 10,
  },
  searchWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D4DFF1',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 46,
    marginBottom: 10,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 12, paddingVertical: 10 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C9D8F0',
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  filterChipActive: {
    backgroundColor: '#1D5FD2',
    borderColor: '#1D5FD2',
  },
  filterChipText: { color: '#1D4FAE', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  filterChipTextActive: { color: '#FFFFFF' },
  taskCard: {
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
  taskTint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
  },
  taskSweep: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 82,
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  taskHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  taskHeadLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  taskContent: { flex: 1 },
  taskIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  taskTitle: { flex: 1, color: '#122A74', fontSize: 15, lineHeight: 18, fontWeight: '900' },
  taskDesc: { marginTop: 4, color: '#4E628E', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  inlineAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: '#FFF3E7',
    borderWidth: 1,
    borderColor: '#F2D7B4',
    paddingHorizontal: 8,
    minHeight: 24,
  },
  inlineAlertText: {
    color: '#D56714',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
  },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  statusText: { fontSize: 10, lineHeight: 12, fontWeight: '900' },
  metaRow: { marginTop: 10, flexDirection: 'row', gap: 8 },
  metaBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    minHeight: 34,
  },
  metaBoxCool: { backgroundColor: '#EDF3FD', borderColor: '#D3DEEF' },
  metaBoxWarm: { backgroundColor: '#FFF3E8', borderColor: '#F2D7B4' },
  metaBoxLavender: { backgroundColor: '#F3ECFF', borderColor: '#E4D8FA' },
  metaText: { flex: 1, color: '#334B77', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  cardFooter: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardFooterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#EFF5FF',
    borderWidth: 1,
    borderColor: '#D8E4F5',
  },
  cardFooterText: { color: '#1A67B6', fontSize: 10, lineHeight: 12, fontWeight: '800' },
  cardFooterSignal: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cardFooterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1FCB7A',
  },
  cardFooterSignalText: { color: '#6A7EA6', fontSize: 9, lineHeight: 11, fontWeight: '700' },
});
