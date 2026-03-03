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
            contentContainerStyle={[styles.scrollContent, { paddingBottom: compact ? 14 : 24 }]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={[styles.hero, compact && styles.heroCompact]}>
              <View style={styles.logoHalo} />
              <View style={[styles.logoPlateOuter, compact && styles.logoPlateOuterCompact]}>
                <View style={[styles.logoPlateInner, compact && styles.logoPlateInnerCompact]}>
                  <Image source={require('../../../assets/icon.png')} style={[styles.brandMark, compact && styles.brandMarkCompact]} resizeMode="contain" />
                </View>
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 18,
  },
  heroCompact: {
    paddingTop: 4,
    paddingBottom: 10,
  },
  logoHalo: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(255,255,255,0.24)',
    top: -4,
  },
  logoPlateOuter: {
    width: 198,
    height: 198,
    borderRadius: 34,
    backgroundColor: '#F9FBFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7BA2DE',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.23,
    shadowRadius: 18,
    elevation: 8,
  },
  logoPlateOuterCompact: {
    width: 170,
    height: 170,
    borderRadius: 30,
  },
  logoPlateInner: {
    width: 158,
    height: 158,
    borderRadius: 28,
    backgroundColor: '#DDEBFD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlateInnerCompact: {
    width: 136,
    height: 136,
    borderRadius: 24,
  },
  brandMark: { width: 122, height: 122 },
  brandMarkCompact: { width: 104, height: 104 },
  title: {
    marginTop: 28,
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '900',
    color: '#1B3890',
  },
  titleCompact: {
    marginTop: 18,
    fontSize: 34,
    lineHeight: 40,
  },
  sub: {
    marginTop: 10,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '600',
    color: '#6B6F70',
    textAlign: 'center',
  },
  subCompact: {
    marginTop: 8,
    fontSize: 19,
    lineHeight: 25,
  },
  formCard: {
    marginTop: 16,
    marginHorizontal: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 18,
    shadowColor: '#7FA7DD',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 7,
  },
  formCardCompact: {
    marginTop: 10,
    paddingVertical: 14,
  },
  label: {
    color: '#111827',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  inputRow: {
    minHeight: 58,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#AEC3EB',
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 16,
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
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
  },
  passwordInput: {
    paddingRight: 10,
  },
  showText: {
    fontSize: 17,
    lineHeight: 24,
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
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
  secondaryBtn: {
    height: 56,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#5AA0E8',
    backgroundColor: '#F8FBFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryBtnText: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
  link: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    marginBottom: 2,
  },
});
