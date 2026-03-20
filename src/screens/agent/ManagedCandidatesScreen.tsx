import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Image, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api } from '../../api/client';
import { AgentCandidatesService } from '../../api/services';
import { EmptyState, Input, Screen } from '../../components/ui';
import { useAuthStore } from '../../context/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import type { ManagedCandidate, UserDocument } from '../../types/models';
import { formatDate } from '../../utils/format';
import { buildManagedViewUser, stripManagedViewState } from '../../utils/managedView';
import { ensureUploadSizeWithinLimit } from '../../utils/uploadValidation';

type UploadKey = 'cv' | 'passport' | 'picture' | 'drivingLicense';
type PickedUpload = { uri: string; name: string; type: string; size?: number | null };
type CandidateForm = {
  name: string; email: string; phone: string; firstname: string; lastname: string; dateOfBirth: string;
  gender: string; ageRange: string; address: string; country: string; location: string; profession: string;
  qualification: string; experience: string; jobInterest: string; categories: string; skills: string;
  aboutMe: string; linkedin: string; github: string; visaStatus: string; status: string;
};

const PAGE_SIZE = 6;
const STATUS_OPTIONS = ['Pending', 'Reviewed', 'Approved', 'Rejected'];
const VISA_OPTIONS = ['Not Started', 'Processing', 'Approved', 'Rejected', 'Completed'];
const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const AGE_RANGE_OPTIONS = ['18-24', '25-34', '35-44', '45-54', '55+'];
const FILE_PICKER_TYPES: Record<UploadKey, string | string[]> = {
  cv: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  passport: 'image/*',
  picture: 'image/*',
  drivingLicense: 'image/*',
};
const FILE_LABELS: Record<UploadKey, string> = {
  cv: 'CV', passport: 'Passport', picture: 'Picture', drivingLicense: 'Driving License',
};
const UPLOAD_ICONS: Record<UploadKey, keyof typeof Feather.glyphMap> = {
  cv: 'file-text', passport: 'credit-card', picture: 'image', drivingLicense: 'file',
};
type FormTab = 'personal' | 'documents';

const FORM_TABS: Array<{ key: FormTab; label: string; note: string; icon: keyof typeof Feather.glyphMap }> = [
  { key: 'personal', label: 'Personal Info', note: 'Core profile fields', icon: 'user' },
  { key: 'documents', label: 'Documents', note: 'CV, ID, and photos', icon: 'file-text' },
];
const CALENDAR_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CALENDAR_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
type CalendarDay = { key: string; label: string; date: Date; inMonth: boolean };
const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const parseCalendarDate = (value: string) => {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day, 12);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month || parsed.getDate() !== day) return null;
  return parsed;
};
const formatCalendarMonthLabel = (date: Date) => date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
const buildCalendarMonth = (year: number, month: number) => {
  const today = new Date();
  let safeYear = Math.max(1900, year);
  let safeMonth = Math.max(0, Math.min(11, month));
  if (safeYear > today.getFullYear()) {
    safeYear = today.getFullYear();
    safeMonth = today.getMonth();
  }
  if (safeYear === today.getFullYear() && safeMonth > today.getMonth()) safeMonth = today.getMonth();
  return new Date(safeYear, safeMonth, 1);
};
const shiftCalendarMonth = (date: Date, offset: number) => buildCalendarMonth(date.getFullYear(), date.getMonth() + offset);
const buildCalendarDays = (monthDate: Date): CalendarDay[] => {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstWeekday = start.getDay();
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const daysInPreviousMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 0).getDate();
  const cells: CalendarDay[] = [];
  for (let index = firstWeekday - 1; index >= 0; index -= 1) {
    const day = daysInPreviousMonth - index;
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, day, 12);
    cells.push({ key: `prev-${toIsoDate(date)}`, label: String(day), date, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day, 12);
    cells.push({ key: `current-${toIsoDate(date)}`, label: String(day), date, inMonth: true });
  }
  let trailingDay = 1;
  while (cells.length % 7 !== 0 || cells.length < 35) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, trailingDay, 12);
    cells.push({ key: `next-${toIsoDate(date)}`, label: String(trailingDay), date, inMonth: false });
    trailingDay += 1;
  }
  return cells;
};
const UPLOAD_GUIDANCE: Record<UploadKey, { accepted: string; helper: string }> = {
  cv: { accepted: 'PDF, DOC, DOCX', helper: '1 file only. Keep the CV under 5 MB before submit.' },
  passport: { accepted: 'Image upload', helper: '1 file only. Matches the backend passport field.' },
  picture: { accepted: 'Image upload', helper: '1 file only. Stores the candidate picture/profile photo.' },
  drivingLicense: { accepted: 'Image upload', helper: '1 file only. Matches the backend drivingLicense field.' },
};
const DOCUMENT_TYPE_MATCHERS: Record<UploadKey, string[]> = {
  cv: ['cv', 'CV'],
  passport: ['passport', 'Passport'],
  picture: ['picture', 'Picture', 'photo', 'Photo'],
  drivingLicense: ['drivinglicense', 'drivingLicense', 'DrivingLicense'],
};
const emptyUploads = (): Record<UploadKey, PickedUpload | null> => ({ cv: null, passport: null, picture: null, drivingLicense: null });
const formatFileSizeLabel = (size?: number | null) => {
  const normalized = Number(size);
  if (!Number.isFinite(normalized) || normalized <= 0) return '';
  if (normalized >= 1024 * 1024) return `${(normalized / (1024 * 1024)).toFixed(1)} MB`;
  if (normalized >= 1024) return `${Math.round(normalized / 1024)} KB`;
  return `${normalized} B`;
};
const findExistingDocument = (candidate: ManagedCandidate | null, field: UploadKey) => {
  const matchers = DOCUMENT_TYPE_MATCHERS[field].map((value) => value.toLowerCase());
  return (candidate?.documents || []).find((document) => matchers.includes(String(document?.type || '').toLowerCase())) || null;
};

const VIEW_DOCUMENT_GROUPS: Array<{ key: UploadKey; label: string; aliases: string[]; preview: boolean; icon: keyof typeof Feather.glyphMap }> = [
  { key: 'cv', label: 'CV', aliases: ['cv'], preview: false, icon: 'file-text' },
  { key: 'passport', label: 'Passport', aliases: ['passport'], preview: false, icon: 'credit-card' },
  { key: 'picture', label: 'Picture', aliases: ['picture', 'photo'], preview: true, icon: 'image' },
  { key: 'drivingLicense', label: 'Driving License', aliases: ['drivinglicense'], preview: false, icon: 'file' },
];
const getDocumentUrl = (doc?: UserDocument | null) => String(doc?.fileUrl || doc?.url || '').trim();
const toAbsoluteHttpUrl = (raw: string) => {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const base = String(api.defaults.baseURL || '').replace(/\/+$/, '');
  if (!base) return value;
  const origin = base.replace(/\/api$/i, '');
  if (value.startsWith('/api/')) return `${origin}${value}`;
  if (value.startsWith('/')) return `${base}${value}`;
  return `${base}/${value}`;
};
const looksLikePreviewDocument = (doc?: UserDocument | null) => {
  const type = String(doc?.type || '').toLowerCase();
  const fileName = String(doc?.fileName || doc?.originalName || '').toLowerCase();
  const mimeType = String(doc?.mimeType || '').toLowerCase();
  const url = getDocumentUrl(doc).toLowerCase();
  return type.includes('picture') || type.includes('photo') || mimeType.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(fileName) || /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(url);
};
const getGroupedDocuments = (candidate?: ManagedCandidate | null) =>
  VIEW_DOCUMENT_GROUPS.map((group) => ({
    ...group,
    items: (candidate?.documents || []).filter((doc) => group.aliases.some((alias) => String(doc?.type || '').toLowerCase().includes(alias))),
  }));
const formatCandidateAddedAt = (candidate?: ManagedCandidate | null) => formatDate(candidate?.addedAt || candidate?.lastUpdated) || 'Recent';
const getQualificationList = (candidate?: ManagedCandidate | null) => {
  const raw = (candidate as any)?.qualifications;
  if (Array.isArray(raw)) return raw.map((item) => String(item || '').trim()).filter(Boolean);
  const singular = pickString([candidate?.qualification]);
  return singular ? [singular] : [];
};
const getSkillList = (candidate?: ManagedCandidate | null) => Array.isArray(candidate?.skills) ? candidate.skills.map((item) => String(item || '').trim()).filter(Boolean) : [];
const getCategoryList = (candidate?: ManagedCandidate | null) => Array.isArray(candidate?.categories) ? candidate.categories.map((item) => String(item || '').trim()).filter(Boolean) : [];

const emptyForm = (): CandidateForm => ({
  name: '', email: '', phone: '', firstname: '', lastname: '', dateOfBirth: '',
  gender: '', ageRange: '', address: '', country: '', location: '', profession: '',
  qualification: '', experience: '', jobInterest: '', categories: '', skills: '',
  aboutMe: '', linkedin: '', github: '', visaStatus: 'Not Started', status: 'Pending',
});

const pickString = (values: any[], fallback = '') => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
};
const toCommaText = (value: any) => Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean).join(', ') : String(value || '').trim();
const countDocuments = (candidate?: ManagedCandidate | null) => Array.isArray(candidate?.documents) ? candidate!.documents!.length : 0;
const countInquiries = (candidate?: ManagedCandidate | null) => Array.isArray(candidate?.inquiries) ? candidate!.inquiries!.length : 0;
const badgeTone = (value: string) => {
  const status = String(value || '').toLowerCase();
  if (status.includes('approve')) return { bg: '#EAF8EF', border: '#C7EAD5', text: '#15804E' };
  if (status.includes('review') || status.includes('process')) return { bg: '#EEF5FF', border: '#C9DBFA', text: '#2563EB' };
  if (status.includes('reject')) return { bg: '#FFF1F4', border: '#F3CDD6', text: '#D63655' };
  return { bg: '#FFF7DE', border: '#F4E2A5', text: '#B57606' };
};
const formFromCandidate = (candidate: ManagedCandidate): CandidateForm => ({
  name: pickString([candidate?.name]), email: pickString([candidate?.email]), phone: pickString([candidate?.phone]),
  firstname: pickString([candidate?.firstname]), lastname: pickString([candidate?.lastname]),
  dateOfBirth: pickString([candidate?.dateOfBirth ? String(candidate.dateOfBirth).split('T')[0] : '']),
  gender: pickString([candidate?.gender]), ageRange: pickString([candidate?.ageRange]),
  address: pickString([candidate?.address]), country: pickString([candidate?.country]), location: pickString([candidate?.location]),
  profession: pickString([candidate?.profession]), qualification: pickString([candidate?.qualification]),
  experience: pickString([candidate?.experience]), jobInterest: pickString([candidate?.jobInterest]),
  categories: toCommaText(candidate?.categories), skills: toCommaText(candidate?.skills), aboutMe: pickString([candidate?.aboutMe]),
  linkedin: pickString([candidate?.socialNetworks?.linkedin]), github: pickString([candidate?.socialNetworks?.github]),
  visaStatus: pickString([candidate?.visaStatus], 'Not Started'), status: pickString([candidate?.status], 'Pending'),
});

