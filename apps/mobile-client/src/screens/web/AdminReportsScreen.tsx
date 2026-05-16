/**
 * AdminReportsScreen — Análise de Editais (upload manual + resultado + histórico)
 * Rota: Reports (admin web)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { adminApi, analysisApi } from '../../services/api';

// ─── Paleta ───────────────────────────────────────────────────────────────────
const C = {
  bg:            '#F5F7FA',
  primary:       '#1B365D',
  primaryLight:  '#2A4F87',
  accent:        '#2563EB',
  accentLight:   '#EFF6FF',
  green:         '#10B981',
  greenBg:       '#D1FAE5',
  greenText:     '#065F46',
  red:           '#EF4444',
  redBg:         '#FEF2F2',
  redDark:       '#DC2626',
  yellow:        '#F59E0B',
  yellowBg:      '#FEF3C7',
  yellowText:    '#92400E',
  orange:        '#F97316',
  orangeBg:      '#FFF7ED',
  white:         '#FFFFFF',
  border:        '#E2E8F0',
  borderLight:   '#F1F5F9',
  borderDashed:  '#CBD5E1',
  textPrimary:   '#1E293B',
  textSecondary: '#64748B',
  textMuted:     '#94A3B8',
  tableBg:       '#FAFBFC',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Tenant {
  id: string;
  corporateName: string;
  tradeName?: string;
}

interface LicitacaoItem {
  numero?: string;
  descricao?: string;
  unidade?: string;
  quantidade?: number | string;
  valorUnitario?: number | string;
  valorTotal?: number | string;
  marca?: string;
}

interface HabilitacaoSection {
  tecnica?: string;
  juridica?: string;
  financeira?: string;
}

interface RiscoItem {
  titulo?: string;
  descricao?: string;
  nivel?: 'baixo' | 'medio' | 'alto';
}

interface PontoImpugnacao {
  descricao?: string;
  gravidade?: 'baixa' | 'media' | 'alta';
}

interface CapagData {
  municipio?: string;
  uf?: string;
  populacao?: string | number;
  capag?: string;
  receita?: string;
  despesa?: string;
}

interface AnalysisResult {
  id: string;
  tenantId?: string;
  tenantName?: string;
  createdAt?: string;
  objeto?: string;
  orgao?: string;
  numeroEdital?: string;
  recomendacao?: 'participar' | 'cautela' | 'nao_participar';
  resumoExecutivo?: string;
  informacoesBasicas?: {
    orgao?: string;
    numeroPregao?: string;
    valorEstimado?: string | number;
    dataAbertura?: string;
    modalidade?: string;
    uf?: string;
    municipio?: string;
    objeto?: string;
    registroPreco?: boolean;
    tipoJulgamento?: string;
    prazoEntrega?: string;
  };
  itens?: LicitacaoItem[];
  habilitacao?: HabilitacaoSection;
  declaracoesExigidas?: string[];
  riscos?: RiscoItem[];
  pontosImpugnacao?: PontoImpugnacao[];
  capag?: CapagData;
  condicoesPagamento?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch { return '—'; }
}

function fmtCurrency(val?: string | number): string {
  if (val == null || val === '') return '—';
  const n = typeof val === 'string' ? parseFloat(val.replace(/[^\d.,]/g, '').replace(',', '.')) : val;
  if (isNaN(n)) return String(val);
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDismiss }: { msg: string; type: 'success' | 'error'; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);
  const bg = type === 'success' ? C.green : C.red;
  return (
    <View style={[toast.wrap, { backgroundColor: bg }]}>
      <Text style={toast.text}>{msg}</Text>
      <TouchableOpacity onPress={onDismiss} activeOpacity={0.7}>
        <Text style={toast.close}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}
const toast = StyleSheet.create({
  wrap:  { position: 'absolute', bottom: 32, right: 32, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 10, zIndex: 9999, ...(Platform.OS === 'web' ? ({ boxShadow: '0 4px 20px rgba(0,0,0,0.18)' } as object) : { elevation: 12 }) },
  text:  { color: C.white, fontSize: 14, fontWeight: '600', flex: 1 },
  close: { color: C.white, fontSize: 16, fontWeight: '700' },
});

// ─── Recommendation badge ─────────────────────────────────────────────────────
function RecBadge({ rec }: { rec?: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    participar:     { label: 'Participar',              color: C.greenText, bg: C.greenBg },
    cautela:        { label: 'Participar com Cautela',  color: C.yellowText, bg: C.yellowBg },
    nao_participar: { label: 'Não Participar',          color: C.redDark,   bg: C.redBg },
  };
  const cfg = map[rec ?? ''] ?? { label: rec ?? '—', color: C.textSecondary, bg: C.border };
  return (
    <View style={[rb.base, { backgroundColor: cfg.bg }]}>
      <Text style={[rb.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}
const rb = StyleSheet.create({
  base: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  text: { fontSize: 13, fontWeight: '700' },
});

// ─── Risk level badge ─────────────────────────────────────────────────────────
function RiskBadge({ nivel }: { nivel?: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    baixo: { label: 'Baixo', color: C.greenText, bg: C.greenBg },
    medio: { label: 'Médio', color: C.yellowText, bg: C.yellowBg },
    alto:  { label: 'Alto',  color: C.redDark,    bg: C.redBg },
  };
  const cfg = map[nivel ?? ''] ?? { label: nivel ?? '—', color: C.textSecondary, bg: C.border };
  return (
    <View style={[rb.base, { backgroundColor: cfg.bg, paddingHorizontal: 8, paddingVertical: 3 }]}>
      <Text style={[rb.text, { color: cfg.color, fontSize: 11 }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── Collapsible Section ──────────────────────────────────────────────────────
function Section({
  title, icon, defaultOpen = false, children,
}: {
  title: string; icon: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={sec.card}>
      <TouchableOpacity style={sec.header} onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <Text style={sec.icon}>{icon}</Text>
        <Text style={sec.title}>{title}</Text>
        <Text style={sec.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && <View style={sec.body}>{children}</View>}
    </View>
  );
}
const sec = StyleSheet.create({
  card:    { backgroundColor: C.white, borderRadius: 12, overflow: 'hidden', ...(Platform.OS === 'web' ? ({ boxShadow: '0 1px 4px rgba(15,23,42,0.07)' } as object) : { elevation: 2 }) },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 16 },
  icon:    { fontSize: 18 },
  title:   { flex: 1, fontSize: 15, fontWeight: '700', color: C.textPrimary },
  chevron: { fontSize: 10, color: C.textSecondary },
  body:    { paddingHorizontal: 20, paddingBottom: 20, borderTopWidth: 1, borderTopColor: C.borderLight },
});

// ─── Info Grid Cell ───────────────────────────────────────────────────────────
function InfoCell({ label, value }: { label: string; value?: string | number | boolean | null }) {
  const display = value == null || value === '' ? '—'
    : typeof value === 'boolean' ? (value ? 'Sim' : 'Não')
    : String(value);
  return (
    <View style={ig.cell}>
      <Text style={ig.label}>{label}</Text>
      <Text style={ig.value}>{display}</Text>
    </View>
  );
}
const ig = StyleSheet.create({
  cell:  { flex: 1, minWidth: 160, padding: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  label: { fontSize: 11, color: C.textSecondary, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  value: { fontSize: 13, color: C.textPrimary, fontWeight: '600' },
});

// ─── Dropdown ─────────────────────────────────────────────────────────────────
function Dropdown({
  value, options, placeholder, onChange,
}: {
  value: string; options: { label: string; value: string }[]; placeholder: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <View style={dd.wrap}>
      <TouchableOpacity style={dd.trigger} onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <Text style={[dd.text, !selected && dd.placeholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={dd.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={dd.list}>
          <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
            {options.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[dd.opt, value === opt.value && dd.optActive]}
                onPress={() => { onChange(opt.value); setOpen(false); }}
                activeOpacity={0.7}
              >
                <Text style={[dd.optText, value === opt.value && { color: C.accent, fontWeight: '700' }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
const dd = StyleSheet.create({
  wrap:        { position: 'relative', minWidth: 220 },
  trigger:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  text:        { fontSize: 14, color: C.textPrimary, fontWeight: '500', flex: 1 },
  placeholder: { color: C.textMuted },
  chevron:     { fontSize: 9, color: C.textSecondary },
  list:        { position: 'absolute', top: 44, left: 0, right: 0, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 8, zIndex: 999, ...(Platform.OS === 'web' ? ({ boxShadow: '0 4px 16px rgba(15,23,42,0.14)' } as object) : { elevation: 10 }) },
  opt:         { paddingHorizontal: 14, paddingVertical: 10 },
  optActive:   { backgroundColor: C.accentLight },
  optText:     { fontSize: 13, color: C.textPrimary },
});

// ─── Upload Area ──────────────────────────────────────────────────────────────
function UploadArea({
  file, onFileSelected, onRemove, dragOver, onDragOver, onDragLeave, onDrop,
}: {
  file: File | null;
  onFileSelected: (f: File) => void;
  onRemove: () => void;
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (file) {
    return (
      <View style={ua.fileRow}>
        <View style={ua.fileIcon}><Text style={{ fontSize: 22 }}>📄</Text></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={ua.fileName} numberOfLines={1}>{file.name}</Text>
          <Text style={ua.fileSize}>{fmtBytes(file.size)}</Text>
        </View>
        <TouchableOpacity style={ua.removeBtn} onPress={onRemove} activeOpacity={0.7}>
          <Text style={ua.removeBtnText}>✕ Remover</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (Platform.OS !== 'web') {
    return (
      <View style={ua.area}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>📂</Text>
        <Text style={ua.areaTitle}>Upload disponível apenas na versão web</Text>
      </View>
    );
  }

  return (
    <View
      style={[ua.area, dragOver && ua.areaDragOver]}
      // @ts-ignore — web-only drag events
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Text style={{ fontSize: 36, marginBottom: 12 }}>📂</Text>
      <Text style={ua.areaTitle}>Arraste o arquivo aqui</Text>
      <Text style={ua.areaSub}>ou</Text>
      <TouchableOpacity
        style={ua.browseBtn}
        onPress={() => inputRef.current?.click()}
        activeOpacity={0.8}
      >
        <Text style={ua.browseBtnText}>Selecionar Arquivo</Text>
      </TouchableOpacity>
      <Text style={ua.areaHint}>PDF ou DOCX • Máximo 50 MB</Text>
      {/* Hidden file input */}
      {/* @ts-ignore */}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        style={{ display: 'none' }}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const f = e.target.files?.[0];
          if (f) onFileSelected(f);
        }}
      />
    </View>
  );
}
const ua = StyleSheet.create({
  area:        { borderWidth: 2, borderStyle: 'dashed', borderColor: C.borderDashed, borderRadius: 12, paddingVertical: 48, alignItems: 'center', gap: 8, backgroundColor: C.tableBg },
  areaDragOver:{ borderColor: C.accent, backgroundColor: C.accentLight },
  areaTitle:   { fontSize: 15, fontWeight: '700', color: C.textPrimary },
  areaSub:     { fontSize: 13, color: C.textMuted },
  browseBtn:   { marginTop: 4, backgroundColor: C.accent, borderRadius: 8, paddingHorizontal: 22, paddingVertical: 10 },
  browseBtnText: { fontSize: 14, fontWeight: '700', color: C.white },
  areaHint:    { fontSize: 12, color: C.textMuted, marginTop: 4 },
  fileRow:     { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.accentLight, borderRadius: 10, padding: 16, borderWidth: 1, borderColor: C.accent + '55' },
  fileIcon:    { width: 48, height: 48, borderRadius: 8, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', ...(Platform.OS === 'web' ? ({ boxShadow: '0 1px 4px rgba(37,99,235,0.12)' } as object) : { elevation: 2 }) },
  fileName:    { fontSize: 14, fontWeight: '700', color: C.textPrimary },
  fileSize:    { fontSize: 12, color: C.textSecondary },
  removeBtn:   { borderWidth: 1, borderColor: C.red, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  removeBtnText: { fontSize: 12, fontWeight: '700', color: C.red },
});

// ─── History Table Row ────────────────────────────────────────────────────────
function HistoryRow({
  item, onView, onDownload, onResend, isResending,
}: {
  item: AnalysisResult;
  onView: () => void;
  onDownload: () => void;
  onResend: () => void;
  isResending: boolean;
}) {
  return (
    <View style={hr.row}>
      <Text style={[hr.cell, { flex: 1 }]}>{fmtDate(item.createdAt)}</Text>
      <Text style={[hr.cell, { flex: 1.5 }]} numberOfLines={1}>{item.tenantName ?? '—'}</Text>
      <Text style={[hr.cell, { flex: 2.5 }]} numberOfLines={1}>{item.objeto ?? item.informacoesBasicas?.objeto ?? '—'}</Text>
      <View style={[hr.cellWrap, { flex: 1.2 }]}>
        <RecBadge rec={item.recomendacao} />
      </View>
      <View style={[hr.actions, { flex: 1.5 }]}>
        <TouchableOpacity style={hr.btn} onPress={onView} activeOpacity={0.7}>
          <Text style={hr.btnText}>Ver</Text>
        </TouchableOpacity>
        <TouchableOpacity style={hr.btn} onPress={onDownload} activeOpacity={0.7}>
          <Text style={hr.btnText}>PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[hr.btn, hr.btnGreen]} onPress={onResend} disabled={isResending} activeOpacity={0.7}>
          {isResending
            ? <ActivityIndicator size="small" color={C.white} />
            : <Text style={[hr.btnText, { color: C.white }]}>Reenviar</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}
const hr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borderLight, gap: 8 },
  cell:     { fontSize: 13, color: C.textPrimary },
  cellWrap: { justifyContent: 'flex-start' },
  actions:  { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  btn:      { borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  btnGreen: { backgroundColor: C.green, borderColor: C.green },
  btnText:  { fontSize: 12, fontWeight: '600', color: C.textPrimary },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function AdminReportsScreen() {
  // Tenants
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');

  // Upload
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Current result
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // History
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Download
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Toast
  const [toastMsg, setToastMsg] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToastMsg({ msg, type });
  }

  useEffect(() => {
    loadTenants();
    loadHistory();
  }, []);

  async function loadTenants() {
    try {
      const res = await adminApi.listTenants();
      const raw = Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data?.items ?? []);
      setTenants(raw as Tenant[]);
    } catch { /* ignore */ }
  }

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await analysisApi.list();
      const raw = Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data?.items ?? []);
      setHistory(raw as AnalysisResult[]);
    } catch { setHistory([]); }
    finally { setHistoryLoading(false); }
  }, []);

  // ─── File handlers ─────────────────────────────────────────────────────────
  function handleFileSelected(f: File) {
    const maxSize = 50 * 1024 * 1024;
    if (f.size > maxSize) { showToast('Arquivo excede 50 MB. Selecione um arquivo menor.', 'error'); return; }
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'docx') { showToast('Apenas arquivos PDF ou DOCX são aceitos.', 'error'); return; }
    setFile(f);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelected(f);
  }

  // ─── Submit analysis ────────────────────────────────────────────────────────
  async function handleAnalyze() {
    if (!file) { showToast('Selecione um arquivo antes de analisar.', 'error'); return; }
    if (!selectedTenantId) { showToast('Selecione a empresa antes de analisar.', 'error'); return; }
    setUploading(true);
    try {
      const res = await analysisApi.upload(file as unknown as File, selectedTenantId);
      const data = res.data as AnalysisResult;
      // Attach tenantName for display
      const tenant = tenants.find(t => t.id === selectedTenantId);
      if (tenant && data) data.tenantName = tenant.tradeName ?? tenant.corporateName;
      setResult(data);
      showToast('Análise concluída com sucesso!');
      loadHistory();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao analisar edital. Tente novamente.';
      showToast(msg, 'error');
    } finally {
      setUploading(false);
    }
  }

  // ─── Download PDF ──────────────────────────────────────────────────────────
  async function handleDownloadPdf(id: string) {
    if (Platform.OS !== 'web') return;
    setDownloadingId(id);
    try {
      const res = await analysisApi.getPdf(id);
      const blob = new Blob([res.data as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analise-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Erro ao baixar o PDF.', 'error');
    } finally {
      setDownloadingId(null);
    }
  }

  // ─── Send to client ────────────────────────────────────────────────────────
  async function handleSendToClient(analysisId: string, tenantId?: string) {
    const tid = tenantId ?? selectedTenantId;
    if (!tid) { showToast('Selecione a empresa para enviar.', 'error'); return; }
    setSendingId(analysisId);
    try {
      await analysisApi.sendToTenant(analysisId, tid);
      showToast('Análise enviada para o cliente com sucesso!');
    } catch {
      showToast('Erro ao enviar para o cliente.', 'error');
    } finally {
      setSendingId(null);
    }
  }

  // ─── Resend from history ───────────────────────────────────────────────────
  async function handleResend(item: AnalysisResult) {
    const tid = item.tenantId ?? selectedTenantId;
    if (!tid) { showToast('Empresa não encontrada para reenvio.', 'error'); return; }
    setResendingId(item.id);
    try {
      await analysisApi.sendToTenant(item.id, tid);
      showToast('Análise reenviada com sucesso!');
    } catch {
      showToast('Erro ao reenviar para o cliente.', 'error');
    } finally {
      setResendingId(null);
    }
  }

  // ─── View history item ─────────────────────────────────────────────────────
  async function handleViewHistoryItem(item: AnalysisResult) {
    // If we already have full data, just show it; otherwise fetch
    if (item.resumoExecutivo || item.informacoesBasicas) {
      setResult(item);
      return;
    }
    try {
      const res = await analysisApi.get(item.id);
      const full = res.data as AnalysisResult;
      const tenant = tenants.find(t => t.id === (full.tenantId ?? item.tenantId));
      if (tenant) full.tenantName = tenant.tradeName ?? tenant.corporateName;
      setResult(full);
    } catch {
      setResult(item);
    }
    // Scroll to top
    if (Platform.OS === 'web') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const tenantOptions = tenants.map(t => ({
    label: t.tradeName ?? t.corporateName,
    value: t.id,
  }));

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Relatórios – Análise de Editais</Text>
            <Text style={s.headerSub}>Faça upload de um edital e obtenha uma análise completa com recomendação de participação.</Text>
          </View>
        </View>

        {/* ── UPLOAD SECTION ──────────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Analisar Novo Edital</Text>
          <Text style={s.sectionSub}>Selecione a empresa e faça upload do edital em PDF ou DOCX.</Text>

          {/* Empresa selector */}
          <View style={s.companyRow}>
            <Text style={s.fieldLabel}>Empresa *</Text>
            <Dropdown
              value={selectedTenantId}
              options={tenantOptions}
              placeholder="Selecionar empresa..."
              onChange={setSelectedTenantId}
            />
          </View>

          {/* Upload area */}
          <View style={{ marginTop: 16 }}>
            <Text style={s.fieldLabel}>Arquivo do Edital *</Text>
            <View style={{ marginTop: 8 }}>
              <UploadArea
                file={file}
                onFileSelected={handleFileSelected}
                onRemove={() => setFile(null)}
                dragOver={dragOver}
                onDragOver={handleDragOver}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              />
            </View>
          </View>

          {/* Analyze button */}
          <TouchableOpacity
            style={[s.analyzeBtn, (!file || !selectedTenantId || uploading) && s.analyzeBtnDisabled]}
            onPress={handleAnalyze}
            disabled={!file || !selectedTenantId || uploading}
            activeOpacity={0.85}
          >
            {uploading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator size="small" color={C.white} />
                <Text style={s.analyzeBtnText}>Analisando edital... isso pode levar até 2 minutos</Text>
              </View>
            ) : (
              <Text style={s.analyzeBtnText}>Analisar Edital</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── RESULT SECTION ──────────────────────────────────────────────── */}
        {result && (
          <View style={{ gap: 12 }}>
            {/* Result header with actions */}
            <View style={s.resultHeader}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.resultTitle}>
                  {result.objeto ?? result.informacoesBasicas?.objeto ?? 'Resultado da Análise'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={s.resultSub}>{result.orgao ?? result.informacoesBasicas?.orgao ?? ''}</Text>
                  {result.tenantName && (
                    <View style={s.tenantPill}>
                      <Text style={s.tenantPillText}>{result.tenantName}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                {/* Download PDF button */}
                <TouchableOpacity
                  style={[s.actionBtn, s.actionBtnRed]}
                  onPress={() => handleDownloadPdf(result.id)}
                  disabled={downloadingId === result.id}
                  activeOpacity={0.85}
                >
                  {downloadingId === result.id
                    ? <ActivityIndicator size="small" color={C.white} />
                    : <Text style={s.actionBtnText}>Gerar PDF</Text>}
                </TouchableOpacity>
                {/* Send to client button */}
                <TouchableOpacity
                  style={[s.actionBtn, s.actionBtnGreen]}
                  onPress={() => handleSendToClient(result.id, result.tenantId)}
                  disabled={sendingId === result.id}
                  activeOpacity={0.85}
                >
                  {sendingId === result.id
                    ? <ActivityIndicator size="small" color={C.white} />
                    : <Text style={s.actionBtnText}>Enviar para Cliente</Text>}
                </TouchableOpacity>
              </View>
            </View>

            {/* 1. Resumo Executivo */}
            <Section title="Resumo Executivo" icon="📋" defaultOpen>
              <View style={{ gap: 12, paddingTop: 12 }}>
                <RecBadge rec={result.recomendacao} />
                {result.resumoExecutivo ? (
                  <Text style={s.bodyText}>{result.resumoExecutivo}</Text>
                ) : (
                  <Text style={s.emptyText}>Resumo não disponível.</Text>
                )}
              </View>
            </Section>

            {/* 2. Informações Básicas */}
            {result.informacoesBasicas && (
              <Section title="Informações Básicas" icon="🏛">
                <View style={s.infoGrid}>
                  <InfoCell label="Órgão"            value={result.informacoesBasicas.orgao} />
                  <InfoCell label="Nº Pregão"        value={result.informacoesBasicas.numeroPregao ?? result.numeroEdital} />
                  <InfoCell label="Valor Estimado"   value={fmtCurrency(result.informacoesBasicas.valorEstimado)} />
                  <InfoCell label="Data de Abertura" value={fmtDate(result.informacoesBasicas.dataAbertura)} />
                  <InfoCell label="Modalidade"       value={result.informacoesBasicas.modalidade} />
                  <InfoCell label="UF"               value={result.informacoesBasicas.uf} />
                  <InfoCell label="Município"        value={result.informacoesBasicas.municipio} />
                  <InfoCell label="Registro de Preço" value={result.informacoesBasicas.registroPreco} />
                  <InfoCell label="Tipo de Julgamento" value={result.informacoesBasicas.tipoJulgamento} />
                  <InfoCell label="Prazo de Entrega" value={result.informacoesBasicas.prazoEntrega} />
                  <InfoCell label="Objeto"           value={result.informacoesBasicas.objeto} />
                </View>
              </Section>
            )}

            {/* 3. Itens da Licitação */}
            {result.itens && result.itens.length > 0 && (
              <Section title="Itens da Licitação" icon="📦">
                <View style={s.tableWrap}>
                  {/* Table header */}
                  <View style={s.tableHead}>
                    <Text style={[s.th, { flex: 0.5, textAlign: 'center' }]}>Nº</Text>
                    <Text style={[s.th, { flex: 3 }]}>Descrição</Text>
                    <Text style={[s.th, { flex: 1 }]}>Unid.</Text>
                    <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Qtd.</Text>
                    <Text style={[s.th, { flex: 1.5, textAlign: 'right' }]}>Valor Unit.</Text>
                    <Text style={[s.th, { flex: 1.5, textAlign: 'right' }]}>Valor Total</Text>
                  </View>
                  {result.itens.map((item, idx) => (
                    <View key={idx} style={[s.tableRow, idx % 2 === 1 && { backgroundColor: C.tableBg }]}>
                      <Text style={[s.td, { flex: 0.5, textAlign: 'center', color: C.textMuted }]}>{String(idx + 1).padStart(2, '0')}</Text>
                      <Text style={[s.td, { flex: 3 }]} numberOfLines={2}>{item.descricao ?? '—'}</Text>
                      <Text style={[s.td, { flex: 1 }]}>{item.unidade ?? '—'}</Text>
                      <Text style={[s.td, { flex: 1, textAlign: 'right' }]}>{item.quantidade != null ? String(item.quantidade) : '—'}</Text>
                      <Text style={[s.td, { flex: 1.5, textAlign: 'right' }]}>{fmtCurrency(item.valorUnitario)}</Text>
                      <Text style={[s.td, { flex: 1.5, textAlign: 'right', fontWeight: '700' }]}>{fmtCurrency(item.valorTotal)}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {/* 4. Habilitação */}
            {result.habilitacao && (
              <Section title="Habilitação" icon="📑">
                <View style={{ gap: 16, paddingTop: 12 }}>
                  {result.habilitacao.tecnica && (
                    <View style={s.habSection}>
                      <Text style={s.habTitle}>Qualificação Técnica</Text>
                      <Text style={s.bodyText}>{result.habilitacao.tecnica}</Text>
                    </View>
                  )}
                  {result.habilitacao.juridica && (
                    <View style={s.habSection}>
                      <Text style={s.habTitle}>Habilitação Jurídica</Text>
                      <Text style={s.bodyText}>{result.habilitacao.juridica}</Text>
                    </View>
                  )}
                  {result.habilitacao.financeira && (
                    <View style={s.habSection}>
                      <Text style={s.habTitle}>Qualificação Financeira</Text>
                      <Text style={s.bodyText}>{result.habilitacao.financeira}</Text>
                    </View>
                  )}
                </View>
              </Section>
            )}

            {/* 5. Declarações Exigidas */}
            {result.declaracoesExigidas && result.declaracoesExigidas.length > 0 && (
              <Section title="Declarações Exigidas" icon="✅">
                <View style={{ gap: 8, paddingTop: 12 }}>
                  {result.declaracoesExigidas.map((dec, idx) => (
                    <View key={idx} style={s.listItem}>
                      <Text style={s.listBullet}>•</Text>
                      <Text style={s.listText}>{dec}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {/* 6. Análise de Riscos */}
            {result.riscos && result.riscos.length > 0 && (
              <Section title="Análise de Riscos" icon="⚠️">
                <View style={{ gap: 10, paddingTop: 12 }}>
                  {result.riscos.map((risco, idx) => {
                    const levelColor = risco.nivel === 'alto' ? C.redBg : risco.nivel === 'medio' ? C.yellowBg : C.greenBg;
                    const levelBorder = risco.nivel === 'alto' ? C.red : risco.nivel === 'medio' ? C.yellow : C.green;
                    return (
                      <View key={idx} style={[s.riskCard, { backgroundColor: levelColor, borderLeftColor: levelBorder }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <Text style={s.riskTitle}>{risco.titulo ?? `Risco ${idx + 1}`}</Text>
                          <RiskBadge nivel={risco.nivel} />
                        </View>
                        {risco.descricao && <Text style={s.riskDesc}>{risco.descricao}</Text>}
                      </View>
                    );
                  })}
                </View>
              </Section>
            )}

            {/* 7. Pontos de Impugnação */}
            {result.pontosImpugnacao && result.pontosImpugnacao.length > 0 && (
              <Section title="Pontos de Impugnação" icon="⚖️">
                <View style={{ gap: 8, paddingTop: 12 }}>
                  {result.pontosImpugnacao.map((ponto, idx) => {
                    const gravColor = ponto.gravidade === 'alta' ? C.red : ponto.gravidade === 'media' ? C.yellow : C.green;
                    const gravBg    = ponto.gravidade === 'alta' ? C.redBg : ponto.gravidade === 'media' ? C.yellowBg : C.greenBg;
                    const gravLabel = ponto.gravidade === 'alta' ? 'Alta' : ponto.gravidade === 'media' ? 'Média' : 'Baixa';
                    return (
                      <View key={idx} style={s.impRow}>
                        <View style={[rb.base, { backgroundColor: gravBg, paddingHorizontal: 8, paddingVertical: 3 }]}>
                          <Text style={[rb.text, { color: gravColor, fontSize: 11 }]}>{gravLabel}</Text>
                        </View>
                        <Text style={s.impText}>{ponto.descricao ?? '—'}</Text>
                      </View>
                    );
                  })}
                </View>
              </Section>
            )}

            {/* 8. CAPAG */}
            {result.capag && (
              <Section title="CAPAG – Capacidade de Pagamento Municipal" icon="🏙️">
                <View style={s.infoGrid}>
                  <InfoCell label="Município"    value={result.capag.municipio} />
                  <InfoCell label="UF"           value={result.capag.uf} />
                  <InfoCell label="Classificação CAPAG" value={result.capag.capag} />
                  <InfoCell label="População"    value={result.capag.populacao} />
                  <InfoCell label="Receita"      value={fmtCurrency(result.capag.receita)} />
                  <InfoCell label="Despesa"      value={fmtCurrency(result.capag.despesa)} />
                </View>
              </Section>
            )}

            {/* 9. Condições de Pagamento */}
            {result.condicoesPagamento && (
              <Section title="Condições de Pagamento" icon="💳">
                <Text style={[s.bodyText, { paddingTop: 12 }]}>{result.condicoesPagamento}</Text>
              </Section>
            )}
          </View>
        )}

        {/* ── HISTORY SECTION ─────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View>
              <Text style={s.sectionTitle}>Histórico de Análises</Text>
              <Text style={s.sectionSub}>Análises anteriores realizadas para todos os clientes.</Text>
            </View>
            <TouchableOpacity style={s.refreshBtn} onPress={loadHistory} activeOpacity={0.7}>
              <Text style={s.refreshBtnText}>Atualizar</Text>
            </TouchableOpacity>
          </View>

          {/* Table header */}
          <View style={s.histHead}>
            <Text style={[s.histTh, { flex: 1 }]}>Data</Text>
            <Text style={[s.histTh, { flex: 1.5 }]}>Empresa</Text>
            <Text style={[s.histTh, { flex: 2.5 }]}>Edital / Objeto</Text>
            <Text style={[s.histTh, { flex: 1.2 }]}>Recomendação</Text>
            <Text style={[s.histTh, { flex: 1.5 }]}>Ações</Text>
          </View>

          {historyLoading ? (
            <View style={s.tableCenter}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={{ color: C.textSecondary, marginTop: 12 }}>Carregando...</Text>
            </View>
          ) : history.length === 0 ? (
            <View style={s.tableCenter}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📋</Text>
              <Text style={{ color: C.textSecondary }}>Nenhuma análise encontrada.</Text>
            </View>
          ) : history.map(item => (
            <HistoryRow
              key={item.id}
              item={item}
              onView={() => handleViewHistoryItem(item)}
              onDownload={() => handleDownloadPdf(item.id)}
              onResend={() => handleResend(item)}
              isResending={resendingId === item.id}
            />
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Toast */}
      {toastMsg && (
        <Toast
          msg={toastMsg.msg}
          type={toastMsg.type}
          onDismiss={() => setToastMsg(null)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },
  scroll:    { flex: 1 },
  container: { padding: 24, gap: 16 },

  // Header
  header:      { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 18 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: C.white, letterSpacing: -0.3 },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },

  // Card
  card: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 24,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 1px 4px rgba(15,23,42,0.07)' } as object) : { elevation: 2 }),
  },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: C.textPrimary, marginBottom: 4 },
  sectionSub:   { fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  fieldLabel:   { fontSize: 13, fontWeight: '700', color: C.textPrimary, marginBottom: 6 },

  companyRow: { gap: 6 },

  // Analyze button
  analyzeBtn: {
    marginTop: 20,
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 2px 8px rgba(37,99,235,0.25)' } as object) : { elevation: 3 }),
  },
  analyzeBtnDisabled: { backgroundColor: C.textMuted },
  analyzeBtnText:     { fontSize: 15, fontWeight: '800', color: C.white, letterSpacing: 0.3 },

  // Result header
  resultHeader: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 1px 4px rgba(15,23,42,0.07)' } as object) : { elevation: 2 }),
  },
  resultTitle: { fontSize: 18, fontWeight: '800', color: C.textPrimary },
  resultSub:   { fontSize: 13, color: C.textSecondary },
  tenantPill:  { backgroundColor: C.accentLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  tenantPillText: { fontSize: 12, fontWeight: '700', color: C.accent },

  // Action buttons
  actionBtn:      { borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10, minWidth: 120, alignItems: 'center' },
  actionBtnRed:   { backgroundColor: C.red },
  actionBtnGreen: { backgroundColor: C.green },
  actionBtnText:  { fontSize: 13, fontWeight: '700', color: C.white },

  // Info grid
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: C.border, borderRadius: 8, overflow: 'hidden', marginTop: 12 },

  // Table
  tableWrap: { marginTop: 12, borderWidth: 1, borderColor: C.border, borderRadius: 8, overflow: 'hidden' },
  tableHead: { flexDirection: 'row', backgroundColor: C.tableBg, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  tableRow:  { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  th:        { fontSize: 11, fontWeight: '700', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  td:        { fontSize: 12, color: C.textPrimary },

  // Habilitation
  habSection: { borderLeftWidth: 3, borderLeftColor: C.accent, paddingLeft: 12 },
  habTitle:   { fontSize: 13, fontWeight: '800', color: C.accent, marginBottom: 6 },

  // List items
  listItem:   { flexDirection: 'row', gap: 8 },
  listBullet: { fontSize: 16, color: C.accent, lineHeight: 22 },
  listText:   { flex: 1, fontSize: 13, color: C.textPrimary, lineHeight: 22 },

  // Risk cards
  riskCard: { borderLeftWidth: 4, borderRadius: 8, padding: 14 },
  riskTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: C.textPrimary },
  riskDesc:  { fontSize: 13, color: C.textSecondary, lineHeight: 20 },

  // Impugnation
  impRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  impText: { flex: 1, fontSize: 13, color: C.textPrimary, lineHeight: 20 },

  // Body text
  bodyText:  { fontSize: 14, color: C.textPrimary, lineHeight: 22 },
  emptyText: { fontSize: 13, color: C.textSecondary, fontStyle: 'italic' },

  // History table
  histHead:  { flexDirection: 'row', backgroundColor: C.tableBg, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border, borderBottomWidth: 1, borderBottomColor: C.border },
  histTh:    { fontSize: 11, fontWeight: '700', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  tableCenter: { padding: 48, alignItems: 'center' },

  // Refresh
  refreshBtn:     { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  refreshBtnText: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
});
