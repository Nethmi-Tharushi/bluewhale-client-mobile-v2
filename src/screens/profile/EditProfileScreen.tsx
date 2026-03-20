import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Input, Screen } from '../../components/ui';
import { AgentProfileService, AuthService } from '../../api/services';
import { api } from '../../api/client';
import { useAuthStore } from '../../context/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import type { ProfileStackParamList } from '../../navigation/app/AppNavigator';
import { ensureUploadSizeWithinLimit } from '../../utils/uploadValidation';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

type AgentFormState = {
  id: string;
  name: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phoneNumber: string;
  companyAddress: string;
  companyLogo: string;
  createdAt: string;
  isVerified: boolean;
};

const emptyForm: AgentFormState = {
  id: '',
  name: '',
  companyName: '',
  contactPerson: '',
  email: '',
  phoneNumber: '',
  companyAddress: '',
  companyLogo: '',
  createdAt: '',
  isVerified: false,
};

const buildFormState = (user: any): AgentFormState => ({
  id: String(user?._id || user?.id || '').trim(),
  name: String(user?.name || user?.fullName || '').trim(),
  companyName: String(user?.companyName || '').trim(),
  contactPerson: String(user?.contactPerson || '').trim(),
  email: String(user?.email || '').trim(),
  phoneNumber: String(user?.phone || '').trim(),
  companyAddress: String(user?.companyAddress || '').trim(),
  companyLogo: String(user?.companyLogo || '').trim(),
  createdAt: String(user?.createdAt || '').trim(),
  isVerified: Boolean(user?.isVerified),
});

const resolveAssetUrl = (raw: string) => {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const base = String(api.defaults.baseURL || '').replace(/\/+$/, '');
  const origin = base.replace(/\/api$/i, '');
  if (!origin) return '';
  if (value.startsWith('/')) return `${origin}${value}`;
  if (/^uploads\//i.test(value)) return `${origin}/${value}`;
  return `${origin}/uploads/${value}`;
};

const formatJoinDate = (value?: string) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
};

