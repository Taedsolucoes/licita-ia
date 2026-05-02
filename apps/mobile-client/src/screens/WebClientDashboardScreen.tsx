/**
 * WebClientDashboardScreen
 * Etapa 3 – Dashboard do Cliente (web-only)
 * Layout baseado na imagem de referência:
 *   - Header: titulo + empresa + sino + avatar
 *   - Row 1: Resumo de Participação (donut) + Valor Financeiro Ganho
 *   - Row 2: Oportunidades Recomendadas | Documentos e Certidões | Meu Perfil de Busca
 *   - Row 3: Licitações Vencidas
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { dashboardApi } from '../services/api';

// ─── Paleta ─────────────────────────────────────────────────────────────────
const C = {
  bg: '#F5F7FA',
  primary: '#2563EB',
  primaryDark: '#1E3A8A',
  green: '#10B981',
  greenBg: '#D1FAE5',
  red: '#EF4444',
  redBg: '#FEE2E2',
  yellow: '#F59E0B',
  yellowBg: '#FEF3C7',
  blueBg: '#EFF6FF',
  white: '#FFFFFF',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  cardShadow: '#0F172A',
};

// ─── API Types ───────────────────────────────────────────────────────────────

interface ParticipacaoSummary {
  totalOportunidades: number;
  participou: number;
  ganhou: number;
  pctParticipou: number;
  pctGanhou: number;
}

interface DashboardSummaryData {
  participacao: ParticipacaoSummary;
  valorTotalGanho: number | string;
  perfilBusca: {
    municipioBase?: string;
    raioKm?: number;
    participaMunicipal?: boolean;
    participaEstadual?: boolean;
    participaFederal?: boolean;
    modalidadePregao?: boolean;
    modalidadeDispensa?: boolean;
    notificaEmail?: boolean;
    notificaWhatsapp?: boolean;
    notificaPush?: boolean;
  } | null;
}

interface DocumentData {
  id: string;
  type: string;
  status: string;
  validUntil: string | null;
}

interface ResultData {
  id: string;
  status: string;
  valorContrato: number | null;
  prazoEntrega: string | null;
  obrigacoes: string | null;
  createdAt: string;
  bidding: {
    biddingNumber: string;
    agencyName: string;
    objectSummary: string;
    uf: string;
    municipalityName: string;
    openingDate: string | null;
  } | null;
}

// ─── Mock fallback data ───────────────────────────────────────────────────────

const MOCK_OPPORTUNITIES = [
  { id: '1', organ: 'Prefeitura de Joinville/SC', modality: 'Pregão Eletrônico', number: '45/2025', value: 'R$ 1.250.000,00', relevance: 'Alta' },
  { id: '2', organ: 'Governo do Estado SP',       modality: 'Pregão Eletrônico', number: '120/2025', value: 'R$ 850.000,00', relevance: 'Média' },
  { id: '3', organ: 'Autarquia Municipal de Saúde', modality: 'Dispensa Eletrônica', number: '30/2025', value: 'R$ 120.000,00', relevance: 'Alta' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Donut Chart (puro View/CSS) ──────────────────────────────────────────────

function DonutChart({ participated, won, total }: { participated: number; won: number; total: number }) {
  // Apenas representação visual com dois arcos via bordas coloridas em Views giradas
  const participatedPct = total > 0 ? (participated / total) * 100 : 0;
  const wonPct = total > 0 ? (won / total) * 100 : 0;

  return (
    <View style={donut.wrapper}>
      {/* Outer ring – Participou (azul) */}
      <View style={donut.ringOuter} />
      {/* Inner ring – Ganhou (verde), sobreposto girando */}
      <View
        style={[
          donut.ringInner,
          {
            borderColor: 'transparent',
            borderTopColor: C.green,
            borderRightColor: wonPct > 25 ? C.green : 'transparent',
            borderBottomColor: wonPct > 50 ? C.green : 'transparent',
            borderLeftColor: wonPct > 75 ? C.green : 'transparent',
          },
        ]}
      />
      {/* Center label */}
      <View style={donut.center}>
        <Text style={donut.centerNum}>{total}</Text>
        <Text style={donut.centerLabel}>Total</Text>
      </View>
    </View>
  );
}

