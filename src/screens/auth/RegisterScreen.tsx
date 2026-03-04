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
import { isValidUaeMobile, normalizeUaeMobile, UAE_PHONE_EXAMPLE } from '../../utils/phone';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const t = useTheme();
  const { height, width } = useWindowDimensions();
  const signIn = useAuthStore((s) => s.signIn);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const compact = height < 760;
  const cardHorizontal = width < 380 ? 14 : 20;
  const logoWidth = compact ? Math.min(width * 0.62, 230) : Math.min(width * 0.68, 250);
  const logoHeight = Math.round(logoWidth * 0.43);

  const onRegister = async () => {
    if (!name.trim() || !email.trim() || password.length < 6) {
      Alert.alert('Invalid details', 'Please enter name, email and a password (min 6 characters).');
      return;
    }
    const normalizedPhone = normalizeUaeMobile(phone);
    if (phone.trim() && !isValidUaeMobile(phone)) {
      Alert.alert('Invalid phone', `Use UAE mobile format like ${UAE_PHONE_EXAMPLE} or 05XXXXXXXX.`);
      return;
    }
    setLoading(true);
    try {
      const res = await AuthService.signup({
        name: name.trim(),
        email: email.trim(),
        phone: normalizedPhone || undefined,
        password,
        userType: 'candidate',
      });
      const token = (res as any)?.token || (res as any)?.accessToken;
      const user = (res as any)?.user || (res as any);
      if (!token) throw new Error('Token not found in response.');
      await signIn({ token, user });
    } catch (e: any) {
      Alert.alert('Register failed', e?.userMessage || e?.message || 'Please try again');
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
              <Text style={[styles.title, compact && styles.titleCompact]}>Create account</Text>
              <Text style={[styles.sub, compact && styles.subCompact]}>Join Blue Whale in minutes</Text>
            </View>

            <View style={[styles.formCard, { marginHorizontal: cardHorizontal }, compact && styles.formCardCompact]}>
              <Text style={styles.label}>Full name</Text>
              <View style={styles.inputRow}>
                <View style={styles.leftIcon}>
                  <Feather name="user" size={24} color={t.colors.secondary} />
                </View>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={t.colors.grayMutedDark}
                  style={[styles.inputText, { color: t.colors.grayMutedDark }]}
                />
              </View>

              <Text style={styles.label}>Email</Text>
              <View style={styles.inputRow}>
                <View style={styles.leftIcon}>
                  <Feather name="mail" size={24} color={t.colors.secondary} />
                </View>
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

              <Text style={styles.label}>Phone (optional)</Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder={UAE_PHONE_EXAMPLE}
                  placeholderTextColor={t.colors.grayMutedDark}
                  keyboardType="phone-pad"
                  style={[styles.inputText, styles.passwordInput, { color: t.colors.grayMutedDark }]}
                />
              </View>

              <Text style={styles.label}>Password</Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor={t.colors.grayMutedDark}
                  secureTextEntry={!showPassword}
                  style={[styles.inputText, { color: t.colors.grayMutedDark }]}
                />
                <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={10}>
                  <Text style={[styles.showText, { color: t.colors.primary }]}>{showPassword ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>

              <Pressable onPress={onRegister} disabled={loading} style={({ pressed }) => [styles.buttonPressable, pressed && { opacity: 0.95 }]}>
                <LinearGradient colors={['#1B3890', '#0F79C5']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>{loading ? 'Creating...' : 'Create account'}</Text>
                </LinearGradient>
              </Pressable>

              <Pressable onPress={() => navigation.navigate('Login')} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.9 }]}>
                <Text style={[styles.backButtonText, { color: t.colors.primary }]}>Back to login</Text>
              </Pressable>
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
    paddingTop: 20,
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
  backButton: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#5AA0E8',
    backgroundColor: '#F8FBFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  backButtonText: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
});
