import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, ImageSourcePropType, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChatService } from '../../api/services';
import type { ChatAdmin } from '../../types/models';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatStackParamList } from '../../navigation/app/AppNavigator';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatList'>;

export default function ChatListScreen({ navigation }: Props) {
  const t = useTheme();
  const [items, setItems] = useState<ChatAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const avatarGradients = useMemo(
    () =>
      [
        ['#4F9CFF', '#67D0F4'],
        ['#57A9FF', '#7BD9F6'],
        ['#4D95FF', '#63C5FF'],
      ] as const,
    []
  );
  const salesAdminAvatar = require('../../../assets/sales_admin.png');
  const superAdminAvatar = require('../../../assets/super_admin.png');

  const resolveAvatar = (item: ChatAdmin, index: number): ImageSourcePropType => {
    const haystack = `${item.fullName || ''} ${item.name || ''} ${item.email || ''} ${item.role || ''}`.toLowerCase();
    if (haystack.includes('super')) return superAdminAvatar;
    if (haystack.includes('sales')) return salesAdminAvatar;
    return index % 2 === 0 ? salesAdminAvatar : superAdminAvatar;
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await ChatService.listAdmins();
      setItems(Array.isArray(res) ? res : (res as any)?.admins || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={styles.root}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={items}
        keyExtractor={(it) => it._id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.titleBlock}>
            <Text style={[styles.heading, { color: '#27439C' }]}>Chat Support</Text>
            <Text style={[styles.sub, { color: '#5E6F95' }]}>Talk to your assigned admin</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{loading ? 'Loading...' : 'No admins found'}</Text>
            <Text style={styles.emptyBody}>{loading ? 'Please wait' : 'If you have an assigned admin, they will appear here.'}</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.outerCard}>
            <View style={styles.innerCard}>
              <View style={styles.row}>
                <LinearGradient colors={avatarGradients[index % avatarGradients.length]} start={{ x: 0, y: 0.1 }} end={{ x: 1, y: 1 }} style={styles.avatarWrap}>
                  <Image source={resolveAvatar(item, index)} style={styles.avatarImage} resizeMode="cover" />
                </LinearGradient>
                <View style={styles.meta}>
                  <Text style={[styles.name, { color: t.colors.text }]} numberOfLines={1}>
                    {item.fullName || item.name || 'Support User'}
                  </Text>
                  <Text style={styles.email} numberOfLines={1}>
                    {item.email || item.role || 'admin@gmail.com'}
                  </Text>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [styles.chatButtonWrap, pressed && { opacity: 0.9 }]}
                accessibilityRole="button"
                accessibilityLabel={`Open chat with ${item.fullName || item.name || 'support'}`}
                onPress={() =>
                  navigation.navigate('ChatRoom', {
                    adminId: (item as any)?.userId || (item as any)?.user?._id || (item as any)?.adminId || item._id,
                    title: item.fullName || item.name || 'Chat',
                    adminEmail: item.email || '',
                    adminRole: item.role || '',
                  })
                }
              >
                <LinearGradient colors={['#1B3890', '#0F79C5']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.chatButton}>
                  <Text style={styles.chatButtonText}>Open chat</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#D9E0EE' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 150 },
  titleBlock: { marginBottom: 8, paddingHorizontal: 6 },
  heading: { fontSize: 56 / 2, fontWeight: '900', letterSpacing: 0.2 },
  sub: { marginTop: 8, fontWeight: '700', fontSize: 22 / 2 * 1.8 },
  outerCard: {
    marginTop: 16,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1.5,
    borderColor: '#C8D5EE',
    padding: 14,
    shadowColor: '#3D5EA8',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  innerCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#C4D0E8',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatarWrap: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  meta: { marginLeft: 14, flex: 1 },
  name: { fontSize: 21 / 1.2, fontWeight: '900' },
  email: { marginTop: 4, fontSize: 18 / 1.15, fontWeight: '700', color: '#5C6E92' },
  chatButtonWrap: { width: '100%' },
  chatButton: {
    minHeight: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  chatButtonText: { color: '#F4FAFF', fontSize: 17, lineHeight: 21, fontWeight: '800' },
  emptyCard: {
    marginTop: 26,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#C6D2E8',
    backgroundColor: 'rgba(255,255,255,0.66)',
    padding: 18,
  },
  emptyTitle: { color: '#263966', fontWeight: '800', fontSize: 18, marginBottom: 4 },
  emptyBody: { color: '#5C6E92', fontSize: 14, fontWeight: '600' },
});

