import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { InvoicesService } from '../../api/services';
import { getToken } from '../../utils/tokenStorage';
import { useAuthStore } from '../../context/authStore';
import { API_BASE_URL } from '../../config/api';
import type { Invoice } from '../../types/models';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InvoicesStackParamList } from '../../navigation/app/AppNavigator';
import { formatDate, money } from '../../utils/format';
import { useTheme } from '../../theme/ThemeProvider';
import { PageDecor } from '../../components/ui';
import { downloadResolvedRemoteFile } from '../../utils/remoteFileDownload';

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

const isRemoteOrRelativeUrl = (raw: string) => /^(https?:\/\/|\/)/i.test(String(raw || '').trim());

const normalizeMimeType = (value?: string, fallback = 'application/pdf') =>
  String(value || fallback)
    .trim()
    .toLowerCase()
    .split(';')[0]
    .trim() || fallback;

const openLocalFile = async (fileUri: string, mimeType = 'application/pdf') => {
  try {
    if (Platform.OS === 'android' && typeof (FileSystem as any).getContentUriAsync === 'function') {
      const contentUri = await (FileSystem as any).getContentUriAsync(fileUri);
      try {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: normalizeMimeType(mimeType),
        });
        return;
      } catch {
        // Try file URI fallback next.
      }
    }
    try {
      await Linking.openURL(fileUri);
      return;
    } catch {
      // Throw a clearer error below.
    }
  } catch {
    // fall through
  }
  throw new Error('PDF was downloaded, but no app could open it on this device.');
};

const sanitizePdfFileName = (rawName: string, fallback = 'invoice.pdf') => {
  const cleaned =
    String(rawName || '')
      .trim()
      .replace(/[^\w.\-]+/g, '_')
      .replace(/^_+|_+$/g, '') || fallback;
  return /\.pdf$/i.test(cleaned) ? cleaned : `${cleaned}.pdf`;
};

const savePdfToAndroidFolder = async (sourceUri: string, fileName: string) => {
  const storageFramework = (FileSystem as any).StorageAccessFramework;
  if (Platform.OS !== 'android' || !storageFramework) return false;

  const initialUri =
    typeof storageFramework.getUriForDirectoryInRoot === 'function'
      ? storageFramework.getUriForDirectoryInRoot('Download')
      : null;
  const permissions = await storageFramework.requestDirectoryPermissionsAsync(initialUri);
  if (!permissions?.granted || !permissions?.directoryUri) {
    throw new Error('Pick a folder to save the PDF.');
  }

  const base64 = await FileSystem.readAsStringAsync(sourceUri, {
    encoding: (FileSystem as any).EncodingType?.Base64 || 'base64',
  });
  const safeName = sanitizePdfFileName(fileName);
  const uniqueName = safeName.replace(/\.pdf$/i, `-${Date.now()}.pdf`);
  const targetUri = await storageFramework.createFileAsync(
    permissions.directoryUri,
    uniqueName,
    'application/pdf'
  );
  await storageFramework.writeAsStringAsync(targetUri, base64, {
    encoding: (FileSystem as any).EncodingType?.Base64 || 'base64',
  });

  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: targetUri,
      flags: 1,
      type: normalizeMimeType('application/pdf'),
    });
    return true;
  } catch {
    Alert.alert('PDF saved', `Saved as ${uniqueName}. Open it from your Files or Downloads app.`);
    return true;
  }
};

