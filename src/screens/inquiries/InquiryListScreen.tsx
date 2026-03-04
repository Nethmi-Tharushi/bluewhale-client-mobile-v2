import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
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
            <View style={styles.headerRow}>
              <Pressable
                onPress={() => navigation.canGoBack() && navigation.goBack()}
                style={[styles.backBtn, !navigation.canGoBack() && styles.backBtnHidden]}
                disabled={!navigation.canGoBack()}
              >
                <Feather name="arrow-left" size={18} color="#1B3890" />
              </Pressable>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.heading, { color: '#1B3890' }]}>My Inquiries</Text>
                <Text style={[styles.sub, { color: '#5E6F95' }]}>Questions and support updates</Text>
              </View>
            </View>
            <View style={styles.createWrap}>
              <Button title="Create inquiry" size="sm" onPress={() => navigation.push('CreateInquiry', { jobId: '' })} />
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
          <Pressable
            onPress={() => navigation.navigate('InquiryDetails', { inquiryId: item._id })}
            style={({ pressed }) => [styles.inquiryCard, pressed && styles.inquiryCardPressed]}
          >
            <View style={styles.topRow}>
              <View style={styles.iconWrap}>
                <Feather name="help-circle" size={20} color="#2574CA" />
              </View>
              <View style={styles.titleBlock}>
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

            <View style={styles.actionsRow}>
              <View style={styles.tapHint}>
                <Feather name="arrow-up-right" size={14} color="#5D7BBE" />
                <Text style={styles.tapHintText}>Tap card to open</Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 130 },
  headerWrap: { marginBottom: Spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF2FF',
    borderWidth: 1,
    borderColor: '#C9D8F0',
    marginRight: 8,
  },
  backBtnHidden: { opacity: 0 },
  headerTextWrap: { flex: 1 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  sub: { marginTop: 3, fontWeight: '700', fontSize: 12, lineHeight: 16 },
  createWrap: { marginTop: 8 },
  inquiryCard: {
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D5DEF3',
    padding: 10,
    shadowColor: '#5F82BA',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  inquiryCardPressed: {
    backgroundColor: '#EEF4FE',
    borderColor: '#BED2F1',
  },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C9D8F0',
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  title: { fontSize: 16, lineHeight: 20, fontWeight: '900' },
  metaText: { marginTop: 2, color: '#5C6E92', fontSize: 12, fontWeight: '700' },
  message: { marginTop: 8, color: '#2A3B61', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  actionsRow: {
    marginTop: 10,
    gap: 8,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tapHintText: {
    color: '#5D7BBE',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
});
