import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthService } from '../../api/services';
import { useAuthStore } from '../../context/authStore';
import type { AuthStackParamList } from '../../navigation/auth/AuthNavigator';
import { Button, Card, Input, Screen } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const t = useTheme();
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
    <Screen keyboard>
      <View style={styles.wrap}>
        <Text style={[styles.title, { color: t.colors.text }]}>Welcome back</Text>
        <Text style={[styles.sub, { color: t.colors.textMuted }]}>Sign in to continue</Text>

        <Card style={styles.card}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
          />
          <Input label="Password" value={password} onChangeText={setPassword} placeholder="Enter password" secureTextEntry />
          <Button title={loading ? 'Logging in...' : 'Login'} onPress={onLogin} loading={loading} />

          <View style={styles.row}>
            <Pressable onPress={() => navigation.navigate('Register')}>
              <Text style={[styles.link, { color: t.colors.primary }]}>Create account</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={[styles.link, { color: t.colors.primary }]}>Forgot password</Text>
            </Pressable>
          </View>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  sub: {
    marginTop: 6,
    marginBottom: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  card: {
    marginBottom: 32,
  },
  row: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  link: {
    fontSize: 13,
    fontWeight: '700',
  },
});
