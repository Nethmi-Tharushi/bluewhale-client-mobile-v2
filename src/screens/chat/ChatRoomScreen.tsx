import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatService } from '../../api/services';
import type { ChatMessage } from '../../types/models';
import { useAuthStore } from '../../context/authStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatStackParamList } from '../../navigation/app/AppNavigator';
import dayjs from 'dayjs';
import { useTheme } from '../../theme/ThemeProvider';
import { PageDecor } from '../../components/ui';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatRoom'>;
type MessageRow = { item: ChatMessage; showDay: boolean };

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

const attachmentLabel = (url: string) => {
  const clean = String(url || '').split('?')[0];
  const name = clean.split('/').pop() || 'Attachment';
  return name.length > 22 ? `${name.slice(0, 19)}...` : name;
};

const timeLabel = (value?: string) => {
  if (!value) return '';
  return dayjs(value).format('h:mm A');
};

const dayLabel = (value?: string) => {
  if (!value) return 'Today';
  const date = dayjs(value);
  if (date.isSame(dayjs(), 'day')) return 'Today';
  if (date.isSame(dayjs().subtract(1, 'day'), 'day')) return 'Yesterday';
  return date.format('MMM D');
};

export default function ChatRoomScreen({ route, navigation }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { width } = useWindowDimensions();
  const compact = width < 390;
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshingThread, setRefreshingThread] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const timerRef = useRef<any>(null);
  const listRef = useRef<FlatList<MessageRow> | null>(null);
  const contentHeightRef = useRef(0);
  const listHeightRef = useRef(0);

  const headerEntrance = useRef(new Animated.Value(0)).current;
  const composerEntrance = useRef(new Animated.Value(0)).current;
  const menuAnim = useRef(new Animated.Value(0)).current;
  const contactAnim = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const signal = useRef(new Animated.Value(0)).current;

  const threadTitle = title || 'Support User';
  const threadSubtitle = adminRole || adminEmail || 'Support admin';

  const load = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setRefreshingThread(true);
    try {
      const res = await ChatService.messagesWithAdmin(adminId);
      const list = Array.isArray(res) ? res : (res as any)?.messages || [];
      list.sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      setMessages(list);
    } catch {
      // ignore
    } finally {
      if (!opts?.silent) setRefreshingThread(false);
    }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => load({ silent: true }), 4000);
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [adminId]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerEntrance, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(composerEntrance, {
        toValue: 1,
        duration: 720,
        delay: 100,
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
          Animated.timing(drift, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(drift, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(sweep, { toValue: 1, duration: 2300, delay: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(signal, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(signal, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
    ];

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [composerEntrance, drift, headerEntrance, pulse, signal, sweep]);

  useEffect(() => {
    Animated.timing(menuAnim, {
      toValue: menuOpen ? 1 : 0,
      duration: menuOpen ? 170 : 130,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [menuAnim, menuOpen]);

  useEffect(() => {
    Animated.timing(contactAnim, {
      toValue: contactOpen ? 1 : 0,
      duration: contactOpen ? 220 : 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [contactAnim, contactOpen]);

  useEffect(() => {
    const onShow = (e: any) => {
      setKeyboardHeight(e?.endCoordinates?.height || 0);
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd?.({ animated: true });
      });
    };
    const onHide = () => setKeyboardHeight(0);
    const subWillShow = Keyboard.addListener('keyboardWillShow', onShow);
    const subDidShow = Keyboard.addListener('keyboardDidShow', onShow);
    const subWillHide = Keyboard.addListener('keyboardWillHide', onHide);
    const subDidHide = Keyboard.addListener('keyboardDidHide', onHide);
    return () => {
      subWillShow.remove();
      subDidShow.remove();
      subWillHide.remove();
      subDidHide.remove();
    };
  }, []);

  const send = async () => {
    const msg = text.trim();
    if (!msg) return;
    setSending(true);
    try {
      await ChatService.sendToAdmin(adminId, { message: msg });
      setText('');
      await load();
    } catch (e: any) {
      Alert.alert('Send failed', e?.userMessage || e?.message || 'Please try again');
    } finally {
      setSending(false);
    }
  };

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.46] });
  const driftY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const headerY = headerEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const composerY = composerEntrance.interpolate({ inputRange: [0, 1], outputRange: [26, 0] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-180, 320] });
  const menuScale = menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const menuTranslateY = menuAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });
  const contactScale = contactAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const contactTranslateY = contactAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  const signalScaleA = signal.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const signalScaleB = signal.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0.45] });
  const signalScaleC = signal.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });

  const scrollToLatest = () => {
    if (!messageRows.length) return;
    InteractionManager.runAfterInteractions(() => {
      const targetOffset = Math.max(contentHeightRef.current - listHeightRef.current, 0);
      listRef.current?.scrollToOffset?.({ offset: targetOffset, animated: true });
      setTimeout(() => {
        const settledOffset = Math.max(contentHeightRef.current - listHeightRef.current, 0);
        listRef.current?.scrollToOffset?.({ offset: settledOffset, animated: true });
      }, 180);
      setTimeout(() => {
        const finalOffset = Math.max(contentHeightRef.current - listHeightRef.current, 0);
        listRef.current?.scrollToOffset?.({ offset: finalOffset, animated: true });
      }, 360);
    });
  };

  const openThreadInfo = () => {
    setContactOpen(true);
  };

  const messageRows = useMemo(
    () =>
      messages.map((item, index) => ({
        item,
        showDay: index === 0 || dayLabel(item.createdAt) !== dayLabel(messages[index - 1]?.createdAt),
      })),
    [messages]
  );

  useEffect(() => {
    scrollToLatest();
  }, [messages.length]);

  const renderItem = ({ item: row, index }: { item: MessageRow; index: number }) => {
    const item = row.item;
    const mine = isMessageMine(item, myId);
    const body = pickMessageBody(item);
    const attachmentUrl = pickAttachmentUrl(item);
    if (!body && !attachmentUrl) return null;

    const bubbleY = composerEntrance.interpolate({ inputRange: [0, 1], outputRange: [16 + Math.min(index, 5) * 4, 0] });
    const bubbleOpacity = composerEntrance.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

    return (
      <Animated.View style={{ opacity: bubbleOpacity, transform: [{ translateY: bubbleY }] }}>
        {row.showDay ? (
          <View style={styles.dayWrap}>
            <View style={styles.dayPill}>
              <Text style={[styles.dayText, { fontFamily: t.typography.fontFamily.bold }]}>{dayLabel(item.createdAt)}</Text>
            </View>
          </View>
        ) : null}

        <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowTheirs]}>
          {!mine ? <Image source={avatarSource} style={styles.messageAvatar} /> : <View style={styles.messageSpacer} />}
          <View style={[styles.bubbleShell, mine ? styles.bubbleShellMine : styles.bubbleShellTheirs]}>
            <View
              style={[
                styles.bubble,
                mine ? styles.bubbleMine : styles.bubbleTheirs,
                compact && styles.bubbleCompact,
              ]}
            >
              {!mine ? (
                <Text style={[styles.senderName, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                  {threadTitle}
                </Text>
              ) : null}
              {body ? (
                <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs, { fontFamily: t.typography.fontFamily.medium }]}>
                  {body}
                </Text>
              ) : null}
              {attachmentUrl ? (
                <View style={[styles.attachmentChip, mine ? styles.attachmentChipMine : styles.attachmentChipTheirs]}>
                  <Feather name="paperclip" size={12} color={mine ? '#FFFFFF' : '#1768B8'} />
                  <Text
                    style={[
                      styles.attachmentText,
                      mine ? styles.attachmentTextMine : styles.attachmentTextTheirs,
                      { fontFamily: t.typography.fontFamily.bold },
                    ]}
                    numberOfLines={1}
                  >
                    {attachmentLabel(attachmentUrl)}
                  </Text>
                </View>
              ) : null}
              <Text style={[styles.time, mine ? styles.timeMine : styles.timeTheirs, { fontFamily: t.typography.fontFamily.medium }]}>
                {timeLabel(item.createdAt)}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  const messagesTopPadding = 126;
  const composerBottomSpacing = keyboardHeight > 0 ? Math.max(insets.bottom + 104, 120) : insets.bottom + tabBarHeight + 66;
  const messagesBottomPadding = keyboardHeight > 0 ? 18 : 12;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <PageDecor />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View pointerEvents="none" style={styles.chatAmbient}>
          <Animated.View style={[styles.chatAmbientOrbA, { transform: [{ translateY: driftY }] }]} />
          <Animated.View style={[styles.chatAmbientOrbB, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
        </View>
        {menuOpen ? <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} /> : null}
        {contactOpen ? <Pressable style={styles.contactBackdrop} onPress={() => setContactOpen(false)} /> : null}

        <Animated.View style={[styles.threadBarWrap, { opacity: headerEntrance, transform: [{ translateY: headerY }] }]}>
          <View style={styles.threadBar}>
            <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]} hitSlop={8}>
              <Feather name="arrow-left" size={20} color="#1A347F" />
            </Pressable>

            <Animated.View style={[styles.avatarOrb, { transform: [{ translateY: driftY }] }]}>
              <Animated.View style={[styles.avatarGlow, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
              <Image source={avatarSource} style={styles.avatar} />
            </Animated.View>

            <View style={styles.threadMeta}>
              <Text style={[styles.threadTitle, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                {threadTitle}
              </Text>
              <Text style={[styles.threadSubtitle, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                {threadSubtitle}
              </Text>
              <View style={styles.presenceRow}>
                <Animated.View style={[styles.presenceDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                <Text style={[styles.presenceText, { fontFamily: t.typography.fontFamily.bold }]}>Online now</Text>
                <Text style={[styles.presenceMeta, { fontFamily: t.typography.fontFamily.medium }]}>Secure thread</Text>
                <View style={styles.presenceBars}>
                  <Animated.View style={[styles.presenceBar, { transform: [{ scaleY: signalScaleA }] }]} />
                  <Animated.View style={[styles.presenceBar, styles.presenceBarMid, { transform: [{ scaleY: signalScaleB }] }]} />
                  <Animated.View style={[styles.presenceBar, styles.presenceBarTall, { transform: [{ scaleY: signalScaleC }] }]} />
                </View>
              </View>
            </View>

            <View style={styles.threadActionWrap}>
              <Pressable onPress={() => setMenuOpen((prev) => !prev)} style={({ pressed }) => [styles.threadAction, pressed && styles.pressed]}>
                <Feather name="more-horizontal" size={18} color="#45629D" />
              </Pressable>

              <Animated.View
                pointerEvents={menuOpen ? 'auto' : 'none'}
                style={[
                  styles.threadMenu,
                  {
                    opacity: menuAnim,
                    transform: [{ translateY: menuTranslateY }, { scale: menuScale }],
                  },
                ]}
              >
                <Pressable
                  style={({ pressed }) => [styles.threadMenuItem, pressed && styles.threadMenuItemPressed, refreshingThread && styles.threadMenuItemDisabled]}
                  disabled={refreshingThread}
                  onPress={async () => {
                    await load();
                    setMenuOpen(false);
                  }}
                >
                  <Feather name={refreshingThread ? 'loader' : 'refresh-cw'} size={14} color="#1768B8" />
                  <Text style={[styles.threadMenuText, { fontFamily: t.typography.fontFamily.bold }]}>
                    {refreshingThread ? 'Refreshing...' : 'Refresh thread'}
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.threadMenuItem, pressed && styles.threadMenuItemPressed]}
                  onPress={() => {
                    setMenuOpen(false);
                    setTimeout(scrollToLatest, 180);
                  }}
                >
                  <Feather name="corner-down-right" size={14} color="#11856E" />
                  <Text style={[styles.threadMenuText, { fontFamily: t.typography.fontFamily.bold }]}>Jump to latest</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.threadMenuItem, pressed && styles.threadMenuItemPressed]}
                  onPress={() => {
                    setMenuOpen(false);
                    openThreadInfo();
                  }}
                >
                  <Feather name="info" size={14} color="#7B57CF" />
                  <Text style={[styles.threadMenuText, { fontFamily: t.typography.fontFamily.bold }]}>View contact</Text>
                </Pressable>
              </Animated.View>
            </View>
          </View>
        </Animated.View>

        <View style={styles.chatBody}>
          <FlatList
            ref={listRef}
            style={styles.messagesList}
            data={messageRows}
            keyExtractor={(row: any, idx) => row.item._id || `${idx}`}
            renderItem={renderItem}
            onLayout={(e) => {
              listHeightRef.current = e.nativeEvent.layout.height;
            }}
            onContentSizeChange={(_, height) => {
              contentHeightRef.current = height;
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.messagesContent, { paddingTop: messagesTopPadding, paddingBottom: messagesBottomPadding }]}
            ListFooterComponent={<View style={{ height: 20 }} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyOrb} />
                <Text style={[styles.emptyTitle, { fontFamily: t.typography.fontFamily.bold }]}>{sending ? 'Sending...' : 'No messages yet'}</Text>
                <Text style={[styles.emptyBody, { fontFamily: t.typography.fontFamily.medium }]}>
                  Start the thread with your support admin. Messages and attachments will appear here.
                </Text>
              </View>
            }
          />

          <Animated.View style={[styles.composerWrap, { paddingBottom: composerBottomSpacing, opacity: composerEntrance, transform: [{ translateY: composerY }] }]}>
            <View style={styles.composerCard}>
              <Animated.View pointerEvents="none" style={[styles.composerSweep, { transform: [{ translateX: sweepX }, { rotate: '16deg' }] }]} />
              <View style={styles.inputWrap}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  onFocus={scrollToLatest}
                  placeholder="Write a message..."
                  placeholderTextColor="#6B7D98"
                  style={[styles.input, { fontFamily: t.typography.fontFamily.medium }]}
                  multiline
                  maxLength={800}
                />
              </View>

              <Pressable onPress={() => send()} disabled={sending} style={({ pressed }) => [styles.sendBtnWrap, (sending || pressed) && styles.pressed]}>
                <Animated.View style={[styles.sendHalo, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                <LinearGradient colors={t.colors.gradientButton as any} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.sendBtn}>
                  <Feather name="send" size={16} color="#FFFFFF" />
                </LinearGradient>
              </Pressable>
            </View>
          </Animated.View>
        </View>

        <Animated.View
          pointerEvents={contactOpen ? 'auto' : 'none'}
          style={[
            styles.contactPopupWrap,
            {
              opacity: contactAnim,
              transform: [{ translateY: contactTranslateY }, { scale: contactScale }],
            },
          ]}
        >
          <LinearGradient colors={['#F8FBFF', '#EEF6FF', '#F8FEFB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.contactPopup}>
            <View style={styles.contactGlowA} />
            <View style={styles.contactGlowB} />

            <View style={styles.contactPopupTop}>
              <View style={styles.contactBadge}>
                <Feather name="user-check" size={13} color="#1768B8" />
                <Text style={[styles.contactBadgeText, { fontFamily: t.typography.fontFamily.bold }]}>Support contact</Text>
              </View>
              <Pressable onPress={() => setContactOpen(false)} style={({ pressed }) => [styles.contactCloseBtn, pressed && styles.pressed]}>
                <Feather name="x" size={16} color="#42629D" />
              </Pressable>
            </View>

            <View style={styles.contactHero}>
              <LinearGradient colors={['#4C91FF', '#59D2D0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.contactAvatarRing}>
                <Image source={avatarSource} style={styles.contactAvatar} />
              </LinearGradient>
              <Text style={[styles.contactPopupTitle, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                {threadTitle}
              </Text>
              <Text style={[styles.contactPopupSubtitle, { fontFamily: t.typography.fontFamily.medium }]} numberOfLines={1}>
                {threadSubtitle}
              </Text>
              <View style={styles.contactStatusPill}>
                <Animated.View style={[styles.contactStatusDot, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                <Text style={[styles.contactStatusText, { fontFamily: t.typography.fontFamily.bold }]}>Live support available</Text>
              </View>
            </View>

            <View style={styles.contactInfoGrid}>
              <View style={[styles.contactInfoCard, styles.contactInfoCardBlue]}>
                <Feather name="mail" size={14} color="#1768B8" />
                <Text style={[styles.contactInfoLabel, { fontFamily: t.typography.fontFamily.medium }]}>Email</Text>
                <Text style={[styles.contactInfoValue, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                  {adminEmail || 'support@bluewhale.com'}
                </Text>
              </View>
              <View style={[styles.contactInfoCard, styles.contactInfoCardMint]}>
                <Feather name="briefcase" size={14} color="#11856E" />
                <Text style={[styles.contactInfoLabel, { fontFamily: t.typography.fontFamily.medium }]}>Role</Text>
                <Text style={[styles.contactInfoValue, { fontFamily: t.typography.fontFamily.bold }]} numberOfLines={1}>
                  {adminRole || 'Support admin'}
                </Text>
              </View>
            </View>

            <View style={styles.contactFooter}>
              <View style={styles.contactFooterLine} />
              <Text style={[styles.contactFooterText, { fontFamily: t.typography.fontFamily.medium }]}>
                This is your current chat contact for this thread.
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EEF3FB' },
  flex: { flex: 1 },
  chatBody: {
    flex: 1,
    paddingHorizontal: 14,
  },
  pressed: { opacity: 0.86 },
  chatAmbient: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  chatAmbientOrbA: {
    position: 'absolute',
    top: 180,
    right: -26,
    width: 138,
    height: 138,
    borderRadius: 69,
    backgroundColor: 'rgba(73, 146, 255, 0.08)',
  },
  chatAmbientOrbB: {
    position: 'absolute',
    bottom: 190,
    left: -34,
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: 'rgba(89, 210, 208, 0.08)',
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9,
  },
  contactBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 28, 58, 0.18)',
    zIndex: 11,
  },
  threadBarWrap: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    zIndex: 10,
  },
  threadBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D4E0F1',
    backgroundColor: 'rgba(249,251,254,0.96)',
    overflow: 'visible',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#D5E0F2',
  },
  avatarOrb: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  avatarGlow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(31, 202, 123, 0.18)',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  threadMeta: {
    flex: 1,
    marginLeft: 10,
  },
  threadTitle: {
    color: '#13285E',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  threadSubtitle: {
    marginTop: 2,
    color: '#617491',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
  },
  presenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  presenceDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#1FCA7B',
  },
  presenceText: {
    color: '#11856E',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  presenceMeta: {
    color: '#7A8AA0',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '600',
  },
  presenceBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    marginLeft: 2,
    height: 12,
  },
  presenceBar: {
    width: 3,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#86BEFF',
  },
  presenceBarMid: {
    height: 12,
    backgroundColor: '#4E9EFF',
  },
  presenceBarTall: {
    height: 14,
    backgroundColor: '#1FCA7B',
  },
  threadAction: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F7FD',
    borderWidth: 1,
    borderColor: '#D7E2F3',
  },
  threadActionWrap: {
    position: 'relative',
  },
  threadMenu: {
    position: 'absolute',
    top: 42,
    right: 0,
    width: 168,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D8E2F2',
    backgroundColor: 'rgba(249,251,254,0.98)',
    padding: 8,
    shadowColor: '#6483B7',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  threadMenuItem: {
    minHeight: 40,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  threadMenuItemPressed: {
    backgroundColor: '#F2F7FF',
  },
  threadMenuItemDisabled: {
    opacity: 0.7,
  },
  threadMenuText: {
    color: '#23407E',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  contactPopupWrap: {
    position: 'absolute',
    left: 22,
    right: 22,
    top: 138,
    zIndex: 12,
  },
  contactPopup: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#D7E3F4',
    padding: 16,
    overflow: 'hidden',
  },
  contactGlowA: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(76, 145, 255, 0.1)',
  },
  contactGlowB: {
    position: 'absolute',
    bottom: -36,
    left: -20,
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(89, 210, 208, 0.1)',
  },
  contactPopupTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  contactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#D8E6F8',
  },
  contactBadgeText: {
    color: '#1768B8',
    fontSize: 10,
    lineHeight: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '800',
  },
  contactCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#D7E2F3',
  },
  contactHero: {
    alignItems: 'center',
  },
  contactAvatarRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  contactAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
  },
  contactPopupTitle: {
    marginTop: 12,
    color: '#17326F',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  contactPopupSubtitle: {
    marginTop: 4,
    color: '#607490',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  contactStatusPill: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: '#EEF9F3',
    borderWidth: 1,
    borderColor: '#D5EEE2',
  },
  contactStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1FCA7B',
  },
  contactStatusText: {
    color: '#11856E',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  contactInfoGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  contactInfoCard: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
  },
  contactInfoCardBlue: {
    backgroundColor: '#EEF6FF',
    borderColor: '#D8E6F8',
  },
  contactInfoCardMint: {
    backgroundColor: '#EAF9F6',
    borderColor: '#D1EEE7',
  },
  contactInfoLabel: {
    marginTop: 6,
    color: '#6B7D98',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
  },
  contactInfoValue: {
    marginTop: 4,
    color: '#17326F',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  contactFooter: {
    marginTop: 14,
    alignItems: 'center',
  },
  contactFooterLine: {
    width: 46,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#D7E3F4',
  },
  contactFooterText: {
    marginTop: 8,
    color: '#6A7E99',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  messagesContent: {
    flexGrow: 1,
  },
  messagesList: {
    flex: 1,
  },
  dayWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  dayPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(249,251,254,0.92)',
    borderWidth: 1,
    borderColor: '#D8E3F3',
  },
  dayText: {
    color: '#6A7E99',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowTheirs: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    marginBottom: 2,
  },
  messageSpacer: {
    width: 28,
    marginRight: 8,
  },
  bubbleShell: {
    maxWidth: '80%',
  },
  bubbleShellMine: {
    alignItems: 'flex-end',
  },
  bubbleShellTheirs: {
    alignItems: 'flex-start',
  },
  bubble: {
    minWidth: 84,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  bubbleCompact: {
    maxWidth: '96%',
  },
  bubbleMine: {
    backgroundColor: '#1967BC',
    borderColor: 'rgba(255,255,255,0.14)',
    borderBottomRightRadius: 8,
  },
  bubbleTheirs: {
    backgroundColor: 'rgba(249,251,254,0.96)',
    borderColor: '#D7E2F3',
    borderBottomLeftRadius: 8,
  },
  senderName: {
    color: '#1768B8',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  bubbleTextMine: {
    color: '#FFFFFF',
  },
  bubbleTextTheirs: {
    color: '#213152',
  },
  attachmentChip: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1,
  },
  attachmentChipMine: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  attachmentChipTheirs: {
    backgroundColor: '#EEF6FF',
    borderColor: '#D7E6F8',
  },
  attachmentText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
    maxWidth: 170,
  },
  attachmentTextMine: {
    color: '#FFFFFF',
  },
  attachmentTextTheirs: {
    color: '#1768B8',
  },
  time: {
    marginTop: 6,
    alignSelf: 'flex-end',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '600',
  },
  timeMine: {
    color: 'rgba(255,255,255,0.78)',
  },
  timeTheirs: {
    color: '#7A8BA1',
  },
  emptyState: {
    marginTop: 150,
    marginHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D4E0F1',
    backgroundColor: 'rgba(249,251,254,0.95)',
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: 'center',
    overflow: 'hidden',
  },
  emptyOrb: {
    position: 'absolute',
    top: -26,
    right: -10,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(74, 146, 255, 0.08)',
  },
  emptyTitle: {
    color: '#223560',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  emptyBody: {
    marginTop: 4,
    color: '#617491',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  composerWrap: {
    paddingTop: 8,
  },
  composerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D5E0F2',
    backgroundColor: 'rgba(249,251,254,0.98)',
    overflow: 'hidden',
    shadowColor: '#6483B7',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  composerSweep: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 64,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  inputWrap: {
    flex: 1,
    minHeight: 46,
    maxHeight: 112,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D4DDEC',
    backgroundColor: '#F8FAFD',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  input: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: '#334A7D',
  },
  sendBtnWrap: {
    marginLeft: 8,
    position: 'relative',
  },
  sendHalo: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 19,
    backgroundColor: 'rgba(45, 144, 222, 0.18)',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});


