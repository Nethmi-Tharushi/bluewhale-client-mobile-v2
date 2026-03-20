import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Image, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as WebBrowser from 'expo-web-browser';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import ManagedViewBanner from '../../components/managed/ManagedViewBanner';
import { Button, EmptyState, Screen } from '../../components/ui';
import { DocumentsService } from '../../api/services';
import type { DocumentGroups, UserDocument } from '../../types/models';
import { useTheme } from '../../theme/ThemeProvider';
import { API_BASE_URL } from '../../config/api';
import { useAuthStore } from '../../context/authStore';
import { downloadResolvedRemoteFile } from '../../utils/remoteFileDownload';
import { getManagedCandidateId, getManagedCandidateName, isManagedViewActive, stripManagedViewState } from '../../utils/managedView';

type DocumentTypeKey = keyof DocumentGroups;
type PickedFile = { uri: string; name: string; type?: string; size?: number | null };

const DOCUMENT_TYPES: Array<{
  key: DocumentTypeKey;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  multiple: boolean;
  accept: string[];
  accentBg: string;
  accentColor: string;
}> = [
  {
    key: 'photo',
    label: 'Candidate Photo',
    icon: 'user',
    multiple: false,
    accept: ['image/*'],
    accentBg: '#E8F1FF',
    accentColor: '#1D5FD2',
  },
  {
    key: 'passport',
    label: 'Passport Photo',
    icon: 'credit-card',
    multiple: false,
    accept: ['image/*'],
    accentBg: '#E8F8EE',
    accentColor: '#17834F',
  },
  {
    key: 'drivingLicense',
    label: 'Driving License',
    icon: 'file-text',
    multiple: false,
    accept: ['image/*'],
    accentBg: '#FFF0EB',
    accentColor: '#D05719',
  },
  {
    key: 'cv',
    label: 'CV(s)',
    icon: 'folder',
    multiple: true,
    accept: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    accentBg: '#F1EBFF',
    accentColor: '#6A35D5',
  },
];

const emptyGroups = (): DocumentGroups => ({
  photo: [],
  passport: [],
  drivingLicense: [],
  cv: [],
});

const getDocumentUrl = (doc: UserDocument) => String(doc?.fileUrl || doc?.url || '').trim();
const getDocumentName = (doc: UserDocument, fallback: string) =>
  String(doc?.fileName || doc?.originalName || fallback || 'Document').trim();

const toAbsoluteHttpUrl = (raw: string) => {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  const apiRoot = API_BASE_URL.replace(/\/$/, '');
  const origin = apiRoot.replace(/\/api$/i, '');
  if (v.startsWith('/api/')) return `${origin}${v}`;
  if (v.startsWith('/')) return `${apiRoot}${v}`;
  return `${apiRoot}/${v}`;
};

const extensionFromMimeType = (mimeType?: string) => {
  const mime = String(mimeType || '').trim().toLowerCase();
  if (!mime) return '';
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('msword')) return 'doc';
  if (mime.includes('wordprocessingml')) return 'docx';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('gif')) return 'gif';
  return '';
};

const ensureFileExtension = (name: string, mimeType?: string, fallback = 'bin') => {
  const trimmed = String(name || '').trim();
  if (/\.[a-z0-9]{1,8}$/i.test(trimmed)) return trimmed;
  const ext = extensionFromMimeType(mimeType) || fallback;
  return `${trimmed || `document-${Date.now()}`}.${ext}`;
};

const normalizeMimeType = (value?: string, fallback = 'application/octet-stream') =>
  String(value || fallback)
    .trim()
    .toLowerCase()
    .split(';')[0]
    .trim() || fallback;

const openLocalFile = async (fileUri: string, mimeType = 'application/octet-stream') => {
  try {
    if (Platform.OS === 'android' && typeof (FileSystem as any).getContentUriAsync === 'function') {
      const contentUri = await (FileSystem as any).getContentUriAsync(fileUri);
      try {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: normalizeMimeType(mimeType),
        });
        return;
      } catch {
        // Try file URI fallback next.
      }
    }
    try {
      await Linking.openURL(fileUri);
      return;
    } catch {
      // Throw a clearer error below.
    }
  } catch {
    // fall through
  }
  throw new Error('File was downloaded, but no app could open it on this device.');
};

