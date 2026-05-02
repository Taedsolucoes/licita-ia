import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { adminApi } from '../services/api';
import { Colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface OverviewStats {
  totalTenants: number;
  activeBiddings: number;
  pendingParticipations: number;
}

interface ParticipationItem {
  id: string;
  tenantId: string;
  status?: string;
  consolidatedTotalValue?: number | null;
  hasImpugnation?: boolean;
  createdAt?: string;
  tenant?: {
    id: string;
    corporateName: string;
    tradeName?: string;
    cnpj?: string;
  };
  opportunity?: {
    id: string;
    capagRatingSnapshot?: string | null;
    status?: string;
    bidding?: {
      id?: string;
      biddingNumber?: string;
      agencyName?: string;
      objectSummary?: string;
      estimatedValue?: string | number | null;
    };
  };
}

function formatBRL(value: number | null | undefined): string {
  if (value == null || value === 0) return '—';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusLabel(status: string | undefined): { text: string; color: string; bg: string } {
  switch (status) {
    case 'pending':    return { text: 'Pendente',    color: Colors.orange,   bg: Colors.warningBg };
    case 'accepted':   return { text: 'Participando', color: Colors.success,  bg: Colors.successBg };
    case 'declined':   return { text: 'Declinada',   color: Colors.danger,   bg: '#FFEBEE' };
    case 'submitted':  return { text: 'Enviada',     color: Colors.primary,  bg: '#EEF2FF' };
    default:           return { text: status ?? '—', color: Colors.textMuted, bg: Colors.background };
  }
}

export function AdminDashboardScreen() {
  const navigation = useNavigation<NavProp>();

  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [participations, setParticipations] = useState<ParticipationItem[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOverview = useCallback(async () => {
    try {
      const { data } = await adminApi.overview();
      setOverview(data as OverviewStats);
    } catch {
      // silently ignore
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const fetchParticipations = useCallback(async () => {
    try {
      const { data } = await adminApi.participations({ page: 1, limit: 20 });
      const items = (data as Record<string, unknown>).data as ParticipationItem[] ?? data ?? [];
      setParticipations(Array.isArray(items) ? items : []);
    } catch {
      // silently ignore
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([fetchOverview(), fetchParticipations()]);
  }, [fetchOverview, fetchParticipations]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setLoadingOverview(true);
    setLoadingList(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const impugnationAlerts = participations.filter((p) => p.hasImpugnation);

  const STAT_CARDS = [
    { icon: '🏢', label: 'Empresas\nClientes',      value: overview?.totalTenants,          color: Colors.primary },
    { icon: '📋', label: 'Licitações\nAtivas',       value: overview?.activeBiddings,        color: Colors.success },
    { icon: '⏳', label: 'Participações\nPendentes', value: overview?.pendingParticipations, color: Colors.orange },
  ];

  function renderHeader() {
    return (
      <View style={styles.header}>
        <Text style={styles.logoText}>LICITA IA</Text>
        <Text style={styles.headerSub}>Painel Administrativo · TAED</Text>
      </View>
    );
  }

  function renderStats() {
    return (
      <View style={styles.statsGrid}>
        {STAT_CARDS.map((card, i) => (
          <View key={i} style={styles.statCard}>
            <Text style={styles.statIcon}>{card.icon}</Text>
            {loadingOverview ? (
              <View style={styles.statSkeleton} />
            ) : (
              <Text style={[styles.statValue, { color: card.color }]}>
                {card.value ?? '—'}
              </Text>
            )}
            <Text style={styles.statLabel}>{card.label}</Text>
          </View>
        ))}
      </View>
    );
  }

  function renderImpugnationAlerts() {
    if (impugnationAlerts.length === 0) return null;
    return (
      <View style={styles.alertSection}>
        <View style={styles.alertHeader}>
          <Text style={styles.alertHeaderIcon}>🚨</Text>
          <Text style={styles.alertHeaderText}>
            {impugnationAlerts.length} alerta{impugnationAlerts.length > 1 ? 's' : ''} de impugnação
          </Text>
        </View>
        {impugnationAlerts.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.alertCard}
            onPress={() => navigation.navigate('AdminTenantDetail', { tenantId: p.tenantId })}
            activeOpacity={0.85}
          >
            <Text style={styles.alertCardTitle} numberOfLines={1}>
              {p.tenant?.tradeName ?? p.tenant?.corporateName ?? 'Empresa'}
            </Text>
            <Text style={styles.alertCardDesc} numberOfLines={2}>
              {p.opportunity?.bidding?.objectSummary ?? p.opportunity?.bidding?.agencyName ?? 'Licitação sem descrição'}
            </Text>
            <Text style={styles.alertCardValue}>{formatBRL(
              typeof p.consolidatedTotalValue === 'number' ? p.consolidatedTotalValue :
              typeof p.opportunity?.bidding?.estimatedValue === 'number' ? p.opportunity.bidding.estimatedValue :
              typeof p.opportunity?.bidding?.estimatedValue === 'string' ? parseFloat(p.opportunity.bidding.estimatedValue) : null
            )}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  function renderParticipationItem({ item }: { item: ParticipationItem }) {
    const s = statusLabel(item.status);
    const tenantName = item.tenant?.tradeName ?? item.tenant?.corporateName ?? 'Empresa';
    const biddingDesc = item.opportunity?.bidding?.objectSummary ?? item.opportunity?.bidding?.agencyName ?? '—';
    const totalValue = typeof item.consolidatedTotalValue === 'number' ? item.consolidatedTotalValue :
      typeof item.opportunity?.bidding?.estimatedValue === 'number' ? item.opportunity.bidding.estimatedValue :
      typeof item.opportunity?.bidding?.estimatedValue === 'string' ? parseFloat(item.opportunity.bidding.estimatedValue) : null;

    return (
      <TouchableOpacity
        style={[styles.participationCard, item.hasImpugnation && styles.participationCardAlert]}
        onPress={() => navigation.navigate('AdminTenantDetail', { tenantId: item.tenantId })}
        activeOpacity={0.88}
      >
        <View style={styles.participationTop}>
          <Text style={styles.participationTenant} numberOfLines={1}>
            {item.hasImpugnation ? '⚖️ ' : ''}{tenantName}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
            <Text style={[styles.statusBadgeText, { color: s.color }]}>{s.text}</Text>
          </View>
        </View>
        <Text style={styles.participationDesc} numberOfLines={2}>
          {biddingDesc}
        </Text>
        <Text style={styles.participationValue}>{formatBRL(totalValue)}</Text>
      </TouchableOpacity>
    );
  }

  function renderListEmpty() {
    if (loadingList) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyText}>Nenhuma participação registrada</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      {renderHeader()}
      <FlatList
        data={loadingList ? [] : participations}
        keyExtractor={(item) => item.id}
        renderItem={renderParticipationItem}
        ListHeaderComponent={
          <>
            {renderStats()}
            {renderImpugnationAlerts()}
            {loadingList && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={Colors.primary} size="large" />
              </View>
            )}
            {!loadingList && participations.length > 0 && (
              <Text style={styles.sectionTitle}>Participações Recentes</Text>
            )}
          </>
        }
        ListEmptyComponent={renderListEmpty}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screenBackground },

  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 2.5,
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
    marginTop: 2,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 20,
    paddingBottom: 4,
  },
  statCard: {
    width: '47%',
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  statIcon: { fontSize: 22, marginBottom: 6 },
  statValue: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 15,
  },
  statSkeleton: {
    width: 48,
    height: 32,
    backgroundColor: Colors.skeleton,
    borderRadius: 6,
    marginBottom: 2,
  },

  alertSection: {
    marginTop: 20,
    marginBottom: 4,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  alertHeaderIcon: { fontSize: 16 },
  alertHeaderText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.danger,
    letterSpacing: 0.3,
  },
  alertCard: {
    backgroundColor: '#FFF0F0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: Colors.danger,
  },
  alertCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.danger,
    marginBottom: 2,
  },
  alertCardDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginBottom: 6,
  },
  alertCardValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginTop: 20,
    marginBottom: 10,
  },

  participationCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  participationCardAlert: {
    borderColor: Colors.danger,
    borderWidth: 1.5,
  },
  participationTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  participationTenant: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  participationDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginBottom: 8,
  },
  participationValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.success,
  },

  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  loadingContainer: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
