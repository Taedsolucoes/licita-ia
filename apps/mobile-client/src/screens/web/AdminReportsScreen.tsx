/**
 * AdminReportsScreen — Análise de Editais (upload manual + resultado + empresas compatíveis + histórico)
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
interface TenantCnae {
  id: string;
  code: string;
  description: string;
  isPrimary: boolean;
}

interface Tenant {
  id: string;
  corporateName: string;
  tradeName?: string;
  cnpj?: string;
  cnaes?: TenantCnae[];
  companyKeywords?: Array<{ id: string; keyword: string }>;
}

interface CompatibleTenant {
  tenant: Tenant;
  compatibilityPct: number;
  matchingCnaes: string[];
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

// FullAnalysisResult as returned by the upload endpoint
interface FullAnalysisResult {
  basicInfo?: {
    nome_orgao?: string;
    numero_pregao?: string;
    valor_estimado?: string;
    data_licitacao?: string;
    modalidade?: string;
    uf?: string;
    municipio?: string;
    objeto?: string;
    registro_preco?: boolean;
    tipo_julgamento?: string;
    vigencia_contratacao?: string;
    pagamento?: { prazo?: string; forma?: string };
    items_licitacao?: Array<{
      item_number?: number | string;
      descricao?: string;
      unidade?: string;
      quantidade?: number | string;
      valor_unitario?: string;
      valor_total?: string;
    }>;
  };
  habilitacao?: {
    habilitacao_tecnica?: Array<{ requisito: string; detalhes: string }>;
    habilitacao_juridica?: Array<{ documento: string; detalhes: string }>;
    habilitacao_financeira?: Array<{ requisito: string; detalhes: string }>;
    declaracoes_exigidas?: Array<{ declaracao: string; modelo_anexo?: string | null }>;
  };
  risk?: {
    overall_risk?: 'baixo' | 'medio' | 'alto';
    condicoes_particulares?: Array<{ condicao: string; justificativa: string; nivel_atencao: string }>;
    pontos_impugnacao?: Array<{ ponto: string; fundamento: string; gravidade: 'baixa' | 'media' | 'alta' }>;
  };
  executiveSummary?: {
    executive_summary?: string;
    recommendation?: 'participar' | 'participar_com_cautela' | 'nao_participar';
    justificativa_recomendacao?: string;
  };
  capag?: {
    municipalityName?: string;
    uf?: string;
    capagRating?: string;
    explanation?: string;
    referenceYear?: number;
  } | null;
  analyzedAt?: string;
  // keywords extracted for CNAE matching
  cnaeKeywords?: string[];
}

// Wrapper returned by POST /api/analysis/upload
interface UploadResponse {
  id?: string;
  fileName?: string;
  fileSize?: number;
  contentLength?: number;
  analysis?: FullAnalysisResult & { compatibleCompanies?: CompatibleCompanyResult[] };
  // fallback if server returns flat result
  basicInfo?: FullAnalysisResult['basicInfo'];
  habilitacao?: FullAnalysisResult['habilitacao'];
  risk?: FullAnalysisResult['risk'];
  executiveSummary?: FullAnalysisResult['executiveSummary'];
  capag?: FullAnalysisResult['capag'];
}

// Server-side compatible company
interface CompatibleCompanyResult {
  tenantId: string;
  name: string;
  cnpj: string;
  score: number;
  matchingCnaes: string[];
}

// History item (from GET /api/analysis)
interface AnalysisHistoryItem {
  id: string;
  biddingId?: string;
  objeto?: string;
  orgao?: string;
  numeroEdital?: string;
  recomendacao?: string;
  resumoExecutivo?: string;
  createdAt?: string;
  rawAnalysis?: FullAnalysisResult | null;
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

/** Normalize CNAE code: keep only digits, 0-padded to 7 chars */
function normCnae(code: string): string {
  return code.replace(/\D/g, '').padStart(7, '0');
}

/** Extract CNAE keywords from the analysis result for matching */
function extractEditalCnaes(analysis: FullAnalysisResult): string[] {
  const codes: string[] = [];
  // From items descriptions — extract any 7-digit numbers that look like CNAEs
  const allText = JSON.stringify(analysis);
  const cnaeRegex = /\b\d{4}[-.\s]?\d{1}[-.\s]?\d{2}\b/g;
  const matches = allText.match(cnaeRegex) ?? [];
  matches.forEach((m) => codes.push(normCnae(m)));
  return [...new Set(codes)];
}

