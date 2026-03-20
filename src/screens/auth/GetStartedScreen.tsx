import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/auth/AuthNavigator';
import { useTheme } from '../../theme/ThemeProvider';
import { PageDecor } from '../../components/ui';

type Props = NativeStackScreenProps<AuthStackParamList, 'GetStarted'>;

const STEPS = [
  { icon: 'users' as const, title: 'Manage candidates', text: 'Track profiles, documents, and next actions in one place.' },
  { icon: 'message-square' as const, title: 'Coordinate fast', text: 'Keep admin chat, meetings, and updates close at hand.' },
  { icon: 'bar-chart-2' as const, title: 'See the pipeline', text: 'Follow performance, activity, and progress from your phone.' },
];

const FLOATING_BADGES = [
  { icon: 'user-check' as const, title: 'Managed profiles', value: '240+' },
  { icon: 'activity' as const, title: 'Admin support', value: 'Live' },
];

const SIGNAL_ITEMS = ['Candidate workspace', 'Agent analytics', 'Live chat'];
const MARKET_TAGS = ['Pipeline overview', 'Managed candidates', 'Document follow-up', 'Meetings and tasks', 'Admin support'];

export default function GetStartedScreen({ navigation }: Props) {
  const t = useTheme();
  const isAndroid = Platform.OS === 'android';
  const { width, height } = useWindowDimensions();
  const compact = height < 760;
  const logoWidth = compact ? Math.min(width * 0.64, 220) : Math.min(width * 0.68, 250);
  const logoHeight = Math.round(logoWidth * 0.43);

  const heroEntrance = useRef(new Animated.Value(0)).current;
  const cardEntrance = useRef(new Animated.Value(0)).current;
  const ctaPulse = useRef(new Animated.Value(1)).current;
  const orbFloat = useRef(new Animated.Value(0)).current;
  const badgeFloatA = useRef(new Animated.Value(0)).current;
  const badgeFloatB = useRef(new Animated.Value(0)).current;
  const orbitRotate = useRef(new Animated.Value(0)).current;
  const shimmerTranslate = useRef(new Animated.Value(0)).current;
  const signalPulse = useRef(new Animated.Value(0)).current;
  const ripplePulse = useRef(new Animated.Value(0)).current;
  const tickerShift = useRef(new Animated.Value(0)).current;
  const glowDrift = useRef(new Animated.Value(0)).current;
  const stepAnimations = useRef(STEPS.map(() => new Animated.Value(0))).current;

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
        duration: 750,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.stagger(
        110,
        stepAnimations.map((value) =>
          Animated.timing(value, {
            toValue: 1,
            duration: 450,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaPulse, {
          toValue: 1.03,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ctaPulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const orbLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(orbFloat, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orbFloat, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const badgeLoopA = Animated.loop(
      Animated.sequence([
        Animated.timing(badgeFloatA, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(badgeFloatA, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const badgeLoopB = Animated.loop(
      Animated.sequence([
        Animated.timing(badgeFloatB, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(badgeFloatB, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const orbitLoop = Animated.loop(
      Animated.timing(orbitRotate, {
        toValue: 1,
        duration: 11000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerTranslate, {
          toValue: 1,
          duration: 2200,
          delay: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerTranslate, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    const signalLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(signalPulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(signalPulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const rippleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ripplePulse, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ripplePulse, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const tickerLoop = Animated.loop(
      Animated.timing(tickerShift, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowDrift, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowDrift, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();
    orbLoop.start();
    badgeLoopA.start();
    badgeLoopB.start();
    orbitLoop.start();
    shimmerLoop.start();
    signalLoop.start();
    rippleLoop.start();
    tickerLoop.start();
    glowLoop.start();

    return () => {
      pulseLoop.stop();
      orbLoop.stop();
      badgeLoopA.stop();
      badgeLoopB.stop();
      orbitLoop.stop();
      shimmerLoop.stop();
      signalLoop.stop();
      rippleLoop.stop();
      tickerLoop.stop();
      glowLoop.stop();
    };
  }, [badgeFloatA, badgeFloatB, cardEntrance, ctaPulse, glowDrift, heroEntrance, orbitRotate, orbFloat, ripplePulse, shimmerTranslate, signalPulse, stepAnimations, tickerShift]);

  const heroTranslateY = heroEntrance.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });

  const heroOpacity = heroEntrance.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const cardTranslateY = cardEntrance.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  });

  const orbTranslateY = orbFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });

  const badgeATranslateY = badgeFloatA.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  const badgeBTranslateY = badgeFloatB.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 8],
  });

  const orbitRotation = orbitRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const reverseOrbitRotation = orbitRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  const shimmerX = shimmerTranslate.interpolate({
    inputRange: [0, 1],
    outputRange: [-320, 320],
  });

  const signalScale = signalPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  const signalOpacity = signalPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });

  const rippleScaleOuter = ripplePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.12],
  });

  const rippleOpacityOuter = ripplePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.08],
  });

  const rippleScaleInner = ripplePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1.06],
  });

  const rippleOpacityInner = ripplePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.04],
  });

  const tickerTranslateX = tickerShift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -260],
  });

  const glowTranslateY = glowDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -16],
  });

  const glowScale = glowDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  return (
    <LinearGradient colors={t.colors.gradientBackground as any} style={styles.root}>
      <PageDecor />
      <View pointerEvents="none" style={styles.extraDecor}>
        <Animated.View style={{ transform: [{ translateY: glowTranslateY }, { scale: glowScale }] }}>
          <LinearGradient colors={['rgba(15, 121, 197, 0.12)', 'rgba(15, 121, 197, 0.01)']} style={styles.rightGlow} />
        </Animated.View>
        <View style={[styles.gridPlane, { borderColor: t.isDark ? 'rgba(153, 192, 255, 0.1)' : 'rgba(27, 56, 144, 0.08)' }]} />
      </View>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingTop: compact ? 8 : 20, paddingBottom: compact ? 20 : 32 }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Animated.View style={[styles.hero, { opacity: heroOpacity, transform: [{ translateY: heroTranslateY }] }]}>
            <View style={[styles.badge, { backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.88)' : 'rgba(255,255,255,0.8)', borderColor: t.colors.border }]}>
              <Feather name="star" size={14} color={t.colors.secondary} />
              <Text style={[styles.badgeText, { color: t.colors.primary }]}>Blue Whale agent workspace</Text>
            </View>

            <View style={styles.visualStage}>
              <Animated.View style={[styles.rippleRingOuter, { borderColor: t.isDark ? 'rgba(153, 192, 255, 0.14)' : 'rgba(15, 121, 197, 0.14)', opacity: rippleOpacityOuter, transform: [{ scale: rippleScaleOuter }] }]} />
              <Animated.View style={[styles.rippleRingInner, { borderColor: t.isDark ? 'rgba(153, 192, 255, 0.12)' : 'rgba(27, 56, 144, 0.1)', opacity: rippleOpacityInner, transform: [{ scale: rippleScaleInner }] }]} />
              <Animated.View style={[styles.orbitTrackOuter, { borderColor: t.isDark ? 'rgba(153, 192, 255, 0.12)' : 'rgba(27, 56, 144, 0.08)', transform: [{ rotate: orbitRotation }] }]}>
                <View style={[styles.orbitDot, styles.orbitDotTop, { backgroundColor: t.colors.secondary }]} />
                <View style={[styles.orbitDot, styles.orbitDotBottom, { backgroundColor: t.colors.primary }]} />
              </Animated.View>
              <Animated.View style={[styles.orbitTrackInner, { borderColor: t.isDark ? 'rgba(153, 192, 255, 0.14)' : 'rgba(15, 121, 197, 0.1)', transform: [{ rotate: reverseOrbitRotation }] }]}>
                <View style={[styles.orbitMiniDot, styles.orbitMiniDotLeft, { backgroundColor: t.colors.secondary }]} />
                <View style={[styles.orbitMiniDot, styles.orbitMiniDotRight, { backgroundColor: t.colors.primary }]} />
              </Animated.View>

              <Animated.View
                style={[
                  styles.floatingBadge,
                  styles.floatingBadgeLeft,
                  isAndroid && styles.androidFloatingBadge,
                  {
                    backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.92)' : isAndroid ? '#FFFFFF' : 'rgba(255,255,255,0.84)',
                    borderColor: t.colors.border,
                    transform: [{ translateY: badgeATranslateY }, { rotate: '-6deg' }],
                  },
                ]}
              >
                <View style={[styles.floatingBadgeIcon, { backgroundColor: t.isDark ? 'rgba(79, 113, 210, 0.2)' : 'rgba(15, 121, 197, 0.12)' }]}>
                  <Feather name={FLOATING_BADGES[0].icon} size={16} color={t.colors.secondary} />
                </View>
                <Text style={[styles.floatingValue, { color: t.colors.text }]}>{FLOATING_BADGES[0].value}</Text>
                <Text style={[styles.floatingLabel, { color: t.colors.grayMutedDark }]}>{FLOATING_BADGES[0].title}</Text>
              </Animated.View>

              <Animated.View style={[styles.logoOrb, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.48)', transform: [{ translateY: orbTranslateY }] }]}>
                <View style={[styles.orbRing, { borderColor: t.isDark ? 'rgba(153, 192, 255, 0.16)' : 'rgba(27, 56, 144, 0.08)' }]} />
                <View style={[styles.orbRingInner, { borderColor: t.isDark ? 'rgba(153, 192, 255, 0.2)' : 'rgba(15, 121, 197, 0.14)' }]} />
                <Image source={require('../../../assets/blue-whale-logo.webp')} style={{ width: logoWidth, height: logoHeight }} resizeMode="contain" />
              </Animated.View>

              <Animated.View
                style={[
                  styles.floatingBadge,
                  styles.floatingBadgeRight,
                  isAndroid && styles.androidFloatingBadge,
                  {
                    backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.92)' : isAndroid ? '#FFFFFF' : 'rgba(255,255,255,0.84)',
                    borderColor: t.colors.border,
                    transform: [{ translateY: badgeBTranslateY }, { rotate: '5deg' }],
                  },
                ]}
              >
                <View style={[styles.floatingBadgeIcon, { backgroundColor: t.isDark ? 'rgba(79, 113, 210, 0.2)' : 'rgba(15, 121, 197, 0.12)' }]}>
                  <Feather name={FLOATING_BADGES[1].icon} size={16} color={t.colors.secondary} />
                </View>
                <Text style={[styles.floatingValue, { color: t.colors.text }]}>{FLOATING_BADGES[1].value}</Text>
                <Text style={[styles.floatingLabel, { color: t.colors.grayMutedDark }]}>{FLOATING_BADGES[1].title}</Text>
              </Animated.View>
            </View>

            <Text style={[styles.title, { color: t.colors.primary }]}>Run your agent workflow anywhere</Text>
            <Text style={[styles.subtitle, { color: t.colors.grayMutedDark }]}>
              Manage candidates, follow the pipeline, and stay connected with admins from one mobile workspace.
            </Text>

            <View style={[styles.signalStrip, { backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.82)' : 'rgba(255,255,255,0.7)', borderColor: t.colors.border }]}>
              <Animated.View style={[styles.signalDot, { backgroundColor: t.colors.secondary, opacity: signalOpacity, transform: [{ scale: signalScale }] }]} />
              {SIGNAL_ITEMS.map((item, index) => (
                <React.Fragment key={item}>
                  <Text style={[styles.signalText, { color: t.colors.text }]}>{item}</Text>
                  {index < SIGNAL_ITEMS.length - 1 ? <View style={[styles.signalDivider, { backgroundColor: t.colors.borderStrong }]} /> : null}
                </React.Fragment>
              ))}
            </View>

            <View style={[styles.tickerViewport, { borderColor: t.colors.border, backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.72)' : 'rgba(255,255,255,0.64)' }]}>
              <Animated.View style={[styles.tickerTrack, { transform: [{ translateX: tickerTranslateX }] }]}>
                {[...MARKET_TAGS, ...MARKET_TAGS].map((item, index) => (
                  <View key={`${item}-${index}`} style={[styles.tickerChip, { borderColor: t.colors.borderStrong, backgroundColor: t.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.78)' }]}>
                    <Feather name="star" size={12} color={t.colors.secondary} />
                    <Text style={[styles.tickerText, { color: t.colors.text }]}>{item}</Text>
                  </View>
                ))}
              </Animated.View>
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.featureCard,
              isAndroid && styles.androidFeatureCard,
              {
                backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.9)' : isAndroid ? '#F8FAFC' : 'rgba(248, 250, 252, 0.84)',
                borderColor: t.isDark ? 'rgba(58, 84, 134, 0.75)' : isAndroid ? '#D7E2F2' : 'rgba(255,255,255,0.82)',
                transform: [{ translateY: cardTranslateY }],
                opacity: heroOpacity,
              },
              t.shadow.card,
            ]}
          >
            <LinearGradient
              colors={
                t.isDark
                  ? (['rgba(79, 113, 210, 0.18)', 'rgba(15, 121, 197, 0.08)'] as any)
                  : (['rgba(27, 56, 144, 0.08)', 'rgba(15, 121, 197, 0.02)'] as any)
              }
              style={styles.cardTint}
            />
            <Animated.View pointerEvents="none" style={[styles.shimmerOverlay, { transform: [{ translateX: shimmerX }, { rotate: '18deg' }] }]}>
              <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']} style={styles.shimmerGradient} />
            </Animated.View>

            <View style={styles.metricRow}>
              <View style={[styles.metricCard, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)', borderColor: t.colors.border }]}>
                <Text style={[styles.metricValue, { color: t.colors.primary }]}>5</Text>
                <Text style={[styles.metricLabel, { color: t.colors.grayMutedDark }]}>core agent tools</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)', borderColor: t.colors.border }]}>
                <Text style={[styles.metricValue, { color: t.colors.primary }]}>1</Text>
                <Text style={[styles.metricLabel, { color: t.colors.grayMutedDark }]}>shared workspace</Text>
              </View>
            </View>

            {STEPS.map((step, index) => {
              const stepTranslateY = stepAnimations[index].interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              });

              return (
                <Animated.View key={step.title} style={[styles.stepRow, { opacity: stepAnimations[index], transform: [{ translateY: stepTranslateY }] }]}>
                  <View style={[styles.stepIndexWrap, { borderColor: t.colors.borderStrong, backgroundColor: t.isDark ? 'rgba(79, 113, 210, 0.16)' : 'rgba(255,255,255,0.76)' }]}>
                    <Text style={[styles.stepIndex, { color: t.colors.primary }]}>{index + 1}</Text>
                  </View>
                  <View style={[styles.stepIcon, { backgroundColor: t.isDark ? 'rgba(79, 113, 210, 0.2)' : 'rgba(15, 121, 197, 0.12)' }]}>
                    <Feather name={step.icon} size={18} color={t.colors.secondary} />
                  </View>
                  <View style={styles.stepCopy}>
                    <Text style={[styles.stepTitle, { color: t.colors.text }]}>{step.title}</Text>
                    <Text style={[styles.stepText, { color: t.colors.grayMutedDark }]}>{step.text}</Text>
                  </View>
                </Animated.View>
              );
            })}

            <Animated.View style={{ transform: [{ scale: ctaPulse }] }}>
              <Pressable onPress={() => navigation.navigate('Login')} style={({ pressed }) => [styles.primaryPressable, pressed && styles.pressed]}>
                <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 1 }} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Sign in as agent</Text>
                  <View style={styles.primaryArrowWrap}>
                    <Feather name="arrow-right" size={18} color="#FFFFFF" />
                  </View>
                </LinearGradient>
              </Pressable>
            </Animated.View>

            <Pressable
              onPress={() => navigation.navigate('Register')}
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  borderColor: t.colors.borderStrong,
                  backgroundColor: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.64)',
                },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: t.colors.primary }]}>Create agent account</Text>
            </Pressable>

            <Pressable onPress={() => navigation.navigate('Login')} hitSlop={10} style={({ pressed }) => [styles.signInLinkWrap, pressed && styles.pressed]}>
              <Text style={[styles.signInLink, { color: t.colors.primary }]}>Already registered as an agent? Sign in</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  extraDecor: {
    ...StyleSheet.absoluteFillObject,
  },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  rightGlow: {
    position: 'absolute',
    top: 120,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  gridPlane: {
    position: 'absolute',
    top: 150,
    right: -24,
    width: 180,
    height: 180,
    borderRadius: 28,
    borderWidth: 1,
    transform: [{ rotate: '14deg' }],
  },
  hero: {
    alignItems: 'center',
    paddingBottom: 18,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 18,
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  visualStage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  rippleRingOuter: {
    position: 'absolute',
    width: 288,
    height: 288,
    borderRadius: 144,
    borderWidth: 1,
  },
  rippleRingInner: {
    position: 'absolute',
    width: 236,
    height: 236,
    borderRadius: 118,
    borderWidth: 1,
  },
  orbitTrackOuter: {
    position: 'absolute',
    width: 262,
    height: 262,
    borderRadius: 131,
    borderWidth: 1,
  },
  orbitTrackInner: {
    position: 'absolute',
    width: 214,
    height: 214,
    borderRadius: 107,
    borderWidth: 1,
  },
  orbitDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  orbitDotTop: {
    top: -6,
    left: 125,
  },
  orbitDotBottom: {
    bottom: -6,
    left: 125,
  },
  orbitMiniDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  orbitMiniDotLeft: {
    left: -4,
    top: 103,
  },
  orbitMiniDotRight: {
    right: -4,
    top: 103,
  },
  logoOrb: {
    width: 242,
    height: 242,
    borderRadius: 106,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbRing: {
    position: 'absolute',
    width: 244,
    height: 244,
    borderRadius: 122,
    borderWidth: 1,
  },
  orbRingInner: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
  },
  floatingBadge: {
    position: 'absolute',
    width: 118,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: '#153C94',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  androidFloatingBadge: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
  floatingBadgeLeft: {
    left: 0,
    top: 36,
  },
  floatingBadgeRight: {
    right: 0,
    bottom: 26,
  },
  floatingBadgeIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  floatingValue: {
    fontSize: 19,
    lineHeight: 22,
    fontWeight: '900',
  },
  floatingLabel: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  title: {
    maxWidth: 320,
    textAlign: 'center',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
  },
  subtitle: {
    maxWidth: 340,
    marginTop: 10,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  signalStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
  },
  signalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  signalText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  signalDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 8,
  },
  tickerViewport: {
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 999,
    marginTop: 12,
    paddingVertical: 8,
  },
  tickerTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  tickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginRight: 10,
  },
  tickerText: {
    marginLeft: 6,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  featureCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
  },
  androidFeatureCard: {
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
    height: 420,
  },
  shimmerGradient: {
    flex: 1,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  metricValue: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
  },
  metricLabel: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 14,
  },
  stepIndexWrap: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 6,
  },
  stepIndex: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
  },
  stepIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepCopy: {
    flex: 1,
    paddingTop: 2,
  },
  stepTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  stepText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  primaryPressable: {
    marginTop: 22,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#1F4B9F',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  primaryArrowWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  signInLinkWrap: {
    alignSelf: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  signInLink: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.92,
  },
});
