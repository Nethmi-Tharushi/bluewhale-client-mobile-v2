import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AuthService } from '../../api/services';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/auth/AuthNavigator';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const compact = height < 760;
  const cardHorizontal = width < 380 ? 12 : 20;

  const onSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Missing email', 'Please enter your email.');
      return;
    }
    setLoading(true);
    try {
      await AuthService.forgotPassword(email.trim());
      Alert.alert('Check your email', 'If an account exists, we sent password reset instructions.');
      navigation.navigate('Login');
    } catch (e: any) {
      Alert.alert('Failed', e?.userMessage || e?.message || 'Please try again');
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
            contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={[styles.hero, compact && styles.heroCompact]}>
              <View style={styles.heroOuterHalo} />
              <View style={styles.heroInnerHalo}>
                <View style={styles.heroIllustrationWrap}>
                  <View style={styles.heroEnvelope}>
                    <Feather name="mail" size={60} color="#63A6E8" />
                  </View>
                  <View style={styles.heroTopBadge}>
                    <Feather name="lock" size={20} color="#FFFFFF" />
                  </View>
                </View>
              </View>
              <Text style={[styles.title, { fontFamily: t.typography.fontFamily.bold }]}>Reset password</Text>
              <Text style={[styles.sub, { fontFamily: t.typography.fontFamily.medium }]}>We will email reset instructions</Text>
            </View>

            <View style={[styles.formCard, { marginHorizontal: cardHorizontal }]}>
              <Text style={[styles.label, { fontFamily: t.typography.fontFamily.bold }]}>Email</Text>
              <View style={styles.inputRow}>
                <Feather name="mail" size={24} color="#4D95DE" />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="#7A8BA1"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[styles.inputText, { fontFamily: t.typography.fontFamily.medium }]}
                />
              </View>

              <Pressable onPress={onSubmit} disabled={loading} style={({ pressed }) => [pressed && { opacity: 0.96 }]}>
                <LinearGradient colors={['#1B3890', '#0F79C5']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.primaryBtn}>
                  <Text style={[styles.primaryBtnText, { fontFamily: t.typography.fontFamily.bold }]}>{loading ? 'Sending...' : 'Send reset email'}</Text>
                </LinearGradient>
              </Pressable>

              <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}>
                <Text style={[styles.secondaryBtnText, { fontFamily: t.typography.fontFamily.bold }]}>Back</Text>
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
    paddingTop: 8,
    paddingBottom: 26,
  },
  scrollContentCompact: {
    paddingTop: 0,
    paddingBottom: 18,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 12,
  },
  heroCompact: {
    paddingTop: 0,
    paddingBottom: 12,
  },
  heroOuterHalo: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    top: -30,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  heroInnerHalo: {
    width: 166,
    height: 166,
    borderRadius: 83,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D9E4F8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7CA2DC',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 5,
  },
  heroIllustrationWrap: {
    width: 110,
    height: 94,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEnvelope: {
    width: 98,
    height: 74,
    borderRadius: 16,
    backgroundColor: '#E6F1FD',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D2E3FA',
  },
  heroTopBadge: {
    position: 'absolute',
    top: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4D95DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 18,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    color: '#1B3890',
    textAlign: 'center',
  },
  sub: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    color: '#4D6F9A',
    textAlign: 'center',
  },
  formCard: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#D5DEF3',
    shadowColor: '#7EA6DB',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.21,
    shadowRadius: 18,
    elevation: 6,
  },
  label: {
    color: '#1F2937',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    marginBottom: 10,
  },
  inputRow: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#B6C8E8',
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  inputText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: '#6B7F96',
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
    marginTop: 12,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#5AA0E8',
    backgroundColor: '#F8FBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#2A78CC',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
});
