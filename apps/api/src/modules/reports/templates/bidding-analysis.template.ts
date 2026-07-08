// ─── Shared sub-types (exported so service/impugnation can reuse) ─────────────
export interface DocumentAlertData {
  item: string;
  document: string;
  reason: string;
}

export interface ImpugnationPointData {
  title: string;
  description: string;
  legalBasis: string;
  articleNumber: string;
  explanation: string;
}

export interface PaymentConditionsData {
  deadline: string;
  method: string;
  details: string;
}

export interface AdditionalDocumentData {
  name: string;
  description: string;
  legalBasis: string;
  /** 'possui' | 'parcial' | 'nao_possui' | 'nao_exigido' */
  status: string;
}

export interface ItemAnalysisData {
  itemNumber: number;
  specificDocument: string | null;
  /** 'ok' | 'warning' | 'missing' | 'not_required' */
  alertType: string;
  observation: string | null;
}

// ─── Main report data ─────────────────────────────────────────────────────────
export interface BiddingReportData {
  // Bidding fields
  biddingId: string;
  biddingNumber: string | null;
  modality: string | null;
  uasg: string | null;
  sphere: string | null;
  agencyName: string | null;
  objectText: string;
  objectSummary: string | null;
  proposalDueDate: Date | null;
  openingDate: Date | null;
  estimatedValue: string | null; // pre-formatted Decimal as string
  municipalityName: string | null;
  uf: string | null;
  riskLevel: string | null;
  judgmentCriteria: string | null;
  items: BiddingItemReportData[];

  // Analysis fields (optional – graceful fallback when analysis not yet run)
  executiveSummary: string | null;
  documentAlerts: DocumentAlertData[];
  impugnationPoints: ImpugnationPointData[];
  paymentConditions: PaymentConditionsData | null;
  guaranteeContractual: string | null;
  guaranteeObject: string | null;
  analysisRecommendation: string | null; // 'participate' | 'caution' | 'avoid'
  deliveryLocation: string | null;
  deliveryDeadline: string | null;
  deliveryLocations: string[];
  additionalDocuments: AdditionalDocumentData[];
  objectCategory: string | null;
  objectCategoryType: string | null;
  itemAnalysis: ItemAnalysisData[];

  // Tenant / generation metadata
  tenantName: string;
  tenantCnpj: string | null;
  generatedAt: Date;
}