export default function EditProfileScreen({ navigation }: Props) {
  const t = useTheme();
  const token = useAuthStore((s) => s.token);
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);
  const storeUser = useAuthStore((s) => s.user);

  const [formData, setFormData] = useState<AgentFormState>(buildFormState(storeUser || null));
  const [originalFormData, setOriginalFormData] = useState<AgentFormState>(buildFormState(storeUser || null));
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pictureFile, setPictureFile] = useState<{ uri: string; name: string; type?: string } | null>(null);
  const [picturePreviewUri, setPicturePreviewUri] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

  const heroGlow = useRef(new Animated.Value(0)).current;
  const avatarFloat = useRef(new Animated.Value(0)).current;
  const badgePulse = useRef(new Animated.Value(0.96)).current;

  const load = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const res = await AgentProfileService.getProfile();
      const nextUser = (res as any)?.user || res;
      const nextForm = buildFormState(nextUser);
      setFormData(nextForm);
      setOriginalFormData(nextForm);
      setPictureFile(null);
      setPicturePreviewUri('');
      setAvatarFailed(false);
      setErrors({});
    } catch (err: any) {
      if (Number(err?.response?.status || 0) === 401) {
        await signOut();
      }
    } finally {
      setLoadingProfile(false);
    }
  }, [signOut]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroGlow, { toValue: 1, duration: 5200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(heroGlow, { toValue: 0, duration: 5200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    const avatarLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(avatarFloat, { toValue: -8, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(avatarFloat, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const badgeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(badgePulse, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(badgePulse, { toValue: 0.96, duration: 1700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );

    glowLoop.start();
    avatarLoop.start();
    badgeLoop.start();

    return () => {
      glowLoop.stop();
      avatarLoop.stop();
      badgeLoop.stop();
    };
  }, [avatarFloat, badgePulse, heroGlow]);

  const displayedAvatar = picturePreviewUri || resolveAssetUrl(formData.companyLogo);
  const completionRatio = useMemo(() => {
    const checkpoints = [
      formData.name,
      formData.email,
      formData.phoneNumber,
      formData.companyName,
      formData.companyAddress,
      formData.contactPerson,
      picturePreviewUri || formData.companyLogo,
      formData.isVerified ? 'verified' : '',
    ];
    return Math.round((checkpoints.filter(Boolean).length / checkpoints.length) * 100);
  }, [formData, picturePreviewUri]);

  const setField = (key: keyof AgentFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!formData.companyName.trim()) nextErrors.companyName = 'Company name is required.';
    if (!formData.contactPerson.trim()) nextErrors.contactPerson = 'Contact person is required.';
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) nextErrors.email = 'Valid email is required.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const pickLogo = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['image/*'],
    });
    if (res.canceled) return;

    const file = res.assets[0];
    try {
      await ensureUploadSizeWithinLimit({ uri: file.uri, name: file.name, size: file.size ?? null });
    } catch (err: any) {
      Alert.alert('File too large', err?.userMessage || err?.message || 'Please choose a file smaller than 5 MB.');
      return;
    }

    setPictureFile({
      uri: file.uri,
      name: file.name || `company-logo-${Date.now()}.jpg`,
      type: file.mimeType || 'image/jpeg',
    });
    setPicturePreviewUri(file.uri);
    setAvatarFailed(false);
  };

  const cancelChanges = () => {
    setFormData(originalFormData);
    setPictureFile(null);
    setPicturePreviewUri('');
    setUploadProgress(0);
    setErrors({});
    navigation.goBack();
  };

  const save = async () => {
    if (!validate()) {
      Alert.alert('Invalid details', 'Please fix the highlighted fields before saving.');
      return;
    }
    if (!formData.id) {
      Alert.alert('Missing profile', 'Unable to find the current agent profile.');
      return;
    }

    setSaving(true);
    setUploadProgress(0);
    try {
      const multipart = new FormData();
      multipart.append('companyName', formData.companyName.trim());
      multipart.append('contactPerson', formData.contactPerson.trim());
      multipart.append('email', formData.email.trim());
      multipart.append('phone', formData.phoneNumber.trim());
      multipart.append('companyAddress', formData.companyAddress.trim());
      if (pictureFile) {
        // @ts-ignore react-native FormData file shape
        multipart.append('companyLogo', {
          uri: pictureFile.uri,
          name: pictureFile.name,
          type: pictureFile.type || 'image/jpeg',
        });
      }

      const updated = await AgentProfileService.updateProfileMultipart(formData.id, multipart, (event) => {
        const total = Number(event?.total || event?.totalBytesExpectedToSend || 0);
        const loaded = Number(event?.loaded || event?.loadedBytes || 0);
        if (total > 0) setUploadProgress(Math.max(1, Math.min(100, Math.round((loaded / total) * 100))));
      });

      const updatedUser = (updated as any)?.user || updated || {};
      const mergedUser = {
        ...(storeUser || {}),
        ...updatedUser,
        companyLogo: String(updatedUser?.companyLogo || formData.companyLogo || '').trim(),
      };

      if (token) await signIn({ token, user: mergedUser as any });

      const nextForm = buildFormState(mergedUser);
      setFormData(nextForm);
      setOriginalFormData(nextForm);
      setPictureFile(null);
      setPicturePreviewUri('');
      setUploadProgress(100);

      Alert.alert('Saved', 'Agent profile updated successfully.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err: any) {
      Alert.alert('Save failed', err?.response?.data?.message || err?.userMessage || err?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword.trim() || !newPassword.trim()) {
      Alert.alert('Missing password', 'Enter both current and new password.');
      return;
    }
    setChangingPassword(true);
    try {
      await AuthService.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      Alert.alert('Password updated', 'Your password has been changed successfully.');
    } catch (err: any) {
      Alert.alert('Update failed', err?.userMessage || err?.message || 'Please try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  const confirmDelete = () => setConfirmDeleteVisible(true);

  const deleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await AuthService.deleteAccount();
      setConfirmDeleteVisible(false);
      await signOut();
    } catch (err: any) {
      Alert.alert('Delete failed', err?.userMessage || err?.message || 'Please try again.');
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <Screen padded={false}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.editHeaderRow}>
          <Pressable style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={18} color="#17326F" />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.headerEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>Agent profile</Text>
            <Text style={[styles.editHeaderTitle, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]}>Edit Profile</Text>
          </View>
          <View style={styles.headerStatePill}>
            <Animated.View style={[styles.headerStateDot, { transform: [{ scale: badgePulse }] }]} />
            <Text style={[styles.headerStateText, { fontFamily: t.typography.fontFamily.bold }]}>{saving ? 'Saving' : loadingProfile ? 'Loading' : 'Editing'}</Text>
          </View>
        </View>

        <LinearGradient colors={['#FFFFFF', '#F3F8FF']} style={styles.hero}>
          <Animated.View style={[styles.heroGlow, { opacity: heroGlow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] }) }]} />
          <View style={styles.heroTopRow}>
            <View style={styles.heroIdentityColumn}>
              <Text style={[styles.heroEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>COMPANY IDENTITY</Text>
              <Text style={[styles.heroHeading, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]}>
                {formData.name || 'Agent profile'}
              </Text>
              <Text style={[styles.heroSub, { fontFamily: t.typography.fontFamily.medium }]}>
                Update your company details, contact person, and logo before saving the changes to the agent profile.
              </Text>

              <View style={styles.heroMetaRail}>
                <View style={styles.heroMetaChip}>
                  <Feather name="calendar" size={13} color="#1D5FD2" />
                  <Text style={[styles.heroMetaText, { fontFamily: t.typography.fontFamily.bold }]}>{`Joined ${formatJoinDate(formData.createdAt)}`}</Text>
                </View>
                <View style={styles.heroMetaChip}>
                  <Feather name={formData.isVerified ? 'check-circle' : 'clock'} size={13} color={formData.isVerified ? '#0E8A61' : '#C7851D'} />
                  <Text style={[styles.heroMetaText, { fontFamily: t.typography.fontFamily.bold }]}>{formData.isVerified ? 'Verified agent' : 'Verification pending'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.heroProfilePanel}>
              <Animated.View style={[styles.avatarHalo, { transform: [{ translateY: avatarFloat }] }]}>
                <View style={styles.avatarWrap}>
                  {displayedAvatar && !avatarFailed ? (
                    <Image source={{ uri: displayedAvatar }} style={styles.avatarImage} onError={() => setAvatarFailed(true)} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Feather name="image" size={28} color="#6276A4" />
                    </View>
                  )}
                </View>
              </Animated.View>

              <Text style={[styles.heroName, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]} numberOfLines={2}>
                {formData.companyName || 'Add company name'}
              </Text>
              <Text style={[styles.heroEmail, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                {formData.email || 'No email'}
              </Text>

              <View style={styles.heroProgressTrack}>
                <View style={[styles.heroProgressFill, { width: `${completionRatio}%` }]} />
              </View>
              <Text style={[styles.heroProgressLabel, { fontFamily: t.typography.fontFamily.bold }]}>{`${completionRatio}% complete`}</Text>

              <Button title={pictureFile ? 'Logo Selected' : 'Change Logo'} onPress={pickLogo} size="sm" />
            </View>
          </View>
        </LinearGradient>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatCard}>
            <View style={styles.heroStatIcon}>
              <Feather name="briefcase" size={12} color="#1D5FD2" />
            </View>
            <Text style={[styles.heroStatValue, { fontFamily: t.typography.fontFamily.bold }]}>
              {formData.companyName ? 'Ready' : 'Draft'}
            </Text>
            <Text style={[styles.heroStatLabel, { fontFamily: t.typography.fontFamily.medium }]}>Company details</Text>
          </View>
          <View style={styles.heroStatCard}>
            <View style={styles.heroStatIcon}>
              <Feather name="users" size={12} color="#0E8A61" />
            </View>
            <Text style={[styles.heroStatValue, { color: '#0E8A61', fontFamily: t.typography.fontFamily.bold }]}>
              {formData.contactPerson ? 'Set' : 'Missing'}
            </Text>
            <Text style={[styles.heroStatLabel, { fontFamily: t.typography.fontFamily.medium }]}>Contact person</Text>
          </View>
          <View style={styles.heroStatCard}>
            <View style={styles.heroStatIcon}>
              <Feather name="upload-cloud" size={12} color="#C7851D" />
            </View>
            <Text style={[styles.heroStatValue, { color: '#C7851D', fontFamily: t.typography.fontFamily.bold }]}>
              {uploadProgress ? `${uploadProgress}%` : 'Idle'}
            </Text>
            <Text style={[styles.heroStatLabel, { fontFamily: t.typography.fontFamily.medium }]}>Upload progress</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
              <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>PROFILE FORM</Text>
              <Text style={[styles.h, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]}>Company Details</Text>
              <Text style={[styles.p, { fontFamily: t.typography.fontFamily.medium }]}>
                These fields match the agent web profile and save through the agent update endpoint.
              </Text>
            </View>
            <View style={styles.sectionIconPill}>
              <Feather name="edit-3" size={15} color="#1D5FD2" />
              <Text style={[styles.sectionIconText, { fontFamily: t.typography.fontFamily.bold }]}>Editing</Text>
            </View>
          </View>

          <View style={{ height: 12 }} />

          <Input
            label="Header Name"
            value={formData.name}
            onChangeText={(value) => setField('name', value)}
            placeholder="Agent name"
            icon={<Feather name="user" size={16} color="#5D6E92" />}
          />
          <Input
            label="Company Name"
            value={formData.companyName}
            onChangeText={(value) => setField('companyName', value)}
            placeholder="Company name"
            icon={<Feather name="briefcase" size={16} color="#5D6E92" />}
            error={errors.companyName}
          />
          <Input
            label="Contact Person"
            value={formData.contactPerson}
            onChangeText={(value) => setField('contactPerson', value)}
            placeholder="Contact person"
            icon={<Feather name="users" size={16} color="#5D6E92" />}
            error={errors.contactPerson}
          />
          <Input
            label="Email"
            value={formData.email}
            onChangeText={(value) => setField('email', value)}
            placeholder="Email address"
            keyboardType="email-address"
            editable={false}
            icon={<Feather name="mail" size={16} color="#5D6E92" />}
            error={errors.email}
          />
          <Input
            label="Phone"
            value={formData.phoneNumber}
            onChangeText={(value) => setField('phoneNumber', value)}
            placeholder="Phone number"
            keyboardType="phone-pad"
            icon={<Feather name="phone" size={16} color="#5D6E92" />}
          />
          <Input
            label="Company Address"
            value={formData.companyAddress}
            onChangeText={(value) => setField('companyAddress', value)}
            placeholder="Company address"
            multiline
            icon={<Feather name="map-pin" size={16} color="#5D6E92" />}
          />

          {pictureFile ? (
            <Text style={[styles.fileText, { fontFamily: t.typography.fontFamily.medium }]}>Selected logo: {pictureFile.name}</Text>
          ) : formData.companyLogo ? (
            <Text style={[styles.fileText, { fontFamily: t.typography.fontFamily.medium }]}>Current logo is already uploaded.</Text>
          ) : (
            <Text style={[styles.fileText, { fontFamily: t.typography.fontFamily.medium }]}>No company logo uploaded yet.</Text>
          )}

          {uploadProgress > 0 && uploadProgress < 100 ? (
            <Text style={[styles.progressText, { fontFamily: t.typography.fontFamily.bold }]}>{`Uploading: ${uploadProgress}%`}</Text>
          ) : null}

          <View style={styles.actionRow}>
            <View style={styles.actionCell}>
              <Button title="Cancel Changes" onPress={cancelChanges} variant="outline" size="sm" />
            </View>
            <View style={styles.actionCell}>
              <Button title={saving ? 'Saving...' : 'Save Changes'} onPress={save} loading={saving} size="sm" />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
              <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>ACCESS CONTROL</Text>
              <Text style={[styles.h, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]}>Security</Text>
              <Text style={[styles.p, { fontFamily: t.typography.fontFamily.medium }]}>Update your password safely.</Text>
            </View>
            <View style={styles.sectionIconPill}>
              <Feather name="shield" size={15} color="#1D5FD2" />
              <Text style={[styles.sectionIconText, { fontFamily: t.typography.fontFamily.bold }]}>Protected</Text>
            </View>
          </View>
          <View style={{ height: 12 }} />
          <Input
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            secureTextEntry
            icon={<Feather name="lock" size={16} color="#5D6E92" />}
          />
          <Input
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Minimum 6 characters"
            secureTextEntry
            icon={<Feather name="key" size={16} color="#5D6E92" />}
          />
          <Button title={changingPassword ? 'Updating...' : 'Change Password'} onPress={changePassword} loading={changingPassword} size="sm" />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
              <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>SESSION CONTROLS</Text>
              <Text style={[styles.h, { color: t.colors.primary, fontFamily: t.typography.fontFamily.bold }]}>Account Actions</Text>
              <Text style={[styles.p, { fontFamily: t.typography.fontFamily.medium }]}>Manage your session or account.</Text>
            </View>
            <View style={styles.sectionIconPill}>
              <Feather name="sliders" size={15} color="#1D5FD2" />
              <Text style={[styles.sectionIconText, { fontFamily: t.typography.fontFamily.bold }]}>Controls</Text>
            </View>
          </View>
          <View style={{ height: 12 }} />
          <Button title="Logout" onPress={() => signOut()} variant="secondary" size="sm" />
          <View style={{ height: 10 }} />
          <Button title="Delete Account" onPress={confirmDelete} variant="ghost" size="sm" />
        </View>
      </ScrollView>

      <Modal visible={confirmDeleteVisible} transparent animationType="fade" onRequestClose={() => setConfirmDeleteVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setConfirmDeleteVisible(false)}>
          <Pressable style={styles.confirmModal} onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.confirmTitle, { fontFamily: t.typography.fontFamily.bold }]}>Delete account?</Text>
            <Text style={[styles.confirmBody, { fontFamily: t.typography.fontFamily.medium }]}>
              This action is permanent. Your account and profile data will be removed.
            </Text>
            <View style={styles.confirmActions}>
              <View style={styles.actionCell}>
                <Button title="Cancel" onPress={() => setConfirmDeleteVisible(false)} variant="outline" size="sm" />
              </View>
              <View style={styles.actionCell}>
                <Button title={deletingAccount ? 'Deleting...' : 'Delete'} onPress={deleteAccount} loading={deletingAccount} size="sm" />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 140, paddingTop: 10 },
  pressed: { opacity: 0.88 },
  editHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,245,255,0.96)',
    borderWidth: 1,
    borderColor: '#C9D8F0',
    marginRight: 10,
  },
  headerCopy: { flex: 1 },
  headerEyebrow: { color: '#7A89AA', fontSize: 10, lineHeight: 12, fontWeight: '900', letterSpacing: 2.4, marginBottom: 2 },
  editHeaderTitle: { fontSize: 20, lineHeight: 24, fontWeight: '900' },
  headerStatePill: {
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: '#D5E0F4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerStateDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2BCB8C' },
  headerStateText: { color: '#1B3890', fontSize: 12, lineHeight: 15, fontWeight: '800' },
  hero: {
    borderRadius: 30,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1.5,
    borderColor: '#C4D1E8',
    backgroundColor: 'rgba(255,255,255,0.78)',
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#2F57A6',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  heroGlow: {
    position: 'absolute',
    top: -36,
    right: -20,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(114,167,255,0.18)',
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  heroIdentityColumn: { flex: 1, paddingTop: 2 },
  heroEyebrow: { color: '#7081A6', fontSize: 10, lineHeight: 12, fontWeight: '900', letterSpacing: 2.4 },
  heroHeading: { marginTop: 8, fontSize: 24, lineHeight: 29, fontWeight: '900', maxWidth: 210 },
  heroSub: { marginTop: 10, fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#7384A8', maxWidth: 228 },
  heroMetaRail: { marginTop: 14, gap: 8 },
  heroMetaChip: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(238,245,255,0.92)',
    borderWidth: 1,
    borderColor: '#D5E0F4',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroMetaText: { color: '#204A9C', fontSize: 11, lineHeight: 14, fontWeight: '800', maxWidth: 170 },
  heroProfilePanel: {
    width: 152,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#D7E1F3',
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#3057A2',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  avatarHalo: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(74,132,240,0.08)',
    marginBottom: 10,
  },
  avatarWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1.5,
    borderColor: '#C9D8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#EAF2FF',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  heroName: { marginTop: 2, fontSize: 16, lineHeight: 19, fontWeight: '900', textAlign: 'center' },
  heroEmail: { marginTop: 5, fontSize: 11, lineHeight: 14, fontWeight: '700', color: '#5B6E95', textAlign: 'center' },
  heroProgressTrack: {
    marginTop: 12,
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2EBF9',
    overflow: 'hidden',
  },
  heroProgressFill: { height: '100%', borderRadius: 999, backgroundColor: '#1D5FD2' },
  heroProgressLabel: { marginTop: 8, color: '#6276A4', fontSize: 10, lineHeight: 12, fontWeight: '800' },
  heroStatsRow: { marginBottom: 12, flexDirection: 'row', gap: 10 },
  heroStatCard: {
    flex: 1,
    minHeight: 86,
    borderRadius: 22,
    backgroundColor: 'rgba(246,249,255,0.95)',
    borderWidth: 1,
    borderColor: '#D5E0F4',
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'space-between',
  },
  heroStatIcon: {
    width: 24,
    height: 24,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    backgroundColor: '#EAF2FF',
  },
  heroStatValue: { color: '#183B8F', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  heroStatLabel: { color: '#697CA5', fontSize: 10, lineHeight: 13, fontWeight: '800' },
  section: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#C4D1E8',
    backgroundColor: 'rgba(255,255,255,0.82)',
    marginBottom: 12,
    shadowColor: '#3E5D9F',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  sectionTitleWrap: { flex: 1 },
  sectionEyebrow: { color: '#7A89AA', fontSize: 9, lineHeight: 11, fontWeight: '900', letterSpacing: 2.3, marginBottom: 4 },
  sectionIconPill: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: '#EEF5FF',
    borderWidth: 1,
    borderColor: '#D6E1F4',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionIconText: { color: '#1D5FD2', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  h: { fontSize: 16, lineHeight: 20, fontWeight: '900' },
  p: { marginTop: 5, fontSize: 12, lineHeight: 17, fontWeight: '700', color: '#6B7FA8' },
  fileText: { marginBottom: 10, color: '#5E6F95', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  progressText: { marginBottom: 8, color: '#1D5FD2', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  actionCell: { flex: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  confirmModal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5DEF3',
    padding: 18,
  },
  confirmTitle: { color: '#183B8F', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  confirmBody: { marginTop: 8, color: '#5E6F95', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
});
