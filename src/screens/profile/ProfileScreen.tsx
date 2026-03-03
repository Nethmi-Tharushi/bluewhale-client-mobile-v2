import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Button, Input, Screen } from '../../components/ui';
import { AuthService, UploadService } from '../../api/services';
import { api } from '../../api/client';
import { useAuthStore } from '../../context/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { Feather } from '@expo/vector-icons';

export default function ProfileScreen() {
  const t = useTheme();
  const { user, signOut, signIn } = useAuthStore();

  const [name, setName] = useState(user?.name || user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(
    String(
      user?.avatarUrl ||
        user?.avatar ||
        user?.profileImage ||
        user?.profilePic ||
        user?.profilePicture ||
        user?.photoUrl ||
        user?.photo ||
        user?.image ||
        ''
    )
  );
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState(false);

  const resolveAvatarUrl = (raw: string) => {
    const candidate = String(raw || '').trim();
    if (!candidate) return '';
    if (/^https?:\/\//i.test(candidate)) return candidate;
    const base = String(api.defaults.baseURL || '').replace(/\/+$/, '');
    const origin = base.replace(/\/api$/i, '');
    if (!origin) return '';
    return candidate.startsWith('/') ? `${origin}${candidate}` : `${origin}/uploads/${candidate}`;
  };

  const effectiveAvatarUrl = resolveAvatarUrl(avatarUrl);

  const load = async () => {
    setLoadingProfile(true);
    try {
      const res = await AuthService.getProfile();
      const u = (res as any)?.user || res;
      setName(u?.name || u?.fullName || '');
      setEmail(u?.email || '');
      setPhone(u?.phone || '');
      setAvatarUrl(
        String(
          u?.avatarUrl || u?.avatar || u?.profileImage || u?.profilePic || u?.profilePicture || u?.photoUrl || u?.photo || u?.image || ''
        )
      );
      setAvatarFailed(false);
    } catch {
      // ignore
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const resolvedAvatar = avatarUrl.trim() || undefined;
      const updated = await AuthService.updateProfile({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        avatarUrl: resolvedAvatar,
        avatar: resolvedAvatar,
        profileImage: resolvedAvatar,
        photoUrl: resolvedAvatar,
      });
      const token = useAuthStore.getState().token;
      const mergedUser = {
        ...(user || {}),
        ...((updated as any)?.user || updated || {}),
        ...(resolvedAvatar ? { avatarUrl: resolvedAvatar, profileImage: resolvedAvatar, avatar: resolvedAvatar, photoUrl: resolvedAvatar } : {}),
      };
      if (token) await signIn({ token, user: mergedUser as any });
      Alert.alert('Saved', 'Profile updated successfully.');
    } catch (e: any) {
      Alert.alert('Save failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setSaving(false);
    }
  };

  const pickAndUploadPhoto = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['image/*'],
    });
    if (res.canceled) return;

    const file = res.assets[0];
    setUploadingPhoto(true);
    try {
      const uploaded = await UploadService.uploadFile({
        uri: file.uri,
        name: file.name || `avatar-${Date.now()}.jpg`,
        type: file.mimeType || 'image/jpeg',
      });
      const url = String((uploaded as any)?.url || (uploaded as any)?.fileUrl || (uploaded as any)?.path || '').trim();
      if (!url) throw new Error('Upload response did not include image URL.');
      setAvatarUrl(url);
      setAvatarFailed(false);
      Alert.alert('Uploaded', 'Profile photo uploaded. Tap "Save changes" to persist.');
    } catch (e: any) {
      Alert.alert('Upload failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const changePass = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Weak password', 'New password should be at least 6 characters.');
      return;
    }
    setChanging(true);
    try {
      await AuthService.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      Alert.alert('Updated', 'Password changed successfully.');
    } catch (e: any) {
      Alert.alert('Failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setChanging(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete account', 'This will permanently delete your account. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await AuthService.deleteAccount();
          } catch {
            // ignore
          } finally {
            await signOut();
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={[styles.avatarWrap, { borderColor: '#C0CFEA', backgroundColor: '#F8FAFF' }]}>
            {effectiveAvatarUrl && !avatarFailed ? (
              <Image source={{ uri: effectiveAvatarUrl }} style={styles.avatarImage} onError={() => setAvatarFailed(true)} />
            ) : (
              <Feather name="user" size={38} color="#5E6F95" />
            )}
          </View>
          <Text style={[styles.heroName, { color: t.colors.primary }]} numberOfLines={1}>
            {name || user?.name || user?.fullName || 'Your Profile'}
          </Text>
          <Text style={styles.heroEmail} numberOfLines={1}>
            {email || user?.email || 'user@example.com'}
          </Text>
          <Text style={styles.heroSub}>{loadingProfile ? 'Loading profile...' : 'Manage your account details'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.h, { color: t.colors.primary }]}>Personal Info</Text>
          <Text style={styles.p}>Keep your details up to date</Text>
          <View style={{ height: 12 }} />

          <Text style={[styles.label, { color: t.colors.text }]}>Profile photo</Text>
          <View style={styles.photoRow}>
            <Button title={uploadingPhoto ? 'Uploading...' : 'Upload photo'} onPress={pickAndUploadPhoto} loading={uploadingPhoto} />
            <View style={{ width: 10 }} />
            <Button
              title="Remove photo"
              variant="outline"
              onPress={() => {
                setAvatarUrl('');
                setAvatarFailed(false);
              }}
              disabled={!avatarUrl}
            />
          </View>

          <View style={{ height: 6 }} />
          <Input label="Name" value={name} onChangeText={setName} placeholder="Your name" />
          <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
          <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="07X XXX XXXX" keyboardType="phone-pad" />
          <Button title={saving ? 'Saving...' : 'Save changes'} onPress={save} loading={saving} />
        </View>

        <View style={styles.section}>
          <Text style={[styles.h, { color: t.colors.primary }]}>Security</Text>
          <Text style={styles.p}>Update your password</Text>
          <View style={{ height: 12 }} />
          <Input label="Current password" value={currentPassword} onChangeText={setCurrentPassword} placeholder="Enter current password" secureTextEntry />
          <Input label="New password" value={newPassword} onChangeText={setNewPassword} placeholder="Minimum 6 characters" secureTextEntry />
          <Button title={changing ? 'Updating...' : 'Change password'} onPress={changePass} loading={changing} />
        </View>

        <View style={styles.section}>
          <Text style={[styles.h, { color: t.colors.primary }]}>Account Actions</Text>
          <Text style={styles.p}>Sign out or permanently remove account</Text>
          <View style={{ height: 12 }} />
          <Button title="Logout" onPress={() => signOut()} variant="secondary" />
          <View style={{ height: 10 }} />
          <Button title="Delete account" onPress={confirmDelete} variant="ghost" />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 140, paddingTop: 10 },
  hero: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1.5,
    borderColor: '#C4D1E8',
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroName: { marginTop: 12, fontSize: 26, fontWeight: '900' },
  heroEmail: { marginTop: 6, fontSize: 16, fontWeight: '700', color: '#5B6E95' },
  heroSub: { marginTop: 6, fontSize: 14, fontWeight: '700', color: '#7384A8' },
  section: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#C4D1E8',
    backgroundColor: 'rgba(255,255,255,0.76)',
    marginBottom: 12,
    shadowColor: '#3E5D9F',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  h: { fontSize: 22, fontWeight: '900' },
  p: { marginTop: 6, fontWeight: '700', color: '#6B7FA8' },
  label: { fontWeight: '800', marginBottom: 8 },
  photoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatarWrap: {
    width: 102,
    height: 102,
    borderRadius: 51,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
});