const donut = StyleSheet.create({
  wrapper: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 14,
    borderColor: C.primary,
    opacity: 0.85,
  },
  ringInner: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 14,
    transform: [{ rotate: '-45deg' }],
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerNum: {
    fontSize: 22,
    fontWeight: '800',
    color: C.textPrimary,
  },
  centerLabel: {
    fontSize: 11,
    color: C.textSecondary,
    fontWeight: '600',
  },
});

// ─── Relevance Badge ──────────────────────────────────────────────────────────

function RelevanceBadge({ label }: { label: string }) {
  const isAlta = label === 'Alta';
  return (
    <View
      style={[
        badge.base,
        { backgroundColor: isAlta ? C.blueBg : C.yellowBg },
      ]}
    >
      <Text style={[badge.text, { color: isAlta ? C.primary : C.yellow }]}>{label}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  base: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});

// ─── Document Status Badge ────────────────────────────────────────────────────

function DocBadge({ status, label }: { status: string; label: string }) {
  const isExpiring = status === 'expiring';
  return (
    <View
      style={[
        docBadge.base,
        { backgroundColor: isExpiring ? C.redBg : C.greenBg },
      ]}
    >
      <Text style={[docBadge.text, { color: isExpiring ? C.red : C.green }]}>{label}</Text>
    </View>
  );
}

const docBadge = StyleSheet.create({
  base: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    flexShrink: 0,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});

// ─── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, linkText }: { title: string; linkText: string }) {
  return (
    <View style={sh.row}>
      <Text style={sh.title}>{title}</Text>
      <TouchableOpacity activeOpacity={0.7}>
        <Text style={sh.link}>{linkText}</Text>
      </TouchableOpacity>
    </View>
  );
}

const sh = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textPrimary,
  },
  link: {
    fontSize: 13,
    fontWeight: '600',
    color: C.primary,
  },
});

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[card.base, style]}>
      {children}
    </View>
  );
}

