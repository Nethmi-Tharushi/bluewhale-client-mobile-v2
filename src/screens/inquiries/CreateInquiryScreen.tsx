import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Button, Card, Input, Screen } from '../../components/ui';
import { InquiriesService, UploadService } from '../../api/services';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InquiryStackParamList } from '../../navigation/app/AppNavigator';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<InquiryStackParamList, 'CreateInquiry'>;

export default function CreateInquiryScreen({ navigation, route }: Props) {
  const t = useTheme();
  const jobIdFromRoute = route.params?.jobId;

  const [jobId, setJobId] = useState(jobIdFromRoute || '');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('General');
  const [message, setMessage] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pickAttachment = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (res.canceled) return;
    const file = res.assets[0];
    setUploading(true);
    try {
      const uploaded = await UploadService.uploadFile({ uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
      const url = (uploaded as any)?.url || (uploaded as any)?.fileUrl || (uploaded as any)?.path;
      if (!url) throw new Error('Upload response did not include a URL.');
      setAttachmentUrl(url);
      setFileName(file.name);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!jobId.trim()) {
      Alert.alert('Job required', 'Please provide a Job ID (or create inquiry from a job).');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Message required', 'Please write your inquiry message.');
      return;
    }

    setSubmitting(true);
    try {
      await InquiriesService.create(jobId.trim(), {
        subject: subject.trim() || undefined,
        category: category.trim() || 'General',
        message: message.trim(),
        attachmentUrl: attachmentUrl || undefined,
      });
      Alert.alert('Sent', 'Your inquiry has been created.');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Text style={[styles.h, { color: t.colors.primary }]}>Create Inquiry</Text>
        <Text style={[styles.p, { color: t.colors.textMuted }]}>Message support/admin and track replies.</Text>

        <View style={{ height: 12 }} />
        <Input label="Job ID" value={jobId} onChangeText={setJobId} placeholder="Paste job ID" />
        <Input label="Subject (optional)" value={subject} onChangeText={setSubject} placeholder="Topic summary" />
        <Input label="Category" value={category} onChangeText={setCategory} placeholder="General / Payments / Documents" />
        <Input label="Message" value={message} onChangeText={setMessage} placeholder="Write your inquiry..." multiline />

        <Text style={[styles.label, { color: t.colors.text }]}>Attachment (optional)</Text>
        <Text style={[styles.file, { color: t.colors.text }]}>{fileName || 'No file selected'}</Text>
        <View style={{ height: 10 }} />
        <Button title={uploading ? 'Uploading...' : 'Upload attachment'} onPress={pickAttachment} loading={uploading} />

        <View style={{ height: 14 }} />
        <Button title={submitting ? 'Submitting...' : 'Submit inquiry'} onPress={submit} loading={submitting} />
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
