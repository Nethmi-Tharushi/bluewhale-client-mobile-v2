import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '../../components/ui';
import { AgentProfileService } from '../../api/services';
import { api } from '../../api/client';
import { useAuthStore } from '../../context/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import type { ProfileStackParamList } from '../../navigation/app/AppNavigator';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

const pickString = (values: any[], fallback = '') => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return fallback;
};

const resolveAssetUrl = (raw: string) => {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const base = String(api.defaults.baseURL || '').replace(/\/+$/, '');
  const origin = base.replace(/\/api$/i, '');
  if (!origin) return '';
  if (value.startsWith('/')) return `${origin}${value}`;
  if (/^uploads\//i.test(value)) return `${origin}/${value}`;
  return `${origin}/uploads/${value}`;
};

const formatJoinDate = (value?: string) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
};

const getProfileCompletion = (user: any) => {
  const checkpoints = [
    pickString([user?.name, user?.fullName]),
    pickString([user?.email]),
    pickString([user?.phone]),
    pickString([user?.companyName]),
    pickString([user?.companyAddress]),
    pickString([user?.contactPerson]),
    pickString([user?.companyLogo]),
    user?.isVerified ? 'verified' : '',
  ];
  const completed = checkpoints.filter(Boolean).length;
  return Math.round((completed / checkpoints.length) * 100);
};

