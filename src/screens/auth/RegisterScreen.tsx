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
import { formatUaeMobileInput, isValidUaeMobile, normalizeUaeMobile, UAE_PHONE_EXAMPLE } from '../../utils/phone';
import { clearSavedJobs } from '../../utils/savedJobsStorage';
import { PageDecor } from '../../components/ui';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;
type FocusField = 'companyName' | 'contactPerson' | 'email' | 'phone' | 'companyAddress' | 'password' | null;

const HIGHLIGHTS = [
  { icon: 'users' as const, label: 'Managed candidates' },
  { icon: 'message-square' as const, label: 'Admin coordination' },
  { icon: 'bar-chart-2' as const, label: 'Agent analytics' },
];

const PROFILE_STEPS = ['Company profile', 'Contact details', 'Secure access'];

const STAR_NODES = [
  { top: 28, left: 42, size: 10 },
  { top: 76, right: 34, size: 8 },
  { bottom: 40, left: 28, size: 12 },
  { bottom: 58, right: 44, size: 9 },
];

export default function RegisterScreen({ navigation }: Props) {
  const t = useTheme();
  const isAndroid = Platform.OS === 'android';
  const { height, width } = useWindowDimensions();
  const signIn = useAuthStore((s) => s.signIn);
  const contactPersonRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const companyAddressRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<FocusField>(null);

  const compact = height < 760;
  const spacious = height >= 840;
  const narrow = width < 380;
  const cardHorizontal = narrow ? 14 : 20;
  const logoWidth = compact ? Math.min(width * 0.5, 186) : Math.min(width * 0.56, 214);
  const logoHeight = Math.round(logoWidth * 0.43);

  const heroEntrance = useRef(new Animated.Value(0)).current;
  const cardEntrance = useRef(new Animated.Value(0)).current;
  const orbFloat = useRef(new Animated.Value(0)).current;
  const chipAnimations = useRef(HIGHLIGHTS.map(() => new Animated.Value(0))).current;
  const progressLoop = useRef(new Animated.Value(0)).current;
  const shimmerTranslate = useRef(new Animated.Value(0)).current;
  const nodePulse = useRef(new Animated.Value(0)).current;
  const cardFloat = useRef(new Animated.Value(0)).current;
  const glowDrift = useRef(new Animated.Value(0)).current;

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
        chipAnimations.map((value) =>
          Animated.timing(value, {
            toValue: 1,
            duration: 430,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start();

    const animatedLoops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(orbFloat, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(orbFloat, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(progressLoop, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          Animated.timing(progressLoop, { toValue: 0, duration: 0, useNativeDriver: false }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerTranslate, { toValue: 1, duration: 2100, delay: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(shimmerTranslate, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(nodePulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(nodePulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(cardFloat, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(cardFloat, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowDrift, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(glowDrift, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
    ];

    animatedLoops.forEach((loop) => loop.start());
    return () => animatedLoops.forEach((loop) => loop.stop());
  }, [cardEntrance, cardFloat, chipAnimations, glowDrift, heroEntrance, nodePulse, orbFloat, progressLoop, shimmerTranslate]);

  const onRegister = async () => {
    if (!companyName.trim() || !contactPerson.trim() || !companyAddress.trim() || !email.trim() || password.length < 6) {
      Alert.alert('Invalid details', 'Please enter company details, contact email, and a password with at least 6 characters.');
      return;
    }
    const normalizedPhone = normalizeUaeMobile(phone);
    if (phone.trim() && !isValidUaeMobile(phone)) {
      Alert.alert('Invalid phone', `Use UAE phone format like ${UAE_PHONE_EXAMPLE} or 04XXXXXXXX.`);
      return;
    }
    setLoading(true);
    try {
      const res = await AuthService.signup({
        name: contactPerson.trim(),
        email: email.trim(),
        phone: normalizedPhone || undefined,
        password,
        userType: 'agent',
        companyName: companyName.trim(),
        companyAddress: companyAddress.trim(),
        contactPerson: contactPerson.trim(),
      });
      const token = (res as any)?.token || (res as any)?.accessToken;
      const rawUser = (res as any)?.user || (res as any);
      const user =
        rawUser && typeof rawUser === 'object'
          ? {
              ...rawUser,
              name: String((rawUser as any)?.name || contactPerson.trim()).trim(),
              fullName: String((rawUser as any)?.fullName || contactPerson.trim()).trim(),
              email: String((rawUser as any)?.email || email.trim()).trim(),
              phone: String((rawUser as any)?.phone || normalizedPhone || '').trim() || undefined,
              companyName: String((rawUser as any)?.companyName || companyName.trim()).trim(),
              companyAddress: String((rawUser as any)?.companyAddress || companyAddress.trim()).trim(),
              contactPerson: String((rawUser as any)?.contactPerson || contactPerson.trim()).trim(),
              userType: (rawUser as any)?.userType || (rawUser as any)?.role || 'agent',
            }
          : {
              name: contactPerson.trim(),
              fullName: contactPerson.trim(),
              email: email.trim(),
              phone: normalizedPhone || undefined,
              companyName: companyName.trim(),
              companyAddress: companyAddress.trim(),
              contactPerson: contactPerson.trim(),
              userType: 'agent',
            };
      if (!token) throw new Error('Token not found in response.');
      await clearSavedJobs(String((user as any)?._id || (user as any)?.id || (user as any)?.email || (user as any)?.phone || email.trim()).trim() || null);
      await signIn({ token, user });
    } catch (e: any) {
      Alert.alert('Register failed', e?.userMessage || e?.message || 'Please try again');
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
    field,
    inputRef,
    onSubmitEditing,
    autoCapitalize,
    keyboardType,
    secureTextEntry,
    helperText,
  }: {
    label: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    value: string;
    onChangeText: (text: string) => void;
    placeholder: string;
    field: Exclude<FocusField, null>;
    inputRef?: React.RefObject<TextInput | null>;
    onSubmitEditing?: () => void;
    autoCapitalize?: 'none' | 'words' | 'sentences';
    keyboardType?: 'default' | 'email-address' | 'phone-pad';
    secureTextEntry?: boolean;
    helperText?: string;
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
            autoCapitalize={autoCapitalize}
            keyboardType={keyboardType}
            autoCorrect={false}
            secureTextEntry={secureTextEntry ? !showPassword : false}
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
        {helperText ? <Text style={[styles.helperText, { color: t.colors.grayMutedDark }]}>{helperText}</Text> : null}
      </View>
    );
  };

  const heroTranslateY = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [26, 0] });
  const heroOpacity = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const cardTranslateY = cardEntrance.interpolate({ inputRange: [0, 1], outputRange: [36, 0] });
  const orbTranslateY = orbFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const progressWidth = progressLoop.interpolate({ inputRange: [0, 1], outputRange: ['14%', '84%'] });
  const progressDotTranslateX = progressLoop.interpolate({ inputRange: [0, 1], outputRange: [0, 184] });
  const shimmerX = shimmerTranslate.interpolate({ inputRange: [0, 1], outputRange: [-320, 320] });
  const nodeScale = nodePulse.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.12] });
  const nodeOpacity = nodePulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const cardFloatY = cardFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const glowTranslateY = glowDrift.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  const glowScale = glowDrift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <LinearGradient colors={t.colors.gradientBackground as any} style={styles.root}>
      <PageDecor />
      <View pointerEvents="none" style={styles.extraDecor}>
        <Animated.View style={{ transform: [{ translateY: glowTranslateY }, { scale: glowScale }] }}>
          <LinearGradient colors={['rgba(15, 121, 197, 0.12)', 'rgba(15, 121, 197, 0.01)']} style={styles.rightGlow} />
        </Animated.View>
        <LinearGradient colors={['rgba(27, 56, 144, 0.1)', 'rgba(27, 56, 144, 0.01)']} style={styles.leftGlow} />
      </View>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingTop: compact ? 8 : spacious ? 28 : 16, paddingBottom: compact ? 18 : 30 }]}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={[styles.hero, compact && styles.heroCompact, { opacity: heroOpacity, transform: [{ translateY: heroTranslateY }] }]}>
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
                <Feather name="star" size={14} color={t.colors.secondary} />
                <Text style={[styles.eyebrowText, { color: t.colors.primary }]}>Agent signup</Text>
              </View>

              <View style={styles.visualStage}>
                <View style={[styles.profileCardBack, { backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.42)' : 'rgba(255,255,255,0.36)' }]} />
                <View style={[styles.profileCardFront, { backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.26)' : 'rgba(255,255,255,0.18)' }]} />
                <View style={[styles.connector, styles.connectorLeft, { backgroundColor: t.isDark ? 'rgba(153, 192, 255, 0.14)' : 'rgba(15, 121, 197, 0.12)' }]} />
                <View style={[styles.connector, styles.connectorRight, { backgroundColor: t.isDark ? 'rgba(153, 192, 255, 0.14)' : 'rgba(27, 56, 144, 0.12)' }]} />

                {STAR_NODES.map((node, index) => (
                  <Animated.View
                    key={index}
                    style={[
                      styles.starNode,
                      { width: node.size, height: node.size, borderRadius: node.size / 2, backgroundColor: index % 2 === 0 ? t.colors.secondary : t.colors.primary, opacity: nodeOpacity, transform: [{ scale: nodeScale }] },
                      node as any,
                    ]}
                  />
                ))}

                <Animated.View style={[styles.logoOrb, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.45)', transform: [{ translateY: orbTranslateY }] }]}>
                  <View style={[styles.orbRing, { borderColor: t.isDark ? 'rgba(153, 192, 255, 0.16)' : 'rgba(27, 56, 144, 0.08)' }]} />
                  <View style={[styles.orbRingInner, { borderColor: t.isDark ? 'rgba(153, 192, 255, 0.2)' : 'rgba(15, 121, 197, 0.14)' }]} />
                  <Image source={require('../../../assets/blue-whale-logo.webp')} style={{ width: logoWidth, height: logoHeight }} resizeMode="contain" />
                </Animated.View>
              </View>

              <Text style={[styles.title, { color: t.colors.primary }, compact && styles.titleCompact]}>Create your agency workspace</Text>
              <Text style={[styles.subtitle, { color: t.colors.grayMutedDark }, compact && styles.subtitleCompact]}>Set up your company profile and start managing candidates from mobile.</Text>

              <View style={[styles.progressPanel, { backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.82)' : isAndroid ? '#FFFFFF' : 'rgba(255,255,255,0.72)', borderColor: t.colors.border }]}>
                <View style={styles.progressHeaderRow}>
                  <Text style={[styles.progressLabel, { color: t.colors.primary }]}>Setup flow</Text>
                  <Text style={[styles.progressMeta, { color: t.colors.grayMutedDark }]}>6 fields</Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15, 121, 197, 0.08)' }]}>
                  <Animated.View style={[styles.progressFill, { width: progressWidth }]}>
                    <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFillObject} />
                  </Animated.View>
                  <Animated.View style={[styles.progressDot, { backgroundColor: t.colors.secondary, transform: [{ translateX: progressDotTranslateX }] }]} />
                </View>
                <View style={styles.progressStepsRow}>
                  {PROFILE_STEPS.map((item) => (
                    <Text key={item} style={[styles.progressStepText, { color: t.colors.text }]}>{item}</Text>
                  ))}
                </View>
              </View>

              <View style={[styles.highlightRow, compact && styles.highlightRowCompact]}>
                {HIGHLIGHTS.map((item, index) => {
                  const translateY = chipAnimations[index].interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
                  return (
                    <Animated.View key={item.label} style={{ opacity: chipAnimations[index], transform: [{ translateY }] }}>
                      <View style={[styles.highlightChip, { backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.82)' : isAndroid ? '#FFFFFF' : 'rgba(255,255,255,0.72)', borderColor: t.isDark ? 'rgba(58, 84, 134, 0.75)' : 'rgba(215, 227, 245, 0.92)' }]}>
                        <Feather name={item.icon} size={14} color={t.colors.secondary} />
                        <Text style={[styles.highlightText, { color: t.colors.text }]}>{item.label}</Text>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            </Animated.View>

            <Animated.View style={[styles.formCard, isAndroid && styles.androidFormCard, { marginHorizontal: cardHorizontal, backgroundColor: t.isDark ? 'rgba(17, 29, 52, 0.88)' : isAndroid ? '#F8FAFC' : 'rgba(248, 250, 252, 0.84)', borderColor: t.isDark ? 'rgba(58, 84, 134, 0.75)' : isAndroid ? '#D7E2F2' : 'rgba(255,255,255,0.78)', transform: [{ translateY: cardTranslateY }, { translateY: cardFloatY }], opacity: heroOpacity }, t.shadow.card]}>
              <LinearGradient colors={t.isDark ? (['rgba(79, 113, 210, 0.18)', 'rgba(15, 121, 197, 0.08)'] as any) : (['rgba(27, 56, 144, 0.08)', 'rgba(15, 121, 197, 0.02)'] as any)} style={styles.cardTint} />
              <Animated.View pointerEvents="none" style={[styles.shimmerOverlay, { transform: [{ translateX: shimmerX }, { rotate: '18deg' }] }]}>
                <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']} style={styles.shimmerGradient} />
              </Animated.View>

              <View style={styles.metricRow}>
                <View style={[styles.metricCard, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)', borderColor: t.colors.border }]}>
                  <Text style={[styles.metricValue, { color: t.colors.primary }]}>6</Text>
                  <Text style={[styles.metricLabel, { color: t.colors.grayMutedDark }]}>setup fields</Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)', borderColor: t.colors.border }]}>
                  <Text style={[styles.metricValue, { color: t.colors.primary }]}>1</Text>
                  <Text style={[styles.metricLabel, { color: t.colors.grayMutedDark }]}>agent workspace</Text>
                </View>
              </View>

              <View style={styles.cardHeader}>
                <View style={[styles.cardBadge, { backgroundColor: t.isDark ? 'rgba(79, 113, 210, 0.2)' : 'rgba(15, 121, 197, 0.12)' }]}>
                  <Feather name="briefcase" size={18} color={t.colors.secondary} />
                </View>
                <View style={styles.cardHeaderCopy}>
                  <Text style={[styles.cardTitle, { color: t.colors.text }]}>Build your company profile</Text>
                  <Text style={[styles.cardSubtitle, { color: t.colors.grayMutedDark }]}>Create the agent account your team will use to manage candidate workflows.</Text>
                </View>
              </View>

              {renderField({ label: 'Company name', icon: 'briefcase', value: companyName, onChangeText: setCompanyName, placeholder: 'Your company name', field: 'companyName', autoCapitalize: 'words', onSubmitEditing: () => contactPersonRef.current?.focus() })}
              {renderField({ label: 'Contact person', icon: 'user', value: contactPerson, onChangeText: setContactPerson, placeholder: 'Primary contact name', field: 'contactPerson', inputRef: contactPersonRef, autoCapitalize: 'words', onSubmitEditing: () => emailRef.current?.focus() })}
              {renderField({ label: 'Email', icon: 'mail', value: email, onChangeText: setEmail, placeholder: 'company@example.com', field: 'email', inputRef: emailRef, keyboardType: 'email-address', autoCapitalize: 'none', onSubmitEditing: () => phoneRef.current?.focus() })}
              {renderField({ label: 'Company phone (optional)', icon: 'phone', value: phone, onChangeText: (value) => setPhone(formatUaeMobileInput(value)), placeholder: UAE_PHONE_EXAMPLE, field: 'phone', inputRef: phoneRef, keyboardType: 'phone-pad', autoCapitalize: 'none', onSubmitEditing: () => companyAddressRef.current?.focus(), helperText: 'Use UAE phone format for the main company contact.' })}
              {renderField({ label: 'Company address', icon: 'map-pin', value: companyAddress, onChangeText: setCompanyAddress, placeholder: 'Company address', field: 'companyAddress', inputRef: companyAddressRef, autoCapitalize: 'words', onSubmitEditing: () => passwordRef.current?.focus() })}
              {renderField({ label: 'Password', icon: 'lock', value: password, onChangeText: setPassword, placeholder: 'Minimum 6 characters', field: 'password', inputRef: passwordRef, secureTextEntry: true, autoCapitalize: 'none', onSubmitEditing: onRegister })}

              <View style={styles.metaRow}>
                <Text style={[styles.metaText, { color: t.colors.grayMutedDark }]}>You are creating an agent account with company details.</Text>
                <Pressable onPress={() => navigation.navigate('Login')} hitSlop={10} style={({ pressed }) => [pressed && styles.pressed]}>
                  <Text style={[styles.metaLink, { color: t.colors.primary }]}>Back to login</Text>
                </Pressable>
              </View>

              <Pressable onPress={onRegister} disabled={loading} style={({ pressed }) => [styles.buttonPressable, pressed && styles.pressed, loading && styles.disabled]}>
                <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 1 }} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>{loading ? 'Creating...' : 'Create agent account'}</Text>
                  <View style={styles.primaryArrowWrap}>
                    <Feather name="arrow-right" size={18} color="#FFFFFF" />
                  </View>
                </LinearGradient>
              </Pressable>

              <Pressable onPress={() => navigation.navigate('Login')} style={({ pressed }) => [styles.secondaryButton, { borderColor: t.colors.borderStrong, backgroundColor: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.62)' }, pressed && styles.pressed]}>
                <Text style={[styles.secondaryButtonText, { color: t.colors.primary }]}>I already have an agent account</Text>
              </Pressable>
            </Animated.View>

            <Text style={[styles.footerNote, { color: t.colors.grayMutedDark }]}>Set up once, then manage candidates, chats, and activity from your phone.</Text>
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
    top: 110,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  leftGlow: {
    position: 'absolute',
    bottom: 120,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
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
  },
  profileCardBack: {
    position: 'absolute',
    width: 218,
    height: 218,
    borderRadius: 34,
    transform: [{ rotate: '-9deg' }, { translateX: -18 }, { translateY: 10 }],
  },
  profileCardFront: {
    position: 'absolute',
    width: 218,
    height: 218,
    borderRadius: 34,
    transform: [{ rotate: '8deg' }, { translateX: 18 }, { translateY: 16 }],
  },
  connector: {
    position: 'absolute',
    height: 1.5,
    width: 54,
  },
  connectorLeft: {
    top: 86,
    left: 54,
    transform: [{ rotate: '-18deg' }],
  },
  connectorRight: {
    bottom: 74,
    right: 54,
    transform: [{ rotate: '14deg' }],
  },
  starNode: {
    position: 'absolute',
  },
  logoOrb: {
    width: 194,
    height: 194,
    borderRadius: 97,
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
  subtitleCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  progressPanel: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 24,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  progressMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 999,
  },
  progressDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -4,
  },
  progressStepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  progressStepText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'center',
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
    height: 460,
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
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
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
