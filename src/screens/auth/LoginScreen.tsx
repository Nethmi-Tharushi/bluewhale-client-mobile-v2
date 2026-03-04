import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Image, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AuthService } from '../../api/services';
import { useAuthStore } from '../../context/authStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/auth/AuthNavigator';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const t = useTheme();
  const { height, width } = useWindowDimensions();
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const compact = height < 760;
  const cardHorizontal = width < 380 ? 14 : 20;
  const logoWidth = compact ? Math.min(width * 0.62, 230) : Math.min(width * 0.68, 250);
  const logoHeight = Math.round(logoWidth * 0.43);

  const onLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await AuthService.login(email.trim(), password);
      const token = (res as any)?.token || (res as any)?.accessToken;
      const user = (res as any)?.user || (res as any)?.data?.user || (res as any);
      if (!token) throw new Error('Token not found in response.');
      const role = String((user as any)?.userType || (user as any)?.role || '').toLowerCase();
      if (role && role !== 'candidate') {
        throw new Error('Only candidate accounts can log in to this app.');
      }
      await signIn({ token, user });
    } catch (e: any) {
      Alert.alert('Login failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={t.colors.gradientBackground as any} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingBottom: compact ? 14 : 24,
              },
            ]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={[styles.hero, compact && styles.heroCompact]}>
              <View style={styles.logoHalo} />
              <View style={[styles.logoWrap, { width: logoWidth, height: logoHeight }]}>
                <Image source={require('../../../assets/blue-whale-logo.webp')} style={[styles.brandMark, { width: logoWidth, height: logoHeight }]} resizeMode="contain" />
              </View>
              <Text style={[styles.title, compact && styles.titleCompact]}>Welcome back</Text>
              <Text style={[styles.sub, compact && styles.subCompact]}>Sign in to continue your journey</Text>
            </View>

            <View style={[styles.formCard, { marginHorizontal: cardHorizontal }, compact && styles.formCardCompact]}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputRow}>
                <Text style={[styles.mailIcon, { color: t.colors.secondary }]}>@</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={t.colors.grayMutedDark}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[styles.inputText, { color: t.colors.grayMutedDark }]}
                />
              </View>

              <Text style={styles.label}>Password</Text>
              <View style={styles.inputRow}>
                <View style={styles.leftIcon}>
                  <Feather name="lock" size={21} color={t.colors.secondary} />
                </View>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={t.colors.grayMutedDark}
                  secureTextEntry={!showPassword}
                  style={[styles.inputText, styles.passwordInput, { color: t.colors.grayMutedDark }]}
                />
                <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={10}>
                  <View style={styles.passwordToggle}>
                    <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color={t.colors.primary} />
                    <Text style={[styles.showText, { color: t.colors.primary }]}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </View>
                </Pressable>
              </View>

              <Pressable onPress={onLogin} disabled={loading} style={({ pressed }) => [styles.buttonPressable, pressed && { opacity: 0.95 }]}>
                <LinearGradient colors={['#1B3890', '#0F79C5']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>{loading ? 'Logging in...' : 'Login'}</Text>
                </LinearGradient>
              </Pressable>

              <Pressable onPress={() => navigation.navigate('Register')} style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}>
                <Text style={[styles.secondaryBtnText, { color: t.colors.primary }]}>Create an account</Text>
              </Pressable>

              <Text style={[styles.link, { color: t.colors.primary }]} onPress={() => navigation.navigate('ForgotPassword')}>
                Forgot password?
              </Text>
            </View>
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
    paddingBottom: 24,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 10,
  },
  heroCompact: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  logoHalo: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(255,255,255,0.24)',
    top: -4,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  brandMark: {},
  title: {
    marginTop: 22,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    color: '#1B3890',
  },
  titleCompact: {
    marginTop: 10,
    fontSize: 24,
    lineHeight: 29,
  },
  sub: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: '#6B6F70',
    textAlign: 'center',
  },
  subCompact: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 19,
  },
  formCard: {
    marginTop: 10,
    marginHorizontal: 24,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#7FA7DD',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 7,
  },
  formCardCompact: {
    marginTop: 6,
    paddingVertical: 10,
  },
  label: {
    color: '#111827',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    marginBottom: 10,
  },
  inputRow: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#AEC3EB',
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  leftIcon: {
    marginRight: 10,
  },
  mailIcon: {
    fontSize: 20,
    marginRight: 10,
    fontWeight: '800',
  },
  inputText: {
    flex: 1,
    color: '#6B6F70',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  passwordInput: {
    paddingRight: 10,
  },
  showText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    marginLeft: 4,
  },
  passwordToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonPressable: {
    marginTop: 4,
  },
  primaryBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  secondaryBtn: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#5AA0E8',
    backgroundColor: '#F8FBFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryBtnText: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  link: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    marginBottom: 2,
  },
});
