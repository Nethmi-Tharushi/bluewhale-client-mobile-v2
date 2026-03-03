import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { EmptyState, Screen } from '../../components/ui';
import { ChatService } from '../../api/services';
import type { ChatAdmin } from '../../types/models';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatStackParamList } from '../../navigation/app/AppNavigator';
import { useTheme } from '../../theme/ThemeProvider';
import { Feather } from '@expo/vector-icons';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatList'>;

export default function ChatListScreen({ navigation }: Props) {
  const t = useTheme();
  const [items, setItems] = useState<ChatAdmin[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const filtered = items.filter((item) => {
    const name = String(item.fullName || item.name || '').toLowerCase();
    const email = String(item.email || '').toLowerCase();
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return name.includes(q) || email.includes(q);
  });

  const toInitials = (item: ChatAdmin) => {
    const label = String(item.fullName || item.name || 'S');
    const parts = label.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
    return (parts[0]?.slice(0, 2) || 'S').toUpperCase();
  };

  return (
    <Screen padded={false}>
      <FlatList
        contentContainerStyle={{ paddingBottom: 110, paddingHorizontal: 14 }}
        data={filtered}
        keyExtractor={(it, idx) => it._id || String(idx)}
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
          <View style={styles.headerWrap}>
            <Text style={[styles.heading, { color: t.colors.text }]}>Chats</Text>
            <Text style={[styles.sub, { color: t.colors.textMuted }]}>Message support team</Text>

            <View style={[styles.searchBox, { borderColor: t.colors.borderStrong, backgroundColor: t.colors.surface }]}>
              <Feather name="search" size={16} color={t.colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search"
                placeholderTextColor={t.colors.textMuted}
                style={[styles.searchInput, { color: t.colors.text }]}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon=" "
            title={loading ? 'Loading...' : 'No chats found'}
            message={loading ? 'Please wait' : 'If you have an assigned admin, they will appear here.'}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: t.colors.surface,
                borderColor: t.colors.border,
              },
              pressed && { opacity: 0.92 },
            ]}
            onPress={() =>
              navigation.navigate('ChatRoom', {
                adminId: (item as any)?.userId || (item as any)?.user?._id || (item as any)?.adminId || item._id,
                title: item.fullName || item.name || 'Support',
              })
            }
          >
            <View style={[styles.avatar, { backgroundColor: '#DFF2E2' }]}>
              <Text style={styles.avatarText}>{toInitials(item)}</Text>
            </View>
            <View style={styles.main}>
              <Text style={[styles.name, { color: t.colors.text }]} numberOfLines={1}>
                {item.fullName || item.name || 'Support'}
              </Text>
              <Text style={[styles.preview, { color: t.colors.textMuted }]} numberOfLines={1}>
                {item.email || item.role || 'Tap to start conversation'}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={t.colors.textMuted} />
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  heading: { fontSize: 30, fontWeight: '800' },
  sub: { marginTop: 2, fontSize: 13, fontWeight: '600' },
  searchBox: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 14,
  },
  row: {
    minHeight: 74,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0B5C2D',
  },
  main: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
  preview: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
  },
});

