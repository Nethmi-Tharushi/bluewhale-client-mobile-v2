import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthService } from '../../api/services';
import type { AuthStackParamList } from '../../navigation/auth/AuthNavigator';
import { Button, Card, Input, Screen } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

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
    <Screen keyboard>
      <View style={styles.wrap}>
        <Text style={[styles.title, { color: t.colors.text }]}>Reset password</Text>
        <Text style={[styles.sub, { color: t.colors.textMuted }]}>We will send reset instructions to your email</Text>

        <Card style={styles.card}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
          />
          <Button title={loading ? 'Sending...' : 'Send reset email'} onPress={onSubmit} loading={loading} />

          <View style={styles.footer}>
            <Pressable onPress={() => navigation.goBack()}>
              <Text style={[styles.link, { color: t.colors.primary }]}>Back</Text>
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
    marginBottom: 28,
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
