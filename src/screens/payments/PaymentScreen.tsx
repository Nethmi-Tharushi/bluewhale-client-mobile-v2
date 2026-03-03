import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '../../components/ui';
import { InvoicesService, UploadService } from '../../api/services';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InvoicesStackParamList } from '../../navigation/app/AppNavigator';

type Props = NativeStackScreenProps<InvoicesStackParamList, 'Payment'>;

export default function PaymentScreen({ navigation, route }: Props) {
  const { invoiceId } = route.params;

  const [reference, setReference] = useState('');
  const [slipName, setSlipName] = useState<string | null>(null);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasExistingProof, setHasExistingProof] = useState(false);

  const firstString = (values: any[]) => {
    for (const v of values) {
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  };

  const detectProof = (invoice: any) => {
    const proof = invoice?.paymentProof || invoice?.proof || invoice?.payment || invoice?.paymentDetails || {};
    const existingReference = firstString([
      invoice?.reference,
      invoice?.referenceNo,
      invoice?.paymentReference,
      invoice?.paymentRef,
      proof?.reference,
      proof?.referenceNo,
      proof?.paymentReference,
      proof?.paymentRef,
    ]);
    const existingSlipUrl = firstString([
      invoice?.slipUrl,
      invoice?.slip_url,
      invoice?.paymentSlipUrl,
      invoice?.attachmentUrl,
      invoice?.proofUrl,
      proof?.slipUrl,
      proof?.slip_url,
      proof?.paymentSlipUrl,
      proof?.attachmentUrl,
      proof?.proofUrl,
      proof?.url,
    ]);
    return { existingReference, existingSlipUrl };
  };

  useEffect(() => {
    (async () => {
      try {
        const inv = await InvoicesService.get(invoiceId);
        const { existingReference, existingSlipUrl } = detectProof(inv as any);
        if (existingReference) setReference(existingReference);
        if (existingSlipUrl) {
          setSlipUrl(existingSlipUrl);
          const name = existingSlipUrl.split('/').pop()?.split('?')[0] || 'Existing slip';
          setSlipName(name);
        }
        setHasExistingProof(Boolean(existingReference || existingSlipUrl));
      } catch {
        setHasExistingProof(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const pickSlip = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['image/*', 'application/pdf'],
    });
    if (res.canceled) return;
    const file = res.assets[0];
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
      await InvoicesService.markPaid(invoiceId, { reference: reference.trim() || undefined, slipUrl: slipUrl || undefined });
      Alert.alert(hasExistingProof ? 'Updated' : 'Submitted', hasExistingProof ? 'Payment proof updated successfully.' : 'Payment proof submitted. Status will update after verification.');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={36} color="#1B3890" />
          </Pressable>
          <Text style={styles.h}>Payment</Text>
        </View>
        <Text style={styles.p}>Submit proof of payment or pay via gateway.</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Reference <Text style={styles.optional}>(optional)</Text></Text>
          <View style={styles.inputWrap}>
            <TextInput
              value={reference}
              onChangeText={setReference}
              placeholder="Bank ref / Payment ref"
              placeholderTextColor="#5D6F95"
              style={styles.input}
            />
          </View>

          <View style={styles.slipCard}>
            <Text style={styles.slipTitle}>Payment slip</Text>
            <Pressable style={styles.uploadRow} onPress={pickSlip} disabled={uploading}>
              <View style={styles.uploadIconBox}>
                <Feather name="upload" size={26} color="#F6FAFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.uploadText}>{uploading ? 'Uploading...' : 'Upload slip'}</Text>
                <Text style={styles.file}>{slipName || 'No file uploaded'}</Text>
              </View>
            </Pressable>

            <Pressable onPress={submitProof} disabled={submitting} style={({ pressed }) => [pressed && { opacity: 0.92 }, submitting && { opacity: 0.7 }]}>
              <LinearGradient colors={['#1B3890', '#0F79C5']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.submitBtn}>
                <Text style={styles.submitText}>{submitting ? (hasExistingProof ? 'Updating...' : 'Submitting...') : hasExistingProof ? 'Edit proof' : 'Submit proof'}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 150, paddingTop: 8 },
  headerRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 50, alignItems: 'flex-start', justifyContent: 'center' },
  h: { fontSize: 50 / 2, lineHeight: 30, fontWeight: '900', color: '#1B3890', marginTop: 10 },
  p: { marginTop: 8, fontWeight: '600', fontSize: 15, color: '#58688D' },
  section: {
    marginTop: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D7E2F5',
    backgroundColor: 'rgba(255,255,255,0.45)',
    padding: 12,
  },
  label: { fontWeight: '900', marginBottom: 10, color: '#1B233F', fontSize: 16 },
  optional: { fontWeight: '700', color: '#5D6F95' },
  inputWrap: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#BFCDEA',
    backgroundColor: '#F7F9FD',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  input: { fontSize: 17, color: '#32497B', fontWeight: '700' },
  slipCard: {
    marginTop: 12,
    borderRadius: 24,
    backgroundColor: '#F7F9FC',
    padding: 12,
    borderWidth: 1,
    borderColor: '#D6E0F3',
  },
  slipTitle: { fontSize: 16, fontWeight: '900', color: '#1B233F', marginBottom: 10 },
  uploadRow: {
    minHeight: 84,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#BFCDEA',
    backgroundColor: '#F3F6FC',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  uploadIconBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#2A87DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: { fontSize: 15, fontWeight: '800', color: '#33529A' },
  file: { marginTop: 3, fontWeight: '600', fontSize: 13, color: '#5D6F95' },
  submitBtn: {
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
