import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MeetingsService } from '../../api/services';
import { Button, Screen } from '../../components/ui';
import type { Meeting } from '../../types/models';
import type { MeetingsStackParamList } from '../../navigation/app/AppNavigator';
import { useAuthStore } from '../../context/authStore';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<MeetingsStackParamList, 'MeetingDetails'>;

const getManagedCandidateId = (user: any) =>
  String(user?.managedCandidate?._id || user?.managedCandidateId || user?.selectedManagedCandidateId || '').trim();

const isVirtualMeeting = (meeting: Meeting | null) =>
  ['Zoom', 'Google Meet', 'Microsoft Teams'].includes(String(meeting?.locationType || '').trim());

const isRemoteMeeting = (meeting: Meeting | null) => {
  const locationType = String(meeting?.locationType || '').trim();
  return !!locationType && locationType !== 'Physical';
};

const accessLabelForMeeting = (meeting: Meeting | null) => {
  const locationType = String(meeting?.locationType || '').trim();
  if (locationType === 'Physical') return 'Location';
  if (locationType === 'Phone') return 'Phone number';
  return 'Meeting link';
};

const accessValueForMeeting = (meeting: Meeting | null) => {
  const locationType = String(meeting?.locationType || '').trim();
  if (locationType === 'Physical') return String(meeting?.location || '').trim();
  return String(meeting?.link || '').trim();
};

const notesValueForMeeting = (meeting: Meeting | null) => {
  const candidates = [
    meeting?.notes,
    (meeting as any)?.note,
    (meeting as any)?.description,
    (meeting as any)?.agenda,
    (meeting as any)?.details,
    (meeting as any)?.meetingNotes,
    (meeting as any)?.metadata?.notes,
    (meeting as any)?.metadata?.note,
  ];

  for (const value of candidates) {
    const text = String(value || '').trim();
    if (text) return text;
  }

  return '';
};

const toneForStatus = (status?: string) => {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'completed') return { bg: '#D8F2E3', text: '#118D4C', chip: '#EAF8F0' };
  if (value === 'scheduled') return { bg: '#DFEBFF', text: '#1D5FD2', chip: '#EEF4FF' };
  if (value === 'canceled' || value === 'cancelled') return { bg: '#FDE1E1', text: '#D12B2B', chip: '#FFF1F1' };
  return { bg: '#E8EDF8', text: '#4E628E', chip: '#F2F5FB' };
};

const locationIcon = (meeting: Meeting | null): keyof typeof Feather.glyphMap => {
  const normalized = String(meeting?.locationType || '').trim();
  if (normalized === 'Physical') return 'map-pin';
  if (['Zoom', 'Google Meet', 'Microsoft Teams'].includes(normalized)) return 'video';
  return 'phone';
};

