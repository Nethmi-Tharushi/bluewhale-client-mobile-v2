import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Input, Screen } from '../../components/ui';
import { InquiriesService, UploadService } from '../../api/services';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InquiryStackParamList } from '../../navigation/app/AppNavigator';
import { useTheme } from '../../theme/ThemeProvider';
import { ensureUploadSizeWithinLimit } from '../../utils/uploadValidation';
import { useAuthStore } from '../../context/authStore';
import { getManagedCandidate, getManagedCandidateId, getManagedCandidateName, isManagedViewActive } from '../../utils/managedView';

type Props = NativeStackScreenProps<InquiryStackParamList, 'CreateInquiry'>;

export default function CreateInquiryScreen({ navigation, route }: Props) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const routeJobId = typeof route.params?.jobId === 'string' ? route.params.jobId.trim() : '';
  const user = useAuthStore((state) => state.user);

  const role = String(user?.userType || user?.role || '').toLowerCase();
  const agentMode = role.includes('agent');
  const managedMode = useMemo(() => isManagedViewActive(user), [user]);
  const managedCandidate = useMemo(() => getManagedCandidate(user), [user]);
  const managedCandidateId = useMemo(() => getManagedCandidateId(user), [user]);
  const managedCandidateName = useMemo(() => getManagedCandidateName(user), [user]);
  const managedCandidateEmail = String(managedCandidate?.email || '').trim();
  const defaultEmail = useMemo(
    () => String((managedMode ? managedCandidateEmail : user?.email) || '').trim(),
    [managedCandidateEmail, managedMode, user?.email]
  );
  const canUseJobInquiryFlow = managedMode || !agentMode;
  const openManagedCandidates = () => (navigation.getParent() as any)?.navigate('Candidates');

  const [jobId, setJobId] = useState(routeJobId);
  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const heroEntrance = useRef(new Animated.Value(0)).current;
  const formEntrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setJobId(routeJobId || '');
  }, [routeJobId]);

  useEffect(() => {
    setEmail(defaultEmail);
  }, [defaultEmail]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroEntrance, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(formEntrance, {
        toValue: 1,
        duration: 760,
        delay: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
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
          Animated.timing(float, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(float, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(sweep, { toValue: 1, duration: 2300, delay: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ),
    ];

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [float, formEntrance, heroEntrance, pulse, sweep]);

  const heroY = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const sectionY = formEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.48] });
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-180, 260] });

  const heroTitle = managedMode ? `Make Inquiry as ${managedCandidateName}` : 'Create Job Inquiry';
  const heroSubtitle = managedMode
    ? 'Send this question from managed candidate view while staying on the agent session.'
    : 'Ask about a specific role and keep the full thread under your inquiry history.';
  const replyRouteLabel = managedMode ? 'Reply route' : 'Thread mode';
  const replyRouteValue = managedMode ? 'Agent email' : 'Candidate inbox';
  const emailLabel = managedMode ? 'Managed candidate email' : 'Email';
  const jobLinked = Boolean(routeJobId);

  const heroStats = [
    {
      key: 'job',
      value: jobLinked ? 'Linked' : jobId.trim() ? 'Added' : 'Needed',
      label: 'Job',
      color: '#1768B8',
      icon: 'briefcase' as const,
      iconBg: '#EAF2FF',
    },
    {
      key: 'sender',
      value: managedMode ? 'Managed' : agentMode ? 'Agent' : 'Candidate',
      label: 'Sender',
      color: '#7A44E2',
      icon: 'user-check' as const,
      iconBg: '#F2EAFF',
    },
    {
      key: 'reply',
      value: managedMode ? 'Agent' : 'Thread',
      label: 'Replies',
      color: '#118D4C',
      icon: 'corner-down-left' as const,
      iconBg: '#EAF8F0',
    },
  ];

  const pickAttachment = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
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
      setAttachmentUrl(url);
      setFileName(file.name);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!canUseJobInquiryFlow) {
      Alert.alert('Switch required', 'Open a managed candidate first, then use Switch to Candidate View before sending a job inquiry.');
      return;
    }
    if (!jobId.trim()) {
      Alert.alert('Job required', 'Please provide a Job ID or open this form from a specific job.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Email required', 'Please confirm the sender email before submitting.');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Message required', 'Please write your inquiry message.');
      return;
    }

    setSubmitting(true);
    try {
      await InquiriesService.create(jobId.trim(), {
        email: email.trim(),
        subject: subject.trim() || undefined,
        message: message.trim(),
        attachmentUrl: attachmentUrl || undefined,
        managedCandidateId: managedMode ? managedCandidateId || undefined : undefined,
      });
      setSubject('');
      setMessage('');
      setFileName(null);
      setAttachmentUrl(null);
      setJobId(routeJobId || '');
      setEmail(defaultEmail);
      Alert.alert('Inquiry sent', managedMode ? `Inquiry submitted for ${managedCandidateName}.` : 'Your inquiry has been sent.');
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
        <Animated.View style={[styles.headerWrap, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
          <Pressable
            onPress={() => navigation.canGoBack() && navigation.goBack()}
            style={({ pressed }) => [styles.backBtn, !navigation.canGoBack() && styles.backBtnHidden, pressed && styles.pressed]}
            disabled={!navigation.canGoBack()}
          >
            <Feather name="arrow-left" size={18} color="#1B3890" />
          </Pressable>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.eyebrow, { fontFamily: t.typography.fontFamily.bold }]}>JOB INQUIRY FLOW</Text>
            <Text style={[styles.h, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]}>{heroTitle}</Text>
            <Text style={[styles.p, { color: '#5E6F95', fontFamily: t.typography.fontFamily.medium }]}>{heroSubtitle}</Text>
          </View>
          <View style={styles.liveChip}>
            <Animated.View style={[styles.liveDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
            <Text style={[styles.liveText, { fontFamily: t.typography.fontFamily.bold }]}>{submitting ? 'Sending' : managedMode ? 'Managed' : 'Draft'}</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.heroCard, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
          <View style={styles.heroGlowA} />
          <Animated.View style={[styles.heroGlowB, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
          <Animated.View style={[styles.heroSweep, { transform: [{ translateX: sweepX }, { rotate: '18deg' }] }]} />

          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Feather name="message-square" size={13} color="#1768B8" />
              <Text style={[styles.heroBadgeText, { fontFamily: t.typography.fontFamily.bold }]}>{managedMode ? 'Managed candidate view' : 'Candidate inquiry'}</Text>
            </View>
            <View style={styles.heroSignal}>
              <Feather name="corner-down-right" size={13} color="#118D4C" />
              <Text style={[styles.heroSignalText, { fontFamily: t.typography.fontFamily.bold }]}>{replyRouteValue}</Text>
            </View>
          </View>

          <View style={[styles.heroMain, compact && styles.heroMainCompact]}>
            <View style={styles.heroCopyBlock}>
              <Text style={[styles.heroTitleText, { fontFamily: t.typography.fontFamily.bold }]}>Ask about one role with the right candidate context.</Text>
              <Text style={[styles.heroBody, { fontFamily: t.typography.fontFamily.medium }]}>
                {managedMode
                  ? `This inquiry will include ${managedCandidateName}'s managed candidate context and send replies back to the agent account.`
                  : 'Use the linked role and a clear message so support can reply in the same inquiry thread.'}
              </Text>

              <View style={styles.heroStatsRow}>
                {heroStats.map((item) => (
                  <View key={item.key} style={styles.heroStatCard}>
                    <View style={[styles.heroStatIcon, { backgroundColor: item.iconBg }]}>
                      <Feather name={item.icon} size={12} color={item.color} />
                    </View>
                    <Text style={[styles.heroStatValue, { color: item.color, fontFamily: t.typography.fontFamily.bold }]}>{item.value}</Text>
                    <Text style={[styles.heroStatLabel, { fontFamily: t.typography.fontFamily.medium }]}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Animated.View style={[styles.heroVisual, { transform: [{ translateY: floatY }] }]}>
              <View style={styles.heroVisualPanel}>
                <View style={styles.heroBubblePrimary}>
                  <Feather name="hash" size={12} color="#1768B8" />
                  <Text style={[styles.heroBubblePrimaryText, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                    {jobId || 'Job ID required'}
                  </Text>
                </View>
                <View style={styles.heroBubbleSecondary}>
                  <Text style={[styles.heroBubbleSecondaryText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                    {managedMode ? managedCandidateName : email || 'Sender email'}
                  </Text>
                </View>
                <View style={styles.heroTimeline}>
                  <View style={[styles.heroTimelineBar, styles.heroTimelineBarWide]} />
                  <View style={[styles.heroTimelineBar, styles.heroTimelineBarMid]} />
                  <View style={[styles.heroTimelineBar, styles.heroTimelineBarShort]} />
                </View>
                <View style={styles.heroFooterChip}>
                  <Feather name="send" size={12} color="#118D4C" />
                  <Text style={[styles.heroFooterChipText, { fontFamily: t.typography.fontFamily.bold }]}>{replyRouteLabel}: {replyRouteValue}</Text>
                </View>
              </View>
            </Animated.View>
          </View>
        </Animated.View>

        {!canUseJobInquiryFlow ? (
          <Animated.View style={[styles.guardCard, { opacity: formEntrance, transform: [{ translateY: sectionY }] }]}>
            <View style={styles.guardIconWrap}>
              <Feather name="shuffle" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.guardCopy}>
              <Text style={[styles.guardTitle, { fontFamily: t.typography.fontFamily.bold }]}>Switch to Candidate View first</Text>
              <Text style={[styles.guardText, { fontFamily: t.typography.fontFamily.medium }]}>
                Agent job inquiries are only available while you are inside a managed candidate workspace. Open a candidate from Managed Candidates, tap Switch to Candidate View, then come back to the job.
              </Text>
              <Pressable onPress={openManagedCandidates} style={({ pressed }) => [styles.switchCandidateBtn, styles.switchCandidateBtnWarm, pressed && styles.pressed]}>
                <View style={styles.switchCandidateMain}>
                  <View style={[styles.switchCandidateIconWrap, styles.switchCandidateIconWrapWarm]}>
                    <Feather name="users" size={16} color="#FFFFFF" />
                  </View>
                  <View style={styles.switchCandidateCopy}>
                    <Text style={[styles.switchCandidateText, styles.switchCandidateTextWarm, { fontFamily: t.typography.fontFamily.bold }]}>Open Managed Candidates</Text>
                    <Text style={[styles.switchCandidateSubtext, styles.switchCandidateSubtextWarm, { fontFamily: t.typography.fontFamily.medium }]}>Choose a candidate and switch profile first</Text>
                  </View>
                  <Feather name="arrow-right" size={16} color="#FFFFFF" />
                </View>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}

        <Animated.View style={[styles.formCard, { opacity: formEntrance, transform: [{ translateY: sectionY }] }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>THREAD DETAILS</Text>
              <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Inquiry Form</Text>
            </View>
            <View style={styles.sectionChip}>
              <Feather name="life-buoy" size={12} color="#FFFFFF" />
              <Text style={[styles.sectionChipText, { fontFamily: t.typography.fontFamily.bold }]}>Job support</Text>
            </View>
          </View>

          {managedMode ? (
            <View style={styles.contextCard}>
              <View style={styles.contextRow}>
                <View style={styles.contextIconWrap}>
                  <Feather name="user-check" size={16} color="#FFFFFF" />
                </View>
                <View style={styles.contextCopy}>
                  <Text style={[styles.contextTitle, { fontFamily: t.typography.fontFamily.bold }]}>{managedCandidateName}</Text>
                  <Text style={[styles.contextText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={2}>
                    This inquiry will be submitted as a B2B managed candidate inquiry using your agent session.
                  </Text>
                </View>
              </View>
              <View style={styles.contextMetaRow}>
                <View style={styles.contextMetaChip}>
                  <Feather name="mail" size={12} color="#1768B8" />
                  <Text style={[styles.contextMetaText, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{managedCandidateEmail || 'Email not available'}</Text>
                </View>
                <View style={styles.contextMetaChip}>
                  <Feather name="repeat" size={12} color="#118D4C" />
                  <Text style={[styles.contextMetaText, { fontFamily: t.typography.fontFamily.bold }]}>Replies to agent</Text>
                </View>
              </View>
              <Pressable onPress={openManagedCandidates} style={({ pressed }) => [styles.switchCandidateBtn, pressed && styles.pressed]}>
                <View style={styles.switchCandidateMain}>
                  <View style={styles.switchCandidateIconWrap}>
                    <Feather name="refresh-cw" size={16} color="#FFFFFF" />
                  </View>
                  <View style={styles.switchCandidateCopy}>
                    <Text style={[styles.switchCandidateText, { fontFamily: t.typography.fontFamily.bold }]}>Switch candidate profile</Text>
                    <Text style={[styles.switchCandidateSubtext, { fontFamily: t.typography.fontFamily.medium }]}>Open Managed Candidates and change the active profile</Text>
                  </View>
                  <Feather name="arrow-right" size={16} color="#FFFFFF" />
                </View>
              </Pressable>
            </View>
          ) : null}

          <Input
            label="Job ID"
            value={jobId}
            onChangeText={setJobId}
            placeholder="Paste job ID"
            editable={!jobLinked}
          />
          {jobLinked ? <Text style={[styles.fieldHint, { fontFamily: t.typography.fontFamily.medium }]}>Linked from the selected job details page.</Text> : null}
          <Input label={emailLabel} value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" />
          <Input label="Subject (optional)" value={subject} onChangeText={setSubject} placeholder="Short reason for the inquiry" />
          <Input label="Message" value={message} onChangeText={setMessage} placeholder="Write your inquiry..." multiline />

          <View style={styles.attachCard}>
            <View style={styles.attachHeader}>
              <View>
                <Text style={[styles.label, { color: '#1B233F', fontFamily: t.typography.fontFamily.bold }]}>Attachment</Text>
                <Text style={[styles.attachHint, { fontFamily: t.typography.fontFamily.medium }]}>Optional proof to give support extra context.</Text>
              </View>
              <View style={styles.attachState}>
                <Text style={[styles.attachStateText, { fontFamily: t.typography.fontFamily.bold }]}>{fileName ? 'Added' : 'Optional'}</Text>
              </View>
            </View>

            <View style={styles.attachRow}>
              <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 1 }} style={styles.attachIcon}>
                <Feather name="paperclip" size={18} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.attachCopy}>
                <Text style={[styles.file, { color: '#21345A', fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                  {fileName || 'No file selected'}
                </Text>
                <Text style={[styles.fileSub, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={2}>
                  {attachmentUrl ? 'Uploaded and ready to send with this inquiry' : 'You can attach screenshots, documents, or proofs if support needs more detail'}
                </Text>
              </View>
            </View>
            <View style={styles.attachButtonWrap}>
              <Button size="sm" title={uploading ? 'Uploading...' : 'Upload attachment'} onPress={pickAttachment} loading={uploading} />
            </View>
          </View>

          <View style={styles.submitWrap}>
            <Button
              size="sm"
              title={submitting ? 'Submitting...' : managedMode ? 'Send inquiry as managed candidate' : 'Send inquiry'}
              onPress={submit}
              loading={submitting}
              disabled={!canUseJobInquiryFlow}
            />
          </View>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 130 },
  pressed: { opacity: 0.92 },
  headerWrap: { marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#D1DEF3',
  },
  backBtnHidden: { opacity: 0 },
  headerTextWrap: { flex: 1 },
  eyebrow: {
    color: '#7485A8',
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 2.1,
    fontWeight: '900',
  },
  h: { marginTop: 3, fontSize: 20, lineHeight: 24, fontWeight: '900' },
  p: { marginTop: 4, fontWeight: '700', fontSize: 10, lineHeight: 15 },
  liveChip: {
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 13,
    backgroundColor: '#F7FAFF',
    borderWidth: 1,
    borderColor: '#D4E0F2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1FCB7A',
  },
  liveText: { color: '#1B4B98', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#D3DFF3',
    backgroundColor: '#F9FBFF',
    padding: 16,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#4A6EAE',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  heroGlowA: {
    position: 'absolute',
    top: -70,
    right: -22,
    width: 188,
    height: 188,
    borderRadius: 94,
    backgroundColor: 'rgba(76, 139, 255, 0.12)',
  },
  heroGlowB: {
    position: 'absolute',
    bottom: -26,
    left: -18,
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(91, 214, 190, 0.12)',
  },
  heroSweep: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 86,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D7E2F4',
    backgroundColor: '#FFFFFF',
  },
  heroBadgeText: {
    color: '#1768B8',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroSignal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D7EAD9',
    backgroundColor: '#FFFFFF',
  },
  heroSignalText: { color: '#118D4C', fontSize: 10, lineHeight: 13, fontWeight: '800' },
  heroMain: { marginTop: 16, flexDirection: 'row', gap: 14 },
  heroMainCompact: { gap: 10 },
  heroCopyBlock: { flex: 1 },
  heroTitleText: { color: '#153375', fontSize: 22, lineHeight: 26, fontWeight: '900', maxWidth: 236 },
  heroBody: { marginTop: 8, color: '#5D7096', fontSize: 11, lineHeight: 16, fontWeight: '700', maxWidth: 236 },
  heroStatsRow: { marginTop: 14, flexDirection: 'row', gap: 9 },
  heroStatCard: {
    flex: 1,
    minHeight: 76,
    minWidth: 100,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7E2F4',
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  heroStatIcon: { width: 22, height: 22, borderRadius: 8, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 4 },
  heroStatValue: { fontSize: 16, lineHeight: 19, fontWeight: '900', textAlign: 'center' },
  heroStatLabel: { color: '#657B9E', fontSize: 9, lineHeight: 11, fontWeight: '700', textAlign: 'center' },
  heroVisual: {
    width: 154,
    alignItems: 'stretch',
    height: 154,
  },
  heroVisualPanel: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E2F3',
    padding: 14,
    shadowColor: '#4168A8',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    overflow: 'hidden',
  },
  heroBubblePrimary: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: '#F2F7FF',
    borderWidth: 1,
    borderColor: '#D8E4F5',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
  },
  heroBubblePrimaryText: {
    color: '#1768B8',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
  heroBubbleSecondary: {
    marginTop: 10,
    minHeight: 30,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE7F8',
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  heroBubbleSecondaryText: {
    color: '#6B7EA5',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
  },
  heroTimeline: { marginTop: 14, gap: 8 },
  heroTimelineBar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#DAE6F8',
  },
  heroTimelineBarWide: { width: '92%' },
  heroTimelineBarMid: { width: '72%' },
  heroTimelineBarShort: { width: '48%' },
  heroFooterChip: {
    marginTop: 14,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F2FCF8',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroFooterChipText: { color: '#118D4C', fontSize: 9, lineHeight: 11, fontWeight: '800' },
  guardCard: {
    borderRadius: 22,
    backgroundColor: '#FFF8EC',
    borderWidth: 1,
    borderColor: '#F2D6A2',
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  guardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0DAB1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guardCopy: { flex: 1 },
  guardTitle: { color: '#9D5F0D', fontSize: 14, lineHeight: 17, fontWeight: '900' },
  guardText: { marginTop: 5, color: '#7D6440', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  switchCandidateBtn: {
    marginTop: 10,
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#145DCC',
    borderWidth: 1,
    borderColor: '#145DCC',
    alignSelf: 'stretch',
    shadowColor: '#145DCC',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  switchCandidateBtnWarm: {
    borderColor: '#D18414',
    backgroundColor: '#D18414',
    shadowColor: '#D18414',
  },
  switchCandidateMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  switchCandidateIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchCandidateIconWrapWarm: {
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  switchCandidateCopy: { flex: 1 },
  switchCandidateText: { color: '#FFFFFF', fontSize: 12, lineHeight: 15, fontWeight: '800' },
  switchCandidateTextWarm: { color: '#FFFFFF' },
  switchCandidateSubtext: { marginTop: 2, color: 'rgba(255,255,255,0.82)', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  switchCandidateSubtextWarm: { color: 'rgba(255,248,235,0.92)' },
  formCard: {
    borderRadius: 22,
    backgroundColor: 'rgba(249,251,255,0.96)',
    borderWidth: 1,
    borderColor: '#D6E0F3',
    padding: 14,
    shadowColor: '#5373AA',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  sectionEyebrow: {
    color: '#7485A8',
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 1.9,
    fontWeight: '900',
  },
  sectionTitle: { marginTop: 3, color: '#153375', fontSize: 15, lineHeight: 18, fontWeight: '900' },
  sectionChip: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#D5E0F4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionChipText: { color: '#1D5FD2', fontSize: 9, lineHeight: 11, fontWeight: '800' },
  contextCard: {
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D6E0F4',
    backgroundColor: '#F4F8FF',
    padding: 12,
    gap: 10,
  },
  contextRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  contextIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextCopy: { flex: 1 },
  contextTitle: { color: '#173271', fontSize: 14, lineHeight: 17, fontWeight: '900' },
  contextText: { marginTop: 4, color: '#5E7198', fontSize: 10, lineHeight: 15, fontWeight: '700' },
  contextMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  contextMetaChip: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6E0F4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  contextMetaText: { color: '#28508E', fontSize: 9, lineHeight: 11, fontWeight: '800', flexShrink: 1 },
  fieldHint: { marginTop: -6, marginBottom: 10, color: '#7588AD', fontSize: 10, lineHeight: 14, fontWeight: '700' },
  attachCard: {
    marginTop: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D6E0F4',
    backgroundColor: '#F4F8FF',
    padding: 12,
  },
  attachHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  label: { fontWeight: '800', marginBottom: 3, fontSize: 12, lineHeight: 15 },
  attachHint: { color: '#6D81A7', fontSize: 10, lineHeight: 14, fontWeight: '600', maxWidth: 220 },
  attachState: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6E0F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachStateText: { color: '#1D5FD2', fontSize: 9, lineHeight: 11, fontWeight: '800' },
  attachRow: { flexDirection: 'row', alignItems: 'center' },
  attachIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  attachCopy: { flex: 1 },
  file: { fontWeight: '700', flex: 1, fontSize: 11, lineHeight: 14 },
  fileSub: { marginTop: 2, color: '#7184AA', fontSize: 9, lineHeight: 11, fontWeight: '600' },
  attachButtonWrap: { marginTop: 12 },
  submitWrap: { marginTop: 14 },
});
