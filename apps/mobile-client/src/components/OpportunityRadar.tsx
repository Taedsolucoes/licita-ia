import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { integrationApi, opportunitiesApi } from '../services/api';
import { Colors } from '../theme/colors';
import { OpportunityCard, OpportunityCardData } from './OpportunityCard';
import { MunicipalityAutocomplete, MunicipalityOption } from './MunicipalityAutocomplete';

interface Props {
  onOpenOpportunity: (id: string) => void;
  highlightOpportunityId?: string | null;
  showSyncButton?: boolean;
  refreshKey?: number;
}
interface AppliedFilters {
  uf: string;
  municipalityName: string;
  municipalityIbgeCode: string;
  q: string;
  source: string;
  status: string;
}
interface IngestionJob { provider: string; jobId: string; state: string; result?: Record<string, unknown> | null; failureReason?: string | null }
const EMPTY_FILTERS: AppliedFilters = { uf: '', municipalityName: '', municipalityIbgeCode: '', q: '', source: '', status: '' };
const SOURCE_FILTERS = [
  { label: 'Todas as fontes', value: '' },
  { label: 'PNCP', value: 'pncp' },
  { label: 'Compras.gov.br', value: 'compras-gov' },
  { label: 'Petronect', value: 'petronect' },
];
const STATUS_FILTERS = [
  { label: 'Todas', value: '' },
  { label: 'Novas', value: 'new' },
  { label: 'Participando', value: 'accepted' },
  { label: 'Descartadas', value: 'declined' },
];

