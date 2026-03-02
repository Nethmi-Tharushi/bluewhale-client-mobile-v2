import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button, Card, EmptyState, ListItem, Screen } from '../../components/ui';
import { Spacing } from '../../constants/theme';
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
    <Screen>
      <FlatList
        contentContainerStyle={{ paddingBottom: 120 }}
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
          <View style={{ marginBottom: Spacing.sm }}>
            <Text style={[styles.heading, { color: t.colors.primary }]}>Chat Support</Text>
            <Text style={[styles.sub, { color: t.colors.textMuted }]}>Talk to your assigned admin</Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="o"
            title={loading ? 'Loading...' : 'No admins found'}
            message={loading ? 'Please wait' : 'If you have an assigned admin, they will appear here.'}
          />
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: Spacing.sm }}>
            <ListItem title={item.fullName || item.name || 'Support'} subtitle={item.email || item.role || 'Admin'} />
            <View style={{ height: 10 }} />
            <Button
              title="Open chat"
              onPress={() =>
                navigation.navigate('ChatRoom', {
                  adminId: (item as any)?.userId || (item as any)?.user?._id || (item as any)?.adminId || item._id,
                  title: item.fullName || item.name || 'Chat',
                })
              }
            />
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 26, fontWeight: '900' },
  sub: { marginTop: 4, fontWeight: '700' },
});

