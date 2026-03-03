import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Badge, EmptyState, Screen } from '../../components/ui';
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
      <Screen padded={false}>
        <EmptyState title="Inquiry not found" message="It may have been removed or you do not have access." icon="o" />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerWrap}>
          <Text style={[styles.pageTitle, { color: t.colors.primary }]}>Inquiry Details</Text>
          <Text style={styles.pageSub}>Track your inquiry and replies from support</Text>
        </View>

        <View style={styles.outerCard}>
          <View style={styles.innerCard}>
            <View style={styles.topRow}>
              <View style={styles.iconWrap}>
                <Feather name="help-circle" size={24} color="#2574CA" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.title, { color: '#111D3E' }]} numberOfLines={2}>
                  {item?.subject || item?.category || 'Inquiry'}
                </Text>
                <Text style={[styles.meta, { color: '#5C6E92' }]}>Created {formatDate(item?.createdAt) || '-'}</Text>
              </View>
              <Badge text={item?.status || (loading ? 'Loading...' : 'Open')} />
            </View>

            <View style={styles.block}>
              <Text style={[styles.h, { color: t.colors.primary }]}>Message</Text>
              <Text style={[styles.p, { color: t.colors.text }]}>{item?.message || ''}</Text>
            </View>

            <View style={styles.block}>
              <Text style={[styles.h, { color: t.colors.primary }]}>Replies</Text>
              {(item?.replies || []).length ? (
                (item?.replies || []).map((r, idx) => (
                  <View key={idx} style={styles.reply}>
                    <Text style={[styles.replyBy, { color: t.colors.primary }]}>{r.by || 'Support'}</Text>
                    <Text style={[styles.replyMsg, { color: t.colors.text }]}>{r.message}</Text>
                    <Text style={[styles.replyTime, { color: '#5C6E92' }]}>{r.createdAt ? formatDate(r.createdAt) : ''}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.p, { color: t.colors.text }]}>No replies yet.</Text>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 130 },
  headerWrap: { marginBottom: 10 },
  pageTitle: { fontSize: 28, fontWeight: '900' },
  pageSub: { marginTop: 4, color: '#5E6F95', fontWeight: '700', fontSize: 16 },
  outerCard: {
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1.5,
    borderColor: '#C8D5EE',
    padding: 12,
    shadowColor: '#3D5EA8',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  innerCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#C4D0E8',
    backgroundColor: 'rgba(255,255,255,0.5)',
    padding: 14,
  },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C9D8F0',
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '900' },
  meta: { marginTop: 6, fontWeight: '700' },
  block: { marginTop: 14 },
  h: { fontWeight: '900', marginBottom: 8, fontSize: 18 },
  p: { fontWeight: '700', lineHeight: 22 },
  reply: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: 14,
    backgroundColor: '#EAF2FF',
    borderWidth: 1,
    borderColor: '#C9D8F0',
  },
  replyBy: { fontWeight: '900' },
  replyMsg: { marginTop: 6, fontWeight: '700', lineHeight: 20 },
  replyTime: { marginTop: 6, fontWeight: '700', fontSize: 12 },
});

