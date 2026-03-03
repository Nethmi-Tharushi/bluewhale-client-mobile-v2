import React, { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
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

export default function ChatRoomScreen({ route }: Props) {
  const t = useTheme();
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
      list.sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
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
    <View style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.contactCard}>
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
        <FlatList data={messages} keyExtractor={(it: any, idx) => it._id || `${idx}`} renderItem={renderItem} contentContainerStyle={styles.messagesContent} />
        <View style={styles.composer}>
          <View style={styles.composerCard}>
            <Pressable onPress={attach} disabled={uploading || sending} style={styles.attachBtn}>
              <Text style={styles.attachText}>{uploading ? '...' : '+'}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#D9E0EE' },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#C9D5EC',
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  avatar: { width: 102, height: 102, borderRadius: 51 },
  contactMeta: { marginLeft: 14, flex: 1 },
  contactName: { color: '#111D3E', fontSize: 25 / 1.2, fontWeight: '900' },
  contactEmail: { color: '#5B6E95', fontSize: 18 / 1.15, fontWeight: '700', marginTop: 6 },
  onlineRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
  onlineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#5CC463', marginRight: 8 },
  onlineText: { color: '#5B6E95', fontWeight: '700', fontSize: 18 / 1.2 },
  messagesContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 200 },
  bubbleWrap: { marginBottom: 12 },
  bubble: { maxWidth: '62%', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 22, borderWidth: 1 },
  mine: { borderColor: 'rgba(255,255,255,0.2)', borderTopRightRadius: 14 },
  theirs: { borderColor: '#B9C9E8', borderTopLeftRadius: 14 },
  bubbleText: { fontWeight: '800', lineHeight: 24, fontSize: 20 / 1.3 },
  attachment: { marginTop: 8, fontWeight: '800', fontSize: 12 },
  time: { marginTop: 8, fontWeight: '700', fontSize: 14 / 1.2 },
  composer: { position: 'absolute', left: 14, right: 14, bottom: 110 },
  composerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#C9D5EA',
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#4A68A8',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  attachBtn: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#D5DEEB', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  attachText: { color: '#2F78D7', fontWeight: '900', fontSize: 38 / 1.3, marginTop: -2 },
  inputWrap: {
    flex: 1,
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CAD4E7',
    backgroundColor: '#F7F8FC',
    justifyContent: 'center',
  },
  input: { paddingHorizontal: 18, paddingVertical: 12, fontWeight: '700', fontSize: 17, color: '#334A7D' },
  sendBtnWrap: { marginLeft: 10 },
  sendBtn: {
    minWidth: 86,
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  sendText: { color: 'white', fontWeight: '800', fontSize: 17, lineHeight: 21 },
});
