import {
  ImpugnationPointData,
  DocumentAlertData,
} from './bidding-analysis.template';

// ─── Impugnation report data ──────────────────────────────────────────────────
export interface ImpugnationReportData {
  biddingId: string;
  biddingNumber: string | null;
  modality: string | null;
  uasg: string | null;
  agencyName: string | null;
  objectText: string;
  objectSummary: string | null;
  openingDate: Date | null;
  estimatedValue: string | null;
  municipalityName: string | null;
  uf: string | null;

  impugnationPoints: ImpugnationPointData[];
  documentAlerts: DocumentAlertData[];

  // Tenant / company info
  tenantName: string;
  tenantCnpj: string | null;
  tenantAddress: string | null;

  generatedAt: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(date: Date | null): string {
  if (!date) return 'data não informada';
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateLong(date: Date): string {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Main renderer ────────────────────────────────────────────────────────────
export function renderImpugnationTemplate(data: ImpugnationReportData): string {
  const objectSummary =
    data.objectSummary ||
    (data.objectText.length > 400 ? data.objectText.substring(0, 400) + '...' : data.objectText);

  const impugnationPoints = data.impugnationPoints ?? [];
  const hasPoints = impugnationPoints.length > 0;

  // Build the numbered clauses for the petition request
  const clausesList = impugnationPoints
    .map((p, i) => `${i + 1}) ${p.title} — ${p.legalBasis}${p.articleNumber ? `, Art. ${p.articleNumber}` : ''}`)
    .join('\n');

  // Build the points sections HTML
  const pointsSectionsHtml = impugnationPoints
    .map((p, i) => buildPointSection(p, i + 1))
    .join('');

  // Closing request
  const requestList = impugnationPoints
    .map(
      (p, i) =>
        `<li style="margin-bottom:8px;">
          <strong>${i + 1}. ${escapeHtml(p.title)}</strong> — ${escapeHtml(p.legalBasis)}${p.articleNumber ? `, Art. ${escapeHtml(p.articleNumber)}` : ''}
        </li>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Petição de Impugnação — ${escapeHtml(data.biddingNumber ?? 'Edital')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Times New Roman', Georgia, serif;
      font-size: 12pt;
      color: #111;
      background: #fff;
      line-height: 1.6;
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
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 18pt;
      font-weight: 700;
      color: #fff;
      letter-spacing: 3px;
      text-transform: uppercase;
    }

    .cover-logo-sub {
      font-family: 'Segoe UI', Arial, sans-serif;
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
      margin: 32px auto;
      border-radius: 2px;
    }

    .cover-title {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 26pt;
      font-weight: 700;
      color: #fff;
      text-align: center;
      letter-spacing: 2px;
      text-transform: uppercase;
      line-height: 1.25;
      margin-bottom: 8px;
    }

    .cover-subtitle {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 10.5pt;
      color: rgba(255,255,255,0.65);
      text-align: center;
      letter-spacing: 1px;
      margin-bottom: 44px;
    }

    .cover-info-box {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 10px;
      padding: 30px 50px;
      width: 100%;
      max-width: 620px;
      text-align: left;
    }

    .cover-info-row {
      display: flex;
      margin-bottom: 10px;
      font-family: 'Segoe UI', Arial, sans-serif;
    }

    .cover-info-row:last-child { margin-bottom: 0; }

    .cover-info-label {
      font-size: 8.5pt;
      color: rgba(255,255,255,0.5);
      text-transform: uppercase;
      letter-spacing: 1px;
      width: 140px;
      flex-shrink: 0;
      padding-top: 2px;
    }

    .cover-info-value {
      font-size: 10.5pt;
      color: #fff;
      font-weight: 600;
      flex: 1;
    }

    .cover-badge {
      font-family: 'Segoe UI', Arial, sans-serif;
      display: inline-block;
      padding: 6px 18px;
      border-radius: 4px;
      font-size: 10pt;
      font-weight: 700;
      background: #c0392b;
      color: #fff;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .cover-watermark {
      position: absolute;
      bottom: 40px;
      right: 60px;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 9pt;
      color: rgba(255,255,255,0.3);
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    /* ======== BODY ======== */
    .page-body {
      padding: 40px 65px 80px 65px;
    }

    .petition-header {
      text-align: center;
      margin-bottom: 36px;
      padding-bottom: 20px;
      border-bottom: 2px solid #1B365D;
    }

    .petition-header h1 {
      font-size: 15pt;
      font-weight: 700;
      color: #1B365D;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 6px;
    }

    .petition-header .petition-ref {
      font-size: 10pt;
      color: #555;
    }

    .addressee-block {
      background: #f7f9fc;
      border-left: 4px solid #1B365D;
      padding: 14px 20px;
      margin-bottom: 28px;
      font-size: 11pt;
    }

    .addressee-block p { margin-bottom: 4px; }
    .addressee-block strong { color: #1B365D; }

    .petition-intro {
      text-align: justify;
      margin-bottom: 28px;
      font-size: 11pt;
    }

    /* ======== POINTS ======== */
    .point-section {
      margin-bottom: 28px;
      page-break-inside: avoid;
    }

    .point-header {
      background: #1B365D;
      color: #fff;
      padding: 10px 16px;
      border-radius: 4px 4px 0 0;
      font-size: 10.5pt;
      font-weight: 700;
    }

    .point-header-number {
      font-size: 8.5pt;
      color: rgba(255,255,255,0.6);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 3px;
    }

    .point-body {
      border: 1px solid #d0d7e3;
      border-top: none;
      padding: 18px 20px;
      border-radius: 0 0 4px 4px;
    }

    .point-legal-basis {
      font-size: 9.5pt;
      color: #c0392b;
      font-weight: 700;
      margin-bottom: 10px;
      padding: 5px 10px;
      background: #fdf5f5;
      border-radius: 3px;
      display: inline-block;
    }

    .point-description {
      font-size: 11pt;
      text-align: justify;
      margin-bottom: 12px;
      color: #222;
    }

    .point-explanation {
      font-size: 10pt;
      color: #555;
      padding: 10px 14px;
      background: #f7f9fc;
      border-radius: 4px;
      border-left: 3px solid #4A90D9;
    }

    .point-explanation-label {
      font-size: 8.5pt;
      font-weight: 700;
      color: #1B365D;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }

    /* ======== REQUEST ======== */
    .request-section {
      margin-top: 32px;
      padding: 24px;
      background: #f7f9fc;
      border: 1px solid #d0d7e3;
      border-radius: 6px;
    }

    .request-section h2 {
      font-size: 12pt;
      color: #1B365D;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid #d0d7e3;
    }

    .request-section p { font-size: 11pt; text-align: justify; margin-bottom: 10px; }

    .request-section ul { padding-left: 20px; margin-bottom: 14px; font-size: 11pt; }

    /* ======== SIGNATURE ======== */
    .signature-section {
      margin-top: 48px;
      page-break-inside: avoid;
    }

    .signature-location {
      text-align: right;
      margin-bottom: 32px;
      font-size: 11pt;
      color: #333;
    }

    .signature-box {
      display: flex;
      justify-content: center;
    }

    .signature-line-block {
      text-align: center;
      min-width: 320px;
    }

    .signature-line {
      border-bottom: 1px solid #333;
      margin-bottom: 8px;
      height: 60px;
    }

    .signature-name { font-size: 11pt; font-weight: 700; color: #1B365D; }
    .signature-role { font-size: 9.5pt; color: #555; margin-top: 2px; }
    .signature-cnpj { font-size: 9pt; color: #888; margin-top: 2px; }

    /* ======== FOOTER ======== */
    @page {
      margin: 20mm 18mm 25mm 18mm;
    }

    .footer-note {
      margin-top: 40px;
      padding: 14px 20px;
      background: #f7f9fc;
      border: 1px solid #d0d7e3;
      border-radius: 4px;
      font-size: 8.5pt;
      color: #888;
      text-align: center;
      font-family: 'Segoe UI', Arial, sans-serif;
    }

    @media print {
      .cover, .point-header {
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

    <div class="cover-title">Petição de Impugnação ao Edital</div>
    <div class="cover-subtitle">
      Lei nº 14.133/2021 — Art. 164 | Prazo: até 3 dias úteis antes da abertura
    </div>

    <div class="cover-info-box">
      <div class="cover-info-row">
        <div class="cover-info-label">Órgão</div>
        <div class="cover-info-value">${escapeHtml(data.agencyName ?? 'Não identificado')}</div>
      </div>
      <div class="cover-info-row">
        <div class="cover-info-label">UASG</div>
        <div class="cover-info-value">${escapeHtml(data.uasg ?? '—')}</div>
      </div>
      <div class="cover-info-row">
        <div class="cover-info-label">Pregão / Edital</div>
        <div class="cover-info-value">${escapeHtml(data.biddingNumber ?? '—')}</div>
      </div>
      <div class="cover-info-row">
        <div class="cover-info-label">Modalidade</div>
        <div class="cover-info-value">${escapeHtml(data.modality ?? '—')}</div>
      </div>
      <div class="cover-info-row">
        <div class="cover-info-label">Abertura</div>
        <div class="cover-info-value">${formatDate(data.openingDate)}</div>
      </div>
      <div class="cover-info-row">
        <div class="cover-info-label">Impugnante</div>
        <div class="cover-info-value">${escapeHtml(data.tenantName)}</div>
      </div>
      ${
        data.tenantCnpj
          ? `<div class="cover-info-row">
        <div class="cover-info-label">CNPJ</div>
        <div class="cover-info-value">${escapeHtml(data.tenantCnpj)}</div>
      </div>`
          : ''
      }
      <div class="cover-info-row" style="margin-top:16px;">
        <div class="cover-info-label">Gerado em</div>
        <div class="cover-info-value">${formatDate(data.generatedAt)}</div>
      </div>
      <div class="cover-info-row" style="margin-top:12px;">
        <div class="cover-info-label">Pontos</div>
        <div class="cover-info-value">
          <span class="cover-badge">${impugnationPoints.length} ponto(s) identificado(s)</span>
        </div>
      </div>
    </div>

    <div class="cover-watermark">Confidencial — ${escapeHtml(data.tenantName)}</div>
  </div>

  <!-- ============ PETITION BODY ============ -->
  <div class="page-body">

    <!-- Header -->
    <div class="petition-header">
      <h1>Petição de Impugnação ao Edital</h1>
      <div class="petition-ref">
        ${escapeHtml(data.modality ?? 'Pregão Eletrônico')} n° ${escapeHtml(data.biddingNumber ?? '—')} — ${escapeHtml(data.agencyName ?? 'Órgão')}
        ${data.uasg ? `/ UASG ${escapeHtml(data.uasg)}` : ''}
      </div>
    </div>

    <!-- Addressee -->
    <div class="addressee-block">
      <p><strong>Ao(À) Pregoeiro(a) / Comissão de Licitação</strong></p>
      <p><strong>${escapeHtml(data.agencyName ?? 'Órgão Licitante')}</strong></p>
      ${data.uasg ? `<p>UASG: ${escapeHtml(data.uasg)}</p>` : ''}
      ${data.municipalityName || data.uf ? `<p>${escapeHtml([data.municipalityName, data.uf].filter(Boolean).join(' — '))}</p>` : ''}
    </div>

    <!-- Introduction -->
    <div class="petition-intro">
      <p>
        <strong>${escapeHtml(data.tenantName)}</strong>${data.tenantCnpj ? `, inscrita no CNPJ sob o n° <strong>${escapeHtml(data.tenantCnpj)}</strong>` : ''},
        empresa interessada em participar do processo licitatório em referência, vem, respeitosamente,
        perante Vossa Senhoria, com fulcro no <strong>Art. 164 da Lei nº 14.133/2021</strong> (Nova Lei
        de Licitações e Contratos Administrativos), apresentar <strong>IMPUGNAÇÃO AO EDITAL</strong>
        do ${escapeHtml(data.modality ?? 'Pregão Eletrônico')} n° ${escapeHtml(data.biddingNumber ?? '—')}, cujo objeto é:
      </p>
      <p style="margin-top:10px;padding:12px 16px;background:#f7f9fc;border-left:3px solid #1B365D;font-style:italic;color:#444;">
        "${escapeHtml(objectSummary)}"
      </p>
      <p style="margin-top:14px;">
        pelos fundamentos de fato e de direito a seguir expostos:
      </p>
    </div>

    <!-- Points of impugnation -->
    ${
      hasPoints
        ? pointsSectionsHtml
        : `<div style="padding:20px;background:#f7f9fc;border:1px solid #d0d7e3;border-radius:4px;color:#888;font-style:italic;text-align:center;">
            Nenhum ponto de impugnação foi identificado pela análise automatizada para este edital.
          </div>`
    }

    <!-- Request section -->
    <div class="request-section">
      <h2>Do Pedido</h2>

      <p>
        Diante de todo o exposto, requer a empresa <strong>${escapeHtml(data.tenantName)}</strong>:
      </p>

      <p>
        <strong>a)</strong> O recebimento e processamento da presente impugnação, nos termos do
        Art. 164 da Lei nº 14.133/2021;
      </p>

      ${
        hasPoints
          ? `<p>
        <strong>b)</strong> A correção e/ou supressão das cláusulas editalícias irregulares
        identificadas abaixo, com a consequente republicação do edital corrigido:
      </p>
      <ul>${requestList}</ul>`
          : ''
      }

      <p>
        ${hasPoints ? '<strong>c)</strong>' : '<strong>b)</strong>'} A notificação da empresa impugnante sobre a decisão, no prazo legal;
      </p>

      <p>
        ${hasPoints ? '<strong>d)</strong>' : '<strong>c)</strong>'} Caso não acatados os pedidos acima, que seja devidamente motivada e fundamentada a decisão denegatória, para fins de eventual recurso.
      </p>

      <p style="margin-top:16px;">
        Nestes termos, pede deferimento.
      </p>
    </div>

    <!-- Signature -->
    <div class="signature-section">
      <div class="signature-location">
        ${data.tenantAddress ? escapeHtml(data.tenantAddress) + ', ' : ''}${formatDateLong(data.generatedAt)}.
      </div>

      <div class="signature-box">
        <div class="signature-line-block">
          <div class="signature-line"></div>
          <div class="signature-name">${escapeHtml(data.tenantName)}</div>
          <div class="signature-role">Representante Legal</div>
          ${data.tenantCnpj ? `<div class="signature-cnpj">CNPJ: ${escapeHtml(data.tenantCnpj)}</div>` : ''}
        </div>
      </div>
    </div>

    <!-- Footer note -->
    <div class="footer-note">
      <strong style="color:#1B365D;">CONFIDENCIAL — TAED Soluções | Licita IA</strong>&nbsp;&nbsp;|&nbsp;&nbsp;
      Documento gerado automaticamente em ${formatDate(data.generatedAt)}.&nbsp;&nbsp;|&nbsp;&nbsp;
      Este documento é uma minuta gerada por IA e deve ser revisado por profissional jurídico habilitado antes do protocolo.&nbsp;&nbsp;|&nbsp;&nbsp;
      Uso restrito ao cliente ${escapeHtml(data.tenantName)}.
    </div>

  </div>

</body>
</html>`;
}

// ─── Point section builder ────────────────────────────────────────────────────
function buildPointSection(point: ImpugnationPointData, index: number): string {
  return `
    <div class="point-section">
      <div class="point-header">
        <div class="point-header-number">Ponto de Impugnação ${index}</div>
        ${escapeHtml(point.title)}
      </div>
      <div class="point-body">
        <div class="point-legal-basis">
          ⚖ ${escapeHtml(point.legalBasis)}${point.articleNumber ? ` — Art. ${escapeHtml(point.articleNumber)}` : ''}
        </div>

        <div class="point-description">
          ${escapeHtml(point.description)}
        </div>

        ${
          point.explanation
            ? `<div class="point-explanation">
          <div class="point-explanation-label">Em linguagem simples</div>
          ${escapeHtml(point.explanation)}
        </div>`
            : ''
        }
      </div>
    </div>`;
}