/** Compute compatibility between edital analysis and a tenant */
function computeCompatibility(analysis: FullAnalysisResult, tenant: Tenant): { pct: number; matching: string[] } {
  const tenantCodes = (tenant.cnaes ?? []).map((c) => normCnae(c.code));
  const tenantKeywords = (tenant.companyKeywords ?? []).map((k) => k.keyword.toLowerCase());

  if (tenantCodes.length === 0 && tenantKeywords.length === 0) {
    return { pct: 0, matching: [] };
  }

  // Extract CNAEs from analysis
  const editalCodes = extractEditalCnaes(analysis);

  // Match CNAEs
  const matchingCodes = tenantCodes.filter((tc) =>
    editalCodes.some((ec) => ec === tc || tc.startsWith(ec.substring(0, 4)) || ec.startsWith(tc.substring(0, 4))),
  );

  // Match keywords in analysis text
  const analysisText = JSON.stringify(analysis).toLowerCase();
  const matchingKw = tenantKeywords.filter((kw) => analysisText.includes(kw));

  const totalTenantSignals = tenantCodes.length + tenantKeywords.length;
  const totalMatches = matchingCodes.length + matchingKw.length;

  const pct = totalTenantSignals > 0 ? Math.round((totalMatches / totalTenantSignals) * 100) : 0;
  const matchingLabels = [
    ...matchingCodes.map((c) => `CNAE ${c}`),
    ...matchingKw.map((k) => `"${k}"`),
  ];

  return { pct, matching: matchingLabels };
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDismiss }: { msg: string; type: 'success' | 'error'; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
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
    participar:              { label: 'Participar',              color: C.greenText,  bg: C.greenBg },
    participar_com_cautela:  { label: 'Participar com Cautela',  color: C.yellowText, bg: C.yellowBg },
    cautela:                 { label: 'Participar com Cautela',  color: C.yellowText, bg: C.yellowBg },
    nao_participar:          { label: 'Não Participar',          color: C.redDark,    bg: C.redBg },
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

// ─── Compatible Companies Section ─────────────────────────────────────────────
function CompatibleCompaniesSection({
  analysis,
  tenants,
  onSend,
  onDownloadPdf,
  sendingId,
  downloadingId,
  analysisId,
  serverCompatibleCompanies,
}: {
  analysis: FullAnalysisResult;
  tenants: Tenant[];
  onSend: (tenantId: string, tenantName: string) => void;
  onDownloadPdf: () => void;
  sendingId: string | null;
  downloadingId: boolean;
  analysisId?: string;
  serverCompatibleCompanies?: CompatibleCompanyResult[];
}) {
  // Prefer server-computed compatible companies; fall back to client-side computation
  const useServerData = serverCompatibleCompanies && serverCompatibleCompanies.length > 0;

  const compatible: CompatibleTenant[] = useServerData
    ? serverCompatibleCompanies!.map((sc) => ({
        tenant: {
          id: sc.tenantId,
          corporateName: sc.name,
          tradeName: sc.name,
          cnpj: sc.cnpj,
          cnaes: [],
          companyKeywords: [],
        } as Tenant,
        compatibilityPct: sc.score,
        matchingCnaes: sc.matchingCnaes,
      }))
    : tenants
        .map((t) => {
          const { pct, matching } = computeCompatibility(analysis, t);
          return { tenant: t, compatibilityPct: pct, matchingCnaes: matching };
        })
        .filter((c) => c.compatibilityPct > 0 || (c.tenant.cnaes ?? []).length === 0)
        .sort((a, b) => b.compatibilityPct - a.compatibilityPct);

  if (!useServerData && tenants.length === 0) return null;

  return (
    <View style={cc.card}>
      <Text style={cc.title}>Empresas Compatíveis com o Edital</Text>
      <Text style={cc.sub}>Ordenadas por porcentagem de compatibilidade (CNAEs e keywords cadastradas)</Text>

      {compatible.length === 0 ? (
        <View style={cc.emptyWrap}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>🏢</Text>
          <Text style={cc.emptyText}>Nenhuma empresa cadastrada possui CNAEs compatíveis com este edital.</Text>
        </View>
      ) : (
        compatible.map(({ tenant, compatibilityPct, matchingCnaes }) => {
          const pctColor = compatibilityPct >= 60 ? C.green : compatibilityPct >= 30 ? C.yellow : C.textMuted;
          const pctBg    = compatibilityPct >= 60 ? C.greenBg : compatibilityPct >= 30 ? C.yellowBg : C.borderLight;
          const name = tenant.tradeName ?? tenant.corporateName;
          return (
            <View key={tenant.id} style={cc.tenantCard}>
              <View style={cc.tenantHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={cc.tenantName}>{name}</Text>
                  {tenant.cnpj && <Text style={cc.tenantCnpj}>{tenant.cnpj}</Text>}
                </View>
                <View style={[cc.pctBadge, { backgroundColor: pctBg }]}>
                  <Text style={[cc.pctText, { color: pctColor }]}>{compatibilityPct}%</Text>
                </View>
              </View>

              {matchingCnaes.length > 0 && (
                <View style={cc.matchRow}>
                  <Text style={cc.matchLabel}>Correspondências:</Text>
                  <View style={cc.tagsWrap}>
                    {matchingCnaes.slice(0, 6).map((m, i) => (
                      <View key={i} style={cc.tag}>
                        <Text style={cc.tagText}>{m}</Text>
                      </View>
                    ))}
                    {matchingCnaes.length > 6 && (
                      <Text style={cc.tagMore}>+{matchingCnaes.length - 6} mais</Text>
                    )}
                  </View>
                </View>
              )}

              <View style={cc.actions}>
                <TouchableOpacity
                  style={[cc.btn, cc.btnRed]}
                  onPress={() => onSend(tenant.id, name)}
                  disabled={sendingId === tenant.id}
                  activeOpacity={0.85}
                >
                  {sendingId === tenant.id
                    ? <ActivityIndicator size="small" color={C.white} />
                    : <Text style={cc.btnText}>Enviar</Text>}
                </TouchableOpacity>
                {analysisId && (
                  <TouchableOpacity
                    style={[cc.btn, cc.btnBlue]}
                    onPress={onDownloadPdf}
                    disabled={downloadingId}
                    activeOpacity={0.85}
                  >
                    {downloadingId
                      ? <ActivityIndicator size="small" color={C.white} />
                      : <Text style={cc.btnText}>Download PDF</Text>}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}
const cc = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 24,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 1px 4px rgba(15,23,42,0.07)' } as object) : { elevation: 2 }),
  },
  title: { fontSize: 18, fontWeight: '800', color: C.textPrimary, marginBottom: 4 },
  sub:   { fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  emptyWrap: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 14, color: C.textSecondary, textAlign: 'center', maxWidth: 360 },
  tenantCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    backgroundColor: C.tableBg,
  },
  tenantHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  tenantName:  { fontSize: 15, fontWeight: '700', color: C.textPrimary },
  tenantCnpj:  { fontSize: 12, color: C.textMuted, marginTop: 2 },
  pctBadge:    { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, minWidth: 60, alignItems: 'center' },
  pctText:     { fontSize: 16, fontWeight: '800' },
  matchRow:    { marginBottom: 10 },
  matchLabel:  { fontSize: 12, fontWeight: '600', color: C.textSecondary, marginBottom: 6 },
  tagsWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag:         { backgroundColor: C.accentLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagText:     { fontSize: 11, fontWeight: '600', color: C.accent },
  tagMore:     { fontSize: 11, color: C.textMuted, alignSelf: 'center' },
  actions:     { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn:         { borderRadius: 8, paddingHorizontal: 18, paddingVertical: 9, alignItems: 'center', minWidth: 110 },
  btnRed:      { backgroundColor: C.red },
  btnBlue:     { backgroundColor: C.accent },
  btnText:     { fontSize: 13, fontWeight: '700', color: C.white },
});

// ─── History Table Row ────────────────────────────────────────────────────────
function HistoryRow({
  item, onView, onDownload, isDownloading,
}: {
  item: AnalysisHistoryItem;
  onView: () => void;
  onDownload: () => void;
  isDownloading: boolean;
}) {
  return (
    <View style={hr.row}>
      <Text style={[hr.cell, { flex: 1 }]}>{fmtDate(item.createdAt)}</Text>
      <Text style={[hr.cell, { flex: 2.5 }]} numberOfLines={1}>{item.objeto ?? '—'}</Text>
      <Text style={[hr.cell, { flex: 1.5 }]} numberOfLines={1}>{item.orgao ?? '—'}</Text>
      <View style={[hr.cellWrap, { flex: 1.2 }]}>
        <RecBadge rec={item.recomendacao} />
      </View>
      <View style={[hr.actions, { flex: 1.5 }]}>
        <TouchableOpacity style={hr.btn} onPress={onView} activeOpacity={0.7}>
          <Text style={hr.btnText}>Ver</Text>
        </TouchableOpacity>
        <TouchableOpacity style={hr.btn} onPress={onDownload} disabled={isDownloading} activeOpacity={0.7}>
          {isDownloading
            ? <ActivityIndicator size="small" color={C.textPrimary} />
            : <Text style={hr.btnText}>PDF</Text>}
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
  btnText:  { fontSize: 12, fontWeight: '600', color: C.textPrimary },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function AdminReportsScreen() {
  // Tenants (loaded for compatibility matching)
  const [tenants, setTenants] = useState<Tenant[]>([]);

  // Upload
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Current result — full analysis from upload response
  const [currentAnalysis, setCurrentAnalysis] = useState<FullAnalysisResult | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | undefined>(undefined);
  const [serverCompatibleCompanies, setServerCompatibleCompanies] = useState<CompatibleCompanyResult[]>([]);

  // History
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Download
  const [downloadingHistId, setDownloadingHistId] = useState<string | null>(null);
  const [downloadingCurrent, setDownloadingCurrent] = useState(false);

  // Send to tenant
  const [sendingTenantId, setSendingTenantId] = useState<string | null>(null);

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
      // listTenants returns { data: [...], pagination: ... }
      const raw = Array.isArray(res.data)
        ? res.data
        : Array.isArray((res.data as { data?: unknown[] })?.data)
          ? (res.data as { data: unknown[] }).data
          : [];
      setTenants(raw as Tenant[]);
    } catch { /* ignore */ }
  }

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await analysisApi.list();
      const raw = Array.isArray(res.data)
        ? res.data
        : Array.isArray((res.data as { data?: unknown[] })?.data)
          ? (res.data as { data: unknown[] }).data
          : [];
      setHistory(raw as AnalysisHistoryItem[]);
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
    setUploading(true);
    setCurrentAnalysis(null);
    setCurrentAnalysisId(undefined);
    setServerCompatibleCompanies([]);
    try {
      const res = await analysisApi.upload(file as unknown as File);
      const responseData = res.data as UploadResponse;
      // Backend returns { id, fileName, fileSize, contentLength, analysis: FullAnalysisResult }
      const analysisData: FullAnalysisResult = responseData.analysis ?? (responseData as unknown as FullAnalysisResult);
      setCurrentAnalysis(analysisData);
      // Set the analysis id from server so PDF download and send-to-tenant work
      if (responseData.id) {
        setCurrentAnalysisId(responseData.id);
      }
      // Store server-computed compatible companies
      if (responseData.analysis?.compatibleCompanies) {
        setServerCompatibleCompanies(responseData.analysis.compatibleCompanies);
      } else {
        setServerCompatibleCompanies([]);
      }
      showToast('Análise concluída com sucesso!');
      loadHistory();
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { message?: string; error?: string } } };
      const msg = axErr?.response?.data?.message
        ?? axErr?.response?.data?.error
        ?? 'Erro ao analisar edital. Verifique a conexão e tente novamente.';
      showToast(msg, 'error');
    } finally {
      setUploading(false);
    }
  }

  // ─── Download PDF ──────────────────────────────────────────────────────────
  async function handleDownloadPdf(id?: string, setCurrent = false) {
    if (Platform.OS !== 'web' || !id) return;
    if (setCurrent) setDownloadingCurrent(true);
    else setDownloadingHistId(id);
    try {
      const res = await analysisApi.getPdf(id);
      const blob = new Blob([res.data as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analise-${id.substring(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Erro ao baixar o PDF.', 'error');
    } finally {
      if (setCurrent) setDownloadingCurrent(false);
      else setDownloadingHistId(null);
    }
  }

  // ─── Send to tenant ────────────────────────────────────────────────────────
  async function handleSendToTenant(tenantId: string, tenantName: string) {
    if (!currentAnalysisId) {
      showToast('Análise ainda não salva no servidor. Aguarde um momento.', 'error');
      return;
    }
    setSendingTenantId(tenantId);
    try {
      await analysisApi.sendToTenant(currentAnalysisId, tenantId);
      showToast(`Análise enviada para ${tenantName} com sucesso!`);
    } catch {
      showToast('Erro ao enviar para o cliente.', 'error');
    } finally {
      setSendingTenantId(null);
    }
  }

  // ─── View history item ─────────────────────────────────────────────────────
  async function handleViewHistoryItem(item: AnalysisHistoryItem) {
    const rawFull = item.rawAnalysis as FullAnalysisResult | null | undefined;
    if (rawFull && (rawFull.executiveSummary || rawFull.basicInfo)) {
      setCurrentAnalysis(rawFull);
      setCurrentAnalysisId(item.id);
    } else {
      try {
        const res = await analysisApi.get(item.id);
        const full = res.data as { rawAnalysis?: FullAnalysisResult };
        const fa = full.rawAnalysis ?? (full as unknown as FullAnalysisResult);
        setCurrentAnalysis(fa);
        setCurrentAnalysisId(item.id);
      } catch {
        showToast('Erro ao carregar análise.', 'error');
      }
    }
    if (Platform.OS === 'web') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // ─── Derive display data from FullAnalysisResult ────────────────────────────
  const rec = currentAnalysis?.executiveSummary?.recommendation;
  const recDisplay = rec === 'participar_com_cautela' ? 'cautela' : rec;
  const objeto = currentAnalysis?.basicInfo?.objeto;
  const orgao  = currentAnalysis?.basicInfo?.nome_orgao;

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
          <Text style={s.sectionSub}>Faça upload do edital em PDF ou DOCX para análise automática pelo Gemini.</Text>

          {/* Upload area */}
          <View style={{ marginTop: 8 }}>
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
            style={[s.analyzeBtn, (!file || uploading) && s.analyzeBtnDisabled]}
            onPress={handleAnalyze}
            disabled={!file || uploading}
            activeOpacity={0.85}
          >
            {uploading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator size="small" color={C.white} />
                <Text style={s.analyzeBtnText}>Analisando edital... isso pode levar até 3 minutos</Text>
              </View>
            ) : (
              <Text style={s.analyzeBtnText}>Analisar Edital</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── RESULT SECTION ──────────────────────────────────────────────── */}
        {currentAnalysis && (
          <View style={{ gap: 12 }}>
            {/* Result header */}
            <View style={s.resultHeader}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.resultTitle}>{objeto ?? 'Resultado da Análise'}</Text>
                <Text style={s.resultSub}>{orgao ?? ''}</Text>
              </View>
              {currentAnalysisId && (
                <TouchableOpacity
                  style={[s.actionBtn, s.actionBtnBlue]}
                  onPress={() => handleDownloadPdf(currentAnalysisId, true)}
                  disabled={downloadingCurrent}
                  activeOpacity={0.85}
                >
                  {downloadingCurrent
                    ? <ActivityIndicator size="small" color={C.white} />
                    : <Text style={s.actionBtnText}>Gerar PDF</Text>}
                </TouchableOpacity>
              )}
            </View>

            {/* 1. Resumo Executivo */}
            <Section title="Resumo Executivo" icon="📋" defaultOpen>
              <View style={{ gap: 12, paddingTop: 12 }}>
                <RecBadge rec={recDisplay} />
                {currentAnalysis.executiveSummary?.executive_summary ? (
                  <Text style={s.bodyText}>{currentAnalysis.executiveSummary.executive_summary}</Text>
                ) : (
                  <Text style={s.emptyText}>Resumo não disponível.</Text>
                )}
                {currentAnalysis.executiveSummary?.justificativa_recomendacao && (
                  <View style={s.habSection}>
                    <Text style={s.habTitle}>Justificativa</Text>
                    <Text style={s.bodyText}>{currentAnalysis.executiveSummary.justificativa_recomendacao}</Text>
                  </View>
                )}
              </View>
            </Section>

            {/* 2. Informações Básicas */}
            {currentAnalysis.basicInfo && (
              <Section title="Informações Básicas" icon="🏛">
                <View style={s.infoGrid}>
                  <InfoCell label="Órgão"              value={currentAnalysis.basicInfo.nome_orgao} />
                  <InfoCell label="Nº Pregão"          value={currentAnalysis.basicInfo.numero_pregao} />
                  <InfoCell label="Valor Estimado"     value={currentAnalysis.basicInfo.valor_estimado} />
                  <InfoCell label="Data de Abertura"   value={currentAnalysis.basicInfo.data_licitacao} />
                  <InfoCell label="Modalidade"         value={currentAnalysis.basicInfo.modalidade} />
                  <InfoCell label="UF"                 value={currentAnalysis.basicInfo.uf} />
                  <InfoCell label="Município"          value={currentAnalysis.basicInfo.municipio} />
                  <InfoCell label="Prazo de Entrega"   value={currentAnalysis.basicInfo.vigencia_contratacao} />
                  <InfoCell label="Objeto"             value={currentAnalysis.basicInfo.objeto} />
                </View>
              </Section>
            )}

            {/* 3. Itens da Licitação */}
            {currentAnalysis.basicInfo?.items_licitacao && currentAnalysis.basicInfo.items_licitacao.length > 0 && (
              <Section title="Itens da Licitação" icon="📦">
                <View style={s.tableWrap}>
                  <View style={s.tableHead}>
                    <Text style={[s.th, { flex: 0.5, textAlign: 'center' }]}>Nº</Text>
                    <Text style={[s.th, { flex: 3 }]}>Descrição</Text>
                    <Text style={[s.th, { flex: 1 }]}>Unid.</Text>
                    <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Qtd.</Text>
                    <Text style={[s.th, { flex: 1.5, textAlign: 'right' }]}>Valor Unit.</Text>
                    <Text style={[s.th, { flex: 1.5, textAlign: 'right' }]}>Valor Total</Text>
                  </View>
                  {currentAnalysis.basicInfo.items_licitacao.map((item, idx) => (
                    <View key={idx} style={[s.tableRow, idx % 2 === 1 && { backgroundColor: C.tableBg }]}>
                      <Text style={[s.td, { flex: 0.5, textAlign: 'center', color: C.textMuted }]}>{String(idx + 1).padStart(2, '0')}</Text>
                      <Text style={[s.td, { flex: 3 }]} numberOfLines={2}>{item.descricao ?? '—'}</Text>
                      <Text style={[s.td, { flex: 1 }]}>{item.unidade ?? '—'}</Text>
                      <Text style={[s.td, { flex: 1, textAlign: 'right' }]}>{item.quantidade != null ? String(item.quantidade) : '—'}</Text>
                      <Text style={[s.td, { flex: 1.5, textAlign: 'right' }]}>{fmtCurrency(item.valor_unitario)}</Text>
                      <Text style={[s.td, { flex: 1.5, textAlign: 'right', fontWeight: '700' }]}>{fmtCurrency(item.valor_total)}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {/* 4. Habilitação */}
            {currentAnalysis.habilitacao && (
              <Section title="Habilitação" icon="📑">
                <View style={{ gap: 16, paddingTop: 12 }}>
                  {(currentAnalysis.habilitacao.habilitacao_tecnica ?? []).length > 0 && (
                    <View style={s.habSection}>
                      <Text style={s.habTitle}>Qualificação Técnica</Text>
                      {currentAnalysis.habilitacao.habilitacao_tecnica!.map((h, i) => (
                        <Text key={i} style={s.bodyText}>• {h.requisito}: {h.detalhes}</Text>
                      ))}
                    </View>
                  )}
                  {(currentAnalysis.habilitacao.habilitacao_juridica ?? []).length > 0 && (
                    <View style={s.habSection}>
                      <Text style={s.habTitle}>Habilitação Jurídica</Text>
                      {currentAnalysis.habilitacao.habilitacao_juridica!.map((h, i) => (
                        <Text key={i} style={s.bodyText}>• {h.documento}: {h.detalhes}</Text>
                      ))}
                    </View>
                  )}
                  {(currentAnalysis.habilitacao.habilitacao_financeira ?? []).length > 0 && (
                    <View style={s.habSection}>
                      <Text style={s.habTitle}>Qualificação Financeira</Text>
                      {currentAnalysis.habilitacao.habilitacao_financeira!.map((h, i) => (
                        <Text key={i} style={s.bodyText}>• {h.requisito}: {h.detalhes}</Text>
                      ))}
                    </View>
                  )}
                  {(currentAnalysis.habilitacao.declaracoes_exigidas ?? []).length > 0 && (
                    <View style={s.habSection}>
                      <Text style={s.habTitle}>Declarações Exigidas</Text>
                      {currentAnalysis.habilitacao.declaracoes_exigidas!.map((d, i) => (
                        <Text key={i} style={s.bodyText}>• {d.declaracao}{d.modelo_anexo ? ` (${d.modelo_anexo})` : ''}</Text>
                      ))}
                    </View>
                  )}
                </View>
              </Section>
            )}

            {/* 5. Análise de Riscos */}
            {currentAnalysis.risk && (
              <Section title="Análise de Riscos" icon="⚠️">
                <View style={{ gap: 10, paddingTop: 12 }}>
                  {currentAnalysis.risk.overall_risk && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Text style={s.habTitle}>Risco Geral:</Text>
                      <RiskBadge nivel={currentAnalysis.risk.overall_risk} />
                    </View>
                  )}
                  {(currentAnalysis.risk.condicoes_particulares ?? []).map((rc, idx) => {
                    const levelColor = rc.nivel_atencao === 'alto' ? C.redBg : rc.nivel_atencao === 'medio' ? C.yellowBg : C.greenBg;
                    const levelBorder = rc.nivel_atencao === 'alto' ? C.red : rc.nivel_atencao === 'medio' ? C.yellow : C.green;
                    return (
                      <View key={idx} style={[s.riskCard, { backgroundColor: levelColor, borderLeftColor: levelBorder }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <Text style={s.riskTitle}>{rc.condicao}</Text>
                          <RiskBadge nivel={rc.nivel_atencao} />
                        </View>
                        <Text style={s.riskDesc}>{rc.justificativa}</Text>
                      </View>
                    );
                  })}
                  {(currentAnalysis.risk.pontos_impugnacao ?? []).length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={s.habTitle}>Pontos de Impugnação</Text>
                      {currentAnalysis.risk.pontos_impugnacao!.map((p, idx) => {
                        const gravColor = p.gravidade === 'alta' ? C.red : p.gravidade === 'media' ? C.yellow : C.green;
                        const gravBg    = p.gravidade === 'alta' ? C.redBg : p.gravidade === 'media' ? C.yellowBg : C.greenBg;
                        const gravLabel = p.gravidade === 'alta' ? 'Alta' : p.gravidade === 'media' ? 'Média' : 'Baixa';
                        return (
                          <View key={idx} style={s.impRow}>
                            <View style={[rb.base, { backgroundColor: gravBg, paddingHorizontal: 8, paddingVertical: 3 }]}>
                              <Text style={[rb.text, { color: gravColor, fontSize: 11 }]}>{gravLabel}</Text>
                            </View>
                            <Text style={s.impText}>{p.ponto} — {p.fundamento}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </Section>
            )}

            {/* 6. CAPAG */}
            {currentAnalysis.capag && (
              <Section title="CAPAG – Capacidade de Pagamento Municipal" icon="🏙️">
                <View style={s.infoGrid}>
                  <InfoCell label="Município"         value={currentAnalysis.capag.municipalityName} />
                  <InfoCell label="UF"                value={currentAnalysis.capag.uf} />
                  <InfoCell label="Classificação CAPAG" value={currentAnalysis.capag.capagRating} />
                  <InfoCell label="Ano de Referência" value={currentAnalysis.capag.referenceYear} />
                  <InfoCell label="Explicação"        value={currentAnalysis.capag.explanation} />
                </View>
              </Section>
            )}

            {/* 7. Empresas Compatíveis */}
            <CompatibleCompaniesSection
              analysis={currentAnalysis}
              tenants={tenants}
              onSend={handleSendToTenant}
              onDownloadPdf={() => handleDownloadPdf(currentAnalysisId, true)}
              sendingId={sendingTenantId}
              downloadingId={downloadingCurrent}
              analysisId={currentAnalysisId}
              serverCompatibleCompanies={serverCompatibleCompanies}
            />
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
            <Text style={[s.histTh, { flex: 2.5 }]}>Edital / Objeto</Text>
            <Text style={[s.histTh, { flex: 1.5 }]}>Órgão</Text>
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
              isDownloading={downloadingHistId === item.id}
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

  // Action buttons
  actionBtn:      { borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10, minWidth: 120, alignItems: 'center' },
  actionBtnBlue:  { backgroundColor: C.accent },
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
