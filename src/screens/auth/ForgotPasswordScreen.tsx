import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AuthService } from '../../api/services';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/auth/AuthNavigator';
import { useTheme } from '../../theme/ThemeProvider';
import { PageDecor } from '../../components/ui';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;
type FocusField = 'email' | null;

const RECOVERY_STEPS = [
  { icon: 'mail' as const, label: 'Request reset' },
  { icon: 'shield' as const, label: 'Verify securely' },
  { icon: 'key' as const, label: 'Restore access' },
];

const TRUST_CHIPS = [
  { icon: 'clock' as const, label: 'Fast email' },
  { icon: 'check-circle' as const, label: 'Private check' },
  { icon: 'briefcase' as const, label: 'Agent account' },
];

export default function ForgotPasswordScreen({ navigation }: Props) {
  const t = useTheme();
  const isAndroid = Platform.OS === 'android';
  const { width, height } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<FocusField>(null);

  const compact = height < 760;
  const spacious = height >= 840;
  const narrow = width < 380;
  const cardHorizontal = narrow ? 14 : 20;

  const heroEntrance = useRef(new Animated.Value(0)).current;
  const cardEntrance = useRef(new Animated.Value(0)).current;
  const orbFloat = useRef(new Animated.Value(0)).current;
  const beaconPulse = useRef(new Animated.Value(0)).current;
  const routeFlow = useRef(new Animated.Value(0)).current;
  const chipAnimations = useRef(TRUST_CHIPS.map(() => new Animated.Value(0))).current;
  const cardFloat = useRef(new Animated.Value(0)).current;
  const shimmerTranslate = useRef(new Animated.Value(0)).current;
  const fieldGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroEntrance, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardEntrance, {
        toValue: 1,
        duration: 760,
        delay: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.stagger(
        90,
        chipAnimations.map((value) =>
          Animated.timing(value, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start();

    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(orbFloat, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(orbFloat, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(beaconPulse, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(beaconPulse, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(routeFlow, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(routeFlow, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(cardFloat, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(cardFloat, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerTranslate, { toValue: 1, duration: 2200, delay: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(shimmerTranslate, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(fieldGlow, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(fieldGlow, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
    ];

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [beaconPulse, cardEntrance, cardFloat, chipAnimations, fieldGlow, heroEntrance, orbFloat, routeFlow, shimmerTranslate]);

  const onSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Missing email', 'Please enter your email.');
      return;
    }
    setLoading(true);
    try {
      await AuthService.forgotPassword(email.trim());
      Alert.alert('Check your email', 'If an agent account exists, we sent password reset instructions.');
      navigation.navigate('Login');
    } catch (e: any) {
      Alert.alert('Failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const heroTranslateY = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });
  const heroOpacity = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const cardTranslateY = cardEntrance.interpolate({ inputRange: [0, 1], outputRange: [36, 0] });
  const orbTranslateY = orbFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const pulseScale = beaconPulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] });
  const pulseOpacity = beaconPulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.52] });
  const routeTranslateX = routeFlow.interpolate({ inputRange: [0, 1], outputRange: [-34, 122] });
  const routeOpacity = routeFlow.interpolate({ inputRange: [0, 0.2, 0.85, 1], outputRange: [0, 1, 1, 0] });
  const shimmerX = shimmerTranslate.interpolate({ inputRange: [0, 1], outputRange: [-280, 280] });
  const cardFloatY = cardFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const fieldGlowOpacity = fieldGlow.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.3] });

  return (
    <LinearGradient colors={t.colors.gradientBackground as any} style={styles.root}>
      <PageDecor />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingTop: compact ? 8 : spacious ? 26 : 16, paddingBottom: compact ? 20 : 30 }]}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={[styles.hero, { opacity: heroOpacity, transform: [{ translateY: heroTranslateY }] }]}>
              <View style={styles.heroTopRow}>
                <Pressable
                  onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login'))}
                  hitSlop={10}
                  style={({ pressed }) => [styles.backButton, { backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.86)' : isAndroid ? '#FFFFFF' : 'rgba(255,255,255,0.78)', borderColor: t.colors.border }, pressed && styles.pressed]}
                >
                  <Feather name="chevron-left" size={20} color={t.colors.primary} />
                </Pressable>
              </View>

              <View style={[styles.eyebrow, { backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.86)' : isAndroid ? '#FFFFFF' : 'rgba(255,255,255,0.74)', borderColor: t.colors.border }]}>
                <Feather name="refresh-cw" size={14} color={t.colors.secondary} />
                <Text style={[styles.eyebrowText, { color: t.colors.primary }]}>Agent recovery</Text>
              </View>

              <View style={styles.visualStage}>
                <Animated.View style={[styles.pulseRing, { borderColor: t.colors.secondary, opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                <Animated.View style={[styles.pulseRingOuter, { borderColor: t.isDark ? 'rgba(153, 192, 255, 0.16)' : 'rgba(27, 56, 144, 0.12)', opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />

                <View style={[styles.routeTrack, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15, 121, 197, 0.1)' }]}>
                  <Animated.View style={[styles.routeDot, { backgroundColor: t.colors.secondary, opacity: routeOpacity, transform: [{ translateX: routeTranslateX }] }]} />
                </View>

                <Animated.View style={[styles.mailOrb, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.45)', transform: [{ translateY: orbTranslateY }] }]}>
                  <View style={[styles.mailOrbRing, { borderColor: t.isDark ? 'rgba(153, 192, 255, 0.18)' : 'rgba(27, 56, 144, 0.08)' }]} />
                  <View style={[styles.mailOrbInner, { backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.82)' : 'rgba(248, 250, 252, 0.92)', borderColor: t.colors.border }]}>
                    <View style={[styles.mailTile, { backgroundColor: t.isDark ? 'rgba(79, 113, 210, 0.16)' : 'rgba(15, 121, 197, 0.1)', borderColor: t.isDark ? 'rgba(79, 113, 210, 0.26)' : 'rgba(15, 121, 197, 0.14)' }]}>
                      <Feather name="mail" size={42} color={t.colors.secondary} />
                    </View>
                    <View style={[styles.lockBadge, { backgroundColor: t.colors.primary }]}>
                      <Feather name="shield" size={15} color="#FFFFFF" />
                    </View>
                  </View>
                </Animated.View>
              </View>

              <Text style={[styles.title, { color: t.colors.primary }, compact && styles.titleCompact]}>Recover your agent account</Text>
              <Text style={[styles.subtitle, { color: t.colors.grayMutedDark }]}>
                Enter your agent email to receive a secure reset link and restore workspace access.
              </Text>

              <View style={[styles.stepsPanel, { backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.82)' : isAndroid ? '#FFFFFF' : 'rgba(255,255,255,0.72)', borderColor: t.colors.border }]}>
                {RECOVERY_STEPS.map((item, index) => (
                  <React.Fragment key={item.label}>
                    <View style={styles.stepItem}>
                      <View style={[styles.stepIconWrap, { backgroundColor: t.isDark ? 'rgba(79, 113, 210, 0.18)' : 'rgba(15, 121, 197, 0.1)' }]}>
                        <Feather name={item.icon} size={15} color={t.colors.secondary} />
                      </View>
                      <Text style={[styles.stepLabel, { color: t.colors.text }]}>{item.label}</Text>
                    </View>
                    {index < RECOVERY_STEPS.length - 1 ? <View style={[styles.stepDivider, { backgroundColor: t.colors.borderStrong }]} /> : null}
                  </React.Fragment>
                ))}
              </View>

              <View style={styles.chipRow}>
                {TRUST_CHIPS.map((chip, index) => {
                  const translateY = chipAnimations[index].interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
                  return (
                    <Animated.View key={chip.label} style={{ opacity: chipAnimations[index], transform: [{ translateY }] }}>
                      <View style={[styles.chip, { backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.82)' : isAndroid ? '#FFFFFF' : 'rgba(255,255,255,0.72)', borderColor: t.isDark ? 'rgba(58, 84, 134, 0.75)' : 'rgba(215, 227, 245, 0.92)' }]}>
                        <Feather name={chip.icon} size={14} color={t.colors.secondary} />
                        <Text style={[styles.chipText, { color: t.colors.text }]}>{chip.label}</Text>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            </Animated.View>

            <Animated.View
              style={[
                styles.formCard,
                isAndroid && styles.androidFormCard,
                {
                  marginHorizontal: cardHorizontal,
                  backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.9)' : isAndroid ? '#F8FAFC' : 'rgba(248, 250, 252, 0.84)',
                  borderColor: t.isDark ? 'rgba(58, 84, 134, 0.75)' : isAndroid ? '#D7E2F2' : 'rgba(255,255,255,0.82)',
                  transform: [{ translateY: cardTranslateY }, { translateY: cardFloatY }],
                  opacity: heroOpacity,
                },
                t.shadow.card,
              ]}
            >
              <LinearGradient
                colors={t.isDark ? (['rgba(79, 113, 210, 0.18)', 'rgba(15, 121, 197, 0.08)'] as any) : (['rgba(27, 56, 144, 0.08)', 'rgba(15, 121, 197, 0.02)'] as any)}
                style={styles.cardTint}
              />
              <Animated.View pointerEvents="none" style={[styles.shimmerOverlay, { transform: [{ translateX: shimmerX }, { rotate: '18deg' }] }]}>
                <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']} style={styles.shimmerGradient} />
              </Animated.View>

              <View style={styles.metricRow}>
                <View style={[styles.metricCard, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)', borderColor: t.colors.border }]}>
                  <Text style={[styles.metricValue, { color: t.colors.primary }]}>1</Text>
                  <Text style={[styles.metricLabel, { color: t.colors.grayMutedDark }]}>email</Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)', borderColor: t.colors.border }]}>
                  <Text style={[styles.metricValue, { color: t.colors.primary }]}>Secure</Text>
                  <Text style={[styles.metricLabel, { color: t.colors.grayMutedDark }]}>private reply</Text>
                </View>
              </View>

              <View style={styles.cardHeader}>
                <View style={[styles.cardBadge, { backgroundColor: t.isDark ? 'rgba(79, 113, 210, 0.2)' : 'rgba(15, 121, 197, 0.12)' }]}>
                  <Feather name="send" size={18} color={t.colors.secondary} />
                </View>
                <View style={styles.cardHeaderCopy}>
                  <Text style={[styles.cardTitle, { color: t.colors.text }]}>Send reset instructions</Text>
                  <Text style={[styles.cardSubtitle, { color: t.colors.grayMutedDark }]}>We email a reset link if the agent account exists.</Text>
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: t.colors.text }]}>Email</Text>
                <View
                  style={[
                    styles.fieldShell,
                    {
                      backgroundColor: t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
                      borderColor: focusedField === 'email' ? t.colors.secondary : t.colors.borderStrong,
                      shadowOpacity: focusedField === 'email' ? (t.isDark ? 0.14 : 0.16) : 0,
                    },
                  ]}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.fieldGlow,
                      {
                        backgroundColor: t.colors.secondary,
                        opacity: focusedField === 'email' ? fieldGlowOpacity : 0,
                      },
                    ]}
                  />
                  <View style={[styles.fieldIconWrap, { backgroundColor: t.isDark ? 'rgba(79, 113, 210, 0.18)' : 'rgba(15, 121, 197, 0.1)' }]}>
                    <Feather name="mail" size={18} color={t.colors.secondary} />
                  </View>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={t.colors.grayMutedDark}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="go"
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField((current) => (current === 'email' ? null : current))}
                    onSubmitEditing={onSubmit}
                    style={[styles.inputText, { color: t.colors.text }]}
                  />
                </View>
                <Text style={[styles.helperText, { color: t.colors.grayMutedDark }]}>You will see the same confirmation for any email.</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={[styles.metaText, { color: t.colors.grayMutedDark }]}>Need to try another agent email?</Text>
                <Pressable onPress={() => navigation.navigate('Login')} hitSlop={10} style={({ pressed }) => [pressed && styles.pressed]}>
                  <Text style={[styles.metaLink, { color: t.colors.primary }]}>Back to login</Text>
                </Pressable>
              </View>

              <Pressable onPress={onSubmit} disabled={loading} style={({ pressed }) => [styles.buttonPressable, pressed && styles.pressed, loading && styles.disabled]}>
                <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 1 }} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>{loading ? 'Sending...' : 'Send agent reset email'}</Text>
                  <View style={styles.primaryArrowWrap}>
                    <Feather name="arrow-right" size={18} color="#FFFFFF" />
                  </View>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login'))}
                style={({ pressed }) => [styles.secondaryButton, { borderColor: t.colors.borderStrong, backgroundColor: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.62)' }, pressed && styles.pressed]}
              >
                <Text style={[styles.secondaryButtonText, { color: t.colors.primary }]}>Return to agent sign in</Text>
              </Pressable>
            </Animated.View>

            <Text style={[styles.footerNote, { color: t.colors.grayMutedDark }]}>Clear, secure agent account recovery on mobile.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  keyboard: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  heroTopRow: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 18,
    marginTop: -50,
  },
  eyebrowText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  visualStage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    minHeight: 220,
  },
  pulseRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1.5,
  },
  pulseRingOuter: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
  },
  routeTrack: {
    position: 'absolute',
    top: 40,
    width: 170,
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  routeDot: {
    width: 28,
    height: 6,
    borderRadius: 999,
  },
  mailOrb: {
    width: 192,
    height: 192,
    borderRadius: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mailOrbRing: {
    position: 'absolute',
    width: 226,
    height: 226,
    borderRadius: 113,
    borderWidth: 1,
  },
  mailOrbInner: {
    width: 156,
    height: 156,
    borderRadius: 42,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mailTile: {
    width: 96,
    height: 84,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    position: 'absolute',
    right: 34,
    bottom: 28,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    maxWidth: 336,
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  stepsPanel: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 24,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  stepIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  stepDivider: {
    width: 1,
    height: 34,
    marginHorizontal: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  formCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
  },
  androidFormCard: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
  cardTint: {
    ...StyleSheet.absoluteFillObject,
  },
  shimmerOverlay: {
    position: 'absolute',
    top: -40,
    left: 0,
    width: 140,
    height: 400,
  },
  shimmerGradient: {
    flex: 1,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  metricValue: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
  },
  metricLabel: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  cardBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardHeaderCopy: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  fieldShell: {
    minHeight: 58,
    borderWidth: 1.5,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    shadowColor: '#1B3890',
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 0,
    overflow: 'hidden',
  },
  fieldGlow: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    left: 12,
    width: 46,
    borderRadius: 18,
  },
  fieldIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    paddingVertical: 16,
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  metaRow: {
    marginTop: 4,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  metaLink: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  buttonPressable: {
    borderRadius: 18,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  primaryArrowWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginLeft: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    marginTop: 12,
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  footerNote: {
    marginTop: 18,
    marginHorizontal: 28,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.7,
  },
});
