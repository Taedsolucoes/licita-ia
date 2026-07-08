import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { adminApi } from '../services/api';

// suppress unused import warning — Pressable kept for future use
void Pressable;

// ─── Color tokens ──────────────────────────────────────────────────────────────
const C = {
  blue:    '#2563EB',
  blueBg:  '#EFF6FF',
  green:   '#10B981',
  greenBg: '#ECFDF5',
  red:     '#EF4444',
  redBg:   '#FEF2F2',
  yellow:  '#F59E0B',
  yellowBg:'#FFFBEB',
  bg:      '#F5F7FA',
  white:   '#FFFFFF',
  text:    '#111827',
  muted:   '#6B7280',
  border:  '#E5E7EB',
};

// ─── Types ─────────────────────────────────────────────────────────────────────
interface StatCard {
  total: number;
  comparativo: number;
}

interface DashboardStats {
  empresasAtivas: StatCard;
  oportunidadesHoje: StatCard;
  licitacoesEnviadas: StatCard;
  licitacoesVencidas: StatCard;
}

interface TenantRow {
  id: string;
  corporateName: string;
  tradeName?: string;
  cnpj?: string;
  stats?: {
    licitacoesHoje: number;
    licitacoesMes: number;
    vitoriosas: number;
    acoesPendentes: number;
  };
}

interface ExpiringDocument {
  id: string;
  type: string;
  validUntil: string | null;
  tenant: { corporateName: string };
}

