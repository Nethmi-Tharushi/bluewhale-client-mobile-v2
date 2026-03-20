import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Image, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AuthService } from '../../api/services';
import { useAuthStore } from '../../context/authStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/auth/AuthNavigator';
import { useTheme } from '../../theme/ThemeProvider';
import { PageDecor } from '../../components/ui';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;
type FocusField = 'email' | 'password' | null;

const HIGHLIGHTS = [
  { icon: 'shield' as const, label: 'Secure access' },
  { icon: 'users' as const, label: 'Candidate workspace' },
  { icon: 'bar-chart-2' as const, label: 'Agent insights' },
];

const FLOATING_BADGES = [
  { icon: 'clock' as const, title: 'Fast access', value: '<30s' },
  { icon: 'message-square' as const, title: 'Admin chat', value: 'Live' },
];

export default function LoginScreen({ navigation }: Props) {
  const t = useTheme();
  const { height, width } = useWindowDimensions();
  const signIn = useAuthStore((s) => s.signIn);
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<FocusField>(null);

  const compact = height < 760;
  const spacious = height >= 840;
  const narrow = width < 380;
  const cardHorizontal = narrow ? 14 : 20;
  const logoWidth = compact ? Math.min(width * 0.52, 190) : Math.min(width * 0.58, 220);
  const logoHeight = Math.round(logoWidth * 0.43);

  const heroEntrance = useRef(new Animated.Value(0)).current;
  const cardEntrance = useRef(new Animated.Value(0)).current;
  const orbFloat = useRef(new Animated.Value(0)).current;
  const badgeFloatA = useRef(new Animated.Value(0)).current;
  const badgeFloatB = useRef(new Animated.Value(0)).current;
  const ctaPulse = useRef(new Animated.Value(1)).current;
  const barWave = useRef(new Animated.Value(0)).current;
  const scanSweep = useRef(new Animated.Value(0)).current;
  const shieldPulse = useRef(new Animated.Value(0)).current;
  const cardFloat = useRef(new Animated.Value(0)).current;
  const shimmerTranslate = useRef(new Animated.Value(0)).current;
  const highlightAnimations = useRef(HIGHLIGHTS.map(() => new Animated.Value(0))).current;

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
        delay: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.stagger(
        100,
        highlightAnimations.map((value) =>
          Animated.timing(value, {
            toValue: 1,
            duration: 430,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start();

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
          duration: 2700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(badgeFloatB, {
          toValue: 0,
          duration: 2700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaPulse, {
          toValue: 1.025,
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

    const barLoop = Animated.loop(
      Animated.timing(barWave, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanSweep, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanSweep, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(400),
      ]),
    );

    const shieldLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shieldPulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shieldPulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
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

    const cardLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(cardFloat, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(cardFloat, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    orbLoop.start();
    badgeLoopA.start();
    badgeLoopB.start();
    pulseLoop.start();
    barLoop.start();
    scanLoop.start();
    shieldLoop.start();
    shimmerLoop.start();
    cardLoop.start();

    return () => {
      orbLoop.stop();
      badgeLoopA.stop();
      badgeLoopB.stop();
      pulseLoop.stop();
      barLoop.stop();
      scanLoop.stop();
      shieldLoop.stop();
      shimmerLoop.stop();
      cardLoop.stop();
    };
  }, [badgeFloatA, badgeFloatB, barWave, cardEntrance, cardFloat, ctaPulse, heroEntrance, highlightAnimations, orbFloat, scanSweep, shieldPulse, shimmerTranslate]);

  const onLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await AuthService.login(email.trim(), password);
      const token = (res as any)?.token || (res as any)?.accessToken;
      const rawUser = (res as any)?.user || (res as any)?.data?.user || (res as any);
      const user =
        rawUser && typeof rawUser === 'object'
          ? { ...rawUser, email: String((rawUser as any)?.email || email.trim()).trim() }
          : { email: email.trim() };
      if (!token) throw new Error('Token not found in response.');
      const role = String((user as any)?.userType || (user as any)?.role || '').toLowerCase();
      if (role && role !== 'agent') {
        throw new Error('Only agent accounts can log in to this app.');
      }
      await signIn({ token, user });
    } catch (e: any) {
      Alert.alert('Login failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const renderField = ({
    label,
    icon,
    value,
    onChangeText,
    placeholder,
    keyboardType,
    secureTextEntry,
    field,
    inputRef,
    onSubmitEditing,
    autoCapitalize,
  }: {
    label: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    value: string;
    onChangeText: (text: string) => void;
    placeholder: string;
    keyboardType?: 'default' | 'email-address';
    secureTextEntry?: boolean;
    field: Exclude<FocusField, null>;
    inputRef?: React.RefObject<TextInput | null>;
    onSubmitEditing?: () => void;
    autoCapitalize?: 'none' | 'sentences';
  }) => {
    const isFocused = focusedField === field;

    return (
      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: t.colors.text }]}>{label}</Text>
        <View
          style={[
            styles.fieldShell,
            {
              backgroundColor: t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
              borderColor: isFocused ? t.colors.secondary : t.colors.borderStrong,
              shadowOpacity: isFocused ? (t.isDark ? 0.14 : 0.16) : 0,
            },
          ]}
        >
          <View style={[styles.fieldIconWrap, { backgroundColor: t.isDark ? 'rgba(79, 113, 210, 0.18)' : 'rgba(15, 121, 197, 0.1)' }]}>
            <Feather name={icon} size={18} color={t.colors.secondary} />
          </View>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={t.colors.grayMutedDark}
            secureTextEntry={secureTextEntry ? !showPassword : false}
            autoCapitalize={autoCapitalize}
            keyboardType={keyboardType}
            autoCorrect={false}
            returnKeyType={secureTextEntry ? 'go' : 'next'}
            onFocus={() => setFocusedField(field)}
            onBlur={() => setFocusedField((current) => (current === field ? null : current))}
            onSubmitEditing={onSubmitEditing}
            style={[styles.inputText, { color: t.colors.text }]}
          />
          {secureTextEntry ? (
            <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={10} style={({ pressed }) => [styles.passwordToggle, pressed && styles.pressed]}>
              <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={t.colors.primary} />
              <Text style={[styles.passwordToggleText, { color: t.colors.primary }]}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  const heroTranslateY = heroEntrance.interpolate({
    inputRange: [0, 1],
    outputRange: [26, 0],
  });

  const heroOpacity = heroEntrance.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const cardTranslateY = cardEntrance.interpolate({
    inputRange: [0, 1],
    outputRange: [36, 0],
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

  const scanTranslateY = scanSweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-160, 160],
  });

  const shieldScale = shieldPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.08],
  });

  const shieldOpacity = shieldPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.24, 0.06],
  });

  const cardFloatY = cardFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });

  const shimmerX = shimmerTranslate.interpolate({
    inputRange: [0, 1],
    outputRange: [-320, 320],
  });

  return (
    <LinearGradient colors={t.colors.gradientBackground as any} style={styles.root}>
      <PageDecor />
      <View pointerEvents="none" style={styles.extraDecor}>
        <LinearGradient colors={['rgba(15, 121, 197, 0.12)', 'rgba(15, 121, 197, 0.01)']} style={styles.rightGlow} />
        <View style={[styles.gridPlane, { borderColor: t.isDark ? 'rgba(153, 192, 255, 0.1)' : 'rgba(27, 56, 144, 0.08)' }]} />
      </View>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: compact ? 8 : spacious ? 28 : 16,
                paddingBottom: compact ? 18 : 30,
              },
            ]}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={[styles.hero, compact && styles.heroCompact, { opacity: heroOpacity, transform: [{ translateY: heroTranslateY }] }]}>
              <View style={styles.heroTopRow}>
                <Pressable
                  onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('GetStarted'))}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.backButton,
                    {
                      backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.86)' : 'rgba(255,255,255,0.78)',
                      borderColor: t.colors.border,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Feather name="chevron-left" size={20} color={t.colors.primary} />
                </Pressable>
              </View>

              <View style={[styles.eyebrow, { backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.86)' : 'rgba(255,255,255,0.74)', borderColor: t.colors.border }]}>
                <Feather name="star" size={14} color={t.colors.secondary} />
                <Text style={[styles.eyebrowText, { color: t.colors.primary }]}>Agent portal</Text>
              </View>

              <View style={styles.visualStage}>
                <View style={[styles.logoPlateBack, { backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.44)' : 'rgba(255,255,255,0.34)' }]} />
                <View style={[styles.logoPlateFront, { backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.28)' : 'rgba(255,255,255,0.22)' }]} />
                <Animated.View style={[styles.shieldHalo, { borderColor: t.isDark ? 'rgba(153, 192, 255, 0.18)' : 'rgba(15, 121, 197, 0.16)', opacity: shieldOpacity, transform: [{ scale: shieldScale }] }]} />

                <Animated.View
                  style={[
                    styles.floatingBadge,
                    styles.floatingBadgeLeft,
                    {
                      backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.92)' : 'rgba(255,255,255,0.84)',
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

                <Animated.View style={[styles.logoOrb, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.45)', transform: [{ translateY: orbTranslateY }] }]}>
                  <View style={[styles.orbRing, { borderColor: t.isDark ? 'rgba(153, 192, 255, 0.16)' : 'rgba(27, 56, 144, 0.08)' }]} />
                  <View style={[styles.orbRingInner, { borderColor: t.isDark ? 'rgba(153, 192, 255, 0.2)' : 'rgba(15, 121, 197, 0.14)' }]} />
                  <Animated.View style={[styles.scanBeam, { transform: [{ translateY: scanTranslateY }] }]}>
                    <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} style={styles.scanBeamGradient} />
                  </Animated.View>
                  <Image source={require('../../../assets/blue-whale-logo.webp')} style={{ width: logoWidth, height: logoHeight }} resizeMode="contain" />
                </Animated.View>

                <Animated.View
                  style={[
                    styles.floatingBadge,
                    styles.floatingBadgeRight,
                    {
                      backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.92)' : 'rgba(255,255,255,0.84)',
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

              <Text style={[styles.title, { color: t.colors.primary }, compact && styles.titleCompact]}>Welcome back, agent</Text>
              <Text style={[styles.subtitle, { color: t.colors.grayMutedDark }, compact && styles.subtitleCompact]}>
                Sign in to manage candidates, follow activity, and keep your workflow moving.
              </Text>

              <View style={[styles.securityWaveWrap, { backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.82)' : 'rgba(255,255,255,0.7)', borderColor: t.colors.border }]}>
                <Text style={[styles.securityWaveLabel, { color: t.colors.primary }]}>Secure agent access</Text>
                <View style={styles.securityBarsRow}>
                  {[0, 1, 2, 3, 4].map((index) => {
                    const scaleY = barWave.interpolate({
                      inputRange: [0, 0.25, 0.5, 0.75, 1],
                      outputRange:
                        index === 0
                          ? [0.55, 1, 0.7, 0.9, 0.55]
                          : index === 1
                            ? [0.75, 0.55, 1, 0.68, 0.75]
                            : index === 2
                              ? [0.58, 0.9, 0.62, 1, 0.58]
                              : index === 3
                                ? [0.9, 0.62, 0.98, 0.55, 0.9]
                                : [0.62, 0.88, 0.55, 0.92, 0.62],
                    });

                    return <Animated.View key={index} style={[styles.securityBar, { backgroundColor: index % 2 === 0 ? t.colors.secondary : t.colors.primary, transform: [{ scaleY }] }]} />;
                  })}
                </View>
              </View>

              <View style={[styles.highlightRow, compact && styles.highlightRowCompact]}>
                {HIGHLIGHTS.map((item, index) => {
                  const translateY = highlightAnimations[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  });

                  return (
                    <Animated.View
                      key={item.label}
                      style={{
                        opacity: highlightAnimations[index],
                        transform: [{ translateY }],
                      }}
                    >
                      <View
                        style={[
                          styles.highlightChip,
                          {
                            backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.82)' : 'rgba(255,255,255,0.72)',
                            borderColor: t.isDark ? 'rgba(58, 84, 134, 0.75)' : 'rgba(215, 227, 245, 0.92)',
                          },
                        ]}
                      >
                        <Feather name={item.icon} size={14} color={t.colors.secondary} />
                        <Text style={[styles.highlightText, { color: t.colors.text }]}>{item.label}</Text>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            </Animated.View>

            <Animated.View
              style={[
                styles.formCard,
                {
                  marginHorizontal: cardHorizontal,
                  backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.88)' : 'rgba(248, 250, 252, 0.84)',
                  borderColor: t.isDark ? 'rgba(58, 84, 134, 0.75)' : 'rgba(255,255,255,0.78)',
                  transform: [{ translateY: cardTranslateY }, { translateY: cardFloatY }],
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
                  <Text style={[styles.metricValue, { color: t.colors.primary }]}>1</Text>
                  <Text style={[styles.metricLabel, { color: t.colors.grayMutedDark }]}>secure sign-in</Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)', borderColor: t.colors.border }]}>
                  <Text style={[styles.metricValue, { color: t.colors.primary }]}>5</Text>
                  <Text style={[styles.metricLabel, { color: t.colors.grayMutedDark }]}>agent modules</Text>
                </View>
              </View>

              <View style={styles.cardHeader}>
                <View style={styles.cardBadgeWrap}>
                  <Animated.View style={[styles.cardBadgePulse, { borderColor: t.isDark ? 'rgba(153, 192, 255, 0.14)' : 'rgba(15, 121, 197, 0.12)', opacity: shieldOpacity, transform: [{ scale: shieldScale }] }]} />
                  <View style={[styles.cardBadge, { backgroundColor: t.isDark ? 'rgba(79, 113, 210, 0.2)' : 'rgba(15, 121, 197, 0.12)' }]}>
                    <Feather name="shield" size={18} color={t.colors.secondary} />
                  </View>
                </View>
                <View style={styles.cardHeaderCopy}>
                  <Text style={[styles.cardTitle, { color: t.colors.text }]}>Sign in securely</Text>
                  <Text style={[styles.cardSubtitle, { color: t.colors.grayMutedDark }]}>Use your agent account to continue into the workspace.</Text>
                </View>
              </View>

              {renderField({
                label: 'Email',
                icon: 'mail',
                value: email,
                onChangeText: setEmail,
                placeholder: 'you@example.com',
                keyboardType: 'email-address',
                field: 'email',
                onSubmitEditing: () => passwordRef.current?.focus(),
                autoCapitalize: 'none',
              })}

              {renderField({
                label: 'Password',
                icon: 'lock',
                value: password,
                onChangeText: setPassword,
                placeholder: 'Enter your password',
                secureTextEntry: true,
                field: 'password',
                inputRef: passwordRef,
                onSubmitEditing: onLogin,
                autoCapitalize: 'none',
              })}

              <View style={styles.metaRow}>
                <Text style={[styles.metaText, { color: t.colors.grayMutedDark }]}>Only registered agent accounts can sign in here.</Text>
                <Pressable onPress={() => navigation.navigate('ForgotPassword')} hitSlop={10} style={({ pressed }) => [pressed && styles.pressed]}>
                  <Text style={[styles.metaLink, { color: t.colors.primary }]}>Forgot password?</Text>
                </Pressable>
              </View>

              <Animated.View style={{ transform: [{ scale: ctaPulse }] }}>
                <Pressable onPress={onLogin} disabled={loading} style={({ pressed }) => [styles.buttonPressable, pressed && styles.pressed, loading && styles.disabled]}>
                  <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 1 }} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>{loading ? 'Signing in...' : 'Sign in as agent'}</Text>
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
                    backgroundColor: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.62)',
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.secondaryButtonText, { color: t.colors.primary }]}>Create agent account</Text>
              </Pressable>
            </Animated.View>

            <Text style={[styles.footerNote, { color: t.colors.grayMutedDark }]}>Keep candidates, updates, and admin communication together on mobile.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
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
  keyboard: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
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
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  heroCompact: {
    paddingBottom: 12,
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
    marginTop: -50,
    marginBottom: 18,
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
  },
  logoPlateBack: {
    position: 'absolute',
    width: 214,
    height: 214,
    borderRadius: 34,
    transform: [{ rotate: '-8deg' }, { translateX: -18 }, { translateY: 6 }],
  },
  logoPlateFront: {
    position: 'absolute',
    width: 214,
    height: 214,
    borderRadius: 34,
    transform: [{ rotate: '8deg' }, { translateX: 18 }, { translateY: 12 }],
  },
  shieldHalo: {
    position: 'absolute',
    width: 228,
    height: 228,
    borderRadius: 114,
    borderWidth: 1,
  },
  logoOrb: {
    width: 196,
    height: 196,
    borderRadius: 98,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbRing: {
    position: 'absolute',
    width: 228,
    height: 228,
    borderRadius: 114,
    borderWidth: 1,
  },
  orbRingInner: {
    position: 'absolute',
    width: 164,
    height: 164,
    borderRadius: 82,
    borderWidth: 1,
  },
  scanBeam: {
    position: 'absolute',
    width: 220,
    height: 64,
    overflow: 'hidden',
  },
  scanBeamGradient: {
    flex: 1,
  },
  floatingBadge: {
    position: 'absolute',
    width: 112,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: '#153C94',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  floatingBadgeLeft: {
    left: 0,
    top: 28,
  },
  floatingBadgeRight: {
    right: 0,
    bottom: 22,
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
    fontSize: 18,
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
    maxWidth: 340,
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitleCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  securityWaveWrap: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 14,
  },
  securityWaveLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  securityBarsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  securityBar: {
    width: 10,
    height: 28,
    borderRadius: 999,
  },
  highlightRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
  },
  highlightRowCompact: {
    gap: 8,
    marginTop: 14,
  },
  highlightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  highlightText: {
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
  cardBadgeWrap: {
    width: 46,
    height: 46,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadgePulse: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
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
  passwordToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
  },
  passwordToggleText: {
    marginLeft: 5,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  metaText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  metaLink: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  buttonPressable: {
    marginTop: 4,
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
  footerNote: {
    marginTop: 18,
    marginBottom: 8,
    marginHorizontal: 24,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.62,
  },
});
