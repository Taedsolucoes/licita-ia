/**
 * AdminOpportunitiesScreen — versão fiel à imagem de referência
 * Layout: sidebar escura já existente + conteúdo principal
 * Cores primárias: #1B365D (header), fundo #F5F7FA, branco para cards
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { opportunitiesApi, adminApi, api } from '../../services/api';

// ─── Paleta ──────────────────────────────────────────────────────────────────
const C = {
  bg: '#F5F7FA',
  primary: '#1B365D',
  primaryLight: '#2A4F87',
  accent: '#2563EB',
  accentLight: '#EFF6FF',
  green: '#10B981',
  greenBg: '#D1FAE5',
  greenLight: '#ECFDF5',
  red: '#EF4444',
  redBg: '#FEE2E2',
  pink: '#EC4899',
  pinkBg: '#FCE7F3',
  yellow: '#F59E0B',
  yellowBg: '#FEF3C7',
  orange: '#F97316',
  orangeBg: '#FFF7ED',
  purple: '#8B5CF6',
  purpleBg: '#EDE9FE',
  white: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  tableBg: '#FAFBFC',
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
  modalityDetail?: string;
  uf?: string;
  municipalityName?: string;
  estimatedValue?: number;
  relevanceScore?: number;
  status?: string;
  editalLink?: string;
  sessionLocal?: string;
  tipoJulgamento?: string;
  registroPreco?: boolean;
  prazoEntrega?: string;
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
  cnaeCodes?: string[];
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
  awaitingDelta: number;
  sentToClients: number;
  sentDelta: number;
  clientsInterested: number;
  inDispute: number;
  finished: number;
  finishedDelta: number;
}

interface Tenant {
  id: string;
  corporateName: string;
  tradeName?: string;
  cnpj?: string;
  cnaeCodes?: string[];
  keywords?: string[];
  regions?: { uf: string }[];
}

// ─── KPI filter key type ──────────────────────────────────────────────────────
type KpiFilterKey =
  | 'all'
  | 'aguardando_avaliacao'
  | 'enviada_clientes'
  | 'interesse_cliente'
  | 'em_disputa'
  | 'finalizada';

// ─── Mock data realista ───────────────────────────────────────────────────────
const MOCK_METRICS: Metrics = {
  received: 128,
  receivedDelta: 12,
  awaitingEval: 34,
  awaitingDelta: 5,
  sentToClients: 56,
  sentDelta: 8,
  clientsInterested: 18,
  inDispute: 7,
  finished: 32,
  finishedDelta: 3,
};

const MOCK_OPPORTUNITIES: Opportunity[] = [
  {
    id: '1',
    sessionDate: '2024-05-22T10:00:00Z',
    biddingNumber: '123/2024',
    objectSummary: 'Aquisição de Material de Construção',
    agencyName: 'Prefeitura Municipal de São Carlos',
    modality: 'Pregão Eletrônico',
    modalityDetail: 'Menor Preço',
    uf: 'SP',
    municipalityName: 'São Carlos',
    estimatedValue: 320000,
    relevanceScore: 92,
    status: 'aguardando_avaliacao',
    editalLink: 'https://saocarloes.sp.gov.br/edital123',
    sessionLocal: 'São Carlos - SP',
    tipoJulgamento: 'Menor Preço',
    registroPreco: true,
    prazoEntrega: '30 dias',
    documents: [
      { id: 'd1', name: 'Habilitação Jurídica', required: true },
      { id: 'd2', name: 'Regularidade Fiscal Federal', required: true },
      { id: 'd3', name: 'Regularidade Fiscal Estadual', required: true },
      { id: 'd4', name: 'Qualificação Técnica', required: true },
      { id: 'd5', name: 'Proposta Comercial', required: true },
    ],
    companies: [
      { id: 'c1', tenantId: 't1', corporateName: 'Construtora Excelência LTDA', cnpj: '12.345.678/0001-90', cnaeCodes: ['4120-4/00', '4211-1/01', '4399-1/03'], compatibilityScore: 92 },
      { id: 'c2', tenantId: 't2', corporateName: 'Comercial Alpha LTDA', cnpj: '56.789.012/0001-34', cnaeCodes: ['4673-7/00', '4744-0/99'], compatibilityScore: 85 },
      { id: 'c3', tenantId: 't3', corporateName: 'Distribuidora Forte LTDA', cnpj: '34.567.890/0001-12', cnaeCodes: ['4663-0/00', '4671-1/00'], compatibilityScore: 72 },
      { id: 'c4', tenantId: 't4', corporateName: 'Tech Solutions LTDA', cnpj: '45.678.901/0001-23', cnaeCodes: ['4741-5/00'], compatibilityScore: 58 },
      { id: 'c5', tenantId: 't5', corporateName: 'Serviços & Limpeza LTDA', cnpj: '23.456.789/0001-01', cnaeCodes: ['8121-4/00'], compatibilityScore: 38 },
    ],
    history: [
      { id: 'h1', event: 'Capturado', description: 'Edital capturado automaticamente', createdAt: '2024-05-10T10:00:00Z' },
      { id: 'h2', event: 'Em Avaliação', description: 'IA analisando compatibilidade', createdAt: '2024-05-10T10:05:00Z' },
      { id: 'h3', event: 'Aguardando Avaliação', description: 'Aguardando revisão manual', createdAt: '2024-05-11T08:00:00Z' },
    ],
  },
  {
    id: '2',
    sessionDate: '2024-05-24T09:30:00Z',
    biddingNumber: '456/2024',
    objectSummary: 'Serviços de Limpeza e Conservação',
    agencyName: 'Governo do Estado de Minas Gerais',
    modality: 'Pregão Eletrônico',
    modalityDetail: 'Menor Preço',
    uf: 'MG',
    municipalityName: 'Belo Horizonte',
    estimatedValue: 1250000,
    relevanceScore: 86,
    status: 'aguardando_avaliacao',
    sessionLocal: 'Belo Horizonte - MG',
    editalLink: 'https://compras.mg.gov.br/edital456',
    tipoJulgamento: 'Menor Preço',
    registroPreco: false,
    prazoEntrega: '60 dias',
    companies: [],
    documents: [],
    history: [],
  },
  {
    id: '3',
    sessionDate: '2024-05-27T14:00:00Z',
    biddingNumber: '789/2024',
    objectSummary: 'Aquisição de Equipamentos de Informática',
    agencyName: 'Instituto Federal de Educação',
    modality: 'Pregão Eletrônico',
    modalityDetail: 'Menor Preço',
    uf: 'SP',
    municipalityName: 'Campinas',
    estimatedValue: 180000,
    relevanceScore: 68,
    status: 'aguardando_avaliacao',
    sessionLocal: 'Campinas - SP',
    editalLink: '',
    tipoJulgamento: 'Menor Preço',
    registroPreco: true,
    prazoEntrega: '45 dias',
    companies: [],
    documents: [],
    history: [],
  },
  {
    id: '4',
    sessionDate: '2024-05-28T11:00:00Z',
    biddingNumber: '101/2024',
    objectSummary: 'Obras de Pavimentação Asfáltica',
    agencyName: 'Prefeitura Municipal de Ribeirão Preto',
    modality: 'Concorrência Eletrônica',
    modalityDetail: 'Menor Preço',
    uf: 'SP',
    municipalityName: 'Ribeirão Preto',
    estimatedValue: 2800000,
    relevanceScore: 90,
    status: 'aguardando_avaliacao',
    sessionLocal: 'Ribeirão Preto - SP',
    editalLink: '',
    tipoJulgamento: 'Menor Preço',
    registroPreco: false,
    prazoEntrega: '180 dias',
    companies: [],
    documents: [],
    history: [],
  },
  {
    id: '5',
    sessionDate: '2024-05-30T08:30:00Z',
    biddingNumber: '202/2024',
    objectSummary: 'Fornecimento de Medicamentos',
    agencyName: 'Secretaria de Saúde do Estado do Paraná',
    modality: 'Pregão Eletrônico',
    modalityDetail: 'Menor Preço',
    uf: 'PR',
    municipalityName: 'Curitiba',
    estimatedValue: 950000,
    relevanceScore: 62,
    status: 'aguardando_avaliacao',
    sessionLocal: 'Curitiba - PR',
    editalLink: '',
    tipoJulgamento: 'Menor Preço',
    registroPreco: true,
    prazoEntrega: '30 dias',
    companies: [],
    documents: [],
    history: [],
  },
  {
    id: '6',
    sessionDate: '2024-06-03T10:00:00Z',
    biddingNumber: '303/2024',
    objectSummary: 'Contratação de Serviços de TI',
    agencyName: 'Ministério da Economia',
    modality: 'Pregão Eletrônico',
    modalityDetail: 'Menor Preço',
    uf: 'DF',
    municipalityName: 'Brasília',
    estimatedValue: 3500000,
    relevanceScore: 95,
    status: 'aguardando_avaliacao',
    sessionLocal: 'Brasília - DF',
    editalLink: '',
    tipoJulgamento: 'Menor Preço',
    registroPreco: false,
    prazoEntrega: '12 meses',
    companies: [],
    documents: [],
    history: [],
  },
];

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  aguardando_avaliacao: { label: 'Aguardando avaliação', color: C.orange, bg: C.orangeBg },
  enviada_clientes:     { label: 'Enviada aos clientes', color: C.accent, bg: C.accentLight },
  interesse_cliente:    { label: 'Interesse confirmado', color: C.purple, bg: C.purpleBg },
  em_disputa:           { label: 'Em disputa',           color: C.pink,   bg: C.pinkBg },
  ganhou:               { label: 'Ganhou',               color: C.green,  bg: C.greenBg },
  perdeu:               { label: 'Perdeu',               color: C.red,    bg: C.redBg },
  finalizada:           { label: 'Finalizada',           color: C.textSecondary, bg: C.border },
  capturada:            { label: 'Capturada',            color: C.primary, bg: '#EBF0FA' },
};

const UF_OPTIONS  = ['Todos os Estados','AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const MOD_OPTIONS = ['Todas Modalidades','Pregão Eletrônico','Concorrência Eletrônica','Dispensa Eletrônica','Tomada de Preços','Leilão'];
const STA_OPTIONS = ['Todos os Status','Aguardando avaliação','Enviada aos clientes','Interesse confirmado','Em disputa','Ganhou','Finalizada'];

const PIPELINE_STEPS = [
  { label: '1. Captura',   icon: '📋', desc: 'Recebemos editais de múltiplas fontes' },
  { label: '2. Avaliação', icon: '✏️', desc: 'Você avalia a relevância para cada cliente' },
  { label: '3. Envio',     icon: '📤', desc: 'Oportunidade enviada para o cliente' },
  { label: '4. Interesse', icon: '❤️', desc: 'Cliente demonstra interesse' },
  { label: '5. Disputa',   icon: '⚖️', desc: 'Você cadastra e gerencia a disputa' },
  { label: '6. Resultado', icon: '✅', desc: 'Acompanhe o resultado e o contrato' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatCurrency(val?: number): string {
  if (!val) return '—';
  return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString('pt-BR')}\n${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch { return '—'; }
}

function formatDateShort(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  } catch { return '—'; }
}

function localString(opp: Opportunity): string {
  if (opp.sessionLocal) return opp.sessionLocal;
  if (opp.municipalityName && opp.uf) return `${opp.municipalityName} - ${opp.uf}`;
  return opp.uf ?? '—';
}

// ─── Relevance Dots ──────────────────────────────────────────────────────────
function RelevanceDots({ score }: { score?: number }) {
  const pct = score ?? 0;
  const filled = Math.round((pct / 100) * 5);
  const color = pct >= 80 ? C.green : pct >= 60 ? C.yellow : C.red;
  const badgeLabel = pct >= 80 ? 'Alta' : pct >= 60 ? 'Média' : 'Baixa';
  const badgeColor = pct >= 80 ? C.green : pct >= 60 ? C.yellow : C.red;
  const badgeBg   = pct >= 80 ? C.greenBg : pct >= 60 ? C.yellowBg : C.redBg;
  return (
    <View style={dots.wrapper}>
      <View style={dots.dotsRow}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[dots.dot, { backgroundColor: i <= filled ? color : C.border }]}
          />
        ))}
        <Text style={[dots.pct, { color }]}>{pct}%</Text>
      </View>
      <View style={[dots.badge, { backgroundColor: badgeBg }]}>
        <Text style={[dots.badgeText, { color: badgeColor }]}>{badgeLabel}</Text>
      </View>
    </View>
  );
}
const dots = StyleSheet.create({
  wrapper:   { gap: 4 },
  dotsRow:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot:       { width: 8, height: 8, borderRadius: 4 },
  pct:       { fontSize: 12, fontWeight: '700', marginLeft: 2 },
  badge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
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
  base: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '700' },
});

// ─── Compat Badge ─────────────────────────────────────────────────────────────
function CompatBadge({ score }: { score?: number }) {
  const pct = score ?? 0;
  const filled = Math.round((pct / 100) * 5);
  const label = pct >= 80 ? 'Alta' : pct >= 60 ? 'Média' : 'Baixa';
  const color = pct >= 80 ? C.green : pct >= 60 ? C.yellow : C.red;
  const bg    = pct >= 80 ? C.greenBg : pct >= 60 ? C.yellowBg : C.redBg;
  return (
    <View style={compat.wrapper}>
      <View style={compat.dotsRow}>
        {[1,2,3,4,5].map((i) => (
          <View key={i} style={[compat.dot, { backgroundColor: i <= filled ? color : C.border }]} />
        ))}
        <Text style={[compat.pct, { color }]}>{pct}%</Text>
      </View>
      <View style={[compat.badge, { backgroundColor: bg }]}>
        <Text style={[compat.badgeText, { color }]}>{label}</Text>
      </View>
    </View>
  );
}
const compat = StyleSheet.create({
  wrapper:   { gap: 3 },
  dotsRow:   { flexDirection: 'row', alignItems: 'center', gap: 2 },
  dot:       { width: 7, height: 7, borderRadius: 4 },
  pct:       { fontSize: 11, fontWeight: '700', marginLeft: 2 },
  badge:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 20, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '700' },
});

// ─── Metric Card (clickable) ──────────────────────────────────────────────────
interface MetricCardProps {
  label: string;
  value: number;
  icon: string;
  iconColor: string;
  iconBg: string;
  delta?: number;
  actionLabel?: string;
  active?: boolean;
  onPress?: () => void;
}
function MetricCard({ label, value, icon, iconColor, iconBg, delta, actionLabel, active, onPress }: MetricCardProps) {
  return (
    <TouchableOpacity
      style={[mc.card, active && mc.cardActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={mc.top}>
        <Text style={mc.label}>{label}</Text>
        <View style={[mc.iconWrap, { backgroundColor: iconBg }]}>
          <Text style={[mc.icon, { color: iconColor }]}>{icon}</Text>
        </View>
      </View>
      <Text style={mc.value}>{value}</Text>
      {delta !== undefined ? (
        <Text style={[mc.delta, { color: C.green }]}>+{delta} hoje</Text>
      ) : actionLabel ? (
        <Text style={[mc.delta, { color: C.accent }]}>{actionLabel}</Text>
      ) : null}
      {active && <View style={mc.activeDot} />}
    </TouchableOpacity>
  );
}
const mc = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 16,
    minWidth: 110,
    borderWidth: 2,
    borderColor: 'transparent',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 1px 4px rgba(15,23,42,0.07)' } as object) : { elevation: 2 }),
  },
  cardActive: {
    borderColor: '#2563EB',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 0 0 3px rgba(37,99,235,0.15)' } as object) : {}),
  },
  top:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  label: { fontSize: 12, color: C.textSecondary, fontWeight: '500', flex: 1, lineHeight: 16 },
  iconWrap: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  icon:  { fontSize: 16 },
  value: { fontSize: 32, fontWeight: '800', color: C.textPrimary, letterSpacing: -1 },
  delta: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  activeDot: { position: 'absolute', bottom: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB' },
});

// ─── Filter Dropdown ──────────────────────────────────────────────────────────
function FilterDropdown({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={fd.wrap}>
      <TouchableOpacity style={fd.trigger} onPress={() => setOpen(!open)} activeOpacity={0.8}>
        <Text style={fd.text} numberOfLines={1}>{value}</Text>
        <Text style={fd.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={fd.dropdown}>
          <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
            {options.map((opt) => (
              <TouchableOpacity key={opt} style={[fd.opt, value === opt && fd.optActive]}
                onPress={() => { onChange(opt); setOpen(false); }} activeOpacity={0.7}>
                <Text style={[fd.optText, value === opt && fd.optTextActive]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
const fd = StyleSheet.create({
  wrap:    { position: 'relative', minWidth: 140 },
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  text:    { fontSize: 13, color: C.textPrimary, fontWeight: '500', flex: 1 },
  chevron: { fontSize: 9, color: C.textSecondary },
  dropdown: { position: 'absolute', top: 38, left: 0, right: 0, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 8, zIndex: 999, ...(Platform.OS === 'web' ? ({ boxShadow: '0 4px 16px rgba(15,23,42,0.14)' } as object) : { elevation: 10 }) },
  opt:     { paddingHorizontal: 12, paddingVertical: 9 },
  optActive: { backgroundColor: C.accentLight },
  optText: { fontSize: 13, color: C.textPrimary },
  optTextActive: { color: C.accent, fontWeight: '700' },
});

// ─── Organ Avatar ─────────────────────────────────────────────────────────────
function OrganAvatar({ name }: { name?: string }) {
  const initials = name
    ? name.split(' ').filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || name.slice(0, 2).toUpperCase()
    : 'OR';
  const colors = [C.green, C.accent, C.orange, C.purple, C.pink, '#14B8A6', '#8B5CF6'];
  const idx = (name?.charCodeAt(0) ?? 0) % colors.length;
  return (
    <View style={[oa.circle, { backgroundColor: colors[idx] + '22' }]}>
      <Text style={[oa.text, { color: colors[idx] }]}>{initials}</Text>
    </View>
  );
}
const oa = StyleSheet.create({
  circle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  text:   { fontSize: 11, fontWeight: '800' },
});

// ─── Side Panel ───────────────────────────────────────────────────────────────
interface SidePanelProps {
  opportunity: Opportunity | null;
  visible: boolean;
  onClose: () => void;
  onParticipate: (oppId: string, tenantId: string) => Promise<void>;
  onMarkNotRelevant: (oppId: string) => void;
}

type PanelTab = 'detalhes' | 'empresas' | 'documentos' | 'historico';

function SidePanel({ opportunity, visible, onClose, onParticipate, onMarkNotRelevant }: SidePanelProps) {
  const slideAnim = useRef(new Animated.Value(520)).current;
  const [tab, setTab] = useState<PanelTab>('empresas');
  const [participatingId, setParticipatingId] = useState<string | null>(null);
  const [participatedIds, setParticipatedIds] = useState<Set<string>>(new Set());
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : 520,
      duration: 260,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [visible, slideAnim]);

  useEffect(() => {
    if (visible) {
      setTab('empresas');
      setSelectedCompanies(new Set());
      setParticipatedIds(new Set());
    }
  }, [opportunity?.id, visible]);

  if (!visible && !opportunity) return null;

  const opp = opportunity!;
  const companies = opp.companies ?? [];
  const selectedCount = selectedCompanies.size;

  async function handleParticipate(tenantId: string) {
    if (!opp) return;
    setParticipatingId(tenantId);
    try {
      await onParticipate(opp.id, tenantId);
      setParticipatedIds((prev) => new Set(prev).add(tenantId));
    } finally {
      setParticipatingId(null);
    }
  }

  function toggleCompany(tenantId: string) {
    setSelectedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(tenantId)) next.delete(tenantId);
      else next.add(tenantId);
      return next;
    });
  }

  const TABS: Array<{ key: PanelTab; label: string; count?: number }> = [
    { key: 'detalhes',   label: 'Detalhes' },
    { key: 'empresas',   label: 'Empresas Recomendadas', count: companies.length },
    { key: 'documentos', label: 'Documentos' },
    { key: 'historico',  label: 'Histórico' },
  ];

  const relevScore = opp.relevanceScore ?? 0;
  const relevLabel = relevScore >= 80 ? 'Alta Relevância' : relevScore >= 60 ? 'Média Relevância' : 'Baixa Relevância';
  const relevColor = relevScore >= 80 ? C.green : relevScore >= 60 ? C.yellow : C.red;
  const relevBg    = relevScore >= 80 ? C.greenBg : relevScore >= 60 ? C.yellowBg : C.redBg;

  return (
    <>
      {visible && <TouchableOpacity style={sp.overlay} onPress={onClose} activeOpacity={1} />}
      <Animated.View style={[sp.container, { transform: [{ translateX: slideAnim }] }]}>
        {/* Header */}
        <View style={sp.header}>
          <Text style={sp.headerTitle}>Detalhes da Oportunidade</Text>
          <TouchableOpacity style={sp.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={sp.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={sp.body} showsVerticalScrollIndicator={false}>
          {/* Opportunity name + badge */}
          <View style={sp.titleSection}>
            <View style={sp.titleRow}>
              <Text style={sp.oppTitle}>{opp.objectSummary ?? '—'}</Text>
              <View style={[sp.relevBadge, { backgroundColor: relevBg }]}>
                <Text style={[sp.relevBadgeText, { color: relevColor }]}>{relevLabel}</Text>
              </View>
            </View>
            <Text style={sp.editalNum}>Edital nº {opp.biddingNumber ?? '—'}</Text>

            {/* Quick info row */}
            <View style={sp.quickRow}>
              <View style={sp.quickItem}>
                <Text style={sp.quickIcon}>📅</Text>
                <Text style={sp.quickText}>{formatDateShort(opp.sessionDate ?? opp.openingDate)} às {opp.sessionDate ? new Date(opp.sessionDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}</Text>
              </View>
              <View style={sp.quickItem}>
                <Text style={sp.quickIcon}>📍</Text>
                <Text style={sp.quickText}>{localString(opp)}</Text>
              </View>
              <View style={sp.quickItem}>
                <Text style={sp.quickIcon}>📋</Text>
                <Text style={sp.quickText}>{opp.modality ?? '—'}</Text>
              </View>
            </View>

            <View style={sp.organRow}>
              <Text style={sp.organLabel}>Órgão:</Text>
              <OrganAvatar name={opp.agencyName} />
              <Text style={sp.organName}>{opp.agencyName ?? '—'}</Text>
            </View>

            <View style={sp.valorRow}>
              <Text style={sp.valorLabel}>Valor Estimado:</Text>
              <Text style={sp.valorValue}>{formatCurrency(opp.estimatedValue)}</Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={sp.tabs}>
            {TABS.map((t) => (
              <TouchableOpacity key={t.key} style={[sp.tab, tab === t.key && sp.tabActive]} onPress={() => setTab(t.key)} activeOpacity={0.7}>
                <Text style={[sp.tabText, tab === t.key && sp.tabTextActive]}>
                  {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab content */}
          <View style={sp.tabContent}>
            {tab === 'empresas' && (
              <View style={{ gap: 12 }}>
                <Text style={sp.tabDesc}>
                  Empresas que possuem maior compatibilidade com esta licitação com base nos filtros e CNAEs cadastrados.
                </Text>

                {/* Companies table header */}
                <View style={sp.compTableHeader}>
                  <Text style={[sp.compTh, { flex: 2 }]}>Empresa</Text>
                  <Text style={[sp.compTh, { flex: 2 }]}>CNAEs Compatíveis</Text>
                  <Text style={[sp.compTh, { flex: 1.5 }]}>Compatibilidade</Text>
                  <Text style={[sp.compTh, { flex: 1, textAlign: 'right' }]}>Ação</Text>
                </View>

                {companies.length === 0 ? (
                  <Text style={sp.emptyText}>Nenhuma empresa recomendada</Text>
                ) : companies.map((company) => {
                  const done = participatedIds.has(company.tenantId);
                  return (
                    <View key={company.id} style={sp.compRow}>
                      <View style={{ flex: 2, gap: 2 }}>
                        <Text style={sp.compName} numberOfLines={2}>{company.corporateName}</Text>
                        <Text style={sp.compCnpj}>{company.cnpj}</Text>
                      </View>
                      <View style={{ flex: 2 }}>
                        <Text style={sp.cnaeText} numberOfLines={3}>
                          {(company.cnaeCodes ?? []).join(', ') || '—'}
                        </Text>
                      </View>
                      <View style={{ flex: 1.5 }}>
                        <CompatBadge score={company.compatibilityScore} />
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <TouchableOpacity
                          style={[sp.sendBtn, done && sp.sendBtnDone]}
                          onPress={() => handleParticipate(company.tenantId)}
                          disabled={!!participatingId || done}
                          activeOpacity={0.8}
                        >
                          {participatingId === company.tenantId ? (
                            <ActivityIndicator size="small" color={C.white} />
                          ) : (
                            <Text style={sp.sendBtnText}>{done ? '✓' : '📤 Enviar'}</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}

                {/* Informações da Licitação */}
                <View style={sp.infoSection}>
                  <Text style={sp.infoTitle}>Informações da Licitação</Text>
                  <View style={sp.infoGrid}>
                    <InfoCell label="Objeto" value={opp.objectSummary} wide />
                    <InfoCell label="Órgão" value={opp.agencyName} />
                    <InfoCell label="Modalidade" value={opp.modality} />
                    <InfoCell label="Valor Estimado" value={formatCurrency(opp.estimatedValue)} />
                    <InfoCell label="Tipo Julgamento" value={opp.tipoJulgamento} />
                    <InfoCell label="Registro de Preço" value={opp.registroPreco ? 'Sim' : 'Não'} />
                    <InfoCell label="Data da Sessão" value={formatDateShort(opp.sessionDate ?? opp.openingDate)} />
                    <InfoCell label="Prazo Entrega" value={opp.prazoEntrega} />
                    <InfoCell label="Local Sessão" value={localString(opp)} />
                    <InfoCell label="Link do Edital" value={opp.editalLink} isLink />
                  </View>
                </View>
              </View>
            )}

            {tab === 'detalhes' && (
              <View style={{ gap: 10 }}>
                <InfoCell label="Edital nº" value={opp.biddingNumber} />
                <InfoCell label="Objeto" value={opp.objectSummary} wide />
                <InfoCell label="Órgão" value={opp.agencyName} />
                <InfoCell label="Modalidade" value={opp.modality} />
                <InfoCell label="Tipo de Julgamento" value={opp.tipoJulgamento} />
                <InfoCell label="Registro de Preço" value={opp.registroPreco ? 'Sim' : 'Não'} />
                <InfoCell label="UF" value={opp.uf} />
                <InfoCell label="Local" value={localString(opp)} />
                <InfoCell label="Valor Estimado" value={formatCurrency(opp.estimatedValue)} />
                <InfoCell label="Data da Sessão" value={formatDateShort(opp.sessionDate ?? opp.openingDate)} />
                <InfoCell label="Prazo Entrega" value={opp.prazoEntrega} />
                <InfoCell label="Link do Edital" value={opp.editalLink} isLink />
              </View>
            )}

            {tab === 'documentos' && (
              <View style={{ gap: 8 }}>
                {!opp.documents?.length ? (
                  <Text style={sp.emptyText}>Nenhum documento necessário cadastrado</Text>
                ) : opp.documents.map((doc) => (
                  <View key={doc.id} style={sp.docItem}>
                    <Text style={sp.docIcon}>📄</Text>
                    <Text style={sp.docName}>{doc.name}</Text>
                    {doc.required && (
                      <View style={sp.reqBadge}><Text style={sp.reqText}>Obrigatório</Text></View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {tab === 'historico' && (
              <View>
                {!opp.history?.length ? (
                  <Text style={sp.emptyText}>Nenhum evento registrado</Text>
                ) : opp.history.map((ev, idx) => (
                  <View key={ev.id} style={sp.timelineItem}>
                    <View style={sp.timelineLeft}>
                      <View style={sp.timelineDot} />
                      {idx < (opp.history?.length ?? 0) - 1 && <View style={sp.timelineLine} />}
                    </View>
                    <View style={sp.timelineBody}>
                      <Text style={sp.timelineEvent}>{ev.event}</Text>
                      {ev.description && <Text style={sp.timelineDesc}>{ev.description}</Text>}
                      <Text style={sp.timelineDate}>{formatDateShort(ev.createdAt)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* Footer */}
        <View style={sp.footer}>
          <TouchableOpacity
            style={sp.footerBtnGhost}
            onPress={() => onMarkNotRelevant(opp.id)}
            activeOpacity={0.8}
          >
            <Text style={sp.footerBtnGhostText}>Marcar como não relevante</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[sp.footerBtnPrimary, selectedCount === 0 && { opacity: 0.5 }]}
            disabled={selectedCount === 0}
            activeOpacity={0.8}
          >
            <Text style={sp.footerBtnPrimaryText}>
              📤 Enviar para selecionadas ({selectedCount})
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </>
  );
}

function InfoCell({ label, value, wide, isLink }: { label: string; value?: string | null; wide?: boolean; isLink?: boolean }) {
  return (
    <View style={[ic.row, wide && ic.rowWide]}>
      <Text style={ic.label}>{label}</Text>
      {isLink && value ? (
        <Text style={ic.link} numberOfLines={1}>{value}</Text>
      ) : (
        <Text style={ic.value} numberOfLines={wide ? 3 : 1}>{value || '—'}</Text>
      )}
    </View>
  );
}
const ic = StyleSheet.create({
  row:     { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  rowWide: { flexDirection: 'column', gap: 2 },
  label:   { fontSize: 12, color: C.textSecondary, fontWeight: '600', minWidth: 120 },
  value:   { fontSize: 13, color: C.textPrimary, fontWeight: '500', flex: 1 },
  link:    { fontSize: 13, color: C.accent, fontWeight: '500', flex: 1 },
});

const sp = StyleSheet.create({
  overlay:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.22)', zIndex: 99 },
  container: {
    position: 'absolute', top: 0, right: 0, bottom: 0, width: 520,
    backgroundColor: C.white, zIndex: 100, flexDirection: 'column',
    ...(Platform.OS === 'web' ? ({ boxShadow: '-4px 0 32px rgba(15,23,42,0.14)' } as object) : { elevation: 16 }),
  },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.textPrimary },
  closeBtn:  { width: 32, height: 32, borderRadius: 16, backgroundColor: C.borderLight, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 14, color: C.textSecondary, fontWeight: '700' },

  body:  { flex: 1 },

  titleSection: { padding: 20, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
  titleRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' },
  oppTitle:     { fontSize: 16, fontWeight: '800', color: C.textPrimary, flex: 1 },
  relevBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  relevBadgeText: { fontSize: 12, fontWeight: '700' },
  editalNum:    { fontSize: 13, color: C.textSecondary },
  quickRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickItem:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quickIcon:    { fontSize: 13 },
  quickText:    { fontSize: 12, color: C.textSecondary, fontWeight: '500' },
  organRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  organLabel:   { fontSize: 13, color: C.textSecondary, fontWeight: '600' },
  organName:    { fontSize: 13, color: C.textPrimary, fontWeight: '600' },
  valorRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  valorLabel:   { fontSize: 13, color: C.textSecondary, fontWeight: '600' },
  valorValue:   { fontSize: 16, fontWeight: '800', color: C.textPrimary },

  tabs:         { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 4 },
  tab:          { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: C.primary },
  tabText:      { fontSize: 12, fontWeight: '500', color: C.textSecondary, textAlign: 'center' },
  tabTextActive:{ color: C.primary, fontWeight: '700' },
  tabContent:   { padding: 16 },
  tabDesc:      { fontSize: 12, color: C.textSecondary, lineHeight: 18, marginBottom: 12 },

  emptyText:    { fontSize: 13, color: C.textSecondary, textAlign: 'center', paddingVertical: 24 },

  compTableHeader: { flexDirection: 'row', backgroundColor: C.borderLight, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  compTh:          { fontSize: 11, fontWeight: '700', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  compRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderLight, paddingHorizontal: 4 },
  compName:        { fontSize: 13, fontWeight: '700', color: C.textPrimary },
  compCnpj:        { fontSize: 11, color: C.textSecondary },
  cnaeText:        { fontSize: 11, color: C.textSecondary, lineHeight: 16 },
  sendBtn:         { backgroundColor: C.pink, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 68 },
  sendBtnDone:     { backgroundColor: C.green },
  sendBtnText:     { fontSize: 12, fontWeight: '700', color: C.white },

  infoSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 16 },
  infoTitle:   { fontSize: 14, fontWeight: '800', color: C.textPrimary, marginBottom: 12 },
  infoGrid:    { gap: 0 },

  docItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  docIcon: { fontSize: 16 },
  docName: { flex: 1, fontSize: 13, color: C.textPrimary, fontWeight: '500' },
  reqBadge:{ backgroundColor: C.redBg, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  reqText: { fontSize: 10, fontWeight: '700', color: C.red },

  timelineItem: { flexDirection: 'row', gap: 12, paddingBottom: 16 },
  timelineLeft: { alignItems: 'center', width: 16 },
  timelineDot:  { width: 12, height: 12, borderRadius: 6, backgroundColor: C.accent, marginTop: 3 },
  timelineLine: { flex: 1, width: 2, backgroundColor: C.border, marginTop: 4 },
  timelineBody: { flex: 1, gap: 2 },
  timelineEvent:{ fontSize: 14, fontWeight: '700', color: C.textPrimary },
  timelineDesc: { fontSize: 12, color: C.textSecondary },
  timelineDate: { fontSize: 11, color: C.textMuted, marginTop: 2 },

  footer:           { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: C.border },
  footerBtnGhost:   { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  footerBtnGhostText: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
  footerBtnPrimary: { flex: 1.4, backgroundColor: C.red, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  footerBtnPrimaryText: { fontSize: 13, fontWeight: '700', color: C.white },
});

// ─── Pipeline Section ─────────────────────────────────────────────────────────
function PipelineSection({ metrics }: { metrics: Metrics }) {
  return (
    <View style={pl.container}>
      <View style={pl.left}>
        <Text style={pl.title}>Como funciona o fluxo de oportunidades</Text>
        <View style={pl.steps}>
          {PIPELINE_STEPS.map((step, idx) => (
            <React.Fragment key={step.label}>
              <View style={pl.step}>
                <View style={pl.iconWrap}>
                  <Text style={pl.icon}>{step.icon}</Text>
                </View>
                <Text style={pl.stepLabel}>{step.label}</Text>
                <Text style={pl.stepDesc}>{step.desc}</Text>
              </View>
              {idx < PIPELINE_STEPS.length - 1 && (
                <View style={pl.arrow}>
                  <Text style={pl.arrowText}>→</Text>
                </View>
              )}
            </React.Fragment>
          ))}
        </View>
      </View>
      <View style={pl.right}>
        <Text style={pl.rightTitle}>Ações rápidas</Text>
        <View style={pl.actions}>
          <TouchableOpacity style={pl.actionItem} activeOpacity={0.7}>
            <Text style={pl.actionIcon}>💜</Text>
            <Text style={pl.actionText}>Ver oportunidades interessadas</Text>
            <View style={pl.actionBadge}>
              <Text style={pl.actionBadgeText}>{metrics.clientsInterested}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={pl.actionItem} activeOpacity={0.7}>
            <Text style={pl.actionIcon}>⚖️</Text>
            <Text style={pl.actionText}>Ver oportunidades em disputa</Text>
            <View style={[pl.actionBadge, { backgroundColor: C.orangeBg }]}>
              <Text style={[pl.actionBadgeText, { color: C.orange }]}>{metrics.inDispute}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={pl.actionItem} activeOpacity={0.7}>
            <Text style={pl.actionIcon}>📊</Text>
            <Text style={pl.actionText}>Relatório de oportunidades</Text>
          </TouchableOpacity>
          <TouchableOpacity style={pl.actionItem} activeOpacity={0.7}>
            <Text style={pl.actionIcon}>🔔</Text>
            <Text style={pl.actionText}>Configurar notificações</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const pl = StyleSheet.create({
  container: {
    flexDirection: 'row', gap: 24,
    backgroundColor: C.white, borderRadius: 12, padding: 24,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 1px 4px rgba(15,23,42,0.07)' } as object) : { elevation: 2 }),
  },
  left:      { flex: 2.5 },
  title:     { fontSize: 15, fontWeight: '800', color: C.textPrimary, marginBottom: 18 },
  steps:     { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 4 },
  step:      { alignItems: 'center', gap: 6, minWidth: 80, flex: 1 },
  iconWrap:  { width: 44, height: 44, borderRadius: 22, backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center' },
  icon:      { fontSize: 20 },
  stepLabel: { fontSize: 12, fontWeight: '700', color: C.textPrimary, textAlign: 'center' },
  stepDesc:  { fontSize: 10, color: C.textSecondary, textAlign: 'center', lineHeight: 14 },
  arrow:     { paddingTop: 12 },
  arrowText: { fontSize: 18, color: C.textMuted },

  right:      { flex: 1, borderLeftWidth: 1, borderLeftColor: C.border, paddingLeft: 24 },
  rightTitle: { fontSize: 15, fontWeight: '800', color: C.textPrimary, marginBottom: 14 },
  actions:    { gap: 8 },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  actionIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  actionText: { flex: 1, fontSize: 13, color: C.textPrimary, fontWeight: '500' },
  actionBadge:     { backgroundColor: C.purpleBg, borderRadius: 20, minWidth: 26, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  actionBadgeText: { fontSize: 12, fontWeight: '800', color: C.purple },
});

// ─── Row Actions Menu ─────────────────────────────────────────────────────────
interface RowMenuProps {
  oppId: string;
  onView: () => void;
  onDelete: (id: string) => void;
}
function RowMenu({ oppId, onView, onDelete }: RowMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={rm.wrap}>
      {/* Eye icon */}
      <TouchableOpacity style={rm.iconBtn} onPress={onView} activeOpacity={0.7}>
        <Text style={rm.iconBtnText}>👁</Text>
      </TouchableOpacity>
      {/* 3 dots */}
      <TouchableOpacity style={rm.iconBtn} onPress={() => setMenuOpen(!menuOpen)} activeOpacity={0.7}>
        <Text style={rm.iconBtnText}>⋮</Text>
      </TouchableOpacity>
      {menuOpen && (
        <>
          <TouchableOpacity style={rm.menuOverlay} onPress={() => setMenuOpen(false)} activeOpacity={1} />
          <View style={rm.menu}>
            <TouchableOpacity
              style={rm.menuItem}
              onPress={() => { setMenuOpen(false); onView(); }}
              activeOpacity={0.7}
            >
              <Text style={rm.menuItemText}>👁 Visualizar</Text>
            </TouchableOpacity>
            <View style={rm.menuDivider} />
            <TouchableOpacity
              style={rm.menuItem}
              onPress={() => { setMenuOpen(false); onDelete(oppId); }}
              activeOpacity={0.7}
            >
              <Text style={rm.menuItemTextDanger}>🗑 Excluir oportunidade</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}
const rm = StyleSheet.create({
  wrap:         { flexDirection: 'row', gap: 4, position: 'relative' },
  iconBtn:      { width: 28, height: 28, borderRadius: 6, backgroundColor: C.borderLight, alignItems: 'center', justifyContent: 'center' },
  iconBtnText:  { fontSize: 13 },
  menuOverlay:  { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 200 },
  menu:         { position: 'absolute', top: 32, right: 0, backgroundColor: C.white, borderRadius: 8, borderWidth: 1, borderColor: C.border, zIndex: 201, minWidth: 190, ...(Platform.OS === 'web' ? ({ boxShadow: '0 4px 16px rgba(15,23,42,0.14)' } as object) : { elevation: 10 }) },
  menuItem:     { paddingHorizontal: 14, paddingVertical: 10 },
  menuItemText: { fontSize: 13, color: C.textPrimary, fontWeight: '500' },
  menuItemTextDanger: { fontSize: 13, color: C.red, fontWeight: '600' },
  menuDivider:  { height: 1, backgroundColor: C.borderLight, marginHorizontal: 8 },
});

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
interface DeleteConfirmModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
function DeleteConfirmModal({ visible, onConfirm, onCancel }: DeleteConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={dcm.overlay}>
        <View style={dcm.dialog}>
          <Text style={dcm.title}>Excluir oportunidade</Text>
          <Text style={dcm.message}>
            Tem certeza? Esta ação removerá a oportunidade da lista. Esta operação não pode ser desfeita.
          </Text>
          <View style={dcm.actions}>
            <TouchableOpacity style={dcm.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={dcm.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dcm.confirmBtn} onPress={onConfirm} activeOpacity={0.8}>
              <Text style={dcm.confirmText}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const dcm = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  dialog:     { backgroundColor: C.white, borderRadius: 12, padding: 24, width: 380, maxWidth: '90%' as any, gap: 16, ...(Platform.OS === 'web' ? ({ boxShadow: '0 8px 32px rgba(15,23,42,0.18)' } as object) : { elevation: 16 }) },
  title:      { fontSize: 17, fontWeight: '800', color: C.textPrimary },
  message:    { fontSize: 14, color: C.textSecondary, lineHeight: 20 },
  actions:    { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  cancelBtn:  { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 9 },
  cancelText: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
  confirmBtn: { backgroundColor: '#EF4444', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 9 },
  confirmText:{ fontSize: 13, fontWeight: '700', color: C.white },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function AdminOpportunitiesScreen() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [metrics, setMetrics]             = useState<Metrics>(MOCK_METRICS);
  const [loading, setLoading]             = useState(true);
  const [selectedOpp, setSelectedOpp]     = useState<Opportunity | null>(null);
  const [panelVisible, setPanelVisible]   = useState(false);

  // KPI active filter
  const [activeFilter, setActiveFilter]   = useState<KpiFilterKey>('all');

  // Tenants for empresa dropdown
  const [tenants, setTenants]             = useState<Tenant[]>([]);
  const [filterEmpresa, setFilterEmpresa] = useState('Filtrar por Empresa');

  // Other filters
  const [search,       setSearch]       = useState('');
  const [filterUF,     setFilterUF]     = useState(UF_OPTIONS[0]);
  const [filterMod,    setFilterMod]    = useState(MOD_OPTIONS[0]);
  const [filterStatus, setFilterStatus] = useState(STA_OPTIONS[0]);

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE       = 10;

  // Delete modal
  const [deleteTargetId,    setDeleteTargetId]    = useState<string | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  useEffect(() => { loadData(); loadTenants(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res  = await opportunitiesApi.list({ page: 1, limit: 100 });
      const raw  = Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data?.items ?? []);
      setOpportunities(raw.length > 0 ? (raw as Opportunity[]) : MOCK_OPPORTUNITIES);
    } catch {
      setOpportunities(MOCK_OPPORTUNITIES);
    } finally {
      setLoading(false);
    }
    try {
      const s = await adminApi.stats();
      if (s.data) {
        const d = s.data as Record<string, number>;
        setMetrics({
          received:          d.totalOpportunities ?? MOCK_METRICS.received,
          receivedDelta:     d.todayReceived       ?? MOCK_METRICS.receivedDelta,
          awaitingEval:      d.awaitingEvaluation  ?? MOCK_METRICS.awaitingEval,
          awaitingDelta:     d.awaitingDelta       ?? MOCK_METRICS.awaitingDelta,
          sentToClients:     d.sentToClients       ?? MOCK_METRICS.sentToClients,
          sentDelta:         d.sentDelta           ?? MOCK_METRICS.sentDelta,
          clientsInterested: d.clientsInterested   ?? MOCK_METRICS.clientsInterested,
          inDispute:         d.inDispute           ?? MOCK_METRICS.inDispute,
          finished:          d.finished            ?? MOCK_METRICS.finished,
          finishedDelta:     d.finishedDelta       ?? MOCK_METRICS.finishedDelta,
        });
      }
    } catch { /* keep mock */ }
  }

  async function loadTenants() {
    try {
      const res = await adminApi.listTenants();
      const raw = Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data?.items ?? []);
      setTenants(raw as Tenant[]);
    } catch { /* ignore */ }
  }

  async function handleParticipate(oppId: string, tenantId: string) {
    await opportunitiesApi.participateWithTenant(oppId, tenantId);
  }

  function openPanel(opp: Opportunity) {
    setSelectedOpp(opp);
    setPanelVisible(true);
  }

  function closePanel() {
    setPanelVisible(false);
    setTimeout(() => setSelectedOpp(null), 300);
  }

  function handleMarkNotRelevant(oppId: string) {
    setOpportunities((prev) => prev.filter((o) => o.id !== oppId));
    closePanel();
  }

  function handleKpiClick(key: KpiFilterKey) {
    setActiveFilter((prev) => (prev === key ? 'all' : key));
    setPage(1);
  }

  function handleDeleteRequest(oppId: string) {
    setDeleteTargetId(oppId);
    setDeleteModalVisible(true);
  }

  function handleDeleteConfirm() {
    if (!deleteTargetId) return;
    const targetId = deleteTargetId;
    // Fire-and-forget: try DELETE endpoint, remove locally regardless of outcome
    api.delete(`/opportunities/${targetId}`).catch(() => {});
    setOpportunities((prev) => prev.filter((o) => o.id !== targetId));
    setDeleteTargetId(null);
    setDeleteModalVisible(false);
    if (selectedOpp?.id === targetId) closePanel();
  }

  function handleDeleteCancel() {
    setDeleteTargetId(null);
    setDeleteModalVisible(false);
  }

  // ─── Empresa dropdown options ─────────────────────────────────────────────
  const empresaOptions = [
    'Filtrar por Empresa',
    ...tenants.map((t) => t.tradeName ?? t.corporateName),
  ];

  // ─── Filtered list ────────────────────────────────────────────────────────
  const filtered = opportunities.filter((o) => {
    // KPI filter (takes precedence over status dropdown for known keys)
    if (activeFilter !== 'all') {
      if (o.status !== activeFilter) return false;
    }

    // Text search
    if (search) {
      const q = search.toLowerCase();
      const match = (o.objectSummary ?? '').toLowerCase().includes(q)
        || (o.agencyName ?? '').toLowerCase().includes(q)
        || (o.municipalityName ?? '').toLowerCase().includes(q);
      if (!match) return false;
    }

    // Empresa filter
    if (filterEmpresa !== 'Filtrar por Empresa') {
      const tenant = tenants.find(
        (t) => (t.tradeName ?? t.corporateName) === filterEmpresa
      );
      if (tenant) {
        // Filter by compatibility: check if this opportunity has this company
        // OR match by UF / keywords overlap (best-effort)
        const hasCompany = (o.companies ?? []).some((c) => c.tenantId === tenant.id);
        const ufMatch = (tenant.regions ?? []).some((r) => r.uf === o.uf);
        const kwMatch = (tenant.keywords ?? []).some((kw) =>
          (o.objectSummary ?? '').toLowerCase().includes(kw.toLowerCase())
        );
        if (!hasCompany && !ufMatch && !kwMatch) return false;
      }
    }

    if (filterUF  !== UF_OPTIONS[0]  && o.uf       !== filterUF)    return false;
    if (filterMod !== MOD_OPTIONS[0] && o.modality !== filterMod)    return false;
    // Only apply status dropdown when no KPI filter is active
    if (activeFilter === 'all' && filterStatus !== STA_OPTIONS[0]) {
      const entry = Object.entries(STATUS_CONFIG).find(([, v]) => v.label === filterStatus);
      if (entry && o.status !== entry[0]) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const showAwaitingButtons = activeFilter === 'aguardando_avaliacao';

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Oportunidades</Text>
            <Text style={s.headerSub}>Avalie e envie as melhores oportunidades para seus clientes.</Text>
          </View>
          <TouchableOpacity style={s.headerBtn} activeOpacity={0.8}>
            <Text style={s.headerBtnText}>⚙ Configurar Filtros de Captura</Text>
          </TouchableOpacity>
        </View>

        {/* ── METRICS (clickable KPI filters) ─────────────────────────── */}
        <View style={s.metricsRow}>
          <MetricCard
            label="Editais Recebidos"
            value={metrics.received}
            icon="📥" iconColor={C.accent} iconBg={C.accentLight}
            delta={metrics.receivedDelta}
            active={activeFilter === 'all'}
            onPress={() => handleKpiClick('all')}
          />
          <MetricCard
            label="Aguardando Avaliação"
            value={metrics.awaitingEval}
            icon="⏰" iconColor={C.orange} iconBg={C.orangeBg}
            delta={metrics.awaitingDelta}
            active={activeFilter === 'aguardando_avaliacao'}
            onPress={() => handleKpiClick('aguardando_avaliacao')}
          />
          <MetricCard
            label="Enviadas aos Clientes"
            value={metrics.sentToClients}
            icon="📤" iconColor={C.green} iconBg={C.greenBg}
            delta={metrics.sentDelta}
            active={activeFilter === 'enviada_clientes'}
            onPress={() => handleKpiClick('enviada_clientes')}
          />
          <MetricCard
            label="Interessadas (Clientes)"
            value={metrics.clientsInterested}
            icon="❤️" iconColor={C.purple} iconBg={C.purpleBg}
            actionLabel="Ver ações"
            active={activeFilter === 'interesse_cliente'}
            onPress={() => handleKpiClick('interesse_cliente')}
          />
          <MetricCard
            label="Em Disputa"
            value={metrics.inDispute}
            icon="⚖️" iconColor={C.pink} iconBg={C.pinkBg}
            actionLabel="Ver disputas"
            active={activeFilter === 'em_disputa'}
            onPress={() => handleKpiClick('em_disputa')}
          />
          <MetricCard
            label="Finalizadas"
            value={metrics.finished}
            icon="✅" iconColor={C.green} iconBg={C.greenBg}
            delta={metrics.finishedDelta}
            active={activeFilter === 'finalizada'}
            onPress={() => handleKpiClick('finalizada')}
          />
        </View>

        {/* ── FILTERS ROW ─────────────────────────────────────────────── */}
        <View style={s.filterBar}>
          {/* Empresa dropdown — first filter */}
          <FilterDropdown
            value={filterEmpresa}
            options={empresaOptions}
            onChange={(v) => { setFilterEmpresa(v); setPage(1); }}
          />
          {/* Search */}
          <View style={s.searchWrap}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              style={s.searchInput}
              placeholder="Buscar por órgão ou cidade..."
              placeholderTextColor={C.textMuted}
              value={search}
              onChangeText={(t) => { setSearch(t); setPage(1); }}
            />
          </View>
          <FilterDropdown value={filterUF}     options={UF_OPTIONS}  onChange={(v) => { setFilterUF(v);     setPage(1); }} />
          <FilterDropdown value={filterMod}    options={MOD_OPTIONS} onChange={(v) => { setFilterMod(v);    setPage(1); }} />
          <FilterDropdown value={filterStatus} options={STA_OPTIONS} onChange={(v) => { setFilterStatus(v); setPage(1); }} />
          <TouchableOpacity
            style={s.clearBtn}
            onPress={() => {
              setSearch('');
              setFilterEmpresa('Filtrar por Empresa');
              setFilterUF(UF_OPTIONS[0]);
              setFilterMod(MOD_OPTIONS[0]);
              setFilterStatus(STA_OPTIONS[0]);
              setActiveFilter('all');
              setPage(1);
            }}
            activeOpacity={0.7}
          >
            <Text style={s.clearBtnText}>Limpar</Text>
          </TouchableOpacity>
        </View>

        {/* ── TABLE ───────────────────────────────────────────────────── */}
        <View style={s.tableCard}>
          {/* Header */}
          <View style={s.tableHeader}>
            <Text style={[s.th, s.colDate]}>Data da Licitação</Text>
            <Text style={[s.th, s.colEdital]}>Edital / Objeto</Text>
            <Text style={[s.th, s.colOrgao]}>Órgão</Text>
            <Text style={[s.th, s.colMod]}>Modalidade</Text>
            <Text style={[s.th, s.colLocal]}>Local</Text>
            <Text style={[s.th, s.colValor]}>Valor Estimado</Text>
            <Text style={[s.th, s.colRelev]}>Relevância</Text>
            <Text style={[s.th, s.colStatus]}>Status</Text>
            <Text style={[s.th, s.colAcoes]}>Ações</Text>
          </View>

          {loading ? (
            <View style={s.tableCenter}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={{ color: C.textSecondary, marginTop: 12 }}>Carregando...</Text>
            </View>
          ) : paginated.length === 0 ? (
            <View style={s.tableCenter}>
              <Text style={{ fontSize: 32 }}>📋</Text>
              <Text style={{ color: C.textSecondary, marginTop: 8 }}>Nenhuma oportunidade encontrada</Text>
            </View>
          ) : paginated.map((opp, idx) => {
            const dateStr = opp.sessionDate ?? opp.openingDate ?? '';
            const date = dateStr ? new Date(dateStr) : null;
            const dateDisplay = date ? date.toLocaleDateString('pt-BR') : '—';
            const timeDisplay = date ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
            return (
              <View
                key={opp.id}
                style={[s.tableRow, idx % 2 === 1 && s.tableRowAlt, selectedOpp?.id === opp.id && s.tableRowSelected]}
              >
                <TouchableOpacity
                  style={s.tableRowInner}
                  onPress={() => openPanel(opp)}
                  activeOpacity={0.85}
                >
                  <View style={s.colDate}>
                    <Text style={s.tdDate}>{dateDisplay}</Text>
                    {timeDisplay ? <Text style={s.tdTime}>{timeDisplay}</Text> : null}
                  </View>
                  <View style={s.colEdital}>
                    <Text style={s.tdBold} numberOfLines={2}>{opp.objectSummary ?? '—'}</Text>
                    <Text style={s.tdSub}>Edital nº {opp.biddingNumber ?? '—'}</Text>
                    {/* Awaiting evaluation extra buttons */}
                    {showAwaitingButtons && (
                      <View style={s.awaitingBtns}>
                        <TouchableOpacity
                          style={s.btnRelatorio}
                          onPress={() => {/* open report */}}
                          activeOpacity={0.8}
                        >
                          <Text style={s.btnRelatorioText}>Ver Relatório</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.btnEdital}
                          onPress={() => {
                            if (opp.editalLink) {
                              if (Platform.OS === 'web') {
                                (window as any).open(opp.editalLink, '_blank');
                              }
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={s.btnEditalText}>Abrir Edital</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  <View style={[s.colOrgao, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                    <OrganAvatar name={opp.agencyName} />
                    <Text style={s.tdText} numberOfLines={2}>{opp.agencyName ?? '—'}</Text>
                  </View>
                  <View style={s.colMod}>
                    <Text style={s.tdText} numberOfLines={1}>{opp.modality ?? '—'}</Text>
                    {opp.modalityDetail && <Text style={s.tdSub}>{opp.modalityDetail}</Text>}
                  </View>
                  <Text style={[s.tdText, s.colLocal]} numberOfLines={1}>{localString(opp)}</Text>
                  <Text style={[s.tdBold, s.colValor]} numberOfLines={1}>{formatCurrency(opp.estimatedValue)}</Text>
                  <View style={s.colRelev}>
                    <RelevanceDots score={opp.relevanceScore} />
                  </View>
                  <View style={s.colStatus}>
                    <StatusBadge status={opp.status} />
                  </View>
                </TouchableOpacity>
                {/* Actions column — outside inner press so clicks don't bubble */}
                <View style={[s.colAcoes, { justifyContent: 'center' }]}>
                  <RowMenu
                    oppId={opp.id}
                    onView={() => openPanel(opp)}
                    onDelete={handleDeleteRequest}
                  />
                </View>
              </View>
            );
          })}

          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <View style={s.pagination}>
              <Text style={s.paginationInfo}>
                Mostrando {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)} a {Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} registros
              </Text>
              <View style={s.paginationRight}>
                <View style={s.perPageWrap}>
                  <Text style={s.perPageText}>10 por página</Text>
                  <Text style={s.perPageChev}>▼</Text>
                </View>
                <TouchableOpacity style={[s.pageBtn, page === 1 && s.pageBtnDisabled]} onPress={() => setPage(Math.max(1, page - 1))} disabled={page === 1} activeOpacity={0.7}>
                  <Text style={s.pageBtnText}>‹</Text>
                </TouchableOpacity>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <TouchableOpacity key={p} style={[s.pageBtn, p === page && s.pageBtnActive]} onPress={() => setPage(p)} activeOpacity={0.7}>
                      <Text style={[s.pageBtnText, p === page && s.pageBtnTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  );
                })}
                {totalPages > 5 && <Text style={s.pageBtnText}>…</Text>}
                {totalPages > 5 && (
                  <TouchableOpacity style={[s.pageBtn, page === totalPages && s.pageBtnActive]} onPress={() => setPage(totalPages)} activeOpacity={0.7}>
                    <Text style={[s.pageBtnText, page === totalPages && s.pageBtnTextActive]}>{totalPages}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[s.pageBtn, page === totalPages && s.pageBtnDisabled]} onPress={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} activeOpacity={0.7}>
                  <Text style={s.pageBtnText}>›</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── PIPELINE + QUICK ACTIONS ─────────────────────────────────── */}
        <PipelineSection metrics={metrics} />

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── SIDE PANEL ──────────────────────────────────────────────────── */}
      <SidePanel
        opportunity={selectedOpp}
        visible={panelVisible}
        onClose={closePanel}
        onParticipate={handleParticipate}
        onMarkNotRelevant={handleMarkNotRelevant}
      />

      {/* ── DELETE CONFIRM MODAL ────────────────────────────────────────── */}
      <DeleteConfirmModal
        visible={deleteModalVisible}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg, position: 'relative', overflow: 'hidden' },
  scroll:    { flex: 1 },
  container: { padding: 24, gap: 16 },

  // Header
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 18, flexWrap: 'wrap', gap: 12 },
  headerTitle:  { fontSize: 24, fontWeight: '800', color: C.white, letterSpacing: -0.3 },
  headerSub:    { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  headerBtn:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9 },
  headerBtnText:{ fontSize: 13, fontWeight: '600', color: C.white },

  // Metrics
  metricsRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },

  // Filter bar
  filterBar:  { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap', backgroundColor: C.white, borderRadius: 12, padding: 14, zIndex: 10, ...(Platform.OS === 'web' ? ({ boxShadow: '0 1px 4px rgba(15,23,42,0.07)' } as object) : { elevation: 2 }) },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, minWidth: 180, backgroundColor: C.white },
  searchIcon: { fontSize: 13, color: C.textMuted },
  searchInput:{ flex: 1, fontSize: 13, color: C.textPrimary, outlineWidth: 0 } as any,
  clearBtn:   { paddingHorizontal: 12, paddingVertical: 8 },
  clearBtnText: { fontSize: 13, color: C.textSecondary, fontWeight: '600' },

  // Table
  tableCard:      { backgroundColor: C.white, borderRadius: 12, overflow: 'hidden', ...(Platform.OS === 'web' ? ({ boxShadow: '0 1px 4px rgba(15,23,42,0.07)' } as object) : { elevation: 2 }) },
  tableHeader:    { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: C.border, gap: 8, alignItems: 'center' },
  th:             { fontSize: 11, fontWeight: '700', color: C.textSecondary, letterSpacing: 0.3 },
  tableRow:       { flexDirection: 'row', paddingHorizontal: 16, alignItems: 'stretch', borderBottomWidth: 1, borderBottomColor: C.borderLight },
  tableRowInner:  { flex: 1, flexDirection: 'row', paddingVertical: 12, alignItems: 'center', gap: 8 },
  tableRowAlt:    { backgroundColor: '#FAFBFC' },
  tableRowSelected: { backgroundColor: C.accentLight },
  tableCenter:    { padding: 48, alignItems: 'center' },

  // Awaiting evaluation extra buttons
  awaitingBtns:     { flexDirection: 'row', gap: 6, marginTop: 6 },
  btnRelatorio:     { backgroundColor: '#2563EB', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  btnRelatorioText: { fontSize: 11, fontWeight: '700', color: C.white },
  btnEdital:        { borderWidth: 1, borderColor: '#2563EB', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  btnEditalText:    { fontSize: 11, fontWeight: '700', color: '#2563EB' },

  // Column widths
  colDate:   { width: 80 },
  colEdital: { flex: 2 },
  colOrgao:  { flex: 1.8 },
  colMod:    { flex: 1.4 },
  colLocal:  { flex: 1.2 },
  colValor:  { flex: 1.2 },
  colRelev:  { flex: 1.2 },
  colStatus: { flex: 1.4 },
  colAcoes:  { width: 80 },

  // Table cells
  tdDate: { fontSize: 13, fontWeight: '600', color: C.textPrimary },
  tdTime: { fontSize: 11, color: C.textSecondary },
  tdBold: { fontSize: 13, fontWeight: '700', color: C.textPrimary },
  tdSub:  { fontSize: 11, color: C.textSecondary },
  tdText: { fontSize: 13, color: C.textPrimary },

  iconBtn:     { width: 28, height: 28, borderRadius: 6, backgroundColor: C.borderLight, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 13 },

  // Pagination
  pagination:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderTopWidth: 1, borderTopColor: C.border, flexWrap: 'wrap', gap: 8 },
  paginationInfo: { fontSize: 13, color: C.textSecondary },
  paginationRight:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  perPageWrap:    { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, marginRight: 8 },
  perPageText:    { fontSize: 12, color: C.textSecondary },
  perPageChev:    { fontSize: 9, color: C.textSecondary },
  pageBtn:        { width: 32, height: 32, borderRadius: 6, borderWidth: 1, borderColor: C.border, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  pageBtnActive:  { backgroundColor: C.primary, borderColor: C.primary },
  pageBtnDisabled:{ opacity: 0.35 },
  pageBtnText:    { fontSize: 13, fontWeight: '600', color: C.textPrimary },
  pageBtnTextActive: { color: C.white },
});

