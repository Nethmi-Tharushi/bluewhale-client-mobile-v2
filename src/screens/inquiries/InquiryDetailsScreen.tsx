import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, EmptyState, Screen } from '../../components/ui';
import { Spacing } from '../../constants/theme';
import { InquiriesService } from '../../api/services';
import type { Inquiry } from '../../types/models';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InquiryStackParamList } from '../../navigation/app/AppNavigator';
import { formatDate } from '../../utils/format';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<InquiryStackParamList, 'InquiryDetails'>;

export default function InquiryDetailsScreen({ route }: Props) {
  const t = useTheme();
  const { inquiryId } = route.params;
  const [item, setItem] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await InquiriesService.listMine();
        const list = Array.isArray(res) ? res : (res as any)?.inquiries || [];
        const found = list.find((x: any) => x._id === inquiryId);
        setItem(found || null);
      } catch {
        setItem(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [inquiryId]);

  if (!item && !loading) {
    return (
      <Screen>
        <EmptyState title="Inquiry not found" message="It may have been removed or you do not have access." icon="o" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Card>
          <Text style={[styles.title, { color: t.colors.primary }]}>{item?.subject || item?.category || 'Inquiry'}</Text>
          <Text style={[styles.meta, { color: t.colors.textMuted }]}>Created {formatDate(item?.createdAt) || '-'}</Text>
          <View style={{ height: 10 }} />
          <Badge text={item?.status || (loading ? 'Loading...' : 'Open')} />

          <View style={{ height: 14 }} />
          <Text style={[styles.h, { color: t.colors.primary }]}>Message</Text>
          <Text style={[styles.p, { color: t.colors.text }]}>{item?.message || ''}</Text>

          <View style={{ height: 14 }} />
          <Text style={[styles.h, { color: t.colors.primary }]}>Replies</Text>
          {(item?.replies || []).length ? (
            (item?.replies || []).map((r, idx) => (
              <View key={idx} style={[styles.reply, { backgroundColor: t.isDark ? 'rgba(39,163,240,0.14)' : 'rgba(15,121,197,0.08)', borderColor: t.isDark ? 'rgba(67,198,255,0.35)' : 'rgba(15,121,197,0.2)' }]}>
                <Text style={[styles.replyBy, { color: t.colors.primary }]}>{r.by || 'Support'}</Text>
                <Text style={[styles.replyMsg, { color: t.colors.text }]}>{r.message}</Text>
                <Text style={[styles.replyTime, { color: t.colors.textMuted }]}>{r.createdAt ? formatDate(r.createdAt) : ''}</Text>
              </View>
            ))
          ) : (
            <Text style={[styles.p, { color: t.colors.text }]}>No replies yet.</Text>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '900' },
  meta: { marginTop: 6, fontWeight: '700' },
  h: { fontWeight: '900', marginBottom: 6, fontSize: 16 },
  p: { fontWeight: '700', lineHeight: 22 },
  reply: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: 14,
    backgroundColor: 'rgba(15,121,197,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(15,121,197,0.2)',
  },
  replyBy: { fontWeight: '900' },
  replyMsg: { marginTop: 6, fontWeight: '700', lineHeight: 20 },
  replyTime: { marginTop: 6, fontWeight: '700', fontSize: 12 },
});

