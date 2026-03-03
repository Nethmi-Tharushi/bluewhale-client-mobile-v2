import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { InvoicesService } from '../../api/services';
import { getToken } from '../../utils/tokenStorage';
import { useAuthStore } from '../../context/authStore';
import { API_BASE_URL } from '../../config/api';
import type { Invoice } from '../../types/models';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InvoicesStackParamList } from '../../navigation/app/AppNavigator';
import { formatDate, money } from '../../utils/format';
import { useTheme } from '../../theme/ThemeProvider';

const toAbsoluteHttpUrl = (raw: string) => {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  const apiRoot = API_BASE_URL.replace(/\/$/, '');
  const origin = apiRoot.replace(/\/api$/i, '');
  if (v.startsWith('/api/')) return `${origin}${v}`;
  if (v.startsWith('/')) return `${apiRoot}${v}`;
  return `${apiRoot}/${v}`;
};

const openLocalFile = async (fileUri: string) => {
  try {
    await Linking.openURL(fileUri);
  } catch {
    throw new Error('Unable to open downloaded PDF on this device/emulator.');
  }
};

type Props = NativeStackScreenProps<InvoicesStackParamList, 'InvoiceDetails'>;

export default function InvoiceDetailsScreen({ navigation, route }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { invoiceId, invoice: initialInvoice } = route.params;
  const [inv, setInv] = useState<Invoice | null>(initialInvoice || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const i = await InvoicesService.get(invoiceId);
        setInv((prev) => ({ ...(prev || {}), ...(i || {}) }));
      } catch {
        setInv((prev) => prev || null);
      } finally {
        setLoading(false);
      }
    })();
  }, [invoiceId]);

  const openExternalUrl = async (targetUrl: string) => {
    const absoluteUrl = toAbsoluteHttpUrl(targetUrl);
    if (!/^https?:\/\//i.test(absoluteUrl)) {
      throw new Error('Invalid PDF URL returned by server.');
    }
    try {
      await WebBrowser.openBrowserAsync(absoluteUrl);
      return;
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (!msg.toLowerCase().includes('no matching browser activity found')) throw err;
    }
    try {
      await Linking.openURL(absoluteUrl);
    } catch {
      throw new Error('Unable to open browser on this device/emulator.');
    }
  };

  const openPdf = async () => {
    try {
      const localPdfUrl =
        (inv as any)?.pdfUrl || (inv as any)?.pdfURL || (inv as any)?.pdf || (inv as any)?.documentUrl || (inv as any)?.documentURL;
      if (localPdfUrl) {
        await openExternalUrl(String(localPdfUrl));
        return;
      }
      const res = await InvoicesService.getPdfUrl(invoiceId).catch(() => null);
      const url = (res as any)?.url || (res as any)?.pdfUrl || (res as any)?.link;
      if (url) {
        await openExternalUrl(String(url));
        return;
      }

      const token = (await getToken()) || useAuthStore.getState().token;
      if (!token) throw new Error('Session expired. Please log out and log in again.');
      const endpoints = [`/users/invoices/${invoiceId}/pdf`, `/invoices/${invoiceId}/pdf`];
      let downloaded = false;
      for (const endpoint of endpoints) {
        const pdfUrl = toAbsoluteHttpUrl(endpoint);
        const targetPath = `${(FileSystem as any).cacheDirectory || ''}invoice-${invoiceId}.pdf`;
        const result = await FileSystem.downloadAsync(pdfUrl, targetPath, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (result.status >= 200 && result.status < 300) {
          await openLocalFile(result.uri);
          downloaded = true;
          break;
        }
      }
      if (!downloaded) throw new Error('PDF endpoint requires authenticated access and did not return a downloadable file.');
    } catch (e: any) {
      Alert.alert('Unable to open PDF', e?.userMessage || e?.message || 'Please try again');
    }
  };

  const onBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.getParent()?.navigate('Bills' as never);
  };

  const invoiceTitle = inv?.invoiceNumber ? `Invoice #${inv.invoiceNumber}` : loading ? 'Loading...' : 'Invoice';
  const dueText = `Due ${formatDate(inv?.dueDate) || '-'}`;
  const totalText = money(inv?.total, inv?.currency || 'USD');
  const statusText = String(inv?.status || (loading ? 'Loading...' : 'Sent'));
  const itemCount = Array.isArray(inv?.items) ? inv!.items!.length : 0;

  return (
    <LinearGradient colors={t.colors.gradientBackground as any} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: Math.max(8, insets.top + 4), paddingBottom: 150 }]}>
          <View style={styles.headerWrap}>
            <View style={styles.headerTopRow}>
              <Pressable onPress={onBack} style={styles.backBtn}>
                <Feather name="arrow-left" size={34} color="#1A347F" />
              </Pressable>
              <Text style={[styles.heading, { fontFamily: t.typography.fontFamily.bold }]}>Invoice Details</Text>
              <View style={styles.bellWrap}>
                <Feather name="bell" size={30} color="#455B87" />
                <View style={styles.bellDot} />
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={[styles.invoiceTitle, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
              {invoiceTitle}
            </Text>
            <Text style={[styles.invoiceDue, { fontFamily: t.typography.fontFamily.medium }]}>{dueText}</Text>

            <View style={styles.mainInfoRow}>
              <View style={styles.docIconWrap}>
                <Feather name="file-text" size={38} color="#5EA1E4" />
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.statusRow}>
                  <View />
                  <View style={styles.statusPill}>
                    <Text style={[styles.statusText, { fontFamily: t.typography.fontFamily.bold }]}>{statusText}</Text>
                  </View>
                </View>

                <View style={styles.mainDivider} />
                <View style={styles.totalRowTop}>
                  <Text style={[styles.totalLabel, { fontFamily: t.typography.fontFamily.bold }]}>Total</Text>
                  <Text style={[styles.totalValue, { fontFamily: t.typography.fontFamily.bold }]}>{totalText}</Text>
                </View>
              </View>
            </View>

            <View style={styles.mainDividerStrong} />
            <View style={styles.detailsGrid}>
              <View style={styles.detailCell}>
                <Text style={[styles.detailLabel, { fontFamily: t.typography.fontFamily.medium }]}>Invoice No</Text>
                <Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                  {inv?.invoiceNumber || '-'}
                </Text>
              </View>
              <View style={styles.detailCell}>
                <Text style={[styles.detailLabel, { fontFamily: t.typography.fontFamily.medium }]}>Status</Text>
                <Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                  {statusText}
                </Text>
              </View>
              <View style={styles.detailCell}>
                <Text style={[styles.detailLabel, { fontFamily: t.typography.fontFamily.medium }]}>Currency</Text>
                <Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                  {inv?.currency || 'USD'}
                </Text>
              </View>
              <View style={styles.detailCell}>
                <Text style={[styles.detailLabel, { fontFamily: t.typography.fontFamily.medium }]}>Items</Text>
                <Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                  {String(itemCount)}
                </Text>
              </View>
            </View>

            <Pressable onPress={openPdf} style={{ marginTop: 12 }}>
              <LinearGradient colors={['#1B3890', '#0F79C5']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.actionBtn}>
                <Feather name="file-plus" size={18} color="#FFFFFF" />
                <Text style={[styles.actionBtnText, { fontFamily: t.typography.fontFamily.bold }]}>View / Download PDF</Text>
              </LinearGradient>
            </Pressable>

            <Pressable onPress={() => navigation.navigate('Payment', { invoiceId })} style={{ marginTop: 10 }}>
              <LinearGradient colors={['#1B3890', '#0F79C5']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.actionBtn}>
                <Text style={[styles.actionBtnText, { fontFamily: t.typography.fontFamily.bold }]}>Pay / Submit proof</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>
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
    marginBottom: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 52,
    alignItems: 'flex-start',
  },
  heading: {
    flex: 1,
    color: '#1A347F',
    fontSize: 24,
    lineHeight: 30,
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
  card: {
    marginBottom: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D8E3F7',
    borderRadius: 30,
    padding: 16,
    shadowColor: '#6E89BB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 5,
  },
  invoiceTitle: {
    color: '#1A347F',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
  },
  invoiceDue: {
    marginTop: 4,
    color: '#59688D',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  mainInfoRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  docIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 20,
    backgroundColor: '#EAF2FF',
    borderWidth: 1,
    borderColor: '#D6E3F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#F1C37A',
    backgroundColor: '#F9EED7',
    alignSelf: 'flex-end',
  },
  statusText: {
    color: '#D47A09',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  mainDivider: {
    height: 1,
    backgroundColor: '#D7E2F5',
  },
  totalRowTop: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: '#4E5D81',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  totalValue: {
    color: '#18243F',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  mainDividerStrong: {
    marginTop: 10,
    height: 1,
    backgroundColor: '#D7E2F5',
  },
  detailsGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailCell: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D3E0F6',
    backgroundColor: '#EEF4FE',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  detailLabel: {
    color: '#637792',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  detailValue: {
    marginTop: 2,
    color: '#1A347F',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  actionBtn: {
    minHeight: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
});
