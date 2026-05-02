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

  // Tenant / generation metadata
  tenantName: string;
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
  if (!date) return 'Não informado';
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
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

function getRiskBadge(riskLevel: string | null): { label: string; color: string; bg: string } {
  switch (riskLevel?.toLowerCase()) {
    case 'low':
      return { label: 'BAIXO', color: '#155724', bg: '#d4edda' };
    case 'medium':
      return { label: 'MÉDIO', color: '#856404', bg: '#fff3cd' };
    case 'high':
      return { label: 'ALTO', color: '#721c24', bg: '#f8d7da' };
    default:
      return { label: 'NÃO AVALIADO', color: '#383d41', bg: '#e2e3e5' };
  }
}

function getRecommendationBadge(recommendation: string | null): {
  label: string;
  color: string;
  bg: string;
  icon: string;
} {
  switch (recommendation) {
    case 'participate':
      return {
        label: 'PARTICIPAR',
        color: '#155724',
        bg: '#d4edda',
        icon: '✔',
      };
    case 'caution':
      return {
        label: 'PARTICIPAR COM CAUTELA',
        color: '#856404',
        bg: '#fff3cd',
        icon: '⚠',
      };
    case 'avoid':
      return {
        label: 'NÃO PARTICIPAR',
        color: '#721c24',
        bg: '#f8d7da',
        icon: '✘',
      };
    default:
      return {
        label: 'EM ANÁLISE',
        color: '#383d41',
        bg: '#e2e3e5',
        icon: '…',
      };
  }
}

