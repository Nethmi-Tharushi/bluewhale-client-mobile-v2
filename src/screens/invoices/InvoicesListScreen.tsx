import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '../../components/ui';
import { InvoicesService } from '../../api/services';
import type { Invoice } from '../../types/models';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InvoicesStackParamList } from '../../navigation/app/AppNavigator';
import { formatDate, money } from '../../utils/format';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<InvoicesStackParamList, 'InvoicesList'>;

export default function InvoicesListScreen({ navigation }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await InvoicesService.list();
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
  }, []);

  return (
    <LinearGradient colors={t.colors.gradientBackground as any} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <FlatList
          contentContainerStyle={[styles.content, { paddingTop: Math.max(8, insets.top + 4), paddingBottom: 130 }]}
          data={items}
          keyExtractor={(it, idx) => (it as any)?._id || (it as any)?.id || (it as any)?.invoiceNumber || String(idx)}
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
              <View style={styles.headerTopRow}>
                <Pressable
                  style={styles.backBtn}
                  onPress={() => {
                    if (navigation.canGoBack()) navigation.goBack();
                    else navigation.getParent()?.navigate('Home' as never);
                  }}
                >
                  <Feather name="arrow-left" size={34} color="#1A347F" />
                </Pressable>
                <Text style={[styles.heading, { fontFamily: t.typography.fontFamily.bold }]}>Invoices</Text>
                
              </View>
              <Text style={[styles.sub, { fontFamily: t.typography.fontFamily.medium }]}>Due dates, totals, and payment status</Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="o"
              title={loading ? 'Loading...' : 'No invoices'}
              message={loading ? 'Please wait' : error || 'Your invoices will appear here once created.'}
            />
          }
          renderItem={({ item }) => {
            const invoiceId = (item as any)._id || (item as any).id;
            const status = String(item.status || 'Sent');
            return (
              <View style={styles.outerCard}>
                <View style={styles.innerCard}>
                  <View style={styles.rowTop}>
                    <View style={styles.docIconWrap}>
                      <Feather name="file-text" size={34} color="#5EA1E4" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.invoiceTitle, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                        {item.invoiceNumber ? `Invoice #${item.invoiceNumber}` : 'Invoice'}
                      </Text>
                      <Text style={[styles.invoiceDue, { fontFamily: t.typography.fontFamily.medium }]}>{`Due ${formatDate(item.dueDate) || '-'}`}</Text>
                    </View>
                    <View style={styles.statusPill}>
                      <Text style={[styles.statusText, { fontFamily: t.typography.fontFamily.bold }]}>{status}</Text>
                    </View>
                  </View>

                  <Text style={[styles.amount, { fontFamily: t.typography.fontFamily.bold }]}>{money(item.total, item.currency || 'USD')}</Text>

                  <View style={styles.divider} />

                  <Pressable onPress={() => navigation.navigate('InvoiceDetails', { invoiceId, invoice: item })} style={{ marginTop: 2 }}>
                    <LinearGradient colors={['#1B3890', '#0F79C5']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.openBtn}>
                      <Feather name="send" size={16} color="#FFFFFF" />
                      <Text style={[styles.openBtnText, { fontFamily: t.typography.fontFamily.bold }]}>Open invoice</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
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
  },
  headerWrap: {
    marginBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backBtn: {
    width: 52,
    alignItems: 'flex-start',
  },
  heading: {
    flex: 1,
    color: '#1A347F',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
  },
  bellWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 7,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#FF8085',
  },
  sub: {
    color: '#475A83',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  outerCard: {
    marginBottom: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D8E3F7',
    borderRadius: 34,
    padding: 14,
    shadowColor: '#6E89BB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 5,
  },
  innerCard: {
    borderWidth: 1.5,
    borderColor: '#C8D6F2',
    borderRadius: 26,
    padding: 14,
    backgroundColor: '#F8FAFC',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  docIconWrap: {
    width: 70,
    height: 70,
    borderRadius: 16,
    backgroundColor: '#EEF4FE',
    borderWidth: 1,
    borderColor: '#D6E3F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceTitle: {
    color: '#1A2238',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  invoiceDue: {
    marginTop: 3,
    color: '#4D5E81',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#F1C37A',
    backgroundColor: '#F9EED7',
  },
  statusText: {
    color: '#D47A09',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  amount: {
    marginTop: 12,
    color: '#1667B7',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  divider: {
    marginTop: 10,
    height: 1,
    backgroundColor: '#D7E2F5',
  },
  openBtn: {
    height: 52,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  openBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
});
