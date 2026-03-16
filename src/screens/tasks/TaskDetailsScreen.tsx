import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, EmptyState, Input, Screen } from '../../components/ui';
import { TasksService } from '../../api/services';
import type { Task, TaskFile } from '../../types/models';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TasksStackParamList } from '../../navigation/app/AppNavigator';
import { useTheme } from '../../theme/ThemeProvider';
import { API_BASE_URL } from '../../config/api';
import { getToken } from '../../utils/tokenStorage';
import { useAuthStore } from '../../context/authStore';
import { downloadResolvedRemoteFile } from '../../utils/remoteFileDownload';
import { ensureUploadBatchWithinLimit } from '../../utils/uploadValidation';

type Props = NativeStackScreenProps<TasksStackParamList, 'TaskDetails'>;

const statusTone = (status?: string) => {
  const s = (String(status || '').trim() === 'In Progress' ? 'Pending' : String(status || '').trim() || 'Pending').toLowerCase();
  if (s === 'completed') return { bg: '#D8F2E3', text: '#118D4C', chip: '#EAF8F0' };
  if (s === 'pending') return { bg: '#DFEBFF', text: '#1D5FD2', chip: '#EEF4FF' };
  if (s === 'cancelled') return { bg: '#FDE1E1', text: '#D12B2B', chip: '#FFF0F0' };
  return { bg: '#E8EDF8', text: '#4E628E', chip: '#F3F6FB' };
};

const normalizeStatus = (status?: string) => {
  const s = String(status || '').trim();
  return s === 'In Progress' ? 'Pending' : s || 'Pending';
};

const niceDate = (v?: string) => {
  if (!v) return 'N/A';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

const documentLabel = (doc?: string) => {
  const m: Record<string, string> = {
    cv: 'CV/Resume',
    passport: 'Passport',
    picture: 'Candidate Photo',
    drivingLicense: 'Driving License',
  };
  return m[String(doc || '')] || 'Documents';
};

const documentMimeTypes = (doc?: string): string[] => {
  if (doc === 'picture') return ['image/*'];
  if (doc === 'cv') return ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (doc === 'passport' || doc === 'drivingLicense') return ['image/*', 'application/pdf'];
  return ['*/*'];
};

const priorityTone = (value?: string) => {
  const priority = String(value || '').toLowerCase();
  if (priority.includes('high') || priority.includes('urgent')) return { bg: '#FFF0E6', text: '#D86B12' };
  if (priority.includes('low')) return { bg: '#EAF7F1', text: '#138B6D' };
  return { bg: '#EEF4FF', text: '#1D5FD2' };
};

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

const shouldUseAuthenticatedDownload = (targetUrl: string) => {
  const raw = String(targetUrl || '').trim();
  if (!raw) return false;

  const loweredRaw = raw.toLowerCase();
  const absolute = toAbsoluteHttpUrl(raw).toLowerCase();
  const publicFilePattern = /\/(?:api\/)?(?:uploads?|files?|storage|public)\//i;
  if (publicFilePattern.test(loweredRaw) || publicFilePattern.test(absolute)) return false;

  if (!/^https?:\/\//i.test(raw)) return /^\/?api\//i.test(raw);

  const apiOrigin = API_BASE_URL.replace(/\/api$/i, '').replace(/\/$/, '').toLowerCase();
  return absolute.startsWith(apiOrigin) && absolute.includes('/api/');
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
  if (mime.includes('text/plain')) return 'txt';
  return '';
};

const extensionFromFile = (rawName: string, rawUrl?: string, mimeType?: string, fallback = 'bin') => {
  const candidates = [rawName, rawUrl];
  for (const value of candidates) {
    const cleaned = String(value || '').trim().split('?')[0];
    const ext = cleaned.includes('.') ? cleaned.split('.').pop() : '';
    if (ext && /^[a-z0-9]{1,8}$/i.test(ext)) return ext;
  }
  const mimeExt = extensionFromMimeType(mimeType);
  return mimeExt || fallback;
};

const mimeTypeFromExtension = (extension: string) => {
  const ext = String(extension || '').trim().toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'doc') return 'application/msword';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'txt') return 'text/plain';
  return 'application/octet-stream';
};

