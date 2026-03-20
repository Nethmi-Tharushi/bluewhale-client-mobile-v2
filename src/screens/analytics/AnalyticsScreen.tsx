import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AnalyticsService } from '../../api/services';
import { EmptyState, Screen } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';
import type { AgentAnalyticsCategoryBreakdown, AgentAnalyticsDashboard, AgentAnalyticsTrendPoint } from '../../types/models';

const AUTO_REFRESH_MS = 5 * 60 * 1000;

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
const formatPercent = (value: number, decimals = 1) => `${(Number.isFinite(value) ? value : 0).toFixed(decimals)}%`;
const formatCompactNumber = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1000) {
    try { return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value); } catch {}
  }
  return String(Math.round(value * 10) / 10).replace(/\.0$/, '');
};
const formatTimestamp = (value?: string) => {
  if (!value) return 'Waiting for analytics sync';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(date);
  } catch {
    return date.toLocaleString();
  }
};
const formatGrowthLabel = (value?: number | null) => {
  if (!Number.isFinite(Number(value))) return 'No monthly comparison yet';
  const normalized = Number(value);
  if (normalized === 0) return 'Flat vs last month';
  return `${normalized > 0 ? '+' : ''}${normalized.toFixed(1).replace(/\.0$/, '')}% vs last month`;
};
const getGrowthTone = (value?: number | null) => {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized === 0) return { text: '#64748B', icon: 'minus' as const };
  return normalized > 0 ? { text: '#169455', icon: 'trending-up' as const } : { text: '#D93856', icon: 'trending-down' as const };
};
const normalizeTrendLabel = (point: AgentAnalyticsTrendPoint, index: number) => pickString(point, ['month', 'label', 'period'], `Month ${index + 1}`);
const normalizeTrendPoints = (value: any): AgentAnalyticsTrendPoint[] => (Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []);
const normalizeCategories = (value: any): AgentAnalyticsCategoryBreakdown[] => (Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []);

const openExportFile = async (fileUri: string, mimeType: string) => {
  try {
    if (Platform.OS === 'android' && typeof (FileSystem as any).getContentUriAsync === 'function') {
      const contentUri = await (FileSystem as any).getContentUriAsync(fileUri);
      try {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: mimeType,
        });
        return true;
      } catch {
        // Fall through to Linking below.
      }
    }
    await Linking.openURL(fileUri);
    return true;
  } catch {
    return false;
  }
};