export default function ProfileScreen({ navigation }: Props) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const storeUser = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const [user, setUser] = useState<any>(storeUser || null);
  const [loading, setLoading] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const heroEntrance = useRef(new Animated.Value(0)).current;
  const sectionsEntrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await AgentProfileService.getProfile();
      const nextUser = (res as any)?.user || res;
      setUser(nextUser || storeUser || null);
      setAvatarFailed(false);
    } catch (err: any) {
      if (Number(err?.response?.status || 0) === 401) {
        await signOut();
        return;
      }
      setUser(storeUser || null);
    } finally {
      setLoading(false);
    }
  }, [signOut, storeUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(heroEntrance, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sectionsEntrance, {
        toValue: 1,
        duration: 760,
        delay: 120,
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
          Animated.timing(drift, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(drift, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, { toValue: 1, duration: 2200, delay: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ),
    ];

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [drift, heroEntrance, pulse, sectionsEntrance, shimmer]);

  const fullName = pickString([user?.name, user?.fullName], 'Agent');
  const companyName = pickString([user?.companyName], 'Not provided');
  const contactPerson = pickString([user?.contactPerson], 'Not provided');
  const email = pickString([user?.email], 'Not provided');
  const phone = pickString([user?.phone], 'Not provided');
  const companyAddress = pickString([user?.companyAddress], 'Not provided');
  const companyLogo = pickString([user?.companyLogo], '');
  const logoUrl = useMemo(() => resolveAssetUrl(companyLogo), [companyLogo]);
  const completion = getProfileCompletion(user);
  const verified = Boolean(user?.isVerified);
  const heroY = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const sectionY = sectionsEntrance.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.46] });
  const driftY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-170, 250] });

  const detailRows = [
    { key: 'Company Name', value: companyName, icon: 'briefcase' as const, tone: styles.detailCardBlue },
    { key: 'Contact Person', value: contactPerson, icon: 'user' as const, tone: styles.detailCardMint },
    { key: 'Email', value: email, icon: 'mail' as const, tone: styles.detailCardLavender },
    { key: 'Phone', value: phone, icon: 'phone' as const, tone: styles.detailCardGold },
    { key: 'Address', value: companyAddress, icon: 'map-pin' as const, tone: styles.detailCardBlue },
  ];

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    const parent = navigation.getParent() as any;
    if (parent?.canGoBack?.()) {
      parent.goBack();
      return;
    }
    parent?.navigate?.('Overview');
  }, [navigation]);

  const onLogout = () => {
    if (loggingOut) return;
    Alert.alert('Log out', 'Do you want to log out from your account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoggingOut(true);
            await signOut();
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const metricCards = [
    { key: 'strength', value: `${completion}%`, label: 'Profile strength', color: '#1768B8', bg: '#EAF2FF', icon: 'activity' as const },
    { key: 'verified', value: verified ? 'Yes' : 'Pending', label: 'Verification', color: verified ? '#11856E' : '#C7851D', bg: verified ? '#EAF8F0' : '#FFF4E4', icon: verified ? ('shield' as const) : ('clock' as const) },
    { key: 'logo', value: companyLogo ? 'Ready' : 'Missing', label: 'Company logo', color: companyLogo ? '#7B56D8' : '#D95A67', bg: companyLogo ? '#F1EAFF' : '#FFF0F2', icon: companyLogo ? ('image' as const) : ('alert-circle' as const) },
  ];

  return (
    <LinearGradient colors={['#F5F8FD', '#EEF4FB', '#F7FBFF']} style={styles.root}>
      <Screen padded={false}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.topBar, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
            <Pressable onPress={handleBack} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
              <Feather name="arrow-left" size={18} color="#1B3890" />
            </Pressable>
            <View style={styles.topCopy}>
              <Text style={[styles.pageEyebrow, { color: t.colors.textMuted, fontFamily: t.typography.fontFamily.bold }]}>Agent profile</Text>
              <Text style={[styles.pageTitle, { fontFamily: t.typography.fontFamily.bold }]}>Company Profile</Text>
              <Text style={[styles.pageSub, { color: t.colors.grayMutedDark, fontFamily: t.typography.fontFamily.medium }]}>
                Review your public details and update company information when needed.
              </Text>
            </View>
            <View style={styles.topActions}>
              <View style={styles.liveChipSolid}>
                <View style={styles.liveDot} />
                <Text style={[styles.liveChipText, { fontFamily: t.typography.fontFamily.bold }]}>{loading ? 'Syncing' : 'Live'}</Text>
              </View>
              <Pressable style={({ pressed }) => [styles.editButtonTop, pressed && styles.pressed]} onPress={() => navigation.navigate('EditProfile')}>
                <Feather name="edit-3" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </Animated.View>

          <Animated.View style={[styles.heroCard, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
            <View style={styles.heroGlowA} />
            <Animated.View style={[styles.heroGlowB, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
            <Animated.View style={[styles.heroSweep, { transform: [{ translateX: shimmerX }, { rotate: '18deg' }] }]} />

            <View style={styles.heroHeaderRow}>
              <View style={styles.heroPill}>
                <Feather name="user-check" size={13} color="#1768B8" />
                <Text style={[styles.heroPillText, { fontFamily: t.typography.fontFamily.bold }]}>Profile snapshot</Text>
              </View>
              <View style={styles.heroSignal}>
                <Animated.View style={[styles.heroSignalDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                <Text style={[styles.heroSignalText, { fontFamily: t.typography.fontFamily.bold }]}>{loading ? 'Loading' : 'Live'}</Text>
              </View>
            </View>

            <View style={[styles.heroMain, compact && styles.heroMainCompact]}>
              <View style={styles.heroIdentity}>
                <Animated.View style={[styles.avatarHalo, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                <Animated.View style={[styles.avatarWrap, { transform: [{ translateY: driftY }] }]}>
                  {logoUrl && !avatarFailed ? (
                    <Image source={{ uri: logoUrl }} style={styles.avatarImage} onError={() => setAvatarFailed(true)} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Feather name="briefcase" size={34} color="#5E6F95" />
                    </View>
                  )}
                </Animated.View>

                <View style={styles.identityCopy}>
                  <Text style={[styles.name, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                    {fullName}
                  </Text>
                  <Text style={[styles.roleText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                    {companyName !== 'Not provided' ? companyName : 'Company details pending'}
                  </Text>
                  <View style={styles.joinedPill}>
                    <Feather name="calendar" size={13} color="#6880A6" />
                    <Text style={[styles.joinedText, { fontFamily: t.typography.fontFamily.medium }]}>
                      {loading ? 'Loading...' : `Joined ${formatJoinDate(user?.createdAt)}`}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.metricRail}>
                {metricCards.map((card) => (
                  <View key={card.key} style={styles.metricCard}>
                    <View style={[styles.metricIcon, { backgroundColor: card.bg }]}>
                      <Feather name={card.icon} size={12} color={card.color} />
                    </View>
                    <Text style={[styles.metricValue, { color: card.color, fontFamily: t.typography.fontFamily.bold }]}>{card.value}</Text>
                    <Text style={[styles.metricLabel, { fontFamily: t.typography.fontFamily.medium }]}>{card.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>

          <Animated.View style={{ opacity: sectionsEntrance, transform: [{ translateY: sectionY }] }}>
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]}>Profile details</Text>
                <View style={styles.sectionChip}>
                  <Feather name="layers" size={12} color="#1768B8" />
                  <Text style={[styles.sectionChipText, { fontFamily: t.typography.fontFamily.bold }]}>{detailRows.length} fields</Text>
                </View>
              </View>

              <View style={styles.detailGrid}>
                {detailRows.map((row) => (
                  <View key={row.key} style={[styles.detailCard, row.tone]}>
                    <View style={styles.detailIconWrap}>
                      <Feather name={row.icon} size={16} color="#5D6E92" />
                    </View>
                    <View style={styles.detailCopy}>
                      <Text style={[styles.detailLabel, { fontFamily: t.typography.fontFamily.medium }]}>{row.key}</Text>
                      <Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={2}>
                        {row.value || 'Not provided'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.editorialRow}>
              <View style={[styles.infoBlock, styles.infoBlockWide]}>
                <Text style={[styles.blockTitle, { fontFamily: t.typography.fontFamily.bold }]}>Company status</Text>
                <Text style={[styles.blockBody, { fontFamily: t.typography.fontFamily.medium }]}>
                  {verified
                    ? 'Your agency profile is verified and ready to represent managed candidates.'
                    : 'Verification is still pending. Complete your company details to strengthen trust.'}
                </Text>
              </View>

              <View style={styles.infoColumn}>
                <View style={styles.infoBlock}>
                  <Text style={[styles.blockTitle, { fontFamily: t.typography.fontFamily.bold }]}>Verification</Text>
                  <Text style={[styles.inlineValue, { fontFamily: t.typography.fontFamily.medium }]}>{verified ? 'Verified agent' : 'Pending review'}</Text>
                </View>

                <View style={styles.infoBlock}>
                  <Text style={[styles.blockTitle, { fontFamily: t.typography.fontFamily.bold }]}>Logo</Text>
                  <Text style={[styles.inlineValue, { fontFamily: t.typography.fontFamily.medium }]}>{companyLogo ? 'Uploaded' : 'Not provided'}</Text>
                </View>
              </View>
            </View>

            <Pressable style={({ pressed }) => [styles.logoutButton, (pressed || loggingOut) && styles.pressed]} onPress={onLogout}>
              <LinearGradient colors={['#D95A67', '#E97B62']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.logoutFill}>
                <Feather name="log-out" size={16} color="#FFFFFF" />
                <Text style={[styles.logoutText, { fontFamily: t.typography.fontFamily.bold }]}>{loggingOut ? 'Logging out...' : 'Logout'}</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </Screen>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 140 },
  pressed: { opacity: 0.88 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#D1DEF3' },
  topCopy: { flex: 1 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageEyebrow: { fontSize: 11, lineHeight: 14, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '700' },
  pageTitle: { marginTop: 4, color: '#13306F', fontSize: 20, lineHeight: 24, fontWeight: '900', letterSpacing: -0.4 },
  pageSub: { marginTop: 4, fontSize: 10, lineHeight: 14, fontWeight: '600' },
  liveChipSolid: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#F5F8FD', borderWidth: 1, borderColor: '#D7E4F7' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C57D' },
  liveChipText: { color: '#194A9A', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  editButtonTop: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B3890',
    shadowColor: '#315FA8',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#D6E2F3',
    backgroundColor: '#F9FBFE',
    padding: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  heroGlowA: {
    position: 'absolute',
    top: -74,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(64, 138, 255, 0.1)',
  },
  heroGlowB: {
    position: 'absolute',
    bottom: -26,
    left: -18,
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(87, 209, 194, 0.1)',
  },
  heroSweep: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 86,
    backgroundColor: 'rgba(255,255,255,0.36)',
  },
  heroHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7E2F4',
  },
  heroPillText: {
    color: '#1768B8',
    fontSize: 9,
    lineHeight: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontWeight: '800',
  },
  heroSignal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7E2F4',
  },
  heroSignalDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1FCA7B' },
  heroSignalText: { color: '#11856E', fontSize: 9, lineHeight: 11, fontWeight: '800' },
  heroMain: { marginTop: 16, gap: 14 },
  heroMainCompact: { gap: 12 },
  heroIdentity: { flexDirection: 'row', alignItems: 'center', gap: 14, position: 'relative' },
  avatarHalo: {
    position: 'absolute',
    left: 4,
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(65, 138, 255, 0.14)',
  },
  avatarWrap: {
    width: 84,
    height: 84,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D4E1F4',
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF2FF' },
  identityCopy: { flex: 1 },
  name: { color: '#17326F', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  roleText: { marginTop: 4, color: '#5E7397', fontSize: 10, lineHeight: 13, fontWeight: '600' },
  joinedPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F3F8FF',
    borderWidth: 1,
    borderColor: '#D8E6F8',
  },
  joinedText: { color: '#6880A6', fontSize: 9, lineHeight: 11, fontWeight: '700' },
  metricRail: { flexDirection: 'row', gap: 8 },
  metricCard: {
    flex: 1,
    minHeight: 68,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7E2F4',
    justifyContent: 'center',
  },
  metricIcon: { width: 22, height: 22, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  metricValue: { fontSize: 15, lineHeight: 17, fontWeight: '900' },
  metricLabel: { marginTop: 4, color: '#667C98', fontSize: 9, lineHeight: 11, fontWeight: '600' },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D8E3F4',
    backgroundColor: 'rgba(249,251,254,0.95)',
    padding: 14,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 },
  sectionTitle: { fontSize: 15, lineHeight: 18, fontWeight: '900' },
  sectionChip: {
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
  sectionChipText: { color: '#1768B8', fontSize: 9, lineHeight: 11, fontWeight: '800' },
  detailGrid: { gap: 8 },
  detailCard: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailCardBlue: { backgroundColor: '#EEF5FF', borderColor: '#D8E6F8' },
  detailCardLavender: { backgroundColor: '#F4EEFF', borderColor: '#E4D7FA' },
  detailCardMint: { backgroundColor: '#EAF9F6', borderColor: '#D2EEE7' },
  detailCardGold: { backgroundColor: '#FFF5E7', borderColor: '#F5E1BF' },
  detailIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  detailCopy: { flex: 1 },
  detailLabel: { color: '#687C98', fontSize: 9, lineHeight: 11, fontWeight: '600' },
  detailValue: { marginTop: 3, color: '#1A2F62', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  editorialRow: { marginTop: 12, flexDirection: 'row', gap: 10 },
  infoColumn: { flex: 1, gap: 10 },
  infoBlock: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D8E3F4',
    backgroundColor: 'rgba(249,251,254,0.95)',
    padding: 14,
  },
  infoBlockWide: { flex: 1.1 },
  blockTitle: { color: '#17326F', fontSize: 13, lineHeight: 17, fontWeight: '900' },
  blockBody: { marginTop: 6, color: '#536986', fontSize: 10, lineHeight: 14, fontWeight: '600' },
  inlineValue: { marginTop: 6, color: '#536986', fontSize: 10, lineHeight: 14, fontWeight: '600' },
  logoutButton: {
    marginTop: 12,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0C8CE',
    shadowColor: '#C45E69',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 4,
  },
  logoutFill: { minHeight: 48, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoutText: { color: '#FFFFFF', fontSize: 12, lineHeight: 15, fontWeight: '800' },
});
