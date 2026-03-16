import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Card, Input, Screen } from '../../components/ui';
import { ApplicationsService, JobsService, UploadService } from '../../api/services';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { JobsStackParamList } from '../../navigation/app/AppNavigator';
import { useTheme } from '../../theme/ThemeProvider';
import { ensureUploadSizeWithinLimit } from '../../utils/uploadValidation';

type Props = NativeStackScreenProps<JobsStackParamList, 'ApplyJob'>;

export default function ApplyJobScreen({ navigation, route }: Props) {
  const t = useTheme();
  const { height } = useWindowDimensions();
  const { jobId } = route.params;
  const compact = height < 760;
  const scrollRef = useRef<any>(null);
  const noteSectionY = useRef(0);
  const uploadSectionY = useRef(0);
  const sendSectionY = useRef(0);

  const [note, setNote] = useState('');
  const [cvName, setCvName] = useState<string | null>(null);
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [jobTitle, setJobTitle] = useState('Job role');

  const heroEntrance = useRef(new Animated.Value(0)).current;
  const cardEntrance = useRef(new Animated.Value(0)).current;
  const actionEntrance = useRef(new Animated.Value(0)).current;
  const orbFloat = useRef(new Animated.Value(0)).current;
  const shimmerTranslate = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const ctaPulse = useRef(new Animated.Value(1)).current;
  const stepDrift = useRef(new Animated.Value(0)).current;
  const sheetLift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        const job: any = await JobsService.get(jobId);
        const title =
          (typeof job?.title === 'string' && job.title.trim()) ||
          (typeof job?.jobTitle === 'string' && job.jobTitle.trim()) ||
          (typeof job?.position === 'string' && job.position.trim()) ||
          '';
        setJobTitle(title || 'Job role');
      } catch {
        setJobTitle('Job role');
      }
    })();
  }, [jobId]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroEntrance, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardEntrance, {
        toValue: 1,
        duration: 720,
        delay: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(actionEntrance, {
        toValue: 1,
        duration: 760,
        delay: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(orbFloat, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(orbFloat, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerTranslate, { toValue: 1, duration: 2200, delay: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(shimmerTranslate, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(ctaPulse, { toValue: 1.02, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(ctaPulse, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(stepDrift, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(stepDrift, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(sheetLift, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(sheetLift, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
    ];

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [actionEntrance, cardEntrance, ctaPulse, heroEntrance, orbFloat, pulse, sheetLift, shimmerTranslate, stepDrift]);

  const pickCv = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
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
      (navigation.getParent() as any)?.navigate('Jobs');
    } catch (e: any) {
      Alert.alert('Submit failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setSubmitting(false);
    }
  };

  const heroTranslateY = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [26, 0] });
  const cardsTranslateY = cardEntrance.interpolate({ inputRange: [0, 1], outputRange: [30, 0] });
  const actionsTranslateY = actionEntrance.interpolate({ inputRange: [0, 1], outputRange: [34, 0] });
  const orbTranslateY = orbFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const shimmerX = shimmerTranslate.interpolate({ inputRange: [0, 1], outputRange: [-180, 220] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.36] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const stepFloatY = stepDrift.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const sheetFloatY = sheetLift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const statusTitle = cvUrl ? 'CV attached' : uploading ? 'Uploading CV' : 'Ready to submit';
  const statusCopy = cvUrl
    ? 'Your document is ready. Review your note and send the application.'
    : uploading
      ? 'We are preparing your document for submission.'
      : 'Add your CV and a short note to complete the application.';

  const scrollToSection = (offset: number) => {
    const targetY = Math.max(0, offset - 16);
    scrollRef.current?.scrollTo?.({ y: targetY, animated: true });
    scrollRef.current?.getNode?.().scrollTo?.({ y: targetY, animated: true });
  };

  return (
    <Screen keyboard>
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, compact && styles.contentCompact]}
      >
        <Animated.View style={[styles.heroShell, { opacity: heroEntrance, transform: [{ translateY: heroTranslateY }] }]}>
          <View style={[styles.heroSurface, compact && styles.heroSurfaceCompact]}>
            <View style={styles.heroAmbientCircleLarge} />
            <Animated.View style={[styles.heroAmbientCircleSmall, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
            <Animated.View pointerEvents="none" style={[styles.heroLightSweep, { transform: [{ translateX: shimmerX }, { skewX: '-18deg' }] }]} />

            <View style={styles.heroHeaderRow}>
              <View style={styles.heroHeaderPill}>
                <Feather name="send" size={13} color="#1A448F" />
                <Text style={[styles.heroHeaderPillText, { fontFamily: t.typography.fontFamily.bold }]}>Application workspace</Text>
              </View>
              <View style={[styles.heroReadyChip, cvUrl ? styles.heroReadyChipDone : styles.heroReadyChipPending]}>
                <Animated.View style={[styles.heroReadyDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                <Text style={[styles.heroReadyText, { fontFamily: t.typography.fontFamily.bold }]}>
                  {cvUrl ? 'Ready' : uploading ? 'Uploading' : 'Draft'}
                </Text>
              </View>
            </View>

            <View style={styles.heroLayout}>
              <View style={styles.heroTextBlock}>
                <Text style={[styles.heroLightEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>Apply with confidence</Text>
                <Text style={[styles.heroLightTitle, compact && styles.heroLightTitleCompact, { fontFamily: t.typography.fontFamily.bold }]}>
                  Complete your application in a clear, focused flow.
                </Text>
                <Text style={[styles.heroLightBody, { fontFamily: t.typography.fontFamily.medium }]}>
                  Add your CV and a short note, then send when everything is ready.
                </Text>

                <View style={styles.heroInlineMetaRow}>
                  <View style={styles.heroInlineMetaChip}>
                    <Feather name="briefcase" size={12} color="#1A66B8" />
                    <Text style={[styles.heroInlineMetaText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                      {jobTitle}
                    </Text>
                  </View>
                  <View style={styles.heroInlineMetaChip}>
                    <Feather name="file-text" size={12} color="#1A66B8" />
                    <Text style={[styles.heroInlineMetaText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                      {cvName ? '1 file ready' : 'CV required'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.heroSummaryRow}>
                <Animated.View style={[styles.heroSummaryCard, { transform: [{ translateY: sheetFloatY }] }]}>
                  <View style={styles.heroSummaryIconShell}>
                    <View style={styles.heroSummaryIconGlow} />
                    <LinearGradient colors={['#2049A6', '#1A90DE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroSummaryIconWrap}>
                      <Feather name="file-text" size={18} color="#FFFFFF" />
                    </LinearGradient>
                  </View>
                  <View style={styles.heroSummaryCopy}>
                    <Text style={[styles.heroSummaryTitle, { fontFamily: t.typography.fontFamily.bold }]}>{statusTitle}</Text>
                    <Text style={[styles.heroSummaryBody, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={2}>
                      {cvName ? cvName : uploading ? 'Preparing your document...' : 'Upload your latest CV to continue.'}
                    </Text>
                  </View>
                </Animated.View>

                <Animated.View style={[styles.heroProgressCard, { transform: [{ translateY: stepFloatY }] }]}>
                  <Text style={[styles.heroProgressLabel, { fontFamily: t.typography.fontFamily.bold }]}>
                    {uploading ? 'Syncing' : cvUrl ? 'Attached' : 'Pending'}
                  </Text>
                  <View style={styles.heroProgressBars}>
                    <View style={[styles.heroProgressBar, styles.heroProgressBarShort]} />
                    <Animated.View style={[styles.heroProgressBar, styles.heroProgressBarActive, { opacity: pulseOpacity, transform: [{ scaleX: pulseScale }] }]} />
                    <View style={[styles.heroProgressBar, styles.heroProgressBarMid]} />
                  </View>
                </Animated.View>
              </View>
            </View>

            <View style={styles.heroStepRail}>
              {[
                { label: 'Note', icon: 'edit-3' as const },
                { label: 'Upload', icon: 'upload-cloud' as const },
                { label: 'Send', icon: 'send' as const },
              ].map((item, index) => (
                <Animated.View
                  key={item.label}
                  style={[
                    index === 1 && { transform: [{ translateY: stepFloatY }] },
                    index === 2 && { transform: [{ translateY: orbTranslateY }] },
                  ]}
                >
                  <Pressable
                    style={({ pressed }) => [styles.heroRailChip, pressed && { opacity: 0.88 }]}
                    onPress={() => {
                      if (item.label === 'Note') scrollToSection(noteSectionY.current);
                      if (item.label === 'Upload') scrollToSection(uploadSectionY.current);
                      if (item.label === 'Send') scrollToSection(sendSectionY.current);
                    }}
                  >
                    <View style={styles.heroRailIconWrap}>
                      <Feather name={item.icon} size={13} color="#1A66B8" />
                    </View>
                    <Text style={[styles.heroRailText, { fontFamily: t.typography.fontFamily.bold }]}>{item.label}</Text>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: cardEntrance, transform: [{ translateY: cardsTranslateY }] }}>
          <View
            onLayout={(event) => {
              noteSectionY.current = event.nativeEvent.layout.y;
            }}
          >
            <Card style={StyleSheet.flatten([styles.formCard, { backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.88)' : 'rgba(248, 250, 252, 0.9)', borderColor: t.colors.border }])}>
              <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.34)', 'rgba(255,255,255,0)']} style={styles.formSheen} />
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={[styles.sectionEyebrow, { color: t.colors.textMuted, fontFamily: t.typography.fontFamily.bold }]}>Application details</Text>
                  <Text style={[styles.sectionTitle, { color: t.colors.text, fontFamily: t.typography.fontFamily.bold }]}>Candidate note</Text>
                </View>
                <View style={[styles.sectionBadge, { backgroundColor: t.isDark ? 'rgba(79, 113, 210, 0.18)' : 'rgba(15, 121, 197, 0.08)' }]}>
                  <Feather name="edit-3" size={13} color={t.colors.secondary} />
                  <Text style={[styles.sectionBadgeText, { color: t.colors.secondary, fontFamily: t.typography.fontFamily.bold }]}>Optional</Text>
                </View>
              </View>

              <Input
                label="Cover note"
                value={note}
                onChangeText={setNote}
                placeholder="Highlight your experience, motivation, or availability."
                multiline
              />

              <View style={styles.tipRow}>
                <Feather name="zap" size={14} color="#1A84DE" />
                <Text style={[styles.tipText, { color: t.colors.textMuted, fontFamily: t.typography.fontFamily.medium }]}>
                  Keep it short and specific. Two or three strong points are enough.
                </Text>
              </View>
            </Card>
          </View>

          <View
            onLayout={(event) => {
              uploadSectionY.current = event.nativeEvent.layout.y;
            }}
          >
            <Card style={StyleSheet.flatten([styles.uploadCard, { backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.88)' : 'rgba(248, 250, 252, 0.9)', borderColor: t.colors.border }])}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={[styles.sectionEyebrow, { color: t.colors.textMuted, fontFamily: t.typography.fontFamily.bold }]}>Document upload</Text>
                  <Text style={[styles.sectionTitle, { color: t.colors.text, fontFamily: t.typography.fontFamily.bold }]}>CV file</Text>
                </View>
                <Animated.View style={[styles.uploadStateBadge, cvUrl ? styles.uploadStateBadgeReady : uploading ? styles.uploadStateBadgeBusy : styles.uploadStateBadgeIdle, { transform: [{ translateY: orbTranslateY }] }]}>
                  <Feather name={cvUrl ? 'check-circle' : uploading ? 'loader' : 'upload-cloud'} size={13} color={cvUrl ? '#119A4F' : '#1A66B8'} />
                  <Text style={[styles.uploadStateText, { fontFamily: t.typography.fontFamily.bold }]}>
                    {cvUrl ? 'Attached' : uploading ? 'Working' : 'Pending'}
                  </Text>
                </Animated.View>
              </View>

              <View style={styles.fileRow}>
                <View style={styles.fileIconWrap}>
                  <Feather name={cvUrl ? 'file-text' : 'folder'} size={18} color="#FFFFFF" />
                </View>
                <View style={styles.fileCopy}>
                  <Text style={[styles.fileName, { color: t.colors.text, fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                    {cvName ? cvName : 'No file selected'}
                  </Text>
                  <Text style={[styles.fileHint, { color: t.colors.textMuted, fontFamily: t.typography.fontFamily.medium }]}>
                    PDF or Word document, one file only.
                  </Text>
                </View>
              </View>

              <View style={styles.uploadActionWrap}>
                <Button title={uploading ? 'Uploading...' : cvUrl ? 'Replace CV' : 'Upload CV'} onPress={pickCv} loading={uploading} />
              </View>
            </Card>
          </View>
        </Animated.View>

        <Animated.View style={[styles.actionsWrap, { opacity: actionEntrance, transform: [{ translateY: actionsTranslateY }, { scale: ctaPulse }] }]}>
          <View
            onLayout={(event) => {
              sendSectionY.current = event.nativeEvent.layout.y;
            }}
          >
            <Card style={StyleSheet.flatten([styles.submitCard, { backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.92)' : 'rgba(248, 250, 252, 0.94)', borderColor: t.colors.border }])}>
              <View style={styles.submitHeader}>
                <View>
                  <Text style={[styles.sectionEyebrow, { color: t.colors.textMuted, fontFamily: t.typography.fontFamily.bold }]}>Final step</Text>
                  <Text style={[styles.sectionTitle, { color: t.colors.text, fontFamily: t.typography.fontFamily.bold }]}>Send application</Text>
                </View>
                <View style={[styles.progressChip, cvUrl ? styles.progressChipReady : styles.progressChipIdle]}>
                  <Text style={[styles.progressChipText, { fontFamily: t.typography.fontFamily.bold }]}>{cvUrl ? 'Ready to send' : 'Upload CV first'}</Text>
                </View>
              </View>

              <Button title={submitting ? 'Submitting...' : 'Submit application'} onPress={submit} loading={submitting} disabled={!cvUrl} />
            </Card>
          </View>
        </Animated.View>
      </Animated.ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 132,
    gap: 12,
  },
  contentCompact: {
    paddingTop: 4,
    gap: 10,
  },
  heroShell: {
    borderRadius: 28,
  },
  heroSurface: {
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    minHeight: 188,
    overflow: 'hidden',
    backgroundColor: '#EAF4FF',
    borderWidth: 1,
    borderColor: '#C3DBF8',
    shadowColor: '#7389BB',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 5,
  },
  heroSurfaceCompact: {
    minHeight: 176,
    paddingTop: 14,
    paddingBottom: 12,
  },
  heroAmbientCircleLarge: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(15, 121, 197, 0.07)',
    top: -92,
    right: -34,
  },
  heroAmbientCircleSmall: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(27, 62, 155, 0.08)',
    bottom: -18,
    left: -18,
  },
  heroLightSweep: {
    position: 'absolute',
    top: -30,
    bottom: -30,
    width: 78,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  heroHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderWidth: 1,
    borderColor: '#D7E3F7',
  },
  heroHeaderPillText: {
    color: '#18428A',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroReadyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  heroReadyChipPending: {
    backgroundColor: '#EEF4FF',
    borderColor: '#D6E4FA',
  },
  heroReadyChipDone: {
    backgroundColor: '#E8F8EF',
    borderColor: '#CDEEDC',
  },
  heroReadyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2CD178',
  },
  heroReadyText: {
    color: '#1A448F',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  heroLayout: {
    marginTop: 16,
    gap: 12,
  },
  heroTextBlock: {
    gap: 6,
  },
  heroLightEyebrow: {
    color: '#6073A7',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroLightTitle: {
    color: '#122A74',
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
  },
  heroLightTitleCompact: {
    fontSize: 20,
    lineHeight: 24,
  },
  heroLightBody: {
    color: '#5C678A',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  heroInlineMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  heroInlineMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: '#D7E3F7',
  },
  heroInlineMetaText: {
    color: '#1A66B8',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  heroSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  heroSummaryCard: {
    flex: 1.2,
    borderRadius: 20,
    padding: 13,
    backgroundColor: '#DDEEFF',
    borderWidth: 1,
    borderColor: '#9FC5F3',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#5E7FB6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 5,
  },
  heroSummaryIconShell: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroSummaryIconGlow: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(120, 181, 236, 0.46)',
    transform: [{ scale: 1.14 }],
  },
  heroSummaryIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.36)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A66B8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  heroSummaryCopy: {
    flex: 1,
  },
  heroSummaryTitle: {
    color: '#153F94',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  heroSummaryBody: {
    color: '#355985',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    marginTop: 3,
  },
  heroProgressCard: {
    flex: 0.9,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: '#D7E3F7',
    justifyContent: 'center',
  },
  heroProgressLabel: {
    color: '#1A448F',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  heroProgressBars: {
    gap: 6,
  },
  heroProgressBar: {
    height: 7,
    borderRadius: 999,
    backgroundColor: '#DCE9F8',
  },
  heroProgressBarShort: {
    width: '54%',
  },
  heroProgressBarMid: {
    width: '72%',
  },
  heroProgressBarActive: {
    width: '88%',
    backgroundColor: '#70B7ED',
  },
  heroSheetStack: {
    width: 148,
    minHeight: 158,
    position: 'relative',
    marginTop: 2,
  },
  heroSheetBack: {
    position: 'absolute',
    top: 22,
    right: 14,
    width: 110,
    height: 128,
    borderRadius: 24,
    backgroundColor: 'rgba(15, 121, 197, 0.1)',
    borderWidth: 1,
    borderColor: '#D7E3F7',
  },
  heroSheetMid: {
    position: 'absolute',
    top: 12,
    right: 6,
    width: 122,
    height: 140,
    borderRadius: 24,
    backgroundColor: 'rgba(27, 62, 155, 0.12)',
    borderWidth: 1,
    borderColor: '#D5E1F7',
  },
  heroSheetFront: {
    width: 144,
    minHeight: 148,
    borderRadius: 24,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#D7E3F7',
    justifyContent: 'space-between',
    marginLeft: 'auto',
    shadowColor: '#6C86B8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 4,
  },
  heroSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  heroSheetHeaderCopy: {
    flex: 1,
  },
  heroSheetIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#1A66B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSheetTitle: {
    color: '#153F94',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  heroSheetBody: {
    color: '#6A769A',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    marginTop: 4,
  },
  heroSheetBars: {
    gap: 7,
    marginTop: 10,
  },
  heroSheetBar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#DCE9F8',
  },
  heroSheetBarShort: {
    width: '52%',
  },
  heroSheetBarMid: {
    width: '68%',
  },
  heroSheetBarActive: {
    width: '84%',
    backgroundColor: '#70B7ED',
  },
  heroSheetFooter: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroSheetStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EEF4FF',
  },
  heroSheetStatusText: {
    color: '#0F65B5',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  heroSheetAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1A66B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStepRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  heroRailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: '#D7E3F7',
  },
  heroRailIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRailText: {
    color: '#1A448F',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
  formCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  formSheen: {
    position: 'absolute',
    top: -40,
    right: -12,
    width: 120,
    height: 180,
    transform: [{ rotate: '18deg' }],
  },
  uploadCard: {
    borderRadius: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  sectionEyebrow: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 3,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
  },
  sectionBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },
  uploadStateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
  },
  uploadStateBadgeIdle: {
    backgroundColor: '#EAF2FF',
  },
  uploadStateBadgeBusy: {
    backgroundColor: '#EEF4FF',
  },
  uploadStateBadgeReady: {
    backgroundColor: '#E8F8EF',
  },
  uploadStateText: {
    fontSize: 11,
    lineHeight: 14,
    color: '#1A448F',
    fontWeight: '800',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#1A66B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  fileCopy: {
    flex: 1,
  },
  fileName: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  fileHint: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  uploadActionWrap: {
    marginTop: 12,
  },
  actionsWrap: {
    marginBottom: 20,
  },
  submitCard: {
    borderRadius: 24,
  },
  submitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  progressChip: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
  },
  progressChipIdle: {
    backgroundColor: '#EEF4FF',
  },
  progressChipReady: {
    backgroundColor: '#E8F8EF',
  },
  progressChipText: {
    fontSize: 11,
    lineHeight: 14,
    color: '#1A448F',
    fontWeight: '800',
  },
});
