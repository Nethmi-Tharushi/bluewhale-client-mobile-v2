import React, { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatService, UploadService } from '../../api/services';
import type { ChatMessage } from '../../types/models';
import { useAuthStore } from '../../context/authStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatStackParamList } from '../../navigation/app/AppNavigator';
import dayjs from 'dayjs';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatRoom'>;

const norm = (v: any) => {
  if (!v) return '';
  if (typeof v === 'object' && v._id) return String(v._id);
  if (typeof v === 'object' && v.id) return String(v.id);
  return String(v);
};

const pickMessageBody = (item: any) => {
  const direct = [item?.message, item?.text, item?.content, item?.body, item?.msg, item?.chatText];
  for (const v of direct) if (typeof v === 'string' && v.trim()) return v.trim();
  const nested = [item?.message?.text, item?.message?.message, item?.payload?.message, item?.payload?.text];
  for (const v of nested) if (typeof v === 'string' && v.trim()) return v.trim();
  return '';
};

const pickAttachmentUrl = (item: any) => {
  const direct = [item?.attachmentUrl, item?.attachment, item?.fileUrl, item?.file, item?.url];
  for (const v of direct) if (typeof v === 'string' && v.trim()) return v.trim();
  const nested = [item?.attachment?.url, item?.file?.url, item?.message?.attachmentUrl];
  for (const v of nested) if (typeof v === 'string' && v.trim()) return v.trim();
  return '';
};

const isMessageMine = (item: any, myId: string) => {
  const senderIdCandidates = [item?.sender, item?.senderId, item?.from, item?.userId, item?.user?._id, item?.user?.id].map(norm);
  if (senderIdCandidates.some((id) => id && myId && id === myId)) return true;
  const roleHints = [item?.senderRole, item?.fromRole, item?.role, item?.sender?.role, item?.from?.role].filter(Boolean).map((v: any) => String(v).toLowerCase());
  if (roleHints.some((r) => r.includes('user') || r.includes('candidate') || r.includes('client'))) return true;
  return item?.isMine === true || item?.mine === true || item?.fromMe === true || item?.isUser === true;
};