// ─── Main renderer ────────────────────────────────────────────────────────────
export function renderBiddingAnalysisTemplate(data: BiddingReportData): string {
  const risk = getRiskBadge(data.riskLevel);
  const rec = getRecommendationBadge(data.analysisRecommendation);

  // Executive summary: prefer analysis field, fall back to generated text
  const executiveSummary =
    data.executiveSummary ||
    buildFallbackExecutiveSummary(data, risk);

  const objectSummary =
    data.objectSummary ||
    (data.objectText.length > 300 ? data.objectText.substring(0, 300) + '...' : data.objectText);

  // Items table rows
  const itemsRows = data.items
    .map(
      (item, idx) => `
    <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
      <td class="td-center">${item.itemNumber}</td>
      <td>${escapeHtml(item.description)}</td>
      <td class="td-center">${parseFloat(item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}</td>
      <td class="td-center">${escapeHtml(item.unit)}</td>
      <td class="td-right">${formatBRL(item.unitValueEstimated)}</td>
      <td class="td-right">${formatBRL(item.totalValueEstimated)}</td>
    </tr>`,
    )
    .join('');

  const totalEstimated = data.items.reduce((sum, item) => {
    const val = parseFloat(item.totalValueEstimated ?? '0');
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  // Document alerts section
  const documentAlertsHtml = buildDocumentAlertsSection(data.documentAlerts);

  // Impugnation points section
  const impugnationHtml = buildImpugnationSection(data.impugnationPoints);

  // Payment conditions section
  const paymentHtml = buildPaymentSection(data.paymentConditions);

  // Guarantees section
  const guaranteesHtml = buildGuaranteesSection(data.guaranteeContractual, data.guaranteeObject);

  // Section numbering
  let sectionIdx = 1;
  const sn = () => sectionIdx++;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Relatório de Análise Técnica — ${escapeHtml(data.agencyName ?? 'Órgão')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      color: #1a1a1a;
      background: #fff;
    }

    /* ======== COVER PAGE ======== */
    .cover {
      background: linear-gradient(160deg, #1B365D 60%, #1e4a7a 100%);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 80px;
      page-break-after: always;
      position: relative;
    }

    .cover-watermark {
      position: absolute;
      bottom: 40px;
      right: 60px;
      font-size: 9pt;
      color: rgba(255,255,255,0.3);
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .cover-logo {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 50px;
    }

    .cover-logo-icon {
      width: 80px;
      height: 80px;
      background: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 14px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    }

    .cover-logo-icon svg { width: 48px; height: 48px; }

    .cover-logo-name {
      font-size: 20pt;
      font-weight: 700;
      color: #fff;
      letter-spacing: 3px;
      text-transform: uppercase;
    }

    .cover-logo-sub {
      font-size: 9pt;
      color: rgba(255,255,255,0.65);
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 4px;
    }

    .cover-divider {
      width: 80px;
      height: 3px;
      background: #4A90D9;
      margin: 36px auto;
      border-radius: 2px;
    }

    .cover-title {
      font-size: 24pt;
      font-weight: 700;
      color: #fff;
      text-align: center;
      letter-spacing: 2px;
      text-transform: uppercase;
      line-height: 1.3;
      margin-bottom: 8px;
    }

    .cover-subtitle {
      font-size: 11pt;
      color: rgba(255,255,255,0.65);
      text-align: center;
      letter-spacing: 1px;
      margin-bottom: 44px;
    }

    .cover-info-box {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 10px;
      padding: 32px 50px;
      width: 100%;
      max-width: 620px;
      text-align: center;
    }

    .cover-agency {
      font-size: 15pt;
      font-weight: 700;
      color: #fff;
      margin-bottom: 10px;
      line-height: 1.3;
    }

    .cover-value {
      font-size: 22pt;
      font-weight: 700;
      color: #4A90D9;
      margin-bottom: 4px;
    }

    .cover-value-label {
      font-size: 8.5pt;
      color: rgba(255,255,255,0.5);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 16px;
    }

    .cover-meta {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-bottom: 22px;
      flex-wrap: wrap;
    }

    .cover-meta-item {
      text-align: center;
    }

    .cover-meta-label {
      font-size: 7.5pt;
      color: rgba(255,255,255,0.45);
      text-transform: uppercase;
      letter-spacing: 1px;
      display: block;
      margin-bottom: 3px;
    }

    .cover-meta-value {
      font-size: 9.5pt;
      color: rgba(255,255,255,0.85);
      font-weight: 600;
    }

    .risk-badge {
      display: inline-block;
      padding: 8px 26px;
      border-radius: 20px;
      font-size: 11pt;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .risk-badge-label {
      font-size: 8pt;
      color: rgba(255,255,255,0.5);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    /* ======== BODY / SECTIONS ======== */
    .page-body { padding: 40px 60px 80px 60px; }

    .section { margin-bottom: 32px; }

    .section-header {
      background: #1B365D;
      color: #fff;
      padding: 10px 16px;
      font-size: 10.5pt;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      border-radius: 4px 4px 0 0;
    }

    .section-body {
      border: 1px solid #d0d7e3;
      border-top: none;
      padding: 18px 20px;
      border-radius: 0 0 4px 4px;
      background: #fff;
    }

    .section-body p {
      line-height: 1.7;
      color: #333;
      margin-bottom: 8px;
    }

    .section-body p:last-child { margin-bottom: 0; }

    /* ======== INFO TABLE ======== */
    .info-table { width: 100%; border-collapse: collapse; }

    .info-table tr:not(:last-child) td { border-bottom: 1px solid #eef0f5; }

    .info-table td { padding: 9px 12px; font-size: 10.5pt; }

    .info-table td.label {
      width: 35%;
      font-weight: 600;
      color: #1B365D;
      background: #f7f9fc;
    }

    .info-table td.value { color: #333; }

    /* ======== RECOMMENDATION BOX ======== */
    .rec-box {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 18px 20px;
    }

    .rec-icon {
      font-size: 28pt;
      line-height: 1;
      flex-shrink: 0;
    }

    .rec-content { flex: 1; }

    .rec-badge {
      display: inline-block;
      padding: 6px 18px;
      border-radius: 4px;
      font-size: 11pt;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .rec-text {
      font-size: 10pt;
      color: #444;
      line-height: 1.6;
    }

    /* ======== ALERTS / IMPUGNATION ======== */
    .alert-list { list-style: none; padding: 0; margin: 0; }

    .alert-item {
      border-left: 4px solid #e0a800;
      padding: 10px 14px;
      margin-bottom: 10px;
      background: #fffbf0;
      border-radius: 0 4px 4px 0;
    }

    .alert-item:last-child { margin-bottom: 0; }

    .alert-doc { font-weight: 700; color: #1B365D; font-size: 10pt; }

    .alert-ref { font-size: 8.5pt; color: #888; margin-top: 2px; }

    .alert-reason { font-size: 9.5pt; color: #555; margin-top: 4px; line-height: 1.5; }

    .imp-item {
      border-left: 4px solid #c0392b;
      padding: 10px 14px;
      margin-bottom: 12px;
      background: #fdf5f5;
      border-radius: 0 4px 4px 0;
    }

    .imp-item:last-child { margin-bottom: 0; }

    .imp-title { font-weight: 700; color: #721c24; font-size: 10.5pt; }

    .imp-legal {
      font-size: 8.5pt;
      color: #888;
      margin-top: 2px;
      font-style: italic;
    }

    .imp-description { font-size: 9.5pt; color: #444; margin-top: 6px; line-height: 1.6; }

    .imp-explanation {
      font-size: 9pt;
      color: #666;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid #f0d0d0;
      line-height: 1.5;
    }

    /* ======== RISK SECTION ======== */
    .risk-section-body {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }

    .risk-indicator {
      flex-shrink: 0;
      width: 90px;
      text-align: center;
    }

    .risk-indicator-badge {
      display: inline-block;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 10pt;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      width: 100%;
    }

    .risk-text {
      flex: 1;
      line-height: 1.7;
      color: #333;
      font-size: 10.5pt;
    }

    /* ======== ITEMS TABLE ======== */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
    }

    .items-table thead tr { background: #1B365D; color: #fff; }

    .items-table thead th {
      padding: 10px 8px;
      text-align: left;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      font-size: 8.5pt;
    }

    .items-table thead th.th-center { text-align: center; }
    .items-table thead th.th-right { text-align: right; }

    .items-table tbody tr.row-even { background: #f7f9fc; }
    .items-table tbody tr.row-odd { background: #fff; }

    .items-table td {
      padding: 8px 8px;
      border-bottom: 1px solid #e3e8f0;
      vertical-align: top;
      color: #333;
    }

    .items-table td.td-center { text-align: center; }
    .items-table td.td-right { text-align: right; white-space: nowrap; }

    .items-table tfoot tr { background: #1B365D; }

    .items-table tfoot td {
      padding: 10px 8px;
      color: #fff;
      font-weight: 700;
      border: none;
    }

    .items-table tfoot td.td-right { text-align: right; }

    /* ======== FOOTER ======== */
    @page {
      margin: 20mm 15mm 25mm 15mm;
    }

    .footer-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #f7f9fc;
      border-top: 2px solid #1B365D;
      padding: 8px 60px;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: #888;
    }

    .footer-confidential {
      font-weight: 700;
      color: #1B365D;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    /* ======== PRINT ======== */
    @media print {
      .cover, .section-header, .items-table thead tr, .items-table tfoot tr {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>

  <!-- ============ COVER PAGE ============ -->
  <div class="cover">
    <div class="cover-logo">
      <div class="cover-logo-icon">
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="24" cy="24" r="22" fill="#1B365D"/>
          <path d="M10 32L18 16L24 26L30 20L38 32H10Z" fill="#4A90D9"/>
          <circle cx="24" cy="12" r="4" fill="#4A90D9"/>
        </svg>
      </div>
      <div class="cover-logo-name">TAED Soluções</div>
      <div class="cover-logo-sub">Licita IA — Inteligência em Licitações</div>
    </div>

    <div class="cover-divider"></div>

    <div class="cover-title">Relatório de Análise Técnica</div>
    <div class="cover-subtitle">Análise Automatizada de Oportunidade de Licitação</div>

    <div class="cover-info-box">
      <div class="cover-agency">${escapeHtml(data.agencyName ?? 'Órgão não identificado')}</div>
      <div class="cover-value-label">Valor Estimado</div>
      <div class="cover-value">${formatBRL(data.estimatedValue)}</div>

      <div class="cover-meta">
        <div class="cover-meta-item">
          <span class="cover-meta-label">UASG</span>
          <span class="cover-meta-value">${escapeHtml(data.uasg ?? '—')}</span>
        </div>
        <div class="cover-meta-item">
          <span class="cover-meta-label">Pregão / Edital</span>
          <span class="cover-meta-value">${escapeHtml(data.biddingNumber ?? '—')}</span>
        </div>
        <div class="cover-meta-item">
          <span class="cover-meta-label">Município / UF</span>
          <span class="cover-meta-value">${escapeHtml([data.municipalityName, data.uf].filter(Boolean).join(' / ') || '—')}</span>
        </div>
        <div class="cover-meta-item">
          <span class="cover-meta-label">Gerado em</span>
          <span class="cover-meta-value">${formatDate(data.generatedAt)}</span>
        </div>
      </div>

      <div class="risk-badge-label">Nível de Risco</div>
      <div class="risk-badge" style="background:${risk.bg};color:${risk.color};">${risk.label}</div>
    </div>

    <div class="cover-watermark">Confidencial — ${escapeHtml(data.tenantName)}</div>
  </div>

  <!-- ============ BODY ============ -->
  <div class="page-body">

    <!-- 1. RESUMO EXECUTIVO -->
    <div class="section">
      <div class="section-header">${sn()}. Resumo Executivo</div>
      <div class="section-body">
        <p>${escapeHtml(executiveSummary)}</p>
      </div>
    </div>

    <!-- 2. INFORMAÇÕES BÁSICAS -->
    <div class="section">
      <div class="section-header">${sn()}. Informações Básicas</div>
      <div class="section-body" style="padding: 0;">
        <table class="info-table">
          <tbody>
            <tr>
              <td class="label">UASG</td>
              <td class="value">${escapeHtml(data.uasg ?? 'Não informado')}</td>
            </tr>
            <tr>
              <td class="label">Órgão</td>
              <td class="value">${escapeHtml(data.agencyName ?? 'Não informado')}</td>
            </tr>
            <tr>
              <td class="label">Esfera</td>
              <td class="value">${escapeHtml(data.sphere ?? 'Não informado')}</td>
            </tr>
            <tr>
              <td class="label">Modalidade</td>
              <td class="value">${escapeHtml(data.modality ?? 'Não informado')}</td>
            </tr>
            <tr>
              <td class="label">N° do Pregão / Edital</td>
              <td class="value">${escapeHtml(data.biddingNumber ?? 'Não informado')}</td>
            </tr>
            <tr>
              <td class="label">Município / UF</td>
              <td class="value">${escapeHtml([data.municipalityName, data.uf].filter(Boolean).join(' — ') || 'Não informado')}</td>
            </tr>
            <tr>
              <td class="label">Abertura das Propostas</td>
              <td class="value">${formatDate(data.openingDate)}</td>
            </tr>
            <tr>
              <td class="label">Prazo das Propostas</td>
              <td class="value">${formatDate(data.proposalDueDate)}</td>
            </tr>
            <tr>
              <td class="label">Valor Estimado Total</td>
              <td class="value"><strong>${formatBRL(data.estimatedValue)}</strong></td>
            </tr>
            ${
              data.deliveryLocation
                ? `<tr>
              <td class="label">Local de Entrega</td>
              <td class="value">${escapeHtml(data.deliveryLocation)}</td>
            </tr>`
                : ''
            }
            ${
              data.deliveryDeadline
                ? `<tr>
              <td class="label">Prazo de Entrega</td>
              <td class="value">${escapeHtml(data.deliveryDeadline)}</td>
            </tr>`
                : ''
            }
            <tr>
              <td class="label">Nível de Risco</td>
              <td class="value">
                <span style="display:inline-block;padding:4px 14px;border-radius:4px;font-weight:700;font-size:9.5pt;background:${risk.bg};color:${risk.color};">
                  ${risk.label}
                </span>
              </td>
            </tr>
            <tr>
              <td class="label">Recomendação TAED</td>
              <td class="value">
                <span style="display:inline-block;padding:4px 14px;border-radius:4px;font-weight:700;font-size:9.5pt;background:${rec.bg};color:${rec.color};">
                  ${rec.icon} ${rec.label}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 3. RECOMENDAÇÃO -->
    <div class="section">
      <div class="section-header">${sn()}. Recomendação de Participação</div>
      <div class="section-body" style="padding:0;">
        <div class="rec-box">
          <div class="rec-icon" style="color:${rec.color};">${rec.icon}</div>
          <div class="rec-content">
            <div class="rec-badge" style="background:${rec.bg};color:${rec.color};">${rec.label}</div>
            <div class="rec-text">${escapeHtml(getRecommendationText(data.analysisRecommendation, data.riskLevel))}</div>
          </div>
        </div>
      </div>
    </div>

    ${documentAlertsHtml ? `<!-- 4. ALERTAS DE DOCUMENTOS -->
    <div class="section">
      <div class="section-header">${sn()}. Alertas de Documentos Necessários</div>
      <div class="section-body">
        ${documentAlertsHtml}
      </div>
    </div>` : `<!-- no document alerts -->`}

    ${impugnationHtml ? `<!-- 5. PONTOS DE IMPUGNAÇÃO -->
    <div class="section">
      <div class="section-header">${sn()}. Pontos de Impugnação Identificados</div>
      <div class="section-body">
        <p style="font-size:9pt;color:#666;margin-bottom:12px;">
          Os pontos abaixo foram identificados pela análise automatizada como possíveis irregularidades
          no edital. Recomenda-se avaliação jurídica antes de protocolar impugnação formal.
        </p>
        ${impugnationHtml}
      </div>
    </div>` : `<!-- no impugnation points -->`}

    <!-- GARANTIAS -->
    <div class="section">
      <div class="section-header">${sn()}. Garantias</div>
      <div class="section-body">
        ${guaranteesHtml}
      </div>
    </div>

    <!-- CONDIÇÕES DE PAGAMENTO -->
    <div class="section">
      <div class="section-header">${sn()}. Condições de Pagamento</div>
      <div class="section-body">
        ${paymentHtml}
      </div>
    </div>

    <!-- TABELA DE ITENS -->
    <div class="section">
      <div class="section-header">${sn()}. Tabela de Itens da Licitação</div>
      <div class="section-body" style="padding: 0; overflow: hidden;">
        ${
          data.items.length === 0
            ? '<div style="padding:16px;color:#888;font-style:italic;">Nenhum item registrado para esta licitação.</div>'
            : `
        <table class="items-table">
          <thead>
            <tr>
              <th style="width:5%;" class="th-center">N°</th>
              <th style="width:40%;">Descrição do Item</th>
              <th style="width:10%;" class="th-center">Qtd</th>
              <th style="width:8%;" class="th-center">Un</th>
              <th style="width:17%;" class="th-right">Vl. Unitário</th>
              <th style="width:20%;" class="th-right">Vl. Total</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="5" style="font-size:9pt;letter-spacing:1px;text-transform:uppercase;">Total Estimado</td>
              <td class="td-right" style="font-size:10.5pt;">${formatBRL(totalEstimated > 0 ? totalEstimated : null)}</td>
            </tr>
          </tfoot>
        </table>`
        }
      </div>
    </div>

    <!-- FOOTER NOTE -->
    <div style="margin-top:40px;padding:16px 20px;background:#f7f9fc;border:1px solid #d0d7e3;border-radius:4px;font-size:8.5pt;color:#888;text-align:center;">
      <strong style="color:#1B365D;">CONFIDENCIAL — TAED Soluções</strong>&nbsp;&nbsp;|&nbsp;&nbsp;
      Relatório gerado automaticamente pelo sistema Licita IA em ${formatDate(data.generatedAt)}.&nbsp;&nbsp;|&nbsp;&nbsp;
      Uso restrito ao cliente ${escapeHtml(data.tenantName)}.&nbsp;&nbsp;|&nbsp;&nbsp;
      As informações contidas neste documento são de caráter analítico e não substituem a consulta ao edital oficial.
    </div>

  </div>

</body>
</html>`;
}

// ─── Section builders ─────────────────────────────────────────────────────────

function buildFallbackExecutiveSummary(
  data: BiddingReportData,
  risk: { label: string },
): string {
  const objectSummary =
    data.objectSummary ||
    (data.objectText.length > 300 ? data.objectText.substring(0, 300) + '...' : data.objectText);

  return (
    `A presente análise refere-se ao processo licitatório conduzido pelo órgão ` +
    `${data.agencyName ?? 'não identificado'}` +
    (data.uasg ? ` (UASG ${data.uasg})` : '') +
    (data.sphere ? `, pertencente à esfera ${data.sphere}` : '') +
    `, com abertura prevista para ${data.openingDate ? new Date(data.openingDate).toLocaleDateString('pt-BR') : 'data não informada'}. ` +
    `O objeto da licitação consiste em: ${objectSummary}. ` +
    `O valor total estimado é de ${data.estimatedValue ? parseFloat(data.estimatedValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'não informado'}, ` +
    `abrangendo ${data.items.length > 0 ? `${data.items.length} item(ns)` : 'itens a serem detalhados'}. ` +
    `A análise de risco classificou esta licitação com nível ${risk.label}.`
  );
}

function buildDocumentAlertsSection(alerts: DocumentAlertData[]): string {
  if (!alerts || alerts.length === 0) return '';

  const items = alerts
    .map(
      (a) => `
    <li class="alert-item">
      <div class="alert-doc">${escapeHtml(a.document)}</div>
      <div class="alert-ref">Item do edital: ${escapeHtml(a.item)}</div>
      <div class="alert-reason">${escapeHtml(a.reason)}</div>
    </li>`,
    )
    .join('');

  return `<ul class="alert-list">${items}</ul>`;
}

function buildImpugnationSection(points: ImpugnationPointData[]): string {
  if (!points || points.length === 0) return '';

  return points
    .map(
      (p) => `
    <div class="imp-item">
      <div class="imp-title">${escapeHtml(p.title)}</div>
      <div class="imp-legal">${escapeHtml(p.legalBasis)}${p.articleNumber ? ` — Art. ${escapeHtml(p.articleNumber)}` : ''}</div>
      <div class="imp-description">${escapeHtml(p.description)}</div>
      <div class="imp-explanation"><strong>Em linguagem simples:</strong> ${escapeHtml(p.explanation)}</div>
    </div>`,
    )
    .join('');
}

function buildPaymentSection(conditions: PaymentConditionsData | null): string {
  if (!conditions) {
    return `<p>As condições de pagamento deverão ser verificadas no edital completo do processo licitatório.
      Em geral, contratos com órgãos públicos preveem pagamento mediante emissão de nota fiscal/fatura,
      com prazo de 30 (trinta) dias após ateste do responsável designado pelo órgão contratante.</p>
    <p>Recomenda-se verificar no edital: prazo de pagamento, forma de emissão de NF, eventuais retenções
      tributárias e condições de reajuste de preços durante a vigência do contrato.</p>`;
  }

  return `<table class="info-table">
    <tbody>
      <tr>
        <td class="label">Prazo de Pagamento</td>
        <td class="value">${escapeHtml(conditions.deadline)}</td>
      </tr>
      <tr>
        <td class="label">Forma de Pagamento</td>
        <td class="value">${escapeHtml(conditions.method)}</td>
      </tr>
      ${
        conditions.details
          ? `<tr>
        <td class="label">Detalhes</td>
        <td class="value">${escapeHtml(conditions.details)}</td>
      </tr>`
          : ''
      }
    </tbody>
  </table>`;
}

function buildGuaranteesSection(
  contractual: string | null,
  objectGuarantee: string | null,
): string {
  const contractualText =
    contractual && contractual !== 'Não especificada'
      ? contractual
      : 'A garantia contratual deverá ser verificada no edital completo. Contratos com órgãos públicos podem exigir garantia de 2% a 5% do valor do contrato (caução, seguro-garantia ou fiança bancária), conforme Art. 96 da Lei nº 14.133/2021.';

  const objectText =
    objectGuarantee && objectGuarantee !== 'Não especificada'
      ? objectGuarantee
      : 'Verifique no edital o prazo de garantia dos produtos/serviços entregues e as condições de assistência técnica e manutenção.';

  return `<table class="info-table">
    <tbody>
      <tr>
        <td class="label">Garantia Contratual</td>
        <td class="value">${escapeHtml(contractualText)}</td>
      </tr>
      <tr>
        <td class="label">Garantia do Objeto</td>
        <td class="value">${escapeHtml(objectText)}</td>
      </tr>
    </tbody>
  </table>`;
}

function getRecommendationText(
  recommendation: string | null,
  riskLevel: string | null,
): string {
  switch (recommendation) {
    case 'participate':
      return 'A análise técnica recomenda a participação neste processo licitatório. As condições do edital estão em conformidade com a legislação vigente e o perfil de risco é favorável. A empresa deverá preparar a documentação de habilitação e proposta comercial competitiva.';
    case 'caution':
      return 'A análise técnica recomenda participação com cautela. Foram identificados pontos de atenção que exigem avaliação adicional antes da decisão final. Verifique os alertas de documentos e condições contratuais antes de confirmar a participação.';
    case 'avoid':
      return 'A análise técnica recomenda não participar deste processo. Foram identificados fatores de risco elevado que podem comprometer a viabilidade da participação. Consulte a equipe TAED Soluções para avaliação detalhada.';
    default: {
      switch (riskLevel?.toLowerCase()) {
        case 'low':
          return 'Licitação com baixo nível de risco. Órgão apresenta boa capacidade de pagamento e o objeto está dentro dos parâmetros normais de contratação. Recomenda-se participação com condições padrão.';
        case 'medium':
          return 'Licitação com nível de risco moderado. Recomenda-se atenção às condições de pagamento e garantias contratuais. Avalie o histórico do órgão antes de confirmar participação.';
        case 'high':
          return 'Licitação com alto nível de risco. Recomenda-se cautela na participação. Verifique com atenção as condições de habilitação, garantias exigidas e capacidade de pagamento do órgão contratante.';
        default:
          return 'Nível de risco não avaliado. A equipe TAED Soluções realizará análise detalhada antes da liberação da oportunidade.';
      }
    }
  }
}
