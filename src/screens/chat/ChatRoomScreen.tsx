import React, { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Card, Screen } from '../../components/ui';
import { Radius } from '../../constants/theme';
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
  const { adminId } = route.params;
  const user = useAuthStore((s) => s.user);
  const myId = norm(user?._id || user?.id);

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
    <Screen padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList data={messages} keyExtractor={(it: any, idx) => it._id || `${idx}`} renderItem={renderItem} contentContainerStyle={{ padding: 16, paddingBottom: 90 }} />

        <View style={styles.composer}>
          <Card style={styles.composerCard}>
            <Pressable onPress={attach} disabled={uploading || sending} style={styles.attachBtn}>
              <Text style={[styles.attachText, { color: t.colors.primary }]}>{uploading ? '...' : '+'}</Text>
            </Pressable>
            <TextInput value={text} onChangeText={setText} placeholder="Type a message..." placeholderTextColor={t.colors.textMuted} style={[styles.input, { color: t.colors.text }]} />
            <Pressable onPress={() => send()} disabled={sending || uploading} style={[styles.sendBtn, { backgroundColor: t.colors.secondary }, (sending || uploading) && { opacity: 0.7 }]}>
              <Text style={styles.sendText}>{sending ? '...' : 'Send'}</Text>
            </Pressable>
          </Card>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubbleWrap: { marginBottom: 10 },
  bubble: { maxWidth: '82%', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, borderWidth: 1 },
  mine: { borderColor: 'rgba(255,255,255,0.22)' },
  theirs: { borderColor: 'rgba(15,121,197,0.16)' },
  bubbleText: { fontWeight: '700', lineHeight: 20 },
  attachment: { marginTop: 6, fontWeight: '800', fontSize: 12 },
  time: { marginTop: 6, fontWeight: '700', fontSize: 11 },
  composer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12 },
  composerCard: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: Radius.xl },
  attachBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(15,121,197,0.16)', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  attachText: { fontWeight: '900', fontSize: 18 },
  input: { flex: 1, paddingHorizontal: 10, paddingVertical: 10, fontWeight: '700' },
  sendBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  sendText: { color: 'white', fontWeight: '900' },
});