export default function ChatRoomScreen({ route, navigation }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { adminId, title, adminEmail, adminRole } = route.params;
  const user = useAuthStore((s) => s.user);
  const myId = norm(user?._id || user?.id);
  const salesAdminAvatar = require('../../../assets/sales_admin.png');
  const superAdminAvatar = require('../../../assets/super_admin.png');
  const roleHint = `${title || ''} ${adminEmail || ''} ${adminRole || ''}`.toLowerCase();
  const avatarSource = roleHint.includes('super') ? superAdminAvatar : salesAdminAvatar;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const timerRef = useRef<any>(null);

  const load = async () => {
    try {
      const res = await ChatService.messagesWithAdmin(adminId);
      const list = Array.isArray(res) ? res : (res as any)?.messages || [];
      // Inverted list expects newest items first to show latest message at the bottom.
      list.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setMessages(list);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 4000);
    return () => timerRef.current && clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId]);

  const send = async (payload?: { attachmentUrl?: string }) => {
    const msg = text.trim();
    if (!msg && !payload?.attachmentUrl) return;
    setSending(true);
    try {
      await ChatService.sendToAdmin(adminId, { message: msg, attachmentUrl: payload?.attachmentUrl });
      setText('');
      await load();
    } catch (e: any) {
      Alert.alert('Send failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setSending(false);
    }
  };

  const attach = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (res.canceled) return;
    const file = res.assets[0];
    setUploading(true);
    try {
      const uploaded = await UploadService.uploadFile({ uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
      const url = (uploaded as any)?.url || (uploaded as any)?.fileUrl || (uploaded as any)?.path;
      if (!url) throw new Error('Upload response did not include a URL.');
      await send({ attachmentUrl: url });
    } catch (e: any) {
      Alert.alert('Attachment failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setUploading(false);
    }
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const mine = isMessageMine(item, myId);
    const body = pickMessageBody(item);
    const attachmentUrl = pickAttachmentUrl(item);
    if (!body && !attachmentUrl) return null;
    return (
        <View style={[styles.bubbleWrap, mine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
        <View style={[styles.bubble, mine ? styles.mine : styles.theirs, mine ? { backgroundColor: t.colors.primary } : { backgroundColor: t.colors.surface, borderColor: t.colors.borderStrong }]}>
          {body ? <Text style={[styles.bubbleText, { color: mine ? 'white' : t.colors.text }]}>{body}</Text> : null}
          {attachmentUrl ? <Text style={[styles.attachment, { color: mine ? 'rgba(255,255,255,0.9)' : t.colors.primary }]}>Attachment: {attachmentUrl}</Text> : null}
          <Text style={[styles.time, { color: mine ? 'rgba(255,255,255,0.75)' : t.colors.textMuted }]}>{item.createdAt ? dayjs(item.createdAt).format('h:mm A') : ''}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.contactCard}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
            <Feather name="arrow-left" size={20} color="#1A347F" />
          </Pressable>
          <Image source={avatarSource} style={styles.avatar} />
          <View style={styles.contactMeta}>
            <Text style={styles.contactName}>{title || 'Sales User'}</Text>
            <Text style={styles.contactEmail}>{adminEmail || 'sales@gmail.com'}</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
        </View>
        <FlatList
          data={messages}
          keyExtractor={(it: any, idx) => it._id || `${idx}`}
          renderItem={renderItem}
          inverted
          contentContainerStyle={[styles.messagesContent, { paddingTop: insets.bottom + 170, paddingBottom: 12 }]}
          showsVerticalScrollIndicator={false}
        />
        <View style={[styles.composer, { bottom: insets.bottom + 96 }]}>
          <View style={styles.composerCard}>
            <Pressable onPress={attach} disabled={uploading || sending} style={styles.attachBtn}>
              <Feather name="paperclip" size={18} color="#2F78D7" />
            </Pressable>
            <View style={styles.inputWrap}>
              <TextInput value={text} onChangeText={setText} placeholder="Type a message..." placeholderTextColor="#5D6F96" style={styles.input} />
            </View>
            <Pressable onPress={() => send()} disabled={sending || uploading} style={({ pressed }) => [styles.sendBtnWrap, (sending || uploading || pressed) && { opacity: 0.8 }]}>
              <LinearGradient colors={['#1B3890', '#0F79C5']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.sendBtn}>
                <Text style={styles.sendText}>{sending ? '...' : 'Send'}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EEF3FB' },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#D5DEF3',
    backgroundColor: '#F8FAFC',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF2FF',
    borderWidth: 1,
    borderColor: '#D5DEF3',
    marginRight: 10,
  },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  contactMeta: { marginLeft: 10, flex: 1 },
  contactName: { color: '#111D3E', fontSize: 16, lineHeight: 20, fontWeight: '900' },
  contactEmail: { color: '#5B6E95', fontSize: 12, lineHeight: 16, fontWeight: '700', marginTop: 2 },
  onlineRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#5CC463', marginRight: 6 },
  onlineText: { color: '#5B6E95', fontWeight: '700', fontSize: 12, lineHeight: 16 },
  messagesContent: { paddingHorizontal: 14, paddingTop: 10 },
  bubbleWrap: { marginBottom: 8 },
  bubble: { maxWidth: '72%', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, borderWidth: 1 },
  mine: { borderColor: 'rgba(255,255,255,0.2)', borderTopRightRadius: 14 },
  theirs: { borderColor: '#D5DEF3', borderTopLeftRadius: 14 },
  bubbleText: { fontWeight: '700', lineHeight: 20, fontSize: 14 },
  attachment: { marginTop: 6, fontWeight: '700', fontSize: 11 },
  time: { marginTop: 6, fontWeight: '700', fontSize: 11 },
  composer: { position: 'absolute', left: 14, right: 14, bottom: 110 },
  composerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D5DEF3',
    backgroundColor: '#F8FAFC',
    shadowColor: '#5F82BA',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  attachBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#D5DEEB', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  inputWrap: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CAD4E7',
    backgroundColor: '#F7F8FC',
    justifyContent: 'center',
  },
  input: { paddingHorizontal: 14, paddingVertical: 10, fontWeight: '600', fontSize: 14, color: '#334A7D' },
  sendBtnWrap: { marginLeft: 8 },
  sendBtn: {
    minWidth: 68,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  sendText: { color: 'white', fontWeight: '800', fontSize: 14, lineHeight: 18 },
});
