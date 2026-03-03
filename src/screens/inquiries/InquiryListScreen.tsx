import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Badge, Button, EmptyState, Screen } from '../../components/ui';
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
    <Screen padded={false}>
      <FlatList
        contentContainerStyle={styles.content}
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
          <View style={styles.headerWrap}>
            <Text style={[styles.heading, { color: '#1B3890' }]}>My Inquiries</Text>
            <Text style={[styles.sub, { color: '#5E6F95' }]}>Questions and support updates</Text>
            <View style={styles.createWrap}>
              <Button title="Create inquiry" onPress={() => navigation.push('CreateInquiry', { jobId: '' })} />
            </View>
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
          <View style={styles.outerCard}>
            <View style={styles.innerCard}>
              <View style={styles.topRow}>
                <View style={styles.iconWrap}>
                  <Feather name="help-circle" size={24} color="#2574CA" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.title, { color: '#111D3E' }]} numberOfLines={1}>
                    {item.subject || item.category || 'Inquiry'}
                  </Text>
                  <Text style={styles.metaText}>{`Created ${formatDate(item.createdAt) || 'recently'}`}</Text>
                </View>
                <Badge text={item.status || 'Open'} />
              </View>

              {item.message ? (
                <Text style={styles.message} numberOfLines={2}>
                  {item.message}
                </Text>
              ) : null}

              <View style={{ height: 10 }} />
              <Button title="Open details" onPress={() => navigation.navigate('InquiryDetails', { inquiryId: item._id })} variant="outline" />
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 130 },
  headerWrap: { marginBottom: Spacing.sm },
  heading: { fontSize: 28, fontWeight: '900' },
  sub: { marginTop: 4, fontWeight: '700', fontSize: 16 },
  createWrap: { marginTop: 12 },
  outerCard: {
    marginBottom: 12,
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
  title: { fontSize: 20, fontWeight: '900' },
  metaText: { marginTop: 3, color: '#5C6E92', fontSize: 14, fontWeight: '700' },
  message: { marginTop: 10, color: '#2A3B61', fontSize: 15, lineHeight: 21, fontWeight: '600' },
});