export default function MeetingDetailsScreen({ navigation, route }: Props) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const stackHeroFacts = width <= 430;
  const user = useAuthStore((s) => s.user);
  const { meetingId, meeting: initialMeeting } = route.params;
  const [meeting, setMeeting] = useState<Meeting | null>(initialMeeting || null);
  const [loading, setLoading] = useState(!initialMeeting);

  const managedCandidateId = useMemo(() => getManagedCandidateId(user), [user]);
  const heroEntrance = useRef(new Animated.Value(0)).current;
  const contentEntrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (initialMeeting) return;
    (async () => {
      setLoading(true);
      try {
        const list = await MeetingsService.list(managedCandidateId ? { managedCandidateId } : undefined);
        const found = (Array.isArray(list) ? list : []).find((item) => String(item?._id) === String(meetingId));
        setMeeting(found || null);
      } catch {
        setMeeting(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [initialMeeting, managedCandidateId, meetingId]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroEntrance, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(contentEntrance, { toValue: 1, duration: 760, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
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
          Animated.timing(float, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(float, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(sweep, { toValue: 1, duration: 2200, delay: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ),
    ];

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [contentEntrance, heroEntrance]);

  const statusTone = toneForStatus(meeting?.status);
  const contactName = String(meeting?.candidate?.name || meeting?.clientName || '').trim();
  const contactEmail = String(meeting?.candidate?.email || '').trim();
  const accessValue = accessValueForMeeting(meeting);
  const accessLabel = accessLabelForMeeting(meeting);
  const meetingType = String(meeting?.locationType || '').trim() || 'Meeting';
  const notesValue = notesValueForMeeting(meeting);
  const participantCount = Array.isArray(meeting?.participants) ? meeting!.participants!.length : 0;
  const accessIcon = meetingType === 'Physical' ? 'map-pin' : meetingType === 'Phone' ? 'phone' : 'link';

  const heroY = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });
  const contentY = contentEntrance.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.24, 0.5] });
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-180, 300] });

  const quickFacts = [
    { key: 'date', label: 'Date', value: meeting?.date || 'TBD', icon: 'calendar' as const, color: '#1D5FD2', bg: '#EEF4FF' },
    { key: 'time', label: 'Time', value: meeting?.time || 'TBD', icon: 'clock' as const, color: '#7A3ED4', bg: '#F3EDFF' },
    { key: 'type', label: 'Type', value: meetingType, icon: locationIcon(meeting), color: meetingType === 'Physical' ? '#118D4C' : '#1768B8', bg: meetingType === 'Physical' ? '#ECFAF3' : '#EEF5FF' },
  ];

  const quickFactsNode = (
    <View style={[styles.factGrid, stackHeroFacts && styles.factGridCompact]}>
      {quickFacts.map((fact) => (
        <View key={fact.key} style={[styles.factCard, stackHeroFacts && styles.factCardCompact]}>
          <View style={[styles.factIcon, stackHeroFacts && styles.factIconCompact, { backgroundColor: fact.bg }]}>
            <Feather name={fact.icon} size={13} color={fact.color} />
          </View>
          {stackHeroFacts ? (
            <View style={styles.factCopyCompact}>
              <Text style={[styles.factLabel, styles.factLabelCompact, { fontFamily: t.typography.fontFamily.medium }]}>{fact.label}</Text>
              <Text
                style={[styles.factValue, styles.factValueInlineCompact, { color: fact.color, fontFamily: t.typography.fontFamily.bold }]}
                numberOfLines={1}
              >
                {fact.value}
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.factLabel, { fontFamily: t.typography.fontFamily.medium }]}>{fact.label}</Text>
              <Text style={[styles.factValue, { color: fact.color, fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                {fact.value}
              </Text>
            </>
          )}
        </View>
      ))}
    </View>
  );

  const joinMeeting = async () => {
    const rawValue = String(meeting?.link || '').trim();
    if (!rawValue) {
      Alert.alert('Link unavailable', 'No meeting link is available for this meeting.');
      return;
    }

    const locationType = String(meeting?.locationType || '').trim();
    const preferredUrl =
      locationType === 'Phone' && !/^tel:/i.test(rawValue) && !/^https?:/i.test(rawValue)
        ? `tel:${rawValue.replace(/\s+/g, '')}`
        : rawValue;

    try {
      await Linking.openURL(preferredUrl);
    } catch {
      try {
        await Linking.openURL(rawValue);
      } catch {
        Alert.alert('Unable to open access', 'Please try again on this device.');
      }
    }
  };

  const copyMeetingLink = async () => {
    const value = String(accessValue || '').trim();
    if (!value || accessLabel !== 'Meeting link') return;
    try {
      await Clipboard.setStringAsync(value);
      Alert.alert('Copied', 'Meeting link copied to clipboard.');
    } catch {
      Alert.alert('Unable to copy', 'Please try again.');
    }
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.headerRow, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
          <Pressable onPress={() => navigation.canGoBack() && navigation.goBack()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
            <Feather name="arrow-left" size={18} color="#1B3890" />
          </Pressable>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.eyebrow, { fontFamily: t.typography.fontFamily.bold }]}>SESSION BRIEF</Text>
            <Text style={[styles.heading, { color: '#1B3890', fontFamily: t.typography.fontFamily.bold }]}>Meeting Overview</Text>
          </View>
          <View style={styles.liveChip}>
            <Animated.View style={[styles.liveDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
            <Text style={[styles.liveText, { color: statusTone.text, fontFamily: t.typography.fontFamily.bold }]}>
              {loading ? 'Syncing' : meeting?.status || 'Scheduled'}
            </Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.heroCard, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
          <View style={styles.heroGlowA} />
          <Animated.View style={[styles.heroGlowB, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
          <Animated.View style={[styles.heroSweep, { transform: [{ translateX: sweepX }, { rotate: '16deg' }] }]} />

          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Feather name="bookmark" size={12} color="#1768B8" />
              <Text style={[styles.heroBadgeText, { fontFamily: t.typography.fontFamily.bold }]}>Meeting brief</Text>
            </View>
            <View style={[styles.heroStatusChip, { backgroundColor: statusTone.chip }]}>
              <Text style={[styles.heroStatusText, { color: statusTone.text, fontFamily: t.typography.fontFamily.bold }]}>
                {meeting?.status || 'Scheduled'}
              </Text>
            </View>
          </View>

          <View style={[styles.heroMain, compact && styles.heroMainCompact]}>
            <View style={styles.heroCopyBlock}>
              <Text style={[styles.heroTitle, { fontFamily: t.typography.fontFamily.bold }]}>
                {meeting?.title || (loading ? 'Loading meeting...' : 'Meeting')}
              </Text>
              <Text style={[styles.heroBody, { fontFamily: t.typography.fontFamily.medium }]}>
                {contactName
                  ? `Keep ${contactName}'s session on track.`
                  : 'Review access, timing, and key details.'}
              </Text>

              <View style={styles.heroIdentityRow}>
                <View style={styles.heroIdentityChip}>
                  <Feather name="user" size={12} color="#1B3890" />
                  <Text style={[styles.heroIdentityText, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                    {contactName || 'Candidate'}
                  </Text>
                </View>
                <View style={[styles.heroIdentityChip, styles.heroIdentityChipSoft]}>
                  <Feather name={locationIcon(meeting)} size={12} color="#6A35D5" />
                  <Text style={[styles.heroIdentityText, { color: '#6A35D5', fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                    {meetingType}
                  </Text>
                </View>
              </View>

              {!stackHeroFacts ? quickFactsNode : null}
            </View>

            <Animated.View style={[styles.heroVisual, { transform: [{ translateY: floatY }] }]}>
              <View style={styles.heroVisualPanel}>
                <View style={styles.heroVisualSheetBack} />
                <View style={styles.heroVisualSheetMid} />
                <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.25 }} end={{ x: 1, y: 1 }} style={styles.heroVisualIcon}>
                  <Feather name={locationIcon(meeting)} size={18} color="#FFFFFF" />
                </LinearGradient>
                <Text style={[styles.heroVisualTitle, { fontFamily: t.typography.fontFamily.bold }]}>Session lane</Text>
                <Text style={[styles.heroVisualBody, { fontFamily: t.typography.fontFamily.medium }]}>Ready for access and follow-up.</Text>
                <View style={styles.heroTrack}>
                  <View style={styles.heroTrackLine} />
                  <View style={[styles.heroTrackNode, styles.heroTrackNodeOne]} />
                  <Animated.View style={[styles.heroTrackDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                  <View style={[styles.heroTrackNode, styles.heroTrackNodeTwo]} />
                  <View style={[styles.heroTrackNode, styles.heroTrackNodeThree]} />
                </View>
                <View style={styles.heroBars}>
                  <Animated.View style={[styles.heroBar, styles.heroBarLong, { opacity: pulseOpacity }]} />
                  <Animated.View style={[styles.heroBar, styles.heroBarMid, { opacity: pulseOpacity }]} />
                  <Animated.View style={[styles.heroBar, styles.heroBarShort, { opacity: pulseOpacity }]} />
                </View>
                <View style={styles.heroFooterChip}>
                  <Feather name="users" size={12} color="#1768B8" />
                  <Text style={[styles.heroFooterText, { fontFamily: t.typography.fontFamily.bold }]}>{participantCount} participants</Text>
                </View>
              </View>
            </Animated.View>
          </View>
          {stackHeroFacts ? quickFactsNode : null}
        </Animated.View>

        <Animated.View style={{ opacity: contentEntrance, transform: [{ translateY: contentY }] }}>
          <View style={styles.sectionCard}>
            <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>Session Core</Text>
            <Text style={[styles.sectionTitle, { color: '#1B3890', fontFamily: t.typography.fontFamily.bold }]}>Key details</Text>
            {contactName || contactEmail ? (
              <View style={[styles.detailBox, styles.contactBox]}>
                <View style={styles.contactIconWrap}>
                  <Feather name="user" size={16} color="#1B3890" />
                </View>
                <View style={styles.detailCopy}>
                  <Text style={styles.detailLabel}>Candidate</Text>
                  <Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.bold }]}>{contactName || 'Candidate'}</Text>
                  {contactEmail ? <Text style={styles.subValue}>{contactEmail}</Text> : null}
                </View>
              </View>
            ) : null}
            <View style={styles.detailBox}>
              <Feather name="type" size={16} color="#1D5FD2" />
              <View style={styles.detailCopy}>
                <Text style={styles.detailLabel}>Meeting title</Text>
                <Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.bold }]}>{meeting?.title || 'N/A'}</Text>
              </View>
            </View>
            <View style={styles.rowGrid}>
              <View style={[styles.detailBox, styles.halfBox]}>
                <Feather name="calendar" size={16} color="#1D5FD2" />
                <View style={styles.detailCopy}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.bold }]}>{meeting?.date || 'N/A'}</Text>
                </View>
              </View>
              <View style={[styles.detailBox, styles.halfBox]}>
                <Feather name="clock" size={16} color="#7A3ED4" />
                <View style={styles.detailCopy}>
                  <Text style={styles.detailLabel}>Time</Text>
                  <Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.bold }]}>{meeting?.time || 'N/A'}</Text>
                </View>
              </View>
            </View>
            <View style={styles.detailBox}>
              <Feather name="monitor" size={16} color="#1768B8" />
              <View style={styles.detailCopy}>
                <Text style={styles.detailLabel}>Meeting type</Text>
                <Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.bold }]}>{meetingType}</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>Access Lane</Text>
            <Text style={[styles.sectionTitle, { color: '#1B3890', fontFamily: t.typography.fontFamily.bold }]}>Entry details</Text>
            <View style={[styles.detailBox, styles.accessBox]}>
              <View style={styles.accessIconWrap}>
                <Feather name={accessIcon as any} size={16} color={meetingType === 'Physical' ? '#118D4C' : meetingType === 'Phone' ? '#6A35D5' : '#1768B8'} />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailLabel}>{accessLabel}</Text>
                <Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.bold }]}>{accessValue || 'Not added yet'}</Text>
              </View>
              {accessLabel === 'Meeting link' && accessValue ? (
                <Pressable onPress={copyMeetingLink} style={({ pressed }) => [styles.copyChip, pressed && styles.pressed]}>
                  <Feather name="copy" size={13} color="#1768B8" />
                  <Text style={[styles.copyChipText, { fontFamily: t.typography.fontFamily.bold }]}>Copy</Text>
                </Pressable>
              ) : null}
            </View>
            {notesValue ? (
              <View style={[styles.detailBox, styles.notesBox]}>
                <Feather name="file-text" size={16} color="#CB6A10" />
                <View style={styles.detailCopy}>
                  <Text style={styles.detailLabel}>Notes</Text>
                  <Text style={[styles.noteValue, { fontFamily: t.typography.fontFamily.medium }]}>{notesValue}</Text>
                </View>
              </View>
            ) : null}
            {Array.isArray(meeting?.participants) && meeting?.participants?.length ? (
              <View style={styles.participantsWrap}>
                {meeting.participants.map((participant) => (
                  <View key={participant} style={styles.participantChip}>
                    <Feather name="check-circle" size={14} color="#119A4F" />
                    <Text style={[styles.participantText, { fontFamily: t.typography.fontFamily.medium }]}>{participant}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {isRemoteMeeting(meeting) && meeting?.link ? (
            <View style={styles.actionCard}>
              <Text style={[styles.actionTitle, { color: '#173271', fontFamily: t.typography.fontFamily.bold }]}>
                {isVirtualMeeting(meeting) ? 'Ready to join this session' : 'Access details are available'}
              </Text>
              <Text style={[styles.actionBody, { fontFamily: t.typography.fontFamily.medium }]}>
                {isVirtualMeeting(meeting) ? 'Open the meeting link from this page.' : 'Use the saved access details from this page.'}
              </Text>
              <View style={styles.actionButtonWrap}>
                <Button title={isVirtualMeeting(meeting) ? 'Join Meeting' : 'Open Access Details'} onPress={joinMeeting} disabled={!meeting?.link} />
              </View>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 130 },
  pressed: { opacity: 0.92 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
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
  headerTextWrap: { flex: 1 },
  eyebrow: { color: '#7485A8', fontSize: 10, lineHeight: 12, letterSpacing: 2.1, fontWeight: '900' },
  heading: { marginTop: 3, fontSize: 21, lineHeight: 25, fontWeight: '900' },
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
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1FCB7A' },
  liveText: { fontSize: 11, lineHeight: 14, fontWeight: '800' },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#D8E3F6',
    backgroundColor: '#FAFCFF',
    padding: 16,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#456DA9',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  heroGlowA: { position: 'absolute', top: -76, right: -20, width: 206, height: 206, borderRadius: 103, backgroundColor: 'rgba(86, 143, 255, 0.12)' },
  heroGlowB: { position: 'absolute', bottom: -34, left: -12, width: 144, height: 144, borderRadius: 72, backgroundColor: 'rgba(90, 214, 192, 0.12)' },
  heroSweep: { position: 'absolute', top: -44, bottom: -44, width: 92, backgroundColor: 'rgba(255,255,255,0.35)' },
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
  heroBadgeText: { color: '#1768B8', fontSize: 9, lineHeight: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  heroStatusChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  heroStatusText: { fontSize: 10, lineHeight: 13, fontWeight: '800' },
  heroMain: { marginTop: 16, flexDirection: 'row', gap: 14 },
  heroMainCompact: { gap: 10 },
  heroCopyBlock: { flex: 1 },
  heroTitle: { color: '#153375', fontSize: 22, lineHeight: 27, fontWeight: '900' },
  heroBody: { marginTop: 8, color: '#5D7096', fontSize: 11, lineHeight: 17, fontWeight: '700' },
  heroIdentityRow: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroIdentityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D7E4F8',
    backgroundColor: '#EFF5FF',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  heroIdentityChipSoft: { backgroundColor: '#F2ECFF', borderColor: '#E5D9FA' },
  heroIdentityText: { color: '#1B3890', fontSize: 9, lineHeight: 11, fontWeight: '800', flexShrink: 1 },
  factGrid: { marginTop: 14, flexDirection: 'row', gap: 6 },
  factGridCompact: { marginTop: 10, flexDirection: 'column', gap: 6 },
  factCard: {
    flex: 1,
    minHeight: 82,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7E2F4',
    paddingHorizontal: 10,
    paddingVertical: 11,
    justifyContent: 'space-between',
  },
  factCardCompact: {
    flex: 0,
    width: '100%',
    minHeight: 46,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  factIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  factIconCompact: { width: 26, height: 26, borderRadius: 9, marginRight: 8 },
  factCopyCompact: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  factLabel: { color: '#6B7EA3', fontSize: 9, lineHeight: 11, fontWeight: '700' },
  factLabelCompact: { fontSize: 10, lineHeight: 12, marginRight: 10 },
  factValue: { fontSize: 12, lineHeight: 15, fontWeight: '900' },
  factValueCompact: { marginTop: 2, fontSize: 12, lineHeight: 15 },
  factValueInlineCompact: { marginTop: 0, marginLeft: 'auto', textAlign: 'right' },
  heroVisual: { width: 128, height: 230, alignItems: 'stretch' },
  heroVisualPanel: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E2F3',
    padding: 14,
    overflow: 'hidden',
  },
  heroVisualSheetBack: { position: 'absolute', top: 14, right: 12, width: 72, height: 90, borderRadius: 18, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#D9E3F7', transform: [{ rotate: '10deg' }] },
  heroVisualSheetMid: { position: 'absolute', top: 22, right: 4, width: 80, height: 102, borderRadius: 20, backgroundColor: '#F7FAFF', borderWidth: 1, borderColor: '#DCE5F6', transform: [{ rotate: '5deg' }] },
  heroVisualIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  heroVisualTitle: { marginTop: 12, color: '#173271', fontSize: 12, lineHeight: 15, fontWeight: '900' },
  heroVisualBody: { marginTop: 4, color: '#697CA5', fontSize: 9, lineHeight: 12, fontWeight: '700' },
  heroTrack: { marginTop: 12, height: 18, justifyContent: 'center', position: 'relative' },
  heroTrackLine: { position: 'absolute', left: 6, right: 6, height: 3, borderRadius: 999, backgroundColor: '#D8E3F6' },
  heroTrackNode: { position: 'absolute', width: 9, height: 9, borderRadius: 5, backgroundColor: '#C9D8F1' },
  heroTrackNodeOne: { left: 6 },
  heroTrackNodeTwo: { left: '49%' },
  heroTrackNodeThree: { right: 6 },
  heroTrackDot: { position: 'absolute', left: 56, width: 14, height: 14, borderRadius: 7, backgroundColor: '#1FCB7A', borderWidth: 3, borderColor: '#E8FFF4' },
  heroBars: { marginTop: 14, gap: 6 },
  heroBar: { height: 6, borderRadius: 999, backgroundColor: '#D9E4F6' },
  heroBarLong: { width: 90 },
  heroBarMid: { width: 72 },
  heroBarShort: { width: 54 },
  heroFooterChip: {
    marginTop: 14,
    borderRadius: 999,
    backgroundColor: '#F2F7FF',
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  heroFooterText: { color: '#1768B8', fontSize: 9, lineHeight: 11, fontWeight: '800' },
  sectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D8E2F4',
    backgroundColor: 'rgba(250,252,255,0.96)',
    padding: 14,
    marginBottom: 12,
  },
  sectionEyebrow: { color: '#7587AA', fontSize: 9, lineHeight: 11, letterSpacing: 1.4, fontWeight: '900', textTransform: 'uppercase' },
  sectionTitle: { marginTop: 3, marginBottom: 10, fontSize: 17, lineHeight: 21, fontWeight: '900' },
  rowGrid: { flexDirection: 'row', gap: 8, },
  halfBox: { flex: 1 },
  detailBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D5DEF3',
    backgroundColor: '#EDF4FF',
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  detailCopy: { flex: 1, marginLeft: 8 },
  contactBox: { backgroundColor: '#F7FAFF' },
  contactIconWrap: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#E9F1FF', alignItems: 'center', justifyContent: 'center' },
  detailLabel: { color: '#617398', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  detailValue: { marginTop: 2, color: '#162C65', fontSize: 14, lineHeight: 18, fontWeight: '800' },
  subValue: { marginTop: 2, color: '#617398', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  accessBox: { backgroundColor: '#F7FAFF' },
  accessIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF5FF' },
  copyChip: {
    marginLeft: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D5E3F7',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  copyChipText: { color: '#1768B8', fontSize: 10, lineHeight: 12, fontWeight: '800' },
  notesBox: { backgroundColor: '#FFF9F0', borderColor: '#F2E1BE' },
  noteValue: { marginTop: 3, color: '#465A82', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  participantsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  participantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D5E7DA',
    backgroundColor: '#F3FBF6',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  participantText: { color: '#2A446D', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  actionCard: { borderRadius: 22, borderWidth: 1, borderColor: '#D9E4F7', backgroundColor: '#F9FBFF', padding: 14 },
  actionTitle: { fontSize: 16, lineHeight: 20, fontWeight: '900' },
  actionBody: { marginTop: 5, color: '#66799D', fontSize: 11, lineHeight: 16, fontWeight: '600' },
  actionButtonWrap: { marginTop: 12 },
});
