import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ChatService, UploadService } from '../../api/services';
import { Screen } from '../../components/ui';
import { Feather } from '@expo/vector-icons';
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
  const user = useAuthStore((s) => s.user);
  const myId = norm(user?._id || user?.id);
  const { adminId, title } = route.params;
  const listRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const timerRef = useRef<any>(null);

  const screenTitle = useMemo(() => title || 'Support Chat', [title]);

  const load = async () => {
    try {
      const res = await ChatService.messagesWithAdmin(adminId);
      const list = Array.isArray(res) ? res : (res as any)?.messages || [];
      list.sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      setMessages(list);
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 4000);
    return () => timerRef.current && clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId]);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages]);

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

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { borderBottomColor: t.colors.border, backgroundColor: '#0B8A60' }]}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{screenTitle.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {screenTitle}
            </Text>
            <Text style={styles.headerSub}>online</Text>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(it: any, idx) => it._id || `${idx}`}
          contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
          style={{ backgroundColor: '#EDE5DD' }}
          renderItem={({ item }: { item: ChatMessage }) => {
            const mine = isMessageMine(item, myId);
            const body = pickMessageBody(item);
            const attachmentUrl = pickAttachmentUrl(item);
            if (!body && !attachmentUrl) return null;
            return (
              <View style={[styles.bubbleWrap, { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
                <View
                  style={[
                    styles.bubble,
                    mine
                      ? styles.mineBubble
                      : styles.theirBubble,
                  ]}
                >
                  {body ? <Text style={[styles.bubbleText, { color: mine ? '#FFFFFF' : t.colors.text }]}>{body}</Text> : null}
                  {attachmentUrl ? (
                    <Text style={[styles.attachment, { color: mine ? 'rgba(255,255,255,0.9)' : t.colors.primary }]}>
                      Attachment: {attachmentUrl}
                    </Text>
                  ) : null}
                  <Text style={[styles.time, { color: mine ? 'rgba(255,255,255,0.75)' : t.colors.textMuted }]}>
                    {item.createdAt ? dayjs(item.createdAt).format('h:mm A') : ''}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View style={[styles.composer, { borderTopColor: t.colors.border, backgroundColor: t.colors.surface }]}>
          <Pressable onPress={attach} disabled={uploading || sending} style={styles.attachBtn}>
            <Feather name="paperclip" size={18} color="#5E6A7D" />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor={t.colors.textMuted}
            style={[styles.input, { color: t.colors.text, borderColor: t.colors.borderStrong, backgroundColor: t.colors.background }]}
          />
          <Pressable
            onPress={() => send()}
            disabled={sending || uploading}
            style={[styles.sendBtn, { backgroundColor: '#0B8A60' }, (sending || uploading) && { opacity: 0.7 }]}
          >
            <Feather name="send" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#D7F3DE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerAvatarText: {
    fontWeight: '800',
    color: '#1E6F3A',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 1,
  },
  bubbleWrap: { marginBottom: 10 },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
  },
  mineBubble: {
    backgroundColor: '#DCF8C6',
    borderTopRightRadius: 2,
  },
  theirBubble: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 2,
  },
  bubbleText: {
    fontWeight: '500',
    lineHeight: 19,
    fontSize: 14,
  },
  attachment: {
    marginTop: 6,
    fontWeight: '700',
    fontSize: 12,
  },
  time: {
    marginTop: 4,
    fontWeight: '600',
    fontSize: 10,
    textAlign: 'right',
  },
  composer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attachBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 38,
    borderRadius: 18,
    borderWidth: 0,
    paddingHorizontal: 12,
    fontWeight: '600',
    fontSize: 14,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
