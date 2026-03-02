import React, { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { Button, Card, Input, Screen } from '../../components/ui';
import { InvoicesService, UploadService } from '../../api/services';
import { API_BASE_URL } from '../../config/api';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InvoicesStackParamList } from '../../navigation/app/AppNavigator';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<InvoicesStackParamList, 'Payment'>;

export default function PaymentScreen({ navigation, route }: Props) {
  const t = useTheme();
  const { invoiceId } = route.params;

  const [reference, setReference] = useState('');
  const [slipName, setSlipName] = useState<string | null>(null);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      Alert.alert('Submitted', 'Payment proof submitted. Status will update after verification.');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setSubmitting(false);
    }
  };

  const openExternalUrl = async (targetUrl: string) => {
    try {
      await WebBrowser.openBrowserAsync(targetUrl);
      return;
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (!msg.toLowerCase().includes('no matching browser activity found')) throw err;
    }
    try {
      await Linking.openURL(targetUrl);
    } catch {
      throw new Error('Unable to open browser on this device/emulator.');
    }
  };

  const openGateway = async () => {
    const url = `${API_BASE_URL.replace(/\/$/, '')}/payments/initiate?invoiceId=${encodeURIComponent(invoiceId)}`;
    try {
      await openExternalUrl(url);
    } catch (e: any) {
      Alert.alert('Unable to open payment page', e?.userMessage || e?.message || 'Please try again');
    }
  };

  return (
    <Screen>
      <Card>
        <Text style={[styles.h, { color: t.colors.primary }]}>Payment</Text>
        <Text style={[styles.p, { color: t.colors.textMuted }]}>Submit proof or continue with payment gateway.</Text>

        <View style={{ height: 12 }} />
        <Input label="Reference (optional)" value={reference} onChangeText={setReference} placeholder="Bank ref / Payment ref" />

        <Text style={[styles.label, { color: t.colors.text }]}>Payment slip (optional)</Text>
        <Text style={[styles.file, { color: t.colors.text }]}>{slipName || 'No file selected'}</Text>
        <View style={{ height: 10 }} />
        <Button title={uploading ? 'Uploading...' : 'Upload slip'} onPress={pickSlip} loading={uploading} />

        <View style={{ height: 14 }} />
        <Button title={submitting ? 'Submitting...' : 'Submit proof'} onPress={submitProof} loading={submitting} />

        <View style={{ height: 10 }} />
        <Button title="Pay via gateway (optional)" variant="ghost" onPress={openGateway} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h: { fontSize: 22, fontWeight: '900' },
  p: { marginTop: 6, fontWeight: '700' },
  label: { marginTop: 4, fontWeight: '800', marginBottom: 4 },
  file: { fontWeight: '700' },
});