export interface BiddingItemReportData {
  itemNumber: number;
  description: string;
  quantity: string; // Decimal as string
  unit: string;
  unitValueEstimated: string | null;
  totalValueEstimated: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBRL(valueStr: string | null | number): string {
  if (valueStr === null || valueStr === undefined) return 'Não informado';
  const num = typeof valueStr === 'number' ? valueStr : parseFloat(valueStr);
  if (isNaN(num)) return 'Não informado';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(date: Date | null): string {
  if (!date) return 'Não consta';
  // Bidding dates are stored as UTC-midnight (date-only); rendering them in a
  // local timezone (e.g. UTC-3) would shift the day back by one.
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getRiskConfig(riskLevel: string | null): {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: string;
} {
  switch (riskLevel?.toLowerCase()) {
    case 'low':
    case 'baixo':
      return { label: 'BAIXO', color: '#15803d', bg: '#dcfce7', border: '#22C55E', icon: '✓' };
    case 'medium':
    case 'medio':
      return { label: 'MÉDIO', color: '#92400e', bg: '#fef3c7', border: '#F59E0B', icon: '!' };
    case 'high':
    case 'alto':
      return { label: 'ALTO', color: '#991b1b', bg: '#fee2e2', border: '#EF4444', icon: '✕' };
    default:
      return { label: 'NÃO AVALIADO', color: '#374151', bg: '#f3f4f6', border: '#9CA3AF', icon: '?' };
  }
}

function getSphereIcon(sphere: string | null): string {
  const s = sphere?.toLowerCase() ?? '';
  if (s.includes('federal') || s.includes('militar') || s.includes('military')) {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#1B3A6B"/><path d="M12 6L14 10H18L15 13L16 17L12 15L8 17L9 13L6 10H10L12 6Z" fill="#fff"/></svg>`;
  }
  if (s.includes('estadual') || s.includes('state')) {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#1B3A6B"/><rect x="7" y="7" width="10" height="10" rx="1" fill="#fff"/></svg>`;
  }
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#1B3A6B"/><path d="M12 7C9.24 7 7 9.24 7 12C7 14.76 9.24 17 12 17C14.76 17 17 14.76 17 12C17 9.24 14.76 7 12 7Z" fill="#fff"/></svg>`;
}

function getDocStatusHtml(status: string): string {
  switch (status?.toLowerCase()) {
    case 'possui':
      return `<span style="display:inline-flex;align-items:center;gap:4px;color:#15803d;font-weight:600;font-size:9pt;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#22C55E"/><path d="M7 12L10.5 15.5L17 9" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg> Possui</span>`;
    case 'parcial':
      return `<span style="display:inline-flex;align-items:center;gap:4px;color:#92400e;font-weight:600;font-size:9pt;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3L22 21H2L12 3Z" fill="#F59E0B"/><path d="M12 9V14M12 17V17.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg> Parcial</span>`;
    case 'nao_possui':
    case 'não possui':
      return `<span style="display:inline-flex;align-items:center;gap:4px;color:#991b1b;font-weight:600;font-size:9pt;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#EF4444"/><path d="M8 8L16 16M16 8L8 16" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg> Não possui</span>`;
    case 'nao_exigido':
    case 'não exigido':
      return `<span style="display:inline-flex;align-items:center;gap:4px;color:#6B7280;font-weight:600;font-size:9pt;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#9CA3AF"/><path d="M12 7V13M12 16V17" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg> Não exigido</span>`;
    default:
      return `<span style="color:#6B7280;font-size:9pt;">${escapeHtml(status ?? '—')}</span>`;
  }
}

function getItemAlertHtml(alertType: string, observation: string | null, specificDoc: string | null): { docCell: string; obsCell: string } {
  const doc = specificDoc ? `<span style="color:#1B3A6B;font-weight:600;font-size:8.5pt;">${escapeHtml(specificDoc)}<br><span style="color:#92400e;font-size:7.5pt;">(quando aplicável)</span></span>` : `<span style="color:#6B7280;font-size:9pt;">—</span>`;

  switch (alertType?.toLowerCase()) {
    case 'ok':
    case 'not_required':
      return {
        docCell: doc,
        obsCell: `<span style="display:inline-flex;align-items:center;gap:4px;color:#15803d;font-size:8.5pt;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#22C55E"/><path d="M7 12L10.5 15.5L17 9" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg> ${escapeHtml(observation ?? 'Não requer documento específico.')}</span>`,
      };
    case 'warning':
      return {
        docCell: doc,
        obsCell: `<span style="display:inline-flex;align-items:center;gap:4px;color:#92400e;font-size:8.5pt;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 3L22 21H2L12 3Z" fill="#F59E0B"/><path d="M12 9V14M12 17V17.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg> ${escapeHtml(observation ?? 'Exige documento complementar.')}</span>`,
      };
    case 'missing':
      return {
        docCell: doc,
        obsCell: `<span style="display:inline-flex;align-items:center;gap:4px;color:#991b1b;font-size:8.5pt;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#EF4444"/><path d="M8 8L16 16M16 8L8 16" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg> ${escapeHtml(observation ?? 'Documento obrigatório não atendido.')}</span>`,
      };
    default:
      return {
        docCell: doc,
        obsCell: `<span style="color:#6B7280;font-size:8.5pt;">${escapeHtml(observation ?? '—')}</span>`,
      };
  }
}

// ─── Main renderer ────────────────────────────────────────────────────────────
export function renderBiddingAnalysisTemplate(data: BiddingReportData): string {
  const risk = getRiskConfig(data.riskLevel);
  const datetimeStr = formatDateTime(data.generatedAt);

  // ── Section 4: Additional documents table ──
  const additionalDocs = data.additionalDocuments.length > 0
    ? data.additionalDocuments
    : data.documentAlerts.map((a) => ({
        name: a.document,
        description: a.reason,
        legalBasis: a.item,
        status: 'nao_possui',
      } as AdditionalDocumentData));

  const missingCount = additionalDocs.filter((d) => d.status === 'nao_possui' || d.status === 'não possui').length;
  const requiredCount = additionalDocs.filter((d) => d.status !== 'nao_exigido' && d.status !== 'não exigido').length;

  const additionalDocsRows = additionalDocs.map((doc, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#fff' : '#f9fafb'};">
      <td style="padding:9px 10px;font-size:9pt;font-weight:600;color:#1B3A6B;border-bottom:1px solid #e5e7eb;">${escapeHtml(doc.name)}</td>
      <td style="padding:9px 10px;font-size:9pt;color:#374151;border-bottom:1px solid #e5e7eb;">${escapeHtml(doc.description)}</td>
      <td style="padding:9px 10px;font-size:9pt;color:#374151;border-bottom:1px solid #e5e7eb;">${escapeHtml(doc.legalBasis)}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #e5e7eb;">${getDocStatusHtml(doc.status)}</td>
    </tr>`).join('');

  // ── Section 5: Items table ──
  const itemAnalysisMap = new Map<number, ItemAnalysisData>();
  data.itemAnalysis.forEach((ia) => itemAnalysisMap.set(ia.itemNumber, ia));

  const itemsRows = data.items.map((item, idx) => {
    const ia = itemAnalysisMap.get(item.itemNumber);
    const { docCell, obsCell } = getItemAlertHtml(ia?.alertType ?? 'ok', ia?.observation ?? null, ia?.specificDocument ?? null);
    return `
    <tr style="background:${idx % 2 === 0 ? '#fff' : '#f9fafb'};">
      <td style="padding:8px 8px;text-align:center;font-size:9pt;font-weight:600;color:#1B3A6B;border-bottom:1px solid #e5e7eb;">${item.itemNumber}</td>
      <td style="padding:8px 8px;font-size:8.5pt;color:#374151;border-bottom:1px solid #e5e7eb;"><strong style="display:block;color:#111827;font-size:9pt;">${escapeHtml(item.description.length > 80 ? item.description.substring(0, 80) + '...' : item.description)}</strong><span style="color:#6B7280;font-size:8pt;">${escapeHtml(item.description.length > 80 ? item.description.substring(80) : '')}</span></td>
      <td style="padding:8px 8px;text-align:center;font-size:9pt;border-bottom:1px solid #e5e7eb;">${parseFloat(item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
      <td style="padding:8px 8px;text-align:center;font-size:9pt;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.unit)}</td>
      <td style="padding:8px 8px;text-align:right;font-size:9pt;white-space:nowrap;border-bottom:1px solid #e5e7eb;">${formatBRL(item.totalValueEstimated)}</td>
      <td style="padding:8px 8px;font-size:9pt;border-bottom:1px solid #e5e7eb;">${docCell}</td>
      <td style="padding:8px 8px;font-size:9pt;border-bottom:1px solid #e5e7eb;">${obsCell}</td>
    </tr>`;
  }).join('');

  // ── Delivery locations list ──
  const deliveryLocs: string[] = data.deliveryLocations.length > 0
    ? data.deliveryLocations
    : data.deliveryLocation
      ? [data.deliveryLocation]
      : [];

  const deliveryListHtml = deliveryLocs.length > 0
    ? deliveryLocs.map((loc) => `<li style="margin-bottom:4px;font-size:9pt;color:#374151;">${escapeHtml(loc)}</li>`).join('')
    : `<li style="color:#6B7280;font-size:9pt;">Não informado</li>`;

  // ── Object category ──
  const categoryName = data.objectCategory ?? 'Não categorizado';
  const categoryType = data.objectCategoryType ?? '';

  // ── Judgment criteria ──
  const judgmentCriteria = data.judgmentCriteria ?? 'Menor Preço';

  // ── Sphere display ──
  const sphereLabel = data.sphere
    ? data.sphere.charAt(0).toUpperCase() + data.sphere.slice(1).toLowerCase()
    : 'Não informado';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Relatório de Análise de Edital</title>
  <style>
    /* No external resources (fonts/CDN): the PDF is rendered offline by Puppeteer
       with waitUntil networkidle0 — any remote request could stall or fail rendering. */

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      font-size: 10pt;
      color: #111827;
      background: #fff;
    }

    /* ── PAGE LAYOUT ── */
    .page-wrap {
      padding: 0;
    }

    /* ── HEADER ── */
    .report-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 28px 40px 16px 40px;
      border-bottom: 1px solid #e5e7eb;
    }

    .logo-block {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .logo-circle {
      width: 42px;
      height: 42px;
      background: #1B3A6B;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .logo-name {
      font-size: 20pt;
      font-weight: 800;
      color: #1B3A6B;
      letter-spacing: -0.5px;
      line-height: 1;
    }

    .logo-name span {
      color: #3B82F6;
    }

    .header-center {
      text-align: center;
      flex: 1;
      padding: 0 20px;
    }

    .header-title {
      font-size: 16pt;
      font-weight: 800;
      color: #111827;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      line-height: 1.2;
    }

    .header-subtitle {
      font-size: 9.5pt;
      color: #6B7280;
      margin-top: 4px;
    }

    .confidential-badge {
      background: #1B3A6B;
      color: #fff;
      border-radius: 6px;
      padding: 8px 14px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.5px;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .date-row {
      text-align: right;
      padding: 4px 40px 0 40px;
      font-size: 8pt;
      color: #6B7280;
    }

    .date-row strong {
      color: #111827;
      font-size: 9pt;
    }

    /* ── INFO BAND ── */
    .info-band {
      background: #1B3A6B;
      padding: 18px 40px;
      display: flex;
      gap: 0;
      margin-top: 16px;
    }

    .info-band-col {
      flex: 1;
      padding-right: 24px;
      border-right: 1px solid rgba(255,255,255,0.15);
      padding-left: 16px;
    }

    .info-band-col:first-child {
      padding-left: 0;
    }

    .info-band-col:last-child {
      border-right: none;
    }

    .info-band-label {
      font-size: 7.5pt;
      color: rgba(255,255,255,0.55);
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
      margin-bottom: 5px;
    }

    .info-band-value {
      font-size: 10pt;
      color: #fff;
      font-weight: 700;
      line-height: 1.35;
    }

    .info-band-sub {
      font-size: 8.5pt;
      color: rgba(255,255,255,0.7);
      margin-top: 2px;
    }

    .sphere-icon-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }

    /* ── SECTIONS ── */
    .sections-wrap {
      padding: 28px 40px;
    }

    .section {
      margin-bottom: 32px;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }

    .section-title-text {
      font-size: 11pt;
      font-weight: 700;
      color: #111827;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .section-title-line {
      flex: 1;
      height: 2px;
      background: #1B3A6B;
      border-radius: 1px;
    }

    /* ── SECTION 1: Executive Summary Cards ── */
    .exec-cards {
      display: flex;
      gap: 10px;
    }

    .exec-card {
      flex: 1;
      background: #EEF3FB;
      border-radius: 8px;
      padding: 14px 12px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }

    .exec-card-icon {
      width: 36px;
      height: 36px;
      background: #1B3A6B;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .exec-card-content {
      flex: 1;
      min-width: 0;
    }

    .exec-card-label {
      font-size: 7.5pt;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .exec-card-value {
      font-size: 9.5pt;
      font-weight: 700;
      color: #111827;
      line-height: 1.3;
    }

    /* ── SECTION 2: Object ── */
    .object-grid {
      display: flex;
      gap: 20px;
    }

    .object-left {
      flex: 1;
    }

    .object-right {
      width: 46%;
      flex-shrink: 0;
    }

    .obj-label {
      font-size: 8pt;
      font-weight: 700;
      color: #1B3A6B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
      margin-top: 14px;
    }

    .obj-label:first-child {
      margin-top: 0;
    }

    .obj-text {
      font-size: 9pt;
      color: #374151;
      line-height: 1.6;
    }

    .category-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 10px;
      padding: 10px 12px;
      background: #f9fafb;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }

    .category-icon {
      width: 32px;
      height: 32px;
      background: #EEF3FB;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .analysis-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 14px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .analysis-card-title {
      font-size: 8.5pt;
      font-weight: 700;
      color: #1B3A6B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .analysis-card-text {
      font-size: 9pt;
      color: #374151;
      line-height: 1.6;
    }

    .risk-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }

    .risk-card-header {
      background: #f9fafb;
      padding: 10px 14px;
      font-size: 8.5pt;
      font-weight: 700;
      color: #1B3A6B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #e5e7eb;
    }

    .risk-card-body {
      padding: 14px;
      display: flex;
      align-items: flex-start;
      gap: 14px;
      /* Wide labels (e.g. "NÃO AVALIADO") must push the description below
         instead of squeezing/clipping it. */
      flex-wrap: wrap;
    }

    .risk-badge-big {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 14pt;
      font-weight: 800;
      letter-spacing: 1px;
      flex-shrink: 0;
    }

    .risk-badge-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14pt;
      font-weight: 800;
      border: 2px solid currentColor;
    }

    /* ── SECTION 3: Operational Conditions ── */
    .ops-grid {
      display: flex;
      gap: 16px;
    }

    .ops-col {
      flex: 1;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }

    .ops-col-header {
      background: #f9fafb;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid #e5e7eb;
    }

    .ops-col-title {
      font-size: 8.5pt;
      font-weight: 700;
      color: #1B3A6B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .ops-col-body {
      padding: 12px 14px;
    }

    .ops-delivery-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .ops-delivery-list li {
      padding: 3px 0 3px 12px;
      position: relative;
      font-size: 9pt;
      color: #374151;
      line-height: 1.5;
    }

    .ops-delivery-list li::before {
      content: '';
      position: absolute;
      left: 0;
      top: 10px;
      width: 5px;
      height: 5px;
      background: #1B3A6B;
      border-radius: 50%;
    }

    .ops-text {
      font-size: 9pt;
      color: #374151;
      line-height: 1.6;
    }

    /* ── SECTION 4: Additional Documents Table ── */
    .docs-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }

    .docs-table thead tr {
      background: #1B3A6B;
    }

    .docs-table thead th {
      padding: 10px 10px;
      text-align: left;
      color: #fff;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .docs-table tbody tr:nth-child(even) { background: #f9fafb; }
    .docs-table tbody tr:nth-child(odd) { background: #fff; }

    .docs-alert-bar {
      margin-top: 8px;
      background: #fef9c3;
      border: 1px solid #fde047;
      border-radius: 6px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .docs-alert-bar-text {
      font-size: 9pt;
      color: #713f12;
      font-weight: 600;
    }

    .docs-alert-bar-sub {
      font-size: 9pt;
      color: #F59E0B;
      font-weight: 600;
      margin-left: auto;
    }

    /* ── SECTION 5: Items Table ── */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }

    .items-table thead tr {
      background: #1B3A6B;
    }

    .items-table thead th {
      padding: 10px 8px;
      text-align: left;
      color: #fff;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .items-table thead th.th-center { text-align: center; }
    .items-table thead th.th-right { text-align: right; }

    .items-table tbody td {
      vertical-align: top;
      color: #374151;
    }

    .items-legend {
      margin-top: 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 8pt;
      color: #374151;
    }

    .items-note {
      margin-top: 8px;
      font-size: 8pt;
      color: #6B7280;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* ── FOOTER (rendered by Puppeteer footerTemplate — see reports.service.ts) ── */
    @page {
      margin: 20mm 10mm 24mm 10mm;
    }

    /* ── PRINT ── */
    @media print {
      .info-band, .exec-card, .ops-col-header, .docs-table thead tr,
      .items-table thead tr, .report-header, .confidential-badge {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>

  <!-- Page footer is rendered by Puppeteer's footerTemplate (reports.service.ts).
       An in-body fixed footer would duplicate it and .pageNumber/.totalPages
       are only populated inside Puppeteer's header/footer templates. -->

  <div class="page-wrap">

    <!-- ════ HEADER ════ -->
    <div class="report-header">
      <!-- Logo -->
      <div class="logo-block">
        <div class="logo-circle">
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 24L12 10L16 18L20 13L24 24H8Z" fill="#3B82F6"/>
            <circle cx="16" cy="8" r="3" fill="#60A5FA"/>
          </svg>
        </div>
        <div class="logo-name">Licita<span>IA</span></div>
      </div>

      <!-- Title -->
      <div class="header-center">
        <div class="header-title">Relatório de Análise de Edital</div>
        <div class="header-subtitle">Relatório Técnico Inteligente de Licitação</div>
      </div>

      <!-- Confidential badge -->
      <div>
        <div class="confidential-badge">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" fill="rgba(255,255,255,0.25)"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="1.5" fill="#fff"/></svg>
          CONFIDENCIAL
        </div>
        <div class="date-row">Relatório gerado em:<br><strong>${escapeHtml(datetimeStr)}</strong></div>
      </div>
    </div>

    <!-- ════ INFO BAND ════ -->
    <div class="info-band">
      <div class="info-band-col">
        <div class="info-band-label">Empresa Analisada</div>
        <div class="info-band-value">${escapeHtml(data.tenantName)}</div>
        ${data.tenantCnpj ? `<div class="info-band-sub">${escapeHtml(data.tenantCnpj)}</div>` : ''}
      </div>
      <div class="info-band-col">
        <div class="info-band-label">Número do Pregão</div>
        <div class="info-band-value">${escapeHtml(data.biddingNumber ?? 'Não informado')}</div>
      </div>
      <div class="info-band-col">
        <div class="info-band-label">Órgão Licitante</div>
        <div class="info-band-value">${escapeHtml(data.agencyName ?? 'Não identificado')}</div>
        ${data.municipalityName ? `<div class="info-band-sub">em ${escapeHtml([data.municipalityName, data.uf].filter(Boolean).join(' / '))}</div>` : ''}
      </div>
      <div class="info-band-col">
        <div class="info-band-label">Esfera do Órgão</div>
        <div class="sphere-icon-wrap">
          ${getSphereIcon(data.sphere)}
          <div class="info-band-value">${escapeHtml(sphereLabel.toUpperCase())}</div>
        </div>
      </div>
    </div>

    <!-- ════ SECTIONS ════ -->
    <div class="sections-wrap">

      <!-- ── SECTION 1: RESUMO EXECUTIVO ── -->
      <div class="section">
        <div class="section-title">
          <div class="section-title-text">1.&nbsp; Resumo Executivo</div>
          <div class="section-title-line"></div>
        </div>

        <div class="exec-cards">
          <!-- Modalidade -->
          <div class="exec-card">
            <div class="exec-card-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-14 9V3z" fill="#fff"/></svg>
            </div>
            <div class="exec-card-content">
              <div class="exec-card-label">Modalidade</div>
              <div class="exec-card-value">${escapeHtml(data.modality ?? 'Não informado')}</div>
            </div>
          </div>
          <!-- Data da Sessão -->
          <div class="exec-card">
            <div class="exec-card-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="#fff" stroke-width="2"/><path d="M3 9h18M8 2v4M16 2v4" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>
            </div>
            <div class="exec-card-content">
              <div class="exec-card-label">Data da Sessão</div>
              <div class="exec-card-value">${escapeHtml(formatDate(data.openingDate))}</div>
            </div>
          </div>
          <!-- Valor Estimado -->
          <div class="exec-card">
            <div class="exec-card-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#fff" stroke-width="2"/><path d="M12 7v10M9.5 9.5h3a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3H15" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>
            </div>
            <div class="exec-card-content">
              <div class="exec-card-label">Valor Estimado</div>
              <div class="exec-card-value">${escapeHtml(formatBRL(data.estimatedValue))}</div>
            </div>
          </div>
          <!-- Município/UF -->
          <div class="exec-card">
            <div class="exec-card-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#fff"/><circle cx="12" cy="9" r="2.5" fill="#1B3A6B"/></svg>
            </div>
            <div class="exec-card-content">
              <div class="exec-card-label">Município / UF</div>
              <div class="exec-card-value">${escapeHtml([data.municipalityName, data.uf].filter(Boolean).join(' / ') || 'Não informado')}</div>
            </div>
          </div>
          <!-- Critério de Julgamento -->
          <div class="exec-card">
            <div class="exec-card-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="exec-card-content">
              <div class="exec-card-label">Critério de Julgamento</div>
              <div class="exec-card-value">${escapeHtml(judgmentCriteria)}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── SECTION 2: OBJETO DA LICITAÇÃO ── -->
      <div class="section">
        <div class="section-title">
          <div class="section-title-text">2.&nbsp; Objeto da Licitação</div>
          <div class="section-title-line"></div>
        </div>

        <div class="object-grid">
          <!-- LEFT -->
          <div class="object-left">
            <div class="obj-label">Objeto Completo</div>
            <div class="obj-text">${escapeHtml(data.objectText)}</div>

            <div class="obj-label" style="margin-top:14px;">Resumo Inteligente</div>
            <div class="obj-text">${escapeHtml(data.objectSummary ?? data.executiveSummary ?? 'Resumo não disponível.')}</div>

            <div class="obj-label" style="margin-top:14px;">Categoria do Objeto</div>
            <div class="category-row">
              <div class="category-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" fill="#1B3A6B"/><rect x="14" y="3" width="7" height="7" rx="1" fill="#1B3A6B"/><rect x="3" y="14" width="7" height="7" rx="1" fill="#1B3A6B"/><rect x="14" y="14" width="7" height="7" rx="1" fill="#1B3A6B"/></svg>
              </div>
              <div style="flex:1;">
                <div style="font-weight:700;font-size:9.5pt;color:#111827;">${escapeHtml(categoryName)}</div>
              </div>
              <div style="font-size:8.5pt;color:#6B7280;">${escapeHtml(categoryType)}</div>
            </div>
          </div>

          <!-- RIGHT -->
          <div class="object-right">
            <div class="analysis-card">
              <div class="analysis-card-title">Resumo da Análise</div>
              <div class="analysis-card-text">${escapeHtml(data.executiveSummary ?? 'Análise não disponível.')}</div>
            </div>

            <div class="risk-card">
              <div class="risk-card-header">Risco Operacional</div>
              <div class="risk-card-body">
                <div class="risk-badge-big" style="background:${risk.bg};color:${risk.border};">
                  <div class="risk-badge-icon" style="color:${risk.border};border-color:${risk.border};background:${risk.bg};">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      ${risk.label === 'BAIXO' ? '<circle cx="12" cy="12" r="9" fill="#22C55E"/><path d="M7 12L10.5 15.5L17 9" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>' :
                        risk.label === 'MÉDIO' ? '<path d="M12 3L22 21H2L12 3Z" fill="#F59E0B"/><path d="M12 9V14M12 17V17.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>' :
                        risk.label === 'ALTO' ? '<circle cx="12" cy="12" r="9" fill="#EF4444"/><path d="M8 8L16 16M16 8L8 16" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>' :
                        '<circle cx="12" cy="12" r="9" fill="#9CA3AF"/><path d="M12 8V13M12 16V17" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'}
                    </svg>
                  </div>
                  ${escapeHtml(risk.label)}
                </div>
                <div style="flex:1;min-width:140px;font-size:9pt;color:#374151;line-height:1.6;">${escapeHtml(getRiskDescription(data.riskLevel))}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── SECTION 3: CONDIÇÕES OPERACIONAIS ── -->
      <div class="section">
        <div class="section-title">
          <div class="section-title-text">3.&nbsp; Condições Operacionais</div>
          <div class="section-title-line"></div>
        </div>

        <div class="ops-grid">
          <!-- Local de Entrega -->
          <div class="ops-col" style="flex:2;">
            <div class="ops-col-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="1" y="9" width="15" height="10" rx="1" stroke="#1B3A6B" stroke-width="2"/><path d="M16 13h4l2 3v3h-6v-6zM1 14h15" stroke="#1B3A6B" stroke-width="2" stroke-linecap="round"/><circle cx="5.5" cy="21" r="1.5" fill="#1B3A6B"/><circle cx="18.5" cy="21" r="1.5" fill="#1B3A6B"/></svg>
              <div class="ops-col-title">Local de Entrega</div>
            </div>
            <div class="ops-col-body">
              <ul class="ops-delivery-list">
                ${deliveryListHtml}
              </ul>
            </div>
          </div>

          <!-- Prazo para Entrega -->
          <div class="ops-col">
            <div class="ops-col-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#1B3A6B" stroke-width="2"/><path d="M12 7v5l3 3" stroke="#1B3A6B" stroke-width="2" stroke-linecap="round"/></svg>
              <div class="ops-col-title">Prazo para Entrega</div>
            </div>
            <div class="ops-col-body">
              <div class="ops-text">${escapeHtml(data.deliveryDeadline ?? 'Verificar no edital.')}</div>
            </div>
          </div>

          <!-- Prazo para Pagamento -->
          <div class="ops-col">
            <div class="ops-col-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="14" rx="2" stroke="#1B3A6B" stroke-width="2"/><path d="M2 10h20" stroke="#1B3A6B" stroke-width="2"/><rect x="6" y="14" width="3" height="2" rx="0.5" fill="#1B3A6B"/></svg>
              <div class="ops-col-title">Prazo para Pagamento</div>
            </div>
            <div class="ops-col-body">
              <div class="ops-text">${escapeHtml(
                data.paymentConditions
                  ? `${data.paymentConditions.deadline}${data.paymentConditions.method ? `, por meio de ${data.paymentConditions.method.toLowerCase()}` : ''}.`
                  : 'Verificar no edital.'
              )}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── SECTION 4: DOCUMENTOS ADICIONAIS ── -->
      <div class="section">
        <div class="section-title">
          <div class="section-title-text">4.&nbsp; Documentos Adicionais Exigidos pelo Edital</div>
          <div class="section-title-line"></div>
        </div>

        ${additionalDocs.length === 0
          ? `<div style="padding:16px;color:#6B7280;font-style:italic;font-size:9pt;">Nenhum documento adicional identificado.</div>`
          : `
        <table class="docs-table">
          <thead>
            <tr>
              <th style="width:18%;">Documento Exigido</th>
              <th style="width:34%;">Descrição / Finalidade</th>
              <th style="width:26%;">Base Legal / Referência</th>
              <th style="width:22%;">Status da Empresa</th>
            </tr>
          </thead>
          <tbody>
            ${additionalDocsRows}
          </tbody>
        </table>
        ${missingCount > 0 ? `
        <div class="docs-alert-bar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3L22 21H2L12 3Z" fill="#F59E0B"/><path d="M12 9V14M12 17V17.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>
          <span class="docs-alert-bar-text">A empresa não possui ${missingCount} dos ${requiredCount} documentos adicionais obrigatórios.</span>
          <span class="docs-alert-bar-sub">Regularize para aumentar sua competitividade.</span>
        </div>` : ''}`}
      </div>

      <!-- ── SECTION 5: ANÁLISE DOS ITENS ── -->
      <div class="section">
        <div class="section-title">
          <div class="section-title-text">5.&nbsp; Análise dos Itens</div>
          <div class="section-title-line"></div>
        </div>

        ${data.items.length === 0
          ? `<div style="padding:16px;color:#6B7280;font-style:italic;font-size:9pt;">Nenhum item registrado para esta licitação.</div>`
          : `
        <table class="items-table">
          <thead>
            <tr>
              <th class="th-center" style="width:5%;">Item</th>
              <th style="width:30%;">Descrição / Especificação do Item</th>
              <th class="th-center" style="width:6%;">Qtd.</th>
              <th class="th-center" style="width:6%;">Und.</th>
              <th class="th-right" style="width:12%;">Valor Estimado</th>
              <th style="width:18%;">Documento Específico Necessário</th>
              <th style="width:23%;">Aviso / Observação</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="items-legend">
          <div class="legend-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#22C55E"/><path d="M7 12L10.5 15.5L17 9" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>
            Não requer documento específico
          </div>
          <div class="legend-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3L22 21H2L12 3Z" fill="#F59E0B"/><path d="M12 9V14M12 17V17.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>
            Exige documento complementar
          </div>
          <div class="legend-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#EF4444"/><path d="M8 8L16 16M16 8L8 16" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>
            Documento obrigatório não atendido
          </div>
          <div class="legend-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#9CA3AF"/><path d="M12 7V13M12 16V17" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>
            Documento não exigido para este item
          </div>
        </div>
        <div class="items-note">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#9CA3AF"/><path d="M12 7V13M12 16V17" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>
          Os documentos específicos devem ser apresentados conforme exigido no edital. A ausência poderá resultar em inabilitação.
        </div>`}
      </div>

    </div><!-- end sections-wrap -->

  </div><!-- end page-wrap -->

</body>
</html>`;
}

// ─── Risk description helper ──────────────────────────────────────────────────

function getRiskDescription(riskLevel: string | null): string {
  switch (riskLevel?.toLowerCase()) {
    case 'low':
    case 'baixo':
      return 'Processo padronizado, com exigências claras e objetivas. Baixo histórico de questionamentos e impugnações para este tipo de objeto.';
    case 'medium':
    case 'medio':
      return 'Processo com algumas condições específicas que merecem atenção. Recomenda-se verificar os requisitos técnicos e documentais antes da participação.';
    case 'high':
    case 'alto':
      return 'Processo com exigências restritivas ou irregularidades identificadas. Avaliar cuidadosamente antes de participar.';
    default:
      return 'Nível de risco não avaliado. Recomenda-se análise detalhada do edital.';
  }
}
