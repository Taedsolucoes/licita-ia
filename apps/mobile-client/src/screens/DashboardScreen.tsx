import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { opportunitiesApi } from '../services/api';
import { Colors } from '../theme/colors';
import { OpportunityCard, OpportunityCardData } from '../components/OpportunityCard';
import { SkeletonCard } from '../components/SkeletonCard';
import type { RootStackParamList } from '../types/navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export function DashboardScreen() {
  const navigation = useNavigation<NavProp>();
  const [opportunities, setOpportunities] = useState<OpportunityCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchOpportunities = useCallback(async (pageNum = 1, replace = false) => {
    try {
      const { data } = await opportunitiesApi.list({ page: pageNum, limit: 20 });
      const items: OpportunityCardData[] = data.data ?? data ?? [];
      if (replace) {
        setOpportunities(items);
      } else {
        setOpportunities((prev) => [...prev, ...items]);
      }
      setHasMore(items.length === 20);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar as oportunidades.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOpportunities(1, true);
  }, [fetchOpportunities]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    fetchOpportunities(1, true);
  }, [fetchOpportunities]);

  const onEndReached = useCallback(() => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchOpportunities(next, false);
  }, [hasMore, loading, page, fetchOpportunities]);

  const handleParticipate = useCallback(async (id: string) => {
    try {
      await opportunitiesApi.participate(id);
      setOpportunities((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: 'accepted' } : o))
      );
      Alert.alert('Sucesso', 'Participação registrada! A TAED foi notificada.');
    } catch {
      Alert.alert('Erro', 'Não foi possível registrar a participação.');
    }
  }, []);

  const handleDecline = useCallback(async (id: string) => {
    try {
      await opportunitiesApi.decline(id);
      setOpportunities((prev) => prev.filter((o) => o.id !== id));
    } catch {
      Alert.alert('Erro', 'Não foi possível registrar o declínio.');
    }
  }, []);

  const handlePress = useCallback(
    (id: string) => {
      navigation.navigate('OpportunityDetail', { opportunityId: id });
    },
    [navigation]
  );

  function renderEmpty() {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>Nenhuma oportunidade</Text>
        <Text style={styles.emptyText}>
          Você não possui oportunidades no momento. Puxe para baixo para atualizar.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={loading ? [] : opportunities}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <OpportunityCard
            opportunity={item}
            onParticipate={handleParticipate}
            onDecline={handleDecline}
            onPress={handlePress}
          />
        )}
        ListHeaderComponent={
          loading ? (
            <View>
              {[1, 2, 3].map((k) => (
                <SkeletonCard key={k} />
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.success]}
            tintColor={Colors.primary}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
});