function ActionButton({ icon, label, onPress, tone = 'default' }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void; tone?: 'default' | 'danger' }) {
  const palette = tone === 'danger'
    ? { bg: '#FFF3F5', border: '#F2CCD3', text: '#D63655', icon: '#D63655' }
    : { bg: '#F7FAFF', border: '#D8E4F5', text: '#1B4F9C', icon: '#1B6FC3' };
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionButton, { backgroundColor: palette.bg, borderColor: palette.border }, pressed && styles.pressed]}>
      <Feather name={icon} size={14} color={palette.icon} />
      <Text style={[styles.actionButtonText, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}
function ChoiceGroup({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.choiceWrap}>
        {options.map((option) => {
          const active = option === value;
          return (
            <Pressable key={option} onPress={() => onChange(option)} style={({ pressed }) => [styles.choiceChip, active && styles.choiceChipActive, pressed && styles.pressed]}>
              <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DateField({ label, value, placeholder, onPress }: { label: string; value: string; placeholder: string; onPress: () => void }) {
  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.dateFieldButton, pressed && styles.pressed]}>
        <View style={styles.dateFieldIconWrap}>
          <Feather name="calendar" size={18} color="#1B6FC3" />
        </View>
        <View style={styles.dateFieldCopy}>
          <Text style={[styles.dateFieldValue, !value && styles.dateFieldPlaceholder]}>{value || placeholder}</Text>
          <Text style={styles.dateFieldHint}>{value ? 'Tap to change date' : 'Select from calendar'}</Text>
        </View>
        <View style={styles.dateFieldChevronWrap}>
          <Feather name="chevron-right" size={16} color="#6A7F99" />
        </View>
      </Pressable>
    </View>
  );
}

export default function ManagedCandidatesScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const token = useAuthStore((state) => state.token);
  const storeUser = useAuthStore((state) => state.user);
  const signIn = useAuthStore((state) => state.signIn);
  const [candidates, setCandidates] = useState<ManagedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingCandidate, setViewingCandidate] = useState<ManagedCandidate | null>(null);
  const [editingCandidate, setEditingCandidate] = useState<ManagedCandidate | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<CandidateForm>(emptyForm());
  const [uploads, setUploads] = useState<Record<UploadKey, PickedUpload | null>>(emptyUploads());
  const [formTab, setFormTab] = useState<FormTab>('personal');
  const [dobPickerVisible, setDobPickerVisible] = useState(false);
  const [dobPickerMonth, setDobPickerMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear() - 25, today.getMonth(), 1);
  });
  const entrance = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  const loadCandidates = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const list = await AgentCandidatesService.list();
      setCandidates(Array.isArray(list) ? list : []);
    } catch (err: any) {
      Alert.alert('Unable to load', err?.userMessage || err?.message || 'Failed to fetch managed candidates.');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadCandidates(); }, [loadCandidates]));
  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 560, useNativeDriver: true }).start();
    const floatLoop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 2600, useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 2600, useNativeDriver: true }),
    ]));
    const sweepLoop = Animated.loop(Animated.sequence([
      Animated.timing(sweep, { toValue: 1, duration: 2400, useNativeDriver: true }),
      Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay(550),
    ]));
    floatLoop.start();
    sweepLoop.start();
    return () => {
      floatLoop.stop();
      sweepLoop.stop();
    };
  }, [entrance, float, sweep]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const filteredCandidates = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return candidates;
    return candidates.filter((candidate) => [candidate?.name, candidate?.email, candidate?.phone].map((value) => String(value || '').toLowerCase()).some((value) => value.includes(query)));
  }, [candidates, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / PAGE_SIZE));
  const sliceStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedCandidates = filteredCandidates.slice(sliceStart, sliceStart + PAGE_SIZE);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const stats = useMemo(() => ([
    { key: 'total', label: 'Manage Candidates', value: String(candidates.length), note: 'Loaded from /agent/candidates', badge: 'Live KPI', icon: 'users' as const, iconBg: '#DDEBFF', iconColor: '#1C6ED5', accent: '#1C6ED5', cardTint: '#F7FBFF' },
    { key: 'pending', label: 'Pending', value: String(candidates.filter((item) => String(item?.status || '').toLowerCase() === 'pending').length), note: 'Waiting for review', badge: 'Attention', icon: 'clock' as const, iconBg: '#FFF5D6', iconColor: '#C07A06', accent: '#C07A06', cardTint: '#FFFBF2' },
    { key: 'approved', label: 'Approved', value: String(candidates.filter((item) => String(item?.status || '').toLowerCase() === 'approved').length), note: 'Ready to move', badge: 'Ready', icon: 'check-circle' as const, iconBg: '#E8F8EC', iconColor: '#159451', accent: '#159451', cardTint: '#F6FFF9' },
    { key: 'documents', label: 'Documents', value: String(candidates.reduce((sum, item) => sum + countDocuments(item), 0)), note: 'Stored inside each candidate', badge: 'Review', icon: 'file-text' as const, iconBg: '#F1E2FF', iconColor: '#8A46E6', accent: '#8A46E6', cardTint: '#FBF7FF' },
  ]), [candidates]);
  const requiredReady = !!form.name.trim() && !!form.email.trim() && form.email.includes('@');
  const profileFieldCount = useMemo(() => ([
    'phone', 'firstname', 'lastname', 'location', 'profession', 'qualification', 'experience', 'aboutMe',
  ] as Array<keyof CandidateForm>).filter((field) => String(form[field] || '').trim()).length, [form]);
  const uploadCoverageCount = useMemo(() => (Object.keys(FILE_LABELS) as UploadKey[]).filter((field) => uploads[field] || findExistingDocument(editingCandidate, field)).length, [editingCandidate, uploads]);
  const completionPercent = Math.min(100, Math.round((((requiredReady ? 2 : 0) + profileFieldCount + uploadCoverageCount) / 14) * 100));
  const activeFormTab = FORM_TABS.find((tab) => tab.key === formTab) || FORM_TABS[0];
  const selectedDobDate = useMemo(() => parseCalendarDate(form.dateOfBirth), [form.dateOfBirth]);
  const selectedDobYear = dobPickerMonth.getFullYear();
  const selectedDobMonthIndex = dobPickerMonth.getMonth();
  const dobMonthLabel = useMemo(() => formatCalendarMonthLabel(dobPickerMonth), [dobPickerMonth]);
  const dobCalendarDays = useMemo(() => buildCalendarDays(dobPickerMonth), [dobPickerMonth]);
  const opacity = entrance.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const translateY = entrance.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });
  const orbShift = float.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-170, width >= 640 ? 520 : 320] });
  const getEntranceMotion = (delay: number, distance = 18) => ({
    opacity: entrance.interpolate({ inputRange: [0, delay, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: entrance.interpolate({ inputRange: [0, delay, 1], outputRange: [distance, distance, 0], extrapolate: 'clamp' }) }],
  });

  const closeFormModal = () => {
    setDobPickerVisible(false);
    setFormVisible(false);
    setEditingCandidate(null);
    setForm(emptyForm());
    setUploads(emptyUploads());
    setUploadProgress(0);
    setFormTab('personal');
  };
  const openDobPicker = () => {
    const today = new Date();
    const baseDate = selectedDobDate || new Date(today.getFullYear() - 25, today.getMonth(), 1);
    setDobPickerMonth(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
    setDobPickerVisible(true);
  };
  const openCreate = () => {
    setEditingCandidate(null);
    setForm(emptyForm());
    setUploads(emptyUploads());
    setUploadProgress(0);
    setFormTab('personal');
    setDobPickerVisible(false);
    setFormVisible(true);
  };
  const openEdit = (candidate: ManagedCandidate) => {
    setEditingCandidate(candidate);
    setForm(formFromCandidate(candidate));
    setUploads(emptyUploads());
    setUploadProgress(0);
    setFormTab('personal');
    setDobPickerVisible(false);
    setFormVisible(true);
  };
  const clearManagedSelection = async () => {
    if (!token || !storeUser) return;
    await signIn({ token, user: stripManagedViewState(storeUser) });
  };
  const activateCandidateView = async (candidate: ManagedCandidate) => {
    if (!token || !storeUser) {
      Alert.alert('Unavailable', 'Please sign in again to switch candidate view.');
      return;
    }
    await signIn({
      token,
      user: buildManagedViewUser(storeUser, candidate),
    });
    closeViewModal();
    navigation.navigate('Overview');
  };

  const pickUpload = async (field: UploadKey) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: FILE_PICKER_TYPES[field] });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const file = { uri: asset.uri, name: asset.name || `${field}-${Date.now()}`, type: asset.mimeType || (field === 'cv' ? 'application/pdf' : 'image/jpeg'), size: asset.size ?? null };
      await ensureUploadSizeWithinLimit(file);
      setUploads((prev) => ({ ...prev, [field]: file }));
    } catch (err: any) {
      Alert.alert('File too large', err?.userMessage || err?.message || 'Please choose a smaller file.');
    }
  };

  const buildFormData = () => {
    const payload = new FormData();
    const fields: Array<keyof CandidateForm> = ['name', 'email', 'phone', 'firstname', 'lastname', 'dateOfBirth', 'gender', 'ageRange', 'address', 'country', 'location', 'profession', 'qualification', 'experience', 'jobInterest', 'categories', 'skills', 'aboutMe', 'linkedin', 'github', 'visaStatus', 'status'];
    fields.forEach((field) => payload.append(field, String(form[field] || '').trim()));
    (Object.keys(uploads) as UploadKey[]).forEach((field) => {
      const file = uploads[field];
      if (!file) return;
      // @ts-ignore react-native file payload
      payload.append(field, { uri: file.uri, name: file.name, type: file.type });
    });
    return payload;
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      Alert.alert('Missing details', 'Please enter at least the candidate name and email.');
      return;
    }
    if (!form.email.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid candidate email.');
      return;
    }
    const isEditing = !!editingCandidate?._id;
    setSaving(true);
    setUploadProgress(0);
    try {
      const payload = buildFormData();
      const onUploadProgress = (event: any) => {
        const total = Number(event?.total || event?.totalSize || 0);
        const loaded = Number(event?.loaded || 0);
        if (total > 0) setUploadProgress(Math.round((loaded / total) * 100));
      };
      if (editingCandidate?._id) await AgentCandidatesService.updateMultipart(editingCandidate._id, payload, onUploadProgress);
      else await AgentCandidatesService.createMultipart(payload, onUploadProgress);
      await loadCandidates({ silent: true });
      closeFormModal();
      Alert.alert('Saved', isEditing ? 'Candidate updated successfully.' : 'Candidate added successfully.');
    } catch (err: any) {
      Alert.alert('Save failed', err?.response?.data?.message || err?.userMessage || err?.message || 'Failed to save candidate.');
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  };

  const closeViewModal = () => setViewingCandidate(null);
  const openViewDocument = async (doc: UserDocument) => {
    const rawUrl = getDocumentUrl(doc);
    if (!rawUrl) {
      Alert.alert('Unavailable', 'This document does not have a valid file URL.');
      return;
    }

    const absoluteUrl = toAbsoluteHttpUrl(rawUrl);
    try {
      if (looksLikePreviewDocument(doc)) {
        try {
          await WebBrowser.openBrowserAsync(absoluteUrl);
        } catch {
          await Linking.openURL(absoluteUrl);
        }
        return;
      }

      try {
        await Linking.openURL(absoluteUrl);
      } catch {
        await WebBrowser.openBrowserAsync(absoluteUrl);
      }
    } catch {
      Alert.alert('Unable to open', 'The document could not be opened right now.');
    }
  };
  const handleViewEdit = () => {
    if (!viewingCandidate) return;
    const candidate = viewingCandidate;
    closeViewModal();
    openEdit(candidate);
  };

  const handleCandidatesBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (navigation.getParent()?.canGoBack()) {
      navigation.getParent()?.goBack();
      return;
    }
    navigation.getParent()?.navigate?.('Overview');
    navigation.navigate('Overview');
  }, [navigation]);

  const handleDelete = (candidate: ManagedCandidate) => {
    Alert.alert('Delete candidate', `Remove ${pickString([candidate?.name], 'this candidate')} from your managed list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await AgentCandidatesService.remove(candidate._id);
            if (String((storeUser as any)?.selectedManagedCandidateId || '') === String(candidate._id)) await clearManagedSelection();
            await loadCandidates({ silent: true });
          } catch (err: any) {
            Alert.alert('Delete failed', err?.response?.data?.message || err?.userMessage || err?.message || 'Failed to delete candidate.');
          }
        },
      },
    ]);
  };

  return (
    <Screen padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadCandidates({ silent: true }); setRefreshing(false); }} />}
      >
        <Animated.View style={[styles.topBar, { opacity, transform: [{ translateY }] }]}>
          <Pressable onPress={handleCandidatesBack} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
            <Feather name="arrow-left" size={18} color="#1B3890" />
          </Pressable>
          <View style={styles.topCopy}>
            <Text style={[styles.topEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>Candidate workspace</Text>
            <Text style={[styles.topTitle, { fontFamily: t.typography.fontFamily.bold }]}>Managed Candidates</Text>
          </View>
          <View style={styles.liveChipSolid}>
            <View style={styles.liveDot} />
            <Text style={[styles.liveChipText, { fontFamily: t.typography.fontFamily.bold }]}>{loading ? 'Syncing' : 'Live'}</Text>
          </View>
        </Animated.View>
        <Animated.View style={[styles.heroCard, { opacity, transform: [{ translateY }] }]}>
          <LinearGradient colors={['#F8FCFF', '#EDF7FF', '#F4FFFC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroFill}>
            <Animated.View style={[styles.heroGlowA, { transform: [{ translateY: orbShift }] }]} />
            <View style={styles.heroGlowB} />
            <Animated.View style={[styles.heroSweep, { transform: [{ translateX: sweepX }, { rotate: '18deg' }] }]} />
            <View style={styles.heroTopRow}>
              <View style={styles.heroPill}><Feather name="users" size={13} color="#1768B8" /><Text style={[styles.heroPillText, { fontFamily: t.typography.fontFamily.bold }]}>Managed candidates</Text></View>
              <View style={styles.heroLive}><View style={styles.heroLiveDot} /><Text style={[styles.heroLiveText, { fontFamily: t.typography.fontFamily.bold }]}>{loading ? 'Syncing' : 'Live'}</Text></View>
            </View>
            <Text style={[styles.heroTitle, { fontFamily: t.typography.fontFamily.bold }]}>Manage candidates</Text>
            <Text style={[styles.heroBody, { fontFamily: t.typography.fontFamily.medium }]}>Track your candidate pipeline, review approvals, keep documents moving, and jump into managed candidate view from one compact workspace.</Text>
            <View style={styles.heroSummaryRow}>
              <View style={styles.heroSummaryChip}><Feather name="search" size={13} color="#1768B8" /><Text style={[styles.heroSummaryText, { fontFamily: t.typography.fontFamily.bold }]}>Smart local search</Text></View>
              <View style={styles.heroSummaryChip}><Feather name="layers" size={13} color="#1768B8" /><Text style={[styles.heroSummaryText, { fontFamily: t.typography.fontFamily.bold }]}>{`${filteredCandidates.length} visible candidates`}</Text></View>
              <View style={styles.heroSummaryChip}><Feather name="activity" size={13} color="#1768B8" /><Text style={[styles.heroSummaryText, { fontFamily: t.typography.fontFamily.bold }]}>{`${totalPages} page${totalPages === 1 ? '' : 's'} ready`}</Text></View>
            </View>
            <View style={styles.statsGrid}>
              {stats.map((item) => (
                <View key={item.key} style={[styles.statCard, { backgroundColor: item.cardTint, borderColor: `${item.accent}22` }]}>
                  <View style={[styles.statAccentBar, { backgroundColor: item.accent }]} />
                  <View style={[styles.statGlowOrb, { backgroundColor: `${item.accent}12` }]} />
                  <View style={styles.statCardTop}>
                    <View style={[styles.statIcon, styles.statIconElevated, { backgroundColor: item.iconBg, borderColor: `${item.accent}22` }]}><Feather name={item.icon} size={17} color={item.iconColor} /></View>
                    <View style={styles.statValueWrap}>
                      <Text style={[styles.statValue, { color: item.accent, fontFamily: t.typography.fontFamily.bold }]}>{item.value}</Text>
                      <View style={[styles.statBadge, { backgroundColor: `${item.accent}12`, borderColor: `${item.accent}20` }]}><View style={[styles.statBadgeDot, { backgroundColor: item.accent }]} /><Text style={[styles.statBadgeText, { color: item.accent, fontFamily: t.typography.fontFamily.bold }]}>{item.badge}</Text></View>
                    </View>
                  </View>
                  <Text style={[styles.statLabel, { fontFamily: t.typography.fontFamily.bold }]}>{item.label}</Text>
                  <View style={[styles.statNotePill, { backgroundColor: `${item.accent}10`, borderColor: `${item.accent}18` }]}><Text style={[styles.statNote, { color: item.accent, fontFamily: t.typography.fontFamily.medium }]}>{item.note}</Text></View>
                </View>
              ))}
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View style={[styles.toolbarCard, getEntranceMotion(0.14)]}>
          <View style={styles.toolbarHeader}>
            <View style={styles.toolbarPill}>
              <Feather name="zap" size={13} color="#1768B8" />
              <Text style={[styles.toolbarPillText, { fontFamily: t.typography.fontFamily.bold }]}>Create flow</Text>
            </View>
            <Text style={[styles.toolbarTitle, { fontFamily: t.typography.fontFamily.bold }]}>Add candidates faster</Text>
            <Text style={[styles.toolbarBody, { fontFamily: t.typography.fontFamily.medium }]}>Search the current list or launch a guided add flow with candidate details, workflow status, and document setup in one clean place.</Text>
            <View style={styles.toolbarMetaRow}>
              <View style={styles.toolbarMetaChip}>
                <Feather name="check-circle" size={13} color="#1768B8" />
                <Text style={[styles.toolbarMetaText, { fontFamily: t.typography.fontFamily.bold }]}>Ready for approvals</Text>
              </View>
              <View style={styles.toolbarMetaChip}>
                <Feather name="file-text" size={13} color="#1768B8" />
                <Text style={[styles.toolbarMetaText, { fontFamily: t.typography.fontFamily.bold }]}>Documents included</Text>
              </View>
            </View>
          </View>
          <Input label="Search candidates" value={searchTerm} onChangeText={setSearchTerm} placeholder="Search by name, email, or phone" icon={<Feather name="search" size={16} color="#7C8CA6" />} />
          <View style={styles.toolbarFooter}>
            <Text style={[styles.toolbarHint, { fontFamily: t.typography.fontFamily.medium }]}>Search and pagination are handled locally after the initial fetch, while create and edit continue through the managed candidate workflow.</Text>
            <Pressable onPress={openCreate} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
              <LinearGradient colors={['#1548A5', '#1E6BD8', '#26A5C8']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.addButtonFill}>
                <View style={styles.addButtonGlow} />
                <View style={styles.addButtonIconWrap}>
                  <Feather name="plus" size={18} color="#FFFFFF" />
                </View>
                <View style={styles.addButtonCopy}>
                  <Text style={[styles.addButtonEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>Quick action</Text>
                  <Text style={[styles.addButtonText, { fontFamily: t.typography.fontFamily.bold }]}>Add Candidate</Text>
                  <Text style={[styles.addButtonHint, { fontFamily: t.typography.fontFamily.medium }]}>Open the guided create form</Text>
                </View>
                <Feather name="arrow-right-circle" size={20} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View style={[styles.sectionHeader, getEntranceMotion(0.22)]}>
          <View>
            <Text style={[styles.sectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Managed list</Text>
            <Text style={[styles.sectionSubtitle, { fontFamily: t.typography.fontFamily.medium }]}>{filteredCandidates.length ? `Showing ${sliceStart + 1}-${Math.min(sliceStart + PAGE_SIZE, filteredCandidates.length)} of ${filteredCandidates.length}` : 'No candidates match the current filter'}</Text>
          </View>
          <Text style={[styles.pageChip, { fontFamily: t.typography.fontFamily.bold }]}>{`Page ${currentPage}/${totalPages}`}</Text>
        </Animated.View>

        {!loading && !filteredCandidates.length ? (
          <View style={styles.emptyWrap}>
            <EmptyState icon="users" title={searchTerm ? 'No matches found' : 'No managed candidates yet'} message={searchTerm ? 'Try a different name, email, or phone number.' : 'Add your first managed candidate to start tracking documents, inquiries, and handoff into candidate view.'} />
          </View>
        ) : (
          paginatedCandidates.map((candidate, index) => {
            const statusTone = badgeTone(candidate?.status || 'Pending');
            const visaTone = badgeTone(candidate?.visaStatus || 'Not Started');
            const categories = Array.isArray(candidate?.categories) ? candidate.categories.filter(Boolean).slice(0, 3) : [];
            return (
              <Animated.View key={candidate._id} style={[styles.candidateCard, getEntranceMotion(0.26 + index * 0.07, 16)]}>
                <View style={[styles.candidateAccentBar, { backgroundColor: statusTone.text }]} />
                <View style={[styles.candidateGlowOrb, { backgroundColor: `${statusTone.text}12` }]} />
                <View style={styles.cardTop}>
                  <View style={styles.identityRow}>
                    <View style={styles.avatarWrap}><Feather name="user" size={20} color="#FFFFFF" /></View>
                    <View style={styles.identityCopy}>
                      <Text style={[styles.candidateName, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{pickString([candidate?.name], 'Candidate')}</Text>
                      <Text style={[styles.candidateRole, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{pickString([candidate?.profession], 'Profession not set')}</Text>
                    </View>
                  </View>
                  <View style={[styles.badge, { backgroundColor: statusTone.bg, borderColor: statusTone.border }]}><Text style={[styles.badgeText, { color: statusTone.text, fontFamily: t.typography.fontFamily.bold }]}>{pickString([candidate?.status], 'Pending')}</Text></View>
                </View>
                <View style={styles.metaGrid}>
                  <View style={styles.metaBox}><Feather name="mail" size={14} color="#1B6EC3" /><Text style={[styles.metaText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{pickString([candidate?.email], 'No email')}</Text></View>
                  <View style={styles.metaBox}><Feather name="phone" size={14} color="#1B6EC3" /><Text style={[styles.metaText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{pickString([candidate?.phone], 'No phone')}</Text></View>
                  <View style={styles.metaBox}><Feather name="map-pin" size={14} color="#1B6EC3" /><Text style={[styles.metaText, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{pickString([candidate?.location, candidate?.country], 'Location not set')}</Text></View>
                  <View style={[styles.metaBox, { backgroundColor: visaTone.bg, borderColor: visaTone.border }]}><Feather name="briefcase" size={14} color={visaTone.text} /><Text style={[styles.metaText, { color: visaTone.text, fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{pickString([candidate?.visaStatus], 'Not Started')}</Text></View>
                </View>
                <View style={styles.metricsRow}>
                  <View style={styles.metricChip}><Feather name="file-text" size={13} color="#8A46E6" /><Text style={[styles.metricChipText, { fontFamily: t.typography.fontFamily.medium }]}>{`${countDocuments(candidate)} docs`}</Text></View>
                  <View style={styles.metricChip}><Feather name="message-square" size={13} color="#C07A06" /><Text style={[styles.metricChipText, { fontFamily: t.typography.fontFamily.medium }]}>{`${countInquiries(candidate)} inquiries`}</Text></View>
                  <View style={styles.metricChip}><Feather name="clock" size={13} color="#2563EB" /><Text style={[styles.metricChipText, { fontFamily: t.typography.fontFamily.medium }]}>{formatDate(candidate?.addedAt || candidate?.lastUpdated) || 'Recent'}</Text></View>
                </View>
                {categories.length ? <View style={styles.categoryRow}>{categories.map((category) => <View key={category} style={styles.categoryChip}><Text style={[styles.categoryChipText, { fontFamily: t.typography.fontFamily.medium }]}>{category}</Text></View>)}</View> : null}
                  <View style={styles.actionsGrid}>
                    <ActionButton icon="eye" label="View" onPress={() => setViewingCandidate(candidate)} />
                    <ActionButton icon="edit-3" label="Edit" onPress={() => openEdit(candidate)} />
                    <ActionButton icon="trash-2" label="Delete" tone="danger" onPress={() => handleDelete(candidate)} />
                  </View>
                  <Pressable onPress={() => activateCandidateView(candidate)} style={({ pressed }) => [styles.switchViewCard, pressed && styles.pressed]}>
                    <LinearGradient colors={['#143D96', '#1E63C7', '#2CB1D8']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.switchViewCardFill}>
                      <View style={styles.switchViewGlow} />
                      <View style={styles.switchViewIconWrap}><Feather name="monitor" size={18} color="#FFFFFF" /></View>
                      <View style={styles.switchViewCopy}>
                        <Text style={[styles.switchViewEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>Special access</Text>
                        <Text style={[styles.switchViewTitle, { fontFamily: t.typography.fontFamily.bold }]}>Switch to Candidate View</Text>
                        <Text style={[styles.switchViewHint, { fontFamily: t.typography.fontFamily.medium }]}>Open the managed candidate dashboard with agent-controlled access.</Text>
                      </View>
                      <Feather name="arrow-right-circle" size={20} color="#FFFFFF" />
                    </LinearGradient>
                  </Pressable>
              </Animated.View>
            );
          })
        )}

        {filteredCandidates.length > PAGE_SIZE ? (
          <View style={styles.paginationCard}>
            <Pressable onPress={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} style={({ pressed }) => [styles.paginationButton, currentPage === 1 && styles.disabledButton, pressed && currentPage > 1 && styles.pressed]}><Feather name="chevron-left" size={16} color={currentPage === 1 ? '#A9B7CC' : '#1B4F9C'} /><Text style={[styles.paginationText, { color: currentPage === 1 ? '#A9B7CC' : '#1B4F9C', fontFamily: t.typography.fontFamily.bold }]}>Previous</Text></Pressable>
            <Text style={[styles.paginationMeta, { fontFamily: t.typography.fontFamily.bold }]}>{`Page ${currentPage} of ${totalPages}`}</Text>
            <Pressable onPress={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} style={({ pressed }) => [styles.paginationButton, currentPage === totalPages && styles.disabledButton, pressed && currentPage < totalPages && styles.pressed]}><Text style={[styles.paginationText, { color: currentPage === totalPages ? '#A9B7CC' : '#1B4F9C', fontFamily: t.typography.fontFamily.bold }]}>Next</Text><Feather name="chevron-right" size={16} color={currentPage === totalPages ? '#A9B7CC' : '#1B4F9C'} /></Pressable>
          </View>
        ) : null}
      </ScrollView>
      <Modal visible={!!viewingCandidate} transparent animationType="slide" onRequestClose={closeViewModal}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={closeViewModal} />
          <View style={styles.modalShell}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { fontFamily: t.typography.fontFamily.bold }]}>{pickString([viewingCandidate?.name], 'Candidate')}</Text>
                <Text style={[styles.modalSubtitle, { fontFamily: t.typography.fontFamily.medium }]}>This modal uses the already-loaded managed candidate object, so the data stays local until the next list refresh.</Text>
              </View>
              <Pressable onPress={closeViewModal} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}><Feather name="x" size={18} color="#1D3A6F" /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
              <View style={styles.viewHeroCard}>
                <View style={styles.viewHeroTopRow}>
                  <View style={styles.viewHeroIdentity}>
                    <View style={styles.viewHeroAvatar}><Feather name="user" size={22} color="#FFFFFF" /></View>
                    <View style={styles.viewHeroCopy}>
                      <Text style={[styles.viewHeroName, { fontFamily: t.typography.fontFamily.bold }]}>{pickString([viewingCandidate?.name], 'Candidate')}</Text>
                      <Text style={[styles.viewHeroEmail, { fontFamily: t.typography.fontFamily.medium }]}>{pickString([viewingCandidate?.email], 'No email provided')}</Text>
                    </View>
                  </View>
                  <View style={[styles.viewHeroBadge, { backgroundColor: badgeTone(viewingCandidate?.visaStatus || 'Not Started').bg, borderColor: badgeTone(viewingCandidate?.visaStatus || 'Not Started').border }]}>
                    <Text style={[styles.viewHeroBadgeLabel, { fontFamily: t.typography.fontFamily.bold }]}>Visa status</Text>
                    <Text style={[styles.viewHeroBadgeValue, { color: badgeTone(viewingCandidate?.visaStatus || 'Not Started').text, fontFamily: t.typography.fontFamily.bold }]}>{pickString([viewingCandidate?.visaStatus], 'Not Started')}</Text>
                  </View>
                </View>
                <View style={styles.viewSummaryRow}>
                  <View style={styles.viewSummaryChip}><Feather name="clock" size={14} color="#2563EB" /><Text style={[styles.viewSummaryText, { fontFamily: t.typography.fontFamily.medium }]}>{formatCandidateAddedAt(viewingCandidate)}</Text></View>
                  <View style={styles.viewSummaryChip}><Feather name="flag" size={14} color="#15804E" /><Text style={[styles.viewSummaryText, { fontFamily: t.typography.fontFamily.medium }]}>{pickString([viewingCandidate?.status], 'Pending')}</Text></View>
                  <View style={styles.viewSummaryChip}><Feather name="message-square" size={14} color="#C07A06" /><Text style={[styles.viewSummaryText, { fontFamily: t.typography.fontFamily.medium }]}>{`${countInquiries(viewingCandidate)} inquiries`}</Text></View>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.detailSectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Skills</Text>
                <Text style={[styles.sectionIntro, { fontFamily: t.typography.fontFamily.medium }]}>Pulled directly from the candidate object returned by the managed candidates list route.</Text>
                {getSkillList(viewingCandidate).length ? (
                  <View style={styles.viewChipWrap}>
                    {getSkillList(viewingCandidate).map((skill) => <View key={skill} style={styles.viewSkillChip}><Text style={[styles.viewSkillChipText, { fontFamily: t.typography.fontFamily.medium }]}>{skill}</Text></View>)}
                  </View>
                ) : <Text style={[styles.detailParagraph, { fontFamily: t.typography.fontFamily.medium }]}>No skills added yet.</Text>}
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.detailSectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Qualifications</Text>
                <Text style={[styles.sectionIntro, { fontFamily: t.typography.fontFamily.medium }]}>Supports both `qualification` and the web modal's `qualifications` fallback.</Text>
                {getQualificationList(viewingCandidate).length ? (
                  <View style={styles.viewBulletList}>
                    {getQualificationList(viewingCandidate).map((item) => (
                      <View key={item} style={styles.viewBulletRow}>
                        <View style={styles.viewBulletDot} />
                        <Text style={[styles.detailParagraph, styles.viewBulletText, { fontFamily: t.typography.fontFamily.medium }]}>{item}</Text>
                      </View>
                    ))}
                  </View>
                ) : <Text style={[styles.detailParagraph, { fontFamily: t.typography.fontFamily.medium }]}>No qualification details available.</Text>}
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.detailSectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Personal details</Text>
                <View style={styles.detailGrid}>
                  <View style={styles.detailBox}><Text style={styles.detailLabel}>Date of birth</Text><Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.medium }]}>{pickString([viewingCandidate?.dateOfBirth], 'Not provided')}</Text></View>
                  <View style={styles.detailBox}><Text style={styles.detailLabel}>Location</Text><Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.medium }]}>{pickString([viewingCandidate?.location, viewingCandidate?.country], 'Not provided')}</Text></View>
                  <View style={styles.detailBox}><Text style={styles.detailLabel}>Gender</Text><Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.medium }]}>{pickString([viewingCandidate?.gender], 'Not provided')}</Text></View>
                  <View style={styles.detailBox}><Text style={styles.detailLabel}>Age range</Text><Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.medium }]}>{pickString([viewingCandidate?.ageRange], 'Not provided')}</Text></View>
                  <View style={styles.detailBox}><Text style={styles.detailLabel}>Phone</Text><Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.medium }]}>{pickString([viewingCandidate?.phone], 'Not provided')}</Text></View>
                  <View style={styles.detailBox}><Text style={styles.detailLabel}>Address</Text><Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.medium }]}>{pickString([viewingCandidate?.address], 'Not provided')}</Text></View>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.detailSectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Professional details</Text>
                <View style={styles.detailGrid}>
                  <View style={styles.detailBox}><Text style={styles.detailLabel}>Profession</Text><Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.medium }]}>{pickString([viewingCandidate?.profession], 'Not provided')}</Text></View>
                  <View style={styles.detailBox}><Text style={styles.detailLabel}>Qualification</Text><Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.medium }]}>{pickString([viewingCandidate?.qualification], 'Not provided')}</Text></View>
                  <View style={styles.detailBox}><Text style={styles.detailLabel}>Experience</Text><Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.medium }]}>{pickString([viewingCandidate?.experience], 'Not provided')}</Text></View>
                  <View style={styles.detailBox}><Text style={styles.detailLabel}>Job interest</Text><Text style={[styles.detailValue, { fontFamily: t.typography.fontFamily.medium }]}>{pickString([viewingCandidate?.jobInterest], 'Not provided')}</Text></View>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.detailSectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Categories</Text>
                {getCategoryList(viewingCandidate).length ? (
                  <View style={styles.viewChipWrap}>
                    {getCategoryList(viewingCandidate).map((category) => <View key={category} style={styles.viewCategoryChip}><Text style={[styles.viewCategoryChipText, { fontFamily: t.typography.fontFamily.medium }]}>{category}</Text></View>)}
                  </View>
                ) : <Text style={[styles.detailParagraph, { fontFamily: t.typography.fontFamily.medium }]}>No categories listed.</Text>}
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.detailSectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>About candidate</Text>
                <Text style={[styles.detailParagraph, { fontFamily: t.typography.fontFamily.medium }]}>{pickString([viewingCandidate?.aboutMe], 'No candidate summary provided yet.')}</Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.detailSectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Social links</Text>
                <View style={styles.viewLinkStack}>
                  <View style={styles.viewLinkRow}><Feather name="linkedin" size={14} color="#1B6FC3" /><Text style={[styles.viewLinkLabel, { fontFamily: t.typography.fontFamily.bold }]}>LinkedIn</Text><Text style={[styles.viewLinkValue, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{pickString([viewingCandidate?.socialNetworks?.linkedin], 'Not provided')}</Text></View>
                  <View style={styles.viewLinkRow}><Feather name="github" size={14} color="#1B6FC3" /><Text style={[styles.viewLinkLabel, { fontFamily: t.typography.fontFamily.bold }]}>GitHub</Text><Text style={[styles.viewLinkValue, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{pickString([viewingCandidate?.socialNetworks?.github], 'Not provided')}</Text></View>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.detailSectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Documents</Text>
                <Text style={[styles.sectionIntro, { fontFamily: t.typography.fontFamily.medium }]}>Grouped from the same `documents` array returned by `GET /agent/candidates`, with no separate detail fetch.</Text>
                {getGroupedDocuments(viewingCandidate).map((group) => (
                  <View key={group.key} style={styles.viewDocumentGroup}>
                    <View style={styles.viewDocumentHeader}><Feather name={group.icon} size={15} color="#1B6FC3" /><Text style={[styles.viewDocumentTitle, { fontFamily: t.typography.fontFamily.bold }]}>{group.label}</Text><Text style={[styles.viewDocumentCount, { fontFamily: t.typography.fontFamily.medium }]}>{`${group.items.length} file(s)`}</Text></View>
                    {group.items.length ? group.items.map((doc, index) => {
                      const absoluteUrl = toAbsoluteHttpUrl(getDocumentUrl(doc));
                      const docName = pickString([doc?.fileName, doc?.originalName], `${group.label} ${index + 1}`);
                      return (
                        <View key={`${group.key}-${docName}-${index}`} style={styles.viewDocumentCard}>
                          {group.preview ? (
                            <Pressable onPress={() => openViewDocument(doc)} style={({ pressed }) => [styles.viewImagePreviewWrap, pressed && styles.pressed]}>
                              {absoluteUrl ? <Image source={{ uri: absoluteUrl }} style={styles.viewImagePreview} /> : <Feather name="image" size={22} color="#7B8EAF" />}
                            </Pressable>
                          ) : (
                            <Pressable onPress={() => openViewDocument(doc)} style={({ pressed }) => [styles.viewDocumentLink, pressed && styles.pressed]}>
                              <Feather name="external-link" size={14} color="#1B6FC3" />
                              <Text style={[styles.viewDocumentLinkText, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>{docName}</Text>
                            </Pressable>
                          )}
                          <Text style={[styles.viewDocumentMeta, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>{pickString([doc?.status], 'Uploaded')}</Text>
                          <Text style={[styles.viewDocumentMeta, { fontFamily: t.typography.fontFamily.medium }]}>{formatDate(doc?.uploadedAt) || 'Recently added'}</Text>
                        </View>
                      );
                    }) : <Text style={[styles.detailParagraph, { fontFamily: t.typography.fontFamily.medium }]}>No {group.label.toLowerCase()} files uploaded.</Text>}
                  </View>
                ))}
              </View>

              <View style={styles.modalFooter}>
                <Pressable onPress={closeViewModal} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}><Text style={[styles.cancelButtonText, { fontFamily: t.typography.fontFamily.bold }]}>Close</Text></Pressable>
                <Pressable onPress={handleViewEdit} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
                  <LinearGradient colors={['#1B4AA3', '#1279C5']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.saveButtonFill}><Feather name="edit-3" size={16} color="#FFFFFF" /><Text style={[styles.saveButtonText, { fontFamily: t.typography.fontFamily.bold }]}>Edit Candidate</Text></LinearGradient>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={closeFormModal}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={closeFormModal} />
          <View style={styles.formModalShell}>
            <LinearGradient colors={['#F8FCFF', '#ECF6FF', '#F1FFFB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.formHeroCard}>
              <Animated.View style={[styles.formHeroGlowA, { transform: [{ translateY: orbShift }] }]} />
              <View style={styles.formHeroGlowB} />
              <Animated.View style={[styles.formHeroSweep, { transform: [{ translateX: sweepX }] }]} />
              <View style={styles.formHeroTopRow}>
                <View style={styles.formHeroPill}>
                  <Feather name="layers" size={13} color="#1768B8" />
                  <Text style={[styles.formHeroPillText, { fontFamily: t.typography.fontFamily.bold }]}>Candidate studio</Text>
                </View>
                <Pressable onPress={closeFormModal} style={({ pressed }) => [styles.formHeroCloseButton, pressed && styles.pressed]}>
                  <Feather name="x" size={18} color="#1D3A6F" />
                </Pressable>
              </View>
              <Text style={[styles.formHeroTitle, { fontFamily: t.typography.fontFamily.bold }]}>{editingCandidate ? 'Edit candidate' : 'Add candidate'}</Text>
              <View style={styles.formHeroMetaRow}>
                <View style={styles.formHeroMiniChip}>
                  <Text style={[styles.formHeroMiniChipText, { fontFamily: t.typography.fontFamily.bold }]}>{requiredReady ? 'Ready to save' : '2 required'}</Text>
                </View>
                <View style={styles.formHeroMiniChip}>
                  <Text style={[styles.formHeroMiniChipText, { fontFamily: t.typography.fontFamily.bold }]}>{`${completionPercent}% complete`}</Text>
                </View>
              </View>
            </LinearGradient>
            <View style={styles.formTabRow}>
              {FORM_TABS.map((tab) => {
                const active = formTab === tab.key;
                return (
                  <Pressable key={tab.key} onPress={() => setFormTab(tab.key)} style={({ pressed }) => [styles.formTabButton, active && styles.formTabButtonActive, pressed && styles.pressed]}>
                    <View style={[styles.formTabIconWrap, active && styles.formTabIconWrapActive]}>
                      <Feather name={tab.icon} size={16} color={active ? '#FFFFFF' : '#1B6FC3'} />
                    </View>
                    <View style={styles.formTabCopy}>
                      <Text style={[styles.formTabLabel, { fontFamily: t.typography.fontFamily.bold }, active && styles.formTabLabelActive]} numberOfLines={1}>{tab.label}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
              {formTab === 'personal' ? (
                <>
                  <View style={[styles.detailSection, styles.primaryDetailSection]}>
                    <View style={styles.requiredHeaderRow}>
                      <View style={styles.requiredHeaderPill}>
                        <Feather name="zap" size={13} color="#1768B8" />
                        <Text style={[styles.requiredHeaderPillText, { fontFamily: t.typography.fontFamily.bold }]}>Start here</Text>
                      </View>
                      <View style={[styles.requiredStatusPill, requiredReady && styles.requiredStatusPillReady]}>
                        <Text style={[styles.requiredStatusText, { fontFamily: t.typography.fontFamily.bold }, requiredReady && styles.requiredStatusTextReady]}>{requiredReady ? 'Ready to save' : '2 required'}</Text>
                      </View>
                    </View>
                    <Text style={[styles.detailSectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Required details</Text>
                    <Text style={[styles.sectionIntro, styles.primarySectionIntro, { fontFamily: t.typography.fontFamily.medium }]}>These fields should stay easy to reach and fill first. Add the name and email, then continue with the rest of the profile.</Text>
                    <Input label="Full name *" value={form.name} onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))} placeholder="Candidate name" />
                    <Input label="Email *" value={form.email} onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))} placeholder="Candidate email" keyboardType="email-address" />
                    <Input label="Phone" value={form.phone} onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))} placeholder="Phone number" keyboardType="phone-pad" />
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={[styles.detailSectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Personal profile</Text>
                    <Text style={[styles.sectionIntro, { fontFamily: t.typography.fontFamily.medium }]}>Optional identity and location details that help the profile feel complete and easier to review.</Text>
                    <View style={styles.formRow}><View style={styles.formHalf}><Input label="First name" value={form.firstname} onChangeText={(value) => setForm((prev) => ({ ...prev, firstname: value }))} placeholder="Optional" /></View><View style={styles.formHalf}><Input label="Last name" value={form.lastname} onChangeText={(value) => setForm((prev) => ({ ...prev, lastname: value }))} placeholder="Optional" /></View></View>
                    <View style={styles.formRow}><View style={styles.formHalf}><DateField label="Date of birth" value={form.dateOfBirth ? (formatDate(form.dateOfBirth) || form.dateOfBirth) : ""} placeholder="Select date of birth" onPress={openDobPicker} /></View><View style={styles.formHalf}><Input label="Country" value={form.country} onChangeText={(value) => setForm((prev) => ({ ...prev, country: value }))} placeholder="Country" /></View></View>
                    <ChoiceGroup label="Gender" value={form.gender} options={GENDER_OPTIONS} onChange={(value) => setForm((prev) => ({ ...prev, gender: value }))} />
                    <ChoiceGroup label="Age range" value={form.ageRange} options={AGE_RANGE_OPTIONS} onChange={(value) => setForm((prev) => ({ ...prev, ageRange: value }))} />
                    <Input label="Address" value={form.address} onChangeText={(value) => setForm((prev) => ({ ...prev, address: value }))} placeholder="Address" multiline />
                    <Input label="Location" value={form.location} onChangeText={(value) => setForm((prev) => ({ ...prev, location: value }))} placeholder="City or preferred location" />
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={[styles.detailSectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Career fit</Text>
                    <Text style={[styles.sectionIntro, { fontFamily: t.typography.fontFamily.medium }]}>Professional details that map to the managed candidate model and make filtering easier later.</Text>
                    <Input label="Profession" value={form.profession} onChangeText={(value) => setForm((prev) => ({ ...prev, profession: value }))} placeholder="Profession" />
                    <Input label="Qualification" value={form.qualification} onChangeText={(value) => setForm((prev) => ({ ...prev, qualification: value }))} placeholder="Qualification" />
                    <Input label="Experience" value={form.experience} onChangeText={(value) => setForm((prev) => ({ ...prev, experience: value }))} placeholder="e.g. 4 years" />
                    <Input label="Job interest" value={form.jobInterest} onChangeText={(value) => setForm((prev) => ({ ...prev, jobInterest: value }))} placeholder="Preferred role or industry" />
                    <Input label="Categories" value={form.categories} onChangeText={(value) => setForm((prev) => ({ ...prev, categories: value }))} placeholder="Comma separated categories" />
                    <Input label="Skills" value={form.skills} onChangeText={(value) => setForm((prev) => ({ ...prev, skills: value }))} placeholder="Comma separated skills" />
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={[styles.detailSectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Links and notes</Text>
                    <Text style={[styles.sectionIntro, { fontFamily: t.typography.fontFamily.medium }]}>Social links and a short summary add helpful context without making the form feel heavy.</Text>
                    <View style={styles.formRow}><View style={styles.formHalf}><Input label="LinkedIn" value={form.linkedin} onChangeText={(value) => setForm((prev) => ({ ...prev, linkedin: value }))} placeholder="LinkedIn URL" /></View><View style={styles.formHalf}><Input label="GitHub" value={form.github} onChangeText={(value) => setForm((prev) => ({ ...prev, github: value }))} placeholder="GitHub URL" /></View></View>
                    <Input label="About candidate" value={form.aboutMe} onChangeText={(value) => setForm((prev) => ({ ...prev, aboutMe: value }))} placeholder="Short summary" multiline />
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={[styles.detailSectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Workflow fields</Text>
                    <Text style={[styles.sectionIntro, { fontFamily: t.typography.fontFamily.medium }]}>Set the operating status now so the candidate lands in the right part of the pipeline immediately.</Text>
                    <ChoiceGroup label="Candidate status" value={form.status} options={STATUS_OPTIONS} onChange={(value) => setForm((prev) => ({ ...prev, status: value }))} />
                    <ChoiceGroup label="Visa status" value={form.visaStatus} options={VISA_OPTIONS} onChange={(value) => setForm((prev) => ({ ...prev, visaStatus: value }))} />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailSectionTitle, { fontFamily: t.typography.fontFamily.bold }]}>Upload slots</Text>
                    <Text style={[styles.sectionIntro, { fontFamily: t.typography.fontFamily.medium }]}>Files are attached as multipart uploads and land as candidate documents on the backend, with one slot per type.</Text>
                  </View>
                  {(Object.keys(FILE_LABELS) as UploadKey[]).map((field) => {
                    const existingDocument = findExistingDocument(editingCandidate, field);
                    const selectedFile = uploads[field];
                    const sizeLabel = formatFileSizeLabel(selectedFile?.size);
                    const ready = !!selectedFile || !!existingDocument;
                    return (
                      <View key={field} style={[styles.uploadRow, ready && styles.uploadRowActive]}>
                        <View style={[styles.uploadIconWrap, ready && styles.uploadIconWrapActive]}>
                          <Feather name={UPLOAD_ICONS[field]} size={16} color={ready ? '#FFFFFF' : '#1B6FC3'} />
                        </View>
                        <View style={styles.uploadCopy}>
                          <View style={styles.uploadHeadingRow}>
                            <Text style={[styles.uploadLabel, { fontFamily: t.typography.fontFamily.bold }]}>{FILE_LABELS[field]}</Text>
                            <View style={[styles.uploadStatusPill, ready && styles.uploadStatusPillActive]}>
                              <Text style={[styles.uploadStatusText, { fontFamily: t.typography.fontFamily.bold }, ready && styles.uploadStatusTextActive]}>{selectedFile ? 'Selected' : existingDocument ? 'Current file' : 'Empty'}</Text>
                            </View>
                          </View>
                          <Text style={[styles.uploadMeta, { fontFamily: t.typography.fontFamily.medium }]}>{UPLOAD_GUIDANCE[field].accepted}</Text>
                          <Text style={[styles.uploadHelper, { fontFamily: t.typography.fontFamily.medium }]}>{UPLOAD_GUIDANCE[field].helper}</Text>
                          {existingDocument ? <Text style={[styles.uploadCurrentFile, { fontFamily: t.typography.fontFamily.medium }]}>{`Current file: ${pickString([existingDocument?.fileName, existingDocument?.originalName], 'Uploaded document')}`}</Text> : null}
                          <Text style={[styles.uploadValue, { fontFamily: t.typography.fontFamily.medium }]}>{selectedFile?.name || 'No new file selected'}</Text>
                          {selectedFile && sizeLabel ? <Text style={[styles.uploadSelectedMeta, { fontFamily: t.typography.fontFamily.medium }]}>{`Selected size: ${sizeLabel}`}</Text> : null}
                        </View>
                        <View style={styles.uploadActions}>
                          <Pressable onPress={() => pickUpload(field)} style={({ pressed }) => [styles.uploadButton, pressed && styles.pressed]}>
                            <Feather name="upload" size={15} color="#1B6FC3" />
                            <Text style={[styles.uploadButtonText, { fontFamily: t.typography.fontFamily.bold }]}>Choose</Text>
                          </Pressable>
                          {selectedFile ? <Pressable onPress={() => setUploads((prev) => ({ ...prev, [field]: null }))} style={({ pressed }) => [styles.uploadClearButton, pressed && styles.pressed]}><Feather name="x" size={14} color="#D63655" /></Pressable> : null}
                        </View>
                      </View>
                    );
                  })}
                </>
              )}
              {saving ? <Text style={[styles.savingNote, { fontFamily: t.typography.fontFamily.medium }]}>{uploadProgress > 0 ? `Uploading ${uploadProgress}%` : 'Saving candidate...'}</Text> : null}
              <View style={styles.modalFooter}>
                <Pressable onPress={closeFormModal} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}><Text style={[styles.cancelButtonText, { fontFamily: t.typography.fontFamily.bold }]}>Cancel</Text></Pressable>
                <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => [styles.saveButton, pressed && !saving && styles.pressed, saving && styles.disabledButton]}>
                  <LinearGradient colors={['#1548A5', '#1E6BD8', '#26A5C8']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.saveButtonFill}><Feather name="save" size={16} color="#FFFFFF" /><Text style={[styles.saveButtonText, { fontFamily: t.typography.fontFamily.bold }]}>{saving ? 'Saving...' : editingCandidate ? 'Save Candidate' : 'Add Candidate'}</Text></LinearGradient>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={dobPickerVisible} transparent animationType="fade" onRequestClose={() => setDobPickerVisible(false)}>
        <View style={styles.calendarModalRoot}>
          <Pressable style={styles.calendarModalBackdrop} onPress={() => setDobPickerVisible(false)} />
          <View style={styles.calendarSheet}>
            <LinearGradient colors={['#F8FCFF', '#EEF7FF', '#F4FFFC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.calendarSheetHeader}>
              <View style={styles.calendarHeaderTopRow}>
                <View>
                  <Text style={[styles.calendarEyebrow, { fontFamily: t.typography.fontFamily.bold }]}>Date picker</Text>
                  <Text style={[styles.calendarTitle, { fontFamily: t.typography.fontFamily.bold }]}>Select date of birth</Text>
                </View>
                <Pressable onPress={() => setDobPickerVisible(false)} style={({ pressed }) => [styles.calendarCloseButton, pressed && styles.pressed]}>
                  <Feather name="x" size={18} color="#1D3A6F" />
                </Pressable>
              </View>
              <View style={styles.calendarMonthRow}>
                <Pressable onPress={() => setDobPickerMonth((prev) => shiftCalendarMonth(prev, -1))} style={({ pressed }) => [styles.calendarArrowButton, pressed && styles.pressed]}>
                  <Feather name="chevron-left" size={18} color="#1B6FC3" />
                </Pressable>
                <Text style={[styles.calendarMonthLabel, { fontFamily: t.typography.fontFamily.bold }]}>{dobMonthLabel}</Text>
                <Pressable onPress={() => setDobPickerMonth((prev) => shiftCalendarMonth(prev, 1))} style={({ pressed }) => [styles.calendarArrowButton, pressed && styles.pressed]}>
                  <Feather name="chevron-right" size={18} color="#1B6FC3" />
                </Pressable>
              </View>
              <View style={styles.calendarYearRow}>
                <Pressable onPress={() => setDobPickerMonth((prev) => buildCalendarMonth(prev.getFullYear() - 10, prev.getMonth()))} style={({ pressed }) => [styles.calendarYearButton, pressed && styles.pressed]}>
                  <Text style={[styles.calendarYearButtonText, { fontFamily: t.typography.fontFamily.bold }]}>-10Y</Text>
                </Pressable>
                <Pressable onPress={() => setDobPickerMonth((prev) => buildCalendarMonth(prev.getFullYear() - 1, prev.getMonth()))} style={({ pressed }) => [styles.calendarYearButton, pressed && styles.pressed]}>
                  <Text style={[styles.calendarYearButtonText, { fontFamily: t.typography.fontFamily.bold }]}>-1Y</Text>
                </Pressable>
                <View style={styles.calendarYearBadge}>
                  <Text style={[styles.calendarYearValue, { fontFamily: t.typography.fontFamily.bold }]}>{selectedDobYear}</Text>
                </View>
                <Pressable onPress={() => setDobPickerMonth((prev) => buildCalendarMonth(prev.getFullYear() + 1, prev.getMonth()))} style={({ pressed }) => [styles.calendarYearButton, pressed && styles.pressed]}>
                  <Text style={[styles.calendarYearButtonText, { fontFamily: t.typography.fontFamily.bold }]}>+1Y</Text>
                </Pressable>
                <Pressable onPress={() => setDobPickerMonth((prev) => buildCalendarMonth(prev.getFullYear() + 10, prev.getMonth()))} style={({ pressed }) => [styles.calendarYearButton, pressed && styles.pressed]}>
                  <Text style={[styles.calendarYearButtonText, { fontFamily: t.typography.fontFamily.bold }]}>+10Y</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calendarMonthChipRow}>
                {CALENDAR_MONTHS.map((month, index) => {
                  const active = index === selectedDobMonthIndex;
                  return (
                    <Pressable key={month} onPress={() => setDobPickerMonth((prev) => buildCalendarMonth(prev.getFullYear(), index))} style={({ pressed }) => [styles.calendarMonthChip, active && styles.calendarMonthChipActive, pressed && styles.pressed]}>
                      <Text style={[styles.calendarMonthChipText, active && styles.calendarMonthChipTextActive, { fontFamily: t.typography.fontFamily.bold }]}>{month}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </LinearGradient>
            <View style={styles.calendarBody}>
              <View style={styles.calendarWeekRow}>
                {CALENDAR_WEEKDAYS.map((day) => <Text key={day} style={[styles.calendarWeekday, { fontFamily: t.typography.fontFamily.bold }]}>{day}</Text>)}
              </View>
              <View style={styles.calendarGrid}>
                {dobCalendarDays.map((day) => {
                  const isoDate = toIsoDate(day.date);
                  const isSelected = form.dateOfBirth === isoDate;
                  const isFuture = day.date.getTime() > Date.now();
                  return (
                    <Pressable
                      key={day.key}
                      disabled={isFuture}
                      onPress={() => {
                        setForm((prev) => ({ ...prev, dateOfBirth: isoDate }));
                        setDobPickerVisible(false);
                      }}
                      style={({ pressed }) => [
                        styles.calendarDayCell,
                        !day.inMonth && styles.calendarDayCellMuted,
                        isSelected && styles.calendarDayCellSelected,
                        isFuture && styles.calendarDayCellDisabled,
                        pressed && !isFuture && styles.pressed,
                      ]}
                    >
                      <Text style={[
                        styles.calendarDayText,
                        !day.inMonth && styles.calendarDayTextMuted,
                        isSelected && styles.calendarDayTextSelected,
                        isFuture && styles.calendarDayTextDisabled,
                        { fontFamily: t.typography.fontFamily.bold },
                      ]}>
                        {day.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.calendarFooter}>
                <Pressable onPress={() => { setForm((prev) => ({ ...prev, dateOfBirth: '' })); setDobPickerVisible(false); }} style={({ pressed }) => [styles.calendarSecondaryButton, pressed && styles.pressed]}>
                  <Text style={[styles.calendarSecondaryButtonText, { fontFamily: t.typography.fontFamily.bold }]}>Clear</Text>
                </Pressable>
                <Pressable onPress={() => setDobPickerVisible(false)} style={({ pressed }) => [styles.calendarPrimaryButton, pressed && styles.pressed]}>
                  <Text style={[styles.calendarPrimaryButtonText, { fontFamily: t.typography.fontFamily.bold }]}>Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 164, backgroundColor: '#F2F6FD' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#D1DEF3' },
  topCopy: { flex: 1 },
  topEyebrow: { color: '#6A7F99', fontSize: 11, lineHeight: 14, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '700' },
  topTitle: { marginTop: 4, color: '#13306F', fontSize: 20, lineHeight: 24, fontWeight: '900', letterSpacing: -0.4 },
  liveChipSolid: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#F5F8FD', borderWidth: 1, borderColor: '#D7E4F7' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C57D' },
  liveChipText: { color: '#194A9A', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  heroCard: { borderRadius: 30, overflow: 'hidden', borderWidth: 1, borderColor: '#D5E3F2', shadowColor: '#7AA7D8', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  heroFill: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, position: 'relative', overflow: 'hidden' },
  heroGlowA: { position: 'absolute', top: -76, right: -14, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(55, 142, 255, 0.12)' },
  heroGlowB: { position: 'absolute', bottom: -24, left: -16, width: 128, height: 128, borderRadius: 64, backgroundColor: 'rgba(72, 214, 188, 0.11)' },
  heroSweep: { position: 'absolute', top: -50, bottom: -40, width: 76, backgroundColor: 'rgba(255,255,255,0.46)' },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8E4F4' },
  heroPillText: { color: '#1967C2', fontSize: 11, lineHeight: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  heroLive: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8E4F4' },
  heroLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C57D' },
  heroLiveText: { color: '#1A4F9F', fontSize: 11, lineHeight: 13, fontWeight: '800' },
  heroTitle: { marginTop: 14, color: '#19367C', fontSize: 28, lineHeight: 32, fontWeight: '900', letterSpacing: -0.6 },
  heroBody: { marginTop: 8, color: '#5D708A', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  heroSummaryRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroSummaryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E3F2' },
  heroSummaryText: { color: '#4E6482', fontSize: 10, lineHeight: 12, fontWeight: '800' },
  statsGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, columnGap: 8 },
  statCard: { width: '48.2%', maxWidth: '48.2%', minWidth: 0, borderRadius: 24, padding: 12, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: '#D8E4F6', shadowColor: '#163B79', shadowOpacity: 0.09, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4, position: 'relative', overflow: 'hidden' },
  statAccentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 5 },
  statGlowOrb: { position: 'absolute', top: -18, right: -10, width: 90, height: 90, borderRadius: 45 },
  statCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statIcon: { width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  statIconElevated: { borderWidth: 1, shadowColor: '#173A72', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  statValueWrap: { flex: 1, minWidth: 0, gap: 5 },
  statValue: { color: '#1D2944', fontSize: 25, lineHeight: 28, fontWeight: '900', letterSpacing: -0.4 },
  statBadge: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 22, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  statBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  statBadgeText: { fontSize: 9, lineHeight: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.35 },
  statLabel: { marginTop: 10, color: '#44546E', fontSize: 12, lineHeight: 15, fontWeight: '800' },
  statNotePill: { marginTop: 8, borderRadius: 13, paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1 },
  statNote: { color: '#7A879C', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  toolbarCard: { marginTop: 12, borderRadius: 24, padding: 14, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: '#D8E4F6', shadowColor: '#183A73', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  toolbarHeader: { marginBottom: 12, gap: 8 },
  toolbarPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F3F8FF', borderWidth: 1, borderColor: '#D6E3F3' },
  toolbarPillText: { color: '#1768B8', fontSize: 10, lineHeight: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  toolbarTitle: { color: '#19367C', fontSize: 20, lineHeight: 24, fontWeight: '900', letterSpacing: -0.4 },
  toolbarBody: { color: '#61748F', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  toolbarMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toolbarMetaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#E0EAF6' },
  toolbarMetaText: { color: '#4F6583', fontSize: 10, lineHeight: 12, fontWeight: '800' },
  toolbarFooter: { marginTop: 8, gap: 12 },
  toolbarHint: { color: '#6A7A93', fontSize: 12, lineHeight: 17, fontWeight: '500' },
  addButton: { alignSelf: 'stretch', borderRadius: 20, overflow: 'hidden' },
  addButtonFill: { minHeight: 78, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  addButtonGlow: { position: 'absolute', top: -24, right: -18, width: 108, height: 108, borderRadius: 54, backgroundColor: 'rgba(255,255,255,0.16)' },
  addButtonIconWrap: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', alignItems: 'center', justifyContent: 'center' },
  addButtonCopy: { flex: 1 },
  addButtonEyebrow: { color: 'rgba(255,255,255,0.78)', fontSize: 10, lineHeight: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  addButtonText: { marginTop: 2, color: '#FFFFFF', fontSize: 16, lineHeight: 20, fontWeight: '800' },
  addButtonHint: { marginTop: 3, color: 'rgba(255,255,255,0.88)', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  sectionHeader: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  sectionTitle: { color: '#1E2942', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  sectionSubtitle: { marginTop: 4, color: '#6F809A', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  pageChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F4F8FF', borderWidth: 1, borderColor: '#D7E4F5', color: '#1D4F99', fontSize: 12, lineHeight: 15, overflow: 'hidden' },
  emptyWrap: { paddingTop: 30, paddingBottom: 10 },
  candidateCard: { marginTop: 12, borderRadius: 26, padding: 14, backgroundColor: 'rgba(255,255,255,0.97)', borderWidth: 1, borderColor: '#D8E4F6', shadowColor: '#4B74A7', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 3, position: 'relative', overflow: 'hidden' },
  candidateAccentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  candidateGlowOrb: { position: 'absolute', top: -18, right: -14, width: 86, height: 86, borderRadius: 43 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  identityRow: { flexDirection: 'row', gap: 12, flex: 1 },
  avatarWrap: { width: 48, height: 48, borderRadius: 18, backgroundColor: '#1B6FC1', alignItems: 'center', justifyContent: 'center' },
  identityCopy: { flex: 1 },
  candidateName: { color: '#1E2A45', fontSize: 17, lineHeight: 21, fontWeight: '900' },
  candidateRole: { marginTop: 4, color: '#6E7E97', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1 },
  badgeText: { fontSize: 11, lineHeight: 13, fontWeight: '800' },
  metaGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaBox: { width: '48%', minHeight: 46, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: '#F6FAFF', borderWidth: 1, borderColor: '#E2EBF6', flexDirection: 'row', alignItems: 'center' },
  metaText: { marginLeft: 8, flex: 1, color: '#596D8A', fontSize: 12, lineHeight: 15, fontWeight: '600' },
  metricsRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#F7FAFF', borderWidth: 1, borderColor: '#DCE7F6' },
  metricChipText: { color: '#607089', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  categoryRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#EDF5FF' },
  categoryChipText: { color: '#1D4F99', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  switchViewCard: { marginTop: 14, borderRadius: 22, overflow: 'hidden', shadowColor: '#154A9B', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  switchViewCardFill: { minHeight: 88, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  switchViewGlow: { position: 'absolute', top: -28, right: -18, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.15)' },
  switchViewIconWrap: { width: 46, height: 46, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', alignItems: 'center', justifyContent: 'center' },
  switchViewCopy: { flex: 1 },
  switchViewEyebrow: { color: 'rgba(255,255,255,0.78)', fontSize: 11, lineHeight: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  switchViewTitle: { marginTop: 3, color: '#FFFFFF', fontSize: 17, lineHeight: 21, fontWeight: '900' },
  switchViewHint: { marginTop: 4, color: 'rgba(255,255,255,0.88)', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  actionsGrid: { marginTop: 10, flexDirection: 'row', gap: 10 },
  actionButton: { flex: 1, minHeight: 44, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionButtonText: { fontSize: 12, lineHeight: 15, fontWeight: '800' },
  paginationCard: { marginTop: 16, borderRadius: 22, padding: 14, backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 1, borderColor: '#D8E4F6', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  paginationButton: { minHeight: 42, borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: '#D8E4F6', backgroundColor: '#F7FAFF', flexDirection: 'row', alignItems: 'center', gap: 6 },
  paginationText: { fontSize: 12, lineHeight: 15, fontWeight: '800' },
  paginationMeta: { color: '#1D4F99', fontSize: 12, lineHeight: 15, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(14, 25, 45, 0.38)', justifyContent: 'flex-end' },
  modalDismissArea: { flex: 1 },
  modalShell: { maxHeight: '88%', borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#F9FBFF', borderWidth: 1, borderColor: '#D7E4F5' },
  formModalShell: { height: '92%', maxHeight: '96%', borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: '#F6FAFF', borderWidth: 1, borderColor: '#D7E4F5', overflow: 'hidden' },
  formHeroCard: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8, position: 'relative', overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: 'rgba(214, 229, 244, 0.9)' },
  formHeroGlowA: { position: 'absolute', top: -34, right: -18, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(111, 196, 255, 0.22)' },
  formHeroGlowB: { position: 'absolute', bottom: -46, left: -28, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(164, 235, 211, 0.18)' },
  formHeroSweep: { position: 'absolute', top: 0, bottom: 0, width: 120, backgroundColor: 'rgba(255,255,255,0.28)', transform: [{ skewX: '-16deg' }] },
  formHeroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  formHeroPill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1, borderColor: '#D6E4F4' },
  formHeroPillText: { color: '#1768B8', fontSize: 10, lineHeight: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.45 },
  formHeroCloseButton: { width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.84)', borderWidth: 1, borderColor: '#D6E4F4' },
  formHeroTitle: { marginTop: 8, color: '#19367C', fontSize: 18, lineHeight: 22, fontWeight: '900', letterSpacing: -0.35 },
  formHeroBody: { marginTop: 0, color: '#5D708A', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  formHeroStatsRow: { marginTop: 8, flexDirection: 'row', gap: 8 },
  formHeroMetaRow: { marginTop: 8, flexDirection: 'row', gap: 8 },
  formHeroMiniChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.86)', borderWidth: 1, borderColor: '#D7E4F5' },
  formHeroMiniChipText: { color: '#1D4F99', fontSize: 11, lineHeight: 13, fontWeight: '800' },
  formHeroStatChip: { flex: 1, minHeight: 40, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1, borderColor: '#D7E4F5' },
  formHeroStatValue: { color: '#19367C', fontSize: 12, lineHeight: 14, fontWeight: '900' },
  formHeroStatLabel: { marginTop: 2, color: '#61748F', fontSize: 9, lineHeight: 11, fontWeight: '600' },
  modalHeader: { paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E0E9F7', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  modalTitle: { color: '#1E2942', fontSize: 20, lineHeight: 24, fontWeight: '900' },
  modalSubtitle: { marginTop: 4, color: '#6F809A', fontSize: 12, lineHeight: 17, fontWeight: '500' },
  formTabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingTop: 6, paddingBottom: 2 },
  formTabButton: { flex: 1, minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: '#D7E4F5', backgroundColor: 'rgba(255,255,255,0.94)', paddingHorizontal: 10, paddingVertical: 7, gap: 6, flexDirection: 'row', alignItems: 'center' },
  formTabButtonActive: { backgroundColor: '#FFFFFF', borderColor: '#A8CBF7', shadowColor: '#3F78BF', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  formTabIconWrap: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7F1FF' },
  formTabIconWrapActive: { backgroundColor: '#1B6FC3' },
  formTabCopy: { flex: 1, justifyContent: 'center', minWidth: 0 },
  formTabLabel: { color: '#21406F', fontSize: 11, lineHeight: 13, fontWeight: '800' },
  formTabLabelActive: { color: '#184690' },
  formTabHint: { marginTop: 0, color: '#6F809A', fontSize: 10, lineHeight: 13, fontWeight: '600' },
  formTabHintActive: { color: '#476EA7' },
  formIntroCard: { marginHorizontal: 18, marginTop: 6, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.97)', borderWidth: 1, borderColor: '#D8E4F6', shadowColor: '#184277', shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  formIntroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  formIntroCompactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  formIntroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: '#F3F8FF', borderWidth: 1, borderColor: '#D8E4F6' },
  formIntroBadgeText: { color: '#1768B8', fontSize: 10, lineHeight: 12, fontWeight: '800' },
  formIntroCountPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#EAF4FF', borderWidth: 1, borderColor: '#CFE0F6' },
  formIntroCountText: { color: '#1D4F99', fontSize: 10, lineHeight: 12, fontWeight: '800' },
  formIntroTitle: { marginTop: 0, color: '#1E2942', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  formIntroText: { marginTop: 0, color: '#5F738F', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  closeButton: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F8FF', borderWidth: 1, borderColor: '#D7E4F5' },
  formScroll: { flex: 1 },
  modalContent: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 26 },
  detailSection: { marginBottom: 12, borderRadius: 24, padding: 15, backgroundColor: 'rgba(255,255,255,0.98)', borderWidth: 1, borderColor: '#DCE8F8', shadowColor: '#17437B', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  detailSectionTitle: { color: '#1E2942', fontSize: 16, lineHeight: 20, fontWeight: '900', marginBottom: 10 },
  sectionIntro: { marginBottom: 10, color: '#6F809A', fontSize: 12, lineHeight: 17, fontWeight: '500' },
  primaryDetailSection: { paddingTop: 18, paddingBottom: 18, borderColor: '#CFE0F6', backgroundColor: '#FFFFFF', shadowOpacity: 0.08 },
  requiredHeaderRow: { marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  requiredHeaderPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F3F8FF', borderWidth: 1, borderColor: '#D8E4F6' },
  requiredHeaderPillText: { color: '#1768B8', fontSize: 10, lineHeight: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.35 },
  requiredStatusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFF7DE', borderWidth: 1, borderColor: '#F4E2A5' },
  requiredStatusPillReady: { backgroundColor: '#EAF8EF', borderColor: '#C7EAD5' },
  requiredStatusText: { color: '#B57606', fontSize: 10, lineHeight: 12, fontWeight: '800' },
  requiredStatusTextReady: { color: '#15804E' },
  primarySectionIntro: { marginBottom: 12, color: '#5F738F' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailBox: { width: '48%', borderRadius: 16, padding: 12, backgroundColor: '#F7FAFF', borderWidth: 1, borderColor: '#E2EBF6' },
  detailLabel: { color: '#71819B', fontSize: 11, lineHeight: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  detailValue: { marginTop: 6, color: '#213049', fontSize: 13, lineHeight: 17, fontWeight: '600' },
  detailParagraph: { color: '#5F738F', fontSize: 13, lineHeight: 18, fontWeight: '500', marginTop: 6 },
  formRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  formHalf: { flex: 1 },
  choiceGroup: { marginBottom: 10 },
  dateFieldButton: { minHeight: 58, borderRadius: 18, borderWidth: 1, borderColor: '#DCE7F6', backgroundColor: '#F9FBFF', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateFieldIconWrap: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#EAF4FF', borderWidth: 1, borderColor: '#D7E4F5', alignItems: 'center', justifyContent: 'center' },
  dateFieldCopy: { flex: 1, minWidth: 0 },
  dateFieldValue: { color: '#213049', fontSize: 13, lineHeight: 17, fontWeight: '800' },
  dateFieldPlaceholder: { color: '#8A99AF' },
  dateFieldHint: { marginTop: 2, color: '#6F809A', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  dateFieldChevronWrap: { width: 24, alignItems: 'flex-end' },
  fieldLabel: { marginBottom: 8, color: '#213049', fontSize: 12, lineHeight: 15, fontWeight: '800' },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F7FAFF', borderWidth: 1, borderColor: '#DCE7F6' },
  choiceChipActive: { backgroundColor: '#1B6FC1', borderColor: '#1B6FC1' },
  choiceChipText: { color: '#1D4F99', fontSize: 12, lineHeight: 15, fontWeight: '700' },
  choiceChipTextActive: { color: '#FFFFFF' },
  uploadRow: { marginBottom: 10, borderRadius: 22, padding: 14, backgroundColor: 'rgba(255,255,255,0.98)', borderWidth: 1, borderColor: '#DCE8F8', flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#17437B', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  uploadRowActive: { borderColor: '#B7D4F6', backgroundColor: '#FBFDFF' },
  uploadIconWrap: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#EAF4FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D5E4F5' },
  uploadIconWrapActive: { backgroundColor: '#1B6FC3', borderColor: '#1B6FC3' },
  uploadCopy: { flex: 1 },
  uploadHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  uploadLabel: { color: '#213049', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  uploadStatusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#F3F8FF', borderWidth: 1, borderColor: '#D8E4F6' },
  uploadStatusPillActive: { backgroundColor: '#EAF8EF', borderColor: '#C7EAD5' },
  uploadStatusText: { color: '#56708F', fontSize: 9, lineHeight: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.35 },
  uploadStatusTextActive: { color: '#15804E' },
  uploadMeta: { marginTop: 4, color: '#1B4F9C', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  uploadHelper: { marginTop: 4, color: '#6F809A', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  uploadCurrentFile: { marginTop: 8, color: '#2E7D58', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  uploadValue: { marginTop: 8, color: '#6F809A', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  uploadSelectedMeta: { marginTop: 4, color: '#1D4F99', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  viewHeroCard: { marginBottom: 14, borderRadius: 24, padding: 16, backgroundColor: '#F4F8FF', borderWidth: 1, borderColor: '#D8E4F6' },
  viewHeroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  viewHeroIdentity: { flexDirection: 'row', gap: 12, flex: 1 },
  viewHeroAvatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#1B6FC1', alignItems: 'center', justifyContent: 'center' },
  viewHeroCopy: { flex: 1 },
  viewHeroName: { color: '#1E2942', fontSize: 20, lineHeight: 24, fontWeight: '900' },
  viewHeroEmail: { marginTop: 4, color: '#607089', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  viewHeroBadge: { minWidth: 108, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, alignItems: 'flex-start' },
  viewHeroBadgeLabel: { color: '#6B7A94', fontSize: 10, lineHeight: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  viewHeroBadgeValue: { marginTop: 4, fontSize: 12, lineHeight: 15, fontWeight: '800' },
  viewSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  viewSummaryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE7F6' },
  viewSummaryText: { color: '#44546E', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  viewChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  viewSkillChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#EEF5FF', borderWidth: 1, borderColor: '#C9DBFA' },
  viewSkillChipText: { color: '#1D4F99', fontSize: 12, lineHeight: 15, fontWeight: '600' },
  viewCategoryChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#EAF8EF', borderWidth: 1, borderColor: '#C7EAD5' },
  viewCategoryChipText: { color: '#15804E', fontSize: 12, lineHeight: 15, fontWeight: '600' },
  viewBulletList: { gap: 8 },
  viewBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  viewBulletDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1B6FC3', marginTop: 6 },
  viewBulletText: { flex: 1, marginTop: 0 },
  viewLinkStack: { gap: 10 },
  viewLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, padding: 12, backgroundColor: '#F7FAFF', borderWidth: 1, borderColor: '#E2EBF6' },
  viewLinkLabel: { width: 62, color: '#1E2942', fontSize: 12, lineHeight: 15, fontWeight: '800' },
  viewLinkValue: { flex: 1, color: '#607089', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  viewDocumentGroup: { marginTop: 4, marginBottom: 12 },
  viewDocumentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  viewDocumentTitle: { color: '#1E2942', fontSize: 13, lineHeight: 16, fontWeight: '900' },
  viewDocumentCount: { color: '#6F809A', fontSize: 11, lineHeight: 14, fontWeight: '500' },
  viewDocumentCard: { borderRadius: 18, padding: 12, backgroundColor: '#F7FAFF', borderWidth: 1, borderColor: '#E2EBF6', marginBottom: 8 },
  viewDocumentLink: { minHeight: 42, borderRadius: 14, paddingHorizontal: 12, backgroundColor: '#EEF5FF', borderWidth: 1, borderColor: '#C9DBFA', flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewDocumentLinkText: { flex: 1, color: '#1B4F9C', fontSize: 12, lineHeight: 15, fontWeight: '800' },
  viewDocumentMeta: { marginTop: 6, color: '#6F809A', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  viewImagePreviewWrap: { width: '100%', height: 148, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9F0FB', borderWidth: 1, borderColor: '#D5E2F6' },
  viewImagePreview: { width: '100%', height: '100%' },
  uploadActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  uploadButton: { minHeight: 42, borderRadius: 14, paddingHorizontal: 13, backgroundColor: '#EEF5FF', borderWidth: 1, borderColor: '#C9DBFA', flexDirection: 'row', alignItems: 'center', gap: 7 },
  uploadButtonText: { color: '#1B4F9C', fontSize: 12, lineHeight: 15, fontWeight: '800' },
  uploadClearButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FFF3F5', borderWidth: 1, borderColor: '#F2CCD3', alignItems: 'center', justifyContent: 'center' },
  savingNote: { marginTop: 2, marginBottom: 10, color: '#1B4F9C', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  modalFooter: { marginTop: 6, paddingTop: 4, flexDirection: 'row', gap: 10 },
  cancelButton: { flex: 1, minHeight: 54, borderRadius: 18, backgroundColor: '#F4F8FF', borderWidth: 1, borderColor: '#D8E4F6', alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { color: '#1D4F99', fontSize: 14, lineHeight: 18, fontWeight: '800' },
  saveButton: { flex: 1.25, borderRadius: 20, overflow: 'hidden', shadowColor: '#1656B3', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  saveButtonFill: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  saveButtonText: { color: '#FFFFFF', fontSize: 14, lineHeight: 18, fontWeight: '800' },
  disabledButton: { opacity: 0.45 },
  calendarModalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(14, 25, 45, 0.22)' },
  calendarModalBackdrop: { flex: 1 },
  calendarSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#D8E4F6', overflow: 'hidden' },
  calendarSheetHeader: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#DCE8F7' },
  calendarHeaderTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  calendarEyebrow: { color: '#1768B8', fontSize: 10, lineHeight: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.45 },
  calendarTitle: { marginTop: 4, color: '#19367C', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  calendarCloseButton: { width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: '#D6E4F4' },
  calendarMonthRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  calendarArrowButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D6E4F4' },
  calendarMonthLabel: { flex: 1, textAlign: 'center', color: '#21406F', fontSize: 16, lineHeight: 20, fontWeight: '900' },
  calendarYearRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  calendarYearButton: { minWidth: 54, minHeight: 38, borderRadius: 14, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D6E4F4' },
  calendarYearButtonText: { color: '#1B6FC3', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  calendarYearBadge: { flex: 1, minHeight: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF4FF', borderWidth: 1, borderColor: '#CFE0F6' },
  calendarYearValue: { color: '#1D4F99', fontSize: 16, lineHeight: 20, fontWeight: '900' },
  calendarMonthChipRow: { marginTop: 12, gap: 8, paddingRight: 6 },
  calendarMonthChip: { minHeight: 38, borderRadius: 14, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D6E4F4' },
  calendarMonthChipActive: { backgroundColor: '#1B6FC3', borderColor: '#1B6FC3' },
  calendarMonthChipText: { color: '#1D4F99', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  calendarMonthChipTextActive: { color: '#FFFFFF' },
  calendarBody: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 24 },
  calendarWeekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  calendarWeekday: { width: '14.28%', textAlign: 'center', color: '#7A8AA2', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  calendarDayCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2EBF6' },
  calendarDayCellMuted: { backgroundColor: '#F5F8FD', borderColor: '#EBF1F8' },
  calendarDayCellSelected: { backgroundColor: '#1B6FC3', borderColor: '#1B6FC3', shadowColor: '#1B6FC3', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  calendarDayCellDisabled: { opacity: 0.4 },
  calendarDayText: { color: '#213049', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  calendarDayTextMuted: { color: '#9AA8BA' },
  calendarDayTextSelected: { color: '#FFFFFF' },
  calendarDayTextDisabled: { color: '#9AA8BA' },
  calendarFooter: { marginTop: 18, flexDirection: 'row', gap: 10 },
  calendarSecondaryButton: { flex: 1, minHeight: 50, borderRadius: 18, backgroundColor: '#F4F8FF', borderWidth: 1, borderColor: '#D8E4F6', alignItems: 'center', justifyContent: 'center' },
  calendarSecondaryButtonText: { color: '#1D4F99', fontSize: 14, lineHeight: 18, fontWeight: '800' },
  calendarPrimaryButton: { flex: 1, minHeight: 50, borderRadius: 18, backgroundColor: '#1B6FC3', alignItems: 'center', justifyContent: 'center', shadowColor: '#1656B3', shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  calendarPrimaryButtonText: { color: '#FFFFFF', fontSize: 14, lineHeight: 18, fontWeight: '800' },
    pressed: { opacity: 0.88 },
});











