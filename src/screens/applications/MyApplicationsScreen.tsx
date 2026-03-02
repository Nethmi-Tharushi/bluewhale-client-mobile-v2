import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, EmptyState, ListItem, Screen } from '../../components/ui';
import { Spacing } from '../../constants/theme';
import { ApplicationsService } from '../../api/services';
import type { Application } from '../../types/models';
import { formatDate } from '../../utils/format';
import { useTheme } from '../../theme/ThemeProvider';

export default function MyApplicationsScreen() {
  const t = useTheme();
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await ApplicationsService.my();
      setItems(Array.isArray(res) ? res : (res as any)?.applications || []);
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
            <Text style={[styles.heading, { color: t.colors.primary }]}>My Applications</Text>
            <Text style={[styles.sub, { color: t.colors.textMuted }]}>Track status and review updates</Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="o"
            title={loading ? 'Loading...' : 'No applications yet'}
            message={loading ? 'Please wait' : 'Apply to jobs and your applications will appear here.'}
          />
        }
        renderItem={({ item }) => {
          const job: any = item.job;
          return (
            <Card style={{ marginBottom: Spacing.sm }}>
              <ListItem
                title={job?.title || 'Job application'}
                subtitle={job?.company || 'Company'}
                meta={`Submitted ${formatDate(item.createdAt) || 'recently'}`}
                right={<Badge text={item.status || 'Pending'} />}
              />
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 26, fontWeight: '900' },
  sub: { marginTop: 4, fontWeight: '700' },
});

