import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AgentCandidatesService } from '../../api/services';
import ManagedViewBanner from '../../components/managed/ManagedViewBanner';
import { EmptyState, Input, Screen } from '../../components/ui';
import { useAuthStore } from '../../context/authStore';
import type { ManagedCandidate } from '../../types/models';
import { formatDate } from '../../utils/format';
import { buildManagedViewUser, getManagedCandidate, getManagedCandidateName, stripManagedViewState } from '../../utils/managedView';

type CandidateForm = {
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  ageRange: string;
  address: string;
  country: string;
  location: string;
  profession: string;
  qualification: string;
  experience: string;
  jobInterest: string;
  categories: string;
  skills: string;
  aboutMe: string;
  linkedin: string;
  github: string;
  visaStatus: string;
  status: string;
};

const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const AGE_RANGE_OPTIONS = ['18-24', '25-34', '35-44', '45-54', '55+'];
const VISA_OPTIONS = ['Not Started', 'Processing', 'Approved', 'Rejected', 'Completed'];
const STATUS_OPTIONS = ['Pending', 'Reviewed', 'Approved', 'Rejected'];

const pickString = (values: any[], fallback = '') => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
};

const toCommaText = (value: any) => (Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean).join(', ') : String(value || '').trim());
const normalizeList = (value: any) => (Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : String(value || '').split(',').map((item) => item.trim()).filter(Boolean));
const emptyForm = (): CandidateForm => ({ name: '', email: '', phone: '', dateOfBirth: '', gender: '', ageRange: '', address: '', country: '', location: '', profession: '', qualification: '', experience: '', jobInterest: '', categories: '', skills: '', aboutMe: '', linkedin: '', github: '', visaStatus: 'Not Started', status: 'Pending' });
const formFromCandidate = (candidate: ManagedCandidate | null): CandidateForm => candidate ? ({ name: pickString([candidate.name]), email: pickString([candidate.email]), phone: pickString([candidate.phone]), dateOfBirth: pickString([candidate.dateOfBirth ? String(candidate.dateOfBirth).split('T')[0] : '']), gender: pickString([candidate.gender]), ageRange: pickString([candidate.ageRange]), address: pickString([candidate.address]), country: pickString([candidate.country]), location: pickString([candidate.location]), profession: pickString([candidate.profession]), qualification: pickString([candidate.qualification]), experience: pickString([candidate.experience]), jobInterest: pickString([candidate.jobInterest]), categories: toCommaText(candidate.categories), skills: toCommaText(candidate.skills), aboutMe: pickString([candidate.aboutMe]), linkedin: pickString([candidate.socialNetworks?.linkedin]), github: pickString([candidate.socialNetworks?.github]), visaStatus: pickString([candidate.visaStatus], 'Not Started'), status: pickString([candidate.status], 'Pending') }) : emptyForm();
const normalizeCandidate = (candidate: any): ManagedCandidate => ({ ...(candidate || {}), _id: String(candidate?._id || candidate?.id || ''), categories: normalizeList(candidate?.categories), skills: normalizeList(candidate?.skills), documents: Array.isArray(candidate?.documents) ? candidate.documents : [], inquiries: Array.isArray(candidate?.inquiries) ? candidate.inquiries : [], appliedJobs: Array.isArray(candidate?.appliedJobs) ? candidate.appliedJobs : [], savedJobs: Array.isArray(candidate?.savedJobs) ? candidate.savedJobs : [], socialNetworks: candidate?.socialNetworks && typeof candidate.socialNetworks === 'object' ? candidate.socialNetworks : { linkedin: pickString([candidate?.linkedin]), github: pickString([candidate?.github]) } });
const getProfileCompletion = (candidate: ManagedCandidate | null) => {
  const fields = [candidate?.name, candidate?.email, candidate?.phone, candidate?.location, candidate?.profession, candidate?.qualification, candidate?.jobInterest, candidate?.aboutMe, Array.isArray(candidate?.documents) && candidate.documents.length ? 'docs' : ''];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
};
const statusTone = (value?: string) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('approve')) return { bg: '#EAF8EF', border: '#C7EAD5', text: '#15804E' };
  if (normalized.includes('review') || normalized.includes('process')) return { bg: '#EEF5FF', border: '#C9DBFA', text: '#2563EB' };
  if (normalized.includes('reject')) return { bg: '#FFF1F4', border: '#F3CDD6', text: '#D63655' };
  return { bg: '#FFF7DE', border: '#F4E2A5', text: '#B57606' };
};

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

