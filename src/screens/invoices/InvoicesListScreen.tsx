import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, EmptyState, ListItem, Screen } from '../../components/ui';
import { Spacing } from '../../constants/theme';
import { InvoicesService } from '../../api/services';
import type { Invoice } from '../../types/models';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InvoicesStackParamList } from '../../navigation/app/AppNavigator';
import { formatDate, money } from '../../utils/format';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<InvoicesStackParamList, 'InvoicesList'>;

export default function InvoicesListScreen({ navigation }: Props) {
  const t = useTheme();
  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await InvoicesService.list();
      setItems(Array.isArray(res) ? res : (res as any)?.invoices || []);
    } catch (e: any) {
      setItems([]);
      setError(e?.userMessage || e?.message || 'Unable to load invoices.');
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
        keyExtractor={(it, idx) => (it as any)?._id || (it as any)?.id || (it as any)?.invoiceNumber || String(idx)}
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
            <Text style={[styles.heading, { color: t.colors.primary }]}>Invoices</Text>
            <Text style={[styles.sub, { color: t.colors.textMuted }]}>Due dates, totals, and payment status</Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="o"
            title={loading ? 'Loading...' : 'No invoices'}
            message={loading ? 'Please wait' : error || 'Your invoices will appear here once created.'}
          />
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: Spacing.sm }}>
            <ListItem
              title={item.invoiceNumber ? `Invoice #${item.invoiceNumber}` : 'Invoice'}
              subtitle={`Due ${formatDate(item.dueDate) || '-'}`}
              meta={money(item.total, item.currency || 'LKR')}
              right={<Badge text={item.status || 'Pending'} />}
            />
            <View style={{ height: 10 }} />
            <Button
              title="Open invoice"
              onPress={() => navigation.navigate('InvoiceDetails', { invoiceId: (item as any)._id || (item as any).id, invoice: item })}
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