const card = StyleSheet.create({
  base: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 20,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 1px 4px rgba(15,23,42,0.08)',
        } as object)
      : {
          shadowColor: C.cardShadow,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 2,
        }),
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function WebClientDashboardScreen() {
  const { user } = useAuth();

  const [summary, setSummary]         = useState<DashboardSummaryData | null>(null);
  const [documents, setDocuments]     = useState<DocumentData[]>([]);
  const [results, setResults]         = useState<ResultData[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [sumRes, docsRes, resRes] = await Promise.all([
          dashboardApi.summary(),
          dashboardApi.documents(),
          dashboardApi.results(),
        ]);
        setSummary(sumRes.data as DashboardSummaryData);
        setDocuments(Array.isArray(docsRes.data) ? docsRes.data as DocumentData[] : []);
        setResults(Array.isArray(resRes.data) ? resRes.data as ResultData[] : []);
      } catch {
        // use empty/null state — UI will show fallback
      } finally {
        setLoadingSummary(false);
      }
    }
    loadData();
  }, []);

  const companyName = user?.fullName ?? 'Empresa';
  const initials = getInitials(companyName);
  const notificationCount = 2;

  // Participation data from API or zeros
  const participation = {
    total:       summary?.participacao?.totalOportunidades ?? 0,
    participated: summary?.participacao?.participou         ?? 0,
    won:          summary?.participacao?.ganhou             ?? 0,
  };

  const participatedPct = participation.total > 0
    ? ((participation.participated / participation.total) * 100).toFixed(1)
    : '0.0';
  const wonPct = participation.total > 0
    ? ((participation.won / participation.total) * 100).toFixed(1)
    : '0.0';

  // Format valor financeiro
  const valorBruto = Number(summary?.valorTotalGanho ?? 0);
  const valorFormatted = valorBruto > 0
    ? `R$ ${valorBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : 'R$ 0,00';

  // Perfil de busca from API or fallback text
  const perfil = summary?.perfilBusca;

  // Documents label helper
  function docLabel(doc: DocumentData): string {
    if (!doc.validUntil) return 'Sem vencimento';
    const dias = Math.ceil((new Date(doc.validUntil).getTime() - Date.now()) / 86400000);
    if (dias <= 0) return 'Vencida';
    if (dias <= 14) return `Vence em ${dias} dias`;
    return `Válida até ${new Date(doc.validUntil).toLocaleDateString('pt-BR')}`;
  }

  function docStatus(doc: DocumentData): string {
    if (!doc.validUntil) return doc.status;
    const dias = Math.ceil((new Date(doc.validUntil).getTime() - Date.now()) / 86400000);
    return dias <= 14 ? 'expiring' : 'valid';
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ── HEADER ────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Dashboard do Cliente</Text>
          <Text style={styles.headerSub}>{companyName}</Text>
        </View>
        <View style={styles.headerRight}>
          {/* Bell */}
          <View style={styles.bellWrapper}>
            <TouchableOpacity style={styles.bellBtn} activeOpacity={0.8}>
              <Text style={styles.bellIcon}>🔔</Text>
            </TouchableOpacity>
            {notificationCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{notificationCount}</Text>
              </View>
            )}
          </View>
          {/* Avatar */}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
      </View>

      {loadingSummary ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <>
          {/* ── ROW 1: Resumo de Participação + Valor Financeiro ──────── */}
          <View style={styles.row}>
            {/* Card 1a: Resumo de Participação */}
            <Card style={styles.flex1}>
              <Text style={styles.cardTitle}>Resumo de Participação</Text>
              <View style={styles.participationBody}>
                <DonutChart
                  participated={participation.participated}
                  won={participation.won}
                  total={participation.total}
                />
                <View style={styles.participationLegend}>
                  <View style={styles.legendRow}>
                    <View style={[styles.dot, { backgroundColor: C.primary }]} />
                    <Text style={styles.legendLabel}>Participou</Text>
                    <Text style={styles.legendValue}>
                      {participation.participated} ({participatedPct}%)
                    </Text>
                  </View>
                  <View style={styles.legendRow}>
                    <View style={[styles.dot, { backgroundColor: C.green }]} />
                    <Text style={styles.legendLabel}>Ganhou</Text>
                    <Text style={styles.legendValue}>
                      {participation.won} ({wonPct}%)
                    </Text>
                  </View>
                </View>
              </View>
            </Card>

            {/* Card 1b: Valor Financeiro Ganho */}
            <Card style={styles.flex1}>
              <View style={styles.valorHeader}>
                <View style={styles.valorIconCircle}>
                  <Text style={styles.valorIcon}>$</Text>
                </View>
                <Text style={styles.cardTitle}>Valor Financeiro Ganho</Text>
              </View>
              <Text style={styles.valorSubtitle}>Valor total conquistado até agora</Text>
              <Text style={styles.valorMain}>{valorFormatted}</Text>
              <View style={styles.valorGrowthRow}>
                <View style={styles.valorGrowthBadge}>
                  <Text style={styles.valorGrowthText}>↑ acumulado</Text>
                </View>
                <Text style={styles.valorGrowthLabel}>licitações vencidas</Text>
              </View>
            </Card>
          </View>

          {/* ── ROW 2: Oportunidades | Documentos | Perfil ───────────── */}
          <View style={[styles.row, styles.rowThree]}>
            {/* 2a: Oportunidades Recomendadas (mock - API não tem este endpoint ainda) */}
            <Card style={styles.flex1}>
              <SectionHeader title="Oportunidades Recomendadas" linkText="Ver todas" />
              {MOCK_OPPORTUNITIES.map((op, i) => (
                <View key={op.id} style={[styles.opItem, i < MOCK_OPPORTUNITIES.length - 1 && styles.opItemBorder]}>
                  <View style={styles.opRow1}>
                    <Text style={styles.opOrgan}>{op.organ}</Text>
                    <RelevanceBadge label={op.relevance} />
                  </View>
                  <View style={styles.opRow2}>
                    <Text style={styles.opModality}>{op.modality} {op.number}</Text>
                    <Text style={styles.opValue}>{op.value}</Text>
                  </View>
                </View>
              ))}
            </Card>

            {/* 2b: Documentos e Certidões - dados reais */}
            <Card style={styles.flex1}>
              <SectionHeader title="Documentos e Certidões" linkText="Ver todas" />
              {documents.length === 0 ? (
                <Text style={{ color: C.textSecondary, fontSize: 13, textAlign: 'center', padding: 16 }}>
                  Nenhum documento cadastrado
                </Text>
              ) : (
                documents.slice(0, 5).map((doc, i) => (
                  <View key={doc.id} style={[styles.docItem, i < Math.min(documents.length, 5) - 1 && styles.docItemBorder]}>
                    <View style={styles.docLeft}>
                      <Text style={styles.docIcon}>📄</Text>
                      <Text style={styles.docName}>{doc.type}</Text>
                    </View>
                    <DocBadge status={docStatus(doc)} label={docLabel(doc)} />
                  </View>
                ))
              )}
            </Card>

            {/* 2c: Meu Perfil de Busca - dados reais */}
            <Card style={styles.flex1}>
              <SectionHeader title="Meu Perfil de Busca" linkText="Editar" />
              {perfil ? (
                <>
                  <View style={styles.profileBlock}>
                    <Text style={styles.profileLabel}>Localização</Text>
                    <Text style={styles.profileValue}>
                      {perfil.municipioBase ?? '—'}{perfil.raioKm ? ` - Raio ${perfil.raioKm}km` : ''}
                    </Text>
                  </View>
                  <View style={styles.profileBlock}>
                    <Text style={styles.profileLabel}>Esfera</Text>
                    <Text style={styles.profileValue}>
                      {[
                        perfil.participaMunicipal ? 'Municipal' : '',
                        perfil.participaEstadual ? 'Estadual' : '',
                        perfil.participaFederal ? 'Federal' : '',
                      ].filter(Boolean).join(', ') || '—'}
                    </Text>
                  </View>
                  <View style={styles.profileBlock}>
                    <Text style={styles.profileLabel}>Modalidade</Text>
                    <Text style={styles.profileValue}>
                      {[
                        perfil.modalidadePregao ? 'Pregão Eletrônico' : '',
                        perfil.modalidadeDispensa ? 'Dispensa' : '',
                      ].filter(Boolean).join(', ') || '—'}
                    </Text>
                  </View>
                  <View style={styles.profileBlock}>
                    <Text style={styles.profileLabel}>Notificações</Text>
                    <Text style={styles.profileValue}>
                      {[
                        perfil.notificaEmail ? 'E-mail' : '',
                        perfil.notificaWhatsapp ? 'WhatsApp' : '',
                        perfil.notificaPush ? 'App' : '',
                      ].filter(Boolean).join(', ') || '—'}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={{ color: C.textSecondary, fontSize: 13 }}>Perfil não configurado</Text>
              )}
            </Card>
          </View>

          {/* ── ROW 3: Licitações Vencidas - dados reais ─────────────── */}
          <Card>
            <SectionHeader title="Licitações Vencidas" linkText="Ver todas" />
            {results.filter((r) => r.status === 'ganhou').length === 0 ? (
              <Text style={{ color: C.textSecondary, fontSize: 13, textAlign: 'center', padding: 16 }}>
                Nenhuma licitação vencida registrada
              </Text>
            ) : (
              results.filter((r) => r.status === 'ganhou').slice(0, 3).map((b) => (
                <View key={b.id}>
                  {/* Title row */}
                  <View style={styles.wonTitleRow}>
                    <Text style={styles.wonTitle}>
                      {b.bidding?.agencyName ?? '—'} – {b.bidding?.biddingNumber ?? b.id}
                    </Text>
                    <View style={styles.wonRight}>
                      <View style={styles.wonBadge}>
                        <Text style={styles.wonBadgeText}>GANHOU</Text>
                      </View>
                      <Text style={styles.wonValue}>
                        {b.valorContrato
                          ? `R$ ${Number(b.valorContrato).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : '—'}
                      </Text>
                    </View>
                  </View>

                  {/* Grid 5 colunas */}
                  <View style={styles.wonGrid}>
                    <View style={styles.wonCol}>
                      <Text style={styles.wonColLabel}>Data de Resultado</Text>
                      <Text style={styles.wonColValue}>
                        {new Date(b.createdAt).toLocaleDateString('pt-BR')}
                      </Text>
                    </View>
                    <View style={styles.wonCol}>
                      <Text style={styles.wonColLabel}>Valor Contrato</Text>
                      <Text style={styles.wonColValue}>
                        {b.valorContrato
                          ? `R$ ${Number(b.valorContrato).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : '—'}
                      </Text>
                    </View>
                    <View style={styles.wonCol}>
                      <Text style={styles.wonColLabel}>Prazo para Entrega</Text>
                      <Text style={styles.wonColValue}>
                        {b.prazoEntrega ? new Date(b.prazoEntrega).toLocaleDateString('pt-BR') : '—'}
                      </Text>
                    </View>
                    <View style={styles.wonCol}>
                      <Text style={styles.wonColLabel}>Local de Entrega</Text>
                      <Text style={styles.wonColValue}>
                        {b.bidding ? `${b.bidding.municipalityName}/${b.bidding.uf}` : '—'}
                      </Text>
                    </View>
                    <View style={styles.wonCol}>
                      <Text style={styles.wonColLabel}>Obrigações</Text>
                      <Text style={styles.wonColValue}>{b.obrigacoes ?? '—'}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </Card>
        </>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: C.bg,
  },
  container: {
    padding: 24,
    gap: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 18,
    marginBottom: 4,
  },
  headerLeft: {
    gap: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellWrapper: {
    position: 'relative',
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: { fontSize: 20 },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: C.white,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: C.primary,
  },

  // Rows
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  rowThree: {
    // handled by flex1 children
  },
  flex1: {
    flex: 1,
  },

  // Card title shared
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: 16,
  },

  // Participation
  participationBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  participationLegend: {
    gap: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 13,
    color: C.textSecondary,
    fontWeight: '500',
    minWidth: 70,
  },
  legendValue: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textPrimary,
  },

  // Valor financeiro
  valorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  valorIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.blueBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valorIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: C.primary,
  },
  valorSubtitle: {
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: 8,
  },
  valorMain: {
    fontSize: 36,
    fontWeight: '800',
    color: C.green,
    letterSpacing: -1,
    marginBottom: 10,
  },
  valorGrowthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  valorGrowthBadge: {
    backgroundColor: C.greenBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  valorGrowthText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.green,
  },
  valorGrowthLabel: {
    fontSize: 12,
    color: C.textSecondary,
  },

  // Oportunidades
  opItem: {
    paddingVertical: 10,
  },
  opItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  opRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  opOrgan: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  opRow2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  opModality: {
    fontSize: 12,
    color: C.textSecondary,
  },
  opValue: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textPrimary,
  },

  // Documentos
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  docItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  docLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  docIcon: { fontSize: 16 },
  docName: {
    fontSize: 13,
    color: C.textPrimary,
    fontWeight: '500',
    flex: 1,
  },

  // Perfil de busca
  profileBlock: {
    marginBottom: 10,
  },
  profileLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: 2,
  },
  profileValue: {
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 18,
  },

  // Licitações vencidas
  wonTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  wonTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textPrimary,
    flex: 1,
  },
  wonRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  wonBadge: {
    backgroundColor: C.greenBg,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  wonBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.green,
    letterSpacing: 0.5,
  },
  wonValue: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textPrimary,
  },
  wonGrid: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  wonCol: {
    flex: 1,
    gap: 4,
  },
  wonColLabel: {
    fontSize: 11,
    color: C.textSecondary,
    fontWeight: '500',
  },
  wonColValue: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textPrimary,
  },
  wonDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  wonDetailIcon: { fontSize: 14 },
  wonDetailLink: {
    fontSize: 13,
    fontWeight: '600',
    color: C.primary,
  },

  bottomPad: {
    height: 8,
  },
});