function messageFromError(error: unknown): string {
  const candidate = error as { response?: { data?: { message?: string | string[] } }; message?: string };
  const message = candidate.response?.data?.message;
  return Array.isArray(message) ? message.join(' ') : message || candidate.message || 'Erro de conexão com o servidor.';
}
function toPncpDate(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}
function delay(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

export function OpportunityRadar({ onOpenOpportunity, highlightOpportunityId, showSyncButton = false, refreshKey = 0 }: Props) {
  const [draftUf, setDraftUf] = useState('');
  const [draftCityQuery, setDraftCityQuery] = useState('');
  const [draftCity, setDraftCity] = useState<MunicipalityOption | null>(null);
  const [draftQuery, setDraftQuery] = useState('');
  const [draftSource, setDraftSource] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const [filters, setFilters] = useState<AppliedFilters>(EMPTY_FILTERS);
  const [opportunities, setOpportunities] = useState<OpportunityCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const load = useCallback(async (pageNumber = 1, append = false) => {
    setError('');
    if (!append) setLoading(true);
    try {
      const params = {
        page: pageNumber,
        limit: 20,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.uf ? { uf: filters.uf } : {}),
        ...(filters.municipalityName ? { municipalityName: filters.municipalityName } : {}),
        ...(filters.municipalityIbgeCode ? { municipalityIbgeCode: filters.municipalityIbgeCode } : {}),
        ...(filters.q ? { q: filters.q } : {}),
        ...(filters.source ? { source: filters.source } : {}),
      };
      const response = await opportunitiesApi.list(params);
      const result = response.data as { data?: OpportunityCardData[]; pagination?: { totalPages?: number } };
      let rows = Array.isArray(result?.data) ? result.data : [];

      if (!append && highlightOpportunityId && !rows.some((row) => row.id === highlightOpportunityId)) {
        try {
          const highlighted = await opportunitiesApi.getById(highlightOpportunityId);
          if (highlighted.data?.id) rows = [highlighted.data as OpportunityCardData, ...rows];
        } catch {
          // The highlighted item may have been removed or the session may not own it.
        }
      }
      if (highlightOpportunityId) {
        rows = [...rows].sort((left, right) => Number(right.id === highlightOpportunityId) - Number(left.id === highlightOpportunityId));
      }
      setOpportunities((current) => {
        if (!append) return rows;
        const known = new Set(current.map((row) => row.id));
        return [...current, ...rows.filter((row) => !known.has(row.id))];
      });
      setPage(pageNumber);
      setHasMore(pageNumber < (result?.pagination?.totalPages ?? 0));
    } catch (loadError) {
      setError(messageFromError(loadError));
      if (!append) setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }, [filters, highlightOpportunityId]);

  useEffect(() => { void load(1, false); }, [load, refreshKey]);

  function applyFilters() {
    const uf = draftUf.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 2);
    setFilters({
      uf,
      municipalityName: draftCity && draftCity.uf === uf ? draftCity.name : '',
      municipalityIbgeCode: draftCity && draftCity.uf === uf ? draftCity.code : '',
      q: draftQuery.trim(),
      source: draftSource,
      status: draftStatus,
    });
  }

  async function syncNow() {
    if (syncing) return;
    setSyncing(true);
    setSyncMessage('Enfileirando consultas PNCP e Compras.gov.br…');
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const payload: Record<string, string | number | boolean> = {
      dataInicial: toPncpDate(start),
      dataFinal: toPncpDate(end),
      codigoModalidadeContratacao: 6,
      tamanhoPagina: 20,
      maxPages: 2,
      dataTipo: 'publicacao',
      incluirItens: false,
      ...(filters.uf ? { uf: filters.uf } : {}),
      ...(filters.municipalityIbgeCode ? { codigoMunicipioIbge: filters.municipalityIbgeCode } : {}),
      ...(filters.q ? { palavraChave: filters.q } : {}),
    };
    try {
      const queued = await Promise.allSettled([
        integrationApi.syncPncp(payload),
        integrationApi.syncComprasGov(payload),
      ]);
      const jobs: IngestionJob[] = [];
      const enqueueErrors: string[] = [];
      queued.forEach((result, index) => {
        const provider = index === 0 ? 'PNCP' : 'Compras.gov.br';
        if (result.status === 'fulfilled' && result.value.data?.jobId) {
          jobs.push({ provider, jobId: String(result.value.data.jobId), state: 'queued' });
        } else if (result.status === 'rejected') {
          enqueueErrors.push(`${provider}: ${messageFromError(result.reason)}`);
        }
      });
      if (jobs.length === 0) {
        setSyncMessage(enqueueErrors.join(' · ') || 'Não foi possível iniciar as consultas.');
        return;
      }

      let trackedJobs = [...jobs];
      let pending = jobs;
      for (let attempt = 0; attempt < 30 && pending.length > 0; attempt += 1) {
        await delay(2000);
        const updates = await Promise.all(pending.map(async (job) => {
          try {
            const { data } = await integrationApi.syncStatus(job.jobId);
            return { ...job, state: String(data.state ?? 'waiting'), result: data.result ?? null, failureReason: data.failureReason ?? null };
          } catch {
            return job;
          }
        }));
        trackedJobs = trackedJobs.map((job) => updates.find((update) => update.jobId === job.jobId) ?? job);
        pending = updates.filter((job) => !['completed', 'failed'].includes(job.state));
        setSyncMessage([
          ...trackedJobs.map((job) => `${job.provider}: ${job.state}`),
          ...(enqueueErrors.length ? enqueueErrors : []),
        ].join(' · '));
        if (pending.length === 0) {
          const summaries = trackedJobs.map((job) => {
            const result = job.result as { recordsCreated?: number } | null | undefined;
            return job.state === 'completed'
              ? `${job.provider}: concluído (${result?.recordsCreated ?? 0} licitações novas; matching em fila)`
              : `${job.provider}: falhou${job.failureReason ? ` — ${job.failureReason}` : ''}`;
          });
          setSyncMessage([...summaries, ...enqueueErrors].join(' · '));
        }
      }
      if (pending.length > 0) setSyncMessage((current) => `${current} · Ainda processando; atualize o radar em instantes.`);
      if (pending.length === 0) await delay(2000);
      await load(1, false);
    } catch (syncError) {
      setSyncMessage(messageFromError(syncError));
    } finally {
      setSyncing(false);
    }
  }

  const selectedSourceLabel = SOURCE_FILTERS.find((source) => source.value === filters.source)?.label ?? 'Todas as fontes';

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Radar de Oportunidades</Text>
          <Text style={styles.subtitle}>Editais compatíveis com o perfil da empresa</Text>
        </View>
        {showSyncButton ? (
          <TouchableOpacity style={[styles.syncButton, syncing && styles.syncButtonDisabled]} onPress={syncNow} disabled={syncing} activeOpacity={0.85}>
            {syncing ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.syncIcon}>↻</Text>}
            <Text style={styles.syncButtonText}>{syncing ? 'Sincronizando…' : 'Sincronizar Agora'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {syncMessage ? <Text style={styles.syncMessage}>{syncMessage}</Text> : null}

      <View style={styles.filters}>
        <View style={styles.filterField}>
          <Text style={styles.filterLabel}>Estado (UF)</Text>
          <TextInput
            value={draftUf}
            onChangeText={(value) => {
              setDraftUf(value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 2));
              setDraftCity(null);
              setDraftCityQuery('');
            }}
            placeholder="Ex.: RJ"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
            maxLength={2}
            style={styles.input}
          />
        </View>
        <View style={styles.filterField}>
          <Text style={styles.filterLabel}>Cidade (IBGE)</Text>
          <MunicipalityAutocomplete
            uf={draftUf}
            value={draftCityQuery}
            onChangeText={(value) => { setDraftCityQuery(value); setDraftCity(null); }}
            onSelect={(option) => { setDraftCity(option); setDraftCityQuery(option.name); setDraftUf(option.uf); }}
            placeholder={draftUf.length === 2 ? 'Buscar cidade' : 'Informe a UF'}
          />
        </View>
        <View style={[styles.filterField, styles.queryField]}>
          <Text style={styles.filterLabel}>Objeto / palavra-chave (opcional)</Text>
          <TextInput
            value={draftQuery}
            onChangeText={setDraftQuery}
            placeholder="Deixe vazio para ver todos na localidade"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
            returnKeyType="search"
            onSubmitEditing={applyFilters}
          />
        </View>
      </View>

      <Text style={styles.filterLabel}>Fonte</Text>
      <View style={styles.chipsRow}>
        {SOURCE_FILTERS.map((source) => (
          <TouchableOpacity key={source.value || 'all'} style={[styles.chip, draftSource === source.value && styles.chipActive]} onPress={() => setDraftSource(source.value)}>
            <Text style={[styles.chipText, draftSource === source.value && styles.chipTextActive]}>{source.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.filterLabel}>Situação</Text>
      <View style={styles.chipsRow}>
        {STATUS_FILTERS.map((status) => (
          <TouchableOpacity key={status.value || 'all'} style={[styles.chip, draftStatus === status.value && styles.chipActive]} onPress={() => setDraftStatus(status.value)}>
            <Text style={[styles.chipText, draftStatus === status.value && styles.chipTextActive]}>{status.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.applyButton} onPress={applyFilters} activeOpacity={0.85}>
          <Text style={styles.applyButtonText}>Aplicar filtros</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.appliedSummary}>Fonte selecionada: {selectedSourceLabel}{filters.q ? ` · Objeto: ${filters.q}` : ''}</Text>

      {error ? (
        <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
      ) : null}
      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /><Text style={styles.loadingText}>Carregando oportunidades compatíveis…</Text></View>
      ) : opportunities.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nenhuma oportunidade compatível</Text>
          <Text style={styles.emptyText}>Confira seu perfil em “Minha Empresa” ou ajuste os filtros. Com o objeto vazio, são exibidos todos os matches da cidade/UF escolhida.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {opportunities.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              onPress={onOpenOpportunity}
              isHighlighted={opportunity.id === highlightOpportunityId}
            />
          ))}
          {hasMore ? (
            <TouchableOpacity style={styles.moreButton} onPress={() => { void load(page + 1, true); }} disabled={loading}>
              <Text style={styles.moreButtonText}>{loading ? 'Carregando…' : 'Carregar mais oportunidades'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: Colors.white, marginHorizontal: 16, marginTop: 18, marginBottom: 10, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  headerText: { flex: 1 },
  title: { fontSize: 19, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  syncButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 40, paddingHorizontal: 12, borderRadius: 9, backgroundColor: Colors.success },
  syncButtonDisabled: { opacity: 0.7 },
  syncButtonText: { color: Colors.white, fontSize: 12, fontWeight: '800' },
  syncIcon: { color: Colors.white, fontSize: 19, fontWeight: '900', lineHeight: 20 },
  syncMessage: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 8 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 10 },
  filterField: { width: 150, maxWidth: '100%' },
  queryField: { flex: 1, minWidth: 210 },
  filterLabel: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.25 },
  input: { minHeight: 42, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white, borderRadius: 9, paddingHorizontal: 11, color: Colors.textPrimary, fontSize: 13, outlineStyle: 'none' } as object,
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginBottom: 10 },
  chip: { borderWidth: 1, borderColor: Colors.border, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: Colors.white },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  chipTextActive: { color: Colors.white },
  applyButton: { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#EAF2FF' },
  applyButtonText: { fontSize: 11, fontWeight: '800', color: Colors.primary },
  appliedSummary: { fontSize: 11, color: Colors.textMuted, marginBottom: 12 },
  loading: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  loadingText: { fontSize: 12, color: Colors.textMuted },
  errorBox: { backgroundColor: '#FDECEC', borderWidth: 1, borderColor: '#F2B8B5', borderRadius: 9, padding: 10, marginVertical: 8 },
  errorText: { color: Colors.danger, fontSize: 12 },
  empty: { backgroundColor: Colors.background, borderRadius: 12, padding: 22, alignItems: 'center', marginTop: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  emptyText: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18, maxWidth: 480 },
  list: { marginTop: 4 },
  moreButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, borderRadius: 10, marginBottom: 8 },
  moreButtonText: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
});