export default function ManagedCandidateProfileScreen() {
  const navigation = useNavigation<any>();
  const token = useAuthStore((s) => s.token);
  const storeUser = useAuthStore((s) => s.user);
  const signIn = useAuthStore((s) => s.signIn);
  const managedCandidate = useMemo(() => getManagedCandidate(storeUser), [storeUser]);
  const fallbackName = useMemo(() => getManagedCandidateName(storeUser), [storeUser]);
  const [candidate, setCandidate] = useState<ManagedCandidate | null>(managedCandidate);
  const [form, setForm] = useState<CandidateForm>(() => formFromCandidate(managedCandidate));
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditing) return;
    setCandidate(managedCandidate);
    setForm(formFromCandidate(managedCandidate));
  }, [managedCandidate, isEditing]);

  const exitManagedView = useCallback(async () => {
    if (!token || !storeUser) return;
    await signIn({ token, user: stripManagedViewState(storeUser) });
  }, [signIn, storeUser, token]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) return navigation.goBack();
    const parent = navigation.getParent();
    if (parent?.canGoBack()) return parent.goBack();
    parent?.navigate('Overview' as never);
  }, [navigation]);

  const activeCandidate = candidate || managedCandidate;
  const candidateName = pickString([activeCandidate?.name, fallbackName], 'Managed candidate');
  const tone = statusTone(activeCandidate?.status);
  const metrics = [
    { key: 'strength', label: 'Profile strength', value: `${getProfileCompletion(activeCandidate)}%`, icon: 'activity' as const, color: '#1768B8', bg: '#EAF2FF' },
    { key: 'applications', label: 'Applications', value: String(Array.isArray(activeCandidate?.appliedJobs) ? activeCandidate.appliedJobs.length : 0), icon: 'briefcase' as const, color: '#11856E', bg: '#EAF8F0' },
    { key: 'documents', label: 'Documents', value: String(Array.isArray(activeCandidate?.documents) ? activeCandidate.documents.length : 0), icon: 'file-text' as const, color: '#7B56D8', bg: '#F1EAFF' },
  ];
  const detailRows = [
    ['Email', pickString([activeCandidate?.email], 'Not provided'), 'mail'],
    ['Phone', pickString([activeCandidate?.phone], 'Not provided'), 'phone'],
    ['Date of birth', pickString([activeCandidate?.dateOfBirth ? formatDate(activeCandidate.dateOfBirth) : ''], 'Not provided'), 'calendar'],
    ['Gender', pickString([activeCandidate?.gender], 'Not provided'), 'user'],
    ['Age range', pickString([activeCandidate?.ageRange], 'Not provided'), 'users'],
    ['Location', pickString([activeCandidate?.location, activeCandidate?.country], 'Not provided'), 'map-pin'],
    ['Profession', pickString([activeCandidate?.profession], 'Not provided'), 'briefcase'],
    ['Qualification', pickString([activeCandidate?.qualification], 'Not provided'), 'award'],
    ['Experience', pickString([activeCandidate?.experience], 'Not provided'), 'trending-up'],
    ['Job interest', pickString([activeCandidate?.jobInterest], 'Not provided'), 'target'],
    ['Visa status', pickString([activeCandidate?.visaStatus], 'Not provided'), 'globe'],
  ] as const;

  const setField = useCallback((field: keyof CandidateForm, value: string) => setForm((prev) => ({ ...prev, [field]: value })), []);
  const startEdit = useCallback(() => {
    setForm(formFromCandidate(activeCandidate || null));
    setIsEditing(true);
  }, [activeCandidate]);
  const cancelEdit = useCallback(() => {
    setForm(formFromCandidate(activeCandidate || null));
    setIsEditing(false);
  }, [activeCandidate]);

  const saveProfile = useCallback(async () => {
    if (!activeCandidate?._id || !token || !storeUser) return Alert.alert('Unavailable', 'Managed candidate context is missing. Please reopen candidate view.');
    if (!form.name.trim() || !form.email.trim()) return Alert.alert('Missing details', 'Please provide the candidate name and email before saving.');
    if (!form.email.includes('@')) return Alert.alert('Invalid email', 'Please provide a valid email address.');
    setSaving(true);
    try {
      const payload = new FormData();
      (['name','email','phone','dateOfBirth','gender','ageRange','address','country','location','profession','qualification','experience','jobInterest','categories','skills','aboutMe','linkedin','github','visaStatus','status'] as Array<keyof CandidateForm>).forEach((field) => payload.append(field, String(form[field] || '').trim()));
      const response = await AgentCandidatesService.updateMultipart(activeCandidate._id, payload);
      const nextCandidate = normalizeCandidate(response);
      setCandidate(nextCandidate);
      setForm(formFromCandidate(nextCandidate));
      setIsEditing(false);
      await signIn({ token, user: buildManagedViewUser(stripManagedViewState(storeUser), nextCandidate) });
      Alert.alert('Saved', 'Managed candidate profile updated successfully.');
    } catch (err: any) {
      Alert.alert('Save failed', err?.response?.data?.message || err?.userMessage || err?.message || 'Failed to save the managed candidate profile.');
    } finally {
      setSaving(false);
    }
  }, [activeCandidate, form, signIn, storeUser, token]);

  if (!activeCandidate) {
    return <LinearGradient colors={['#F5F8FD', '#EEF4FB', '#F7FBFF']} style={styles.root}><Screen padded={false}><ScrollView contentContainerStyle={styles.content}><View style={styles.topBar}><Pressable onPress={handleBack} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}><Feather name="arrow-left" size={18} color="#1B3890" /></Pressable><View style={styles.topCopy}><Text style={styles.eyebrow}>Candidate profile</Text><Text style={styles.title}>My Profile</Text></View></View><View style={styles.emptyWrap}><EmptyState title="Candidate profile unavailable" message="Switch into a managed candidate from Agent Desk to view this profile." /></View></ScrollView></Screen></LinearGradient>;
  }

  return (
    <LinearGradient colors={['#F5F8FD', '#EEF4FB', '#F7FBFF']} style={styles.root}>
      <Screen padded={false}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <Pressable onPress={handleBack} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}><Feather name="arrow-left" size={18} color="#1B3890" /></Pressable>
            <View style={styles.topCopy}><Text style={styles.eyebrow}>Candidate profile</Text><Text style={styles.title}>My Profile</Text><Text style={styles.sub}>Manage and update your details in managed view.</Text></View>
            {!isEditing ? <Pressable onPress={startEdit} style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}><Feather name="edit-3" size={16} color="#FFFFFF" /></Pressable> : null}
          </View>

          <ManagedViewBanner candidateName={candidateName} subtitle="Profile details are loaded from the active managed candidate snapshot." onExit={exitManagedView} />

          <View style={styles.heroCard}>
            <View style={styles.heroRow}><View style={styles.heroPill}><Feather name="user-check" size={13} color="#1768B8" /><Text style={styles.heroPillText}>Managed profile</Text></View><View style={styles.heroPill}><Feather name={saving ? 'loader' : 'clock'} size={13} color={saving ? '#C7851D' : '#11856E'} /><Text style={[styles.heroSignalText, saving && styles.heroSignalTextSaving]}>{saving ? 'Saving' : 'Local'}</Text></View></View>
            <View style={styles.identityRow}><View style={styles.avatarWrap}><Feather name="user" size={34} color="#5E6F95" /></View><View style={styles.identityCopy}><Text style={styles.name}>{candidateName}</Text><Text style={styles.role}>{pickString([activeCandidate.profession], 'Career details pending')}</Text><View style={styles.joinedPill}><Feather name="calendar" size={12} color="#6880A6" /><Text style={styles.joinedText}>{`Joined ${formatDate(activeCandidate.addedAt || activeCandidate.lastUpdated) || 'Recent'}`}</Text></View></View></View>
            <View style={styles.metricRail}>{metrics.map((item) => <View key={item.key} style={styles.metricCard}><View style={[styles.metricIcon, { backgroundColor: item.bg }]}><Feather name={item.icon} size={12} color={item.color} /></View><Text style={[styles.metricValue, { color: item.color }]}>{item.value}</Text><Text style={styles.metricLabel}>{item.label}</Text></View>)}</View>
            <View style={styles.heroFooter}><View style={[styles.statusChip, { backgroundColor: tone.bg, borderColor: tone.border }]}><Feather name="shield" size={12} color={tone.text} /><Text style={[styles.statusChipText, { color: tone.text }]}>{pickString([activeCandidate.status], 'Pending')}</Text></View>{!isEditing ? <View style={styles.heroActions}><Pressable onPress={() => navigation.getParent()?.navigate('Applications' as never)} style={({ pressed }) => [styles.heroActionBtn, pressed && styles.pressed]}><Text style={styles.heroActionText}>Applications</Text></Pressable><Pressable onPress={() => navigation.getParent()?.navigate('Documents' as never)} style={({ pressed }) => [styles.heroActionBtn, pressed && styles.pressed]}><Text style={styles.heroActionText}>Documents</Text></Pressable></View> : <Text style={styles.heroHint}>This screen starts from the locally stored managed candidate and saves through the agent candidate route.</Text>}</View>
          </View>
          {!isEditing ? (
            <>
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Profile details</Text><View style={styles.sectionChip}><Feather name="layers" size={12} color="#1768B8" /><Text style={styles.sectionChipText}>{detailRows.length} fields</Text></View></View>
                <View style={styles.detailGrid}>{detailRows.map(([label, value, icon], index) => <View key={`${label}-${index}`} style={[styles.detailCard, index % 4 === 0 ? styles.detailCardBlue : index % 4 === 1 ? styles.detailCardLavender : index % 4 === 2 ? styles.detailCardMint : styles.detailCardGold]}><View style={styles.detailIcon}><Feather name={icon as any} size={15} color="#5D6E92" /></View><View style={styles.detailCopy}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View></View>)}</View>
              </View>
              <View style={styles.infoBlock}><Text style={styles.blockTitle}>About me</Text><Text style={styles.blockBody}>{pickString([activeCandidate.aboutMe], 'This profile opens from the managed candidate already stored in the active agent session, so it is fast but can reflect the latest selected snapshot rather than a fresh fetch.')}</Text></View>
              <View style={styles.infoBlock}><Text style={styles.blockTitle}>Career focus</Text><Text style={styles.blockMeta}>{`Job interest: ${pickString([activeCandidate.jobInterest], 'Not provided')}`}</Text><Text style={styles.blockMeta}>{`Skills: ${toCommaText(activeCandidate.skills) || 'Not provided'}`}</Text><Text style={styles.blockMeta}>{`Categories: ${toCommaText(activeCandidate.categories) || 'Not provided'}`}</Text></View>
              <View style={styles.infoBlock}><Text style={styles.blockTitle}>Social links</Text><Text style={styles.blockMeta}>{`LinkedIn: ${pickString([activeCandidate.socialNetworks?.linkedin], 'Not provided')}`}</Text><Text style={styles.blockMeta}>{`GitHub: ${pickString([activeCandidate.socialNetworks?.github], 'Not provided')}`}</Text></View>
            </>
          ) : (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Edit profile</Text>
                <Text style={styles.sectionSub}>This page starts from the cached managed candidate and saves back to `/agent/candidates/:candidateId`.</Text>
                <View style={styles.formRow}><View style={styles.formHalf}><Input label="Full name" value={form.name} onChangeText={(value) => setField('name', value)} placeholder="Candidate name" /></View><View style={styles.formHalf}><Input label="Phone" value={form.phone} onChangeText={(value) => setField('phone', value)} placeholder="Phone number" keyboardType="phone-pad" /></View></View>
                <Input label="Email" value={form.email} onChangeText={(value) => setField('email', value)} placeholder="Email" keyboardType="email-address" editable={false} />
                <View style={styles.formRow}><View style={styles.formHalf}><Input label="Date of birth" value={form.dateOfBirth} onChangeText={(value) => setField('dateOfBirth', value)} placeholder="YYYY-MM-DD" /></View><View style={styles.formHalf}><Input label="Location" value={form.location} onChangeText={(value) => setField('location', value)} placeholder="City or area" /></View></View>
                <View style={styles.formRow}><View style={styles.formHalf}><Input label="Country" value={form.country} onChangeText={(value) => setField('country', value)} placeholder="Country" /></View><View style={styles.formHalf}><Input label="Address" value={form.address} onChangeText={(value) => setField('address', value)} placeholder="Address" /></View></View>
                <ChoiceGroup label="Gender" value={form.gender} options={GENDER_OPTIONS} onChange={(value) => setField('gender', value)} />
                <ChoiceGroup label="Age range" value={form.ageRange} options={AGE_RANGE_OPTIONS} onChange={(value) => setField('ageRange', value)} />
              </View>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Professional details</Text>
                <View style={styles.formRow}><View style={styles.formHalf}><Input label="Profession" value={form.profession} onChangeText={(value) => setField('profession', value)} placeholder="Profession" /></View><View style={styles.formHalf}><Input label="Qualification" value={form.qualification} onChangeText={(value) => setField('qualification', value)} placeholder="Qualification" /></View></View>
                <View style={styles.formRow}><View style={styles.formHalf}><Input label="Experience" value={form.experience} onChangeText={(value) => setField('experience', value)} placeholder="Experience" /></View><View style={styles.formHalf}><Input label="Job interest" value={form.jobInterest} onChangeText={(value) => setField('jobInterest', value)} placeholder="Target role or industry" /></View></View>
                <Input label="Categories" value={form.categories} onChangeText={(value) => setField('categories', value)} placeholder="Comma separated categories" />
                <Input label="Skills" value={form.skills} onChangeText={(value) => setField('skills', value)} placeholder="Comma separated skills" />
                <Input label="About me" value={form.aboutMe} onChangeText={(value) => setField('aboutMe', value)} placeholder="Short candidate summary" multiline />
                <ChoiceGroup label="Visa status" value={form.visaStatus} options={VISA_OPTIONS} onChange={(value) => setField('visaStatus', value)} />
                <ChoiceGroup label="Profile status" value={form.status} options={STATUS_OPTIONS} onChange={(value) => setField('status', value)} />
              </View>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Social links</Text>
                <Input label="LinkedIn" value={form.linkedin} onChangeText={(value) => setField('linkedin', value)} placeholder="LinkedIn profile URL" />
                <Input label="GitHub" value={form.github} onChangeText={(value) => setField('github', value)} placeholder="GitHub profile URL" />
                <View style={styles.editorActions}><Pressable onPress={cancelEdit} style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}><Text style={styles.cancelBtnText}>Cancel</Text></Pressable><Pressable onPress={saveProfile} disabled={saving} style={({ pressed }) => [styles.saveBtn, (pressed || saving) && styles.pressed, saving && styles.disabled]}><LinearGradient colors={['#1B4AA3', '#1279C5']} style={styles.saveFill}><Feather name="save" size={16} color="#FFFFFF" /><Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Changes'}</Text></LinearGradient></Pressable></View>
              </View>
            </>
          )}
        </ScrollView>
      </Screen>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 140, gap: 12 },
  pressed: { opacity: 0.88 },
  topBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  backBtn: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#D1DEF3' },
  editBtn: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B3890' },
  topCopy: { flex: 1 },
  eyebrow: { color: '#7485A8', fontSize: 9, lineHeight: 11, letterSpacing: 1.1, textTransform: 'uppercase', fontWeight: '800' },
  title: { marginTop: 3, color: '#17326F', fontSize: 20, lineHeight: 24, fontWeight: '900' },
  sub: { marginTop: 4, color: '#5E7397', fontSize: 10, lineHeight: 14, fontWeight: '600' },
  emptyWrap: { paddingTop: 80 },
  heroCard: { borderRadius: 28, borderWidth: 1, borderColor: '#D6E2F3', backgroundColor: '#F9FBFE', padding: 16, overflow: 'hidden' },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E2F4' },
  heroPillText: { color: '#1768B8', fontSize: 9, lineHeight: 11, textTransform: 'uppercase', letterSpacing: 0.9, fontWeight: '800' },
  heroSignalText: { color: '#11856E', fontSize: 9, lineHeight: 11, fontWeight: '800' },
  heroSignalTextSaving: { color: '#C7851D' },
  identityRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarWrap: { width: 84, height: 84, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF2FF', borderWidth: 1, borderColor: '#D4E1F4' },
  identityCopy: { flex: 1 },
  name: { color: '#17326F', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  role: { marginTop: 4, color: '#5E7397', fontSize: 10, lineHeight: 13, fontWeight: '600' },
  joinedPill: { marginTop: 8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#F3F8FF', borderWidth: 1, borderColor: '#D8E6F8' },
  joinedText: { color: '#6880A6', fontSize: 9, lineHeight: 11, fontWeight: '700' },
  metricRail: { marginTop: 16, flexDirection: 'row', gap: 8 },
  metricCard: { flex: 1, minHeight: 68, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E2F4', justifyContent: 'center' },
  metricIcon: { width: 22, height: 22, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  metricValue: { fontSize: 15, lineHeight: 17, fontWeight: '900' },
  metricLabel: { marginTop: 4, color: '#667C98', fontSize: 9, lineHeight: 11, fontWeight: '600' },
  heroFooter: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1 },
  statusChipText: { fontSize: 10, lineHeight: 12, fontWeight: '800' },
  heroActions: { flexDirection: 'row', gap: 8 },
  heroActionBtn: { minHeight: 36, borderRadius: 14, paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E2F4', alignItems: 'center', justifyContent: 'center' },
  heroActionText: { color: '#1B4F9C', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  heroHint: { flex: 1, color: '#5F708C', fontSize: 11, lineHeight: 15, fontWeight: '600', textAlign: 'right' },
  sectionCard: { borderRadius: 24, borderWidth: 1, borderColor: '#D8E3F4', backgroundColor: 'rgba(249,251,254,0.95)', padding: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 },
  sectionTitle: { color: '#17326F', fontSize: 15, lineHeight: 18, fontWeight: '900' },
  sectionSub: { marginTop: 6, color: '#5F738F', fontSize: 11, lineHeight: 16, fontWeight: '600' },
  sectionChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#EEF5FF', borderWidth: 1, borderColor: '#D8E6F8' },
  sectionChipText: { color: '#1768B8', fontSize: 9, lineHeight: 11, fontWeight: '800' },
  detailGrid: { gap: 8 },
  detailCard: { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailCardBlue: { backgroundColor: '#EEF5FF', borderColor: '#D8E6F8' },
  detailCardLavender: { backgroundColor: '#F4EEFF', borderColor: '#E4D7FA' },
  detailCardMint: { backgroundColor: '#EAF9F6', borderColor: '#D2EEE7' },
  detailCardGold: { backgroundColor: '#FFF5E7', borderColor: '#F5E1BF' },
  detailIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.55)' },
  detailCopy: { flex: 1 },
  detailLabel: { color: '#687C98', fontSize: 9, lineHeight: 11, fontWeight: '600' },
  detailValue: { marginTop: 3, color: '#1A2F62', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  infoBlock: { borderRadius: 22, borderWidth: 1, borderColor: '#D8E3F4', backgroundColor: 'rgba(249,251,254,0.95)', padding: 14 },
  blockTitle: { color: '#17326F', fontSize: 13, lineHeight: 17, fontWeight: '900' },
  blockBody: { marginTop: 6, color: '#536986', fontSize: 10, lineHeight: 14, fontWeight: '600' },
  blockMeta: { marginTop: 6, color: '#6B7D98', fontSize: 10, lineHeight: 14, fontWeight: '600' },
  formRow: { flexDirection: 'row', gap: 10 },
  formHalf: { flex: 1 },
  choiceGroup: { marginBottom: 12 },
  fieldLabel: { marginBottom: 8, color: '#213049', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#F7FAFF', borderWidth: 1, borderColor: '#DCE7F6' },
  choiceChipActive: { backgroundColor: '#1B6FC1', borderColor: '#1B6FC1' },
  choiceChipText: { color: '#1D4F99', fontSize: 12, lineHeight: 15, fontWeight: '700' },
  choiceChipTextActive: { color: '#FFFFFF' },
  editorActions: { marginTop: 6, flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, minHeight: 50, borderRadius: 18, backgroundColor: '#F4F8FF', borderWidth: 1, borderColor: '#D8E4F6', alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: '#1D4F99', fontSize: 14, lineHeight: 18, fontWeight: '800' },
  saveBtn: { flex: 1.2, borderRadius: 18, overflow: 'hidden' },
  saveFill: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  saveText: { color: '#FFFFFF', fontSize: 14, lineHeight: 18, fontWeight: '800' },
  disabled: { opacity: 0.45 },
});




