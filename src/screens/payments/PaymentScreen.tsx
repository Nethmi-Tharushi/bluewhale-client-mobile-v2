import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '../../components/ui';
import { InvoicesService, UploadService } from '../../api/services';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InvoicesStackParamList } from '../../navigation/app/AppNavigator';
import { useTheme } from '../../theme/ThemeProvider';
import { ensureUploadSizeWithinLimit } from '../../utils/uploadValidation';
import { useAuthStore } from '../../context/authStore';
import { getManagedCandidateId } from '../../utils/managedView';

type Props = NativeStackScreenProps<InvoicesStackParamList, 'Payment'>;

export default function PaymentScreen({ navigation, route }: Props) {
  const t = useTheme();
  const { height, width } = useWindowDimensions();
  const { invoiceId } = route.params;
  const user = useAuthStore((s) => s.user);
  const managedCandidateId = getManagedCandidateId(user);
  const compact = height < 760;
  const narrow = width < 430;

  const [reference, setReference] = useState('');
  const [slipName, setSlipName] = useState<string | null>(null);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasExistingProof, setHasExistingProof] = useState(false);

  const heroEntrance = useRef(new Animated.Value(0)).current;
  const sectionsEntrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const routeDrift = useRef(new Animated.Value(0)).current;

  const firstString = (values: any[]) => {
    for (const v of values) {
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  };

  const firstUploadLikeValue = (values: any[]): string => {
    const visit = (value: any): string => {
      if (!value) return '';
      if (typeof value === 'string' && value.trim()) {
        const text = value.trim();
        const slipMatch = text.match(/Slip URL:\s*(\S+)/i);
        if (slipMatch?.[1]) return slipMatch[1].trim();
        if (/^(https?:\/\/|\/|[A-Za-z]:\\)/.test(text) || /\.[a-z0-9]{2,6}($|\?)/i.test(text)) return text;
        return '';
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = visit(item);
          if (found) return found;
        }
        return '';
      }
      if (typeof value === 'object') {
        const directKeys = [
          'slipUrl',
          'slip_url',
          'paymentSlipUrl',
          'attachmentUrl',
          'proofUrl',
          'url',
          'fileUrl',
          'documentUrl',
          'documentURL',
          'path',
          'uri',
          'filename',
          'fileName',
          'notes',
        ];
        for (const key of directKeys) {
          const found = visit(value?.[key]);
          if (found) return found;
        }
        for (const nested of Object.values(value)) {
          const found = visit(nested);
          if (found) return found;
        }
      }
      return '';
    };

    for (const value of values) {
      const found = visit(value);
      if (found) return found;
    }
    return '';
  };

  const detectProof = (invoice: any) => {
    const proofCandidates = [
      invoice?.paymentProof,
      invoice?.latestProof,
      invoice?.proof,
      invoice?.payment,
      invoice?.paymentDetails,
      invoice?.attachments,
      invoice?.documents,
    ].filter(Boolean);
    const existingReference = firstString([
      invoice?.reference,
      invoice?.referenceNo,
      invoice?.paymentReference,
      invoice?.paymentRef,
      ...proofCandidates.flatMap((proof: any) => [proof?.reference, proof?.referenceNo, proof?.paymentReference, proof?.paymentRef]),
    ]);
    const existingSlipUrl = firstUploadLikeValue([
      invoice?.slipUrl,
      invoice?.slip_url,
      invoice?.paymentSlipUrl,
      invoice?.attachmentUrl,
      invoice?.proofUrl,
      invoice?.notes,
      ...proofCandidates,
    ]);
    return { existingReference, existingSlipUrl };
  };

  useEffect(() => {
    (async () => {
      try {
        const inv = await InvoicesService.get(invoiceId, managedCandidateId ? { managedCandidateId } : undefined);
        const { existingReference, existingSlipUrl } = detectProof(inv as any);
        if (existingReference) setReference(existingReference);
        if (existingSlipUrl) {
          setSlipUrl(existingSlipUrl);
          const name = existingSlipUrl.split('/').pop()?.split('?')[0] || 'Existing slip';
          setSlipName(name);
        }
        setHasExistingProof(Boolean((inv as any)?.hasPaymentProof || existingReference || existingSlipUrl));
      } catch {
        setHasExistingProof(false);
      }
    })();
  }, [invoiceId, managedCandidateId]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroEntrance, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(sectionsEntrance, { toValue: 1, duration: 760, delay: 100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
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
          Animated.timing(sweep, { toValue: 1, duration: 2200, delay: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
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
          Animated.timing(routeDrift, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(routeDrift, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
    ];

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [float, heroEntrance, pulse, routeDrift, sectionsEntrance, sweep]);

  const pickSlip = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['image/*', 'application/pdf'],
    });
    if (res.canceled) return;
    const file = res.assets[0];
    try {
      await ensureUploadSizeWithinLimit({ uri: file.uri, name: file.name, size: file.size ?? null });
    } catch (e: any) {
      Alert.alert('File too large', e?.userMessage || e?.message || 'Please choose a file smaller than 5 MB.');
      return;
    }
    setUploading(true);
    try {
      const uploaded = await UploadService.uploadFile({ uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
      const url = (uploaded as any)?.url || (uploaded as any)?.fileUrl || (uploaded as any)?.path;
      if (!url) throw new Error('Upload response did not include a URL.');
      setSlipUrl(url);
      setSlipName(file.name);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setUploading(false);
    }
  };

  const submitProof = async () => {
    if (!reference.trim() && !slipUrl) {
      Alert.alert('Missing proof', 'Please add a reference number and/or upload a slip.');
      return;
    }
    setSubmitting(true);
    try {
      await InvoicesService.markPaid(invoiceId, {
        reference: reference.trim() || undefined,
        slipUrl: slipUrl || undefined,
        managedCandidateId: managedCandidateId || undefined,
      });
      Alert.alert(
        hasExistingProof ? 'Updated' : 'Submitted',
        hasExistingProof ? 'Payment proof updated successfully.' : 'Payment proof submitted. Status will update after verification.'
      );
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setSubmitting(false);
    }
  };

  const heroY = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const sectionY = sectionsEntrance.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.5] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-180, 260] });
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const routeY = routeDrift.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const statsLabels = narrow ? ['Ref no', 'Slip', 'Mode'] : ['Reference', 'Document', 'Mode'];
  const heroStats = [
    { key: 'reference', value: reference.trim() ? '1' : '0', label: statsLabels[0], color: '#1768B8', icon: 'hash' as const, iconBg: '#EAF2FF' },
    { key: 'proof', value: slipUrl ? '1' : '0', label: statsLabels[1], color: '#11876E', icon: 'image' as const, iconBg: '#EAF8F3' },
    { key: 'mode', value: hasExistingProof ? 'Edit' : 'New', label: statsLabels[2], color: '#C47C18', icon: 'edit-3' as const, iconBg: '#FFF4E4' },
  ];

  return (
    <Screen padded={false}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, compact && styles.contentCompact]} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.topBar, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
          <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
            <Feather name="arrow-left" size={20} color="#183D8E" />
          </Pressable>
          <View style={styles.topCopy}>
            <Text style={[styles.topEyebrow, { color: t.colors.textMuted, fontFamily: t.typography.fontFamily.bold }]}>Verification desk</Text>
            <Text style={[styles.topTitle, { fontFamily: t.typography.fontFamily.bold }]}>Payment</Text>
          </View>
          <View style={styles.topChip}>
            <Animated.View style={[styles.topChipDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
            <Text style={[styles.topChipText, { fontFamily: t.typography.fontFamily.bold }]}>{hasExistingProof ? 'Editing' : 'Pending'}</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.heroCard, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
          <View style={styles.heroGlowA} />
          <Animated.View style={[styles.heroGlowB, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
          <Animated.View style={[styles.heroSweep, { transform: [{ translateX: sweepX }, { rotate: '18deg' }] }]} />

          <View style={[styles.heroHeaderRow, narrow && styles.heroHeaderRowCompact]}>
            <View style={[styles.heroPill, narrow && styles.heroPillCompact]}>
              <Feather name="shield" size={13} color="#1562B4" />
              <Text style={[styles.heroPillText, { fontFamily: t.typography.fontFamily.bold }]}>Payment proof studio</Text>
            </View>
            <View style={[styles.heroSignal, narrow && styles.heroSignalCompact]}>
              <View style={styles.heroSignalDot} />
              <Text style={[styles.heroSignalText, { fontFamily: t.typography.fontFamily.bold }]}>Secure capture</Text>
            </View>
          </View>

          <View style={[styles.heroMain, (compact || narrow) && styles.heroMainCompact]}>
            <View style={[styles.heroMainRow, narrow && styles.heroMainRowCompact]}>
              <View style={[styles.heroCopyBlock, narrow && styles.heroCopyBlockCompact]}>
                <Text style={[styles.heroTitle, narrow && styles.heroTitleCompact, { fontFamily: t.typography.fontFamily.bold }]}>
                  {hasExistingProof ? 'Refine your submitted proof' : 'Submit payment proof clearly'}
                </Text>
                <Text style={[styles.heroBody, narrow && styles.heroBodyCompact, { fontFamily: t.typography.fontFamily.medium }]}>
                  {hasExistingProof
                    ? 'Update the payment reference or replace the uploaded document in one focused flow.'
                    : 'Add a payment reference and upload your receipt or PDF for verification.'}
                </Text>
              </View>

              <Animated.View style={[styles.heroVisual, narrow && styles.heroVisualCompact, { transform: [{ translateY: floatY }] }]}>
                <View style={[styles.heroSheetBack, narrow && styles.heroSheetBackCompact]} />
                <View style={[styles.heroSheetFront, narrow && styles.heroSheetFrontCompact]}>
                  <View style={styles.heroVisualTop}>
                    <View style={styles.heroVisualIcon}>
                      <Feather name="upload-cloud" size={18} color="#FFFFFF" />
                    </View>
                    <View>
                      <Text style={[styles.heroVisualTitle, { fontFamily: t.typography.fontFamily.bold }]}>Proof lane</Text>
                      <Text style={[styles.heroVisualSub, { fontFamily: t.typography.fontFamily.medium }]}>Reference to review</Text>
                    </View>
                  </View>
                  <View style={styles.heroTrack}>
                    <View style={styles.heroTrackLine} />
                    <Animated.View style={[styles.heroTrackGlow, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                    <Animated.View style={[styles.heroTrackDot, { transform: [{ translateY: routeY }] }]} />
                  </View>
                  <View style={[styles.heroProofChip, narrow && styles.heroProofChipCompact]}>
                    <Feather name={slipUrl ? 'check-circle' : 'file'} size={13} color={slipUrl ? '#118452' : '#1768B8'} />
                    <Text style={[styles.heroProofText, narrow && styles.heroProofTextCompact, { fontFamily: t.typography.fontFamily.bold }]}>
                      {slipName ? slipName : 'No file uploaded yet'}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            </View>

            <View style={[styles.heroStatsRow, narrow && styles.heroStatsRowCompact]}>
              {heroStats.map((item) => (
                <View key={item.key} style={[styles.heroStatCard, narrow && styles.heroStatCardCompact]}>
                  <View style={[styles.heroStatIcon, narrow && styles.heroStatIconCompact, { backgroundColor: item.iconBg }]}>
                    <Feather name={item.icon} size={narrow ? 11 : 12} color={item.color} />
                  </View>
                  <Text style={[styles.heroStatValue, { color: item.color, fontFamily: t.typography.fontFamily.bold }]}>{item.value}</Text>
                  <Text style={[styles.heroStatLabel, narrow && styles.heroStatLabelCompact, { fontFamily: t.typography.fontFamily.medium }]}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: sectionsEntrance, transform: [{ translateY: sectionY }] }}>
          <View style={styles.formCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionEyebrow, { color: t.colors.textMuted, fontFamily: t.typography.fontFamily.bold }]}>Reference details</Text>
                <Text style={[styles.sectionTitle, narrow && styles.sectionTitleCompact, { color: t.colors.text, fontFamily: t.typography.fontFamily.bold }]}>
                  Payment reference
                </Text>
              </View>
              <View style={styles.sectionBadge}>
                <Feather name="edit-3" size={13} color="#1768B8" />
                <Text style={[styles.sectionBadgeText, { fontFamily: t.typography.fontFamily.bold }]}>Optional</Text>
              </View>
            </View>

            <View style={styles.inputWrap}>
              <TextInput
                value={reference}
                onChangeText={setReference}
                placeholder="Bank ref / Payment ref"
                placeholderTextColor="#6A7B97"
                style={[styles.input, { fontFamily: t.typography.fontFamily.medium }]}
              />
            </View>

            <View style={styles.tipRow}>
              <Feather name="info" size={14} color="#1A84DE" />
              <Text style={[styles.tipText, { color: t.colors.textMuted, fontFamily: t.typography.fontFamily.medium }]}>
                Add any payment reference you have.
              </Text>
            </View>
          </View>

          <View style={styles.uploadCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionEyebrow, { color: t.colors.textMuted, fontFamily: t.typography.fontFamily.bold }]}>Proof document</Text>
                <Text style={[styles.sectionTitle, narrow && styles.sectionTitleCompact, { color: t.colors.text, fontFamily: t.typography.fontFamily.bold }]}>
                  Upload slip
                </Text>
              </View>
              <Animated.View style={[styles.uploadState, { transform: [{ translateY: routeY }] }]}>
                <Feather name={slipUrl ? 'check-circle' : uploading ? 'loader' : 'upload-cloud'} size={13} color={slipUrl ? '#118452' : '#1768B8'} />
                <Text style={[styles.uploadStateText, { fontFamily: t.typography.fontFamily.bold }]}>{slipUrl ? 'Ready' : uploading ? 'Uploading' : 'Pending'}</Text>
              </Animated.View>
            </View>

            <Pressable style={({ pressed }) => [styles.uploadRow, pressed && styles.pressed]} onPress={pickSlip} disabled={uploading}>
              <View style={styles.uploadIconBox}>
                <Feather name="upload" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.uploadCopy}>
                <Text style={[styles.uploadText, { fontFamily: t.typography.fontFamily.bold }]}>{uploading ? 'Uploading...' : 'Upload slip'}</Text>
                <Text style={[styles.fileText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                  {slipName || 'Image or PDF accepted'}
                </Text>
              </View>
              <Feather name="arrow-right" size={16} color="#1B6EC4" />
            </Pressable>
          </View>

          <View style={styles.actionsWrap}>
            <Pressable onPress={submitProof} disabled={submitting} style={({ pressed }) => [styles.primaryActionWrap, (pressed || submitting) && styles.pressed]}>
              <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.primaryAction}>
                <Animated.View pointerEvents="none" style={[styles.primarySweep, { transform: [{ translateX: sweepX }, { rotate: '16deg' }] }]} />
                <View style={styles.primaryIconWrap}>
                  <Feather name={hasExistingProof ? 'edit-3' : 'send'} size={17} color="#FFFFFF" />
                </View>
                <View style={styles.primaryCopy}>
                  <Text style={[styles.primaryTitle, { fontFamily: t.typography.fontFamily.bold }]}>
                    {submitting ? (hasExistingProof ? 'Updating...' : 'Submitting...') : hasExistingProof ? 'Edit proof' : 'Submit proof'}
                  </Text>
                  <Text style={[styles.primaryText, { fontFamily: t.typography.fontFamily.medium }]}>
                    {hasExistingProof ? 'Save updated payment evidence' : 'Send proof for verification'}
                  </Text>
                </View>
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 150 },
  contentCompact: { paddingBottom: 136 },
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
    fontSize: 10,
    lineHeight: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    fontWeight: '800',
  },
  topTitle: {
    marginTop: 3,
    color: '#1A347F',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
  },
  topChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#F7FAFE',
    borderWidth: 1,
    borderColor: '#D6E2F4',
  },
  topChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1FCB7A',
  },
  topChipText: {
    color: '#16529A',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  heroCard: {
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#D6E2F3',
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
    backgroundColor: 'rgba(34, 112, 200, 0.1)',
  },
  heroGlowB: {
    position: 'absolute',
    bottom: -26,
    left: -12,
    width: 138,
    height: 138,
    borderRadius: 69,
    backgroundColor: 'rgba(22, 161, 136, 0.09)',
  },
  heroSweep: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 88,
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  heroHeaderRowCompact: {
    alignItems: 'flex-start',
    flexDirection: 'column',
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
    borderColor: '#D6E2F3',
  },
  heroPillCompact: {
    alignSelf: 'flex-start',
  },
  heroPillText: {
    color: '#1562B4',
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
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6E2F3',
  },
  heroSignalCompact: {
    alignSelf: 'flex-start',
  },
  heroSignalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1FCB7A',
  },
  heroSignalText: {
    color: '#118452',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  heroMain: {
    marginTop: 12,
    gap: 10,
  },
  heroMainCompact: {
    gap: 8,
  },
  heroMainRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  heroMainRowCompact: {
    gap: 8,
  },
  heroCopyBlock: { flex: 1 },
  heroCopyBlockCompact: {
    flex: 0,
    width: '56%',
  },
  heroTitle: {
    color: '#19367C',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
  },
  heroTitleCompact: {
    fontSize: 18,
    lineHeight: 20,
    maxWidth: 260,
  },
  heroBody: {
    marginTop: 6,
    color: '#50627F',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  heroBodyCompact: {
    fontSize: 11,
    lineHeight: 15,
    maxWidth: 300,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  heroStatsRowCompact: {
    gap: 8,
    marginTop: 8,
  },
  heroStatCard: {
    flex: 1,
    minHeight: 60,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7E2F4',
    justifyContent: 'center',
  },
  heroStatIcon: {
    width: 22,
    height: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  heroStatCardCompact: {
    minHeight: 62,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  heroStatIconCompact: {
    width: 18,
    height: 18,
    borderRadius: 7,
    marginBottom: 5,
  },
  heroStatValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  heroStatLabel: {
    marginTop: 4,
    color: '#6A7B97',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
  },
  heroStatLabelCompact: {
    marginTop: 3,
    textAlign: 'center',
  },
  heroVisual: {
    width: 128,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroVisualCompact: {
    width: 116,
    marginTop: -6,
    alignSelf: 'flex-start',
  },
  heroSheetBack: {
    position: 'absolute',
    width: 112,
    height: 146,
    borderRadius: 24,
    backgroundColor: '#EAF1FA',
    borderWidth: 1,
    borderColor: '#D3DFF2',
  },
  heroSheetBackCompact: {
    width: 104,
    height: 138,
  },
  heroSheetFront: {
    width: 120,
    borderRadius: 24,
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6E2F3',
  },
  heroSheetFrontCompact: {
    width: 112,
    minHeight: 138,
  },
  heroVisualTop: {
    flexDirection: 'row',
    gap: 10,
  },
  heroVisualIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#1765BA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroVisualTitle: {
    color: '#153172',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '900',
  },
  heroVisualSub: {
    marginTop: 4,
    color: '#6A7C97',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
  },
  heroTrack: {
    marginTop: 10,
    height: 36,
    justifyContent: 'center',
    position: 'relative',
  },
  heroTrackLine: {
    height: 2,
    borderRadius: 999,
    backgroundColor: '#D7E3F4',
  },
  heroTrackGlow: {
    position: 'absolute',
    left: 16,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(31, 203, 122, 0.2)',
  },
  heroTrackDot: {
    position: 'absolute',
    left: 19,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1FCB7A',
  },
  heroProofChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#F4F8FF',
    borderWidth: 1,
    borderColor: '#D7E3F4',
  },
  heroProofText: {
    color: '#486582',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    maxWidth: 96,
  },
  heroProofChipCompact: {
    alignSelf: 'stretch',
  },
  heroProofTextCompact: {
    maxWidth: '100%',
    flex: 1,
  },
  formCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D8E2F4',
    backgroundColor: 'rgba(249,251,254,0.94)',
    padding: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionEyebrow: {
    fontSize: 10,
    lineHeight: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '800',
  },
  sectionTitle: {
    marginTop: 3,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '900',
  },
  sectionTitleCompact: {
    fontSize: 16,
    lineHeight: 18,
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#EEF5FF',
    borderWidth: 1,
    borderColor: '#D8E6F8',
  },
  sectionBadgeText: {
    color: '#1768B8',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  inputWrap: {
    marginTop: 14,
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#BFCDEA',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  input: {
    fontSize: 14,
    lineHeight: 20,
    color: '#32497B',
    fontWeight: '700',
  },
  tipRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
  uploadCard: {
    marginTop: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D8E2F4',
    backgroundColor: 'rgba(249,251,254,0.94)',
    padding: 14,
  },
  uploadState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F4F8FF',
    borderWidth: 1,
    borderColor: '#D7E3F4',
  },
  uploadStateText: {
    color: '#1768B8',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  uploadRow: {
    marginTop: 14,
    minHeight: 86,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#C6D5EE',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },
  uploadIconBox: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#2A87DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadCopy: { flex: 1 },
  uploadText: {
    fontSize: 13,
    lineHeight: 16,
    color: '#33529A',
    fontWeight: '800',
  },
  fileText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 14,
    color: '#5D6F95',
    fontWeight: '600',
  },
  actionsWrap: {
    marginTop: 12,
  },
  primaryActionWrap: {
    borderRadius: 20,
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
  primaryCopy: { flex: 1 },
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
});
