import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthService } from '../../api/services';
import { useAuthStore } from '../../context/authStore';
import type { AuthStackParamList } from '../../navigation/auth/AuthNavigator';
import { Button, Card, Input, Screen } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const t = useTheme();
  const signIn = useAuthStore((s) => s.signIn);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onRegister = async () => {
    if (!name.trim() || !email.trim() || password.length < 6) {
      Alert.alert('Invalid details', 'Please enter name, email and a password (min 6 characters).');
      return;
    }
    setLoading(true);
    try {
      const res = await AuthService.signup({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
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
    <Screen keyboard>
      <View style={styles.wrap}>
        <Text style={[styles.title, { color: t.colors.text }]}>Create account</Text>
        <Text style={[styles.sub, { color: t.colors.textMuted }]}>Get started in a minute</Text>

        <Card style={styles.card}>
          <Input label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
          />
          <Input label="Phone (optional)" value={phone} onChangeText={setPhone} placeholder="07X XXXX XXXX" keyboardType="phone-pad" />
          <Input label="Password" value={password} onChangeText={setPassword} placeholder="Minimum 6 characters" secureTextEntry />
          <Button title={loading ? 'Creating...' : 'Create account'} onPress={onRegister} loading={loading} />

          <View style={styles.footer}>
            <Pressable onPress={() => navigation.navigate('Login')}>
              <Text style={[styles.link, { color: t.colors.primary }]}>Back to login</Text>
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
    marginBottom: 22,
  },
  footer: {
    marginTop: 12,
    alignItems: 'center',
  },
  link: {
    fontSize: 13,
    fontWeight: '700',
  },
});