function HeaderButton({ icon, label, primary, onPress, disabled }: { icon: keyof typeof Feather.glyphMap; label: string; primary?: boolean; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.headerButton, primary ? styles.headerButtonPrimary : styles.headerButtonSecondary, pressed && !disabled && styles.pressed, disabled && styles.disabled]}><Feather name={icon} size={16} color={primary ? '#FFFFFF' : '#1768B8'} /><Text style={[styles.headerButtonText, primary ? styles.headerButtonTextPrimary : styles.headerButtonTextSecondary]}>{label}</Text></Pressable>;
}
function LegendItem({ color, label }: { color: string; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>;
}
type DistributionSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
  softColor: string;
  textColor: string;
};
function DistributionBreakdownRow({ label, value, total, color, softColor, textColor }: { label: string; value: number; total: number; color: string; softColor: string; textColor: string }) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return (
    <View style={[styles.distributionBreakdownRow, { backgroundColor: softColor, borderColor: `${color}24` }]}>
      <View style={styles.distributionBreakdownCopy}>
        <View style={[styles.distributionBreakdownDot, { backgroundColor: color }]} />
        <Text style={[styles.distributionBreakdownLabel, { color: textColor }]} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.distributionBreakdownValue, { color: textColor }]} numberOfLines={1}>{`${formatCompactNumber(value)} (${formatPercent(percentage)})`}</Text>
    </View>
  );
}
function CircleDistributionChart({ segments, total, size = 190 }: { segments: DistributionSlice[]; total: number; size?: number }) {
  const dotCount = 72;
  const dotSize = size >= 180 ? 8 : 7;
  const center = size / 2;
  const radius = center - dotSize - 8;
  const innerSize = Math.max(92, size * 0.56);
  const activeSegments = segments.filter((item) => item.value > 0);
  const dots = Array.from({ length: dotCount }, (_, index) => {
    const angle = (index / dotCount) * Math.PI * 2 - Math.PI / 2;
    const left = center + Math.cos(angle) * radius - dotSize / 2;
    const top = center + Math.sin(angle) * radius - dotSize / 2;
    let color = '#D9E4F1';
    if (total > 0 && activeSegments.length) {
      const point = ((index + 0.5) / dotCount) * total;
      let running = 0;
      for (const item of activeSegments) {
        running += item.value;
        if (point <= running) {
          color = item.color;
          break;
        }
      }
    }
    return { left, top, color };
  });

  return (
    <View style={[styles.circularDistributionWrap, { width: size, height: size }]}>
      {dots.map((dot, index) => (
        <View
          key={`distribution-dot-${index}`}
          style={[
            styles.circularDistributionDot,
            { width: dotSize, height: dotSize, borderRadius: dotSize / 2, left: dot.left, top: dot.top, backgroundColor: dot.color },
          ]}
        />
      ))}
      <View style={[styles.circularDistributionCenter, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
        <Text style={styles.circularDistributionEyebrow}>Total</Text>
        <Text style={styles.circularDistributionValue}>{formatCompactNumber(total)}</Text>
        <Text style={styles.circularDistributionCaption}>Applications</Text>
      </View>
    </View>
  );
}
function MetricCard({ icon, value, label, growth, iconBg, iconColor, accent, cardTint }: { icon: keyof typeof Feather.glyphMap; value: string; label: string; growth?: number; iconBg: string; iconColor: string; accent: string; cardTint: string }) {
  const tone = getGrowthTone(growth);
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
          <View style={[styles.metricBadge, { backgroundColor: `${accent}12`, borderColor: `${accent}22` }]}><View style={[styles.metricBadgeDot, { backgroundColor: accent }]} /><Text style={[styles.metricBadgeText, { color: accent }]}>Live KPI</Text></View>
        </View>
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={[styles.metricGrowthPill, { backgroundColor: `${tone.text}12`, borderColor: `${tone.text}22` }]}>
        <Feather name={tone.icon} size={12} color={tone.text} />
        <Text style={[styles.metricGrowthText, { color: tone.text }]} numberOfLines={1}>{formatGrowthLabel(growth)}</Text>
      </View>
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
function SimpleLineChart({ labels, series, height = 196 }: { labels: string[]; series: Array<{ label: string; color: string; values: number[] }>; height?: number }) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const padX = 18;
  const padTop = 16;
  const padBottom = 30;
  const plotHeight = height - padTop - padBottom;
  const maxValue = Math.max(1, ...series.flatMap((item) => item.values).map((value) => Number(value) || 0));
  const pointCount = Math.max(labels.length, ...series.map((item) => item.values.length), 1);
  const plotWidth = Math.max(width - padX * 2, 1);
  const stepX = pointCount > 1 ? plotWidth / (pointCount - 1) : 0;
  const pointAt = (index: number, value: number) => ({ x: padX + (pointCount > 1 ? index * stepX : plotWidth / 2), y: padTop + plotHeight - clamp((value / maxValue) * plotHeight, 0, plotHeight) });
  const selectedMeta = width > 0 && activeIndex != null ? {
    label: labels[activeIndex] || '',
    anchorX: pointAt(activeIndex, 0).x,
    anchorY: Math.min(...series.map((item) => pointAt(activeIndex, Number(item.values[activeIndex]) || 0).y)),
    items: series.map((item) => ({ label: item.label, color: item.color, value: Number(item.values[activeIndex]) || 0 })),
  } : null;
  const tooltipLeft = selectedMeta ? clamp(selectedMeta.anchorX - 84, 12, Math.max(12, width - 180)) : 0;
  const tooltipTop = selectedMeta ? Math.max(12, selectedMeta.anchorY - 118) : 0;
  return (
    <View>
      <View style={[styles.chartFrame, { height }]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {Array.from({ length: 4 }).map((_, index) => <View key={index} style={[styles.chartGridLine, { top: padTop + (plotHeight / 3) * index }]} />)}
        {width > 0 ? series.map((item) => item.values.map((value, index) => {
          const point = pointAt(index, Number(value) || 0);
          const nextValue = item.values[index + 1];
          const nextPoint = nextValue == null ? null : pointAt(index + 1, Number(nextValue) || 0);
          const isActive = activeIndex === index;
          return <React.Fragment key={`${item.label}-${index}`}>
            {nextPoint ? <View style={[styles.chartLine, { width: Math.sqrt((nextPoint.x - point.x) ** 2 + (nextPoint.y - point.y) ** 2), backgroundColor: item.color, left: (point.x + nextPoint.x) / 2 - Math.sqrt((nextPoint.x - point.x) ** 2 + (nextPoint.y - point.y) ** 2) / 2, top: (point.y + nextPoint.y) / 2 - 1, transform: [{ rotateZ: `${Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x)}rad` }] }]} /> : null}
            <View style={[styles.chartPointGlow, isActive && styles.chartPointGlowActive, { left: point.x - 6, top: point.y - 6, backgroundColor: item.color }]}><View style={styles.chartPointCore} /></View>
          </React.Fragment>;
        })) : null}
        {width > 0 ? labels.map((label, index) => {
          const left = padX + (pointCount > 1 ? index * stepX : plotWidth / 2);
          const zoneWidth = pointCount > 1 ? Math.max(34, plotWidth / pointCount) : Math.max(48, plotWidth);
          return <Pressable key={`${label}-hit-${index}`} onPress={() => setActiveIndex(index)} style={[styles.chartHitZone, { left: left - zoneWidth / 2, width: zoneWidth, top: padTop, bottom: padBottom }]} />;
        }) : null}
        {selectedMeta ? <View style={[styles.chartTooltipCard, { left: tooltipLeft, top: tooltipTop }]}><Text style={styles.chartTooltipTitle}>{selectedMeta.label}</Text>{selectedMeta.items.map((item) => <Text key={item.label} style={[styles.chartTooltipValue, { color: item.color }]}>{`${item.label}: ${formatCompactNumber(item.value)}`}</Text>)}</View> : null}
      </View>
      <View style={styles.chartLabelsRow}>{labels.map((label, index) => <Text key={`${label}-${index}`} style={[styles.chartLabel, index === 0 ? styles.chartLabelStart : index === labels.length - 1 ? styles.chartLabelEnd : styles.chartLabelCenter]} numberOfLines={1}>{label}</Text>)}</View>
      <View style={styles.legendRow}>{series.map((item) => <LegendItem key={item.label} color={item.color} label={item.label} />)}</View>
    </View>
  );
}
export default function AnalyticsScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const [analytics, setAnalytics] = useState<AgentAnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportAnchor, setExportAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const exportButtonRef = useRef<View | null>(null);
  const entrance = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setErrorMessage(null);
    try {
      const result = await AnalyticsService.getDashboard();
      setAnalytics(result || null);
    } catch (error: any) {
      setErrorMessage(error?.userMessage || error?.message || 'Unable to load analytics right now.');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 560, useNativeDriver: true }).start();
    const floatLoop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 2600, useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 2600, useNativeDriver: true }),
    ]));
    const sweepLoop = Animated.loop(Animated.sequence([
      Animated.timing(sweep, { toValue: 1, duration: 2400, useNativeDriver: true }),
      Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay(550),
    ]));
    floatLoop.start();
    sweepLoop.start();
    return () => {
      floatLoop.stop();
      sweepLoop.stop();
    };
  }, [entrance, float, sweep]);

  useEffect(() => {
    const id = setInterval(() => load({ silent: true }), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load({ silent: true });
    setRefreshing(false);
  }, [load]);

  const toggleExportMenu = useCallback(() => {
    if (exportMenuOpen) {
      setExportMenuOpen(false);
      return;
    }
    const node = exportButtonRef.current as any;
    if (node && typeof node.measureInWindow === 'function') {
      node.measureInWindow((x: number, y: number, buttonWidth: number, buttonHeight: number) => {
        setExportAnchor({ x, y, width: buttonWidth, height: buttonHeight });
        setExportMenuOpen(true);
      });
      return;
    }
    setExportMenuOpen(true);
  }, [exportMenuOpen]);

  const handleExport = useCallback(async (format: 'json' | 'csv') => {
    setExportMenuOpen(false);
    setExporting(true);
    try {
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setMonth(startDate.getMonth() - 6);
      const payload = await AnalyticsService.exportData({ startDate: startDate.toISOString(), endDate: endDate.toISOString(), months: 6, format });
      const exportsDir = `${(FileSystem.documentDirectory || FileSystem.cacheDirectory || '')}analytics-exports`;
      await FileSystem.makeDirectoryAsync(exportsDir, { intermediates: true }).catch(() => undefined);
      const stamp = endDate.toISOString().replace(/[.:]/g, '-');
      const extension = format === 'csv' ? 'csv' : 'json';
      const filePath = `${exportsDir}/analytics_export_${stamp}.${extension}`;
      const content = format === 'csv' ? String(payload || '') : JSON.stringify(payload, null, 2);
      const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
      await FileSystem.writeAsStringAsync(filePath, content);
      const opened = await openExportFile(filePath, mimeType);
      if (!opened) {
        Alert.alert('Export saved', `Saved ${format.toUpperCase()} export. Open it from your Files or Downloads app.`);
      }
    } catch (error: any) {
      Alert.alert('Export failed', error?.userMessage || error?.message || 'Unable to export analytics right now.');
    } finally {
      setExporting(false);
    }
  }, []);

  const currentMetrics = analytics?.currentMetrics || {};
  const candidateMetrics = currentMetrics?.candidateMetrics || {};
  const applicationMetrics = currentMetrics?.applicationMetrics || {};
  const performanceMetrics = currentMetrics?.performanceMetrics || {};
  const growth = analytics?.performanceComparison?.growth || {};
  const trends = useMemo(() => normalizeTrendPoints(analytics?.monthlyTrends).slice(-6), [analytics]);
  const categories = useMemo(() => normalizeCategories(analytics?.jobCategoryBreakdown), [analytics]);

  const statCards = useMemo(() => [
    { key: 'candidates', icon: 'users' as const, value: formatCompactNumber(pickNumber(candidateMetrics, ['totalManaged'], 0)), label: 'Total Candidates', growth: pickNumber(growth, ['candidates'], 0), iconBg: '#DCEAFF', iconColor: '#2166D5', accent: '#2166D5', cardTint: '#F7FBFF' },
    { key: 'applications', icon: 'file-text' as const, value: formatCompactNumber(pickNumber(applicationMetrics, ['totalApplications'], 0)), label: 'Total Applications', growth: pickNumber(growth, ['applications'], 0), iconBg: '#EFE3FF', iconColor: '#8932F6', accent: '#8932F6', cardTint: '#FBF7FF' },
    { key: 'placements', icon: 'check-circle' as const, value: formatCompactNumber(pickNumber(candidateMetrics, ['successfulPlacements'], 0)), label: 'Successful Placements', growth: pickNumber(growth, ['placements'], 0), iconBg: '#DCF8E6', iconColor: '#11A755', accent: '#11A755', cardTint: '#F6FFF9' },
    { key: 'success-rate', icon: 'trending-up' as const, value: formatPercent(pickNumber(performanceMetrics, ['placementSuccessRate'], 0)), label: 'Success Rate', growth: pickNumber(growth, ['successRate', 'placements'], 0), iconBg: '#FFE8C8', iconColor: '#FF7A1B', accent: '#FF7A1B', cardTint: '#FFF9F3' },
  ], [applicationMetrics, candidateMetrics, growth, performanceMetrics]);

  const approvedApplications = pickNumber(applicationMetrics, ['approvedApplications'], 0);
  const pendingApplications = pickNumber(applicationMetrics, ['pendingApplications'], 0);
  const rejectedApplications = pickNumber(applicationMetrics, ['rejectedApplications'], 0);
  const totalStatuses = approvedApplications + pendingApplications + rejectedApplications;
  const distributionItems = useMemo<DistributionSlice[]>(() => [
    { key: 'approved', label: 'Approved', value: approvedApplications, color: '#1DBD86', softColor: '#E8FBF4', textColor: '#118A61' },
    { key: 'pending', label: 'Pending', value: pendingApplications, color: '#F59E0B', softColor: '#FFF7DE', textColor: '#B56A00' },
    { key: 'rejected', label: 'Rejected', value: rejectedApplications, color: '#EF4444', softColor: '#FFF1F2', textColor: '#D92D41' },
  ], [approvedApplications, pendingApplications, rejectedApplications]);
  const trendLabels = useMemo(() => trends.map((item, index) => normalizeTrendLabel(item, index)), [trends]);
  const trendSeries = useMemo(() => [
    { label: 'Applications', color: '#3478F6', values: trends.map((item) => pickNumber(item, ['applications'], 0)) },
    { label: 'New Candidates', color: '#7C56F4', values: trends.map((item) => pickNumber(item, ['candidates', 'newCandidates'], 0)) },
    { label: 'Placements', color: '#13B67A', values: trends.map((item) => pickNumber(item, ['placements'], 0)) },
  ], [trends]);
  const performanceSeries = useMemo(() => [{ label: 'Placements', color: '#13B67A', values: trends.map((item) => pickNumber(item, ['placements'], 0)) }], [trends]);
  const kpis = useMemo(() => [
    { key: 'placement', label: 'Placement Success Rate', value: formatPercent(pickNumber(performanceMetrics, ['placementSuccessRate'], 0)), tone: '#11A755' },
    { key: 'response', label: 'Response Rate', value: formatPercent(pickNumber(performanceMetrics, ['responseRate'], 85)), tone: '#2E6BF2' },
    { key: 'satisfaction', label: 'Client Satisfaction', value: `${pickNumber(performanceMetrics, ['clientSatisfactionScore'], 4.2).toFixed(1)}/5.0`, tone: '#8A2EF4' },
    { key: 'active', label: 'Active Candidates', value: formatCompactNumber(pickNumber(candidateMetrics, ['activeCandidates', 'totalManaged'], 0)), tone: '#F15A24' },
  ], [candidateMetrics, performanceMetrics]);
  const heroHighlights = useMemo(() => [
    { key: 'apps', value: formatCompactNumber(pickNumber(applicationMetrics, ['totalApplications'], 0)), label: 'Applications' },
    { key: 'placements', value: formatCompactNumber(pickNumber(candidateMetrics, ['successfulPlacements'], 0)), label: 'Placements' },
    { key: 'success', value: formatPercent(pickNumber(performanceMetrics, ['placementSuccessRate'], 0), 0), label: 'Success rate' },
  ], [applicationMetrics, candidateMetrics, performanceMetrics]);

  const maxCategoryValue = Math.max(1, ...categories.map((item) => Math.max(pickNumber(item, ['applications'], 0), pickNumber(item, ['placements'], 0))));
  const splitSections = width >= 920;
  const splitDistribution = width >= 760;
  const topCardWidth = width >= 960 ? '48.5%' : '48.5%';
  const opacity = entrance.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const translateY = entrance.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });
  const orbShift = float.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-170, width >= 640 ? 520 : 320] });
  const getEntranceMotion = (delay: number, distance = 18) => ({
    opacity: entrance.interpolate({ inputRange: [0, delay, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: entrance.interpolate({ inputRange: [0, delay, 1], outputRange: [distance, distance, 0], extrapolate: 'clamp' }) }],
  });
  const handleAnalyticsBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (navigation.getParent()?.canGoBack()) {
      navigation.getParent()?.goBack();
      return;
    }
    navigation.getParent()?.navigate?.('Overview');
    navigation.navigate('Overview');
  }, [navigation]);

  if (!loading && !analytics && errorMessage) {
    return <Screen padded={false}><View style={styles.root}><EmptyState title="Analytics unavailable" message={errorMessage} actionLabel="Retry" onAction={() => load()} /></View></Screen>;
  }

  return (
    <Screen padded={false}>
      <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        <Animated.View style={[styles.heroCard, { opacity, transform: [{ translateY }] }]}>
          <LinearGradient colors={['#F8FCFF', '#EDF7FF', '#F4FFFC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroFill}>
            <Animated.View style={[styles.heroGlowA, { transform: [{ translateY: orbShift }] }]} />
            <View style={styles.heroGlowB} />
            <Animated.View style={[styles.heroSweep, { transform: [{ translateX: sweepX }, { rotate: '18deg' }] }]} />
            <View style={styles.heroTopBar}>
              <View style={styles.heroNavCluster}>
                <Pressable onPress={handleAnalyticsBack} style={({ pressed }) => [styles.heroBackBtn, pressed && styles.pressed]}>
                  <Feather name="arrow-left" size={18} color="#1B3890" />
                </Pressable>
                <View style={styles.heroTopPill}>
                  <Feather name="bar-chart-2" size={14} color="#1768B8" />
                  <Text style={[styles.heroTopPillText, { fontFamily: t.typography.fontFamily.bold }]}>Agent analytics</Text>
                </View>
              </View>
              <View style={styles.heroLiveChip}>
                <View style={styles.liveDot} />
                <Text style={[styles.heroLiveChipText, { fontFamily: t.typography.fontFamily.bold }]}>{loading ? 'Syncing' : 'Live'}</Text>
              </View>
            </View>
            <View style={styles.heroHeaderRow}>
              <View style={styles.heroCopy}>
                <Text style={[styles.heroTitle, { fontFamily: t.typography.fontFamily.bold }]}>Analytics Dashboard</Text>
                <Text style={[styles.heroSubtitle, { fontFamily: t.typography.fontFamily.medium }]}>{`Last updated: ${formatTimestamp(analytics?.lastUpdated)}`}</Text>
                <Text style={[styles.heroHint, { fontFamily: t.typography.fontFamily.medium }]}>Live metrics, category movement, and performance signals arranged for faster daily scanning in a denser dashboard layout.</Text>
                <View style={styles.heroSummaryRow}>
                  <View style={styles.heroSummaryChip}><Feather name="clock" size={13} color="#1768B8" /><Text style={[styles.heroSummaryText, { fontFamily: t.typography.fontFamily.bold }]}>Auto refresh every 5 min</Text></View>
                  <View style={styles.heroSummaryChip}><Feather name="activity" size={13} color="#1768B8" /><Text style={[styles.heroSummaryText, { fontFamily: t.typography.fontFamily.bold }]}>{trendLabels.length ? `${trendLabels.length} trend snapshots` : 'Trend history warming up'}</Text></View>
                  <View style={styles.heroSummaryChip}><Feather name="grid" size={13} color="#1768B8" /><Text style={[styles.heroSummaryText, { fontFamily: t.typography.fontFamily.bold }]}>{categories.length ? `${categories.length} active category groups` : 'Category groups pending'}</Text></View>
                </View>
                <View style={styles.heroHighlightsRow}>{heroHighlights.map((item) => <View key={item.key} style={styles.heroHighlightCard}><Text style={[styles.heroHighlightValue, { fontFamily: t.typography.fontFamily.bold }]}>{item.value}</Text><Text style={[styles.heroHighlightLabel, { fontFamily: t.typography.fontFamily.medium }]}>{item.label}</Text></View>)}</View>
              </View>
              <View style={styles.heroActions}>
                <HeaderButton icon="refresh-cw" label={refreshing ? 'Refreshing...' : 'Refresh'} onPress={handleRefresh} disabled={refreshing || loading} />
                <View ref={exportButtonRef} collapsable={false}>
                  <HeaderButton icon="download" label={exporting ? 'Exporting...' : 'Export'} primary onPress={toggleExportMenu} disabled={exporting} />
                </View>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View style={[styles.metricsRow, getEntranceMotion(0.12)]}>{statCards.map(({ key, ...card }) => <View key={key} style={[styles.metricSlot, { width: topCardWidth }]}><MetricCard {...card} /></View>)}</Animated.View>

        <Animated.View style={[styles.sectionCard, getEntranceMotion(0.22)]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Feather name="pie-chart" size={20} color="#1E68C3" />
              <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Application Status Distribution</Text>
            </View>
            <Text style={[styles.sectionCaption, { fontFamily: t.typography.fontFamily.medium }]}>A quick visual split of approved, pending, and rejected applications from the live dashboard metrics.</Text>
          </View>
          <View style={styles.statusRow}>
            <StatusPill label="Approved" value={approvedApplications} bg="#E8FBF4" border="#B7EDD8" color="#118A61" icon="check-circle" />
            <StatusPill label="Pending" value={pendingApplications} bg="#FFF7DE" border="#F6DE93" color="#B56A00" icon="clock" />
            <StatusPill label="Rejected" value={rejectedApplications} bg="#FFF1F2" border="#F7CAD1" color="#D92D41" icon="x-circle" />
          </View>
          <View style={styles.distributionShell}>
            {totalStatuses > 0 ? (
              <View style={[styles.distributionContent, splitDistribution && styles.distributionContentSplit]}>
                <View style={styles.distributionChartPane}>
                  <Text style={[styles.distributionHeadline, { color: distributionItems[0]?.textColor || '#118A61', fontFamily: t.typography.fontFamily.bold }]}>
                    {`${distributionItems[0]?.label || 'Approved'}: ${formatCompactNumber(distributionItems[0]?.value || 0)} (${formatPercent(totalStatuses > 0 ? ((distributionItems[0]?.value || 0) / totalStatuses) * 100 : 0)})`}
                  </Text>
                  <CircleDistributionChart segments={distributionItems} total={totalStatuses} size={width >= 420 ? 208 : 184} />
                  <View style={styles.distributionLegend}>
                    {distributionItems.filter((item) => item.value > 0).map((item) => (
                      <LegendItem key={item.key} color={item.color} label={item.label} />
                    ))}
                  </View>
                </View>
                <View style={styles.distributionBreakdownList}>
                  {distributionItems.map((item) => (
                    <DistributionBreakdownRow
                      key={item.key}
                      label={item.label}
                      value={item.value}
                      total={totalStatuses}
                      color={item.color}
                      softColor={item.softColor}
                      textColor={item.textColor}
                    />
                  ))}
                </View>
              </View>
            ) : <View style={styles.emptyDistribution}><View style={styles.emptyDistributionIcon}><Feather name="pie-chart" size={34} color="#94A3B8" /></View><Text style={[styles.emptyDistributionTitle, { fontFamily: t.typography.fontFamily.bold }]}>No application data available</Text><Text style={[styles.emptyDistributionText, { fontFamily: t.typography.fontFamily.medium }]}>This section populates from current analytics counts. If totals stay at zero, the backend may still be missing agent-submitted application matches.</Text></View>}
          </View>
        </Animated.View>

        <View style={[styles.twoUpRow, splitSections && styles.twoUpRowSplit]}>
          <Animated.View style={[styles.twoUpCard, splitSections ? styles.twoUpHalf : styles.twoUpFull, getEntranceMotion(0.32)]}><View style={styles.sectionHeader}><View style={styles.sectionTitleRow}><Feather name="activity" size={20} color="#1E68C3" /><Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Monthly Trends</Text></View><Text style={[styles.sectionCaption, { fontFamily: t.typography.fontFamily.medium }]}>Applications, placements, and new candidates across the last six snapshots.</Text></View>{trendLabels.length ? <SimpleLineChart labels={trendLabels} series={trendSeries} /> : <EmptyState title="No trend history yet" message="The backend adds snapshot history as analytics runs over time." />}</Animated.View>
          <Animated.View style={[styles.twoUpCard, splitSections ? styles.twoUpHalf : styles.twoUpFull, getEntranceMotion(0.38)]}><View style={styles.sectionHeader}><View style={styles.sectionTitleRow}><Feather name="trending-up" size={20} color="#1E68C3" /><Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Performance Overview</Text></View><Text style={[styles.sectionCaption, { fontFamily: t.typography.fontFamily.medium }]}>Placement-only trend line based on the same monthly history block.</Text></View>{trendLabels.length ? <SimpleLineChart labels={trendLabels} series={performanceSeries} height={188} /> : <EmptyState title="No performance trend yet" message="Placement history will appear here once analytics snapshots accumulate." />}</Animated.View>
        </View>

        <Animated.View style={[styles.sectionCard, getEntranceMotion(0.48)]}><View style={styles.sectionHeader}><View style={styles.sectionTitleRow}><Feather name="bar-chart" size={20} color="#1E68C3" /><Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Job Categories Performance</Text></View><Text style={[styles.sectionCaption, { fontFamily: t.typography.fontFamily.medium }]}>Applications and placements per category. Backend may fall back to sample categories until real category history exists.</Text></View><View style={styles.categoryChartWrap}>{categories.length ? categories.map((item, index) => { const categoryName = pickString(item, ['category', 'name'], `Category ${index + 1}`); const applications = pickNumber(item, ['applications'], 0); const placements = pickNumber(item, ['placements'], 0); const successRate = pickNumber(item, ['successRate'], 0); return <View key={`${categoryName}-${index}`} style={styles.categoryRowCard}><View style={styles.categoryRowHeader}><Text style={[styles.categoryName, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{categoryName}</Text><Text style={[styles.categoryRate, { fontFamily: t.typography.fontFamily.bold }]}>{formatPercent(successRate)}</Text></View><View style={styles.categoryMetricBlock}><View style={styles.categoryMetricLabelRow}><Text style={[styles.categoryMetricLabel, { fontFamily: t.typography.fontFamily.medium }]}>Applications</Text><Text style={[styles.categoryMetricValue, { fontFamily: t.typography.fontFamily.bold }]}>{formatCompactNumber(applications)}</Text></View><View style={styles.categoryTrack}><View style={[styles.categoryFill, { width: `${(applications / maxCategoryValue) * 100}%`, backgroundColor: '#3B82F6' }]} /></View></View><View style={styles.categoryMetricBlock}><View style={styles.categoryMetricLabelRow}><Text style={[styles.categoryMetricLabel, { fontFamily: t.typography.fontFamily.medium }]}>Placements</Text><Text style={[styles.categoryMetricValue, { fontFamily: t.typography.fontFamily.bold }]}>{formatCompactNumber(placements)}</Text></View><View style={styles.categoryTrack}><View style={[styles.categoryFill, { width: `${(placements / maxCategoryValue) * 100}%`, backgroundColor: '#10B981' }]} /></View></View></View>; }) : <EmptyState title="No category data yet" message="Once analytics receives category history, this chart will populate automatically." />}</View></Animated.View>

        <Animated.View style={[styles.sectionCard, getEntranceMotion(0.58)]}><View style={styles.sectionHeader}><View style={styles.sectionTitleRow}><Feather name="target" size={20} color="#1E68C3" /><Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Key Performance Indicators</Text></View></View><View style={styles.kpiGrid}>{kpis.map((item) => <View key={item.key} style={styles.kpiCard}><Text style={[styles.kpiLabel, { fontFamily: t.typography.fontFamily.medium }]}>{item.label}</Text><Text style={[styles.kpiValue, { color: item.tone, fontFamily: t.typography.fontFamily.bold }]}>{item.value}</Text></View>)}</View></Animated.View>

        <Animated.View style={[styles.sectionCard, styles.tableCard, getEntranceMotion(0.68)]}><View style={styles.sectionHeader}><View style={styles.sectionTitleRow}><Feather name="grid" size={20} color="#1E68C3" /><Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Job Categories Breakdown</Text></View></View><View style={styles.tableHeader}><Text style={[styles.tableHeaderText, styles.tableCategoryCol, { fontFamily: t.typography.fontFamily.bold }]}>Category</Text><Text style={[styles.tableHeaderText, styles.tableValueCol, { fontFamily: t.typography.fontFamily.bold }]}>Applications</Text><Text style={[styles.tableHeaderText, styles.tableValueCol, { fontFamily: t.typography.fontFamily.bold }]}>Placements</Text><Text style={[styles.tableHeaderText, styles.tableRateCol, { fontFamily: t.typography.fontFamily.bold }]}>Success Rate</Text></View>{categories.length ? categories.map((item, index) => { const categoryName = pickString(item, ['category', 'name'], `Category ${index + 1}`); const successRate = pickNumber(item, ['successRate'], 0); return <View key={`${categoryName}-table-${index}`} style={styles.tableRow}><Text style={[styles.tableCategoryCol, styles.tableBodyText, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{categoryName}</Text><Text style={[styles.tableValueCol, styles.tableBodyText, { fontFamily: t.typography.fontFamily.medium }]}>{formatCompactNumber(pickNumber(item, ['applications'], 0))}</Text><Text style={[styles.tableValueCol, styles.tableBodyText, { fontFamily: t.typography.fontFamily.medium }]}>{formatCompactNumber(pickNumber(item, ['placements'], 0))}</Text><View style={styles.tableRateCol}><View style={[styles.rateBadge, successRate > 0 ? styles.rateBadgePositive : styles.rateBadgeMuted]}><Text style={[styles.rateBadgeText, { fontFamily: t.typography.fontFamily.bold }]}>{formatPercent(successRate)}</Text></View></View></View>; }) : <EmptyState title="No category rows yet" message="The category table will fill from analytics breakdown data." />}</Animated.View>
      </ScrollView>
      <Modal visible={exportMenuOpen} transparent animationType="fade" onRequestClose={() => setExportMenuOpen(false)}>
        <View style={styles.exportModalRoot}>
          <Pressable style={styles.exportModalBackdrop} onPress={() => setExportMenuOpen(false)} />
          <View style={[styles.exportMenuCard, exportAnchor ? { top: exportAnchor.y + exportAnchor.height + 8, left: clamp(exportAnchor.x + exportAnchor.width - 196, 12, Math.max(12, width - 208)) } : { top: 118, right: 16 }]}>
            <Pressable onPress={() => handleExport('json')} style={({ pressed }) => [styles.exportMenuItem, pressed && styles.pressed]}>
              <Feather name="file-text" size={16} color="#1E63C8" />
              <Text style={styles.exportMenuText}>Export as JSON</Text>
            </Pressable>
            <View style={styles.exportMenuDivider} />
            <Pressable onPress={() => handleExport('csv')} style={({ pressed }) => [styles.exportMenuItem, pressed && styles.pressed]}>
              <Feather name="download" size={16} color="#1E63C8" />
              <Text style={styles.exportMenuText}>Export as CSV</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      </>
    </Screen>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: '#F3F7FC' },
  content: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 136, gap: 12, backgroundColor: '#F2F6FD' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#D1DEF3' },
  topCopy: { flex: 1 },
  topEyebrow: { color: '#6A7F99', fontSize: 11, lineHeight: 14, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '700' },
  topTitle: { marginTop: 4, color: '#13306F', fontSize: 20, lineHeight: 24, fontWeight: '900', letterSpacing: -0.4 },
  liveChipSolid: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#F5F8FD', borderWidth: 1, borderColor: '#D7E4F7' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C57D' },
  liveChipText: { color: '#194A9A', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  heroCard: { borderRadius: 30, overflow: 'hidden', borderWidth: 1, borderColor: '#D7E3F2', shadowColor: '#0C3C89', shadowOpacity: 0.24, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 9 },
  heroFill: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, position: 'relative', overflow: 'hidden' },
  heroTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  heroNavCluster: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroBackBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: 'rgba(209,222,243,0.92)' },
  heroTopPill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: 'rgba(215,227,242,0.95)' },
  heroTopPillText: { color: '#1768B8', fontSize: 10, lineHeight: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroLiveChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: 'rgba(215,228,247,0.95)' },
  heroLiveChipText: { color: '#194A9A', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  heroGlowA: { position: 'absolute', top: -78, right: -22, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.14)' },
  heroGlowB: { position: 'absolute', bottom: -38, left: -20, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(97, 255, 214, 0.16)' },
  heroSweep: { position: 'absolute', top: -54, bottom: -44, width: 80, backgroundColor: 'rgba(255,255,255,0.46)' },
  heroHeaderRow: { gap: 12 },
  heroCopy: { gap: 6 },
  heroPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E3F2' },
  heroPillText: { color: '#1768B8', fontSize: 10, lineHeight: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroTitle: { color: '#19367C', fontSize: 24, lineHeight: 28, fontWeight: '900', letterSpacing: -0.7 },
  heroSubtitle: { color: '#536987', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  heroHint: { maxWidth: 720, color: '#5D708A', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  heroSummaryRow: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroSummaryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E3F2' },
  heroSummaryText: { color: '#4E6482', fontSize: 10, lineHeight: 12, fontWeight: '800' },
  heroHighlightsRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  heroHighlightCard: { flex: 1, minWidth: 98, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.88)', borderWidth: 1, borderColor: '#DCE7F6' },
  heroHighlightValue: { color: '#19367C', fontSize: 20, lineHeight: 22, fontWeight: '900', letterSpacing: -0.4 },
  heroHighlightLabel: { marginTop: 4, color: '#5B6F89', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  exportModalRoot: { ...StyleSheet.absoluteFillObject },
  exportModalBackdrop: { flex: 1, backgroundColor: 'rgba(13, 24, 44, 0.12)' },
  exportMenuCard: { position: 'absolute', width: 196, borderRadius: 18, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.99)', borderWidth: 1, borderColor: '#DCE6F3', shadowColor: '#415F8F', shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  exportMenuItem: { minHeight: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  exportMenuText: { color: '#243854', fontSize: 14, lineHeight: 18, fontWeight: '800' },
  exportMenuDivider: { height: 1, backgroundColor: '#E7EEF8', marginHorizontal: 10 },
  headerButton: { minHeight: 40, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1 },
  headerButtonPrimary: { backgroundColor: '#1B63C8', borderColor: '#1B63C8' },
  headerButtonSecondary: { backgroundColor: '#FFFFFF', borderColor: '#D7E3F2' },
  headerButtonText: { fontSize: 13, lineHeight: 16, fontWeight: '800' },
  headerButtonTextPrimary: { color: '#FFFFFF' },
  headerButtonTextSecondary: { color: '#1768B8' },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  metricSlot: { minWidth: 0 },
  metricCard: { minHeight: 126, borderRadius: 24, padding: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DEE8F5', shadowColor: '#163B79', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 5, position: 'relative', overflow: 'hidden' },
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
  metricGrowthPill: { marginTop: 10, minHeight: 30, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '100%', borderWidth: 1 },
  metricGrowthText: { fontSize: 11, lineHeight: 14, fontWeight: '800', flexShrink: 1, letterSpacing: -0.1 },
  sectionCard: { borderRadius: 22, padding: 10, backgroundColor: '#FEFFFF', borderWidth: 1, borderColor: '#DEE8F6', shadowColor: '#183A73', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
  sectionHeader: { gap: 6 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { color: '#152B50', fontSize: 18, lineHeight: 22, fontWeight: '900', letterSpacing: -0.3 },
  sectionCaption: { color: '#6B7D98', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  statusRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusPill: { flexGrow: 1, minHeight: 48, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 9, shadowColor: '#173A72', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  statusPillValue: { fontSize: 15, lineHeight: 18, fontWeight: '900' },
  statusPillText: { fontSize: 12, lineHeight: 15, fontWeight: '800', letterSpacing: -0.1 },
  distributionShell: { marginTop: 10, borderRadius: 24, borderWidth: 1, borderColor: '#E3ECF7', backgroundColor: '#F8FBFF', padding: 14 },
  distributionContent: { gap: 14, alignItems: 'center' },
  distributionContentSplit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  distributionChartPane: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  distributionHeadline: { fontSize: 14, lineHeight: 18, fontWeight: '900', textAlign: 'center' },
  circularDistributionWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  circularDistributionDot: { position: 'absolute', shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  circularDistributionCenter: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1EBF7', shadowColor: '#264777', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  circularDistributionEyebrow: { color: '#6F82A0', fontSize: 11, lineHeight: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  circularDistributionValue: { marginTop: 4, color: '#173A72', fontSize: 28, lineHeight: 31, fontWeight: '900', letterSpacing: -0.6 },
  circularDistributionCaption: { marginTop: 3, color: '#657A96', fontSize: 12, lineHeight: 15, fontWeight: '700' },
  distributionBreakdownList: { width: '100%', gap: 10, flex: 1 },
  distributionBreakdownRow: { minHeight: 54, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  distributionBreakdownCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  distributionBreakdownDot: { width: 10, height: 10, borderRadius: 5 },
  distributionBreakdownLabel: { flex: 1, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  distributionBreakdownValue: { fontSize: 13, lineHeight: 16, fontWeight: '900' },
  distributionLegend: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  emptyDistribution: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 10 },
  emptyDistributionIcon: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF4FB' },
  emptyDistributionTitle: { color: '#334155', fontSize: 15, lineHeight: 18, fontWeight: '900', textAlign: 'center' },
  emptyDistributionText: { color: '#70829B', fontSize: 12, lineHeight: 17, fontWeight: '500', textAlign: 'center' },
  twoUpRow: { gap: 12 },
  twoUpRowSplit: { flexDirection: 'row', alignItems: 'stretch' },
  twoUpCard: { borderRadius: 22, padding: 10, backgroundColor: '#FEFFFF', borderWidth: 1, borderColor: '#DEE8F6', shadowColor: '#183A73', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
  twoUpHalf: { width: '48.8%' },
  twoUpFull: { width: '100%' },
  chartFrame: { marginTop: 10, borderRadius: 20, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#E2EBF8', overflow: 'hidden' },
  chartGridLine: { position: 'absolute', left: 16, right: 16, height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: '#E4EBF7' },
  chartLine: { position: 'absolute', height: 2, borderRadius: 999 },
  chartPointGlow: { position: 'absolute', width: 12, height: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  chartPointGlowActive: { transform: [{ scale: 1.5 }], shadowColor: '#305DA8', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  chartPointCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  chartHitZone: { position: 'absolute' },
  chartTooltipCard: { position: 'absolute', minWidth: 150, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 11, backgroundColor: 'rgba(255,255,255,0.99)', borderWidth: 1, borderColor: '#DCE6F3', shadowColor: '#274E8F', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  chartTooltipTitle: { color: '#28364A', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  chartTooltipValue: { marginTop: 5, fontSize: 11, lineHeight: 14, fontWeight: '800' },
  chartLabelsRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  chartLabel: { flex: 1, color: '#62748E', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  chartLabelStart: { textAlign: 'left' },
  chartLabelCenter: { textAlign: 'center' },
  chartLabelEnd: { textAlign: 'right' },
  legendRow: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 9, height: 9, borderRadius: 4.5 },
  legendText: { color: '#465B78', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  categoryChartWrap: { marginTop: 10, gap: 8 },
  categoryRowCard: { borderRadius: 18, padding: 10, backgroundColor: '#F5F9FF', borderWidth: 1, borderColor: '#DCE7F6', gap: 7 },
  categoryRowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  categoryName: { flex: 1, color: '#20334E', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  categoryRate: { color: '#D14B67', fontSize: 13, lineHeight: 16, fontWeight: '900', letterSpacing: -0.1 },
  categoryMetricBlock: { gap: 6 },
  categoryMetricLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  categoryMetricLabel: { color: '#60748F', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  categoryMetricValue: { color: '#28405E', fontSize: 12, lineHeight: 15, fontWeight: '900' },
  categoryTrack: { height: 9, borderRadius: 999, overflow: 'hidden', backgroundColor: '#E8EEF7' },
  categoryFill: { height: '100%', borderRadius: 999 },
  kpiGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpiCard: { width: '48.5%', minHeight: 68, borderRadius: 18, padding: 11, backgroundColor: '#F5F9FF', borderWidth: 1, borderColor: '#DCE7F6', justifyContent: 'space-between' },
  kpiLabel: { color: '#3A4F6B', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  kpiValue: { marginTop: 10, fontSize: 19, lineHeight: 22, fontWeight: '900', letterSpacing: -0.2 },
  tableCard: { paddingBottom: 10 },
  tableHeader: { marginTop: 10, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: '#EAF3FF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9 },
  tableHeaderText: { color: '#61748F', fontSize: 11, lineHeight: 14, fontWeight: '900', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#EDF2F8', backgroundColor: 'rgba(255,255,255,0.88)' },
  tableBodyText: { color: '#24364E', fontSize: 12, lineHeight: 16 },
  tableCategoryCol: { flex: 1.4 },
  tableValueCol: { flex: 0.9 },
  tableRateCol: { flex: 1, alignItems: 'flex-start' },
  rateBadge: { minHeight: 30, minWidth: 62, paddingHorizontal: 11, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  rateBadgePositive: { backgroundColor: '#FFE8EC' },
  rateBadgeMuted: { backgroundColor: '#F1F5F9' },
  rateBadgeText: { color: '#CC344E', fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: -0.1 },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.55 },
});
