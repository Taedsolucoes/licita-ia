import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { biddingsApi } from '../services/api';
import type { BiddingFacetResponse, BiddingListItem, BiddingsListParams } from '../services/api';
import { Colors } from '../theme/colors';
import type { MainTabParamList, RootStackParamList } from '../types/navigation';

type BiddingsNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Biddings'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type Facet = BiddingFacetResponse['facets'];

const DEFAULT_FILTERS: BiddingsListParams = {
  page: 1,
  limit: 15,
  status: 'open',
  sortBy: 'publicationDate',
  sortDirection: 'desc',
};

function formatDate(value: string | null): string {
  if (!value) return 'Data não informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return date.toLocaleDateString('pt-BR');
}

function formatMoney(value: number | string | null): string {
  if (value === null || value === undefined || value === '') return 'Valor não informado';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'Valor não informado';
  return numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function modalityLabel(value: string | null): string {
  return value?.trim() || 'Modalidade não informada';
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: 'Aberta',
    closed: 'Encerrada',
    cancelled: 'Cancelada',
    suspended: 'Suspensa',
  };
  return labels[status] ?? status;
}

function FacetChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.facetChip, active && styles.facetChipActive]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <Text style={[styles.facetChipText, active && styles.facetChipTextActive]} numberOfLines={1}>
        {label}
      </Text>
      {count !== undefined ? (
        <Text style={[styles.facetCount, active && styles.facetCountActive]}>{count}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

function BiddingCard({ item, onPress }: { item: BiddingListItem; onPress: () => void }) {
  const objectText = item.objectSummary || item.objectText;
  const location = [item.municipalityName, item.uf].filter(Boolean).join(' / ');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.cardTopRow}>
        <View style={styles.sourcePill}>
          <Text style={styles.sourcePillText}>{item.source}</Text>
        </View>
        <Text style={styles.statusText}>{statusLabel(item.status)}</Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={3}>{objectText}</Text>
      <Text style={styles.agency} numberOfLines={1}>{item.agencyName || 'Órgão não informado'}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>📍 {location || 'Local não informado'}</Text>
        <Text style={styles.metaText}>◷ {formatDate(item.proposalDueDate)}</Text>
      </View>
      <View style={styles.cardBottomRow}>
        <View>
          <Text style={styles.metaLabel}>Modalidade</Text>
          <Text style={styles.metaValue} numberOfLines={1}>{modalityLabel(item.modality)}</Text>
        </View>
        <View style={styles.valueBlock}>
          <Text style={styles.metaLabel}>Valor estimado</Text>
          <Text style={styles.value}>{formatMoney(item.estimatedValue)}</Text>
        </View>
      </View>
      <View style={styles.openDetailRow}>
        <Text style={styles.openDetailText}>Ver detalhes</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

export function BiddingsScreen() {
  const navigation = useNavigation<BiddingsNavigation>();
  const [draftQuery, setDraftQuery] = useState('');
  const [draftUf, setDraftUf] = useState('');
  const [draftMunicipality, setDraftMunicipality] = useState('');
  const [filters, setFilters] = useState<BiddingsListParams>(DEFAULT_FILTERS);
  const [items, setItems] = useState<BiddingListItem[]>([]);
  const [facets, setFacets] = useState<Facet | null>(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBiddings = useCallback(async (page: number, replace: boolean) => {
    try {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      const response = await biddingsApi.list({ ...filters, page });
      const payload = response.data;
      setItems((previous) => (replace ? payload.data : [...previous, ...payload.data]));
      setFacets(payload.facets);
      setPagination({
        page: payload.pagination.page,
        total: payload.pagination.total,
        totalPages: payload.pagination.totalPages,
      });
    } catch {
      setError('Não foi possível carregar as licitações. Verifique a conexão e tente novamente.');
      if (replace) setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchBiddings(1, true);
  }, [fetchBiddings]);

  const submitFilters = useCallback(() => {
    const next: BiddingsListParams = {
      ...DEFAULT_FILTERS,
      q: draftQuery.trim() || undefined,
      uf: draftUf.trim().toUpperCase() || undefined,
      municipalityName: draftMunicipality.trim() || undefined,
    };
    setFilters(next);
  }, [draftMunicipality, draftQuery, draftUf]);

  const clearFilters = useCallback(() => {
    setDraftQuery('');
    setDraftUf('');
    setDraftMunicipality('');
    setFilters(DEFAULT_FILTERS);
  }, []);

  const selectStatus = useCallback((status?: string) => {
    setFilters((current) => ({ ...current, page: 1, status: status || undefined }));
  }, []);

  const selectModality = useCallback((modalityCode: string | null) => {
    const numeric = modalityCode ? Number(modalityCode) : undefined;
    setFilters((current) => ({
      ...current,
      page: 1,
      modalityCode: Number.isFinite(numeric) ? numeric : undefined,
    }));
  }, []);

  const selectMunicipality = useCallback((municipalityCode: string | null, municipalityName: string | null) => {
    setDraftMunicipality(municipalityName ?? '');
    setFilters((current) => ({
      ...current,
      page: 1,
      municipalityIbgeCode: municipalityCode || undefined,
      municipalityName: municipalityCode ? undefined : municipalityName || undefined,
    }));
  }, []);

  const activeFilterCount = useMemo(() => {
    return [filters.q, filters.uf, filters.municipalityName, filters.municipalityIbgeCode, filters.modalityCode]
      .filter((value) => value !== undefined && value !== '').length;
  }, [filters]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchBiddings(1, true);
  }, [fetchBiddings]);

  const onEndReached = useCallback(() => {
    if (loading || loadingMore || pagination.page >= pagination.totalPages) return;
    void fetchBiddings(pagination.page + 1, false);
  }, [fetchBiddings, loading, loadingMore, pagination.page, pagination.totalPages]);

  const renderHeader = () => (
    <View>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>CATÁLOGO OFICIAL</Text>
        <Text style={styles.title}>Encontre oportunidades reais</Text>
        <Text style={styles.subtitle}>
          Pesquise licitações publicadas nas fontes oficiais e salve os critérios que fazem sentido para sua empresa.
        </Text>
      </View>

      <View style={styles.searchPanel}>
        <TextInput
          value={draftQuery}
          onChangeText={setDraftQuery}
          placeholder="Objeto, órgão ou número do edital"
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={submitFilters}
        />
        <View style={styles.inlineInputs}>
          <TextInput
            value={draftMunicipality}
            onChangeText={setDraftMunicipality}
            placeholder="Município"
            placeholderTextColor={Colors.textMuted}
            style={[styles.smallInput, styles.municipalityInput]}
            onSubmitEditing={submitFilters}
          />
          <TextInput
            value={draftUf}
            onChangeText={(value) => setDraftUf(value.replace(/[^a-zA-Z]/g, '').slice(0, 2))}
            placeholder="UF"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
            maxLength={2}
            style={[styles.smallInput, styles.ufInput]}
            onSubmitEditing={submitFilters}
          />
          <TouchableOpacity style={styles.searchButton} onPress={submitFilters} activeOpacity={0.8}>
            <Text style={styles.searchButtonText}>Buscar</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.filterSummaryRow}>
          <Text style={styles.filterSummary}>{pagination.total.toLocaleString('pt-BR')} licitações encontradas</Text>
          {activeFilterCount > 0 ? (
            <TouchableOpacity onPress={clearFilters}>
              <Text style={styles.clearFilters}>Limpar filtros</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {facets ? (
        <View style={styles.facetsPanel}>
          <Text style={styles.facetTitle}>Status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.facetRow}>
            <FacetChip label="Todas" count={facets.status.reduce((sum, facet) => sum + facet.count, 0)} active={!filters.status} onPress={() => selectStatus(undefined)} />
            {facets.status.map((facet) => (
              <FacetChip key={facet.status} label={statusLabel(facet.status)} count={facet.count} active={filters.status === facet.status} onPress={() => selectStatus(facet.status)} />
            ))}
          </ScrollView>
          <Text style={styles.facetTitle}>Modalidades</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.facetRow}>
            <FacetChip label="Todas" active={filters.modalityCode === undefined} onPress={() => selectModality(null)} />
            {facets.modality.slice(0, 8).map((facet) => (
              <FacetChip key={`${facet.code}-${facet.name}`} label={modalityLabel(facet.name)} count={facet.count} active={filters.modalityCode === Number(facet.code)} onPress={() => selectModality(facet.code)} />
            ))}
          </ScrollView>
          {facets.municipality.length > 0 ? (
            <>
              <Text style={styles.facetTitle}>Municípios com mais oportunidades</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.facetRow}>
                {facets.municipality.slice(0, 8).map((facet) => (
                  <FacetChip
                    key={`${facet.code}-${facet.name}-${facet.uf}`}
                    label={[facet.name, facet.uf].filter(Boolean).join(' / ') || 'Não informado'}
                    count={facet.count}
                    active={filters.municipalityIbgeCode === facet.code}
                    onPress={() => selectMunicipality(facet.code, facet.name)}
                  />
                ))}
              </ScrollView>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BiddingCard item={item} onPress={() => navigation.navigate('BiddingDetail', { biddingId: item.id })} />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          loading ? (
            <View style={styles.stateContainer}><ActivityIndicator color={Colors.primary} size="large" /></View>
          ) : error ? (
            <View style={styles.stateContainer}>
              <Text style={styles.stateTitle}>Falha ao carregar</Text>
              <Text style={styles.stateText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => void fetchBiddings(1, true)}>
                <Text style={styles.retryText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.stateContainer}>
              <Text style={styles.stateTitle}>Nenhuma licitação encontrada</Text>
              <Text style={styles.stateText}>Ajuste município, UF ou modalidade. A busca não exige palavra-chave.</Text>
            </View>
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.primary} style={styles.footerLoader} /> : null}
        contentContainerStyle={styles.listContent}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

export function BiddingDetailScreen({ route }: { route: { params: { biddingId: string } } }) {
  const [bidding, setBidding] = useState<BiddingListItem | null>(null);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const [biddingResponse, itemsResponse] = await Promise.all([
          biddingsApi.getById(route.params.biddingId),
          biddingsApi.getItems(route.params.biddingId),
        ]);
        if (!active) return;
        setBidding(biddingResponse.data);
        const itemPayload = itemsResponse.data as unknown;
        setItems(Array.isArray(itemPayload) ? itemPayload as Array<Record<string, unknown>> : []);
      } catch {
        if (active) setError('Não foi possível carregar os detalhes desta licitação.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [route.params.biddingId]);

  if (loading) {
    return <SafeAreaView style={styles.container}><View style={styles.stateContainer}><ActivityIndicator color={Colors.primary} size="large" /></View></SafeAreaView>;
  }
  if (error || !bidding) {
    return <SafeAreaView style={styles.container}><View style={styles.stateContainer}><Text style={styles.stateTitle}>Detalhe indisponível</Text><Text style={styles.stateText}>{error ?? 'Licitação não encontrada.'}</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
        <View style={styles.detailHeader}>
          <View style={styles.sourcePill}><Text style={styles.sourcePillText}>{bidding.source}</Text></View>
          <Text style={styles.detailStatus}>{statusLabel(bidding.status)}</Text>
        </View>
        <Text style={styles.detailTitle}>{bidding.objectText}</Text>
        <Text style={styles.detailAgency}>{bidding.agencyName || 'Órgão não informado'}</Text>
        <View style={styles.detailGrid}>
          <View style={styles.detailCell}><Text style={styles.metaLabel}>Município</Text><Text style={styles.detailValue}>{[bidding.municipalityName, bidding.uf].filter(Boolean).join(' / ') || 'Não informado'}</Text></View>
          <View style={styles.detailCell}><Text style={styles.metaLabel}>Modalidade</Text><Text style={styles.detailValue}>{modalityLabel(bidding.modality)}</Text></View>
          <View style={styles.detailCell}><Text style={styles.metaLabel}>Propostas até</Text><Text style={styles.detailValue}>{formatDate(bidding.proposalDueDate)}</Text></View>
          <View style={styles.detailCell}><Text style={styles.metaLabel}>Valor estimado</Text><Text style={styles.detailValue}>{formatMoney(bidding.estimatedValue)}</Text></View>
        </View>
        <View style={styles.detailSection}>
          <Text style={styles.sectionTitle}>Objeto completo</Text>
          <Text style={styles.detailBody}>{bidding.objectText}</Text>
        </View>
        {items.length > 0 ? (
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Itens ({items.length})</Text>
            {items.map((item, index) => (
              <View key={String(item.id ?? index)} style={styles.itemRow}>
                <Text style={styles.itemNumber}>{String(item.itemNumber ?? index + 1).padStart(2, '0')}</Text>
                <Text style={styles.itemDescription}>{String(item.description ?? 'Item sem descrição')}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {bidding.sourceUrl ? (
          <TouchableOpacity style={styles.sourceButton} onPress={() => void Linking.openURL(bidding.sourceUrl as string)} activeOpacity={0.8}>
            <Text style={styles.sourceButtonText}>Abrir publicação na fonte oficial</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  hero: { paddingTop: 18, paddingBottom: 14 },
  eyebrow: { color: Colors.primaryLight, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: Colors.textPrimary, fontSize: 27, fontWeight: '900', marginTop: 7 },
  subtitle: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 7, maxWidth: 620 },
  searchPanel: { backgroundColor: Colors.white, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.shadow, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  searchInput: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 13, color: Colors.textPrimary, fontSize: 14 },
  inlineInputs: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 },
  smallInput: { height: 42, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 11, color: Colors.textPrimary, fontSize: 13 },
  municipalityInput: { flex: 1 },
  ufInput: { width: 58, textAlign: 'center' },
  searchButton: { height: 42, paddingHorizontal: 15, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },
  searchButtonText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
  filterSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 11 },
  filterSummary: { color: Colors.textSecondary, fontSize: 12 },
  clearFilters: { color: Colors.primaryLight, fontSize: 12, fontWeight: '800' },
  facetsPanel: { paddingTop: 17, paddingBottom: 6 },
  facetTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800', marginBottom: 8, marginTop: 7 },
  facetRow: { gap: 8, paddingBottom: 5 },
  facetChip: { flexDirection: 'row', alignItems: 'center', gap: 7, maxWidth: 260, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white },
  facetChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  facetChipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  facetChipTextActive: { color: Colors.white },
  facetCount: { color: Colors.primaryLight, fontSize: 11, fontWeight: '900' },
  facetCountActive: { color: Colors.white },
  card: { backgroundColor: Colors.white, borderRadius: 17, marginTop: 12, padding: 15, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.shadow, shadowOpacity: 0.045, shadowRadius: 7, elevation: 2 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sourcePill: { backgroundColor: Colors.successBg, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 },
  sourcePillText: { color: Colors.success, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  statusText: { color: Colors.success, fontSize: 12, fontWeight: '800' },
  cardTitle: { color: Colors.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: '800', marginTop: 12 },
  agency: { color: Colors.textSecondary, fontSize: 12, marginTop: 7 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 12 },
  metaText: { color: Colors.textSecondary, fontSize: 11, flexShrink: 1 },
  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 14, paddingTop: 12 },
  metaLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800', marginTop: 4, maxWidth: 190 },
  valueBlock: { alignItems: 'flex-end' },
  value: { color: Colors.primary, fontSize: 14, fontWeight: '900', marginTop: 4 },
  openDetailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 12 },
  openDetailText: { color: Colors.primaryLight, fontSize: 12, fontWeight: '800' },
  chevron: { color: Colors.primaryLight, fontSize: 20, lineHeight: 17 },
  stateContainer: { alignItems: 'center', justifyContent: 'center', padding: 42, minHeight: 190 },
  stateTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  stateText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7, maxWidth: 360 },
  retryButton: { marginTop: 14, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
  footerLoader: { paddingVertical: 20 },
  detailContent: { padding: 18, paddingBottom: 35 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailStatus: { color: Colors.success, fontSize: 13, fontWeight: '800' },
  detailTitle: { color: Colors.textPrimary, fontSize: 24, lineHeight: 31, fontWeight: '900', marginTop: 16 },
  detailAgency: { color: Colors.textSecondary, fontSize: 14, marginTop: 8 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  detailCell: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, minWidth: '46%', flexGrow: 1 },
  detailValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800', marginTop: 5 },
  detailSection: { backgroundColor: Colors.white, borderRadius: 14, padding: 15, marginTop: 14, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '900', marginBottom: 9 },
  detailBody: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21 },
  itemRow: { flexDirection: 'row', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  itemNumber: { color: Colors.primaryLight, fontSize: 12, fontWeight: '900', width: 25 },
  itemDescription: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, flex: 1 },
  sourceButton: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  sourceButtonText: { color: Colors.white, fontSize: 14, fontWeight: '900' },
});