const saveFileToAndroidFolder = async (sourceUri: string, fileName: string, mimeType: string) => {
  const storageFramework = (FileSystem as any).StorageAccessFramework;
  if (Platform.OS !== 'android' || !storageFramework) return false;

  const initialUri =
    typeof storageFramework.getUriForDirectoryInRoot === 'function'
      ? storageFramework.getUriForDirectoryInRoot('Download')
      : null;
  const permissions = await storageFramework.requestDirectoryPermissionsAsync(initialUri);
  if (!permissions?.granted || !permissions?.directoryUri) {
    throw new Error('Pick a folder to save the file.');
  }

  const base64 = await FileSystem.readAsStringAsync(sourceUri, {
    encoding: (FileSystem as any).EncodingType?.Base64 || 'base64',
  });
  const uniqueName = fileName.replace(/(\.[a-z0-9]{1,8})$/i, `-${Date.now()}$1`);
  const targetUri = await storageFramework.createFileAsync(permissions.directoryUri, uniqueName, mimeType);
  await storageFramework.writeAsStringAsync(targetUri, base64, {
    encoding: (FileSystem as any).EncodingType?.Base64 || 'base64',
  });

  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: targetUri,
      flags: 1,
      type: normalizeMimeType(mimeType),
    });
    return true;
  } catch {
    Alert.alert('File saved', `Saved as ${uniqueName}. Open it from your Files or Downloads app.`);
    return true;
  }
};

