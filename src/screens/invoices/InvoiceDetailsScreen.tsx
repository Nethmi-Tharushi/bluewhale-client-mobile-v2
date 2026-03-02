import React, { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system';
import { Badge, Button, Card, Screen } from '../../components/ui';
import { Spacing } from '../../constants/theme';
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

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Card>
          <Text style={[styles.title, { color: t.colors.primary }]}>{inv?.invoiceNumber ? `Invoice #${inv.invoiceNumber}` : 'Invoice'}</Text>
          <Text style={[styles.meta, { color: t.colors.textMuted }]}>Due {formatDate(inv?.dueDate) || '-'}</Text>
          <View style={{ height: 10 }} />
          <Badge text={inv?.status || (loading ? 'Loading...' : 'Unknown')} />

          <View style={{ height: 14 }} />
          <Text style={[styles.h, { color: t.colors.primary }]}>Items</Text>
          {(inv?.items || []).length ? (
            (inv?.items || []).map((it, idx) => (
              <View key={idx} style={[styles.row, { borderBottomColor: t.isDark ? 'rgba(67,198,255,0.2)' : 'rgba(15,121,197,0.16)' }]}>
                <Text style={[styles.itemName, { color: t.colors.text }]}>{it.name || `Item ${idx + 1}`}</Text>
                <Text style={[styles.itemPrice, { color: t.colors.text }]}>{money((it.total ?? (it.qty || 1) * (it.unitPrice || 0)) as any, inv?.currency || 'LKR')}</Text>
              </View>
            ))
          ) : (
            <Text style={[styles.p, { color: t.colors.textMuted }]}>No item breakdown available.</Text>
          )}

          <View style={{ height: 14 }} />
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: t.colors.primary }]}>Total</Text>
            <Text style={[styles.totalValue, { color: t.colors.text }]}>{money(inv?.total, inv?.currency || 'LKR')}</Text>
          </View>

          <View style={{ height: 16 }} />
          <Button title="View / Download PDF" onPress={openPdf} />
          <View style={{ height: 10 }} />
          <Button title="Pay / Submit proof" variant="secondary" onPress={() => navigation.navigate('Payment', { invoiceId })} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '900' },
  meta: { marginTop: 6, fontWeight: '700' },
  h: { fontWeight: '900', marginBottom: 8, fontSize: 16 },
  p: { fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(15,121,197,0.16)' },
  itemName: { flex: 1, marginRight: 12, fontWeight: '700' },
  itemPrice: { fontWeight: '900' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  totalLabel: { fontWeight: '900', fontSize: 17 },
  totalValue: { fontWeight: '900', fontSize: 17 },
});
