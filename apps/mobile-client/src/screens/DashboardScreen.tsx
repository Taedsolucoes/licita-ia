import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { opportunitiesApi, OpportunitiesListParams } from '../services/api';
import { Colors } from '../theme/colors';
import { OpportunityCard, OpportunityCardData } from '../components/OpportunityCard';
import { SkeletonCard } from '../components/SkeletonCard';
import type { RootStackParamList, MainTabParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Dashboard'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Stats {
  total: number;
  participating: number;
  declined: number;
}

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'Todas', value: '' },
  { label: 'Pendentes', value: 'pending' },
  { label: 'Participando', value: 'accepted' },
  { label: 'Declinadas', value: 'declined' },
];

function getTotal(res: { data: unknown }): number {
  const d = res.data as Record<string, unknown> | null;
  if (!d) return 0;
  const pagination = d.pagination as Record<string, unknown> | undefined;
  if (pagination?.total != null) return Number(pagination.total);
  if (d.total != null) return Number(d.total);
  const dataArr = d.data as unknown[] | undefined;
  return Array.isArray(dataArr) ? dataArr.length : 0;
}

export function DashboardScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();

  const [opportunities, setOpportunities] = useState<OpportunityCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [stats, setStats] = useState<Stats>({ total: 0, participating: 0, declined: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  const [statusFilter, setStatusFilter] = useState('');
  const [ufFilter, setUfFilter] = useState('');
  const ufInputRef = useRef<TextInput>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const [allRes, acceptedRes, declinedRes] = await Promise.all([
        opportunitiesApi.list({ page: 1, limit: 1 }),
        opportunitiesApi.list({ page: 1, limit: 1, status: 'accepted' }),
        opportunitiesApi.list({ page: 1, limit: 1, status: 'declined' }),
      ]);
      setStats({
        total: getTotal(allRes),
        participating: getTotal(acceptedRes),
        declined: getTotal(declinedRes),
      });
    } catch {
      // silently ignore stats fetch error
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchOpportunities = useCallback(
    async (pageNum = 1, replace = false, overrideParams?: Partial<OpportunitiesListParams>) => {
      try {
        const params: OpportunitiesListParams = {
          page: pageNum,
          limit: 20,
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(ufFilter.trim() ? { uf: ufFilter.trim().toUpperCase() } : {}),
          ...overrideParams,
        };
        const { data } = await opportunitiesApi.list(params);
        const items: OpportunityCardData[] = (data as Record<string, unknown>).data as OpportunityCardData[] ?? data ?? [];
        const paginationMeta = (data as Record<string, unknown>).pagination as
          | { page: number; limit: number; total: number; totalPages: number }
          | undefined;
        if (replace) {
          setOpportunities(items);
        } else {
          setOpportunities((prev) => [...prev, ...items]);
        }
        setHasMore(paginationMeta ? pageNum < paginationMeta.totalPages : items.length === 20);
      } catch {
        // silently ignore
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [statusFilter, ufFilter],
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchOpportunities(1, true);
  }, [statusFilter, ufFilter, fetchOpportunities]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    fetchStats();
    fetchOpportunities(1, true);
  }, [fetchOpportunities, fetchStats]);

  const onEndReached = useCallback(() => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchOpportunities(next, false);
  }, [hasMore, loading, page, fetchOpportunities]);

  const handlePress = useCallback(
    (id: string) => {
      navigation.navigate('OpportunityDetail', { opportunityId: id });
    },
    [navigation],
  );

  const handleNotifications = useCallback(() => {
    navigation.navigate('Notifications');
  }, [navigation]);

  function renderHeader() {
    const firstName = user?.fullName?.split(' ')[0] ?? '';
    return (
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.logoText}>LICITA IA</Text>
          {firstName ? (
            <Text style={styles.welcomeText}>Olá, {firstName}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.bellButton}
          onPress={handleNotifications}
          activeOpacity={0.75}
        >
          <Text style={styles.bellIcon}>🔔</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const STATS_DATA = [
    {
      icon: '📋',
      value: stats.total,
      label: 'Editais\nRecebidos',
      valueColor: Colors.primary,
    },
    {
      icon: '✅',
      value: stats.participating,
      label: 'Participando',
      valueColor: Colors.success,
    },
    {
      icon: '❌',
      value: stats.declined,
      label: 'Declinadas',
      valueColor: Colors.danger,
    },
  ];

  function renderStats() {
    return (
      <View style={styles.statsRow}>
        {STATS_DATA.map((s, i) => (
          <View key={i} style={styles.statCard}>
            <Text style={styles.statIcon}>{s.icon}</Text>
            {loadingStats ? (
              <View style={styles.statSkeleton} />
            ) : (
              <Text style={[styles.statValue, { color: s.valueColor }]}>
                {s.value}
              </Text>
            )}
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    );
  }

  function renderFilters() {
    return (
      <View style={styles.filtersWrapper}>
        <Text style={styles.sectionTitle}>Oportunidades</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setStatusFilter(f.value)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.ufRow}>
          <Text style={styles.ufLabel}>UF:</Text>
          <TextInput
            ref={ufInputRef}
            style={styles.ufInput}
            placeholder="Ex: SP"
            placeholderTextColor={Colors.textMuted}
            value={ufFilter}
            onChangeText={(v) => setUfFilter(v.replace(/[^a-zA-Z]/g, '').slice(0, 2))}
            autoCapitalize="characters"
            maxLength={2}
            returnKeyType="search"
            onSubmitEditing={() => {}}
          />
          {ufFilter.length > 0 && (
            <TouchableOpacity onPress={() => setUfFilter('')} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

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
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      {renderHeader()}
      <FlatList
        data={loading ? [] : opportunities}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <OpportunityCard opportunity={item} onPress={handlePress} />
        )}
        ListHeaderComponent={
          <>
            {renderStats()}
            {renderFilters()}
            {loading ? [1, 2, 3].map((k) => <SkeletonCard key={k} />) : null}
          </>
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

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
  },
  headerLeft: {
    gap: 3,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 2.5,
  },
  welcomeText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    fontWeight: '500',
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: { fontSize: 20 },

  // ── Stats ────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 20,
    paddingBottom: 4,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 6,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 15,
  },
  statSkeleton: {
    width: 40,
    height: 28,
    backgroundColor: Colors.skeleton,
    borderRadius: 6,
    marginBottom: 2,
  },

  // ── Filters ──────────────────────────────────────────────
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  filtersWrapper: {
    paddingTop: 18,
    paddingBottom: 12,
    gap: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.white,
  },
  ufRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ufLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    minWidth: 24,
  },
  ufInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
    width: 72,
    textAlign: 'center',
  },
  clearBtn: { padding: 4 },
  clearBtnText: { fontSize: 14, color: Colors.textMuted },

  // ── List ─────────────────────────────────────────────────
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
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
