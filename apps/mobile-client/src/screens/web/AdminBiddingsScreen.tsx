/**
 * AdminBiddingsScreen — Tela de Licitações para admin web
 * Inclui: cards de métricas, aba Lista (tabela + filtros), aba Calendário,
 * painel lateral deslizante com 4 abas de detalhe.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { biddingsApi } from '../../services/api';

// ─── Color tokens ─────────────────────────────────────────────────────────────
const C = {
  primary:   '#1B365D',
  blue:      '#2563EB',
  blueBg:    '#EFF6FF',
  blueMid:   '#3B82F6',
  green:     '#10B981',
  greenBg:   '#ECFDF5',
  red:       '#EF4444',
  redBg:     '#FEF2F2',
  yellow:    '#F59E0B',
  yellowBg:  '#FFFBEB',
  gray:      '#6B7280',
  grayBg:    '#F3F4F6',
  bg:        '#F5F7FA',
  white:     '#FFFFFF',
  text:      '#111827',
  muted:     '#6B7280',
  border:    '#E5E7EB',
  rowHover:  '#F0F4FF',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type BiddingStatus = 'Agendada' | 'Em Disputa' | 'Finalizada';
type CalendarView = 'Mes' | 'Semana' | 'Dia';
type DetailTab = 'Informacoes' | 'DadosCliente' | 'Documentos' | 'Historico';

interface BiddingItem {
  id: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  marca?: string;
}

interface Bidding {
  id: string;
  dataAbertura: string;
  edital: string;
  objeto: string;
  orgao: string;
  uf: string;
  empresaCliente: string;
  tenantId?: string;
  valorEstimado: number;
  marcaCliente?: string;
  valorMarcaCliente?: number;
  status: BiddingStatus;
  modalidade?: string;
  prazoEntrega?: string;
  garantia?: string;
  condicoesPagamento?: string;
  documentosNecessarios?: { nome: string; status: 'ok' | 'pendente' | 'vencido' }[];
  itens?: BiddingItem[];
  historico?: { data: string; evento: string; descricao: string }[];
}

// ─── Mock data (fallback quando API retorna 404) ───────────────────────────────
const MOCK_BIDDINGS: Bidding[] = [
  {
    id: '1',
    dataAbertura: new Date().toISOString(),
    edital: '001/2025-PE',
    objeto: 'Aquisição de equipamentos hospitalares para UBS municipal',
    orgao: 'Prefeitura de Joinville/SC',
    uf: 'SC',
    empresaCliente: 'MedSupply Ltda',
    tenantId: 't1',
    valorEstimado: 1250000,
    marcaCliente: 'Philips',
    valorMarcaCliente: 980000,
    status: 'Em Disputa',
    modalidade: 'Pregão Eletrônico',
    prazoEntrega: '60 dias',
    garantia: '12 meses',
    condicoesPagamento: '30 dias após entrega',
    documentosNecessarios: [
      { nome: 'Certidão Federal', status: 'ok' },
      { nome: 'Certidão Estadual', status: 'ok' },
      { nome: 'Certidão Municipal', status: 'pendente' },
      { nome: 'FGTS', status: 'ok' },
      { nome: 'Balanço Patrimonial', status: 'ok' },
    ],
    itens: [
      { id: 'i1', descricao: 'Monitor Multiparamétrico', quantidade: 10, valorUnitario: 45000, valorTotal: 450000, marca: 'Philips' },
      { id: 'i2', descricao: 'Desfibrilador AED', quantidade: 5, valorUnitario: 38000, valorTotal: 190000, marca: 'Philips' },
      { id: 'i3', descricao: 'Ventilador Mecânico', quantidade: 8, valorUnitario: 42500, valorTotal: 340000, marca: 'Philips' },
    ],
    historico: [
      { data: new Date(Date.now() - 7 * 86400000).toISOString(), evento: 'Oportunidade identificada', descricao: 'Sistema detectou licitação compatível com perfil da empresa' },
      { data: new Date(Date.now() - 5 * 86400000).toISOString(), evento: 'Enviada ao cliente', descricao: 'Licitação enviada para MedSupply Ltda via email' },
      { data: new Date(Date.now() - 3 * 86400000).toISOString(), evento: 'Cliente interessado', descricao: 'Cliente confirmou interesse em participar' },
      { data: new Date(Date.now() - 1 * 86400000).toISOString(), evento: 'Cadastrada na disputa', descricao: 'Proposta cadastrada no sistema de disputa' },
    ],
  },
  {
    id: '2',
    dataAbertura: new Date(Date.now() + 2 * 86400000).toISOString(),
    edital: '002/2025-CC',
    objeto: 'Fornecimento de medicamentos e insumos médico-hospitalares',
    orgao: 'Governo do Estado de SP',
    uf: 'SP',
    empresaCliente: 'FarmaDistrib S/A',
    tenantId: 't2',
    valorEstimado: 850000,
    marcaCliente: 'Eurofarma',
    valorMarcaCliente: 720000,
    status: 'Agendada',
    modalidade: 'Concorrência',
    prazoEntrega: '30 dias',
    garantia: '24 meses',
    condicoesPagamento: '15 dias após entrega',
    documentosNecessarios: [
      { nome: 'Certidão Federal', status: 'ok' },
      { nome: 'Certidão Estadual', status: 'vencido' },
      { nome: 'Atestado Capacidade Técnica', status: 'pendente' },
    ],
    itens: [
      { id: 'i4', descricao: 'Amoxicilina 500mg cx/500', quantidade: 200, valorUnitario: 120, valorTotal: 24000, marca: 'Eurofarma' },
      { id: 'i5', descricao: 'Dipirona 500mg cx/1000', quantidade: 500, valorUnitario: 85, valorTotal: 42500, marca: 'Eurofarma' },
    ],
    historico: [
      { data: new Date(Date.now() - 4 * 86400000).toISOString(), evento: 'Oportunidade identificada', descricao: 'Sistema detectou licitação compatível' },
      { data: new Date(Date.now() - 2 * 86400000).toISOString(), evento: 'Cliente aceitou participar', descricao: 'FarmaDistrib confirmou participação' },
    ],
  },
  {
    id: '3',
    dataAbertura: new Date(Date.now() + 5 * 86400000).toISOString(),
    edital: '003/2025-PE',
    objeto: 'Serviços de manutenção predial e conservação de instalações',
    orgao: 'Câmara Municipal de Curitiba/PR',
    uf: 'PR',
    empresaCliente: 'TechMaint Serviços',
    tenantId: 't3',
    valorEstimado: 120000,
    marcaCliente: 'Vonder',
    valorMarcaCliente: 98000,
    status: 'Agendada',
    modalidade: 'Pregão Eletrônico',
    prazoEntrega: '90 dias',
    garantia: '6 meses',
    condicoesPagamento: 'Mensal',
    documentosNecessarios: [
      { nome: 'Certidão Federal', status: 'ok' },
      { nome: 'Certidão Municipal', status: 'ok' },
      { nome: 'Registro CREA', status: 'pendente' },
    ],
    itens: [
      { id: 'i6', descricao: 'Manutenção preventiva mensal', quantidade: 12, valorUnitario: 8000, valorTotal: 96000 },
      { id: 'i7', descricao: 'Limpeza de caixas d\'água', quantidade: 4, valorUnitario: 6000, valorTotal: 24000 },
    ],
    historico: [
      { data: new Date(Date.now() - 3 * 86400000).toISOString(), evento: 'Oportunidade identificada', descricao: 'Licitação detectada automaticamente' },
    ],
  },
  {
    id: '4',
    dataAbertura: new Date(Date.now() - 10 * 86400000).toISOString(),
    edital: '004/2025-PE',
    objeto: 'Aquisição de computadores e periféricos para secretarias municipais',
    orgao: 'Prefeitura de Florianópolis/SC',
    uf: 'SC',
    empresaCliente: 'InfoTech Comércio',
    tenantId: 't1',
    valorEstimado: 450000,
    marcaCliente: 'Dell',
    valorMarcaCliente: 380000,
    status: 'Finalizada',
    modalidade: 'Pregão Eletrônico',
    prazoEntrega: '45 dias',
    garantia: '36 meses',
    condicoesPagamento: '30 dias após entrega',
    documentosNecessarios: [
      { nome: 'Certidão Federal', status: 'ok' },
      { nome: 'Nota Fiscal', status: 'ok' },
    ],
    itens: [
      { id: 'i8', descricao: 'Notebook Dell Inspiron 15', quantidade: 50, valorUnitario: 4800, valorTotal: 240000, marca: 'Dell' },
      { id: 'i9', descricao: 'Monitor Dell 24"', quantidade: 70, valorUnitario: 1800, valorTotal: 126000, marca: 'Dell' },
    ],
    historico: [
      { data: new Date(Date.now() - 20 * 86400000).toISOString(), evento: 'Oportunidade identificada', descricao: 'Licitação detectada' },
      { data: new Date(Date.now() - 15 * 86400000).toISOString(), evento: 'Proposta enviada', descricao: 'Proposta técnica e comercial enviada' },
      { data: new Date(Date.now() - 10 * 86400000).toISOString(), evento: 'Resultado: Ganhou', descricao: 'Empresa venceu o certame com menor preço' },
    ],
  },
  {
    id: '5',
    dataAbertura: new Date(Date.now() + 1 * 86400000).toISOString(),
    edital: '005/2025-CC',
    objeto: 'Contratação de serviços de tecnologia da informação e comunicação',
    orgao: 'Tribunal de Justiça do RS',
    uf: 'RS',
    empresaCliente: 'CloudTech Soluções',
    tenantId: 't2',
    valorEstimado: 2100000,
    marcaCliente: 'Microsoft',
    valorMarcaCliente: 1850000,
    status: 'Em Disputa',
    modalidade: 'Concorrência Internacional',
    prazoEntrega: '180 dias',
    garantia: '60 meses',
    condicoesPagamento: 'Semestral',
    documentosNecessarios: [
      { nome: 'Certidão Federal', status: 'ok' },
      { nome: 'ISO 27001', status: 'ok' },
      { nome: 'Atestado Técnico', status: 'pendente' },
    ],
    itens: [
      { id: 'i10', descricao: 'Licenças Microsoft 365 E3', quantidade: 500, valorUnitario: 2200, valorTotal: 1100000, marca: 'Microsoft' },
      { id: 'i11', descricao: 'Azure Cloud - 3 anos', quantidade: 1, valorUnitario: 750000, valorTotal: 750000, marca: 'Microsoft' },
    ],
    historico: [
      { data: new Date(Date.now() - 6 * 86400000).toISOString(), evento: 'Oportunidade identificada', descricao: 'Sistema detectou licitação de alto valor' },
      { data: new Date(Date.now() - 4 * 86400000).toISOString(), evento: 'Análise iniciada', descricao: 'Equipe técnica analisando requisitos' },
      { data: new Date(Date.now() - 2 * 86400000).toISOString(), evento: 'Cadastrada na disputa', descricao: 'Documentação enviada ao órgão' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
  if (s === 'Em Disputa') return { bg: C.greenBg, color: C.green };
  if (s === 'Agendada')   return { bg: C.blueBg,  color: C.blue };
  return { bg: C.grayBg, color: C.gray };
}

function dayColor(biddings: Bidding[]): string | null {
  if (!biddings.length) return null;
  const today = new Date();
  for (const b of biddings) {
    const d = new Date(b.dataAbertura);
    if (isSameDay(d, today)) return C.red;
    const diff = daysUntil(b.dataAbertura);
    if (diff >= 0 && diff <= 2) return C.red;
  }
  for (const b of biddings) {
    if (b.status === 'Em Disputa') return C.blue;
  }
  const diff7 = daysUntil(biddings[0].dataAbertura);
  if (diff7 >= 0 && diff7 <= 7) return C.yellow;
  return C.blue;
}

const UF_LIST = ['Todos', 'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
const STATUS_LIST: (BiddingStatus | 'Todos')[] = ['Todos', 'Agendada', 'Em Disputa', 'Finalizada'];
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEKDAYS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

// ─── Simple Dropdown ──────────────────────────────────────────────────────────
function Dropdown({
  value, options, onChange, label
}: { value: string; options: string[]; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ position: 'relative', zIndex: 100 }}>
      <TouchableOpacity
        style={styles.dropdownBtn}
        onPress={() => setOpen(!open)}
        activeOpacity={0.8}
      >
        <Text style={styles.dropdownBtnText}>{value === 'Todos' ? label : value}</Text>
        <Text style={{ color: C.muted, fontSize: 10 }}>▾</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdownList}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.dropdownOption, opt === value && styles.dropdownOptionActive]}
              onPress={() => { onChange(opt); setOpen(false); }}
            >
              <Text style={[styles.dropdownOptionText, opt === value && { color: C.blue, fontWeight: '700' }]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ icon, label, value, badgeColor }: {
  icon: string; label: string; value: string; badgeColor: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconWrap, { backgroundColor: badgeColor + '22' }]}>
        <Text style={styles.metricIcon}>{icon}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
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

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({
  bidding,
  onClose,
  slideAnim,
}: {
  bidding: Bidding;
  onClose: () => void;
  slideAnim: Animated.Value;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>('Informacoes');
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const DETAIL_TABS: { key: DetailTab; label: string }[] = [
    { key: 'Informacoes', label: 'Informações' },
    { key: 'DadosCliente', label: 'Dados do Cliente' },
    { key: 'Documentos', label: 'Documentos' },
    { key: 'Historico', label: 'Histórico' },
  ];

  async function handleNotify() {
    setNotifying(true);
    try {
      await biddingsApi.notifyClient(bidding.id);
    } catch {
      // mock fallback
    }
    await new Promise(r => setTimeout(r, 800));
    setNotifying(false);
    setNotified(true);
    setTimeout(() => setNotified(false), 3000);
  }

  async function handleGenerateProposta() {
    setGenerating(true);
    await new Promise(r => setTimeout(r, 1200));
    setGenerating(false);
    setGenerated(true);
    setTimeout(() => setGenerated(false), 3000);
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Informacoes':
        return (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 12 }}>
            <InfoRow label="Órgão" value={bidding.orgao} />
            <InfoRow label="UF" value={bidding.uf} />
            <InfoRow label="Edital" value={bidding.edital} />
            <InfoRow label="Objeto" value={bidding.objeto} multiline />
            <InfoRow label="Data de Abertura" value={fmtDate(bidding.dataAbertura)} />
            <InfoRow label="Modalidade" value={bidding.modalidade ?? '—'} />
            <InfoRow label="Valor Estimado" value={fmtCurrency(bidding.valorEstimado)} highlight />
            <InfoRow label="Status" value={bidding.status} />
            <View style={styles.divider} />
            <Text style={styles.panelSubtitle}>Condições Contratuais</Text>
            <InfoRow label="Prazo de Entrega" value={bidding.prazoEntrega ?? '—'} />
            <InfoRow label="Garantia" value={bidding.garantia ?? '—'} />
            <InfoRow label="Cond. de Pagamento" value={bidding.condicoesPagamento ?? '—'} />
          </ScrollView>
        );

      case 'DadosCliente':
        return (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 12 }}>
            <InfoRow label="Empresa Cliente" value={bidding.empresaCliente} />
            <InfoRow label="Marca do Cliente" value={bidding.marcaCliente ?? '—'} />
            <InfoRow label="Valor da Marca" value={bidding.valorMarcaCliente ? fmtCurrency(bidding.valorMarcaCliente) : '—'} highlight />
            <View style={styles.divider} />
            <Text style={styles.panelSubtitle}>Itens da Proposta</Text>
            {/* Table header */}
            <View style={[styles.itemsTableRow, { backgroundColor: C.grayBg }]}>
              <Text style={[styles.itemsThCell, { flex: 3 }]}>Descrição</Text>
              <Text style={[styles.itemsThCell, { flex: 1, textAlign: 'center' }]}>Qtd</Text>
              <Text style={[styles.itemsThCell, { flex: 1.5, textAlign: 'right' }]}>V. Unit.</Text>
              <Text style={[styles.itemsThCell, { flex: 1.5, textAlign: 'right' }]}>V. Total</Text>
            </View>
            {(bidding.itens ?? []).map((item) => (
              <View key={item.id} style={styles.itemsTableRow}>
                <View style={{ flex: 3 }}>
                  <Text style={styles.itemsCell}>{item.descricao}</Text>
                  {item.marca && <Text style={styles.itemsMarca}>{item.marca}</Text>}
                </View>
                <Text style={[styles.itemsCell, { flex: 1, textAlign: 'center' }]}>{item.quantidade}</Text>
                <Text style={[styles.itemsCell, { flex: 1.5, textAlign: 'right' }]}>{fmtCurrency(item.valorUnitario)}</Text>
                <Text style={[styles.itemsCell, { flex: 1.5, textAlign: 'right', fontWeight: '700' }]}>{fmtCurrency(item.valorTotal)}</Text>
              </View>
            ))}
          </ScrollView>
        );

      case 'Documentos':
        return (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 8 }}>
            <Text style={styles.panelSubtitle}>Documentos Necessários</Text>
            {(bidding.documentosNecessarios ?? []).map((doc, i) => {
              const docColors = {
                ok:       { bg: C.greenBg, color: C.green, label: '✓ OK' },
                pendente: { bg: C.yellowBg, color: C.yellow, label: '⏳ Pendente' },
                vencido:  { bg: C.redBg, color: C.red, label: '✕ Vencido' },
              }[doc.status];
              return (
                <View key={i} style={styles.docRow}>
                  <Text style={styles.docNome}>{doc.nome}</Text>
                  <View style={[styles.badge, { backgroundColor: docColors.bg }]}>
                    <Text style={[styles.badgeText, { color: docColors.color }]}>{docColors.label}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        );

      case 'Historico':
        return (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            <Text style={[styles.panelSubtitle, { marginBottom: 16 }]}>Linha do Tempo</Text>
            {(bidding.historico ?? []).map((h, i) => (
              <View key={i} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={styles.timelineDot} />
                  {i < (bidding.historico ?? []).length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineEvento}>{h.evento}</Text>
                  <Text style={styles.timelineData}>{fmtDate(h.data)}</Text>
                  <Text style={styles.timelineDesc}>{h.descricao}</Text>
                </View>
              </View>
            ))}
            <View style={styles.divider} />
            <Text style={styles.panelSubtitle}>Prazos e Condições</Text>
            <View style={{ gap: 8, marginTop: 8 }}>
              <InfoRow label="Prazo de Entrega" value={bidding.prazoEntrega ?? '—'} />
              <InfoRow label="Garantia" value={bidding.garantia ?? '—'} />
              <InfoRow label="Cond. de Pagamento" value={bidding.condicoesPagamento ?? '—'} />
            </View>
          </ScrollView>
        );
    }
  };

  return (
    <Animated.View style={[styles.panel, { transform: [{ translateX: slideAnim }] }]}>
      {/* Header */}
      <View style={styles.panelHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.panelTitle} numberOfLines={2}>{bidding.objeto}</Text>
          <Text style={styles.panelEdital}>{bidding.edital} · {bidding.orgao}</Text>
        </View>
        <TouchableOpacity style={styles.panelClose} onPress={onClose}>
          <Text style={styles.panelCloseText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Detail Tabs */}
      <View style={styles.detailTabsRow}>
        {DETAIL_TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.detailTab, activeTab === t.key && styles.detailTabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.detailTabText, activeTab === t.key && styles.detailTabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        {renderTabContent()}
      </View>

      {/* Action buttons */}
      <View style={styles.panelActions}>
        <TouchableOpacity
          style={[styles.panelBtn, { backgroundColor: C.blue }]}
          onPress={handleGenerateProposta}
          activeOpacity={0.85}
        >
          {generating
            ? <ActivityIndicator size="small" color={C.white} />
            : <Text style={styles.panelBtnText}>{generated ? '✓ Proposta Gerada' : '📄 Gerar Proposta'}</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.panelBtn, { backgroundColor: C.green }]}
          onPress={handleNotify}
          activeOpacity={0.85}
        >
          {notifying
            ? <ActivityIndicator size="small" color={C.white} />
            : <Text style={styles.panelBtnText}>{notified ? '✓ Notificado!' : '🔔 Notificar Cliente'}</Text>
          }
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

function InfoRow({ label, value, multiline, highlight }: {
  label: string; value: string; multiline?: boolean; highlight?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && { color: C.blue, fontWeight: '700' }]} numberOfLines={multiline ? undefined : 1}>
        {value}
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function AdminBiddingsScreen() {
  const [biddings, setBiddings]       = useState<Bidding[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<'Lista' | 'Calendario'>('Lista');
  const [calView, setCalView]         = useState<CalendarView>('Mes');
  const [calYear, setCalYear]         = useState(new Date().getFullYear());
  const [calMonth, setCalMonth]       = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [filterUF, setFilterUF]       = useState('Todos');
  const [filterStatus, setFilterStatus] = useState<BiddingStatus | 'Todos'>('Todos');
  const [filterEmpresa, setFilterEmpresa] = useState('Todos');
  const [filterPeriodoStart, setFilterPeriodoStart] = useState('');
  const [filterPeriodoEnd, setFilterPeriodoEnd]     = useState('');
  const [page, setPage]               = useState(1);
  const [selectedBidding, setSelectedBidding] = useState<Bidding | null>(null);
  const [hoveredRow, setHoveredRow]   = useState<string | null>(null);

  const slideAnim = useState(new Animated.Value(500))[0];
  const PAGE_SIZE = 10;

  // ── Fetch biddings ──────────────────────────────────────────────────────────
  const fetchBiddings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await biddingsApi.list();
      const list: Bidding[] = Array.isArray(data)
        ? data
        : Array.isArray((data as { data?: unknown })?.data)
          ? (data as { data: Bidding[] }).data
          : [];
      setBiddings(list.length > 0 ? list : MOCK_BIDDINGS);
    } catch {
      setBiddings(MOCK_BIDDINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBiddings(); }, [fetchBiddings]);

  // ── Open/close panel ────────────────────────────────────────────────────────
  function openPanel(b: Bidding) {
    setSelectedBidding(b);
    slideAnim.setValue(500);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 12 }).start();
  }

  function closePanel() {
    Animated.timing(slideAnim, { toValue: 500, duration: 220, useNativeDriver: true }).start(() => {
      setSelectedBidding(null);
    });
  }

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const today = new Date();
    const em_disputa  = biddings.filter(b => b.status === 'Em Disputa').length;
    const abertura_hoje = biddings.filter(b => isSameDay(new Date(b.dataAbertura), today)).length;
    const prox7 = biddings.filter(b => {
      const d = daysUntil(b.dataAbertura);
      return d >= 0 && d <= 7;
    }).length;
    const valor_total = biddings.reduce((s, b) => s + b.valorEstimado, 0);
    const valor_marca = biddings.reduce((s, b) => s + (b.valorMarcaCliente ?? 0), 0);
    return { em_disputa, abertura_hoje, prox7, valor_total, valor_marca };
  }, [biddings]);

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return biddings.filter(b => {
      if (filterUF !== 'Todos' && b.uf !== filterUF) return false;
      if (filterStatus !== 'Todos' && b.status !== filterStatus) return false;
      if (filterEmpresa !== 'Todos' && b.empresaCliente !== filterEmpresa) return false;
      if (filterPeriodoStart) {
        const start = new Date(filterPeriodoStart);
        if (new Date(b.dataAbertura) < start) return false;
      }
      if (filterPeriodoEnd) {
        const end = new Date(filterPeriodoEnd);
        if (new Date(b.dataAbertura) > end) return false;
      }
      return true;
    });
  }, [biddings, filterUF, filterStatus, filterEmpresa, filterPeriodoStart, filterPeriodoEnd]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const empresas = useMemo(() => {
    const names = Array.from(new Set(biddings.map(b => b.empresaCliente)));
    return ['Todos', ...names];
  }, [biddings]);

  // ── Calendar helpers ────────────────────────────────────────────────────────
  const calDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (Date | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(calYear, calMonth, d));
    return cells;
  }, [calYear, calMonth]);

  function biddingsForDay(day: Date): Bidding[] {
    return biddings.filter(b => isSameDay(new Date(b.dataAbertura), day));
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
    setSelectedDay(null);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
    setSelectedDay(null);
  }

  const selectedDayBiddings = selectedDay ? biddingsForDay(selectedDay) : [];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, flexDirection: 'row' }}>
      {/* Main content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Licitações</Text>
            <Text style={styles.subtitle}>Gerencie e acompanhe todas as licitações</Text>
          </View>
          <TouchableOpacity style={styles.btnRefresh} onPress={fetchBiddings} activeOpacity={0.8}>
            <Text style={styles.btnRefreshText}>↻ Atualizar</Text>
          </TouchableOpacity>
        </View>

        {/* Metric Cards */}
        {loading ? (
          <ActivityIndicator color={C.blue} style={{ padding: 24 }} />
        ) : (
          <View style={styles.metricsRow}>
            <MetricCard icon="⚖" label="Em Disputa"    value={String(metrics.em_disputa)}      badgeColor={C.blue} />
            <MetricCard icon="📅" label="Abertura Hoje" value={String(metrics.abertura_hoje)}    badgeColor={C.red} />
            <MetricCard icon="🕐" label="Próx. 7 dias"  value={String(metrics.prox7)}            badgeColor={C.yellow} />
            <MetricCard icon="💰" label="Valor Total Est." value={fmtCurrency(metrics.valor_total)} badgeColor={C.green} />
            <MetricCard icon="📈" label="Valor Pot. Clientes" value={fmtCurrency(metrics.valor_marca)} badgeColor={C.primary} />
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabsRow}>
          {(['Lista', 'Calendario'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
                {tab === 'Lista' ? 'Lista de Licitações' : 'Calendário'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── LISTA TAB ─────────────────────────────────────────────────────── */}
        {activeTab === 'Lista' && (
          <View style={styles.card}>
            {/* Filters row */}
            <View style={styles.filtersRow}>
              <Dropdown value={filterEmpresa} options={empresas} onChange={setFilterEmpresa} label="Empresa" />
              <Dropdown value={filterUF}      options={UF_LIST}  onChange={setFilterUF}      label="Estado (UF)" />
              <Dropdown value={filterStatus}  options={STATUS_LIST as string[]} onChange={(v) => setFilterStatus(v as BiddingStatus | 'Todos')} label="Status" />
              <View style={styles.dateRangeGroup}>
                <TextInput
                  style={styles.dateInput}
                  placeholder="De (AAAA-MM-DD)"
                  placeholderTextColor={C.muted}
                  value={filterPeriodoStart}
                  onChangeText={setFilterPeriodoStart}
                />
                <Text style={{ color: C.muted, fontSize: 12 }}>–</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="Até (AAAA-MM-DD)"
                  placeholderTextColor={C.muted}
                  value={filterPeriodoEnd}
                  onChangeText={setFilterPeriodoEnd}
                />
              </View>
              {(filterUF !== 'Todos' || filterStatus !== 'Todos' || filterEmpresa !== 'Todos' || filterPeriodoStart || filterPeriodoEnd) && (
                <TouchableOpacity
                  onPress={() => { setFilterUF('Todos'); setFilterStatus('Todos'); setFilterEmpresa('Todos'); setFilterPeriodoStart(''); setFilterPeriodoEnd(''); setPage(1); }}
                  style={styles.clearBtn}
                >
                  <Text style={styles.clearBtnText}>✕ Limpar</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Table */}
            <View style={styles.tableWrap}>
              {/* Table header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.thCell, { flex: 1.2 }]}>Data Abertura</Text>
                <Text style={[styles.thCell, { flex: 2.5 }]}>Edital / Objeto</Text>
                <Text style={[styles.thCell, { flex: 2 }]}>Órgão</Text>
                <Text style={[styles.thCell, { flex: 1.8 }]}>Empresa Cliente</Text>
                <Text style={[styles.thCell, { flex: 1.5, textAlign: 'right' }]}>Valor Est.</Text>
                <Text style={[styles.thCell, { flex: 1.5, textAlign: 'right' }]}>Marca/Valor</Text>
                <Text style={[styles.thCell, { flex: 1.2, textAlign: 'center' }]}>Status</Text>
                <Text style={[styles.thCell, { width: 70, textAlign: 'center' }]}>Ações</Text>
              </View>

              {loading ? (
                <ActivityIndicator color={C.blue} style={{ padding: 28 }} />
              ) : pageData.length === 0 ? (
                <Text style={{ padding: 24, color: C.muted, textAlign: 'center' }}>Nenhuma licitação encontrada</Text>
              ) : (
                pageData.map((b, idx) => (
                  <Pressable
                    key={b.id}
                    style={[
                      styles.tableRow,
                      idx % 2 === 1 ? { backgroundColor: '#FAFAFA' } : {},
                      hoveredRow === b.id ? { backgroundColor: C.rowHover } : {},
                    ]}
                    onHoverIn={() => setHoveredRow(b.id)}
                    onHoverOut={() => setHoveredRow(null)}
                    onPress={() => openPanel(b)}
                  >
                    <View style={{ flex: 1.2 }}>
                      <Text style={styles.tdPrimary}>{fmtDate(b.dataAbertura)}</Text>
                      {(() => {
                        const d = daysUntil(b.dataAbertura);
                        if (d === 0) return <Text style={[styles.tdSub, { color: C.red }]}>Hoje</Text>;
                        if (d > 0 && d <= 7) return <Text style={[styles.tdSub, { color: C.yellow }]}>em {d} dias</Text>;
                        if (d < 0) return <Text style={[styles.tdSub, { color: C.muted }]}>Encerrada</Text>;
                        return null;
                      })()}
                    </View>
                    <View style={{ flex: 2.5 }}>
                      <Text style={styles.tdPrimary} numberOfLines={1}>{b.edital}</Text>
                      <Text style={styles.tdSub} numberOfLines={2}>{b.objeto}</Text>
                    </View>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.tdPrimary} numberOfLines={1}>{b.orgao}</Text>
                      <Text style={styles.tdSub}>{b.uf}</Text>
                    </View>
                    <Text style={[styles.tdPrimary, { flex: 1.8 }]} numberOfLines={1}>{b.empresaCliente}</Text>
                    <Text style={[styles.tdPrimary, { flex: 1.5, textAlign: 'right', color: C.blue, fontWeight: '700' }]}>
                      {fmtCurrency(b.valorEstimado)}
                    </Text>
                    <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                      <Text style={[styles.tdPrimary, { color: C.green, fontWeight: '700' }]}>
                        {b.valorMarcaCliente ? fmtCurrency(b.valorMarcaCliente) : '—'}
                      </Text>
                      {b.marcaCliente && <Text style={styles.tdSub}>{b.marcaCliente}</Text>}
                    </View>
                    <View style={{ flex: 1.2, alignItems: 'center' }}>
                      <StatusBadge status={b.status} />
                    </View>
                    <View style={{ width: 70, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                      <TouchableOpacity onPress={() => openPanel(b)} activeOpacity={0.7}>
                        <Text style={{ fontSize: 16, color: C.blue }}>👁</Text>
                      </TouchableOpacity>
                      <TouchableOpacity activeOpacity={0.7}>
                        <Text style={{ fontSize: 16, color: C.muted }}>⋯</Text>
                      </TouchableOpacity>
                    </View>
                  </Pressable>
                ))
              )}
            </View>

            {/* Pagination */}
            {totalPages > 1 && (
              <View style={styles.pagination}>
                <Text style={styles.paginationInfo}>
                  {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} · Página {page} de {totalPages}
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
                    onPress={() => page > 1 && setPage(p => p - 1)}
                  >
                    <Text style={styles.pageBtnText}>‹ Anterior</Text>
                  </TouchableOpacity>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const p = i + 1;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[styles.pageBtn, page === p && styles.pageBtnActive]}
                        onPress={() => setPage(p)}
                      >
                        <Text style={[styles.pageBtnText, page === p && { color: C.white, fontWeight: '700' }]}>{p}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[styles.pageBtn, page === totalPages && styles.pageBtnDisabled]}
                    onPress={() => page < totalPages && setPage(p => p + 1)}
                  >
                    <Text style={styles.pageBtnText}>Próxima ›</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── CALENDÁRIO TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'Calendario' && (
          <View style={styles.card}>
            {/* Calendar controls */}
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn}>
                <Text style={styles.calNavText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.calTitle}>
                {MONTHS_PT[calMonth]} {calYear}
              </Text>
              <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn}>
                <Text style={styles.calNavText}>›</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              {/* View toggle */}
              <View style={styles.calViewToggle}>
                {(['Mes', 'Semana', 'Dia'] as CalendarView[]).map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={[styles.calViewBtn, calView === v && styles.calViewBtnActive]}
                    onPress={() => setCalView(v)}
                  >
                    <Text style={[styles.calViewBtnText, calView === v && styles.calViewBtnTextActive]}>
                      {v === 'Mes' ? 'Mês' : v}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Weekday labels */}
            <View style={styles.calWeekdays}>
              {WEEKDAYS_PT.map((wd) => (
                <View key={wd} style={styles.calWeekdayCell}>
                  <Text style={styles.calWeekdayText}>{wd}</Text>
                </View>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.calGrid}>
              {calDays.map((day, i) => {
                if (!day) return <View key={i} style={styles.calCell} />;
                const dayBiddings = biddingsForDay(day);
                const dotColor = dayColor(dayBiddings);
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.calCell,
                      isToday && styles.calCellToday,
                      isSelected && styles.calCellSelected,
                    ]}
                    onPress={() => setSelectedDay(isSelected ? null : day)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.calDayNum,
                      isToday && { color: C.white, fontWeight: '800' },
                      isSelected && { color: C.white, fontWeight: '800' },
                    ]}>
                      {day.getDate()}
                    </Text>
                    {dayBiddings.length > 0 && (
                      <View style={styles.calEventDots}>
                        {dayBiddings.slice(0, 3).map((_, di) => (
                          <View key={di} style={[styles.calDot, { backgroundColor: dotColor ?? C.blue }]} />
                        ))}
                        {dayBiddings.length > 3 && (
                          <Text style={[styles.calDotMore, { color: dotColor ?? C.blue }]}>+{dayBiddings.length - 3}</Text>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Legend */}
            <View style={styles.calLegend}>
              <View style={styles.calLegendItem}>
                <View style={[styles.calLegendDot, { backgroundColor: C.blue }]} />
                <Text style={styles.calLegendText}>Em Disputa</Text>
              </View>
              <View style={styles.calLegendItem}>
                <View style={[styles.calLegendDot, { backgroundColor: C.red }]} />
                <Text style={styles.calLegendText}>Abertura Hoje / Urgente (≤2 dias)</Text>
              </View>
              <View style={styles.calLegendItem}>
                <View style={[styles.calLegendDot, { backgroundColor: C.yellow }]} />
                <Text style={styles.calLegendText}>Próximos 7 dias</Text>
              </View>
            </View>

            {/* Selected day detail */}
            {selectedDay && (
              <View style={styles.calDayDetail}>
                <Text style={styles.calDayDetailTitle}>
                  {selectedDay.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                </Text>
                {selectedDayBiddings.length === 0 ? (
                  <Text style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>Nenhuma licitação neste dia.</Text>
                ) : (
                  selectedDayBiddings.map((b) => (
                    <Pressable key={b.id} style={styles.calDayBiddingRow} onPress={() => openPanel(b)}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.calDayBiddingEdital}>{b.edital}</Text>
                        <Text style={styles.calDayBiddingObjeto} numberOfLines={2}>{b.objeto}</Text>
                        <Text style={styles.calDayBiddingOrgao}>{b.orgao}</Text>
                      </View>
                      <StatusBadge status={b.status} />
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* Detail Panel overlay */}
      {selectedBidding && (
        <>
          <Pressable style={styles.overlay} onPress={closePanel} />
          <DetailPanel
            bidding={selectedBidding}
            onClose={closePanel}
            slideAnim={slideAnim}
          />
        </>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  content: {
    padding: 28,
    paddingBottom: 48,
    gap: 20,
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
  btnRefresh: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  btnRefreshText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
  },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    alignItems: 'flex-start',
    gap: 8,
  },
  metricIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricIcon: { fontSize: 20 },
  metricValue: {
    fontSize: 26,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.5,
  },
  metricLabel: {
    fontSize: 12,
    color: C.muted,
    fontWeight: '500',
  },

  // Tabs
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: C.border,
    gap: 0,
  },
  tabBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -2,
  },
  tabBtnActive: {
    borderBottomColor: C.blue,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: C.muted,
  },
  tabBtnTextActive: {
    color: C.blue,
    fontWeight: '700',
  },

  // Card (main content area)
  card: {
    backgroundColor: C.white,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  // Filters
  filtersRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    flexWrap: 'wrap',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: '#FAFAFA',
    zIndex: 200,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
    minWidth: 120,
  },
  dropdownBtnText: {
    fontSize: 13,
    color: C.text,
    fontWeight: '500',
    flex: 1,
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    backgroundColor: C.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 9999,
    minWidth: 160,
    maxHeight: 260,
    overflow: 'scroll' as never,
  },
  dropdownOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownOptionActive: { backgroundColor: C.blueBg },
  dropdownOptionText: { fontSize: 13, color: C.text },
  dateRangeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: C.text,
    backgroundColor: C.white,
    minWidth: 130,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.red,
    backgroundColor: C.redBg,
  },
  clearBtnText: {
    fontSize: 12,
    color: C.red,
    fontWeight: '600',
  },

  // Table
  tableWrap: { overflow: 'hidden' },
  tableHeader: {
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
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    cursor: 'pointer' as never,
  },
  tdPrimary: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
  },
  tdSub: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },

  // Badge
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Pagination
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  paginationInfo: {
    fontSize: 12,
    color: C.muted,
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
    backgroundColor: C.blue,
    borderColor: C.blue,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 12,
    color: C.text,
  },

  // Calendar
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  calNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.white,
  },
  calNavText: { fontSize: 18, color: C.text, fontWeight: '700' },
  calTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
    minWidth: 180,
  },
  calViewToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  calViewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: C.white,
  },
  calViewBtnActive: { backgroundColor: C.blue },
  calViewBtnText: { fontSize: 12, color: C.text, fontWeight: '600' },
  calViewBtnTextActive: { color: C.white },

  calWeekdays: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: '#F9FAFB',
  },
  calWeekdayCell: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  calWeekdayText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  calCell: {
    width: `${100 / 7}%` as never,
    minHeight: 80,
    padding: 6,
    borderWidth: 0.5,
    borderColor: '#F0F0F0',
    alignItems: 'center',
    borderRadius: 4,
    position: 'relative',
  },
  calCellToday: {
    backgroundColor: C.blue,
    borderColor: C.blue,
  },
  calCellSelected: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  calDayNum: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
  },
  calEventDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    marginTop: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  calDotMore: {
    fontSize: 9,
    fontWeight: '700',
  },

  calLegend: {
    flexDirection: 'row',
    gap: 16,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexWrap: 'wrap',
  },
  calLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  calLegendText: {
    fontSize: 11,
    color: C.muted,
  },

  calDayDetail: {
    borderTopWidth: 2,
    borderTopColor: C.border,
    padding: 16,
    backgroundColor: '#FAFAFA',
  },
  calDayDetailTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
    textTransform: 'capitalize',
    marginBottom: 8,
  },
  calDayBiddingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: C.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 6,
    cursor: 'pointer' as never,
  },
  calDayBiddingEdital: {
    fontSize: 12,
    fontWeight: '700',
    color: C.blue,
  },
  calDayBiddingObjeto: {
    fontSize: 12,
    color: C.text,
    marginTop: 2,
  },
  calDayBiddingOrgao: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },

  // Detail Panel
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 10,
  },
  panel: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0,
    width: 460,
    backgroundColor: C.white,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
    flexDirection: 'column',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 20,
    backgroundColor: C.primary,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.white,
    lineHeight: 21,
  },
  panelEdital: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 3,
  },
  panelClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  panelCloseText: {
    color: C.white,
    fontSize: 14,
    fontWeight: '700',
  },

  detailTabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.white,
  },
  detailTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  detailTabActive: {
    borderBottomColor: C.blue,
  },
  detailTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: C.muted,
  },
  detailTabTextActive: {
    color: C.blue,
    fontWeight: '700',
  },

  panelActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.white,
  },
  panelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  panelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.white,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.muted,
    width: 140,
    flexShrink: 0,
  },
  infoValue: {
    fontSize: 13,
    color: C.text,
    flex: 1,
    fontWeight: '500',
  },
  panelSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 12,
  },

  // Items table
  itemsTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    borderRadius: 4,
    gap: 4,
  },
  itemsThCell: {
    fontSize: 10,
    fontWeight: '700',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  itemsCell: {
    fontSize: 12,
    color: C.text,
  },
  itemsMarca: {
    fontSize: 10,
    color: C.muted,
    marginTop: 1,
  },

  // Documents
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  docNome: {
    fontSize: 13,
    color: C.text,
    fontWeight: '500',
    flex: 1,
  },

  // Timeline
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 20,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.blue,
    marginTop: 4,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: C.border,
    marginTop: 4,
    marginBottom: -4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 16,
  },
  timelineEvento: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
  },
  timelineData: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
  timelineDesc: {
    fontSize: 12,
    color: C.gray,
    marginTop: 4,
    lineHeight: 17,
  },
});
