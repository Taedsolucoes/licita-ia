/**
 * AdminOpportunitiesScreen
 * Tela de Oportunidades para administradores (web-only)
 * Layout: dark azul #1B365D principal, fundo #F5F7FA
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { opportunitiesApi, adminApi } from '../../services/api';

// ─── Paleta ──────────────────────────────────────────────────────────────────
const C = {
  bg: '#F5F7FA',
  primary: '#1B365D',
  primaryLight: '#2A4F87',
  primaryLighter: '#3B6CA8',
  accent: '#2563EB',
  accentLight: '#EFF6FF',
  green: '#10B981',
  greenBg: '#D1FAE5',
  red: '#EF4444',
  redBg: '#FEE2E2',
  yellow: '#F59E0B',
  yellowBg: '#FEF3C7',
  orange: '#F97316',
  orangeBg: '#FFF7ED',
  purple: '#8B5CF6',
  purpleBg: '#EDE9FE',
  white: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  tableHover: '#F8FAFF',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Opportunity {
  id: string;
  sessionDate?: string;
  openingDate?: string;
  biddingNumber?: string;
  objectSummary?: string;
  agencyName?: string;
  modality?: string;
  uf?: string;
  estimatedValue?: number;
  relevanceScore?: number;
  status?: string;
  editalLink?: string;
  documents?: OpportunityDoc[];
  companies?: RecommendedCompany[];
  history?: HistoryEvent[];
}

interface OpportunityDoc {
  id: string;
  name: string;
  required: boolean;
}

interface RecommendedCompany {
  id: string;
  tenantId: string;
  corporateName: string;
  tradeName?: string;
  cnpj?: string;
  cnaeCode?: string;
  cnaeDescription?: string;
  compatibilityScore?: number;
}

interface HistoryEvent {
  id: string;
  event: string;
  description?: string;
  createdAt: string;
}

interface Metrics {
  received: number;
  receivedDelta: number;
  awaitingEval: number;
  sentToClients: number;
  clientsInterested: number;
  inDispute: number;
  finished: number;
}

// ─── Mock data realista ───────────────────────────────────────────────────────
const MOCK_OPPORTUNITIES: Opportunity[] = [
  {
    id: '1',
    sessionDate: '2025-06-15T09:00:00Z',
    biddingNumber: 'PE-045/2025',
    objectSummary: 'Aquisição de equipamentos de informática para as secretarias municipais',
    agencyName: 'Prefeitura Municipal de Joinville/SC',
    modality: 'Pregão Eletrônico',
    uf: 'SC',
    estimatedValue: 1250000,
    relevanceScore: 92,
    status: 'em_disputa',
    editalLink: 'https://pncp.gov.br/editais/PE-045-2025',
    documents: [
      { id: 'd1', name: 'Habilitação Jurídica', required: true },
      { id: 'd2', name: 'Regularidade Fiscal Federal', required: true },
      { id: 'd3', name: 'Regularidade Fiscal Estadual', required: true },
      { id: 'd4', name: 'Qualificação Técnica', required: true },
      { id: 'd5', name: 'Proposta Comercial', required: true },
    ],
    companies: [
      { id: 'c1', tenantId: 't1', corporateName: 'Tech Solutions Ltda', tradeName: 'TechSol', cnpj: '12.345.678/0001-90', cnaeCode: '4751-2/01', cnaeDescription: 'Comércio varejista especializado de equipamentos e suprimentos de informática', compatibilityScore: 95 },
      { id: 'c2', tenantId: 't2', corporateName: 'InfoPro Sistemas S.A.', cnpj: '98.765.432/0001-10', cnaeCode: '4751-2/01', compatibilityScore: 87 },
      { id: 'c3', tenantId: 't3', corporateName: 'Digital Corp Distribuidora Ltda', cnpj: '45.678.901/0001-23', cnaeCode: '4651-6/01', cnaeDescription: 'Comércio atacadista de equipamentos de informática', compatibilityScore: 73 },
    ],
    history: [
      { id: 'h1', event: 'Capturado', description: 'Edital capturado automaticamente pelo sistema', createdAt: '2025-05-28T10:00:00Z' },
      { id: 'h2', event: 'Em Avaliação', description: 'IA iniciou análise de compatibilidade', createdAt: '2025-05-28T10:05:00Z' },
      { id: 'h3', event: 'Enviado', description: 'Enviado para 3 empresas compatíveis', createdAt: '2025-05-29T14:30:00Z' },
      { id: 'h4', event: 'Interesse Confirmado', description: 'Tech Solutions confirmou interesse', createdAt: '2025-05-30T09:15:00Z' },
    ],
  },
  {
    id: '2',
    sessionDate: '2025-06-20T10:00:00Z',
    biddingNumber: 'CC-012/2025',
    objectSummary: 'Contratação de serviços de limpeza e conservação para prédios públicos estaduais',
    agencyName: 'Governo do Estado de São Paulo',
    modality: 'Concorrência',
    uf: 'SP',
    estimatedValue: 3800000,
    relevanceScore: 78,
    status: 'aguardando_avaliacao',
    editalLink: 'https://pncp.gov.br/editais/CC-012-2025',
    documents: [
      { id: 'd6', name: 'Atestado de Capacidade Técnica', required: true },
      { id: 'd7', name: 'Certidão Negativa de Débitos', required: true },
    ],
    companies: [
      { id: 'c4', tenantId: 't4', corporateName: 'LimpMax Serviços Ltda', cnpj: '22.333.444/0001-55', cnaeCode: '8121-4/00', cnaeDescription: 'Limpeza em prédios e em domicílios', compatibilityScore: 89 },
    ],
    history: [
      { id: 'h5', event: 'Capturado', description: 'Edital capturado automaticamente', createdAt: '2025-06-01T08:00:00Z' },
    ],
  },
  {
    id: '3',
    sessionDate: '2025-06-10T14:00:00Z',
    biddingNumber: 'DE-089/2025',
    objectSummary: 'Fornecimento de materiais de escritório para órgão federal',
    agencyName: 'Ministério da Educação',
    modality: 'Dispensa Eletrônica',
    uf: 'DF',
    estimatedValue: 48000,
    relevanceScore: 65,
    status: 'enviada_clientes',
    editalLink: 'https://pncp.gov.br/editais/DE-089-2025',
    documents: [
      { id: 'd8', name: 'CNPJ Ativo', required: true },
      { id: 'd9', name: 'Proposta de Preço', required: true },
    ],
    companies: [
      { id: 'c5', tenantId: 't5', corporateName: 'OfficeSupply Brasil', tradeName: 'OSB', cnpj: '77.888.999/0001-66', cnaeCode: '4761-0/03', compatibilityScore: 81 },
      { id: 'c6', tenantId: 't6', corporateName: 'Papelaria Central Distribuidora', cnpj: '33.444.555/0001-77', cnaeCode: '4761-0/03', compatibilityScore: 70 },
    ],
    history: [
      { id: 'h6', event: 'Capturado', createdAt: '2025-05-25T11:00:00Z' },
      { id: 'h7', event: 'Avaliado', createdAt: '2025-05-26T09:00:00Z' },
      { id: 'h8', event: 'Enviado aos Clientes', createdAt: '2025-05-27T15:00:00Z' },
    ],
  },
  {
    id: '4',
    sessionDate: '2025-05-30T09:30:00Z',
    biddingNumber: 'PE-201/2025',
    objectSummary: 'Aquisição de medicamentos e insumos hospitalares para rede pública municipal',
    agencyName: 'Secretaria Municipal de Saúde - Curitiba/PR',
    modality: 'Pregão Eletrônico',
    uf: 'PR',
    estimatedValue: 920000,
    relevanceScore: 88,
    status: 'interesse_cliente',
    editalLink: 'https://pncp.gov.br/editais/PE-201-2025',
    documents: [],
    companies: [],
    history: [],
  },
  {
    id: '5',
    sessionDate: '2025-05-15T08:00:00Z',
    biddingNumber: 'PE-133/2025',
    objectSummary: 'Prestação de serviços de tecnologia da informação e suporte técnico',
    agencyName: 'Tribunal de Justiça do Rio de Janeiro',
    modality: 'Pregão Eletrônico',
    uf: 'RJ',
    estimatedValue: 5600000,
    relevanceScore: 95,
    status: 'ganhou',
    editalLink: 'https://pncp.gov.br/editais/PE-133-2025',
    documents: [],
    companies: [],
    history: [],
  },
  {
    id: '6',
    sessionDate: '2025-04-20T10:00:00Z',
    biddingNumber: 'CC-007/2025',
    objectSummary: 'Reforma e ampliação de unidade de pronto atendimento municipal',
    agencyName: 'Prefeitura Municipal de Porto Alegre/RS',
    modality: 'Concorrência',
    uf: 'RS',
    estimatedValue: 12000000,
    relevanceScore: 55,
    status: 'finalizada',
    editalLink: 'https://pncp.gov.br/editais/CC-007-2025',
    documents: [],
    companies: [],
    history: [],
  },
];

const MOCK_METRICS: Metrics = {
  received: 47,
  receivedDelta: 8,
  awaitingEval: 12,
  sentToClients: 23,
  clientsInterested: 15,
  inDispute: 6,
  finished: 9,
};

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  aguardando_avaliacao: { label: 'Aguardando Avaliação', color: C.yellow, bg: C.yellowBg },
  enviada_clientes:     { label: 'Enviada aos Clientes', color: C.accent, bg: C.accentLight },
  interesse_cliente:    { label: 'Interesse Confirmado', color: C.purple, bg: C.purpleBg },
  em_disputa:           { label: 'Em Disputa',           color: C.orange, bg: C.orangeBg },
  ganhou:               { label: 'Ganhou',               color: C.green,  bg: C.greenBg },
  perdeu:               { label: 'Perdeu',               color: C.red,    bg: C.redBg },
  finalizada:           { label: 'Finalizada',           color: C.textSecondary, bg: C.border },
  capturada:            { label: 'Capturada',            color: C.primary, bg: '#EBF0FA' },
};

const UF_OPTIONS = ['Todos', 'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const MODALITY_OPTIONS = ['Todas', 'Pregão Eletrônico', 'Concorrência', 'Dispensa Eletrônica', 'Tomada de Preços', 'Leilão', 'Credenciamento'];
const STATUS_OPTIONS = ['Todos', 'Aguardando Avaliação', 'Enviada aos Clientes', 'Interesse Confirmado', 'Em Disputa', 'Ganhou', 'Finalizada'];

const PIPELINE_STEPS = [
  { label: 'Captura',   icon: '⬇', statuses: ['capturada'] },
  { label: 'Avaliação', icon: '🔍', statuses: ['aguardando_avaliacao'] },
  { label: 'Envio',     icon: '📤', statuses: ['enviada_clientes'] },
  { label: 'Interesse', icon: '👍', statuses: ['interesse_cliente'] },
  { label: 'Disputa',   icon: '⚖', statuses: ['em_disputa'] },
  { label: 'Resultado', icon: '🏆', statuses: ['ganhou', 'perdeu', 'finalizada'] },
];

// ─── Helper formatters ─────────────────────────────────────────────────────────
function formatCurrency(val?: number): string {
  if (!val) return '—';
  return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
interface MetricCardProps {
  icon: string;
  iconColor: string;
  iconBg: string;
  label: string;
  value: number;
  delta?: number;
}

function MetricCard({ icon, iconColor, iconBg, label, value, delta }: MetricCardProps) {
  return (
    <View style={metric.card}>
      <View style={[metric.iconWrap, { backgroundColor: iconBg }]}>
        <Text style={[metric.iconText, { color: iconColor }]}>{icon}</Text>
      </View>
      <Text style={metric.value}>{value}</Text>
      <Text style={metric.label}>{label}</Text>
      {delta !== undefined && (
        <View style={metric.deltaRow}>
          <Text style={[metric.delta, { color: delta >= 0 ? C.green : C.red }]}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} hoje
          </Text>
        </View>
      )}
    </View>
  );
}

const metric = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'flex-start',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 1px 4px rgba(15,23,42,0.07)' } as object)
      : { elevation: 2 }),
    minWidth: 120,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  iconText: { fontSize: 18 },
  value: {
    fontSize: 28,
    fontWeight: '800',
    color: C.textPrimary,
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 16,
  },
  deltaRow: { marginTop: 4 },
  delta: { fontSize: 11, fontWeight: '700' },
});

// ─── Filter Dropdown ──────────────────────────────────────────────────────────
interface FilterDropdownProps {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}

function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <View style={filter.wrapper}>
      <TouchableOpacity
        style={filter.trigger}
        onPress={() => setOpen(!open)}
        activeOpacity={0.8}
      >
        <Text style={filter.triggerText} numberOfLines={1}>{value || label}</Text>
        <Text style={filter.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={filter.dropdown}>
          <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[filter.option, value === opt && filter.optionActive]}
                onPress={() => { onChange(opt); setOpen(false); }}
                activeOpacity={0.7}
              >
                <Text style={[filter.optionText, value === opt && filter.optionTextActive]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const filter = StyleSheet.create({
  wrapper: { position: 'relative', minWidth: 150 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  triggerText: {
    fontSize: 13,
    color: C.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  chevron: {
    fontSize: 10,
    color: C.textSecondary,
  },
  dropdown: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    zIndex: 999,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 16px rgba(15,23,42,0.14)' } as object)
      : { elevation: 10 }),
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  optionActive: { backgroundColor: C.accentLight },
  optionText: {
    fontSize: 13,
    color: C.textPrimary,
  },
  optionTextActive: {
    color: C.accent,
    fontWeight: '700',
  },
});

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string }) {
  const cfg = STATUS_CONFIG[status ?? ''] ?? { label: status ?? 'N/A', color: C.textSecondary, bg: C.border };
  return (
    <View style={[sbadge.base, { backgroundColor: cfg.bg }]}>
      <Text style={[sbadge.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const sbadge = StyleSheet.create({
  base: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});

// ─── Relevance Bar ─────────────────────────────────────────────────────────────
function RelevanceBar({ score }: { score?: number }) {
  const pct = score ?? 0;
  const color = pct >= 80 ? C.green : pct >= 60 ? C.yellow : C.red;
  return (
    <View style={rel.wrapper}>
      <View style={rel.track}>
        <View style={[rel.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[rel.label, { color }]}>{pct}%</Text>
    </View>
  );
}

const rel = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  track: {
    flex: 1,
    height: 6,
    backgroundColor: C.border,
    borderRadius: 3,
    overflow: 'hidden',
    minWidth: 60,
  },
  fill: { height: 6, borderRadius: 3 },
  label: { fontSize: 12, fontWeight: '700', minWidth: 32 },
});

// ─── Side Panel ───────────────────────────────────────────────────────────────
interface SidePanelProps {
  opportunity: Opportunity | null;
  visible: boolean;
  onClose: () => void;
  onParticipate: (opportunityId: string, tenantId: string) => Promise<void>;
}

function SidePanel({ opportunity, visible, onClose, onParticipate }: SidePanelProps) {
  const slideAnim = useRef(new Animated.Value(500)).current;
  const [activeTab, setActiveTab] = useState<'detalhes' | 'empresas' | 'documentos' | 'historico'>('detalhes');
  const [participatingId, setParticipatingId] = useState<string | null>(null);
  const [participatedIds, setParticipatedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : 500,
      duration: 280,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [visible, slideAnim]);

  useEffect(() => {
    if (visible) setActiveTab('detalhes');
  }, [opportunity?.id, visible]);

  if (!visible && !opportunity) return null;

  const tabs: Array<{ key: typeof activeTab; label: string }> = [
    { key: 'detalhes', label: 'Detalhes' },
    { key: 'empresas', label: 'Empresas' },
    { key: 'documentos', label: 'Documentos' },
    { key: 'historico', label: 'Histórico' },
  ];

  async function handleParticipate(tenantId: string) {
    if (!opportunity) return;
    setParticipatingId(tenantId);
    try {
      await onParticipate(opportunity.id, tenantId);
      setParticipatedIds((prev) => new Set(prev).add(tenantId));
    } finally {
      setParticipatingId(null);
    }
  }

  return (
    <>
      {/* Overlay */}
      {visible && (
        <TouchableOpacity
          style={panel.overlay}
          onPress={onClose}
          activeOpacity={1}
        />
      )}

      {/* Panel */}
      <Animated.View
        style={[
          panel.container,
          Platform.OS === 'web'
            ? { transform: [{ translateX: slideAnim }] }
            : { transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* Header */}
        <View style={panel.header}>
          <View style={panel.headerLeft}>
            <Text style={panel.headerTitle} numberOfLines={2}>
              {opportunity?.biddingNumber ?? 'Oportunidade'}
            </Text>
            <Text style={panel.headerSub} numberOfLines={1}>
              {opportunity?.agencyName ?? ''}
            </Text>
          </View>
          <TouchableOpacity style={panel.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={panel.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={panel.tabs}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[panel.tab, activeTab === tab.key && panel.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[panel.tabText, activeTab === tab.key && panel.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Body */}
        <ScrollView style={panel.body} showsVerticalScrollIndicator={false}>
          {activeTab === 'detalhes' && opportunity && (
            <View style={{ gap: 14 }}>
              <InfoRow label="Edital" value={opportunity.biddingNumber} />
              <InfoRow label="Órgão" value={opportunity.agencyName} />
              <InfoRow label="Objeto" value={opportunity.objectSummary} multiline />
              <InfoRow label="Modalidade" value={opportunity.modality} />
              <InfoRow label="UF" value={opportunity.uf} />
              <InfoRow label="Valor Estimado" value={formatCurrency(opportunity.estimatedValue)} />
              <InfoRow label="Data da Sessão" value={formatDate(opportunity.sessionDate)} />
              <View style={prow.row}>
                <Text style={prow.label}>Status</Text>
                <StatusBadge status={opportunity.status} />
              </View>
              <View style={prow.row}>
                <Text style={prow.label}>Relevância</Text>
                <RelevanceBar score={opportunity.relevanceScore} />
              </View>
              {opportunity.editalLink && (
                <View style={prow.row}>
                  <Text style={prow.label}>Link do Edital</Text>
                  <Text style={[prow.value, { color: C.accent }]} numberOfLines={1}>
                    {opportunity.editalLink}
                  </Text>
                </View>
              )}
            </View>
          )}

          {activeTab === 'empresas' && (
            <View style={{ gap: 12 }}>
              {!opportunity?.companies?.length ? (
                <Text style={panel.emptyText}>Nenhuma empresa recomendada</Text>
              ) : (
                opportunity.companies.map((company) => {
                  const alreadyParticipated = participatedIds.has(company.tenantId);
                  return (
                    <View key={company.id} style={panel.companyCard}>
                      <View style={panel.companyHeader}>
                        <View style={panel.companyAvatar}>
                          <Text style={panel.companyAvatarText}>
                            {(company.tradeName ?? company.corporateName).slice(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={panel.companyName}>
                            {company.tradeName ?? company.corporateName}
                          </Text>
                          <Text style={panel.companyCnpj}>{company.cnpj}</Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            panel.sendBtn,
                            alreadyParticipated && panel.sendBtnDone,
                          ]}
                          onPress={() => handleParticipate(company.tenantId)}
                          disabled={!!participatingId || alreadyParticipated}
                          activeOpacity={0.8}
                        >
                          {participatingId === company.tenantId ? (
                            <ActivityIndicator size="small" color={C.white} />
                          ) : (
                            <Text style={panel.sendBtnText}>
                              {alreadyParticipated ? '✓ Enviado' : 'Enviar'}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                      <View style={{ marginTop: 10 }}>
                        <Text style={panel.cnaeLabel}>
                          CNAE: {company.cnaeCode} — {company.cnaeDescription ?? 'N/A'}
                        </Text>
                        <View style={panel.compatRow}>
                          <Text style={panel.compatLabel}>Compatibilidade</Text>
                          <RelevanceBar score={company.compatibilityScore} />
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {activeTab === 'documentos' && (
            <View style={{ gap: 8 }}>
              {!opportunity?.documents?.length ? (
                <Text style={panel.emptyText}>Nenhum documento necessário cadastrado</Text>
              ) : (
                opportunity.documents.map((doc) => (
                  <View key={doc.id} style={panel.docItem}>
                    <Text style={panel.docIcon}>📄</Text>
                    <Text style={panel.docName}>{doc.name}</Text>
                    {doc.required && (
                      <View style={panel.reqBadge}>
                        <Text style={panel.reqBadgeText}>Obrigatório</Text>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          )}

          {activeTab === 'historico' && (
            <View style={{ gap: 0 }}>
              {!opportunity?.history?.length ? (
                <Text style={panel.emptyText}>Nenhum evento registrado</Text>
              ) : (
                opportunity.history.map((event, idx) => (
                  <View key={event.id} style={panel.timelineItem}>
                    <View style={panel.timelineLeft}>
                      <View style={panel.timelineDot} />
                      {idx < (opportunity.history?.length ?? 0) - 1 && (
                        <View style={panel.timelineLine} />
                      )}
                    </View>
                    <View style={panel.timelineContent}>
                      <Text style={panel.timelineEvent}>{event.event}</Text>
                      {event.description && (
                        <Text style={panel.timelineDesc}>{event.description}</Text>
                      )}
                      <Text style={panel.timelineDate}>
                        {formatDate(event.createdAt)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </>
  );
}

function InfoRow({ label, value, multiline }: { label: string; value?: string; multiline?: boolean }) {
  return (
    <View style={prow.row}>
      <Text style={prow.label}>{label}</Text>
      <Text style={[prow.value, multiline && { flex: 1 }]} numberOfLines={multiline ? 4 : 1}>
        {value ?? '—'}
      </Text>
    </View>
  );
}

const prow = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  label: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: '600',
    minWidth: 120,
    marginTop: 1,
  },
  value: {
    fontSize: 13,
    color: C.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
});

const panel = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 99,
  },
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 460,
    backgroundColor: C.white,
    zIndex: 100,
    flexDirection: 'column',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '-4px 0 24px rgba(15,23,42,0.12)' } as object)
      : { elevation: 12 }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.primary,
  },
  headerLeft: { flex: 1, gap: 4, marginRight: 12 },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.white,
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 14,
    color: C.white,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: C.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: C.textSecondary,
  },
  tabTextActive: {
    color: C.primary,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    padding: 20,
  },
  emptyText: {
    fontSize: 13,
    color: C.textSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },
  companyCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 14,
  },
  companyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  companyAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: C.accent,
  },
  companyName: {
    fontSize: 14,
    fontWeight: '700',
    color: C.textPrimary,
  },
  companyCnpj: {
    fontSize: 11,
    color: C.textSecondary,
  },
  sendBtn: {
    backgroundColor: C.accent,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 68,
    alignItems: 'center',
  },
  sendBtnDone: {
    backgroundColor: C.green,
  },
  sendBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.white,
  },
  cnaeLabel: {
    fontSize: 11,
    color: C.textSecondary,
    marginBottom: 6,
  },
  compatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compatLabel: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: '500',
    minWidth: 90,
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  docIcon: { fontSize: 18 },
  docName: {
    flex: 1,
    fontSize: 13,
    color: C.textPrimary,
    fontWeight: '500',
  },
  reqBadge: {
    backgroundColor: C.redBg,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  reqBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.red,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 16,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.accent,
    marginTop: 3,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: C.border,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    gap: 2,
  },
  timelineEvent: {
    fontSize: 14,
    fontWeight: '700',
    color: C.textPrimary,
  },
  timelineDesc: {
    fontSize: 12,
    color: C.textSecondary,
  },
  timelineDate: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 2,
  },
});

// ─── Pipeline Steps ───────────────────────────────────────────────────────────
function PipelineFooter({ activeStatus }: { activeStatus?: string }) {
  const activeIdx = PIPELINE_STEPS.findIndex((s) =>
    s.statuses.includes(activeStatus ?? '')
  );

  return (
    <View style={pipe.container}>
      {PIPELINE_STEPS.map((step, idx) => {
        const isActive = idx === activeIdx;
        const isDone = idx < activeIdx;
        return (
          <React.Fragment key={step.label}>
            <View style={pipe.step}>
              <View
                style={[
                  pipe.iconWrap,
                  isDone && pipe.iconDone,
                  isActive && pipe.iconActive,
                ]}
              >
                <Text style={pipe.icon}>{isDone ? '✓' : step.icon}</Text>
              </View>
              <Text
                style={[
                  pipe.label,
                  isActive && pipe.labelActive,
                  isDone && pipe.labelDone,
                ]}
              >
                {step.label}
              </Text>
            </View>
            {idx < PIPELINE_STEPS.length - 1 && (
              <View style={[pipe.connector, isDone && pipe.connectorDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const pipe = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 1px 4px rgba(15,23,42,0.07)' } as object)
      : { elevation: 2 }),
  },
  step: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDone: {
    backgroundColor: C.green,
  },
  iconActive: {
    backgroundColor: C.primary,
  },
  icon: { fontSize: 16 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textSecondary,
    textAlign: 'center',
  },
  labelActive: {
    color: C.primary,
    fontWeight: '800',
  },
  labelDone: {
    color: C.green,
  },
  connector: {
    height: 2,
    flex: 0.4,
    backgroundColor: C.border,
    marginBottom: 20,
  },
  connectorDone: {
    backgroundColor: C.green,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function AdminOpportunitiesScreen() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [metrics, setMetrics] = useState<Metrics>(MOCK_METRICS);
  const [loading, setLoading] = useState(true);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);

  // Filters
  const [filterCompany, setFilterCompany] = useState('Todas');
  const [filterUF, setFilterUF] = useState('Todos');
  const [filterModality, setFilterModality] = useState('Todas');
  const [filterStatus, setFilterStatus] = useState('Todos');

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await opportunitiesApi.list({ page: 1, limit: 100 });
      const data = Array.isArray(res.data) ? res.data : res.data?.data ?? res.data?.items ?? [];
      if (data.length > 0) {
        setOpportunities(data as Opportunity[]);
      } else {
        setOpportunities(MOCK_OPPORTUNITIES);
      }
    } catch {
      // API unavailable — use mock data
      setOpportunities(MOCK_OPPORTUNITIES);
    } finally {
      setLoading(false);
    }

    // Try to load metrics from admin API
    try {
      const statsRes = await adminApi.stats();
      if (statsRes.data) {
        const d = statsRes.data as Record<string, number>;
        setMetrics({
          received:          d.totalOpportunities ?? MOCK_METRICS.received,
          receivedDelta:     d.todayReceived       ?? MOCK_METRICS.receivedDelta,
          awaitingEval:      d.awaitingEvaluation  ?? MOCK_METRICS.awaitingEval,
          sentToClients:     d.sentToClients       ?? MOCK_METRICS.sentToClients,
          clientsInterested: d.clientsInterested   ?? MOCK_METRICS.clientsInterested,
          inDispute:         d.inDispute           ?? MOCK_METRICS.inDispute,
          finished:          d.finished            ?? MOCK_METRICS.finished,
        });
      }
    } catch {
      // keep mock metrics
    }
  }

  async function handleParticipate(opportunityId: string, tenantId: string) {
    await opportunitiesApi.participateWithTenant(opportunityId, tenantId);
  }

  function openPanel(opp: Opportunity) {
    setSelectedOpp(opp);
    setPanelVisible(true);
  }

  function closePanel() {
    setPanelVisible(false);
    setTimeout(() => setSelectedOpp(null), 300);
  }

  // Filtered opportunities
  const filtered = opportunities.filter((o) => {
    if (filterUF !== 'Todos' && o.uf !== filterUF) return false;
    if (filterModality !== 'Todas' && o.modality !== filterModality) return false;
    if (filterStatus !== 'Todos') {
      const cfg = Object.entries(STATUS_CONFIG).find(([, v]) => v.label === filterStatus);
      if (cfg && o.status !== cfg[0]) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activePipelineStatus = selectedOpp?.status;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Oportunidades</Text>
            <Text style={styles.headerSub}>Gestão de editais e licitações</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8}>
              <Text style={styles.actionBtnText}>🔍 Filtrar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8}>
              <Text style={styles.actionBtnText}>📥 Exportar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={loadData}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnText, { color: C.white }]}>↻ Atualizar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── METRICS ROW ───────────────────────────────────────────── */}
        <View style={styles.metricsRow}>
          <MetricCard
            icon="📥"
            iconColor="#2563EB"
            iconBg="#EFF6FF"
            label="Editais Recebidos"
            value={metrics.received}
            delta={metrics.receivedDelta}
          />
          <MetricCard
            icon="⏰"
            iconColor={C.yellow}
            iconBg={C.yellowBg}
            label="Aguardando Avaliação"
            value={metrics.awaitingEval}
          />
          <MetricCard
            icon="📤"
            iconColor={C.accent}
            iconBg={C.accentLight}
            label="Enviadas aos Clientes"
            value={metrics.sentToClients}
          />
          <MetricCard
            icon="❤"
            iconColor={C.red}
            iconBg={C.redBg}
            label="Interessadas"
            value={metrics.clientsInterested}
          />
          <MetricCard
            icon="⚖"
            iconColor={C.orange}
            iconBg={C.orangeBg}
            label="Em Disputa"
            value={metrics.inDispute}
          />
          <MetricCard
            icon="✓"
            iconColor={C.green}
            iconBg={C.greenBg}
            label="Finalizadas"
            value={metrics.finished}
          />
        </View>

        {/* ── FILTER ROW ────────────────────────────────────────────── */}
        <View style={styles.filterRow}>
          <FilterDropdown
            label="Empresa"
            value={filterCompany}
            options={['Todas', 'Tech Solutions Ltda', 'InfoPro Sistemas', 'LimpMax Serviços']}
            onChange={setFilterCompany}
          />
          <FilterDropdown
            label="Estado (UF)"
            value={filterUF}
            options={UF_OPTIONS}
            onChange={(v) => { setFilterUF(v); setPage(1); }}
          />
          <FilterDropdown
            label="Modalidade"
            value={filterModality}
            options={MODALITY_OPTIONS}
            onChange={(v) => { setFilterModality(v); setPage(1); }}
          />
          <FilterDropdown
            label="Status"
            value={filterStatus}
            options={STATUS_OPTIONS}
            onChange={(v) => { setFilterStatus(v); setPage(1); }}
          />
          <View style={styles.filterSpacer} />
          <Text style={styles.resultCount}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</Text>
        </View>

        {/* ── TABLE ─────────────────────────────────────────────────── */}
        <View style={styles.tableCard}>
          {/* Table header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.thText, { flex: 1.2 }]}>Data Sessão</Text>
            <Text style={[styles.thText, { flex: 3 }]}>Edital / Objeto</Text>
            <Text style={[styles.thText, { flex: 2 }]}>Órgão</Text>
            <Text style={[styles.thText, { flex: 1.5 }]}>Modalidade</Text>
            <Text style={[styles.thText, { flex: 0.6 }]}>UF</Text>
            <Text style={[styles.thText, { flex: 1.5 }]}>Valor Estimado</Text>
            <Text style={[styles.thText, { flex: 1.5 }]}>Relevância</Text>
            <Text style={[styles.thText, { flex: 1.5 }]}>Status</Text>
            <Text style={[styles.thText, { flex: 0.8 }]}>Ações</Text>
          </View>

          {loading ? (
            <View style={styles.tableLoading}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={{ color: C.textSecondary, marginTop: 12 }}>Carregando oportunidades...</Text>
            </View>
          ) : paginated.length === 0 ? (
            <View style={styles.tableLoading}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📋</Text>
              <Text style={{ color: C.textSecondary, fontSize: 14 }}>Nenhuma oportunidade encontrada</Text>
            </View>
          ) : (
            paginated.map((opp, idx) => (
              <TouchableOpacity
                key={opp.id}
                style={[
                  styles.tableRow,
                  idx % 2 === 1 && styles.tableRowAlt,
                  selectedOpp?.id === opp.id && styles.tableRowSelected,
                ]}
                onPress={() => openPanel(opp)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tdText, { flex: 1.2 }]}>
                  {formatDate(opp.sessionDate ?? opp.openingDate)}
                </Text>
                <View style={{ flex: 3, gap: 2 }}>
                  <Text style={styles.tdBold} numberOfLines={1}>
                    {opp.biddingNumber ?? '—'}
                  </Text>
                  <Text style={styles.tdSub} numberOfLines={1}>
                    {opp.objectSummary ?? '—'}
                  </Text>
                </View>
                <Text style={[styles.tdText, { flex: 2 }]} numberOfLines={1}>
                  {opp.agencyName ?? '—'}
                </Text>
                <Text style={[styles.tdText, { flex: 1.5 }]} numberOfLines={1}>
                  {opp.modality ?? '—'}
                </Text>
                <Text style={[styles.tdText, { flex: 0.6 }]}>
                  {opp.uf ?? '—'}
                </Text>
                <Text style={[styles.tdText, { flex: 1.5 }]} numberOfLines={1}>
                  {formatCurrency(opp.estimatedValue)}
                </Text>
                <View style={{ flex: 1.5 }}>
                  <RelevanceBar score={opp.relevanceScore} />
                </View>
                <View style={{ flex: 1.5 }}>
                  <StatusBadge status={opp.status} />
                </View>
                <View style={[styles.tdActions, { flex: 0.8 }]}>
                  <TouchableOpacity
                    style={styles.actionIcon}
                    onPress={() => openPanel(opp)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionIconText}>👁</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionIcon} activeOpacity={0.7}>
                    <Text style={styles.actionIconText}>⋮</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}

          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <View style={styles.pagination}>
              <Text style={styles.paginationInfo}>
                Mostrando {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
              </Text>
              <View style={styles.paginationBtns}>
                <TouchableOpacity
                  style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
                  onPress={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pageBtnText}>‹ Anterior</Text>
                </TouchableOpacity>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.pageBtn, p === page && styles.pageBtnActive]}
                      onPress={() => setPage(p)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pageBtnText, p === page && styles.pageBtnTextActive]}>
                        {p}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.pageBtn, page === totalPages && styles.pageBtnDisabled]}
                  onPress={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pageBtnText}>Próxima ›</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── PIPELINE FOOTER ───────────────────────────────────────── */}
        <View>
          <Text style={styles.pipelineTitle}>Fluxo de Processamento</Text>
          <PipelineFooter activeStatus={selectedOpp?.status} />
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── SIDE PANEL ────────────────────────────────────────────────── */}
      <SidePanel
        opportunity={selectedOpp}
        visible={panelVisible}
        onClose={closePanel}
        onParticipate={handleParticipate}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    position: 'relative',
    overflow: 'hidden',
  },
  scroll: { flex: 1 },
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
    flexWrap: 'wrap',
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  actionBtnPrimary: {
    backgroundColor: C.accent,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.white,
  },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },

  // Filters
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 16,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 1px 4px rgba(15,23,42,0.07)' } as object)
      : { elevation: 2 }),
    zIndex: 10,
  },
  filterSpacer: { flex: 1 },
  resultCount: {
    fontSize: 13,
    color: C.textSecondary,
    fontWeight: '500',
  },

  // Table
  tableCard: {
    backgroundColor: C.white,
    borderRadius: 12,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 1px 4px rgba(15,23,42,0.07)' } as object)
      : { elevation: 2 }),
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  thText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowAlt: {
    backgroundColor: '#FAFBFC',
  },
  tableRowSelected: {
    backgroundColor: C.accentLight,
  },
  tableLoading: {
    padding: 48,
    alignItems: 'center',
  },
  tdText: {
    fontSize: 13,
    color: C.textPrimary,
  },
  tdBold: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textPrimary,
  },
  tdSub: {
    fontSize: 11,
    color: C.textSecondary,
  },
  tdActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionIcon: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconText: { fontSize: 14 },

  // Pagination
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexWrap: 'wrap',
    gap: 8,
  },
  paginationInfo: {
    fontSize: 13,
    color: C.textSecondary,
  },
  paginationBtns: {
    flexDirection: 'row',
    gap: 4,
  },
  pageBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  pageBtnActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textPrimary,
  },
  pageBtnTextActive: {
    color: C.white,
  },

  // Pipeline
  pipelineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
