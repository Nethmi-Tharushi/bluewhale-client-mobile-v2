import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, EmptyState, ListItem, Screen } from '../../components/ui';
import { Spacing } from '../../constants/theme';
import { InquiriesService } from '../../api/services';
import type { Inquiry } from '../../types/models';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InquiryStackParamList } from '../../navigation/app/AppNavigator';
import { formatDate } from '../../utils/format';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<InquiryStackParamList, 'InquiryList'>;

export default function InquiryListScreen({ navigation }: Props) {
  const t = useTheme();
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await InquiriesService.listMine();
      setItems(Array.isArray(res) ? res : (res as any)?.inquiries || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation]);

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
            <Text style={[styles.heading, { color: t.colors.primary }]}>My Inquiries</Text>
            <Text style={[styles.sub, { color: t.colors.textMuted }]}>Questions and support updates</Text>
            <View style={{ height: 10 }} />
            <Button title="Create inquiry" onPress={() => navigation.navigate('CreateInquiry', {})} />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="o"
            title={loading ? 'Loading...' : 'No inquiries'}
            message={loading ? 'Please wait' : 'Create an inquiry from a job or start one here.'}
          />
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: Spacing.sm }}>
            <ListItem
              title={item.subject || item.category || 'Inquiry'}
              subtitle={item.message || ''}
              meta={`Created ${formatDate(item.createdAt) || 'recently'}`}
              right={<Badge text={item.status || 'Open'} />}
            />
            <View style={{ height: 10 }} />
            <Button title="Open details" onPress={() => navigation.navigate('InquiryDetails', { inquiryId: item._id })} variant="outline" />
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