export default function DocumentsScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const signIn = useAuthStore((s) => s.signIn);
  const compact = width < 390;
  const [documents, setDocuments] = useState<DocumentGroups>(emptyGroups());
  const [selectedFiles, setSelectedFiles] = useState<Partial<Record<DocumentTypeKey, PickedFile[]>>>({});
  const [previewUris, setPreviewUris] = useState<Partial<Record<DocumentTypeKey, string>>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const managedViewActive = useMemo(() => isManagedViewActive(user), [user]);
  const managedCandidateId = useMemo(() => getManagedCandidateId(user), [user]);
  const managedCandidateName = useMemo(() => getManagedCandidateName(user), [user]);
  const heroEntrance = useRef(new Animated.Value(0)).current;
  const contentEntrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  const load = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const grouped = await DocumentsService.list(managedCandidateId ? { managedCandidateId } : undefined);
      setDocuments(grouped);
    } catch (err: any) {
      const msg = String(err?.userMessage || err?.message || 'Unable to load documents');
      setMessage({ type: 'error', text: msg });
      setDocuments(emptyGroups());
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managedCandidateId]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(null), 2200);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroEntrance, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentEntrance, {
        toValue: 1,
        duration: 760,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(float, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(float, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(sweep, { toValue: 1, duration: 2300, delay: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ),
    ];

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [contentEntrance, float, heroEntrance, pulse, sweep]);

  const exitManagedView = async () => {
    if (!token || !user) return;
    await signIn({ token, user: stripManagedViewState(user) });
  };

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (navigation.getParent()?.canGoBack()) {
      navigation.getParent()?.goBack();
      return;
    }
    navigation.getParent()?.navigate('Overview' as never);
  }, [navigation]);

  const totalExistingCount = useMemo(
    () => DOCUMENT_TYPES.reduce((sum, item) => sum + (documents[item.key]?.length || 0), 0),
    [documents]
  );

  const totalSelectedCount = useMemo(
    () =>
      DOCUMENT_TYPES.reduce((sum, item) => {
        return sum + ((selectedFiles[item.key] || []).length || 0);
      }, 0),
    [selectedFiles]
  );

  const completedTypesCount = useMemo(
    () => DOCUMENT_TYPES.filter((item) => (documents[item.key] || []).length > 0).length,
    [documents]
  );

  const heroY = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });
  const contentY = contentEntrance.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.48] });
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-180, 260] });

  const materializePickedFile = async (asset: DocumentPicker.DocumentPickerAsset, typeKey: DocumentTypeKey): Promise<PickedFile> => {
    const originalUri = String(asset?.uri || '').trim();
    if (!originalUri) throw new Error('Selected file is missing a valid URI.');

    const safeName = ensureFileExtension(asset?.name || `${typeKey}-${Date.now()}`, asset?.mimeType, typeKey === 'cv' ? 'pdf' : 'jpg')
      .replace(/[^\w.\-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const cacheDir = `${(FileSystem as any).cacheDirectory || ''}document-picker-cache`;
    await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true }).catch(() => undefined);
    const targetUri = `${cacheDir}/${Date.now()}-${safeName}`;

    try {
      await FileSystem.copyAsync({ from: originalUri, to: targetUri });
      const info = await FileSystem.getInfoAsync(targetUri);
      if (info?.exists) {
        return {
          uri: targetUri,
          name: safeName,
          type: asset?.mimeType || (typeKey === 'cv' ? 'application/octet-stream' : 'image/jpeg'),
          size: asset?.size ?? null,
        };
      }
    } catch {
      // Fall back to the original picker URI below.
    }

    return {
      uri: originalUri,
      name: safeName,
      type: asset?.mimeType || (typeKey === 'cv' ? 'application/octet-stream' : 'image/jpeg'),
      size: asset?.size ?? null,
    };
  };

  const pickFiles = async (typeKey: DocumentTypeKey) => {
    const config = DOCUMENT_TYPES.find((item) => item.key === typeKey);
    if (!config) return;

    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: config.multiple,
      type: config.accept as any,
    });

    if (result.canceled) return;

    let picked: PickedFile[] = [];
    try {
      picked = await Promise.all((result.assets || []).map((asset) => materializePickedFile(asset, typeKey)));
    } catch (err: any) {
      Alert.alert('Unable to prepare file', err?.userMessage || err?.message || 'Please choose the file again.');
      return;
    }

    if (typeKey === 'cv') {
      const oversized = picked.find((file) => Number(file.size || 0) > 5 * 1024 * 1024);
      if (oversized) {
        Alert.alert('File too large', 'CV files must be smaller than 5 MB.');
        return;
      }
    }

    setSelectedFiles((prev) => ({
      ...prev,
      [typeKey]: config.multiple ? picked : picked.slice(0, 1),
    }));

    if (!config.multiple && picked[0]?.type?.startsWith('image/')) {
      setPreviewUris((prev) => ({ ...prev, [typeKey]: picked[0].uri }));
    }
  };

  const clearSelection = (typeKey: DocumentTypeKey) => {
    setSelectedFiles((prev) => {
      const next = { ...prev };
      delete next[typeKey];
      return next;
    });
    setPreviewUris((prev) => {
      const next = { ...prev };
      delete next[typeKey];
      return next;
    });
  };

  const uploadSelected = async () => {
    if (!totalSelectedCount) {
      Alert.alert('No files selected', 'Choose at least one document before uploading.');
      return;
    }

    setUploading(true);
    try {
      const grouped = await DocumentsService.upload({
        managedCandidateId: managedCandidateId || undefined,
        filesByType: selectedFiles as any,
      });
      const uploadedCount = totalSelectedCount;
      setDocuments(grouped);
      setSelectedFiles({});
      setPreviewUris({});
      setMessage({ type: 'success', text: 'Documents uploaded successfully.' });
      Alert.alert('Uploaded', uploadedCount === 1 ? 'Document uploaded successfully.' : 'Documents uploaded successfully.');
    } catch (err: any) {
      setMessage({ type: 'error', text: String(err?.userMessage || err?.message || 'Upload failed') });
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (doc: UserDocument) => {
    const documentId = String(doc?._id || '').trim();
    if (!documentId) {
      Alert.alert('Delete unavailable', 'This document does not have a removable id from the server.');
      return;
    }

    setDeletingId(documentId);
    try {
      const grouped = await DocumentsService.remove(documentId, managedCandidateId ? { managedCandidateId } : undefined);
      setDocuments(grouped);
      setMessage({ type: 'success', text: 'Document deleted successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: String(err?.userMessage || err?.message || 'Failed to delete document') });
    } finally {
      setDeletingId('');
    }
  };

  const openDocument = async (doc: UserDocument, typeKey?: DocumentTypeKey) => {
    const url = getDocumentUrl(doc);
    if (!url) {
      Alert.alert('Unavailable', 'This document does not have a valid file URL.');
      return;
    }

    const absoluteUrl = toAbsoluteHttpUrl(url);
    const fileName = ensureFileExtension(getDocumentName(doc, 'document'), undefined, typeKey === 'cv' ? 'pdf' : 'jpg');
    const extension = String(fileName.split('.').pop() || '').toLowerCase();
    const isDocumentFile = ['pdf', 'doc', 'docx', 'txt'].includes(extension) || typeKey === 'cv';

    try {
      if (!isDocumentFile) {
        try {
          await WebBrowser.openBrowserAsync(absoluteUrl);
          return;
        } catch {
          await Linking.openURL(absoluteUrl);
          return;
        }
      }

      const cacheDir = `${(FileSystem as any).cacheDirectory || ''}documents`;
      const downloaded = await downloadResolvedRemoteFile({
        url: absoluteUrl,
        targetDir: cacheDir,
        fileName,
        fallbackBaseName: typeKey || 'document',
        fallbackExtension: extension || (typeKey === 'cv' ? 'pdf' : 'jpg'),
        fallbackMimeType:
          extension === 'pdf'
            ? 'application/pdf'
            : extension === 'doc'
              ? 'application/msword'
              : extension === 'docx'
                ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                : 'application/octet-stream',
        toAbsoluteUrl: toAbsoluteHttpUrl,
      });
      try {
        await openLocalFile(downloaded.uri, downloaded.mimeType);
      } catch (openErr) {
        const savedToAndroidFolder = await saveFileToAndroidFolder(downloaded.uri, downloaded.fileName, downloaded.mimeType).catch(() => false);
        if (!savedToAndroidFolder) throw openErr;
      }
    } catch (err: any) {
      Alert.alert('Unable to open', err?.userMessage || err?.message || 'Could not open this file on the device.');
    }
  };

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load({ silent: true });
              setRefreshing(false);
            }}
          />
        }
        >
        <Animated.View style={[styles.header, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerLead}>
              <Pressable onPress={handleBack} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
                <Feather name="arrow-left" size={18} color="#1B3890" />
              </Pressable>
              <View style={styles.headerBadge}>
                <Feather name="archive" size={12} color="#1768B8" />
                <Text style={[styles.headerBadgeText, { fontFamily: t.typography.fontFamily.bold }]}>Document desk</Text>
              </View>
            </View>
            <View style={styles.liveChip}>
              <Animated.View style={[styles.liveDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
              <Text style={[styles.liveText, { fontFamily: t.typography.fontFamily.bold }]}>{loading ? 'Syncing' : 'Live'}</Text>
            </View>
          </View>

          {managedViewActive ? (
            <ManagedViewBanner
              candidateName={managedCandidateName}
              subtitle="Uploads, previews, and deletes are scoped to the active managed candidate"
              onExit={exitManagedView}
            />
          ) : null}

          <View style={[styles.heroCard, compact && styles.heroCardCompact]}>
            <View style={styles.heroGlowA} />
            <Animated.View style={[styles.heroGlowB, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
            <Animated.View style={[styles.heroSweep, { transform: [{ translateX: sweepX }, { rotate: '15deg' }] }]} />

            <View style={[styles.heroMain, compact && styles.heroMainCompact]}>
              <View style={styles.heroCopyBlock}>
                <Text style={[styles.heading, { color: '#1B3890', fontFamily: t.typography.fontFamily.bold }]}>Documents Workspace</Text>
                <Text style={[styles.subheading, { fontFamily: t.typography.fontFamily.medium }]}>
                  Keep every required file organized, review what is already stored, and upload missing documents from one cleaner workspace.
                </Text>

                <View style={styles.heroInsightRow}>
                  <View style={[styles.heroInsightChip, styles.heroInsightBlue]}>
                    <Feather name="check-circle" size={12} color="#1768B8" />
                    <Text style={[styles.heroInsightText, { color: '#1768B8', fontFamily: t.typography.fontFamily.bold }]}>
                      {completedTypesCount} ready
                    </Text>
                  </View>
                  <View style={[styles.heroInsightChip, styles.heroInsightMint]}>
                    <Feather name="upload-cloud" size={12} color="#118D4C" />
                    <Text style={[styles.heroInsightText, { color: '#118D4C', fontFamily: t.typography.fontFamily.bold }]}>
                      {totalSelectedCount} queued
                    </Text>
                  </View>
                  <View style={[styles.heroInsightChip, styles.heroInsightLavender]}>
                    <Feather name="folder" size={12} color="#6A35D5" />
                    <Text style={[styles.heroInsightText, { color: '#6A35D5', fontFamily: t.typography.fontFamily.bold }]}>
                      {totalExistingCount} stored
                    </Text>
                  </View>
                </View>
              </View>

              <Animated.View style={[styles.heroVisual, { transform: [{ translateY: floatY }] }]}>
                <View style={styles.heroVisualPanel}>
                  <View style={styles.heroSheetBack} />
                  <View style={styles.heroSheetMid} />
                  <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.25 }} end={{ x: 1, y: 1 }} style={styles.headerIconWrap}>
                    <Feather name="folder" size={20} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={[styles.heroVisualTitle, { fontFamily: t.typography.fontFamily.bold }]}>Archive lane</Text>
                  <Text style={[styles.heroVisualBody, { fontFamily: t.typography.fontFamily.medium }]}>Store, replace, review.</Text>
                  <View style={styles.heroTrack}>
                    <View style={styles.heroTrackLine} />
                    <View style={[styles.heroTrackNode, styles.heroTrackNodeOne]} />
                    <Animated.View style={[styles.heroTrackDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                    <View style={[styles.heroTrackNode, styles.heroTrackNodeTwo]} />
                    <View style={[styles.heroTrackNode, styles.heroTrackNodeThree]} />
                  </View>
                  <View style={styles.heroBarRow}>
                    <Animated.View style={[styles.heroBar, styles.heroBarLong, { opacity: pulseOpacity }]} />
                    <Animated.View style={[styles.heroBar, styles.heroBarMid, { opacity: pulseOpacity }]} />
                    <Animated.View style={[styles.heroBar, styles.heroBarShort, { opacity: pulseOpacity }]} />
                  </View>
                </View>
              </Animated.View>
            </View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.statsCard, { opacity: contentEntrance, transform: [{ translateY: contentY }] }]}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>Storage Snapshot</Text>
            <Text style={[styles.sectionTitle, { color: '#1B3890', fontFamily: t.typography.fontFamily.bold }]}>Document Status Overview</Text>
          </View>
          <View style={styles.statsGrid}>
            {DOCUMENT_TYPES.map((item) => (
              <View key={item.key} style={[styles.statItem, { backgroundColor: item.accentBg }]}>
                <View style={styles.statItemTop}>
                  <Feather name={item.icon} size={14} color={item.accentColor} />
                  <Text style={[styles.statValue, { color: item.accentColor, fontFamily: t.typography.fontFamily.bold }]}>
                    {String(documents[item.key]?.length || 0)}
                  </Text>
                </View>
                <Text style={[styles.statLabel, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={2}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
          {message ? (
            <View style={[styles.messageBanner, message.type === 'success' ? styles.messageSuccess : styles.messageError]}>
              <Feather name={message.type === 'success' ? 'check-circle' : 'alert-circle'} size={14} color={message.type === 'success' ? '#118D4C' : '#C53A1B'} />
              <Text style={[styles.messageText, { fontFamily: t.typography.fontFamily.medium }]}>{message.text}</Text>
            </View>
          ) : null}
        </Animated.View>

        {loading ? (
          <Animated.View style={[styles.loadingCard, { opacity: contentEntrance, transform: [{ translateY: contentY }] }]}>
            <Text style={[styles.loadingText, { fontFamily: t.typography.fontFamily.medium }]}>Loading your documents...</Text>
          </Animated.View>
        ) : totalExistingCount ? (
          <Animated.View style={[styles.sectionCard, { opacity: contentEntrance, transform: [{ translateY: contentY }] }]}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>Archive</Text>
              <Text style={[styles.sectionTitle, { color: '#1B3890', fontFamily: t.typography.fontFamily.bold }]}>Your Existing Documents</Text>
            </View>

            {DOCUMENT_TYPES.map((item) => (
              <View key={item.key} style={styles.docGroupCard}>
                <View style={styles.docGroupHeader}>
                  <View style={[styles.docGroupIcon, { backgroundColor: item.accentBg }]}>
                    <Feather name={item.icon} size={16} color={item.accentColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.docGroupTitle, { fontFamily: t.typography.fontFamily.bold }]}>{item.label}</Text>
                    <Text style={[styles.docGroupCount, { fontFamily: t.typography.fontFamily.medium }]}>
                      {`${documents[item.key]?.length || 0} file(s)`}
                    </Text>
                  </View>
                </View>

                {(documents[item.key] || []).length ? (
                  (documents[item.key] || []).map((doc, index) => {
                    const isCv = item.key === 'cv';
                    const fileName = getDocumentName(doc, `${item.label} #${index + 1}`);
                    const fileUrl = getDocumentUrl(doc);
                    return (
                      <View key={`${doc?._id || fileName}-${index}`} style={styles.existingRow}>
                        {isCv ? (
                          <Pressable onPress={() => openDocument(doc, item.key)} style={styles.cvLinkWrap}>
                            <Feather name="file-text" size={16} color="#1E70C8" />
                            <Text style={[styles.cvLink, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                              {fileName}
                            </Text>
                          </Pressable>
                        ) : (
                          <Pressable onPress={() => openDocument(doc, item.key)} style={styles.imagePreviewWrap}>
                            {fileUrl ? <Image source={{ uri: fileUrl }} style={styles.imagePreview} /> : <Feather name="image" size={18} color="#7B8EAF" />}
                          </Pressable>
                        )}

                        <Pressable onPress={() => deleteDocument(doc)} disabled={deletingId === String(doc?._id || '')} style={styles.deleteBtn}>
                          <Feather name="trash-2" size={16} color="#D6492C" />
                        </Pressable>
                      </View>
                    );
                  })
                ) : (
                  <Text style={[styles.noneText, { fontFamily: t.typography.fontFamily.medium }]}>None uploaded</Text>
                )}
              </View>
            ))}
          </Animated.View>
        ) : (
          <Animated.View style={[styles.sectionCard, { opacity: contentEntrance, transform: [{ translateY: contentY }] }]}>
            <EmptyState icon="folder" title="No documents uploaded yet" message="Upload your candidate photo, passport, driving license, or CV below." />
          </Animated.View>
        )}

        <Animated.View style={[styles.sectionCard, { opacity: contentEntrance, transform: [{ translateY: contentY }] }]}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>Intake</Text>
            <Text style={[styles.sectionTitle, { color: '#1B3890', fontFamily: t.typography.fontFamily.bold }]}>Upload New Documents</Text>
          </View>

          {DOCUMENT_TYPES.map((item) => {
            const picked = selectedFiles[item.key] || [];
            const previewUri = previewUris[item.key];
            return (
              <View key={item.key} style={styles.uploadCard}>
                <View style={styles.uploadHeader}>
                  <View style={[styles.uploadIconWrap, { backgroundColor: item.accentBg }]}>
                    <Feather name={item.icon} size={16} color={item.accentColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.uploadTitle, { fontFamily: t.typography.fontFamily.bold }]}>{item.label}</Text>
                    <Text style={[styles.uploadHint, { fontFamily: t.typography.fontFamily.medium }]}>
                      {item.key === 'cv'
                        ? 'PDF, DOC, DOCX only. Max 5 MB each.'
                        : 'Images only. Tap choose to replace selection.'}
                    </Text>
                  </View>
                </View>

                {previewUri && item.key !== 'cv' ? (
                  <Image source={{ uri: previewUri }} style={styles.selectedPreview} resizeMode="cover" />
                ) : null}

                {picked.length ? (
                  <Text style={[styles.selectedText, { fontFamily: t.typography.fontFamily.medium }]}>
                    {item.multiple ? `${picked.length} file(s) selected` : picked[0]?.name || '1 file selected'}
                  </Text>
                ) : null}

                <View style={styles.uploadActionsRow}>
                  <View style={{ flex: 1 }}>
                    <Button title={picked.length ? 'Change Files' : 'Choose Files'} onPress={() => pickFiles(item.key)} size="sm" />
                  </View>
                  <View style={{ width: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Button title="Clear" onPress={() => clearSelection(item.key)} variant="outline" size="sm" disabled={!picked.length} />
                  </View>
                </View>
              </View>
            );
          })}

          <Button title={uploading ? 'Uploading...' : `Upload Documents${totalSelectedCount ? ` (${totalSelectedCount})` : ''}`} onPress={uploadSelected} loading={uploading} disabled={!totalSelectedCount} />
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 130,
    flexGrow: 1,
  },
  header: {
    marginBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  headerLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#D1DEF3',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D7E2F4',
    backgroundColor: '#FFFFFF',
  },
  headerBadgeText: {
    color: '#1768B8',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  liveChip: {
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 13,
    backgroundColor: '#F7FAFF',
    borderWidth: 1,
    borderColor: '#D4E0F2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1FCB7A',
  },
  liveText: {
    color: '#1B4B98',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#D8E3F6',
    backgroundColor: '#FAFCFF',
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#456DA9',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  heroCardCompact: {
    padding: 14,
  },
  heroGlowA: {
    position: 'absolute',
    top: -76,
    right: -20,
    width: 206,
    height: 206,
    borderRadius: 103,
    backgroundColor: 'rgba(86, 143, 255, 0.12)',
  },
  heroGlowB: {
    position: 'absolute',
    bottom: -34,
    left: -12,
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: 'rgba(90, 214, 192, 0.12)',
  },
  heroSweep: {
    position: 'absolute',
    top: -44,
    bottom: -44,
    width: 92,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  heroMain: {
    flexDirection: 'row',
    gap: 14,
  },
  heroMainCompact: {
    gap: 10,
  },
  heroCopyBlock: {
    flex: 1,
  },
  heroInsightRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroInsightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  heroInsightBlue: {
    backgroundColor: '#EFF5FF',
    borderColor: '#D7E4F8',
  },
  heroInsightMint: {
    backgroundColor: '#ECFAF3',
    borderColor: '#D4EEDD',
  },
  heroInsightLavender: {
    backgroundColor: '#F2ECFF',
    borderColor: '#E5D9FA',
  },
  heroInsightText: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
  },
  heroVisual: {
    width: 142,
    height: 214,
    alignItems: 'stretch',
  },
  heroVisualPanel: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E2F3',
    padding: 14,
    overflow: 'hidden',
  },
  heroSheetBack: {
    position: 'absolute',
    top: 14,
    right: 12,
    width: 72,
    height: 90,
    borderRadius: 18,
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#D9E3F7',
    transform: [{ rotate: '10deg' }],
  },
  heroSheetMid: {
    position: 'absolute',
    top: 22,
    right: 4,
    width: 80,
    height: 102,
    borderRadius: 20,
    backgroundColor: '#F7FAFF',
    borderWidth: 1,
    borderColor: '#DCE5F6',
    transform: [{ rotate: '5deg' }],
  },
  heroVisualTitle: {
    marginTop: 12,
    color: '#173271',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  heroVisualBody: {
    marginTop: 4,
    color: '#697CA5',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
  },
  heroTrack: {
    marginTop: 12,
    height: 18,
    justifyContent: 'center',
    position: 'relative',
  },
  heroTrackLine: {
    position: 'absolute',
    left: 6,
    right: 6,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#D8E3F6',
  },
  heroTrackNode: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#C9D8F1',
  },
  heroTrackNodeOne: { left: 6 },
  heroTrackNodeTwo: { left: '49%' },
  heroTrackNodeThree: { right: 6 },
  heroTrackDot: {
    position: 'absolute',
    left: 56,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1FCB7A',
    borderWidth: 3,
    borderColor: '#E8FFF4',
  },
  heroBarRow: {
    marginTop: 14,
    gap: 6,
  },
  heroBar: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#D9E4F6',
  },
  heroBarLong: { width: 90 },
  heroBarMid: { width: 72 },
  heroBarShort: { width: 54 },
  sectionTitleRow: {
    marginBottom: 8,
  },
  sectionEyebrow: {
    color: '#7587AA',
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 1.4,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  headerIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  subheading: {
    marginTop: 8,
    color: '#6B7EA4',
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '600',
  },
  statsCard: {
    borderRadius: 20,
    backgroundColor: 'rgba(250,252,255,0.96)',
    borderWidth: 1,
    borderColor: '#D5DEF3',
    padding: 12,
    marginBottom: 12,
  },
  sectionCard: {
    borderRadius: 20,
    backgroundColor: 'rgba(250,252,255,0.96)',
    borderWidth: 1,
    borderColor: '#D5DEF3',
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
  },
  statItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statItem: {
    width: '48%',
    minHeight: 76,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D6E1F4',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  statValue: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '900',
  },
  statLabel: {
    marginTop: 6,
    color: '#617398',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  messageBanner: {
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageSuccess: {
    backgroundColor: '#E7F8EF',
    borderWidth: 1,
    borderColor: '#BFE3CF',
  },
  messageError: {
    backgroundColor: '#FFF0EB',
    borderWidth: 1,
    borderColor: '#F2C6B8',
  },
  messageText: {
    flex: 1,
    marginLeft: 8,
    color: '#38526F',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  loadingCard: {
    borderRadius: 20,
    backgroundColor: 'rgba(250,252,255,0.96)',
    borderWidth: 1,
    borderColor: '#D5DEF3',
    padding: 18,
    marginBottom: 12,
    alignItems: 'center',
  },
  loadingText: {
    color: '#607393',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  docGroupCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D5DEF3',
    backgroundColor: '#FBFDFF',
    padding: 12,
    marginBottom: 10,
  },
  docGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  docGroupIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  docGroupTitle: {
    color: '#162C65',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  docGroupCount: {
    marginTop: 2,
    color: '#6B7EA4',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  existingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0E8F7',
    backgroundColor: '#F6FAFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  cvLinkWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  cvLink: {
    flex: 1,
    marginLeft: 8,
    color: '#1E70C8',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  imagePreviewWrap: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#EDF3FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0EB',
    borderWidth: 1,
    borderColor: '#F2C6B8',
  },
  noneText: {
    color: '#7183A8',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  uploadCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D5DEF3',
    backgroundColor: '#FBFDFF',
    padding: 12,
    marginBottom: 10,
  },
  uploadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  uploadTitle: {
    color: '#162C65',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  uploadHint: {
    marginTop: 2,
    color: '#6B7EA4',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  selectedPreview: {
    width: 92,
    height: 92,
    borderRadius: 14,
    marginBottom: 10,
  },
  selectedText: {
    marginBottom: 8,
    color: '#29508C',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  uploadActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.9,
  },
});

