import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, ImageSourcePropType, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
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
            <Text style={[styles.sub, { color: '#5E6F95' }]}>Talk with your support admin</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EEF3FB' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 130 },
  titleBlock: { marginTop: 30, marginBottom: 6, paddingHorizontal: 2 },
  heading: { fontSize: 24, lineHeight: 30, fontWeight: '900', letterSpacing: 0.2 },
  sub: { marginTop: 4, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  outerCard: {
    marginTop: 12,
    borderRadius: 22,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D5DEF3',
    padding: 12,
    shadowColor: '#5F82BA',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  innerCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D3DEF3',
    padding: 12,
    backgroundColor: '#F8FAFC',
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  meta: { marginLeft: 12, flex: 1 },
  name: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  email: { marginTop: 3, fontSize: 13, lineHeight: 17, fontWeight: '700', color: '#5C6E92' },
  chatButtonWrap: { width: '100%' },
  chatButton: {
    minHeight: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  chatButtonText: { color: '#F4FAFF', fontSize: 15, lineHeight: 19, fontWeight: '800' },
  emptyCard: {
    marginTop: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C6D2E8',
    backgroundColor: 'rgba(255,255,255,0.66)',
    padding: 14,
  },
  emptyTitle: { color: '#263966', fontWeight: '800', fontSize: 16, marginBottom: 4 },
  emptyBody: { color: '#5C6E92', fontSize: 13, lineHeight: 18, fontWeight: '600' },
});

