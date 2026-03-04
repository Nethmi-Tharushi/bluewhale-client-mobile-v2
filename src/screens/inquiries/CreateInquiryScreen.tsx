import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';
import { Button, Card, Input, Screen } from '../../components/ui';
import { InquiriesService, UploadService } from '../../api/services';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InquiryStackParamList } from '../../navigation/app/AppNavigator';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<InquiryStackParamList, 'CreateInquiry'>;

export default function CreateInquiryScreen({ navigation, route }: Props) {
  const t = useTheme();
  const routeJobId = typeof route.params?.jobId === 'string' ? route.params.jobId.trim() : '';

  const [jobId, setJobId] = useState(routeJobId);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('General');
  const [message, setMessage] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    // Always sync form state with latest route param.
    setJobId(routeJobId || '');
  }, [routeJobId]);

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
      setSubject('');
      setCategory('General');
      setMessage('');
      setFileName(null);
      setAttachmentUrl(null);
      setJobId('');
      Alert.alert('Sent', 'Your inquiry has been created.');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen padded={false}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerWrap}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => navigation.canGoBack() && navigation.goBack()}
              style={[styles.backBtn, !navigation.canGoBack() && styles.backBtnHidden]}
              disabled={!navigation.canGoBack()}
            >
              <Feather name="arrow-left" size={18} color="#1B3890" />
            </Pressable>
            <View style={styles.headerTextWrap}>
              <Text style={[styles.h, { color: t.colors.primary }]}>Create Inquiry</Text>
              <Text style={[styles.p, { color: '#5E6F95' }]}>Message support/admin and track replies.</Text>
            </View>
          </View>
        </View>

        <Card style={styles.formCard}>
          <Input label="Job ID" value={jobId} onChangeText={setJobId} placeholder="Paste job ID" />
          <Input label="Subject (optional)" value={subject} onChangeText={setSubject} placeholder="Topic summary" />
          <Input label="Category" value={category} onChangeText={setCategory} placeholder="General / Payments / Documents" />
          <Input label="Message" value={message} onChangeText={setMessage} placeholder="Write your inquiry..." multiline />

          <View style={styles.attachCard}>
            <Text style={[styles.label, { color: '#1B233F' }]}>Attachment (optional)</Text>
            <View style={styles.attachRow}>
              <View style={styles.attachIcon}>
                <Feather name="paperclip" size={20} color="#2574CA" />
              </View>
              <Text style={[styles.file, { color: '#4D5F87' }]} numberOfLines={1}>
                {fileName || 'No file selected'}
              </Text>
            </View>
            <View style={{ height: 10 }} />
            <Button size="sm" title={uploading ? 'Uploading...' : 'Upload attachment'} onPress={pickAttachment} loading={uploading} />
          </View>

          <View style={{ height: 14 }} />
          <Button size="sm" title={submitting ? 'Submitting...' : 'Submit inquiry'} onPress={submit} loading={submitting} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 130 },
  headerWrap: { marginBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF2FF',
    borderWidth: 1,
    borderColor: '#C9D8F0',
    marginRight: 8,
  },
  backBtnHidden: { opacity: 0 },
  headerTextWrap: { flex: 1 },
  h: { fontSize: 22, lineHeight: 24, fontWeight: '900' },
  p: { marginTop: 3, fontWeight: '700', fontSize: 12, lineHeight: 16 },
  formCard: {
    borderRadius: 14,
    borderColor: '#D5DEF3',
    borderWidth: 1,
    backgroundColor: '#F8FAFC',
    shadowColor: '#5F82BA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  attachCard: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D3DEF3',
    backgroundColor: '#EEF4FE',
    padding: 10,
  },
  label: { fontWeight: '800', marginBottom: 6, fontSize: 13 },
  attachRow: { flexDirection: 'row', alignItems: 'center' },
  attachIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#C9D8F0',
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  file: { fontWeight: '700', flex: 1, fontSize: 12 },
});
