import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Pressable, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import ManagedViewBanner from '../../components/managed/ManagedViewBanner';
import { EmptyState, PageDecor } from '../../components/ui';
import { InvoicesService } from '../../api/services';
import { useAuthStore } from '../../context/authStore';
import type { Invoice } from '../../types/models';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InvoicesStackParamList } from '../../navigation/app/AppNavigator';
import { formatDate, money } from '../../utils/format';
import { getManagedCandidateId, getManagedCandidateName, isManagedViewActive } from '../../utils/managedView';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<InvoicesStackParamList, 'InvoicesList'>;

const getStatusTone = (value: string) => {
  const status = value.toLowerCase();
  if (status.includes('paid') || status.includes('complete') || status.includes('settled')) {
    return {
      bg: '#E7F8F0',
      border: '#BEEAD2',
      text: '#118452',
      accent: '#1FCB7A',
    };
  }
  if (status.includes('overdue') || status.includes('late') || status.includes('failed')) {
    return {
      bg: '#FDEBEE',
      border: '#F2C3CB',
      text: '#C33E56',
      accent: '#F06A85',
    };
  }
  return {
    bg: '#FFF4E2',
    border: '#F4D9A3',
    text: '#B06A0E',
    accent: '#F0A53B',
  };
};

export default function InvoicesListScreen({ navigation }: Props) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const managedViewActive = useMemo(() => isManagedViewActive(user), [user]);
  const managedCandidateId = useMemo(() => getManagedCandidateId(user), [user]);
  const managedCandidateName = useMemo(() => getManagedCandidateName(user), [user]);

  const heroEntrance = useRef(new Animated.Value(0)).current;
  const cardsEntrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const receiptDrift = useRef(new Animated.Value(0)).current;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await InvoicesService.list(managedCandidateId ? { managedCandidateId } : undefined);
      setItems(Array.isArray(res) ? res : (res as any)?.invoices || []);
    } catch (e: any) {
      setItems([]);
      setError(e?.userMessage || e?.message || 'Unable to load invoices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [managedCandidateId]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroEntrance, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardsEntrance, {
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
          Animated.timing(pulse, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(float, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(float, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(sweep, { toValue: 1, duration: 2300, delay: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(receiptDrift, { toValue: 1, duration: 2900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(receiptDrift, { toValue: 0, duration: 2900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
    ];

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [cardsEntrance, float, heroEntrance, pulse, receiptDrift, sweep]);

  const dueCount = useMemo(
    () =>
      items.filter((item: any) => {
        const status = String(item?.status || '').toLowerCase();
        return !(status.includes('paid') || status.includes('complete') || status.includes('settled'));
      }).length,
    [items]
  );
  const paidCount = useMemo(
    () =>
      items.filter((item: any) => {
        const status = String(item?.status || '').toLowerCase();
        return status.includes('paid') || status.includes('complete') || status.includes('settled');
      }).length,
    [items]
  );
  const totalAmount = useMemo(
    () => items.reduce((sum, item: any) => sum + (Number(item?.total) || 0), 0),
    [items]
  );

  const heroY = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-180, 280] });
  const receiptY = receiptDrift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const heroVisualWidth = width < 380 ? 124 : 138;
  const stackSummaryCards = width <= 430;
  const summaryMetrics = [
    { key: 'invoices', value: items.length, label: 'Total Invoices', color: '#1667B7', icon: 'file-text' as const, iconBg: '#EAF2FF' },
    { key: 'due', value: dueCount, label: 'Due / Pending', color: '#B06A0E', icon: 'calendar' as const, iconBg: '#FFF4DE' },
    { key: 'paid', value: paidCount, label: 'Paid', color: '#118452', icon: 'check-circle' as const, iconBg: '#EAF8F0' },
  ];

  const summaryCardsNode = (
    <View style={[styles.summaryRow, stackSummaryCards && styles.summaryRowStacked]}>
      {summaryMetrics.map((metric) => (
        <View key={metric.key} style={[styles.summaryCard, stackSummaryCards && styles.summaryCardStacked]}>
          <View style={[styles.summaryIconChip, { backgroundColor: metric.iconBg }]}>
            <Feather name={metric.icon} size={12} color={metric.color} />
          </View>
          <Text style={[styles.summaryValue, { color: metric.color, fontFamily: t.typography.fontFamily.bold }]}>{metric.value}</Text>
          <Text numberOfLines={1} style={[styles.summaryLabel, stackSummaryCards && styles.summaryLabelStacked, { fontFamily: t.typography.fontFamily.medium }]}>
            {metric.label}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <LinearGradient colors={t.colors.gradientBackground as any} style={styles.root}>
      <PageDecor />
      <SafeAreaView style={styles.safe}>
        <FlatList
          contentContainerStyle={styles.content}
          data={items}
          keyExtractor={(it, idx) => (it as any)?._id || (it as any)?.id || (it as any)?.invoiceNumber || String(idx)}
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
            {managedViewActive ? (
              <ManagedViewBanner
                candidateName={managedCandidateName}
                subtitle="Invoices are loaded for the active managed candidate."
              />
            ) : null}
            <Animated.View style={[styles.topBar, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
              <Pressable
                  onPress={() => {
                    if (navigation.canGoBack()) {
                      navigation.goBack();
                      return;
                    }
                    if (navigation.getParent()?.canGoBack()) {
                      navigation.getParent()?.goBack();
                    }
                  }}
                  style={({ pressed }) => [styles.backBtn, !(navigation.canGoBack() || navigation.getParent()?.canGoBack()) && styles.hidden, pressed && styles.pressed]}
                  disabled={!(navigation.canGoBack() || navigation.getParent()?.canGoBack())}
                >
                  <Feather name="arrow-left" size={18} color="#183A88" />
                </Pressable>
                <View style={styles.topCopy}>
                  <Text style={[styles.topEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>Billing desk</Text>
                  <Text style={[styles.heading, { fontFamily: t.typography.fontFamily.bold }]}>Invoices</Text>
                  <Text style={[styles.sub, { fontFamily: t.typography.fontFamily.medium }]}>
                    {managedViewActive ? 'Managed candidate invoices, due dates, and payment status' : 'Due dates, totals, and payment status'}
                  </Text>
                </View>
                <Pressable
                  onPress={async () => {
                    setRefreshing(true);
                    await load();
                    setRefreshing(false);
                  }}
                  style={({ pressed }) => [styles.syncChip, pressed && styles.pressed]}
                >
                  <Animated.View style={[styles.syncDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                  <Text style={[styles.syncText, { fontFamily: t.typography.fontFamily.bold }]}>Refresh</Text>
                </Pressable>
              </Animated.View>

              <Animated.View style={[styles.heroCard, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
                <View style={styles.heroGlowA} />
                <View style={styles.heroGlowB} />
                <Animated.View style={[styles.heroSweep, { transform: [{ translateX: sweepX }, { rotate: '18deg' }] }]} />

                <View style={styles.heroHeaderRow}>
                <View style={styles.heroPill}>
                  <Feather name="credit-card" size={13} color="#14589F" />
                  <Text style={[styles.heroPillText, { fontFamily: t.typography.fontFamily.bold }]}>{managedViewActive ? 'Candidate billing' : 'Payment overview'}</Text>
                </View>
                  <View style={styles.heroSignal}>
                    <View style={styles.heroSignalDot} />
                    <Text style={[styles.heroSignalText, { fontFamily: t.typography.fontFamily.bold }]}>{managedViewActive ? 'Candidate scope' : 'Billing flow'}</Text>
                  </View>
                </View>

                <View style={styles.heroMain}>
                  <View style={styles.heroCopyBlock}>
                    <Text style={[styles.heroTitle, { fontFamily: t.typography.fontFamily.bold }]}>{managedViewActive ? `${managedCandidateName} invoices` : 'Invoice command center'}</Text>
                    <Text style={[styles.heroBody, { fontFamily: t.typography.fontFamily.medium }]}>
                      {managedViewActive
                        ? 'Review invoices created for the active managed candidate, including due dates and proof status.'
                        : 'Check totals, due dates, and paid invoices.'}
                    </Text>

                    {!stackSummaryCards ? summaryCardsNode : null}
                  </View>

                  <Animated.View style={[styles.heroVisual, { width: heroVisualWidth, transform: [{ translateY: floatY }] }]}>
                    <Animated.View style={[styles.receiptBack, { transform: [{ translateY: receiptY }, { rotate: '-5deg' }] }]} />
                    <Animated.View style={[styles.receiptFront, { width: heroVisualWidth - 10, transform: [{ translateY: floatY }] }]}>
                      <View style={styles.receiptTopRow}>
                        <View style={styles.receiptIcon}>
                          <Feather name="file-text" size={18} color="#FFFFFF" />
                        </View>
                        <View style={styles.receiptCopy}>
                          <Text style={[styles.receiptTitle, { fontFamily: t.typography.fontFamily.bold }]}>Ledger sheet</Text>
                          <Text style={[styles.receiptSub, { fontFamily: t.typography.fontFamily.medium }]}>Totals in motion</Text>
                        </View>
                      </View>
                      <View style={styles.receiptBars}>
                        <View style={[styles.receiptBar, styles.receiptBarWide]} />
                        <View style={[styles.receiptBar, styles.receiptBarMid]} />
                        <View style={[styles.receiptBar, styles.receiptBarShort]} />
                      </View>
                      <View style={styles.receiptAmountChip}>
                        <Text style={[styles.receiptAmountValue, { fontFamily: t.typography.fontFamily.bold }]}>{money(totalAmount, items[0]?.currency || 'USD')}</Text>
                      </View>
                    </Animated.View>
                  </Animated.View>
                </View>
                {stackSummaryCards ? summaryCardsNode : null}
              </Animated.View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="o"
              title={loading ? 'Loading...' : managedViewActive ? 'No invoices assigned yet' : 'No invoices'}
              message={
                loading
                  ? 'Please wait'
                  : managedViewActive
                    ? error || 'Invoices created for this managed candidate will appear here.'
                    : error || 'Invoices show up here.'
              }
            />
          }
          renderItem={({ item, index }) => {
            const invoiceId = (item as any)._id || (item as any).id;
            const status = String(item.status || 'Sent');
            const tone = getStatusTone(status);
            const itemY = cardsEntrance.interpolate({
              inputRange: [0, 1],
              outputRange: [18 + Math.min(index, 4) * 8, 0],
            });
            const invoiceLabel = item.invoiceNumber ? `Invoice #${item.invoiceNumber}` : 'Invoice';

            return (
              <Animated.View style={{ opacity: cardsEntrance, transform: [{ translateY: itemY }] }}>
                <View style={styles.invoiceCard}>
                  <LinearGradient colors={['rgba(25, 98, 182, 0.08)', 'rgba(255,255,255,0.02)']} style={styles.invoiceTint} />
                  <View style={styles.invoiceTopRow}>
                    <View style={styles.docIconWrap}>
                      <Feather name="file-text" size={22} color="#FFFFFF" />
                    </View>
                    <View style={styles.invoiceCopy}>
                      <Text style={[styles.invoiceTitle, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                        {invoiceLabel}
                      </Text>
                      <Text style={[styles.invoiceDue, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                        {`Due ${formatDate(item.dueDate) || '-'}`}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                      <View style={[styles.statusDot, { backgroundColor: tone.accent }]} />
                      <Text style={[styles.statusText, { color: tone.text, fontFamily: t.typography.fontFamily.bold }]}>{status}</Text>
                    </View>
                  </View>

                  <View style={styles.amountRow}>
                    <Text style={[styles.amountLabel, { fontFamily: t.typography.fontFamily.medium }]}>Total</Text>
                    <Text style={[styles.amount, { fontFamily: t.typography.fontFamily.bold }]}>{money(item.total, item.currency || 'USD')}</Text>
                  </View>

                  <View style={styles.metaRow}>
                    <View style={[styles.metaChip, styles.metaChipBlue]}>
                      <Feather name="calendar" size={14} color="#176CC0" />
                      <Text style={[styles.metaText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                        {formatDate(item.dueDate) || '-'}
                      </Text>
                    </View>
                    <View style={[styles.metaChip, styles.metaChipMint]}>
                      <Feather name="credit-card" size={14} color="#11856E" />
                      <Text style={[styles.metaText, styles.metaTextMint, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                        {item.currency || 'USD'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <Pressable onPress={() => navigation.navigate('InvoiceDetails', { invoiceId, invoice: item })} style={({ pressed }) => [styles.openAction, pressed && styles.pressed]}>
                    <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.openBtn}>
                      <Animated.View pointerEvents="none" style={[styles.openBtnSweep, { transform: [{ translateX: sweepX }, { rotate: '16deg' }] }]} />
                      <View style={styles.openBtnIcon}>
                        <Feather name="arrow-up-right" size={16} color="#FFFFFF" />
                      </View>
                      <View style={styles.openBtnCopy}>
                        <Text style={[styles.openBtnTitle, { fontFamily: t.typography.fontFamily.bold }]}>Open invoice</Text>
                        <Text style={[styles.openBtnText, { fontFamily: t.typography.fontFamily.medium }]}>View full breakdown</Text>
                      </View>
                    </LinearGradient>
                  </Pressable>
                </View>
              </Animated.View>
            );
          }}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 130,
  },
  headerWrap: {
    marginTop: 24,
    marginBottom: 14,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#D2DFF5',
  },
  hidden: { opacity: 0 },
  pressed: { opacity: 0.88 },
  topCopy: { flex: 1 },
  topEyebrow: {
    color: '#6A7F99',
    fontSize: 10,
    lineHeight: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    fontWeight: '800',
  },
  heading: {
    marginTop: 3,
    color: '#1A347F',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
  },
  sub: {
    marginTop: 2,
    color: '#516683',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  syncChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#F8FBFF',
    borderWidth: 1,
    borderColor: '#D4E1F4',
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1FCA7B',
  },
  syncText: {
    color: '#16529A',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  heroCard: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#CCDCEF',
    backgroundColor: '#F9FBFE',
    overflow: 'hidden',
  },
  heroGlowA: {
    position: 'absolute',
    top: -72,
    right: -22,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(33, 110, 200, 0.1)',
  },
  heroGlowB: {
    position: 'absolute',
    bottom: -26,
    left: -10,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(240, 165, 59, 0.08)',
  },
  heroSweep: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 90,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5E1F3',
  },
  heroPillText: {
    color: '#14589F',
    fontSize: 10,
    lineHeight: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '800',
  },
  heroSignal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5E1F3',
  },
  heroSignalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F0A53B',
  },
  heroSignalText: {
    color: '#8B5A15',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  heroMain: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  heroCopyBlock: {
    flex: 1,
  },
  heroTitle: {
    color: '#19367C',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
  },
  heroBody: {
    marginTop: 6,
    color: '#5B6C86',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 6,
    marginTop: 12,
  },
  summaryRowStacked: {
    gap: 8,
  },
  summaryCard: {
    minHeight: 60,
    width: 50,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1E0F2',
    justifyContent: 'center',
  },
  summaryCardStacked: {
    flex: 1,
    width: undefined,
    minWidth: 0,
    minHeight: 68,
    paddingHorizontal: 12,
  },
  summaryIconChip: {
    width: 24,
    height: 24,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '900',
  },
  summaryLabel: {
    marginTop: 3,
    color: '#667D98',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
  },
  summaryLabelStacked: {
    fontSize: 11,
    lineHeight: 13,
  },
  heroVisual: {
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  receiptBack: {
    position: 'absolute',
    width: 118,
    height: 150,
    borderRadius: 24,
    backgroundColor: '#EAF1FA',
    borderWidth: 1,
    borderColor: '#D3DFF2',
  },
  receiptFront: {
    borderRadius: 24,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1E0F2',
  },
  receiptTopRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  receiptIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#1765BA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  receiptTitle: {
    color: '#143172',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
    flexShrink: 1,
  },
  receiptSub: {
    marginTop: 3,
    color: '#6B7D98',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
  receiptBars: {
    marginTop: 12,
    gap: 6,
  },
  receiptBar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E5EDF8',
  },
  receiptBarWide: { width: '86%' },
  receiptBarMid: { width: '96%', backgroundColor: '#D1E3F9' },
  receiptBarShort: { width: '68%' },
  receiptAmountChip: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: '#F4F8FF',
    borderWidth: 1,
    borderColor: '#D7E3F4',
  },
  receiptAmountValue: {
    color: '#1768B8',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  invoiceCard: {
    marginBottom: 12,
    borderRadius: 24,
    padding: 14,
    backgroundColor: 'rgba(249,251,254,0.92)',
    borderWidth: 1,
    borderColor: '#D2DDEC',
    overflow: 'hidden',
  },
  invoiceTint: {
    ...StyleSheet.absoluteFillObject,
  },
  invoiceTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  docIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#1968BC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceCopy: {
    flex: 1,
  },
  invoiceTitle: {
    color: '#1A2238',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  invoiceDue: {
    marginTop: 4,
    color: '#546987',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 32,
    borderWidth: 1,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  amountRow: {
    marginTop: 12,
  },
  amountLabel: {
    color: '#7A8AA0',
    fontSize: 10,
    lineHeight: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  amount: {
    marginTop: 4,
    color: '#1667B7',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  metaChip: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaChipBlue: {
    backgroundColor: '#EEF5FF',
    borderColor: '#D7E6F8',
  },
  metaChipMint: {
    backgroundColor: '#EAF9F6',
    borderColor: '#D1EEE7',
  },
  metaText: {
    marginLeft: 6,
    flex: 1,
    color: '#24528F',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  metaTextMint: {
    color: '#14816E',
  },
  divider: {
    marginTop: 12,
    height: 1,
    backgroundColor: '#D8E2F2',
  },
  openAction: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  openBtn: {
    minHeight: 54,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  openBtnSweep: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 70,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  openBtnIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  openBtnCopy: {
    flex: 1,
  },
  openBtnTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  openBtnText: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
  },
});
