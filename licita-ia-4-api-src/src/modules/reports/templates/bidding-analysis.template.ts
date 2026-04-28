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

function formatBRL(valueStr: string | null): string {
  if (!valueStr) return 'Não informado';
  const num = parseFloat(valueStr);
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

function getRiskDescription(riskLevel: string | null): string {
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

function getRecommendation(riskLevel: string | null): string {
  switch (riskLevel?.toLowerCase()) {
    case 'low':
      return 'PARTICIPAR — Oportunidade com perfil favorável';
    case 'medium':
      return 'PARTICIPAR COM ATENÇÃO — Avalie condições contratuais';
    case 'high':
      return 'AVALIAR COM CAUTELA — Risco elevado identificado';
    default:
      return 'EM ANÁLISE — Aguardando avaliação completa';
  }
}

export function renderBiddingAnalysisTemplate(data: BiddingReportData): string {
  const risk = getRiskBadge(data.riskLevel);
  const riskDescription = getRiskDescription(data.riskLevel);
  const recommendation = getRecommendation(data.riskLevel);

  const itemsRows = data.items
    .map(
      (item, idx) => `
    <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
      <td class="td-center">${item.itemNumber}</td>
      <td>${item.description}</td>
      <td class="td-center">${parseFloat(item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}</td>
      <td class="td-center">${item.unit}</td>
      <td class="td-right">${formatBRL(item.unitValueEstimated)}</td>
      <td class="td-right">${formatBRL(item.totalValueEstimated)}</td>
    </tr>
  `,
    )
    .join('');

  const totalEstimated = data.items.reduce((sum, item) => {
    const val = parseFloat(item.totalValueEstimated ?? '0');
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const objectSummary =
    data.objectSummary ||
    (data.objectText.length > 300 ? data.objectText.substring(0, 300) + '...' : data.objectText);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Relatório de Análise Técnica — ${data.agencyName ?? 'Órgão'}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      color: #1a1a1a;
      background: #fff;
    }

    /* ======== COVER PAGE ======== */
    .cover {
      background: #1B365D;
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
      margin-bottom: 60px;
    }

    .cover-logo-icon {
      width: 72px;
      height: 72px;
      background: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
    }

    .cover-logo-icon svg {
      width: 44px;
      height: 44px;
    }

    .cover-logo-name {
      font-size: 18pt;
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
      margin: 40px auto;
      border-radius: 2px;
    }

    .cover-title {
      font-size: 22pt;
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
      margin-bottom: 50px;
    }

    .cover-info-box {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      padding: 30px 50px;
      width: 100%;
      max-width: 600px;
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
      font-size: 20pt;
      font-weight: 700;
      color: #4A90D9;
      margin-bottom: 8px;
    }

    .cover-value-label {
      font-size: 9pt;
      color: rgba(255,255,255,0.5);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 20px;
    }

    .cover-date {
      font-size: 10pt;
      color: rgba(255,255,255,0.65);
      margin-bottom: 20px;
    }

    .risk-badge {
      display: inline-block;
      padding: 8px 24px;
      border-radius: 20px;
      font-size: 11pt;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      background: ${risk.bg};
      color: ${risk.color};
    }

    .risk-badge-label {
      font-size: 8pt;
      color: rgba(255,255,255,0.5);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    /* ======== BODY / SECTIONS ======== */
    .page-body {
      padding: 40px 60px 80px 60px;
    }

    .section {
      margin-bottom: 36px;
      page-break-inside: avoid;
    }

    .section-header {
      background: #1B365D;
      color: #fff;
      padding: 10px 16px;
      font-size: 11pt;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      border-radius: 4px 4px 0 0;
      margin-bottom: 0;
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

    .section-body p:last-child {
      margin-bottom: 0;
    }

    /* ======== INFO TABLE ======== */
    .info-table {
      width: 100%;
      border-collapse: collapse;
    }

    .info-table tr:not(:last-child) td {
      border-bottom: 1px solid #eef0f5;
    }

    .info-table td {
      padding: 9px 12px;
      font-size: 10.5pt;
    }

    .info-table td.label {
      width: 35%;
      font-weight: 600;
      color: #1B365D;
      background: #f7f9fc;
    }

    .info-table td.value {
      color: #333;
    }

    /* ======== RECOMMENDATION ======== */
    .recommendation-badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 4px;
      font-size: 10pt;
      font-weight: 700;
      background: ${risk.bg};
      color: ${risk.color};
    }

    /* ======== RISK SECTION ======== */
    .risk-section-body {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }

    .risk-indicator {
      flex-shrink: 0;
      width: 80px;
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
      background: ${risk.bg};
      color: ${risk.color};
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

    .items-table thead tr {
      background: #1B365D;
      color: #fff;
    }

    .items-table thead th {
      padding: 10px 8px;
      text-align: left;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      font-size: 8.5pt;
    }

    .items-table thead th.th-center {
      text-align: center;
    }

    .items-table thead th.th-right {
      text-align: right;
    }

    .items-table tbody tr.row-even {
      background: #f7f9fc;
    }

    .items-table tbody tr.row-odd {
      background: #fff;
    }

    .items-table tbody tr:hover {
      background: #eef2fa;
    }

    .items-table td {
      padding: 8px 8px;
      border-bottom: 1px solid #e3e8f0;
      vertical-align: top;
      color: #333;
    }

    .items-table td.td-center {
      text-align: center;
    }

    .items-table td.td-right {
      text-align: right;
      white-space: nowrap;
    }

    .items-table tfoot tr {
      background: #1B365D;
    }

    .items-table tfoot td {
      padding: 10px 8px;
      color: #fff;
      font-weight: 700;
      border: none;
    }

    .items-table tfoot td.td-right {
      text-align: right;
    }

    /* ======== FOOTER ======== */
    @page {
      margin: 20mm 15mm 25mm 15mm;
      @bottom-center {
        content: "CONFIDENCIAL — TAED Soluções | Licita IA    |    Página " counter(page) " de " counter(pages);
        font-size: 8pt;
        color: #888;
        font-family: Arial, sans-serif;
        border-top: 1px solid #ddd;
        padding-top: 6px;
      }
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
      .cover {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .section-header {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .items-table thead tr {
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
        <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="22" cy="22" r="20" fill="#1B365D"/>
          <path d="M10 28L16 16L22 24L28 18L34 28H10Z" fill="#4A90D9"/>
          <circle cx="22" cy="13" r="3" fill="#4A90D9"/>
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
      <div class="cover-date">Data de Geração: ${formatDate(data.generatedAt)}</div>
      <div class="risk-badge-label">Nível de Risco</div>
      <div class="risk-badge">${risk.label}</div>
    </div>

    <div class="cover-watermark">Confidencial — ${escapeHtml(data.tenantName)}</div>
  </div>

  <!-- ============ BODY ============ -->
  <div class="page-body">

    <!-- RESUMO EXECUTIVO -->
    <div class="section">
      <div class="section-header">1. Resumo Executivo</div>
      <div class="section-body">
        <p>
          A presente análise refere-se ao processo licitatório conduzido pelo órgão
          <strong>${escapeHtml(data.agencyName ?? 'não identificado')}</strong>
          ${data.uasg ? `(UASG ${escapeHtml(data.uasg)})` : ''}
          ${data.sphere ? `, pertencente à esfera <strong>${escapeHtml(data.sphere)}</strong>` : ''},
          com abertura prevista para <strong>${formatDate(data.openingDate ?? data.proposalDueDate)}</strong>.
        </p>
        <p>
          O objeto da licitação consiste em: <em>${escapeHtml(objectSummary)}</em>
        </p>
        <p>
          O valor total estimado para o processo é de <strong>${formatBRL(data.estimatedValue)}</strong>,
          abrangendo ${data.items.length > 0 ? `<strong>${data.items.length} item(ns)</strong>` : 'itens a serem detalhados'}.
          A análise de risco da TAED Soluções classificou esta licitação com nível
          <strong>${risk.label}</strong>.
        </p>
      </div>
    </div>

    <!-- INFORMAÇÕES BÁSICAS -->
    <div class="section">
      <div class="section-header">2. Informações Básicas</div>
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
            <tr>
              <td class="label">Nível de Risco</td>
              <td class="value"><span class="recommendation-badge">${risk.label}</span></td>
            </tr>
            <tr>
              <td class="label">Recomendação TAED</td>
              <td class="value"><strong>${escapeHtml(recommendation)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- GARANTIAS E CONDIÇÕES DE PAGAMENTO -->
    <div class="section">
      <div class="section-header">3. Garantias e Condições de Pagamento</div>
      <div class="section-body">
        <p>
          As condições de pagamento deverão ser verificadas no edital completo do processo licitatório.
          Em geral, contratos com órgãos públicos preveem pagamento mediante emissão de nota fiscal/fatura,
          com prazo de 30 (trinta) dias após ateste do responsável designado pelo órgão contratante.
        </p>
        <p>
          A empresa participante deverá atentar para eventuais exigências de garantia contratual previstas
          no edital (caução em dinheiro, seguro-garantia ou fiança bancária), que podem variar de 2% a 5%
          do valor do contrato.
        </p>
        <p>
          Recomenda-se verificar no edital: prazo de pagamento, forma de emissão de NF, eventuais retenções
          tributárias e condições de reajuste de preços durante a vigência do contrato.
        </p>
      </div>
    </div>

    <!-- HABILITAÇÃO TÉCNICA E ECONÔMICA -->
    <div class="section">
      <div class="section-header">4. Habilitação Técnica e Econômica</div>
      <div class="section-body">
        <p>
          Para participação no processo licitatório, a empresa deverá comprovar habilitação jurídica,
          regularidade fiscal e trabalhista, habilitação técnica e qualificação econômico-financeira,
          conforme disposto no edital e na Lei nº 14.133/2021 (Nova Lei de Licitações).
        </p>
        <p>
          <strong>Documentos habitualmente exigidos:</strong>
        </p>
        <p>
          Habilitação jurídica: CNPJ, ato constitutivo, estatuto ou contrato social atualizado.
          Regularidade fiscal: CND Federal, CND Estadual, CND Municipal, CRF (FGTS), CNDT (Trabalhista).
          Qualificação técnica: Atestado(s) de capacidade técnica fornecido(s) por pessoa jurídica de direito
          público ou privado, comprovando fornecimento de objeto compatível com o licitado.
          Qualificação econômico-financeira: Balanço patrimonial, certidão negativa de falência e concordata,
          capital mínimo ou patrimônio líquido conforme fixado no edital.
        </p>
        <p>
          Consulte o edital completo para verificar requisitos específicos deste processo.
        </p>
      </div>
    </div>

    <!-- CONDIÇÕES PARTICULARES / RISCO -->
    <div class="section">
      <div class="section-header">5. Condições Particulares e Nível de Risco</div>
      <div class="section-body">
        <div class="risk-section-body">
          <div class="risk-indicator">
            <div style="font-size:8pt;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">Risco</div>
            <div class="risk-indicator-badge">${risk.label}</div>
          </div>
          <div class="risk-text">
            <p>${escapeHtml(riskDescription)}</p>
            <p style="margin-top:10px;">
              <strong>Recomendação TAED Soluções:</strong> ${escapeHtml(recommendation)}.
              A equipe da TAED está disponível para apoiar na análise detalhada do edital e na elaboração
              da proposta técnica e comercial.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- TABELA DE ITENS -->
    <div class="section">
      <div class="section-header">6. Tabela de Itens da Licitação</div>
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
          <tbody>
            ${itemsRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5" style="font-size:9pt;letter-spacing:1px;text-transform:uppercase;">Total Estimado</td>
              <td class="td-right" style="font-size:10.5pt;">${formatBRL(totalEstimated > 0 ? totalEstimated.toString() : null)}</td>
            </tr>
          </tfoot>
        </table>
        `
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