const shouldUseAuthenticatedDownload = (targetUrl: string) => {
  const raw = String(targetUrl || '').trim();
  if (!raw) return false;
  if (!/^https?:\/\//i.test(raw)) return true;

  const apiOrigin = API_BASE_URL.replace(/\/api$/i, '').replace(/\/$/, '').toLowerCase();
  const absolute = toAbsoluteHttpUrl(raw).toLowerCase();
  const sameApiOrigin = absolute.startsWith(apiOrigin);
  const path = absolute.replace(/^https?:\/\/[^/]+/i, '');
  const protectedPdfPath = /\/api\/(users\/(me\/)?invoices\/[^/]+\/pdf|invoices\/[^/]+\/pdf|sales-admin\/invoices\/[^/]+\/pdf)/i.test(path);
  return sameApiOrigin && protectedPdfPath;
};

const getStatusTone = (value: string) => {
  const status = String(value || '').toLowerCase();
  if (status.includes('paid') || status.includes('complete') || status.includes('settled')) {
    return { bg: '#E7F8F0', border: '#BEEAD2', text: '#118452', accent: '#1FCB7A' };
  }
  if (status.includes('overdue') || status.includes('late') || status.includes('failed')) {
    return { bg: '#FDEBEE', border: '#F2C3CB', text: '#C33E56', accent: '#F06A85' };
  }
  return { bg: '#FFF4E2', border: '#F4D9A3', text: '#B06A0E', accent: '#F0A53B' };
};

type Props = NativeStackScreenProps<InvoicesStackParamList, 'InvoiceDetails'>;

export default function InvoiceDetailsScreen({ navigation, route }: Props) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const { invoiceId, invoice: initialInvoice } = route.params;
  const [inv, setInv] = useState<Invoice | null>(initialInvoice || null);
  const [loading, setLoading] = useState(true);

  const heroEntrance = useRef(new Animated.Value(0)).current;
  const sectionsEntrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const sheetFloat = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const routePulse = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroEntrance, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(sectionsEntrance, { toValue: 1, duration: 760, delay: 90, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
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
          Animated.timing(sheetFloat, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(sheetFloat, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
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
          Animated.timing(routePulse, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(routePulse, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
    ];

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [heroEntrance, pulse, routePulse, sectionsEntrance, sheetFloat, sweep]);

  const openExternalUrl = async (targetUrl: string) => {
    const absoluteUrl = toAbsoluteHttpUrl(targetUrl);
    if (!/^https?:\/\//i.test(absoluteUrl)) {
      throw new Error('Invalid PDF URL returned by server.');
    }
    if (Platform.OS === 'android') {
      try {
        await Linking.openURL(absoluteUrl);
        return;
      } catch {
        // Fall back to web browser below.
      }
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
      const downloadAndOpenPdf = async (targetUrl: string, options?: { requireAuth?: boolean }) => {
        const absoluteUrl = toAbsoluteHttpUrl(targetUrl);
        if (!/^https?:\/\//i.test(absoluteUrl)) throw new Error('Invalid PDF URL returned by server.');
        const token = (await getToken()) || useAuthStore.getState().token;
        if (options?.requireAuth && !token) throw new Error('Session expired. Please log out and log in again.');

        const cacheDir = `${(FileSystem as any).cacheDirectory || ''}invoices`;
        const downloaded = await downloadResolvedRemoteFile({
          url: absoluteUrl,
          targetDir: cacheDir,
          fileName: inv?.invoiceNumber ? `invoice-${inv.invoiceNumber}.pdf` : `invoice-${invoiceId}.pdf`,
          fallbackBaseName: `invoice-${invoiceId}`,
          fallbackExtension: 'pdf',
          fallbackMimeType: 'application/pdf',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          toAbsoluteUrl: toAbsoluteHttpUrl,
        });
        try {
          await openLocalFile(downloaded.uri, 'application/pdf');
          return;
        } catch (openErr) {
          const savedToAndroidFolder = await savePdfToAndroidFolder(
            downloaded.uri,
            downloaded.fileName
          ).catch(() => false);
          if (savedToAndroidFolder) return;
          if (/^https?:\/\//i.test(downloaded.sourceUrl) && !shouldUseAuthenticatedDownload(downloaded.sourceUrl)) {
            await openExternalUrl(downloaded.sourceUrl);
            return;
          }
          throw openErr;
        }
      };

      const res = await InvoicesService.getPdfUrl(invoiceId);
      const directBase64 = String((res as any)?.base64 || '').trim();
      if (directBase64) {
        const cacheDir = `${(FileSystem as any).cacheDirectory || ''}invoices`;
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true }).catch(() => undefined);
        const fileName = sanitizePdfFileName(
          String((res as any)?.fileName || '') || (inv?.invoiceNumber ? `invoice-${inv.invoiceNumber}.pdf` : `invoice-${invoiceId}.pdf`)
        );
        const targetPath = `${cacheDir}/${Date.now()}-${fileName}`;
        await FileSystem.writeAsStringAsync(targetPath, directBase64, {
          encoding: (FileSystem as any).EncodingType?.Base64 || 'base64',
        });
        try {
          await openLocalFile(targetPath, 'application/pdf');
          return;
        } catch (openErr) {
          const savedToAndroidFolder = await savePdfToAndroidFolder(targetPath, fileName).catch(() => false);
          if (savedToAndroidFolder) return;
          throw openErr;
        }
      }
      const candidates = Array.from(
        new Set(
          [...(Array.isArray((res as any)?.candidates) ? (res as any).candidates : []), (res as any)?.url]
            .map((item) => String(item || '').trim())
            .filter((item) => item && isRemoteOrRelativeUrl(item))
        )
      );
      let lastError: any;
      for (const candidate of candidates) {
        try {
          await downloadAndOpenPdf(candidate, { requireAuth: true });
          return;
        } catch (err: any) {
          if (/^https?:\/\//i.test(candidate) && !shouldUseAuthenticatedDownload(candidate)) {
            try {
              await openExternalUrl(candidate);
              return;
            } catch {
              // Keep trying the next candidate.
            }
          }
          lastError = err;
        }
      }
      throw lastError || new Error('Invoice PDF endpoint did not return a valid path.');
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
  const itemCount = Array.isArray(inv?.items) ? inv.items.length : 0;
  const hasProof = Boolean(
    (inv as any)?.hasPaymentProof ||
      (inv as any)?.reference ||
      (inv as any)?.referenceNo ||
      (inv as any)?.paymentReference ||
      (inv as any)?.slipUrl ||
      (inv as any)?.slip_url ||
      (inv as any)?.paymentSlipUrl ||
      (inv as any)?.attachmentUrl ||
      (inv as any)?.latestProof?.reference ||
      (inv as any)?.latestProof?.referenceNo ||
      (inv as any)?.latestProof?.paymentReference ||
      (inv as any)?.latestProof?.proofUrl ||
      (inv as any)?.latestProof?.slipUrl ||
      (inv as any)?.latestProof?.slip_url ||
      (inv as any)?.latestProof?.paymentSlipUrl ||
      (inv as any)?.latestProof?.attachmentUrl ||
      (inv as any)?.paymentProof?.reference ||
      (inv as any)?.paymentProof?.referenceNo ||
      (inv as any)?.paymentProof?.paymentReference ||
      (inv as any)?.paymentProof?.slipUrl ||
      (inv as any)?.paymentProof?.slip_url ||
      (inv as any)?.paymentProof?.paymentSlipUrl ||
      (inv as any)?.paymentProof?.attachmentUrl
  );
  const tone = getStatusTone(statusText);
  const heroSheetWidth = width < 380 ? 126 : 138;
  const statusGlowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const statusGlowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.45] });
  const heroY = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const sectionY = sectionsEntrance.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-180, 260] });
  const sheetY = sheetFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const routeScale = routePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const routeOpacity = routePulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.55] });

  const detailRows = useMemo(
    () => [
      { label: 'Invoice No', value: inv?.invoiceNumber || '-', icon: 'hash', tone: 'blue' as const },
      { label: 'Status', value: statusText, icon: 'activity', tone: 'amber' as const },
      { label: 'Currency', value: inv?.currency || 'USD', icon: 'credit-card', tone: 'mint' as const },
      { label: 'Items', value: String(itemCount), icon: 'layers', tone: 'lavender' as const },
    ],
    [inv?.currency, inv?.invoiceNumber, itemCount, statusText]
  );

  return (
    <LinearGradient colors={t.colors.gradientBackground as any} style={styles.root}>
      <PageDecor />
      <SafeAreaView style={styles.safe}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.topBar, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
            <Pressable onPress={onBack} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
              <Feather name="arrow-left" size={20} color="#1A347F" />
            </Pressable>
            <View style={styles.topCopy}>
              <Text style={[styles.topEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>Billing record</Text>
              <Text style={[styles.heading, { fontFamily: t.typography.fontFamily.bold }]}>Invoice details</Text>
            </View>
            <View style={[styles.topStatusChip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
              <Animated.View style={[styles.topStatusDot, { backgroundColor: tone.accent, opacity: statusGlowOpacity, transform: [{ scale: statusGlowScale }] }]} />
              <Text style={[styles.topStatusText, { color: tone.text, fontFamily: t.typography.fontFamily.bold }]}>{statusText}</Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.heroCard, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
            <View style={styles.heroGlowA} />
            <View style={styles.heroGlowB} />
            <Animated.View style={[styles.heroSweep, { transform: [{ translateX: sweepX }, { rotate: '18deg' }] }]} />

            <View style={styles.heroHeaderRow}>
              <View style={styles.heroPill}>
                <Feather name="file-text" size={13} color="#155B9F" />
                <Text style={[styles.heroPillText, { fontFamily: t.typography.fontFamily.bold }]}>Settlement sheet</Text>
              </View>
              <View style={styles.heroSignal}>
                <View style={styles.heroSignalDot} />
                <Text style={[styles.heroSignalText, { fontFamily: t.typography.fontFamily.bold }]}>Ready record</Text>
              </View>
            </View>

            <View style={styles.heroMain}>
              <View style={styles.heroCopyBlock}>
                <Text style={[styles.heroTitle, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={2}>
                  {invoiceTitle}
                </Text>
                <Text style={[styles.heroBody, { fontFamily: t.typography.fontFamily.medium }]}>{dueText}</Text>

                <View style={styles.totalCard}>
                  <Text style={[styles.totalLabel, { fontFamily: t.typography.fontFamily.medium }]}>Total amount</Text>
                  <Text style={[styles.totalValue, { fontFamily: t.typography.fontFamily.bold }]}>{totalText}</Text>
                </View>
              </View>

              <Animated.View style={[styles.heroVisual, { width: heroSheetWidth + 14, transform: [{ translateY: sheetY }] }]}>
                <Animated.View style={[styles.heroSheetBack, { width: heroSheetWidth - 10, transform: [{ translateY: sheetY }, { rotate: '-5deg' }] }]} />
                <View style={[styles.heroSheetFront, { width: heroSheetWidth }]}>
                  <View style={styles.heroSheetTop}>
                    <View style={styles.heroDocIcon}>
                      <Feather name="file-text" size={18} color="#FFFFFF" />
                    </View>
                    <View>
                      <Text style={[styles.heroSheetTitle, { fontFamily: t.typography.fontFamily.bold }]}>Payment trail</Text>
                      <Text style={[styles.heroSheetSub, { fontFamily: t.typography.fontFamily.medium }]}>Document and proof lane</Text>
                    </View>
                  </View>
                  <View style={styles.heroTrack}>
                    <View style={styles.heroTrackLine} />
                    <Animated.View style={[styles.heroTrackPulse, { opacity: routeOpacity, transform: [{ scale: routeScale }] }]} />
                    <View style={styles.heroTrackDotTop} />
                    <View style={styles.heroTrackDotBottom} />
                  </View>
                  <View style={styles.heroProofChip}>
                    <Feather name={hasProof ? 'check-circle' : 'upload-cloud'} size={13} color={hasProof ? '#128552' : '#B06A0E'} />
                    <Text style={[styles.heroProofText, { fontFamily: t.typography.fontFamily.bold }]}>{hasProof ? 'Proof uploaded' : 'Proof pending'}</Text>
                  </View>
                </View>
              </Animated.View>
            </View>
          </Animated.View>

          <Animated.View style={{ opacity: sectionsEntrance, transform: [{ translateY: sectionY }] }}>
            <View style={styles.detailGrid}>
              {detailRows.map((item) => (
                <View
                  key={item.label}
                  style={[
                    styles.detailCard,
                    item.tone === 'blue'
                      ? styles.detailCardBlue
                      : item.tone === 'amber'
                        ? styles.detailCardAmber
                        : item.tone === 'mint'
                          ? styles.detailCardMint
                          : styles.detailCardLavender,
                  ]}
                >
                  <View style={styles.detailLabelRow}>
                    <Feather
                      name={item.icon as any}
                      size={13}
                      color={item.tone === 'blue' ? '#176FC2' : item.tone === 'amber' ? '#B06A0E' : item.tone === 'mint' ? '#11856E' : '#7353B7'}
                    />
                    <Text style={[styles.detailLabel, { fontFamily: t.typography.fontFamily.medium }]}>{item.label}</Text>
                  </View>
                  <Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.actionsWrap}>
              <Pressable onPress={openPdf} style={({ pressed }) => [styles.primaryActionWrap, pressed && styles.pressed]}>
                <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.primaryAction}>
                  <Animated.View pointerEvents="none" style={[styles.primarySweep, { transform: [{ translateX: sweepX }, { rotate: '16deg' }] }]} />
                  <View style={styles.primaryIconWrap}>
                    <Feather name="download" size={17} color="#FFFFFF" />
                  </View>
                  <View style={styles.primaryCopy}>
                    <Text style={[styles.primaryTitle, { fontFamily: t.typography.fontFamily.bold }]}>View / Download PDF</Text>
                    <Text style={[styles.primaryText, { fontFamily: t.typography.fontFamily.medium }]}>Open the invoice document</Text>
                  </View>
                </LinearGradient>
              </Pressable>

              <Pressable onPress={() => navigation.navigate('Payment', { invoiceId })} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
                <View style={styles.secondaryIconWrap}>
                  <Feather name={hasProof ? 'edit-3' : 'upload-cloud'} size={16} color="#1667B7" />
                </View>
                <View style={styles.secondaryCopy}>
                  <Text style={[styles.secondaryTitle, { fontFamily: t.typography.fontFamily.bold }]}>{hasProof ? 'Edit proof' : 'Submit proof'}</Text>
                  <Text style={[styles.secondaryText, { fontFamily: t.typography.fontFamily.medium }]}>{hasProof ? 'Update payment evidence' : 'Attach payment evidence'}</Text>
                </View>
                <Feather name="arrow-right" size={16} color="#1667B7" />
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 150,
    flexGrow: 1,
  },
  pressed: { opacity: 0.88 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#D4E1F4',
  },
  topCopy: { flex: 1 },
  topEyebrow: {
    color: '#71839C',
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
  topStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
  },
  topStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  topStatusText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  heroCard: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#D6E2F3',
    backgroundColor: '#F9FBFE',
    overflow: 'hidden',
  },
  heroGlowA: {
    position: 'absolute',
    top: -72,
    right: -20,
    width: 188,
    height: 188,
    borderRadius: 94,
    backgroundColor: 'rgba(28, 106, 193, 0.1)',
  },
  heroGlowB: {
    position: 'absolute',
    bottom: -24,
    left: -10,
    width: 134,
    height: 134,
    borderRadius: 67,
    backgroundColor: 'rgba(240, 165, 59, 0.08)',
  },
  heroSweep: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 88,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6E2F3',
  },
  heroPillText: {
    color: '#155B9F',
    fontSize: 10,
    lineHeight: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
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
    borderColor: '#D6E2F3',
  },
  heroSignalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1FCB7A',
  },
  heroSignalText: {
    color: '#118452',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  heroMain: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 14,
  },
  heroCopyBlock: { flex: 1 },
  heroTitle: {
    color: '#19367C',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
  },
  heroBody: {
    marginTop: 6,
    color: '#596B86',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  totalCard: {
    marginTop: 14,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7E2F4',
  },
  totalLabel: {
    color: '#73849D',
    fontSize: 10,
    lineHeight: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  totalValue: {
    marginTop: 4,
    color: '#1667B7',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  heroVisual: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroSheetBack: {
    position: 'absolute',
    height: 178,
    borderRadius: 24,
    backgroundColor: '#EAF1FA',
    borderWidth: 1,
    borderColor: '#D4DFF2',
  },
  heroSheetFront: {
    borderRadius: 24,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6E2F3',
  },
  heroSheetTop: {
    flexDirection: 'row',
    gap: 10,
  },
  heroDocIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#1765BA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSheetTitle: {
    color: '#153172',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '900',
  },
  heroSheetSub: {
    marginTop: 4,
    color: '#6A7C97',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
  },
  heroTrack: {
    marginTop: 16,
    height: 54,
    justifyContent: 'center',
    position: 'relative',
  },
  heroTrackLine: {
    height: 2,
    borderRadius: 999,
    backgroundColor: '#D7E3F4',
  },
  heroTrackPulse: {
    position: 'absolute',
    left: 18,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(31, 203, 122, 0.2)',
  },
  heroTrackDotTop: {
    position: 'absolute',
    left: 21,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1FCB7A',
  },
  heroTrackDotBottom: {
    position: 'absolute',
    right: 20,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1765BA',
  },
  heroProofChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F5F8FD',
    borderWidth: 1,
    borderColor: '#D8E2F2',
  },
  heroProofText: {
    color: '#486482',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailCard: {
    width: '48.5%',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  detailCardBlue: {
    backgroundColor: '#EEF5FF',
    borderColor: '#D8E6F8',
  },
  detailCardAmber: {
    backgroundColor: '#FFF4E2',
    borderColor: '#F4D9A3',
  },
  detailCardMint: {
    backgroundColor: '#EAF9F6',
    borderColor: '#D1EEE7',
  },
  detailCardLavender: {
    backgroundColor: '#F4EEFF',
    borderColor: '#E4D8FA',
  },
  detailLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    color: '#4D6581',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  detailValue: {
    marginTop: 5,
    color: '#102457',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  actionsWrap: {
    marginTop: 12,
    gap: 10,
  },
  primaryActionWrap: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  primaryAction: {
    minHeight: 58,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  primarySweep: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 72,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  primaryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  primaryCopy: {
    flex: 1,
  },
  primaryTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  primaryText: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
  },
  secondaryAction: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D6E2F4',
    backgroundColor: 'rgba(249,251,254,0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  secondaryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF2FF',
  },
  secondaryCopy: {
    flex: 1,
  },
  secondaryTitle: {
    color: '#15458F',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  secondaryText: {
    marginTop: 2,
    color: '#6A7C97',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
  },
});