// ─── Mock fallback data ────────────────────────────────────────────────────────
const MOCK_OPORTUNIDADES = [
  { orgao: 'Prefeitura de Joinville/SC', valor: 'R$ 1.250.000,00', relevancia: 'Alta' },
  { orgao: 'Governo do Estado SP',       valor: 'R$ 850.000,00',   relevancia: 'Média' },
  { orgao: 'Câmara Municipal de Curitiba/PR', valor: 'R$ 120.000,00', relevancia: 'Alta' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function pendenteBadge(n: number) {
  if (n === 0) return { bg: C.greenBg,  color: C.green,  text: '0 pendentes' };
  if (n === 1) return { bg: C.yellowBg, color: C.yellow, text: '1 pendente' };
  return { bg: C.redBg, color: C.red, text: `${n} pendentes` };
}

function certidaoBadge(validUntil: string | null) {
  if (!validUntil) return { bg: C.yellowBg, color: C.yellow, text: 'Sem vencimento' };
  const dias = Math.ceil((new Date(validUntil).getTime() - Date.now()) / 86400000);
  if (dias <= 0) return { bg: C.redBg,    color: C.red,    text: 'Vencida' };
  if (dias <= 3) return { bg: C.redBg,    color: C.red,    text: `Vence em ${dias} dias` };
  return { bg: C.yellowBg, color: C.yellow, text: `Vence em ${dias} dias` };
}

function relevanciaBadge(r: string) {
  if (r === 'Alta')  return { bg: C.blueBg,  color: C.blue };
  return { bg: C.yellowBg, color: C.yellow };
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function AdminDashboardScreen() {
  const [stats, setStats]                         = useState<DashboardStats | null>(null);
  const [tenants, setTenants]                     = useState<TenantRow[]>([]);
  const [expiringDocs, setExpiringDocs]           = useState<ExpiringDocument[]>([]);
  const [loadingStats, setLoadingStats]           = useState(true);
  const [loadingTenants, setLoadingTenants]       = useState(true);
  const [loadingDocs, setLoadingDocs]             = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await adminApi.stats();
      setStats(data as DashboardStats);
    } catch { /* ignore */ }
    finally { setLoadingStats(false); }
  }, []);

  const fetchTenants = useCallback(async () => {
    try {
      const { data } = await adminApi.companies();
      const list: TenantRow[] = Array.isArray(data) ? data : [];
      setTenants(list.slice(0, 5));
    } catch {
      setTenants([]);
    } finally {
      setLoadingTenants(false);
    }
  }, []);

  const fetchDocs = useCallback(async () => {
    try {
      const { data } = await adminApi.documentsExpiring(30);
      const list: ExpiringDocument[] = Array.isArray(data) ? data : [];
      setExpiringDocs(list.slice(0, 5));
    } catch {
      setExpiringDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchTenants();
    fetchDocs();
  }, [fetchStats, fetchTenants, fetchDocs]);

  const isWeb = Platform.OS === 'web';

  // Stats from real API
  const empresasAtivas   = stats?.empresasAtivas?.total           ?? '—';
  const oportHoje        = stats?.oportunidadesHoje?.total        ?? '—';
  const licitEnviadas    = stats?.licitacoesEnviadas?.total       ?? '—';
  const licitVencidas    = stats?.licitacoesVencidas?.total       ?? '—';

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (!isWeb) {
    // Mobile: minimal view (full web layout only)
    return (
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 4 }}>Dashboard Admin</Text>
        <Text style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Visão geral da sua operação</Text>
        {loadingStats ? (
          <ActivityIndicator color={C.blue} />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {[
              { label: 'Empresas Ativas',      value: empresasAtivas },
              { label: 'Oportunidades Hoje',   value: oportHoje },
              { label: 'Licitações Enviadas',  value: licitEnviadas },
              { label: 'Licitações Vencidas',  value: licitVencidas },
            ].map((s) => (
              <View key={s.label} style={{ width: '47%', backgroundColor: C.white, borderRadius: 12, padding: 16 }}>
                <Text style={{ fontSize: 28, fontWeight: '800', color: C.text }}>{s.value}</Text>
                <Text style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Dashboard Admin</Text>
          <Text style={styles.subtitle}>Visão geral da sua operação</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.btnHoje} activeOpacity={0.8}>
            <Text style={styles.btnHojeIcon}>📅</Text>
            <Text style={styles.btnHojeText}>Hoje</Text>
            <Text style={styles.btnHojeChevron}>▾</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnNova} activeOpacity={0.85}>
            <Text style={styles.btnNovaText}>+ Nova Empresa</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 4 STAT CARDS ───────────────────────────────────────────────────── */}
      <View style={styles.statsRow}>
        {/* Empresas Ativas */}
        <View style={styles.statCard}>
          <View style={styles.statTop}>
            <View>
              <Text style={styles.statLabel}>Empresas Ativas</Text>
              {loadingStats
                ? <View style={styles.skeleton} />
                : <Text style={styles.statValue}>{empresasAtivas}</Text>
              }
            </View>
            <View style={[styles.statIcon, { backgroundColor: C.blueBg }]}>
              <Text style={styles.statIconText}>⊞</Text>
            </View>
          </View>
          <Text style={[styles.statSub, { color: C.blue }]}>
            {stats ? `+${stats.empresasAtivas.comparativo} este mês` : '+12 este mês'}
          </Text>
        </View>

        {/* Oportunidades Hoje */}
        <View style={styles.statCard}>
          <View style={styles.statTop}>
            <View>
              <Text style={styles.statLabel}>Oportunidades Hoje</Text>
              {loadingStats
                ? <View style={styles.skeleton} />
                : <Text style={styles.statValue}>{oportHoje}</Text>
              }
            </View>
            <View style={[styles.statIcon, { backgroundColor: C.greenBg }]}>
              <Text style={styles.statIconText}>✓</Text>
            </View>
          </View>
          <Text style={[styles.statSub, { color: C.green }]}>
            {stats
              ? (stats.oportunidadesHoje.comparativo >= 0
                  ? `+${stats.oportunidadesHoje.comparativo} vs ontem`
                  : `${stats.oportunidadesHoje.comparativo} vs ontem`)
              : '+8% vs ontem'}
          </Text>
        </View>

        {/* Licitações Enviadas */}
        <View style={styles.statCard}>
          <View style={styles.statTop}>
            <View>
              <Text style={styles.statLabel}>Licitações Enviadas</Text>
              {loadingStats
                ? <View style={styles.skeleton} />
                : <Text style={styles.statValue}>{licitEnviadas}</Text>
              }
            </View>
            <View style={[styles.statIcon, { backgroundColor: C.blueBg }]}>
              <Text style={styles.statIconText}>➤</Text>
            </View>
          </View>
          <Text style={[styles.statSub, { color: C.muted }]}>este mês</Text>
        </View>

        {/* Licitações Vencidas */}
        <View style={styles.statCard}>
          <View style={styles.statTop}>
            <View>
              <Text style={styles.statLabel}>Licitações Vencidas</Text>
              {loadingStats
                ? <View style={styles.skeleton} />
                : <Text style={styles.statValue}>{licitVencidas}</Text>
              }
            </View>
            <View style={[styles.statIcon, { backgroundColor: C.redBg }]}>
              <Text style={styles.statIconText}>🏆</Text>
            </View>
          </View>
          <Text style={[styles.statSub, { color: C.muted }]}>este mês</Text>
        </View>
      </View>

      {/* ── MAIN SECTION: 70/30 ────────────────────────────────────────────── */}
      <View style={styles.mainRow}>

        {/* LEFT 70% — Empresas table */}
        <View style={[styles.mainCard, { flex: 7 }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Empresas</Text>
          </View>

          {/* Table header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.thCell, { flex: 3 }]}>Empresa</Text>
            <Text style={[styles.thCell, { flex: 1.4, textAlign: 'center' }]}>Licitações Hoje</Text>
            <Text style={[styles.thCell, { flex: 1.4, textAlign: 'center' }]}>Licitações Mês</Text>
            <Text style={[styles.thCell, { flex: 1.4, textAlign: 'center' }]}>Vitoriosas (Mês)</Text>
            <Text style={[styles.thCell, { flex: 1.8, textAlign: 'center' }]}>Ações Pendentes</Text>
            <View style={{ width: 60 }} />
          </View>

          {/* Table rows */}
          {loadingTenants
            ? <ActivityIndicator color={C.blue} style={{ padding: 24 }} />
            : tenants.length === 0
              ? <Text style={{ padding: 20, color: C.muted, textAlign: 'center' }}>Nenhuma empresa encontrada</Text>
              : tenants.map((t, idx) => {
                  const acoesPendentes = t.stats?.acoesPendentes ?? 0;
                  const badge = pendenteBadge(acoesPendentes);
                  return (
                    <View
                      key={t.id}
                      style={[styles.tableRow, idx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}
                    >
                      <View style={{ flex: 3 }}>
                        <Text style={styles.tenantName}>{t.corporateName}</Text>
                        <Text style={styles.tenantCnpj}>{t.cnpj ?? '—'}</Text>
                      </View>
                      <Text style={[styles.tdCell, { flex: 1.4 }]}>{t.stats?.licitacoesHoje ?? 0}</Text>
                      <Text style={[styles.tdCell, { flex: 1.4 }]}>{t.stats?.licitacoesMes ?? 0}</Text>
                      <Text style={[styles.tdCell, { flex: 1.4, color: C.green, fontWeight: '700' }]}>{t.stats?.vitoriosas ?? 0}</Text>
                      <View style={{ flex: 1.8, alignItems: 'center', justifyContent: 'center' }}>
                        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                          {acoesPendentes > 0 && (
                            <Text style={{ color: badge.color, fontSize: 11, marginRight: 3 }}>⚠</Text>
                          )}
                          <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
                        </View>
                      </View>
                      <View style={{ width: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        <TouchableOpacity activeOpacity={0.7}>
                          <Text style={{ fontSize: 16, color: C.blue }}>👁</Text>
                        </TouchableOpacity>
                        <TouchableOpacity activeOpacity={0.7}>
                          <Text style={{ fontSize: 16, color: C.muted }}>⋯</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
          }

          {/* Footer link */}
          <TouchableOpacity style={styles.tableFooter} activeOpacity={0.7}>
            <Text style={styles.tableFooterLink}>Ver todas as empresas</Text>
          </TouchableOpacity>
        </View>

        {/* RIGHT 30% — 2 panels stacked */}
        <View style={[{ flex: 3, gap: 16, minWidth: 0 }]}>

          {/* Certidões a Vencer */}
          <View style={styles.mainCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Certidões a Vencer</Text>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.linkText}>Ver todas</Text>
              </TouchableOpacity>
            </View>
            {loadingDocs
              ? <ActivityIndicator color={C.blue} style={{ padding: 16 }} />
              : expiringDocs.length === 0
                ? <Text style={{ padding: 16, color: C.muted, fontSize: 13 }}>Nenhuma certidão próxima do vencimento</Text>
                : expiringDocs.map((doc, i) => {
                    const b = certidaoBadge(doc.validUntil);
                    return (
                      <View key={doc.id} style={styles.certRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.certEmpresa}>{doc.tenant?.corporateName ?? '—'}</Text>
                          <Text style={styles.certTipo}>{doc.type}</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: b.bg }]}>
                          <Text style={[styles.badgeText, { color: b.color }]}>{b.text}</Text>
                        </View>
                      </View>
                    );
                  })
            }
          </View>

          {/* Oportunidades Hoje */}
          <View style={styles.mainCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Oportunidades Hoje</Text>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.linkText}>Ver todas</Text>
              </TouchableOpacity>
            </View>
            {MOCK_OPORTUNIDADES.map((o, i) => {
              const b = relevanciaBadge(o.relevancia);
              return (
                <View key={i} style={styles.certRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.certEmpresa}>{o.orgao}</Text>
                    <Text style={styles.certTipo}>{o.valor}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: b.bg }]}>
                    <Text style={[styles.badgeText, { color: b.color }]}>{o.relevancia}</Text>
                  </View>
                </View>
              );
            })}
          </View>

        </View>
      </View>

      {/* ── PIPELINE SECTION ──────────────────────────────────────────────── */}
      <View style={styles.pipelineCard}>
        <Text style={styles.pipelineTitle}>Fluxo da Oportunidade</Text>
        <Text style={styles.pipelineSub}>Acompanhe o status da licitação desde o envio até a disputa.</Text>

        <View style={styles.pipelineRow}>
          {[
            { icon: '➤', label: 'Enviado',      desc: 'Licitação enviada\npara o cliente',         color: C.blue,   active: false },
            { icon: '👁', label: 'Visualizado',  desc: 'Cliente abriu a\nlicitação',               color: C.blue,   active: false },
            { icon: '♥', label: 'Interessado',   desc: 'Cliente demonstrou\ninteresse',            color: C.green,  active: true  },
            { icon: '📋', label: 'Em Análise',   desc: 'Você está\nanalisando',                    color: C.blue,   active: false },
            { icon: '⚖', label: 'Em Disputa',    desc: 'Você cadastrou na\ndisputa',               color: C.blue,   active: false },
            { icon: '✓', label: 'Finalizado',    desc: 'Resultado registrado\n(Ganhou/Perdeu)',     color: C.green,  active: false },
          ].map((step, i, arr) => (
            <React.Fragment key={step.label}>
              <View style={styles.pipelineStep}>
                <View style={[
                  styles.pipelineIconWrap,
                  step.active
                    ? { backgroundColor: C.greenBg, borderColor: C.green, borderWidth: 2 }
                    : { backgroundColor: C.bg, borderColor: C.border, borderWidth: 1.5 }
                ]}>
                  <Text style={[styles.pipelineIcon, { color: step.active ? C.green : C.muted }]}>
                    {step.icon}
                  </Text>
                </View>
                <Text style={[styles.pipelineLabel, step.active && { color: C.green, fontWeight: '700' }]}>
                  {step.label}
                </Text>
                <Text style={styles.pipelineDesc}>{step.desc}</Text>
              </View>
              {i < arr.length - 1 && (
                <Text style={styles.pipelineArrow}>→</Text>
              )}
            </React.Fragment>
          ))}

          {/* Attention card */}
          <View style={styles.attentionCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Text style={{ fontSize: 16 }}>🔔</Text>
              <Text style={styles.attentionTitle}>Atenção</Text>
            </View>
            <Text style={styles.attentionText}>
              Você possui licitações com clientes interessados aguardando sua ação.
            </Text>
            <TouchableOpacity style={styles.attentionBtn} activeOpacity={0.85}>
              <Text style={styles.attentionBtnText}>Ver ações pendentes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

    </ScrollView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    padding: 28,
    paddingBottom: 40,
    gap: 24,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: C.muted,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  btnHoje: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  btnHojeIcon: { fontSize: 14 },
  btnHojeText: { fontSize: 13, fontWeight: '600', color: C.text },
  btnHojeChevron: { fontSize: 10, color: C.muted },
  btnNova: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: C.blue,
  },
  btnNovaText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.white,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: C.muted,
    fontWeight: '500',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 38,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -1,
    lineHeight: 44,
  },
  statSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconText: {
    fontSize: 22,
  },
  skeleton: {
    width: 72,
    height: 40,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
  },

  // Main 2-col row
  mainRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  mainCard: {
    backgroundColor: C.white,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
  },
  linkText: {
    fontSize: 13,
    color: C.blue,
    fontWeight: '600',
  },

  // Table
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  thCell: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableRowEven: { backgroundColor: C.white },
  tableRowOdd:  { backgroundColor: '#FAFAFA' },
  tdCell: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
    textAlign: 'center',
  },
  tenantName: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
  },
  tenantCnpj: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tableFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  tableFooterLink: {
    fontSize: 13,
    color: C.blue,
    fontWeight: '600',
  },

  // Right panels
  certRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  certEmpresa: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text,
  },
  certTipo: {
    fontSize: 11,
    color: C.muted,
    marginTop: 1,
  },

  // Pipeline
  pipelineCard: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  pipelineTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
    marginBottom: 4,
  },
  pipelineSub: {
    fontSize: 12,
    color: C.muted,
    marginBottom: 24,
  },
  pipelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 0,
    flexWrap: 'nowrap',
  },
  pipelineStep: {
    alignItems: 'center',
    width: 96,
    gap: 6,
  },
  pipelineIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipelineIcon: {
    fontSize: 22,
  },
  pipelineLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.text,
    textAlign: 'center',
  },
  pipelineDesc: {
    fontSize: 10,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 14,
  },
  pipelineArrow: {
    fontSize: 18,
    color: C.muted,
    alignSelf: 'center',
    marginTop: -20,
    marginHorizontal: 2,
  },
  attentionCard: {
    flex: 1,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 16,
    marginLeft: 12,
    minWidth: 200,
  },
  attentionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },
  attentionText: {
    fontSize: 12,
    color: C.muted,
    lineHeight: 18,
    marginBottom: 12,
  },
  attentionBtn: {
    backgroundColor: C.red,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  attentionBtnText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '700',
  },
});
