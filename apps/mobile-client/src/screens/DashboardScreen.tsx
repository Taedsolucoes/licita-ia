import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { opportunitiesApi } from '../services/api';
import { Colors } from '../theme/colors';
import { OpportunityRadar } from '../components/OpportunityRadar';
import type { RootStackParamList, MainTabParamList, DashboardScreenProps } from '../types/navigation';
import { useAuth } from '../context/AuthContext';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Dashboard'>,
  NativeStackNavigationProp<RootStackParamList>
>;
interface Stats { total: number; participating: number; declined: number }
function totalFrom(response: { data: unknown }): number {
  const data = response.data as { pagination?: { total?: number }; total?: number } | null;
  return Number(data?.pagination?.total ?? data?.total ?? 0);
}
const ADMIN_ROLES = ['taed_admin', 'taed_operator'];

interface DashboardProps { highlightedOpportunityId?: string | null }

export function DashboardScreen({ highlightedOpportunityId: highlightedOverride }: DashboardProps = {}) {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<DashboardScreenProps['route']>();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ total: 0, participating: 0, declined: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const highlightedOpportunityId = highlightedOverride ?? route.params?.highlightOpportunityId ?? null;

  const fetchStats = useCallback(async () => {
    try {
      const [all, accepted, declined] = await Promise.all([
        opportunitiesApi.list({ page: 1, limit: 1 }),
        opportunitiesApi.list({ page: 1, limit: 1, status: 'accepted' }),
        opportunitiesApi.list({ page: 1, limit: 1, status: 'declined' }),
      ]);
      setStats({ total: totalFrom(all), participating: totalFrom(accepted), declined: totalFrom(declined) });
    } catch {
      // Keep last good values while the list displays its own request error.
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => { void fetchStats(); }, [fetchStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshKey((value) => value + 1);
    await fetchStats();
    setRefreshing(false);
  }, [fetchStats]);

  const handleOpenOpportunity = useCallback((id: string) => {
    navigation.navigate('OpportunityDetail', { opportunityId: id });
  }, [navigation]);

  const handleNotifications = useCallback(() => navigation.navigate('Notifications'), [navigation]);
  const firstName = user?.fullName?.split(' ')[0] ?? '';
  const showSyncButton = ADMIN_ROLES.includes(user?.role ?? '');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <View style={styles.header}>
        <View>
          <Text style={styles.logoText}>LICITA IA</Text>
          {firstName ? <Text style={styles.welcomeText}>Olá, {firstName}</Text> : null}
        </View>
        <TouchableOpacity style={styles.bellButton} onPress={handleNotifications} activeOpacity={0.75} accessibilityLabel="Abrir notificações">
          <Text style={styles.bellIcon}>🔔</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.success]} tintColor={Colors.primary} />}
      >
        <View style={styles.statsRow}>
          <StatCard icon="📋" label="Editais Recebidos" value={stats.total} loading={loadingStats} color={Colors.primary} />
          <StatCard icon="✅" label="Participando" value={stats.participating} loading={loadingStats} color={Colors.success} />
          <StatCard icon="↗" label="Descartadas" value={stats.declined} loading={loadingStats} color={Colors.danger} />
        </View>
        <OpportunityRadar
          onOpenOpportunity={handleOpenOpportunity}
          highlightOpportunityId={highlightedOpportunityId}
          showSyncButton={showSyncButton}
          refreshKey={refreshKey}
        />
        <View style={{ height: 18 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value, loading, color }: { icon: string; label: string; value: number; loading: boolean; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      {loading ? <View style={styles.statSkeleton} /> : <Text style={[styles.statValue, { color }]}>{value}</Text>}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primary, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18 },
  logoText: { fontSize: 22, fontWeight: '900', color: Colors.white, letterSpacing: 2.5 },
  welcomeText: { fontSize: 13, color: 'rgba(255,255,255,0.72)', fontWeight: '500', marginTop: 3 },
  bellButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  bellIcon: { fontSize: 20 },
  content: { paddingHorizontal: 0, paddingBottom: 24 },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 18 },
  statCard: { flex: 1, minHeight: 105, backgroundColor: Colors.white, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  statIcon: { fontSize: 18, marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '600', color: Colors.textMuted, textAlign: 'center', marginTop: 3 },
  statSkeleton: { width: 40, height: 26, backgroundColor: Colors.skeleton, borderRadius: 6, marginVertical: 2 },
});
