/**
 * AdminBiddingsScreen — Tela de Licitações (web admin)
 * Layout baseado na imagem de referência:
 * - Header escuro com título + sino
 * - 5 métricas horizontais
 * - Abas Lista / Calendário
 * - Tabela com filtros, busca, paginação
 * - Calendário semanal inline com eventos
 * - Painel lateral deslizante com 4 abas
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { biddingsApi } from '../../services/api';

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  primary:    '#1B365D',
  primaryDark:'#152848',
  blue:       '#2563EB',
  blueBg:     '#EFF6FF',
  blueMid:    '#3B82F6',
  green:      '#10B981',
  greenBg:    '#D1FAE5',
  greenText:  '#065F46',
  red:        '#EF4444',
  redBg:      '#FEF2F2',
  redDark:    '#DC2626',
  yellow:     '#F59E0B',
  yellowBg:   '#FFFBEB',
  gray:       '#6B7280',
  grayBg:     '#F3F4F6',
  bg:         '#F5F7FA',
  white:      '#FFFFFF',
  text:       '#111827',
  textLight:  '#374151',
  muted:      '#6B7280',
  border:     '#E5E7EB',
  borderLight:'#F0F0F0',
  rowHover:   '#F0F4FF',
  headerBg:   '#1E3A5F',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type BiddingStatus = 'Agendada' | 'Em Disputa' | 'Finalizada';
type CalView = 'Mes' | 'Semana' | 'Dia';
type DetailTab = 'Informacoes' | 'DadosCliente' | 'Documentos' | 'Historico';

interface BiddingItem {
  id: string;
  descricao: string;
  marca?: string;
  modelo?: string;
  unidade?: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

interface Bidding {
  id: string;
  dataAbertura: string;          // ISO
  hora?: string;                 // "10:00"
  edital: string;
  objeto: string;
  orgao: string;
  orgaoIcon?: string;
  cidade?: string;
  uf: string;
  cnpjCliente?: string;
  empresaCliente: string;
  valorEstimado: number;
  marcaCliente?: string;
  valorMarcaCliente?: number;
  status: BiddingStatus;
  modalidade?: string;
  prazoEntrega?: string;
  validadeProposta?: string;
  condicoesPagamento?: string;
  observacoes?: string;
  documentosNecessarios?: { nome: string; status: 'ok' | 'pendente' | 'vencido' }[];
  itens?: BiddingItem[];
  historico?: { data: string; evento: string; descricao: string }[];
}

// ─── Mock data ────────────────────────────────────────────────────────────────
function mkDate(offsetDays: number, hour = '10:00'): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const [h, m] = hour.split(':');
  d.setHours(Number(h), Number(m), 0, 0);
  return d.toISOString();
}

const MOCK_BIDDINGS: Bidding[] = [
  {
    id: '1',
    dataAbertura: mkDate(0, '10:00'),
    hora: '10:00',
    edital: 'Edital nº 123/2024',
    objeto: 'Aquisição de Material de Construção',
    orgao: 'Prefeitura Municipal de São Carlos',
    orgaoIcon: '🏛',
    cidade: 'São Carlos - SP',
    uf: 'SP',
    empresaCliente: 'Construtora Excelência LTDA',
    cnpjCliente: '12.345.678/0001-90',
    valorEstimado: 320000,
    marcaCliente: 'FORTLEV',
    valorMarcaCliente: 298500,
    status: 'Agendada',
    modalidade: 'Pregão Eletrônico',
    prazoEntrega: '30 dias',
    validadeProposta: '60 dias',
    condicoesPagamento: '30 dias após entrega',
    observacoes: 'Temos condição de entrega em até 5 dias úteis após emissão do empenho.',
    documentosNecessarios: [
      { nome: 'Certidão Federal', status: 'ok' },
      { nome: 'Certidão Estadual', status: 'ok' },
      { nome: 'Certidão Municipal', status: 'pendente' },
      { nome: 'FGTS', status: 'ok' },
      { nome: 'Balanço Patrimonial', status: 'ok' },
    ],
    itens: [
      { id: 'i1', descricao: 'Caixa d\'água polietileno 1000L', marca: 'FORTLEV', modelo: 'Caixa d\'água polietileno 1000L', unidade: 'Unid.', quantidade: 1000, valorUnitario: 298.50, valorTotal: 298500 },
      { id: 'i2', descricao: 'Tampa para caixa d\'água 1000L', marca: 'FORTLEV', unidade: 'Unid.', quantidade: 1000, valorUnitario: 45.00, valorTotal: 45000 },
      { id: 'i3', descricao: 'Adaptador PVC 60mm', marca: 'TIGRE', unidade: 'Unid.', quantidade: 500, valorUnitario: 12.00, valorTotal: 6000 },
      { id: 'i4', descricao: 'Registro de esfera 60mm', marca: 'DECA', unidade: 'Unid.', quantidade: 200, valorUnitario: 38.00, valorTotal: 7600 },
    ],
    historico: [
      { data: mkDate(-7), evento: 'Oportunidade identificada', descricao: 'Sistema detectou licitação compatível com perfil da empresa' },
      { data: mkDate(-5), evento: 'Enviada ao cliente', descricao: 'Licitação enviada para Construtora Excelência LTDA via email' },
      { data: mkDate(-3), evento: 'Cliente interessado', descricao: 'Cliente confirmou interesse em participar' },
    ],
  },
  {
    id: '2',
    dataAbertura: mkDate(2, '09:30'),
    hora: '09:30',
    edital: 'Edital nº 456/2024',
    objeto: 'Serviços de Limpeza e Conservação',
    orgao: 'Governo do Estado de Minas Gerais',
    orgaoIcon: '🏛',
    cidade: 'Belo Horizonte - MG',
    uf: 'MG',
    empresaCliente: 'Serviços & Limpeza LTDA',
    cnpjCliente: '23.456.789/0001-01',
    valorEstimado: 1250000,
    marcaCliente: 'LIMPBRAS',
    valorMarcaCliente: 1180000,
    status: 'Agendada',
    modalidade: 'Concorrência',
    prazoEntrega: '60 dias',
    validadeProposta: '90 dias',
    condicoesPagamento: '15 dias após entrega',
    documentosNecessarios: [
      { nome: 'Certidão Federal', status: 'ok' },
      { nome: 'Certidão Estadual', status: 'vencido' },
      { nome: 'Atestado Capacidade Técnica', status: 'pendente' },
    ],
    itens: [
      { id: 'i5', descricao: 'Serviço de limpeza mensal', marca: 'LIMPBRAS', unidade: 'Mês', quantidade: 12, valorUnitario: 98333.33, valorTotal: 1180000 },
    ],
    historico: [
      { data: mkDate(-4), evento: 'Oportunidade identificada', descricao: 'Sistema detectou licitação compatível' },
      { data: mkDate(-2), evento: 'Cliente aceitou participar', descricao: 'Serviços & Limpeza LTDA confirmou participação' },
    ],
  },
  {
    id: '3',
    dataAbertura: mkDate(5, '14:00'),
    hora: '14:00',
    edital: 'Edital nº 789/2024',
    objeto: 'Aquisição de Equipamentos de Informática',
    orgao: 'Instituto Federal de Educação',
    orgaoIcon: '🏫',
    cidade: 'Campinas - SP',
    uf: 'SP',
    empresaCliente: 'Tech Solutions LTDA',
    cnpjCliente: '45.678.901/0001-23',
    valorEstimado: 180000,
    marcaCliente: 'DELL',
    valorMarcaCliente: 175000,
    status: 'Agendada',
    modalidade: 'Pregão Eletrônico',
    prazoEntrega: '45 dias',
    validadeProposta: '60 dias',
    condicoesPagamento: '30 dias após entrega',
    documentosNecessarios: [
      { nome: 'Certidão Federal', status: 'ok' },
      { nome: 'Certidão Municipal', status: 'ok' },
      { nome: 'ISO 9001', status: 'pendente' },
    ],
    itens: [
      { id: 'i6', descricao: 'Notebook Dell Latitude', marca: 'DELL', unidade: 'Unid.', quantidade: 30, valorUnitario: 4500, valorTotal: 135000 },
      { id: 'i7', descricao: 'Monitor Dell 24"', marca: 'DELL', unidade: 'Unid.', quantidade: 25, valorUnitario: 1600, valorTotal: 40000 },
    ],
    historico: [
      { data: mkDate(-3), evento: 'Oportunidade identificada', descricao: 'Licitação detectada automaticamente' },
    ],
  },
  {
    id: '4',
    dataAbertura: mkDate(3, '11:00'),
    hora: '11:00',
    edital: 'Edital nº 101/2024',
    objeto: 'Obras de Pavimentação Asfáltica',
    orgao: 'Prefeitura Municipal de Ribeirão Preto',
    orgaoIcon: '🏛',
    cidade: 'Ribeirão Preto - SP',
    uf: 'SP',
    empresaCliente: 'Construtora Excelência LTDA',
    cnpjCliente: '12.345.678/0001-90',
    valorEstimado: 2800000,
    marcaCliente: 'CBUQ ASFALTOS',
    valorMarcaCliente: 2690000,
    status: 'Agendada',
    modalidade: 'Concorrência',
    prazoEntrega: '180 dias',
    validadeProposta: '120 dias',
    condicoesPagamento: 'Medição mensal',
    documentosNecessarios: [
      { nome: 'Certidão Federal', status: 'ok' },
      { nome: 'Registro CREA', status: 'ok' },
      { nome: 'Atestado Técnico', status: 'ok' },
    ],
    itens: [
      { id: 'i8', descricao: 'CBUQ Camada de rolamento', marca: 'CBUQ ASFALTOS', unidade: 't', quantidade: 5000, valorUnitario: 538, valorTotal: 2690000 },
    ],
    historico: [
      { data: mkDate(-6), evento: 'Oportunidade identificada', descricao: 'Licitação de alto valor detectada' },
      { data: mkDate(-4), evento: 'Cliente interessado', descricao: 'Construtora confirmou participação' },
    ],
  },
  {
    id: '5',
    dataAbertura: mkDate(2, '08:30'),
    hora: '08:30',
    edital: 'Edital nº 202/2024',
    objeto: 'Fornecimento de Medicamentos',
    orgao: 'Secretaria de Saúde do Estado do Paraná',
    orgaoIcon: '🏥',
    cidade: 'Curitiba - PR',
    uf: 'PR',
    empresaCliente: 'Distribuidora Forte LTDA',
    cnpjCliente: '34.567.890/0001-12',
    valorEstimado: 950000,
    marcaCliente: 'CRISTÁLIA',
    valorMarcaCliente: 920000,
    status: 'Agendada',
    modalidade: 'Pregão Eletrônico',
    prazoEntrega: '30 dias',
    validadeProposta: '60 dias',
    condicoesPagamento: '30 dias após entrega',
    documentosNecessarios: [
      { nome: 'Certidão Federal', status: 'ok' },
      { nome: 'Autorização ANVISA', status: 'ok' },
      { nome: 'AFE Farmacêutica', status: 'pendente' },
    ],
    itens: [
      { id: 'i9', descricao: 'Amoxicilina 500mg cx/500', marca: 'CRISTÁLIA', unidade: 'Cx', quantidade: 1000, valorUnitario: 920, valorTotal: 920000 },
    ],
    historico: [
      { data: mkDate(-5), evento: 'Oportunidade identificada', descricao: 'Sistema detectou licitação' },
      { data: mkDate(-3), evento: 'Enviada ao cliente', descricao: 'Distribuidora Forte recebeu a licitação' },
      { data: mkDate(-1), evento: 'Cliente aceitou', descricao: 'Distribuídora confirmou participação' },
    ],
  },
  {
    id: '6',
    dataAbertura: mkDate(7, '10:00'),
    hora: '10:00',
    edital: 'Edital nº 303/2024',
    objeto: 'Contratação de Serviços de TI',
    orgao: 'Ministério da Economia',
    orgaoIcon: '🏛',
    cidade: 'Brasília - DF',
    uf: 'DF',
    empresaCliente: 'Tech Solutions LTDA',
    cnpjCliente: '45.678.901/0001-23',
    valorEstimado: 3500000,
    marcaCliente: 'TOTVS',
    valorMarcaCliente: 3250000,
    status: 'Agendada',
    modalidade: 'Concorrência Internacional',
    prazoEntrega: '365 dias',
    validadeProposta: '180 dias',
    condicoesPagamento: 'Trimestral',
    documentosNecessarios: [
      { nome: 'Certidão Federal', status: 'ok' },
      { nome: 'ISO 27001', status: 'ok' },
      { nome: 'Atestado Capacidade', status: 'ok' },
    ],
    itens: [
      { id: 'i10', descricao: 'ERP TOTVS Protheus 12', marca: 'TOTVS', unidade: 'Licença', quantidade: 500, valorUnitario: 6500, valorTotal: 3250000 },
    ],
    historico: [
      { data: mkDate(-8), evento: 'Oportunidade identificada', descricao: 'Licitação de alto impacto detectada' },
      { data: mkDate(-5), evento: 'Análise técnica', descricao: 'Equipe analisando requisitos' },
    ],
  },
  // More for pagination
  {
    id: '7', dataAbertura: mkDate(10, '09:00'), hora: '09:00',
    edital: 'Edital nº 404/2024', objeto: 'Aquisição de Mobiliário Escolar',
    orgao: 'Secretaria de Educação do RS', orgaoIcon: '🏫', cidade: 'Porto Alegre - RS', uf: 'RS',
    empresaCliente: 'Móveis & Cia LTDA', cnpjCliente: '56.789.012/0001-34',
    valorEstimado: 420000, marcaCliente: 'MULTIMOVEL', valorMarcaCliente: 395000,
    status: 'Agendada', modalidade: 'Pregão Eletrônico', prazoEntrega: '60 dias',
    validadeProposta: '60 dias', condicoesPagamento: '30 dias',
    documentosNecessarios: [{ nome: 'Certidão Federal', status: 'ok' }],
    itens: [{ id: 'i11', descricao: 'Carteira escolar madeira', marca: 'MULTIMOVEL', unidade: 'Unid.', quantidade: 500, valorUnitario: 790, valorTotal: 395000 }],
    historico: [{ data: mkDate(-2), evento: 'Oportunidade identificada', descricao: 'Detectada automaticamente' }],
  },
  {
    id: '8', dataAbertura: mkDate(12, '15:00'), hora: '15:00',
    edital: 'Edital nº 505/2024', objeto: 'Fornecimento de Combustível',
    orgao: 'Prefeitura de Goiânia', orgaoIcon: '🏛', cidade: 'Goiânia - GO', uf: 'GO',
    empresaCliente: 'Petro Distribuidora S/A', cnpjCliente: '67.890.123/0001-45',
    valorEstimado: 680000, marcaCliente: 'PETROBRAS', valorMarcaCliente: 650000,
    status: 'Em Disputa', modalidade: 'Pregão Eletrônico', prazoEntrega: '12 meses',
    validadeProposta: '30 dias', condicoesPagamento: '15 dias',
    documentosNecessarios: [{ nome: 'Certidão Federal', status: 'ok' }, { nome: 'ANP', status: 'ok' }],
    itens: [{ id: 'i12', descricao: 'Diesel S10', marca: 'PETROBRAS', unidade: 'L', quantidade: 130000, valorUnitario: 5.00, valorTotal: 650000 }],
    historico: [{ data: mkDate(-10), evento: 'Em disputa', descricao: 'Licitação em andamento' }],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function statusColor(s: BiddingStatus): { bg: string; color: string } {
  if (s === 'Em Disputa') return { bg: '#D1FAE5', color: '#065F46' };
  if (s === 'Agendada')   return { bg: '#D1FAE5', color: '#065F46' };
  return { bg: C.grayBg, color: C.gray };
}

const UF_LIST = ['Todos os Estados','AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
const STATUS_LIST = ['Todos os Status','Agendada','Em Disputa','Finalizada'];
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEKDAYS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

// ─── Dropdown ─────────────────────────────────────────────────────────────────
function Dropdown({ value, options, onChange }: {
  value: string; options: string[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ position: 'relative', zIndex: 200 }}>
      <TouchableOpacity style={styles.filterDropdown} onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <Text style={styles.filterDropdownText} numberOfLines={1}>{value}</Text>
        <Text style={{ color: C.muted, fontSize: 9, marginLeft: 4 }}>▾</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.dropList}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt}
              style={[styles.dropOpt, opt === value && styles.dropOptActive]}
              onPress={() => { onChange(opt); setOpen(false); }}
            >
              <Text style={[styles.dropOptText, opt === value && { color: C.blue, fontWeight: '700' }]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: BiddingStatus }) {
  const { bg, color } = statusColor(status);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{status}</Text>
    </View>
  );
}

// ─── Metric Card (reference style) ───────────────────────────────────────────
function MetricCard({
  label, value, sub, subColor, icon, iconBg, onSubPress,
}: {
  label: string; value: string; sub?: string; subColor?: string;
  icon: string; iconBg: string; onSubPress?: () => void;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
        {sub ? (
          onSubPress ? (
            <TouchableOpacity onPress={onSubPress}>
              <Text style={[styles.metricSub, { color: subColor ?? C.blue }]}>{sub}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.metricSub, { color: subColor ?? C.blue }]}>{sub}</Text>
          )
        ) : null}
      </View>
      <View style={[styles.metricIconWrap, { backgroundColor: iconBg }]}>
        <Text style={styles.metricIconText}>{icon}</Text>
      </View>
    </View>
  );
}

// ─── Panel InfoRow ────────────────────────────────────────────────────────────
function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && { color: C.blue, fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({
  bidding, onClose, slideAnim,
}: {
  bidding: Bidding; onClose: () => void; slideAnim: Animated.Value;
}) {
  const [tab, setTab] = useState<DetailTab>('DadosCliente');
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const TABS: { key: DetailTab; label: string }[] = [
    { key: 'Informacoes',  label: 'Informações' },
    { key: 'DadosCliente', label: 'Dados do Cliente' },
    { key: 'Documentos',   label: 'Documentos' },
    { key: 'Historico',    label: 'Histórico' },
  ];

  async function handleNotify() {
    setNotifying(true);
    try { await biddingsApi.notifyClient(bidding.id); } catch { /* mock */ }
    await new Promise(r => setTimeout(r, 800));
    setNotifying(false); setNotified(true);
    setTimeout(() => setNotified(false), 3000);
  }

  async function handleGenerate() {
    setGenerating(true);
    await new Promise(r => setTimeout(r, 1200));
    setGenerating(false); setGenerated(true);
    setTimeout(() => setGenerated(false), 3000);
  }

  const content = () => {
    switch (tab) {
      case 'Informacoes':
        return (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 0 }}>
            {/* Quick info bar */}
            <View style={styles.panelInfoBar}>
              <Text style={styles.panelInfoBarItem}>📅 {fmtDate(bidding.dataAbertura)} às {bidding.hora ?? fmtTime(bidding.dataAbertura)}</Text>
              <Text style={styles.panelInfoBarItem}>📍 {bidding.cidade ?? bidding.uf}</Text>
              <Text style={styles.panelInfoBarItem}>📋 {bidding.modalidade ?? '—'}</Text>
            </View>
            <View style={styles.panelSection}>
              <Text style={styles.panelSectionTitle}>Órgão</Text>
              <Text style={styles.panelSectionVal}>{bidding.orgao}</Text>
            </View>
            <View style={styles.panelSection}>
              <Text style={styles.panelSectionTitle}>Valor Estimado</Text>
              <Text style={[styles.panelSectionVal, { color: C.blue, fontWeight: '700', fontSize: 16 }]}>{fmtCurrency(bidding.valorEstimado)}</Text>
            </View>
            <View style={styles.panelDivider} />
            <InfoRow label="Edital" value={bidding.edital} />
            <InfoRow label="Objeto" value={bidding.objeto} />
            <InfoRow label="UF" value={bidding.uf} />
            <InfoRow label="Modalidade" value={bidding.modalidade ?? '—'} />
            <InfoRow label="Valor Estimado" value={fmtCurrency(bidding.valorEstimado)} highlight />
          </ScrollView>
        );

      case 'DadosCliente':
        return (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.panelGroupTitle}>Dados preenchidos pelo cliente</Text>

            {/* 2-col grid info */}
            <View style={styles.clientGrid}>
              <View style={styles.clientGridCell}>
                <Text style={styles.clientGridLabel}>Empresa:</Text>
                <Text style={styles.clientGridVal}>{bidding.empresaCliente}</Text>
                {bidding.cnpjCliente && <Text style={styles.clientGridSub}>{bidding.cnpjCliente}</Text>}
              </View>
              <View style={styles.clientGridCell}>
                <Text style={styles.clientGridLabel}>Valor Unitário:</Text>
                <Text style={styles.clientGridVal}>{bidding.valorMarcaCliente && bidding.itens?.[0] ? fmtCurrency(bidding.itens[0].valorUnitario) : '—'}</Text>
              </View>
              <View style={styles.clientGridCell}>
                <Text style={styles.clientGridLabel}>Marca:</Text>
                <Text style={[styles.clientGridVal, { fontWeight: '800' }]}>{bidding.marcaCliente ?? '—'}</Text>
              </View>
              <View style={styles.clientGridCell}>
                <Text style={styles.clientGridLabel}>Valor Total (Cliente):</Text>
                <Text style={[styles.clientGridVal, { color: C.green, fontWeight: '700' }]}>{bidding.valorMarcaCliente ? fmtCurrency(bidding.valorMarcaCliente) : '—'}</Text>
              </View>
              <View style={[styles.clientGridCell, { flex: 2 }]}>
                <Text style={styles.clientGridLabel}>Modelo / Descrição:</Text>
                <Text style={styles.clientGridVal}>{bidding.itens?.[0]?.modelo ?? bidding.itens?.[0]?.descricao ?? '—'}</Text>
              </View>
            </View>

            <View style={styles.panelDivider} />
            <Text style={styles.panelGroupTitle}>Itens Informados pelo Cliente</Text>

            {/* Items table */}
            <View style={styles.itemsTable}>
              <View style={[styles.itemsRow, styles.itemsHeader]}>
                <Text style={[styles.itemsTh, { width: 30 }]}>Item</Text>
                <Text style={[styles.itemsTh, { flex: 2.5 }]}>Descrição</Text>
                <Text style={[styles.itemsTh, { flex: 1.5 }]}>Marca/Modelo</Text>
                <Text style={[styles.itemsTh, { width: 44, textAlign: 'center' }]}>Unid.</Text>
                <Text style={[styles.itemsTh, { width: 40, textAlign: 'center' }]}>Qtd</Text>
                <Text style={[styles.itemsTh, { flex: 1.2, textAlign: 'right' }]}>Valor Unit.</Text>
                <Text style={[styles.itemsTh, { flex: 1.2, textAlign: 'right' }]}>Valor Total</Text>
              </View>
              {(bidding.itens ?? []).map((item, idx) => (
                <View key={item.id} style={[styles.itemsRow, idx % 2 === 1 && { backgroundColor: '#FAFAFA' }]}>
                  <Text style={[styles.itemsTd, { width: 30, color: C.muted }]}>{String(idx + 1).padStart(2, '0')}</Text>
                  <Text style={[styles.itemsTd, { flex: 2.5 }]} numberOfLines={2}>{item.descricao}</Text>
                  <Text style={[styles.itemsTd, { flex: 1.5, fontWeight: '700' }]}>{item.marca ?? '—'}</Text>
                  <Text style={[styles.itemsTd, { width: 44, textAlign: 'center' }]}>{item.unidade ?? 'Unid.'}</Text>
                  <Text style={[styles.itemsTd, { width: 40, textAlign: 'center' }]}>{item.quantidade.toLocaleString('pt-BR')}</Text>
                  <Text style={[styles.itemsTd, { flex: 1.2, textAlign: 'right' }]}>{fmtCurrency(item.valorUnitario)}</Text>
                  <Text style={[styles.itemsTd, { flex: 1.2, textAlign: 'right', fontWeight: '700' }]}>{fmtCurrency(item.valorTotal)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.panelDivider} />
            <Text style={styles.panelGroupTitle}>Informações Adicionais</Text>
            <View style={{ gap: 0 }}>
              <InfoRow label="Prazo de Entrega:" value={bidding.prazoEntrega ?? '—'} />
              <InfoRow label="Validade da Proposta:" value={bidding.validadeProposta ?? '—'} />
              <InfoRow label="Condições de Pagamento:" value={bidding.condicoesPagamento ?? '—'} />
              {bidding.observacoes && <InfoRow label="Observações:" value={bidding.observacoes} />}
            </View>
          </ScrollView>
        );

      case 'Documentos':
        return (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            <Text style={styles.panelGroupTitle}>Documentos Necessários</Text>
            {(bidding.documentosNecessarios ?? []).map((doc, i) => {
              const cfg = {
                ok:       { bg: C.greenBg, color: C.green,  label: '✓ OK' },
                pendente: { bg: C.yellowBg, color: C.yellow, label: '⏳ Pendente' },
                vencido:  { bg: C.redBg,   color: C.red,    label: '✕ Vencido' },
              }[doc.status];
              return (
                <View key={i} style={styles.docRow}>
                  <Text style={styles.docName}>{doc.nome}</Text>
                  <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        );

      case 'Historico':
        return (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={[styles.panelGroupTitle, { marginBottom: 16 }]}>Linha do Tempo</Text>
            {(bidding.historico ?? []).map((h, i, arr) => (
              <View key={i} style={styles.tlItem}>
                <View style={styles.tlLeft}>
                  <View style={styles.tlDot} />
                  {i < arr.length - 1 && <View style={styles.tlLine} />}
                </View>
                <View style={styles.tlContent}>
                  <Text style={styles.tlEvento}>{h.evento}</Text>
                  <Text style={styles.tlData}>{fmtDate(h.data)}</Text>
                  <Text style={styles.tlDesc}>{h.descricao}</Text>
                </View>
              </View>
            ))}
            <View style={styles.panelDivider} />
            <Text style={[styles.panelGroupTitle, { marginBottom: 8 }]}>Prazos e Condições</Text>
            <InfoRow label="Prazo de Entrega:" value={bidding.prazoEntrega ?? '—'} />
            <InfoRow label="Validade da Proposta:" value={bidding.validadeProposta ?? '—'} />
            <InfoRow label="Condições de Pagamento:" value={bidding.condicoesPagamento ?? '—'} />
          </ScrollView>
        );
    }
  };

  return (
    <Animated.View style={[styles.panel, { transform: [{ translateX: slideAnim }] }]}>
      {/* Panel header — white with title + badge */}
      <View style={styles.panelTop}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={styles.panelTopTitle} numberOfLines={2}>{bidding.objeto}</Text>
            <StatusBadge status={bidding.status} />
          </View>
          <Text style={styles.panelTopEdital}>{bidding.edital}</Text>
          {/* Quick meta row */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
            <Text style={styles.panelMetaItem}>📅 {fmtDate(bidding.dataAbertura)} às {bidding.hora ?? fmtTime(bidding.dataAbertura)}</Text>
            <Text style={styles.panelMetaItem}>📍 {bidding.cidade ?? bidding.uf}</Text>
            <Text style={styles.panelMetaItem}>📋 {bidding.modalidade ?? '—'}</Text>
          </View>
          <View style={{ marginTop: 4 }}>
            <Text style={styles.panelMetaItem}>🏛 <Text style={{ color: C.blue }}>Órgão: </Text>{bidding.orgao}</Text>
            <Text style={[styles.panelMetaItem, { marginTop: 2 }]}>
              <Text style={{ color: C.muted }}>Valor Estimado: </Text>
              <Text style={{ color: C.blue, fontWeight: '700' }}>{fmtCurrency(bidding.valorEstimado)}</Text>
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.panelCloseBtn} onPress={onClose}>
          <Text style={styles.panelCloseTxt}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.panelTabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.panelTab, tab === t.key && styles.panelTabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.panelTabTxt, tab === t.key && styles.panelTabTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={{ flex: 1, overflow: 'hidden' }}>{content()}</View>

      {/* Ações Rápidas footer */}
      <View style={styles.panelFooter}>
        <Text style={styles.panelFooterTitle}>Ações Rápidas</Text>
        <View style={styles.panelBtns}>
          {/* Gerar Proposta card */}
          <View style={styles.panelActionCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Text style={{ fontSize: 14 }}>📄</Text>
              <Text style={styles.panelActionCardTitle}>Gerar Proposta de Preço</Text>
            </View>
            <Text style={styles.panelActionCardDesc}>Gere uma proposta profissional com todos os dados da licitação e itens informados.</Text>
            <TouchableOpacity
              style={[styles.panelActionBtn, { backgroundColor: C.red }]}
              onPress={handleGenerate}
              activeOpacity={0.85}
            >
              {generating
                ? <ActivityIndicator size="small" color={C.white} />
                : <Text style={styles.panelActionBtnTxt}>{generated ? '✓ Proposta Gerada' : '📄 Gerar Proposta'}</Text>
              }
            </TouchableOpacity>
          </View>
          {/* Notificar Cliente card */}
          <View style={styles.panelActionCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Text style={{ fontSize: 14 }}>🔔</Text>
              <Text style={styles.panelActionCardTitle}>Notificar Cliente</Text>
            </View>
            <Text style={styles.panelActionCardDesc}>Informe ao cliente que a proposta foi cadastrada para esta licitação.</Text>
            <TouchableOpacity
              style={[styles.panelActionBtn, { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.green }]}
              onPress={handleNotify}
              activeOpacity={0.85}
            >
              {notifying
                ? <ActivityIndicator size="small" color={C.green} />
                : <Text style={[styles.panelActionBtnTxt, { color: C.green }]}>{notified ? '✓ Notificado!' : '🔔 Notificar Cliente'}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Calendar (week view, shown below table) ──────────────────────────────────
function CalendarSection({
  biddings, onBiddingPress,
}: {
  biddings: Bidding[]; onBiddingPress: (b: Bidding) => void;
}) {
  const [calView, setCalView] = useState<CalView>('Mes');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }
  function goToday() { setYear(new Date().getFullYear()); setMonth(new Date().getMonth()); }

  // Build month grid
  const monthCells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    // pad to full weeks
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  // Build week cells (current week)
  const weekCells = useMemo(() => {
    const today = new Date();
    const dow = today.getDay();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - dow + i);
      return d;
    });
  }, []);

  function biddingsForDay(d: Date): Bidding[] {
    return biddings.filter(b => isSameDay(new Date(b.dataAbertura), d));
  }

  function eventColor(b: Bidding): string {
    const diff = daysUntil(b.dataAbertura);
    if (isSameDay(new Date(b.dataAbertura), new Date()) || (diff >= 0 && diff <= 1)) return C.red;
    if (b.status === 'Em Disputa') return C.blue;
    if (diff >= 0 && diff <= 7) return C.yellow;
    return C.blue;
  }

  return (
    <View style={styles.calCard}>
      {/* Header */}
      <View style={styles.calHeader}>
        <TouchableOpacity style={styles.calNavBtn} onPress={prev}>
          <Text style={styles.calNavTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.calTitle}>{MONTHS_PT[month]} {year}</Text>
        <TouchableOpacity style={styles.calNavBtn} onPress={next}>
          <Text style={styles.calNavTxt}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.calTodayBtn} onPress={goToday}>
          <Text style={styles.calTodayTxt}>Hoje</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={styles.calViewToggle}>
          {(['Mes', 'Semana', 'Dia'] as CalView[]).map(v => (
            <TouchableOpacity
              key={v}
              style={[styles.calViewBtn, calView === v && styles.calViewBtnActive]}
              onPress={() => setCalView(v)}
            >
              <Text style={[styles.calViewBtnTxt, calView === v && styles.calViewBtnTxtActive]}>
                {v === 'Mes' ? 'Mês' : v}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Weekday labels */}
      <View style={styles.calWeekRow}>
        {WEEKDAYS_PT.map(w => (
          <View key={w} style={styles.calWeekCell}>
            <Text style={styles.calWeekTxt}>{w}</Text>
          </View>
        ))}
      </View>

      {/* Month grid */}
      {calView === 'Mes' && (
        <View style={styles.calMonthGrid}>
          {monthCells.map((day, i) => {
            if (!day) return <View key={i} style={styles.calMonthCell} />;
            const dayBiddings = biddingsForDay(day);
            const isToday = isSameDay(day, new Date());
            return (
              <View key={i} style={[styles.calMonthCell, isToday && styles.calMonthCellToday]}>
                <Text style={[styles.calMonthNum, isToday && { color: C.white }]}>{day.getDate()}</Text>
                {dayBiddings.slice(0, 2).map(b => (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.calEvent, { backgroundColor: eventColor(b) }]}
                    onPress={() => onBiddingPress(b)}
                  >
                    <Text style={styles.calEventTxt} numberOfLines={1}>{b.hora ?? fmtTime(b.dataAbertura)} {b.objeto}</Text>
                  </TouchableOpacity>
                ))}
                {dayBiddings.length > 2 && (
                  <Text style={styles.calMore}>+{dayBiddings.length - 2} mais</Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Week grid */}
      {calView === 'Semana' && (
        <View style={styles.calWeekGrid}>
          {weekCells.map((day, i) => {
            const dayBiddings = biddingsForDay(day);
            const isToday = isSameDay(day, new Date());
            return (
              <View key={i} style={[styles.calWeekColCell, isToday && styles.calWeekColCellToday]}>
                <Text style={[styles.calWeekColNum, isToday && { color: C.blue, fontWeight: '800' }]}>{day.getDate()}</Text>
                {dayBiddings.map(b => (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.calEventBlock, { backgroundColor: eventColor(b) + '22', borderLeftColor: eventColor(b) }]}
                    onPress={() => onBiddingPress(b)}
                  >
                    <Text style={[styles.calEventBlockTime, { color: eventColor(b) }]}>{b.hora ?? fmtTime(b.dataAbertura)}</Text>
                    <Text style={styles.calEventBlockObj} numberOfLines={2}>{b.objeto}</Text>
                    <Text style={styles.calEventBlockCity}>{b.cidade ?? b.uf}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
        </View>
      )}

      {/* Day view */}
      {calView === 'Dia' && (
        <View style={{ padding: 16 }}>
          {(() => {
            const today = new Date();
            const todayBiddings = biddingsForDay(today);
            return todayBiddings.length === 0
              ? <Text style={{ color: C.muted, textAlign: 'center', padding: 20 }}>Nenhuma licitação hoje.</Text>
              : todayBiddings.map(b => (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.calEventBlock, { backgroundColor: eventColor(b) + '22', borderLeftColor: eventColor(b), marginBottom: 8 }]}
                    onPress={() => onBiddingPress(b)}
                  >
                    <Text style={[styles.calEventBlockTime, { color: eventColor(b) }]}>{b.hora ?? fmtTime(b.dataAbertura)}</Text>
                    <Text style={styles.calEventBlockObj}>{b.objeto}</Text>
                    <Text style={styles.calEventBlockCity}>{b.cidade ?? b.uf}</Text>
                  </TouchableOpacity>
                ));
          })()}
        </View>
      )}

      {/* Legend */}
      <View style={styles.calLegend}>
        <View style={styles.calLegendItem}>
          <View style={[styles.calLegendDot, { backgroundColor: '#2563EB' }]} />
          <Text style={styles.calLegendTxt}>Em disputa</Text>
        </View>
        <View style={styles.calLegendItem}>
          <View style={[styles.calLegendDot, { backgroundColor: C.red }]} />
          <Text style={styles.calLegendTxt}>Abertura hoje</Text>
        </View>
        <View style={styles.calLegendItem}>
          <View style={[styles.calLegendDot, { backgroundColor: C.yellow }]} />
          <Text style={styles.calLegendTxt}>Próximos 7 dias</Text>
        </View>
        <View style={styles.calLegendItem}>
          <View style={[styles.calLegendDot, { backgroundColor: C.grayBg, borderWidth: 1, borderColor: C.border }]} />
          <Text style={styles.calLegendTxt}>Outros</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function AdminBiddingsScreen() {
  const [biddings, setBiddings]     = useState<Bidding[]>([]);
  const [loading, setLoading]       = useState(true);
  const [mainTab, setMainTab]       = useState<'Lista' | 'Calendario'>('Lista');
  const [search, setSearch]         = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('Todas Empresas');
  const [filterUF, setFilterUF]     = useState('Todos os Estados');
  const [filterStatus, setFilterStatus] = useState('Todos os Status');
  const [page, setPage]             = useState(1);
  const [pageSize]                  = useState(10);
  const [selectedBidding, setSelectedBidding] = useState<Bidding | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const slideAnim = useState(new Animated.Value(500))[0];

  const fetchBiddings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await biddingsApi.list();
      const list: Bidding[] = Array.isArray(data) ? data
        : Array.isArray((data as { data?: unknown })?.data) ? (data as unknown as { data: Bidding[] }).data : [];
      setBiddings(list.length > 0 ? list : MOCK_BIDDINGS);
    } catch { setBiddings(MOCK_BIDDINGS); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBiddings(); }, [fetchBiddings]);

  function openPanel(b: Bidding) {
    setSelectedBidding(b);
    slideAnim.setValue(500);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 12 }).start();
  }
  function closePanel() {
    Animated.timing(slideAnim, { toValue: 500, duration: 220, useNativeDriver: true }).start(() => setSelectedBidding(null));
  }

  // Metrics
  const metrics = useMemo(() => {
    const today = new Date();
    return {
      emDisputa:    biddings.filter(b => b.status === 'Em Disputa').length,
      aberturaHoje: biddings.filter(b => isSameDay(new Date(b.dataAbertura), today)).length,
      prox7:        biddings.filter(b => { const d = daysUntil(b.dataAbertura); return d >= 0 && d <= 7; }).length,
      valorTotal:   biddings.reduce((s, b) => s + b.valorEstimado, 0),
      valorMarca:   biddings.reduce((s, b) => s + (b.valorMarcaCliente ?? 0), 0),
    };
  }, [biddings]);

  // Filters
  const empresas = useMemo(() => ['Todas Empresas', ...Array.from(new Set(biddings.map(b => b.empresaCliente)))], [biddings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return biddings.filter(b => {
      if (filterEmpresa !== 'Todas Empresas' && b.empresaCliente !== filterEmpresa) return false;
      if (filterUF !== 'Todos os Estados' && b.uf !== filterUF) return false;
      if (filterStatus !== 'Todos os Status' && b.status !== filterStatus) return false;
      if (q && !b.objeto.toLowerCase().includes(q) && !b.orgao.toLowerCase().includes(q) && !b.empresaCliente.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [biddings, filterEmpresa, filterUF, filterStatus, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, flexDirection: 'row' }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* ── DARK HEADER ───────────────────────────────────────────────────── */}
        <View style={styles.screenHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>Licitações em Disputa</Text>
            <Text style={styles.screenSubtitle}>Acompanhe todas as licitações que seus clientes aceitaram participar.</Text>
          </View>
          {/* Notification bell with badge */}
          <View style={styles.bellWrap}>
            <Text style={styles.bellIcon}>🔔</Text>
            <View style={styles.bellBadge}><Text style={styles.bellBadgeNum}>12</Text></View>
          </View>
        </View>

        {/* ── METRICS ───────────────────────────────────────────────────────── */}
        <View style={styles.metricsRow}>
          <MetricCard
            label="Em Disputa"
            value={String(metrics.emDisputa)}
            sub="+3 hoje"
            subColor={C.blue}
            icon="⚖"
            iconBg="#EFF6FF"
          />
          <MetricCard
            label="Abertura Hoje"
            value={String(metrics.aberturaHoje)}
            sub="Ver calendário"
            subColor={C.blue}
            icon="📅"
            iconBg="#D1FAE5"
            onSubPress={() => setMainTab('Calendario')}
          />
          <MetricCard
            label="Próximos 7 dias"
            value={String(metrics.prox7)}
            sub="Ver calendário"
            subColor={C.blue}
            icon="🕐"
            iconBg="#FFFBEB"
            onSubPress={() => setMainTab('Calendario')}
          />
          <MetricCard
            label="Valor Total Estimado"
            value={fmtCurrency(metrics.valorTotal)}
            sub="Soma de todas"
            subColor={C.muted}
            icon="💲"
            iconBg="#EFF6FF"
          />
          <MetricCard
            label="Valor Potencial (Marcas)"
            value={fmtCurrency(metrics.valorMarca)}
            sub="Informado pelos clientes"
            subColor={C.muted}
            icon="📈"
            iconBg="#F0FDF4"
          />
        </View>

        {/* ── CONTENT AREA ──────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>

          {/* Tabs */}
          <View style={styles.mainTabs}>
            {(['Lista', 'Calendario'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.mainTab, mainTab === t && styles.mainTabActive]}
                onPress={() => setMainTab(t)}
              >
                <Text style={[styles.mainTabTxt, mainTab === t && styles.mainTabTxtActive]}>
                  {t === 'Lista' ? 'Lista de Licitações' : 'Calendário'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── LIST TAB ──────────────────────────────────────────────────── */}
          {mainTab === 'Lista' && (
            <View style={styles.card}>
              {/* Filter bar */}
              <View style={styles.filterBar}>
                <View style={styles.searchWrap}>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar por objeto, órgão ou cliente..."
                    placeholderTextColor={C.muted}
                    value={search}
                    onChangeText={t => { setSearch(t); setPage(1); }}
                  />
                </View>
                <Dropdown value={filterEmpresa} options={empresas} onChange={v => { setFilterEmpresa(v); setPage(1); }} />
                <Dropdown value={filterUF}      options={UF_LIST}   onChange={v => { setFilterUF(v);      setPage(1); }} />
                <Dropdown value={filterStatus}  options={STATUS_LIST} onChange={v => { setFilterStatus(v); setPage(1); }} />
                <TouchableOpacity style={styles.filterPeriodo}>
                  <Text style={styles.filterDropdownText}>Período</Text>
                  <Text style={{ fontSize: 12, color: C.muted }}>📅</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.filterBtn}>
                  <Text style={styles.filterBtnTxt}>⚙ Filtros</Text>
                </TouchableOpacity>
              </View>

              {/* Table */}
              <View>
                <View style={styles.tableHead}>
                  <Text style={[styles.thCell, { flex: 1.1 }]}>Data de Abertura</Text>
                  <Text style={[styles.thCell, { flex: 2.2 }]}>Edital / Objeto</Text>
                  <Text style={[styles.thCell, { flex: 1.8 }]}>Órgão</Text>
                  <Text style={[styles.thCell, { flex: 1.8 }]}>Empresa Cliente</Text>
                  <Text style={[styles.thCell, { flex: 1.3, textAlign: 'right' }]}>Valor Estimado</Text>
                  <Text style={[styles.thCell, { flex: 1.5 }]}>Marca / Valor (Cliente)</Text>
                  <Text style={[styles.thCell, { flex: 1.1, textAlign: 'center' }]}>Status</Text>
                  <Text style={[styles.thCell, { width: 60, textAlign: 'center' }]}>Ações</Text>
                </View>

                {loading ? (
                  <ActivityIndicator color={C.blue} style={{ padding: 32 }} />
                ) : pageData.length === 0 ? (
                  <Text style={{ padding: 24, textAlign: 'center', color: C.muted }}>Nenhuma licitação encontrada</Text>
                ) : pageData.map((b, idx) => (
                  <Pressable
                    key={b.id}
                    style={[
                      styles.tableRow,
                      idx % 2 === 1 && { backgroundColor: '#FAFAFA' },
                      hoveredRow === b.id && { backgroundColor: C.rowHover },
                    ]}
                    onHoverIn={() => setHoveredRow(b.id)}
                    onHoverOut={() => setHoveredRow(null)}
                    onPress={() => openPanel(b)}
                  >
                    {/* Data Abertura */}
                    <View style={{ flex: 1.1 }}>
                      <Text style={styles.tdBold}>{fmtDate(b.dataAbertura)}</Text>
                      <Text style={styles.tdMuted}>{b.hora ?? fmtTime(b.dataAbertura)}</Text>
                    </View>
                    {/* Edital / Objeto */}
                    <View style={{ flex: 2.2 }}>
                      <Text style={styles.tdBold} numberOfLines={1}>{b.objeto}</Text>
                      <Text style={styles.tdMuted}>{b.edital}</Text>
                    </View>
                    {/* Órgão */}
                    <View style={{ flex: 1.8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={styles.orgaoIcon}>
                        <Text style={{ fontSize: 14 }}>{b.orgaoIcon ?? '🏛'}</Text>
                      </View>
                      <Text style={styles.tdNormal} numberOfLines={2}>{b.orgao}</Text>
                    </View>
                    {/* Empresa Cliente */}
                    <View style={{ flex: 1.8 }}>
                      <Text style={styles.tdNormal} numberOfLines={1}>{b.empresaCliente}</Text>
                      {b.cnpjCliente && <Text style={styles.tdMuted}>{b.cnpjCliente}</Text>}
                    </View>
                    {/* Valor Estimado */}
                    <Text style={[styles.tdBold, { flex: 1.3, textAlign: 'right', color: C.text }]}>
                      {fmtCurrency(b.valorEstimado)}
                    </Text>
                    {/* Marca / Valor */}
                    <View style={{ flex: 1.5 }}>
                      <Text style={[styles.tdBold, { color: C.text }]}>{b.marcaCliente ?? '—'}</Text>
                      {b.valorMarcaCliente != null && (
                        <Text style={[styles.tdMuted, { color: C.green, fontWeight: '600' }]}>
                          {fmtCurrency(b.valorMarcaCliente)}
                        </Text>
                      )}
                    </View>
                    {/* Status */}
                    <View style={{ flex: 1.1, alignItems: 'center' }}>
                      <StatusBadge status={b.status} />
                    </View>
                    {/* Actions */}
                    <View style={{ width: 60, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                      <TouchableOpacity onPress={() => openPanel(b)} activeOpacity={0.7}>
                        <Text style={{ fontSize: 15, color: C.blue }}>👁</Text>
                      </TouchableOpacity>
                      <TouchableOpacity activeOpacity={0.7}>
                        <Text style={{ fontSize: 15, color: C.muted }}>⋯</Text>
                      </TouchableOpacity>
                    </View>
                  </Pressable>
                ))}
              </View>

              {/* Pagination */}
              <View style={styles.pagRow}>
                <Text style={styles.pagInfo}>
                  Mostrando {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} a {Math.min(page * pageSize, filtered.length)} de {filtered.length} registros
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.pagSizeWrap}>
                    <Text style={styles.pagSizeTxt}>10 por página</Text>
                    <Text style={{ fontSize: 9, color: C.muted }}>▾</Text>
                  </View>
                  <TouchableOpacity style={[styles.pagBtn, page <= 1 && styles.pagBtnDis]} onPress={() => page > 1 && setPage(p => p - 1)}>
                    <Text style={styles.pagBtnTxt}>‹</Text>
                  </TouchableOpacity>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.pagBtn, page === p && styles.pagBtnActive]}
                      onPress={() => setPage(p)}
                    >
                      <Text style={[styles.pagBtnTxt, page === p && { color: C.white, fontWeight: '700' }]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                  {totalPages > 5 && <Text style={{ color: C.muted }}>...</Text>}
                  {totalPages > 5 && (
                    <TouchableOpacity style={styles.pagBtn} onPress={() => setPage(totalPages)}>
                      <Text style={styles.pagBtnTxt}>{totalPages}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.pagBtn, page >= totalPages && styles.pagBtnDis]} onPress={() => page < totalPages && setPage(p => p + 1)}>
                    <Text style={styles.pagBtnTxt}>›</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* ── CALENDAR TAB ──────────────────────────────────────────────── */}
          {mainTab === 'Calendario' && (
            <View style={{ gap: 16 }}>
              <Text style={styles.calSectionTitle}>Calendário de Licitações</Text>
              <CalendarSection biddings={biddings} onBiddingPress={openPanel} />
            </View>
          )}

          {/* Calendar always shown below list */}
          {mainTab === 'Lista' && (
            <View style={{ marginTop: 24, gap: 8 }}>
              <Text style={styles.calSectionTitle}>Calendário de Licitações</Text>
              <CalendarSection biddings={biddings} onBiddingPress={openPanel} />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Detail panel overlay */}
      {selectedBidding && (
        <>
          <Pressable style={styles.overlay} onPress={closePanel} />
          <DetailPanel bidding={selectedBidding} onClose={closePanel} slideAnim={slideAnim} />
        </>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Screen header (dark)
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.primary,
    paddingHorizontal: 28,
    paddingVertical: 20,
    gap: 16,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 3,
  },
  bellWrap: {
    position: 'relative',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: { fontSize: 18 },
  bellBadge: {
    position: 'absolute',
    top: 4, right: 4,
    width: 16, height: 16,
    borderRadius: 8,
    backgroundColor: C.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeNum: { fontSize: 9, fontWeight: '800', color: C.white },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  metricCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 20,
    borderRightWidth: 1,
    borderRightColor: C.border,
  },
  metricIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricIconText: { fontSize: 20 },
  metricLabel: { fontSize: 11, color: C.muted, fontWeight: '500', marginBottom: 2 },
  metricValue: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  metricSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  // Main tabs
  mainTabs: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: C.border,
    marginBottom: 16,
  },
  mainTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -2,
  },
  mainTabActive: { borderBottomColor: C.blue },
  mainTabTxt: { fontSize: 14, fontWeight: '500', color: C.muted },
  mainTabTxtActive: { color: C.blue, fontWeight: '700' },

  // Card
  card: {
    backgroundColor: C.white,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  // Filter bar
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexWrap: 'wrap',
    backgroundColor: C.white,
    zIndex: 300,
  },
  searchWrap: {
    flex: 1,
    minWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: C.white,
    gap: 6,
  },
  searchIcon: { fontSize: 12, color: C.muted },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: C.text,
    outlineStyle: 'none' as never,
  },
  filterDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: C.white,
    minWidth: 130,
    gap: 4,
  },
  filterDropdownText: { fontSize: 12, color: C.text, fontWeight: '500', flex: 1 },
  filterPeriodo: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: C.white,
    gap: 6,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.white,
    gap: 4,
  },
  filterBtnTxt: { fontSize: 12, color: C.text, fontWeight: '600' },

  // Dropdown
  dropList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    zIndex: 9999,
    backgroundColor: C.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    minWidth: 170,
    maxHeight: 250,
    overflow: 'scroll' as never,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  dropOpt: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropOptActive: { backgroundColor: C.blueBg },
  dropOptText: { fontSize: 12, color: C.text },

  // Table
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
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
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    cursor: 'pointer' as never,
    backgroundColor: C.white,
  },
  tdBold: { fontSize: 13, fontWeight: '700', color: C.text },
  tdNormal: { fontSize: 13, fontWeight: '500', color: C.text },
  tdMuted: { fontSize: 11, color: C.muted, marginTop: 2 },
  orgaoIcon: {
    width: 28, height: 28,
    borderRadius: 6,
    backgroundColor: C.grayBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Badge
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Pagination
  pagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  pagInfo: { fontSize: 12, color: C.muted },
  pagSizeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  pagSizeTxt: { fontSize: 11, color: C.text },
  pagBtn: {
    width: 30, height: 30,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagBtnActive: { backgroundColor: C.blue, borderColor: C.blue },
  pagBtnDis: { opacity: 0.35 },
  pagBtnTxt: { fontSize: 12, color: C.text },

  // Calendar section title
  calSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
  },

  // Calendar card
  calCard: {
    backgroundColor: C.white,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  calNavBtn: {
    width: 32, height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calNavTxt: { fontSize: 18, fontWeight: '700', color: C.text },
  calTitle: { fontSize: 15, fontWeight: '700', color: C.text, minWidth: 150 },
  calTodayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  calTodayTxt: { fontSize: 12, color: C.text, fontWeight: '600' },
  calViewToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  calViewBtn: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.white },
  calViewBtnActive: { backgroundColor: C.primary },
  calViewBtnTxt: { fontSize: 12, color: C.text, fontWeight: '600' },
  calViewBtnTxtActive: { color: C.white },

  calWeekRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: '#F9FAFB',
  },
  calWeekCell: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  calWeekTxt: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase' },

  // Month grid
  calMonthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calMonthCell: {
    width: `${100 / 7}%` as never,
    minHeight: 90,
    borderWidth: 0.5,
    borderColor: C.borderLight,
    padding: 6,
  },
  calMonthCellToday: { backgroundColor: C.blue },
  calMonthNum: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 4 },
  calEvent: {
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginBottom: 2,
  },
  calEventTxt: { fontSize: 9, color: C.white, fontWeight: '600' },
  calMore: { fontSize: 9, color: C.muted, marginTop: 2 },

  // Week grid
  calWeekGrid: { flexDirection: 'row', minHeight: 160 },
  calWeekColCell: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: C.borderLight,
    padding: 6,
    minHeight: 120,
  },
  calWeekColCellToday: { backgroundColor: '#F0F7FF' },
  calWeekColNum: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 },
  calEventBlock: {
    borderLeftWidth: 3,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginBottom: 4,
  },
  calEventBlockTime: { fontSize: 10, fontWeight: '700' },
  calEventBlockObj: { fontSize: 10, color: C.text, marginTop: 1, fontWeight: '500' },
  calEventBlockCity: { fontSize: 9, color: C.muted, marginTop: 1 },

  calLegend: {
    flexDirection: 'row',
    gap: 16,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexWrap: 'wrap',
  },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  calLegendDot: { width: 10, height: 10, borderRadius: 5 },
  calLegendTxt: { fontSize: 11, color: C.muted },

  // Detail Panel
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 10,
  },
  panel: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0,
    width: 480,
    backgroundColor: C.white,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 16,
    flexDirection: 'column',
  },

  // Panel top (white header)
  panelTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.white,
  },
  panelTopTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text,
    lineHeight: 20,
    flex: 1,
  },
  panelTopEdital: { fontSize: 11, color: C.muted, marginTop: 2 },
  panelMetaItem: { fontSize: 11, color: C.muted },
  panelCloseBtn: {
    width: 28, height: 28,
    borderRadius: 14,
    backgroundColor: C.grayBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelCloseTxt: { fontSize: 13, color: C.muted, fontWeight: '700' },

  // Panel tabs
  panelTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  panelTab: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  panelTabActive: { borderBottomColor: C.blue },
  panelTabTxt: { fontSize: 11, fontWeight: '500', color: C.muted },
  panelTabTxtActive: { color: C.blue, fontWeight: '700' },

  // Panel content helpers
  panelInfoBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    backgroundColor: C.grayBg,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  panelInfoBarItem: { fontSize: 11, color: C.textLight },
  panelSection: { marginBottom: 10 },
  panelSectionTitle: { fontSize: 11, color: C.muted, fontWeight: '600', marginBottom: 2 },
  panelSectionVal: { fontSize: 14, color: C.text, fontWeight: '600' },
  panelDivider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  panelGroupTitle: { fontSize: 13, fontWeight: '700', color: C.blue, marginBottom: 8 },

  // Info row
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
    alignItems: 'flex-start',
  },
  infoLabel: { fontSize: 12, color: C.muted, fontWeight: '600', width: 150, flexShrink: 0 },
  infoValue: { fontSize: 12, color: C.text, flex: 1, fontWeight: '500' },

  // Client data grid
  clientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 4,
  },
  clientGridCell: {
    flex: 1,
    minWidth: 160,
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: C.border,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  clientGridLabel: { fontSize: 10, color: C.muted, fontWeight: '600', marginBottom: 3 },
  clientGridVal: { fontSize: 13, color: C.text, fontWeight: '600' },
  clientGridSub: { fontSize: 10, color: C.muted, marginTop: 1 },

  // Items table in panel
  itemsTable: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 4,
  },
  itemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 4,
  },
  itemsHeader: { backgroundColor: '#F9FAFB' },
  itemsTh: { fontSize: 9, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.3 },
  itemsTd: { fontSize: 11, color: C.text, fontWeight: '500' },

  // Doc row
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  docName: { fontSize: 13, color: C.text, flex: 1 },

  // Timeline
  tlItem: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  tlLeft: { alignItems: 'center', width: 18 },
  tlDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.blue, marginTop: 3 },
  tlLine: { flex: 1, width: 2, backgroundColor: C.border, marginTop: 2, marginBottom: -4 },
  tlContent: { flex: 1, paddingBottom: 14 },
  tlEvento: { fontSize: 13, fontWeight: '700', color: C.text },
  tlData: { fontSize: 10, color: C.muted, marginTop: 2 },
  tlDesc: { fontSize: 11, color: C.gray, marginTop: 3, lineHeight: 16 },

  // Panel footer — Ações Rápidas
  panelFooter: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    padding: 16,
    backgroundColor: C.white,
  },
  panelFooterTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
    marginBottom: 10,
  },
  panelBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  panelActionCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  panelActionCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text,
    flex: 1,
  },
  panelActionCardDesc: {
    fontSize: 10,
    color: C.muted,
    lineHeight: 14,
    marginBottom: 8,
  },
  panelActionBtn: {
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  panelActionBtnTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: C.white,
  },
});
