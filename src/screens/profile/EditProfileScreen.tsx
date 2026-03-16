import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Button, Input, Screen } from '../../components/ui';
import { AuthService, UploadService } from '../../api/services';
import { api } from '../../api/client';
import { useAuthStore } from '../../context/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { Feather } from '@expo/vector-icons';
import { formatUaeMobileInput, isValidUaeMobile, normalizeUaeMobile, UAE_PHONE_EXAMPLE } from '../../utils/phone';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/app/AppNavigator';
import { ensureUploadSizeWithinLimit } from '../../utils/uploadValidation';

const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'] as const;
const AGE_RANGE_OPTIONS = ['18-24', '25-34', '35-44', '45-54', '55+'] as const;
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const isValidUrl = (value: string) => {
  const v = String(value || '').trim();
  if (!v) return true;
  try {
    const u = new URL(v);
    return ['http:', 'https:'].includes(u.protocol);
  } catch {
    return false;
  }
};

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

const formatDateInput = (date: Date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

export default function EditProfileScreen({ navigation }: Props) {
  const t = useTheme();
  const { user, signOut, signIn } = useAuthStore();
  const heroGlow = useRef(new Animated.Value(0)).current;
  const avatarFloat = useRef(new Animated.Value(0)).current;
  const badgePulse = useRef(new Animated.Value(0.96)).current;

  const [name, setName] = useState(user?.name || user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(formatUaeMobileInput(user?.phone || ''));
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [location, setLocation] = useState('');
  const [profession, setProfession] = useState('');
  const [qualification, setQualification] = useState('');
  const [experience, setExperience] = useState('');
  const [jobInterest, setJobInterest] = useState('');
  const [aboutMe, setAboutMe] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [github, setGithub] = useState('');
  const [categoriesInput, setCategoriesInput] = useState('');

  const [avatarUrl, setAvatarUrl] = useState(
    String(
      user?.avatarUrl ||
        user?.avatar ||
        user?.picture ||
        user?.profileImage ||
        user?.profilePic ||
        user?.profilePicture ||
        user?.photoUrl ||
        user?.photo ||
        user?.image ||
        ''
    )
  );
  const [pictureFile, setPictureFile] = useState<{ uri: string; name: string; type?: string } | null>(null);
  const [picturePreviewUri, setPicturePreviewUri] = useState<string>('');
  const [resumeFile, setResumeFile] = useState<{ uri: string; name: string; type?: string } | null>(null);
  const [cvUrl, setCvUrl] = useState('');
  const [cvName, setCvName] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dobPickerVisible, setDobPickerVisible] = useState(false);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  const [pickerMonth, setPickerMonth] = useState<Date>(new Date());
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
    if (candidate.startsWith('/')) return `${origin}${candidate}`;
    if (/^uploads\//i.test(candidate)) return `${origin}/${candidate}`;
    return `${origin}/uploads/${candidate}`;
  };

  const effectiveAvatarUrl = resolveAvatarUrl(avatarUrl);
  const effectiveCvUrl = resolveAvatarUrl(cvUrl);
  const displayedAvatar = picturePreviewUri || effectiveAvatarUrl;

  const parsedCategories = useMemo(() => {
    return categoriesInput
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  }, [categoriesInput]);

  const completionRatio = useMemo(() => {
    const checks = [
      name,
      email,
      phone,
      dateOfBirth,
      gender,
      ageRange,
      location,
      profession,
      qualification,
      experience,
      jobInterest,
      aboutMe,
      linkedin,
      github,
      categoriesInput,
      picturePreviewUri || avatarUrl,
      resumeFile?.name || cvUrl,
    ];
    const completed = checks.filter((value) => String(value || '').trim()).length;
    return completed / checks.length;
  }, [
    aboutMe,
    ageRange,
    avatarUrl,
    categoriesInput,
    cvUrl,
    dateOfBirth,
    email,
    experience,
    gender,
    github,
    jobInterest,
    linkedin,
    location,
    name,
    phone,
    picturePreviewUri,
    profession,
    qualification,
    resumeFile?.name,
  ]);

  const profileStrengthLabel = completionRatio >= 0.85 ? 'Ready to apply' : completionRatio >= 0.55 ? 'In progress' : 'Needs attention';
  const completionPercent = Math.round(completionRatio * 100);
  const skillsCount = parsedCategories.length;
  const resumeStatus = resumeFile?.name || cvUrl ? 'CV attached' : 'CV missing';
  const accentStat = location || profession || 'Career profile';

  const daysInPickerMonth = useMemo(() => {
    const year = pickerMonth.getFullYear();
    const month = pickerMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const slots: Array<{ day?: number }> = [];
    for (let i = 0; i < firstDay; i += 1) slots.push({});
    for (let day = 1; day <= totalDays; day += 1) slots.push({ day });
    return slots;
  }, [pickerMonth]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear + 1; y >= currentYear - 90; y -= 1) years.push(y);
    return years;
  }, []);

  const load = async () => {
    setLoadingProfile(true);
    try {
      const res = await AuthService.getProfile();
      const u = (res as any)?.user || res;
      setName(u?.name || u?.fullName || '');
      setEmail(u?.email || '');
      setPhone(formatUaeMobileInput(u?.phone || ''));
      setDateOfBirth(
        u?.dateOfBirth && !Number.isNaN(new Date(u.dateOfBirth).getTime())
          ? new Date(u.dateOfBirth).toISOString().split('T')[0]
          : ''
      );
      setGender(String(u?.gender || '').trim());
      setAgeRange(String(u?.ageRange || '').trim());
      setLocation(String(u?.location || '').trim());
      setProfession(String(u?.profession || '').trim());
      setQualification(String(u?.qualification || '').trim());
      setExperience(String(u?.experience || '').trim());
      setJobInterest(String(u?.jobInterest || '').trim());
      setAboutMe(String(u?.aboutMe || '').trim());
      setLinkedin(String(u?.socialNetworks?.linkedin || u?.linkedin || '').trim());
      setGithub(String(u?.socialNetworks?.github || u?.github || '').trim());
      const categoriesRaw = Array.isArray(u?.categories) ? u.categories.join(', ') : String(u?.categories || '').trim();
      setCategoriesInput(categoriesRaw);
      setAvatarUrl(
        String(
          u?.avatarUrl || u?.avatar || u?.picture || u?.profileImage || u?.profilePic || u?.profilePicture || u?.photoUrl || u?.photo || u?.image || ''
        )
      );
      setPictureFile(null);
      setPicturePreviewUri('');
      const cvCandidate = String(u?.CV || u?.cv || u?.resume || u?.resumeUrl || '').trim();
      setCvUrl(cvCandidate);
      setCvName(cvCandidate ? cvCandidate.split('/').pop() || 'Resume file' : '');
      setResumeFile(null);
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

  useEffect(() => {
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroGlow, {
          toValue: 1,
          duration: 5200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(heroGlow, {
          toValue: 0,
          duration: 5200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    const avatarLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(avatarFloat, {
          toValue: -8,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(avatarFloat, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const badgeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(badgePulse, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(badgePulse, {
          toValue: 0.96,
          duration: 1700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
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

  const setField = (key: string, setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validateProfile = () => {
    const nextErrors: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) nextErrors.name = 'Please enter your full name.';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nextErrors.email = 'Invalid email address.';
    if (phone.trim() && !isValidUaeMobile(phone)) nextErrors.phone = `Use UAE phone format like ${UAE_PHONE_EXAMPLE}.`;

    if (dateOfBirth.trim()) {
      const dob = new Date(dateOfBirth.trim());
      if (Number.isNaN(dob.getTime())) nextErrors.dateOfBirth = 'Use a valid date.';
      else {
        const now = new Date();
        if (dob > now) nextErrors.dateOfBirth = 'Date of birth cannot be in the future.';
      }
    }

    if (gender.trim() && !GENDER_OPTIONS.includes(gender as any)) nextErrors.gender = 'Select a valid gender option.';
    if (ageRange.trim() && !AGE_RANGE_OPTIONS.includes(ageRange as any)) nextErrors.ageRange = 'Select a valid age range.';
    if (!isValidUrl(linkedin)) nextErrors.linkedin = 'Enter a valid LinkedIn URL (http/https).';
    if (!isValidUrl(github)) nextErrors.github = 'Enter a valid GitHub URL (http/https).';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const save = async () => {
    if (!validateProfile()) {
      Alert.alert('Invalid details', 'Please fix highlighted fields before saving.');
      return;
    }
    setSaving(true);
    setUploadProgress(0);
    try {
      const normalizedPhone = normalizeUaeMobile(phone);
      if (phone.trim() && !isValidUaeMobile(phone)) {
        Alert.alert('Invalid phone', `Use UAE phone format like ${UAE_PHONE_EXAMPLE} or 04XXXXXXXX.`);
        return;
      }
      const currentAvatar = picturePreviewUri || avatarUrl.trim();
      const currentCv = cvUrl.trim();
      let uploadedAvatarUrl = currentAvatar;
      let uploadedCvUrl = currentCv;

      if (pictureFile) {
        setUploadProgress(15);
        const uploaded = await UploadService.uploadFile(pictureFile);
        uploadedAvatarUrl = String(uploaded?.url || uploaded?.fileUrl || uploaded?.path || '').trim();
        if (!uploadedAvatarUrl) throw new Error('Profile photo upload did not return a file URL.');
        setUploadProgress(45);
      }

      if (resumeFile) {
        setUploadProgress(55);
        const uploaded = await UploadService.uploadFile(resumeFile);
        uploadedCvUrl = String(uploaded?.url || uploaded?.fileUrl || uploaded?.path || '').trim();
        if (!uploadedCvUrl) throw new Error('Resume upload did not return a file URL.');
        setUploadProgress(80);
      }

      const basePayload = {
        name: name.trim(),
        email: email.trim(),
        phone: normalizedPhone || '',
        dateOfBirth: dateOfBirth.trim(),
        gender: gender.trim(),
        ageRange: ageRange.trim(),
        location: location.trim(),
        profession: profession.trim(),
        qualification: qualification.trim(),
        experience: experience.trim(),
        jobInterest: jobInterest.trim(),
        aboutMe: aboutMe.trim(),
        categories: parsedCategories,
        linkedin: linkedin.trim(),
        github: github.trim(),
        socialNetworks: {
          linkedin: linkedin.trim(),
          github: github.trim(),
        },
        picture: uploadedAvatarUrl || '',
        photo: uploadedAvatarUrl || '',
        image: uploadedAvatarUrl || '',
        avatar: uploadedAvatarUrl || '',
        avatarUrl: uploadedAvatarUrl || '',
        profileImage: uploadedAvatarUrl || '',
        profilePicture: uploadedAvatarUrl || '',
        CV: uploadedCvUrl || '',
        cv: uploadedCvUrl || '',
        resume: uploadedCvUrl || '',
        resumeUrl: uploadedCvUrl || '',
      };
      const requestPayload = {
        ...basePayload,
        categories: JSON.stringify(parsedCategories),
        socialNetworks: JSON.stringify(basePayload.socialNetworks),
      };
      const updated = await AuthService.updateProfile(requestPayload);
      const token = useAuthStore.getState().token;
      const updatedUserPayload = ((updated as any)?.user || updated || {}) as any;
      const mergedUser = {
        ...(user || {}),
        ...updatedUserPayload,
        picture:
          updatedUserPayload?.picture ||
          updatedUserPayload?.image ||
          updatedUserPayload?.avatarUrl ||
          updatedUserPayload?.avatar ||
          updatedUserPayload?.profileImage ||
          uploadedAvatarUrl ||
          '',
        image:
          updatedUserPayload?.image ||
          updatedUserPayload?.picture ||
          updatedUserPayload?.avatarUrl ||
          updatedUserPayload?.avatar ||
          updatedUserPayload?.profileImage ||
          uploadedAvatarUrl ||
          '',
        avatarUrl:
          updatedUserPayload?.avatarUrl ||
          updatedUserPayload?.avatar ||
          updatedUserPayload?.picture ||
          updatedUserPayload?.image ||
          updatedUserPayload?.profileImage ||
          uploadedAvatarUrl ||
          '',
        CV: updatedUserPayload?.CV || updatedUserPayload?.cv || updatedUserPayload?.resume || uploadedCvUrl || '',
        cv: updatedUserPayload?.cv || updatedUserPayload?.CV || updatedUserPayload?.resume || uploadedCvUrl || '',
        socialNetworks: {
          ...(updatedUserPayload?.socialNetworks || {}),
          linkedin: updatedUserPayload?.socialNetworks?.linkedin || linkedin.trim(),
          github: updatedUserPayload?.socialNetworks?.github || github.trim(),
        },
      };
      if (token) await signIn({ token, user: mergedUser as any });
      setPictureFile(null);
      setPicturePreviewUri('');
      setResumeFile(null);
      setAvatarUrl(uploadedAvatarUrl || '');
      setCvUrl(uploadedCvUrl || '');
      if (resumeFile) setCvName(resumeFile.name || cvName);
      setUploadProgress(100);
      const fresh = await AuthService.getProfile().catch(() => null);
      const latest = (fresh as any)?.user || fresh;
      const latestPicture = String(
        latest?.picture || latest?.image || latest?.avatarUrl || latest?.avatar || latest?.profileImage || latest?.profilePicture || ''
      ).trim();
      if (pictureFile && !latestPicture) {
        Alert.alert('Saved with warning', 'Profile updated, but picture was not returned in profile. Please try uploading photo again.');
      } else {
        Alert.alert('Saved', 'Profile updated successfully.');
      }
      await load();
    } catch (e: any) {
      Alert.alert('Save failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setSaving(false);
    }
  };

  const openDobPicker = () => {
    const base =
      dateOfBirth.trim() && !Number.isNaN(new Date(dateOfBirth).getTime())
        ? new Date(dateOfBirth)
        : new Date();
    setPickerMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setYearPickerVisible(false);
    setDobPickerVisible(true);
  };

  const pickDate = (day: number) => {
    const next = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth(), day);
    const formatted = formatDateInput(next);
    setDateOfBirth(formatted);
    setErrors((prev) => {
      const nextErrors = { ...prev };
      delete nextErrors.dateOfBirth;
      return nextErrors;
    });
    setDobPickerVisible(false);
  };

  const pickAndUploadPhoto = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['image/*'],
    });
    if (res.canceled) return;

    const file = res.assets[0];
    try {
      await ensureUploadSizeWithinLimit({ uri: file.uri, name: file.name, size: file.size ?? null });
    } catch (e: any) {
      Alert.alert('File too large', e?.userMessage || e?.message || 'Please choose a file smaller than 5 MB.');
      return;
    }
    setUploadingPhoto(true);
    setPictureFile({
      uri: file.uri,
      name: file.name || `avatar-${Date.now()}.jpg`,
      type: file.mimeType || 'image/jpeg',
    });
    setPicturePreviewUri(file.uri);
    setAvatarFailed(false);
    setUploadingPhoto(false);
    Alert.alert('Selected', 'Profile photo selected. Tap "Save changes" to upload.');
  };

  const pickResume = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    });
    if (res.canceled) return;

    const file = res.assets[0];
    try {
      await ensureUploadSizeWithinLimit({ uri: file.uri, name: file.name, size: file.size ?? null });
    } catch (e: any) {
      Alert.alert('File too large', e?.userMessage || e?.message || 'Please choose a file smaller than 5 MB.');
      return;
    }
    setUploadingResume(true);
    setResumeFile({
      uri: file.uri,
      name: file.name || `resume-${Date.now()}.pdf`,
      type: file.mimeType || 'application/octet-stream',
    });
    setCvName(file.name || 'Selected resume');
    setUploadingResume(false);
    Alert.alert('Selected', 'Resume selected. Tap "Save changes" to upload.');
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
        <View style={styles.editHeaderRow}>
          <Pressable onPress={() => navigation.canGoBack() && navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={18} color="#1B3890" />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>PROFILE STUDIO</Text>
            <Text style={[styles.editHeaderTitle, { color: '#1B3890', fontFamily: t.typography.fontFamily.bold }]}>Edit Profile</Text>
          </View>
          <Animated.View style={[styles.headerStatePill, { transform: [{ scale: badgePulse }] }]}>
            <View style={styles.headerStateDot} />
            <Text style={styles.headerStateText}>{saving ? 'Saving' : loadingProfile ? 'Syncing' : 'Live edit'}</Text>
          </Animated.View>
        </View>

        <View style={styles.hero}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.heroGlow,
              {
                opacity: heroGlow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] }),
                transform: [
                  {
                    translateX: heroGlow.interpolate({ inputRange: [0, 1], outputRange: [-18, 24] }),
                  },
                ],
              },
            ]}
          />
          <View style={styles.heroTopRow}>
            <View style={styles.heroIdentityColumn}>
              <Text style={styles.heroEyebrow}>PROFILE EDITOR</Text>
              <Text style={[styles.heroHeading, { color: t.colors.primary }]}>Shape how recruiters see you.</Text>
              <Text style={styles.heroSub}>{loadingProfile ? 'Loading profile...' : 'Update your photo, story, and details.'}</Text>

              <View style={styles.heroMetaRail}>
                <View style={styles.heroMetaChip}>
                  <Feather name="zap" size={14} color="#1D5FD2" />
                  <Text style={styles.heroMetaText}>{profileStrengthLabel}</Text>
                </View>
                <View style={styles.heroMetaChip}>
                  <Feather name="map-pin" size={14} color="#1D5FD2" />
                  <Text style={styles.heroMetaText} numberOfLines={1}>{accentStat}</Text>
                </View>
              </View>
            </View>

            <View style={styles.heroProfilePanel}>
              <Animated.View style={[styles.avatarHalo, { transform: [{ translateY: avatarFloat }] }]}>
                <View style={[styles.avatarWrap, { borderColor: '#C0CFEA', backgroundColor: '#F8FAFF' }]}>
                  {displayedAvatar && !avatarFailed ? (
                    <Image source={{ uri: displayedAvatar }} style={styles.avatarImage} onError={() => setAvatarFailed(true)} />
                  ) : (
                    <Feather name="user" size={38} color="#5E6F95" />
                  )}
                </View>
              </Animated.View>
              <Text style={[styles.heroName, { color: t.colors.primary }]} numberOfLines={1}>
                {name || user?.name || user?.fullName || 'Your Profile'}
              </Text>
              <Text style={styles.heroEmail} numberOfLines={1}>
                {email || user?.email || 'user@example.com'}
              </Text>
              <View style={styles.heroProgressTrack}>
                <View style={[styles.heroProgressFill, { width: `${completionPercent}%` }]} />
              </View>
              <Text style={styles.heroProgressLabel}>{completionPercent}% complete</Text>
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <View style={styles.heroStatIcon}>
                <Feather name="activity" size={13} color="#183B8F" />
              </View>
              <Text style={styles.heroStatValue}>{completionPercent}%</Text>
              <Text style={styles.heroStatLabel}>Profile strength</Text>
            </View>
            <View style={styles.heroStatCard}>
              <View style={styles.heroStatIcon}>
                <Feather name="award" size={13} color="#183B8F" />
              </View>
              <Text style={styles.heroStatValue}>{skillsCount}</Text>
              <Text style={styles.heroStatLabel}>Skill tags</Text>
            </View>
            <View style={styles.heroStatCard}>
              <View style={styles.heroStatIcon}>
                <Feather name="file-text" size={13} color="#183B8F" />
              </View>
              <Text style={styles.heroStatValue}>{resumeFile?.name || cvUrl ? 'Ready' : 'Add'}</Text>
              <Text style={styles.heroStatLabel}>{resumeStatus}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
              <Text style={styles.sectionEyebrow}>PROFILE DETAILS</Text>
              <Text style={[styles.h, { color: t.colors.primary }]}>Personal Info</Text>
              <Text style={styles.p}>Keep details up to date.</Text>
            </View>
            <View style={styles.sectionIconPill}>
              <Feather name="edit-3" size={15} color="#1D5FD2" />
              <Text style={styles.sectionIconText}>Core profile</Text>
            </View>
          </View>
          <View style={{ height: 12 }} />

          <Text style={[styles.label, { color: t.colors.text }]}>Profile photo</Text>
          <View style={styles.photoRow}>
            <Button title={uploadingPhoto ? 'Selecting...' : 'Choose photo'} onPress={pickAndUploadPhoto} loading={uploadingPhoto} size="sm" />
            <View style={{ width: 10 }} />
            <Button
              title="Remove photo"
              variant="outline"
              size="sm"
              onPress={() => {
                setAvatarUrl('');
                setPictureFile(null);
                setPicturePreviewUri('');
                setAvatarFailed(false);
              }}
              disabled={!avatarUrl && !picturePreviewUri}
            />
          </View>

          <Text style={[styles.label, { color: t.colors.text }]}>CV / Resume</Text>
          <View style={styles.photoRow}>
            <Button title={uploadingResume ? 'Selecting...' : 'Choose CV'} onPress={pickResume} loading={uploadingResume} size="sm" />
            <View style={{ width: 10 }} />
            <Button
              title="Remove CV"
              variant="outline"
              size="sm"
              onPress={() => {
                setResumeFile(null);
                setCvUrl('');
                setCvName('');
              }}
              disabled={!resumeFile && !cvUrl}
            />
          </View>
          {cvName ? (
            <Text style={styles.fileText}>{`Selected: ${cvName}`}</Text>
          ) : effectiveCvUrl ? (
            <Pressable onPress={() => Linking.openURL(effectiveCvUrl).catch(() => {})}>
              <Text style={styles.fileLink}>View current CV</Text>
            </Pressable>
          ) : (
            <Text style={styles.fileText}>No CV uploaded yet</Text>
          )}

          <View style={{ height: 6 }} />
          <Input
            label="Name"
            value={name}
            onChangeText={setField('name', setName)}
            placeholder="Your name"
            icon={<Feather name="user" size={16} color="#5D6E92" />}
            error={errors.name}
          />
          <Input
            label="Email (read-only)"
            value={email}
            onChangeText={setField('email', setEmail)}
            placeholder="you@example.com"
            keyboardType="email-address"
            editable={false}
            icon={<Feather name="mail" size={16} color="#5D6E92" />}
            error={errors.email}
          />
          <Input
            label="Phone"
            value={phone}
            onChangeText={(value) => setField('phone', setPhone)(formatUaeMobileInput(value))}
            placeholder={UAE_PHONE_EXAMPLE}
            keyboardType="phone-pad"
            icon={<Feather name="phone" size={16} color="#5D6E92" />}
            error={errors.phone}
          />
          <Text style={[styles.label, { color: t.colors.text }]}>Date of Birth</Text>
          <Pressable style={[styles.dateField, !!errors.dateOfBirth && styles.dateFieldError]} onPress={openDobPicker}>
            <Feather name="calendar" size={16} color="#5D6E92" />
            <Text style={[styles.dateFieldText, !dateOfBirth && styles.dateFieldPlaceholder]}>{dateOfBirth || 'Select date of birth'}</Text>
            <Feather name="chevron-down" size={16} color="#5D6E92" />
          </Pressable>
          {errors.dateOfBirth ? <Text style={styles.inlineError}>{errors.dateOfBirth}</Text> : null}

          <Text style={[styles.label, { color: t.colors.text }]}>Gender</Text>
          <View style={styles.chipsRow}>
            {GENDER_OPTIONS.map((option) => (
              <Pressable
                key={option}
                style={[styles.chip, gender === option && styles.chipActive]}
                onPress={() => {
                  setGender(option);
                  if (errors.gender) setErrors((prev) => ({ ...prev, gender: '' }));
                }}
              >
                <Text style={[styles.chipText, gender === option && styles.chipTextActive]}>{option}</Text>
              </Pressable>
            ))}
          </View>
          {errors.gender ? <Text style={styles.inlineError}>{errors.gender}</Text> : null}

          <Text style={[styles.label, { color: t.colors.text, marginTop: 8 }]}>Age Range</Text>
          <View style={styles.chipsRow}>
            {AGE_RANGE_OPTIONS.map((option) => (
              <Pressable
                key={option}
                style={[styles.chip, ageRange === option && styles.chipActive]}
                onPress={() => {
                  setAgeRange(option);
                  if (errors.ageRange) setErrors((prev) => ({ ...prev, ageRange: '' }));
                }}
              >
                <Text style={[styles.chipText, ageRange === option && styles.chipTextActive]}>{option}</Text>
              </Pressable>
            ))}
          </View>
          {errors.ageRange ? <Text style={styles.inlineError}>{errors.ageRange}</Text> : null}

          <Input
            label="Location"
            value={location}
            onChangeText={setField('location', setLocation)}
            placeholder="City / Country"
            icon={<Feather name="map-pin" size={16} color="#5D6E92" />}
          />
          <Input
            label="Profession"
            value={profession}
            onChangeText={setField('profession', setProfession)}
            placeholder="Your profession"
            icon={<Feather name="briefcase" size={16} color="#5D6E92" />}
          />
          <Input
            label="Qualification"
            value={qualification}
            onChangeText={setField('qualification', setQualification)}
            placeholder="Highest qualification"
            icon={<Feather name="file-text" size={16} color="#5D6E92" />}
          />
          <Input
            label="Experience"
            value={experience}
            onChangeText={setField('experience', setExperience)}
            placeholder="e.g. 5 years"
            icon={<Feather name="clock" size={16} color="#5D6E92" />}
          />
          <Input
            label="Job Interest"
            value={jobInterest}
            onChangeText={setField('jobInterest', setJobInterest)}
            placeholder="Preferred roles"
            icon={<Feather name="target" size={16} color="#5D6E92" />}
          />
          <Input
            label="About Me"
            value={aboutMe}
            onChangeText={setField('aboutMe', setAboutMe)}
            placeholder="Tell us about yourself..."
            multiline
            icon={<Feather name="align-left" size={16} color="#5D6E92" />}
          />

          <Text style={[styles.label, { color: t.colors.text, marginTop: 4 }]}>Social Networks</Text>
          <Input
            label="LinkedIn"
            value={linkedin}
            onChangeText={setField('linkedin', setLinkedin)}
            placeholder="https://linkedin.com/in/username"
            icon={<Feather name="linkedin" size={16} color="#5D6E92" />}
            error={errors.linkedin}
          />
          <Input
            label="GitHub"
            value={github}
            onChangeText={setField('github', setGithub)}
            placeholder="https://github.com/username"
            icon={<Feather name="github" size={16} color="#5D6E92" />}
            error={errors.github}
          />

          <Input
            label="Skills categories (comma separated)"
            value={categoriesInput}
            onChangeText={setField('categories', setCategoriesInput)}
            placeholder="JavaScript, React, Node.js"
            icon={<Feather name="list" size={16} color="#5D6E92" />}
          />
          {parsedCategories.length ? <Text style={styles.categoriesHint}>{`Parsed categories: ${parsedCategories.join(' | ')}`}</Text> : null}

          {uploadProgress > 0 && uploadProgress < 100 ? <Text style={styles.progressText}>{`Uploading: ${uploadProgress}%`}</Text> : null}
          {uploadProgress === 100 ? <Text style={styles.progressText}>Upload complete</Text> : null}
          <Button title={saving ? 'Saving...' : 'Save changes'} onPress={save} loading={saving} size="sm" />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
              <Text style={styles.sectionEyebrow}>ACCESS CONTROL</Text>
              <Text style={[styles.h, { color: t.colors.primary }]}>Security</Text>
              <Text style={styles.p}>Update your password safely.</Text>
            </View>
            <View style={styles.sectionIconPill}>
              <Feather name="shield" size={15} color="#1D5FD2" />
              <Text style={styles.sectionIconText}>Protected</Text>
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
          <Button title={changing ? 'Updating...' : 'Change password'} onPress={changePass} loading={changing} size="sm" />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
              <Text style={styles.sectionEyebrow}>SESSION CONTROLS</Text>
              <Text style={[styles.h, { color: t.colors.primary }]}>Account Actions</Text>
              <Text style={styles.p}>Manage your session or account.</Text>
            </View>
            <View style={styles.sectionIconPill}>
              <Feather name="sliders" size={15} color="#1D5FD2" />
              <Text style={styles.sectionIconText}>Controls</Text>
            </View>
          </View>
          <View style={{ height: 12 }} />
          <Button title="Logout" onPress={() => signOut()} variant="secondary" size="sm" />
          <View style={{ height: 10 }} />
          <Button title="Delete account" onPress={confirmDelete} variant="ghost" size="sm" />
        </View>
      </ScrollView>

      <Modal visible={dobPickerVisible} transparent animationType="fade" onRequestClose={() => setDobPickerVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDobPickerVisible(false)}>
          <Pressable style={styles.calendarModal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.calendarHeader}>
              <Pressable onPress={() => setPickerMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} style={styles.calendarNavBtn}>
                <Feather name="chevron-left" size={18} color="#1B3890" />
              </Pressable>
              <Pressable onPress={() => setYearPickerVisible((v) => !v)} style={styles.calendarMonthBtn}>
                <Text style={styles.calendarMonthText}>{formatMonthLabel(pickerMonth)}</Text>
                <Feather name={yearPickerVisible ? 'chevron-up' : 'chevron-down'} size={15} color="#1B3890" />
              </Pressable>
              <Pressable onPress={() => setPickerMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} style={styles.calendarNavBtn}>
                <Feather name="chevron-right" size={18} color="#1B3890" />
              </Pressable>
            </View>

            {yearPickerVisible ? (
              <ScrollView style={styles.yearScroll} contentContainerStyle={styles.yearGrid} showsVerticalScrollIndicator>
                {yearOptions.map((year) => {
                  const selected = year === pickerMonth.getFullYear();
                  return (
                    <Pressable
                      key={year}
                      style={[styles.yearCell, selected && styles.yearCellSelected]}
                      onPress={() => {
                        setPickerMonth((prev) => new Date(year, prev.getMonth(), 1));
                        setYearPickerVisible(false);
                      }}
                    >
                      <Text style={[styles.yearText, selected && styles.yearTextSelected]}>{year}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <>
                <View style={styles.weekRow}>
                  {WEEK_DAYS.map((w) => (
                    <Text key={w} style={styles.weekLabel}>
                      {w}
                    </Text>
                  ))}
                </View>

                <View style={styles.daysGrid}>
                  {daysInPickerMonth.map((slot, idx) => {
                    if (!slot.day) return <View key={`empty-${idx}`} style={styles.dayCell} />;
                    const candidate = formatDateInput(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth(), slot.day));
                    const selected = candidate === dateOfBirth;
                    return (
                      <Pressable key={candidate} style={[styles.dayCell, selected && styles.dayCellSelected]} onPress={() => pickDate(slot.day as number)}>
                        <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{slot.day}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 140, paddingTop: 10 },
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
  headerEyebrow: {
    color: '#7A89AA',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 2.4,
    marginBottom: 2,
  },
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
  headerStateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2BCB8C',
  },
  headerStateText: {
    color: '#1B3890',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
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
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  heroIdentityColumn: {
    flex: 1,
    paddingTop: 2,
  },
  heroEyebrow: {
    color: '#7081A6',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  heroHeading: {
    marginTop: 8,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    maxWidth: 210,
  },
  heroSub: { marginTop: 10, fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#7384A8', maxWidth: 228 },
  heroMetaRail: {
    marginTop: 14,
    gap: 8,
  },
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
  heroMetaText: {
    color: '#204A9C',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    maxWidth: 160,
  },
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
  heroProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#1D5FD2',
  },
  heroProgressLabel: {
    marginTop: 8,
    color: '#6276A4',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  heroStatsRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
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
  heroStatValue: {
    color: '#183B8F',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  heroStatLabel: {
    color: '#697CA5',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitleWrap: {
    flex: 1,
  },
  sectionEyebrow: {
    color: '#7A89AA',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 2.3,
    marginBottom: 4,
  },
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
  sectionIconText: {
    color: '#1D5FD2',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  h: { fontSize: 16, lineHeight: 20, fontWeight: '900' },
  p: { marginTop: 5, fontSize: 12, lineHeight: 17, fontWeight: '700', color: '#6B7FA8' },
  label: { fontWeight: '800', marginBottom: 8, fontSize: 12, lineHeight: 15 },
  photoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
  fileText: { marginTop: 2, marginBottom: 10, color: '#5E6F95', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  fileLink: { marginTop: 2, marginBottom: 10, color: '#1D5FD2', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C9D8F0',
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: '#1B3890',
    borderColor: '#1B3890',
  },
  chipText: { color: '#1D4FAE', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  chipTextActive: { color: '#FFFFFF' },
  categoriesHint: { marginTop: -4, marginBottom: 8, color: '#667CA9', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  progressText: { marginBottom: 8, color: '#1D5FD2', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  dateField: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C9D8F0',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 6,
  },
  dateFieldError: {
    borderColor: '#D12B2B',
  },
  dateFieldText: {
    flex: 1,
    color: '#1E2F56',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  dateFieldPlaceholder: {
    color: '#8B98B8',
  },
  inlineError: {
    marginTop: -2,
    marginBottom: 8,
    color: '#D12B2B',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  calendarModal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5DEF3',
    padding: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calendarNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF2FF',
    borderWidth: 1,
    borderColor: '#C9D8F0',
  },
  calendarMonthText: {
    color: '#1B3890',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  calendarMonthBtn: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C9D8F0',
    backgroundColor: '#EAF2FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  weekLabel: {
    width: '14.2%',
    textAlign: 'center',
    color: '#6A7FA8',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  dayCellSelected: {
    backgroundColor: '#1B3890',
  },
  dayText: {
    color: '#1E2F56',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
  },
  dayTextSelected: {
    color: '#FFFFFF',
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 6,
    paddingBottom: 6,
  },
  yearScroll: {
    maxHeight: 320,
  },
  yearCell: {
    width: '23%',
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C9D8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearCellSelected: {
    backgroundColor: '#1B3890',
    borderColor: '#1B3890',
  },
  yearText: {
    color: '#1E2F56',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '800',
  },
  yearTextSelected: {
    color: '#FFFFFF',
  },
  avatarWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
});
