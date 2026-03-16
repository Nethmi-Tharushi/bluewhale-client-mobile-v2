import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '../../components/ui';
import { AuthService } from '../../api/services';
import { api } from '../../api/client';
import { useAuthStore } from '../../context/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { formatUaeMobileInput } from '../../utils/phone';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/app/AppNavigator';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

const formatDob = (v?: string) => {
  if (!v) return 'Not provided';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatJoin = (v?: string) => {
  if (!v) return 'N/A';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
};

const pickString = (values: any[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
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
  const sweep = useRef(new Animated.Value(0)).current;

  const resolveUrl = (raw: string) => {
    const candidate = String(raw || '').trim();
    if (!candidate) return '';
    if (/^https?:\/\//i.test(candidate)) return candidate;
    const base = String(api.defaults.baseURL || '').replace(/\/+$/, '');
    const origin = base.replace(/\/api$/i, '');
    if (!origin) return '';
    if (candidate.startsWith('/')) return `${origin}${candidate}`;
    if (/^uploads\//i.test(candidate)) return `${origin}/${candidate}`;
    return `${origin}/uploads/${candidate}`;
  };

  const avatarUrl = useMemo(
    () =>
      resolveUrl(
        String(
          user?.avatarUrl ||
            user?.avatar ||
            user?.picture ||
            user?.profileImage ||
            user?.profilePic ||
            user?.profilePicture ||
            user?.photoUrl ||
            user?.photo ||
            user?.image ||
            ''
        )
      ),
    [user]
  );

  const categories = useMemo(() => {
    const raw = user?.categories;
    if (Array.isArray(raw)) return raw.filter(Boolean).map((x: any) => String(x).trim()).filter(Boolean);
    return String(raw || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await AuthService.getProfile();
      const u = (res as any)?.user || res;
      setUser(u || null);
      setAvatarFailed(false);
    } catch {
      setUser(storeUser || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation]);

  useEffect(() => {
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
          Animated.timing(drift, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(drift, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(sweep, { toValue: 1, duration: 2300, delay: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ),
    ];

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [drift, heroEntrance, pulse, sectionsEntrance, sweep]);

  const detailRows = [
    { key: 'Full Name', value: user?.name || user?.fullName || 'Not provided', icon: 'user' as const, tone: 'blue' as const },
    { key: 'Email', value: user?.email || 'Not provided', icon: 'mail' as const, tone: 'lavender' as const },
    { key: 'Phone', value: formatUaeMobileInput(user?.phone || '') || 'Not provided', icon: 'phone' as const, tone: 'mint' as const },
    { key: 'Date of Birth', value: formatDob(user?.dateOfBirth), icon: 'calendar' as const, tone: 'gold' as const },
    { key: 'Gender', value: user?.gender || 'Not provided', icon: 'user' as const, tone: 'blue' as const },
    { key: 'Age Range', value: user?.ageRange || 'Not provided', icon: 'clock' as const, tone: 'lavender' as const },
    { key: 'Location', value: user?.location || 'Not provided', icon: 'map-pin' as const, tone: 'mint' as const },
    { key: 'Profession', value: user?.profession || 'Not provided', icon: 'briefcase' as const, tone: 'blue' as const },
    { key: 'Qualification', value: user?.qualification || 'Not provided', icon: 'file-text' as const, tone: 'lavender' as const },
    { key: 'Experience', value: user?.experience || 'Not provided', icon: 'award' as const, tone: 'gold' as const },
    { key: 'Job Interest', value: user?.jobInterest || 'Not provided', icon: 'target' as const, tone: 'mint' as const },
  ];

  const providedCount = detailRows.filter((row) => row.value !== 'Not provided').length + (user?.aboutMe ? 1 : 0) + (categories.length ? 1 : 0);
  const completionValue = Math.min(100, Math.round((providedCount / (detailRows.length + 2)) * 100));
  const completionText = `${completionValue}%`;
  const profileRole = pickString([user?.profession, user?.jobInterest, 'Candidate profile']);
  const heroY = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const sectionY = sectionsEntrance.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.46] });
  const driftY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-180, 280] });

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
  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.getParent()?.navigate('Home' as never);
  };

  return (
    <LinearGradient colors={['#F5F8FD', '#EEF4FB', '#F7FBFF']} style={styles.root}>
      <Screen padded={false}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.topBar, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
            <Pressable style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]} onPress={handleBack}>
              <Feather name="arrow-left" size={18} color="#17326F" />
            </Pressable>
            <View style={styles.topCopy}>
              <Text style={[styles.pageEyebrow, { color: t.colors.textMuted, fontFamily: t.typography.fontFamily.bold }]}>Profile studio</Text>
              <Text style={[styles.pageTitle, { fontFamily: t.typography.fontFamily.bold }]}>My profile</Text>
              <Text style={[styles.pageSub, { color: t.colors.grayMutedDark, fontFamily: t.typography.fontFamily.medium }]}>
                Review your profile and progress.
              </Text>
            </View>
            <Pressable style={({ pressed }) => [styles.editButtonTop, pressed && styles.pressed]} onPress={() => navigation.navigate('EditProfile')}>
              <Feather name="edit-3" size={16} color="#FFFFFF" />
            </Pressable>
          </Animated.View>

          <Animated.View style={[styles.heroCard, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
            <View style={styles.heroGlowA} />
            <Animated.View style={[styles.heroGlowB, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
            <Animated.View style={[styles.heroSweep, { transform: [{ translateX: sweepX }, { rotate: '18deg' }] }]} />

            <View style={styles.heroHeaderRow}>
              <View style={styles.heroPill}>
                <Feather name="user-check" size={13} color="#1768B8" />
                <Text style={[styles.heroPillText, { fontFamily: t.typography.fontFamily.bold }]}>Profile snapshot</Text>
              </View>
              <View style={styles.heroSignal}>
                <Animated.View style={[styles.heroSignalDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                <Text style={[styles.heroSignalText, { fontFamily: t.typography.fontFamily.bold }]}>{loading ? 'Updating' : 'Ready'}</Text>
              </View>
            </View>

            <View style={[styles.heroMain, compact && styles.heroMainCompact]}>
              <View style={styles.heroIdentity}>
                <Animated.View style={[styles.avatarHalo, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                <Animated.View style={[styles.avatarWrap, { transform: [{ translateY: driftY }] }]}>
                  {avatarUrl && !avatarFailed ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} onError={() => setAvatarFailed(true)} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Feather name="user" size={34} color="#5E6F95" />
                    </View>
                  )}
                </Animated.View>

                <View style={styles.identityCopy}>
                  <Text style={[styles.name, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                    {user?.name || user?.fullName || 'Candidate'}
                  </Text>
                  <Text style={[styles.roleText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                    {profileRole}
                  </Text>
                  <View style={styles.joinedPill}>
                    <Feather name="calendar" size={13} color="#6880A6" />
                    <Text style={[styles.joinedText, { fontFamily: t.typography.fontFamily.medium }]}>
                      {loading ? 'Loading...' : `Joined ${formatJoin(user?.createdAt)}`}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.metricRail}>
                <View style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: '#EAF2FF' }]}>
                    <Feather name="activity" size={12} color="#1768B8" />
                  </View>
                  <Text style={[styles.metricValue, { color: '#1768B8', fontFamily: t.typography.fontFamily.bold }]}>{completionText}</Text>
                  <Text style={[styles.metricLabel, { fontFamily: t.typography.fontFamily.medium }]}>Profile strength</Text>
                </View>
                <View style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: '#EAF8F0' }]}>
                    <Feather name="award" size={12} color="#11856E" />
                  </View>
                  <Text style={[styles.metricValue, { color: '#11856E', fontFamily: t.typography.fontFamily.bold }]}>{categories.length || 0}</Text>
                  <Text style={[styles.metricLabel, { fontFamily: t.typography.fontFamily.medium }]}>Skills added</Text>
                </View>
                <View style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: '#FFF4E4' }]}>
                    <Feather name="map-pin" size={12} color="#C7851D" />
                  </View>
                  <Text style={[styles.metricValue, { color: '#C7851D', fontFamily: t.typography.fontFamily.bold }]}>{user?.location ? 'Live' : 'Setup'}</Text>
                  <Text style={[styles.metricLabel, { fontFamily: t.typography.fontFamily.medium }]}>Status</Text>
                </View>
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
                  <View
                    key={row.key}
                    style={[
                      styles.detailCard,
                      row.tone === 'blue'
                        ? styles.detailCardBlue
                        : row.tone === 'lavender'
                          ? styles.detailCardLavender
                          : row.tone === 'mint'
                            ? styles.detailCardMint
                            : styles.detailCardGold,
                    ]}
                  >
                    <View style={styles.detailIconWrap}>
                      <Feather name={row.icon} size={16} color="#5D6E92" />
                    </View>
                    <View style={styles.detailCopy}>
                      <Text style={[styles.detailLabel, { fontFamily: t.typography.fontFamily.medium }]}>{row.key}</Text>
                      <Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                        {row.value}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.editorialRow}>
              <View style={[styles.infoBlock, styles.infoBlockWide]}>
                <Text style={[styles.blockTitle, { fontFamily: t.typography.fontFamily.bold }]}>About me</Text>
                <Text style={[styles.blockBody, { fontFamily: t.typography.fontFamily.medium }]}>
                  {user?.aboutMe || 'Not provided'}
                </Text>
              </View>

              <View style={styles.infoColumn}>
                <View style={styles.infoBlock}>
                  <Text style={[styles.blockTitle, { fontFamily: t.typography.fontFamily.bold }]}>LinkedIn</Text>
                  <Text style={[styles.inlineValue, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={2}>
                    {user?.socialNetworks?.linkedin || user?.linkedin || 'Not provided'}
                  </Text>
                </View>

                <View style={styles.infoBlock}>
                  <Text style={[styles.blockTitle, { fontFamily: t.typography.fontFamily.bold }]}>GitHub</Text>
                  <Text style={[styles.inlineValue, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={2}>
                    {user?.socialNetworks?.github || user?.github || 'Not provided'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.skillsBlock}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]}>Skills</Text>
                <View style={styles.sectionChip}>
                  <Feather name="zap" size={12} color="#1768B8" />
                  <Text style={[styles.sectionChipText, { fontFamily: t.typography.fontFamily.bold }]}>{categories.length || 0} listed</Text>
                </View>
              </View>
              {categories.length ? (
                <View style={styles.tagsRow}>
                  {categories.map((cat, index) => (
                    <Animated.View
                      key={cat}
                      style={{
                        opacity: sectionsEntrance,
                        transform: [
                          {
                            translateY: sectionsEntrance.interpolate({
                              inputRange: [0, 1],
                              outputRange: [12 + index * 2, 0],
                            }),
                          },
                        ],
                      }}
                    >
                      <LinearGradient colors={['#EAF4FF', '#F7FBFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tag}>
                        <Text style={[styles.tagText, { fontFamily: t.typography.fontFamily.bold }]}>{cat}</Text>
                      </LinearGradient>
                    </Animated.View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.blockBody, { fontFamily: t.typography.fontFamily.medium }]}>Not provided</Text>
              )}
            </View>

            <Pressable style={({ pressed }) => [styles.logoutButton, (pressed || loggingOut) && styles.pressed]} onPress={onLogout}>
              <LinearGradient colors={['#D95A67', '#E97B62']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.logoutFill}>
                <Feather name="log-out" size={16} color="#FFFFFF" />
                <Text style={[styles.logoutText, { fontFamily: t.typography.fontFamily.bold }]}>
                  {loggingOut ? 'Logging out...' : 'Logout'}
                </Text>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#D4E1F4',
  },
  topCopy: { flex: 1 },
  pageEyebrow: {
    fontSize: 9,
    lineHeight: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    fontWeight: '800',
  },
  pageTitle: {
    marginTop: 3,
    color: '#17326F',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  pageSub: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  editButtonTop: {
    width: 42,
    height: 42,
    borderRadius: 15,
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
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
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
  heroSignalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1FCA7B',
  },
  heroSignalText: {
    color: '#11856E',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
  },
  heroMain: {
    marginTop: 16,
    gap: 14,
  },
  heroMainCompact: {
    gap: 12,
  },
  heroIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    position: 'relative',
  },
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
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF2FF',
  },
  identityCopy: { flex: 1 },
  name: {
    color: '#17326F',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  roleText: {
    marginTop: 4,
    color: '#5E7397',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
  },
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
  joinedText: {
    color: '#6880A6',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '700',
  },
  metricRail: {
    flexDirection: 'row',
    gap: 8,
  },
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
  metricIcon: {
    width: 22,
    height: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 15,
    lineHeight: 17,
    fontWeight: '900',
  },
  metricLabel: {
    marginTop: 4,
    color: '#667C98',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '600',
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D8E3F4',
    backgroundColor: 'rgba(249,251,254,0.95)',
    padding: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
  },
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
  sectionChipText: {
    color: '#1768B8',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
  },
  detailGrid: {
    gap: 8,
  },
  detailCard: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailCardBlue: {
    backgroundColor: '#EEF5FF',
    borderColor: '#D8E6F8',
  },
  detailCardLavender: {
    backgroundColor: '#F4EEFF',
    borderColor: '#E4D7FA',
  },
  detailCardMint: {
    backgroundColor: '#EAF9F6',
    borderColor: '#D2EEE7',
  },
  detailCardGold: {
    backgroundColor: '#FFF5E7',
    borderColor: '#F5E1BF',
  },
  detailIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  detailCopy: { flex: 1 },
  detailLabel: {
    color: '#687C98',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '600',
  },
  detailValue: {
    marginTop: 3,
    color: '#1A2F62',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  editorialRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  infoColumn: {
    flex: 1,
    gap: 10,
  },
  infoBlock: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D8E3F4',
    backgroundColor: 'rgba(249,251,254,0.95)',
    padding: 14,
  },
  infoBlockWide: {
    flex: 1.1,
  },
  blockTitle: {
    color: '#17326F',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  blockBody: {
    marginTop: 6,
    color: '#536986',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  inlineValue: {
    marginTop: 6,
    color: '#536986',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  skillsBlock: {
    marginTop: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D8E3F4',
    backgroundColor: 'rgba(249,251,254,0.95)',
    padding: 14,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8E6F8',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: {
    color: '#1D4FAE',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
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
  logoutFill: {
    minHeight: 48,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
});
