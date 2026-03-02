import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Button, Card, Input, Screen } from '../../components/ui';
import { Spacing } from '../../constants/theme';
import { ApplicationsService, UploadService } from '../../api/services';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { JobsStackParamList } from '../../navigation/app/AppNavigator';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<JobsStackParamList, 'ApplyJob'>;

export default function ApplyJobScreen({ navigation, route }: Props) {
  const t = useTheme();
  const { jobId } = route.params;

  const [note, setNote] = useState('');
  const [cvName, setCvName] = useState<string | null>(null);
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pickCv = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    });
    if (res.canceled) return;
    const file = res.assets[0];
    setUploading(true);
    try {
      const uploaded = await UploadService.uploadFile({ uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
      const url =
        (typeof uploaded === 'string' ? uploaded : undefined) ||
        (uploaded as any)?.url ||
        (uploaded as any)?.fileUrl ||
        (uploaded as any)?.path ||
        (uploaded as any)?.location ||
        (uploaded as any)?.secure_url;
      if (!url) throw new Error('Upload response did not include a URL.');
      setCvUrl(url);
      setCvName(file.name);
    } catch (e: any) {
      const reason = e?.userMessage || e?.message || 'Please try again';
      Alert.alert('Upload failed', `${reason}\n\nFile: ${file.name} (${file.mimeType || 'unknown type'})`);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!cvUrl) {
      Alert.alert('CV required', 'Please upload your CV first.');
      return;
    }
    setSubmitting(true);
    try {
      await ApplicationsService.apply(jobId, { note: note.trim() || undefined, cvUrl });
      Alert.alert('Submitted', 'Your application has been submitted successfully.');
      navigation.popToTop();
      (navigation.getParent() as any)?.navigate('Applications');
    } catch (e: any) {
      Alert.alert('Submit failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Text style={[styles.h, { color: t.colors.primary }]}>Apply to this job</Text>
        <Text style={[styles.p, { color: t.colors.textMuted }]}>Upload your CV and add a short note.</Text>

        <View style={{ height: Spacing.sm }} />
        <Input label="Cover note (optional)" value={note} onChangeText={setNote} placeholder="Why are you a strong fit?" multiline />

        <Text style={[styles.label, { color: t.colors.text }]}>CV file</Text>
        <Text style={[styles.cvName, { color: t.colors.text }]}>{cvName ? cvName : 'No file selected'}</Text>
        <View style={{ height: 10 }} />
        <Button title={uploading ? 'Uploading...' : 'Upload CV'} onPress={pickCv} loading={uploading} />

        <View style={{ height: 12 }} />
        <Button title={submitting ? 'Submitting...' : 'Submit application'} onPress={submit} loading={submitting} disabled={!cvUrl} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h: { fontSize: 22, fontWeight: '900' },
  p: { fontWeight: '700', marginTop: 6 },
  label: { fontWeight: '800', marginTop: 8, marginBottom: 4 },
  cvName: { fontWeight: '700' },
});