const sanitizeAttachmentName = (rawName: string, extension: string) => {
  const cleaned =
    String(rawName || '')
      .trim()
      .replace(/[^\w.\-]+/g, '_')
      .replace(/^_+|_+$/g, '') || `attachment-${Date.now()}`;
  return new RegExp(`\\.${extension}$`, 'i').test(cleaned) ? cleaned : `${cleaned}.${extension}`;
};

const saveAttachmentToAndroidFolder = async (sourceUri: string, fileName: string, mimeType: string) => {
  const storageFramework = (FileSystem as any).StorageAccessFramework;
  if (Platform.OS !== 'android' || !storageFramework) return false;

  const initialUri =
    typeof storageFramework.getUriForDirectoryInRoot === 'function'
      ? storageFramework.getUriForDirectoryInRoot('Download')
      : null;
  const permissions = await storageFramework.requestDirectoryPermissionsAsync(initialUri);
  if (!permissions?.granted || !permissions?.directoryUri) {
    throw new Error('Pick a folder to save the attachment.');
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

const shouldPreferBrowserOpen = (extension: string, mimeType?: string) => {
  const ext = String(extension || '').trim().toLowerCase();
  const mime = String(mimeType || '').trim().toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) || mime.startsWith('image/');
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
  throw new Error('Attachment was downloaded, but no app could open it on this device.');
};

export default function TaskDetailsScreen({ navigation, route }: Props) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const { taskId, task: taskFromRoute } = route.params;
  const [task, setTask] = useState<Task | null>(taskFromRoute || null);
  const [loading, setLoading] = useState(!taskFromRoute);
  const [completionNotes, setCompletionNotes] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<TaskFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const heroEntrance = useRef(new Animated.Value(0)).current;
  const sectionsEntrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  const load = async () => {
    setLoading(true);
    try {
      const list = await TasksService.list();
      const found = (Array.isArray(list) ? list : []).find((x: any) => String(x?._id || x?.id) === String(taskId));
      setTask(found || null);
      if (found?.completionNotes) setCompletionNotes(String(found.completionNotes));
      if (Array.isArray(found?.completionFiles)) setUploadedFiles(found.completionFiles);
    } catch {
      setTask(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!taskFromRoute) {
      load();
      return;
    }
    if (Array.isArray(taskFromRoute?.completionFiles)) setUploadedFiles(taskFromRoute.completionFiles);
    setCompletionNotes(String(taskFromRoute?.completionNotes || ''));
  }, [taskId]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroEntrance, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sectionsEntrance, {
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
          Animated.timing(pulse, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(drift, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(drift, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(sweep, { toValue: 1, duration: 2200, delay: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ),
    ];

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [drift, heroEntrance, pulse, sectionsEntrance, sweep]);

  const tone = statusTone(task?.status);
  const priority = priorityTone(task?.priority);
  const needsUpload = useMemo(
    () => String(task?.status || '').toLowerCase() !== 'completed' && (task?.type === 'Document Upload' || !!task?.requiredDocument),
    [task]
  );

  const taskStatus = normalizeStatus(task?.status);
  const completionState = taskStatus === 'Completed' ? 'Closed' : needsUpload ? 'Awaiting proof' : 'Ready to close';
  const completionPercent = taskStatus === 'Completed' ? 100 : needsUpload ? (uploadedFiles.length ? 72 : 38) : completionNotes.trim() ? 74 : 54;
  const heroY = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const sectionY = sectionsEntrance.interpolate({ inputRange: [0, 1], outputRange: [26, 0] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.48] });
  const driftY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-180, 260] });

  const pickAndUploadFiles = async () => {
    const fileType = documentMimeTypes(task?.requiredDocument);
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: true,
      type: fileType as any,
    });
    if (result.canceled) return;
    const files = result.assets || [];
    if (!files.length) return;
    try {
      await ensureUploadBatchWithinLimit(files.map((file) => ({ uri: file.uri, name: file.name, size: file.size ?? null })));
    } catch (e: any) {
      Alert.alert('File too large', e?.userMessage || e?.message || 'Please choose a file smaller than 5 MB.');
      return;
    }
    setUploading(true);
    try {
      const uploaded = await TasksService.uploadTaskFiles(
        files.map((f) => ({
          uri: f.uri,
          name: f.name,
          type: f.mimeType || 'application/octet-stream',
        }))
      );
      setUploadedFiles((prev) => [...prev, ...uploaded]);
      Alert.alert('Uploaded', `${uploaded.length} file(s) uploaded successfully.`);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setUploading(false);
    }
  };

  const onMarkComplete = async () => {
    if (!task) return;
    if (needsUpload && !uploadedFiles.length) {
      Alert.alert('Document required', `Please upload ${documentLabel(task?.requiredDocument).toLowerCase()} before completing this task.`);
      return;
    }
    setSubmitting(true);
    try {
      const updated = await TasksService.markComplete(String(task?._id || task?.id || taskId), {
        completionNotes: completionNotes.trim(),
        completionFiles: uploadedFiles,
      });
      setTask(updated || task);
      Alert.alert('Completed', 'Task marked as completed.');
    } catch (e: any) {
      Alert.alert('Failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setSubmitting(false);
    }
  };

  const openAttachment = async (file: TaskFile) => {
    const rawUrl = String(file?.fileUrl || '').trim();
    if (!rawUrl) {
      Alert.alert('Unavailable', 'This file does not have a valid download URL.');
      return;
    }

    const absoluteUrl = toAbsoluteHttpUrl(rawUrl);
    const fileLabel = String(file?.fileName || absoluteUrl.split('/').pop() || 'attachment').trim();
    const ext = extensionFromFile(
      fileLabel,
      absoluteUrl,
      String(file?.mimeType || ''),
      absoluteUrl.toLowerCase().includes('.pdf') ? 'pdf' : 'bin'
    );
    const cacheDir = `${(FileSystem as any).cacheDirectory || ''}tasks`;
    const safeBaseName =
      fileLabel
        .replace(/\.[a-z0-9]{1,8}$/i, '')
        .replace(/[^\w.\-]+/g, '_')
        .replace(/^_+|_+$/g, '') || `task-${taskId}`;
    const safeFileName = sanitizeAttachmentName(safeBaseName, ext);
    const mimeType = String(file?.mimeType || mimeTypeFromExtension(ext)).trim() || 'application/octet-stream';

    try {
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true }).catch(() => undefined);
      const token = (await getToken()) || useAuthStore.getState().token;
      const requireAuth = shouldUseAuthenticatedDownload(absoluteUrl);
      if (requireAuth && !token) throw new Error('Session expired. Please log out and log in again.');

      if (!requireAuth && shouldPreferBrowserOpen(ext, mimeType)) {
        try {
          await WebBrowser.openBrowserAsync(absoluteUrl);
          return;
        } catch {
          try {
            await Linking.openURL(absoluteUrl);
            return;
          } catch {
            // Fall back to local download below.
          }
        }
      }

      if (Platform.OS === 'android' || requireAuth) {
        const downloaded = await downloadResolvedRemoteFile({
          url: absoluteUrl,
          targetDir: cacheDir,
          fileName: safeFileName,
          fallbackBaseName: safeBaseName,
          fallbackExtension: ext,
          fallbackMimeType: mimeType,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          toAbsoluteUrl: toAbsoluteHttpUrl,
        });
        try {
          await openLocalFile(downloaded.uri, downloaded.mimeType);
          return;
        } catch (openErr) {
          const savedToAndroidFolder = await saveAttachmentToAndroidFolder(downloaded.uri, downloaded.fileName, downloaded.mimeType).catch(() => false);
          if (savedToAndroidFolder) return;
          throw openErr;
        }
        return;
      }

      const downloaded = await downloadResolvedRemoteFile({
        url: absoluteUrl,
        targetDir: cacheDir,
        fileName: safeFileName,
        fallbackBaseName: safeBaseName,
        fallbackExtension: ext,
        fallbackMimeType: mimeType,
        toAbsoluteUrl: toAbsoluteHttpUrl,
      });
      await openLocalFile(downloaded.uri, downloaded.mimeType);
      return;
    } catch (e: any) {
      Alert.alert('Unable to open file', e?.userMessage || e?.message || 'Please try again');
    }
  };

  if (!task && !loading) {
    return (
      <Screen padded={false}>
        <EmptyState icon="o" title="Task not found" message="It may have been removed or you do not have access." />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.headerRow, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
          <Pressable onPress={() => navigation.canGoBack() && navigation.goBack()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
            <Feather name="arrow-left" size={18} color="#1B3890" />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { fontFamily: t.typography.fontFamily.bold }]}>TASK COCKPIT</Text>
            <Text style={[styles.heading, { color: '#1B3890', fontFamily: t.typography.fontFamily.bold }]}>Task Details</Text>
          </View>
          <View style={[styles.headerStateChip, { backgroundColor: tone.chip }]}>
            <Animated.View style={[styles.headerStateDot, { backgroundColor: tone.text, opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
            <Text style={[styles.headerStateText, { color: tone.text, fontFamily: t.typography.fontFamily.bold }]}>{taskStatus}</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.heroCard, { opacity: heroEntrance, transform: [{ translateY: heroY }] }]}>
          <View style={styles.heroGlowA} />
          <Animated.View style={[styles.heroGlowB, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
          <Animated.View style={[styles.heroSweep, { transform: [{ translateX: sweepX }, { rotate: '18deg' }] }]} />

          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Feather name="command" size={13} color="#1768B8" />
              <Text style={[styles.heroBadgeText, { fontFamily: t.typography.fontFamily.bold }]}>Execution view</Text>
            </View>
            <View style={[styles.priorityChip, { backgroundColor: priority.bg }]}>
              <Feather name="flag" size={13} color={priority.text} />
              <Text style={[styles.priorityChipText, { color: priority.text, fontFamily: t.typography.fontFamily.bold }]}>{task?.priority || 'Priority'}</Text>
            </View>
          </View>

          <View style={[styles.heroMain, compact && styles.heroMainCompact]}>
            <View style={styles.heroCopyBlock}>
              <Text style={[styles.heroTitle, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={2}>
                {task?.title || 'Task'}
              </Text>
              <Text style={[styles.heroBody, { fontFamily: t.typography.fontFamily.medium }]}>
                {task?.description || 'No description provided.'}
              </Text>

              <View style={styles.heroMetaRail}>
                <View style={styles.heroMetaChip}>
                  <Feather name="briefcase" size={13} color="#1768B8" />
                  <Text style={[styles.heroMetaText, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{task?.type || 'Task type'}</Text>
                </View>
                <View style={styles.heroMetaChip}>
                  <Feather name="calendar" size={13} color="#1768B8" />
                  <Text style={[styles.heroMetaText, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{`Due ${niceDate(task?.dueDate)}`}</Text>
                </View>
              </View>
            </View>

            <Animated.View style={[styles.heroVisual, { transform: [{ translateY: driftY }] }]}>
              <View style={styles.heroVisualCard}>
                <View style={styles.heroVisualHeader}>
                  <View style={styles.heroVisualIcon}>
                    <Feather name="git-commit" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.heroVisualCopy}>
                    <Text style={[styles.heroVisualTitle, { fontFamily: t.typography.fontFamily.bold }]}>Completion lane</Text>
                    <Text style={[styles.heroVisualBody, { fontFamily: t.typography.fontFamily.medium }]}>{completionState}</Text>
                  </View>
                </View>

                <View style={styles.heroLane}>
                  <View style={styles.heroLaneTrack} />
                  <Animated.View style={[styles.heroLaneDot, { left: `${Math.min(completionPercent, 92)}%`, opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                  <View style={[styles.heroLaneNode, styles.heroLaneNodeStart]} />
                  <View style={[styles.heroLaneNode, styles.heroLaneNodeMid]} />
                  <View style={[styles.heroLaneNode, styles.heroLaneNodeEnd]} />
                </View>

                <View style={styles.heroVisualFooter}>
                  <Text style={[styles.heroVisualFooterText, { fontFamily: t.typography.fontFamily.bold }]}>{completionPercent}% ready</Text>
                </View>
              </View>
            </Animated.View>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <Text style={[styles.heroStatLabel, { fontFamily: t.typography.fontFamily.medium }]}>Due date</Text>
              <Text style={[styles.heroStatValue, { fontFamily: t.typography.fontFamily.bold }]}>{niceDate(task?.dueDate)}</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={[styles.heroStatLabel, { fontFamily: t.typography.fontFamily.medium }]}>Assigned</Text>
              <Text style={[styles.heroStatValue, { fontFamily: t.typography.fontFamily.bold }]}>{niceDate(task?.createdAt)}</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={[styles.heroStatLabel, { fontFamily: t.typography.fontFamily.medium }]}>Proof files</Text>
              <Text style={[styles.heroStatValue, { fontFamily: t.typography.fontFamily.bold }]}>{uploadedFiles.length}</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: sectionsEntrance, transform: [{ translateY: sectionY }] }}>
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>TASK SIGNALS</Text>
                <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Overview</Text>
              </View>
              {taskStatus !== 'Completed' ? (
                <Button title={submitting ? 'Completing...' : 'Mark Complete'} size="sm" onPress={onMarkComplete} loading={submitting} />
              ) : null}
            </View>

            <View style={styles.grid}>
              <View style={[styles.metaBox, styles.metaBoxBlue]}>
                <Text style={styles.metaLabel}>Task Type</Text>
                <Text style={[styles.metaValue, { fontFamily: t.typography.fontFamily.bold }]}>{task?.type || 'N/A'}</Text>
              </View>
              <View style={[styles.metaBox, styles.metaBoxGold]}>
                <Text style={styles.metaLabel}>Priority</Text>
                <Text style={[styles.metaValue, { fontFamily: t.typography.fontFamily.bold }]}>{task?.priority || 'N/A'}</Text>
              </View>
              <View style={[styles.metaBox, styles.metaBoxBlue]}>
                <Text style={styles.metaLabel}>Due Date</Text>
                <Text style={[styles.metaValue, { fontFamily: t.typography.fontFamily.bold }]}>{niceDate(task?.dueDate)}</Text>
              </View>
              <View style={[styles.metaBox, styles.metaBoxMint]}>
                <Text style={styles.metaLabel}>Assigned</Text>
                <Text style={[styles.metaValue, { fontFamily: t.typography.fontFamily.bold }]}>{niceDate(task?.createdAt)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>TASK BRIEF</Text>
                <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Description</Text>
              </View>
              <View style={[styles.inlineStatus, { backgroundColor: tone.bg }]}>
                <Text style={[styles.inlineStatusText, { color: tone.text, fontFamily: t.typography.fontFamily.bold }]}>{taskStatus}</Text>
              </View>
            </View>

            <View style={styles.descriptionBox}>
              <Text style={[styles.descriptionText, { fontFamily: t.typography.fontFamily.medium }]}>{task?.description || 'No description provided.'}</Text>
            </View>
          </View>

          {needsUpload ? (
            <View style={[styles.sectionCard, styles.uploadCard]}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>UPLOAD PROOF</Text>
                  <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>
                    {task?.requiredDocument ? `Upload ${documentLabel(task.requiredDocument)}` : 'Upload completion files'}
                  </Text>
                </View>
                <View style={styles.uploadChip}>
                  <Feather name="paperclip" size={13} color="#C45A12" />
                  <Text style={[styles.uploadChipText, { fontFamily: t.typography.fontFamily.bold }]}>{uploadedFiles.length} added</Text>
                </View>
              </View>

              <Text style={[styles.uploadHint, { fontFamily: t.typography.fontFamily.medium }]}>
                {task?.requiredDocument
                  ? `Please upload your ${documentLabel(task.requiredDocument).toLowerCase()} before closing this task.`
                  : 'Upload files as proof of task completion.'}
              </Text>
              <View style={styles.uploadButtonWrap}>
                <Button title={uploading ? 'Uploading...' : 'Choose Files'} size="sm" onPress={pickAndUploadFiles} loading={uploading} />
              </View>
            </View>
          ) : null}

          {uploadedFiles.length ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>ATTACHED FILES</Text>
                  <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Uploaded Files</Text>
                </View>
                <View style={styles.fileCountChip}>
                  <Feather name="file-text" size={13} color="#1D5FD2" />
                  <Text style={[styles.fileCountText, { fontFamily: t.typography.fontFamily.bold }]}>{uploadedFiles.length}</Text>
                </View>
              </View>

              {uploadedFiles.map((f, idx) => (
                <Pressable
                  key={`${f?.fileUrl || f?.fileName || idx}`}
                  style={({ pressed }) => [styles.fileRow, pressed && styles.pressed]}
                  onPress={() => openAttachment(f)}
                >
                  <View style={styles.fileIcon}>
                    <Feather name="file-text" size={16} color="#1B64C6" />
                  </View>
                  <View style={styles.fileCopy}>
                    <Text style={[styles.fileName, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                      {f?.fileName || 'Uploaded file'}
                    </Text>
                    <Text style={[styles.fileMeta, { fontFamily: t.typography.fontFamily.medium }]}>Tap to open</Text>
                  </View>
                  <Feather name="arrow-up-right" size={14} color="#5A75A9" />
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>WRAP-UP NOTES</Text>
                <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Completion Notes</Text>
              </View>
            </View>

            <Input
              label="Completion Notes (optional)"
              value={completionNotes}
              onChangeText={setCompletionNotes}
              placeholder="Add any notes before marking this task complete"
              multiline
            />
          </View>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 130 },
  pressed: { opacity: 0.92 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
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
  headerCopy: { flex: 1 },
  eyebrow: {
    color: '#7485A8',
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 2.1,
    fontWeight: '900',
  },
  heading: { marginTop: 3, fontSize: 20, lineHeight: 24, fontWeight: '900' },
  headerStateChip: {
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  headerStateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerStateText: { fontSize: 11, lineHeight: 14, fontWeight: '800' },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#D3DFF3',
    backgroundColor: '#F9FBFF',
    padding: 16,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#4A6EAE',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  heroGlowA: {
    position: 'absolute',
    top: -70,
    right: -22,
    width: 188,
    height: 188,
    borderRadius: 94,
    backgroundColor: 'rgba(76, 139, 255, 0.12)',
  },
  heroGlowB: {
    position: 'absolute',
    bottom: -26,
    left: -18,
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(89, 210, 209, 0.12)',
  },
  heroSweep: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 86,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  heroBadge: {
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
  heroBadgeText: {
    color: '#1768B8',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  priorityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  priorityChipText: { fontSize: 10, lineHeight: 13, fontWeight: '800' },
  heroMain: { marginTop: 16, flexDirection: 'row', gap: 14 },
  heroMainCompact: { gap: 10 },
  heroCopyBlock: { flex: 1 },
  heroTitle: { color: '#153375', fontSize: 21, lineHeight: 25, fontWeight: '900', maxWidth: 228 },
  heroBody: { marginTop: 8, color: '#5D7096', fontSize: 11, lineHeight: 16, fontWeight: '700', maxWidth: 236 },
  heroMetaRail: { marginTop: 14, gap: 8 },
  heroMetaChip: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: '#F3F8FF',
    borderWidth: 1,
    borderColor: '#D7E2F4',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  heroMetaText: { color: '#1A4D9C', fontSize: 10, lineHeight: 13, fontWeight: '800', maxWidth: 180 },
  heroVisual: { width: 154, alignItems: 'stretch' },
  heroVisualCard: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E2F3',
    padding: 14,
    shadowColor: '#4168A8',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  heroVisualHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroVisualIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#1D5FD2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroVisualCopy: { flex: 1 },
  heroVisualTitle: { color: '#173271', fontSize: 13, lineHeight: 16, fontWeight: '900' },
  heroVisualBody: { marginTop: 3, color: '#697CA5', fontSize: 9, lineHeight: 12, fontWeight: '700' },
  heroLane: {
    marginTop: 14,
    height: 72,
    justifyContent: 'center',
    position: 'relative',
  },
  heroLaneTrack: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#D9E4F6',
  },
  heroLaneDot: {
    position: 'absolute',
    marginLeft: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1FCB7A',
    borderWidth: 3,
    borderColor: '#E8FFF4',
  },
  heroLaneNode: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#C8D8F1',
  },
  heroLaneNodeStart: { left: 10 },
  heroLaneNodeMid: { left: '48%' },
  heroLaneNodeEnd: { right: 10 },
  heroVisualFooter: {
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F2F7FF',
    alignSelf: 'flex-start',
  },
  heroVisualFooterText: { color: '#1A4E9D', fontSize: 9, lineHeight: 11, fontWeight: '800' },
  heroStatsRow: { marginTop: 14, flexDirection: 'row', gap: 9 },
  heroStatCard: {
    flex: 1,
    minHeight: 78,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7E2F4',
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  heroStatLabel: { color: '#657B9E', fontSize: 9, lineHeight: 11, fontWeight: '700' },
  heroStatValue: { color: '#173271', fontSize: 13, lineHeight: 16, fontWeight: '900' },
  sectionCard: {
    borderRadius: 22,
    backgroundColor: 'rgba(249,251,255,0.96)',
    borderWidth: 1,
    borderColor: '#D6E0F3',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#5373AA',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  sectionEyebrow: {
    color: '#7485A8',
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 1.9,
    fontWeight: '900',
  },
  sectionTitle: { marginTop: 3, color: '#153375', fontSize: 16, lineHeight: 20, fontWeight: '900' },
  inlineStatus: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineStatusText: { fontSize: 10, lineHeight: 13, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaBox: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    minHeight: 74,
  },
  metaBoxBlue: { backgroundColor: '#EDF3FD', borderColor: '#D5DEF3' },
  metaBoxGold: { backgroundColor: '#FFF4E7', borderColor: '#F3D6A9' },
  metaBoxMint: { backgroundColor: '#EAF9F4', borderColor: '#D1ECE1' },
  metaLabel: { color: '#5E7198', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  metaValue: { color: '#172C63', fontSize: 14, lineHeight: 17, fontWeight: '900', marginTop: 4 },
  descriptionBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D5DEF3',
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  descriptionText: { color: '#2F456F', fontSize: 11, lineHeight: 16, fontWeight: '600' },
  uploadCard: {
    backgroundColor: '#FFF9F0',
    borderColor: '#F0D4A2',
  },
  uploadChip: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: '#FFF0E4',
    borderWidth: 1,
    borderColor: '#F2D5B2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  uploadChipText: { color: '#C45A12', fontSize: 10, lineHeight: 13, fontWeight: '800' },
  uploadHint: { color: '#B7672E', fontSize: 11, lineHeight: 16, fontWeight: '600' },
  uploadButtonWrap: { marginTop: 10 },
  fileCountChip: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#D5E0F4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  fileCountText: { color: '#1D5FD2', fontSize: 10, lineHeight: 13, fontWeight: '800' },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#D5DEF3',
    backgroundColor: '#F7FAFF',
    borderRadius: 14,
    paddingHorizontal: 10,
    minHeight: 48,
    marginTop: 8,
  },
  fileIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileCopy: { flex: 1 },
  fileName: { color: '#2B467A', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  fileMeta: { marginTop: 2, color: '#7085AA', fontSize: 9, lineHeight: 11, fontWeight: '600' },
});
