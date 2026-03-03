import React, { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { Button, Card, Input, Screen } from '../../components/ui';
import { InvoicesService } from '../../api/services';
import { API_BASE_URL } from '../../config/api';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InvoicesStackParamList } from '../../navigation/app/AppNavigator';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<InvoicesStackParamList, 'Payment'>;

export default function PaymentScreen({ navigation, route }: Props) {
  const t = useTheme();
  const { invoiceId, hasProof = false, existingReference = '', existingNotes = '' } = route.params;

  const [reference, setReference] = useState(existingReference);
  const [notes, setNotes] = useState(existingNotes);
  const [slipName, setSlipName] = useState<string | null>(null);
  const [slipFile, setSlipFile] = useState<{ uri: string; name: string; type?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickSlip = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['image/*', 'application/pdf'],
    });
    if (res.canceled) return;
    const file = res.assets[0];
    setSlipName(file.name);
    setSlipFile({
      uri: file.uri,
      name: file.name || `payment-slip-${Date.now()}`,
      type: file.mimeType || 'application/octet-stream',
    });
  };

  const submitProof = async () => {
    if (!reference.trim() && !notes.trim() && !slipFile) {
      Alert.alert('Missing proof', 'Please add reference, notes, or a payment slip.');
      return;
    }
    setSubmitting(true);
    try {
      await InvoicesService.markPaid(invoiceId, {
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        file: slipFile || undefined,
      });
      Alert.alert(hasProof ? 'Updated' : 'Submitted', hasProof ? 'Payment proof updated.' : 'Payment proof submitted. Status will update after verification.');
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
        <Text style={[styles.h, { color: t.colors.primary }]}>{hasProof ? 'Edit payment proof' : 'Payment'}</Text>
        <Text style={[styles.p, { color: t.colors.textMuted }]}>
          {hasProof ? 'Update your previously submitted proof details.' : 'Submit proof or continue with payment gateway.'}
        </Text>

        <View style={{ height: 12 }} />
        <Input label="Reference (optional)" value={reference} onChangeText={setReference} placeholder="Bank ref / Payment ref" />
        <Input label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Any extra payment details" multiline />

        <Text style={[styles.label, { color: t.colors.text }]}>Payment slip (optional)</Text>
        <Text style={[styles.file, { color: t.colors.text }]}>{slipName || (hasProof ? 'Previously submitted slip' : 'No file selected')}</Text>
        <View style={{ height: 10 }} />
        <Button title={hasProof ? 'Replace slip' : 'Choose slip'} onPress={pickSlip} />

        <View style={{ height: 14 }} />
        <Button title={submitting ? (hasProof ? 'Updating...' : 'Submitting...') : hasProof ? 'Update proof' : 'Submit proof'} onPress={submitProof} loading={submitting} />

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
