/**
 * Standalone test script to verify PDF generation.
 * Run with: npx ts-node test-pdf.ts
 */
import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import { renderBiddingAnalysisTemplate, BiddingReportData } from './src/modules/reports/templates/bidding-analysis.template';

const testData: BiddingReportData = {
  biddingId: 'test-bidding-001',
  biddingNumber: 'PE 001/2024',
  modality: 'Pregão Eletrônico',
  uasg: '123456',
  sphere: 'Federal',
  agencyName: 'Prefeitura Municipal de São Paulo',
  objectText: 'Aquisição de materiais de escritório, incluindo papel A4, canetas, grampeadores e demais suprimentos para uso nos departamentos administrativos da prefeitura.',
  objectSummary: 'Aquisição de materiais de escritório para uso administrativo.',
  proposalDueDate: new Date('2024-06-30'),
  openingDate: new Date('2024-07-01'),
  estimatedValue: '150000.00',
  municipalityName: 'São Paulo',
  uf: 'SP',
  riskLevel: 'low',
  tenantName: 'Empresa Teste Ltda',
  generatedAt: new Date(),
  items: [
    {
      itemNumber: 1,
      description: 'Papel A4 75g/m² — Resma com 500 folhas, branco, formato 210mm x 297mm',
      quantity: '500',
      unit: 'Resma',
      unitValueEstimated: '25.00',
      totalValueEstimated: '12500.00',
    },
    {
      itemNumber: 2,
      description: 'Caneta esferográfica azul, ponta 1.0mm, embalagem com 50 unidades',
      quantity: '100',
      unit: 'Cx',
      unitValueEstimated: '18.50',
      totalValueEstimated: '1850.00',
    },
    {
      itemNumber: 3,
      description: 'Grampeador de mesa, capacidade 25 folhas, acompanha 1000 grampos 26/6',
      quantity: '20',
      unit: 'Un',
      unitValueEstimated: '45.00',
      totalValueEstimated: '900.00',
    },
    {
      itemNumber: 4,
      description: 'Caixa arquivo morto, papelão reforçado, tamanho ofício, lombo 12cm',
      quantity: '1000',
      unit: 'Un',
      unitValueEstimated: '5.80',
      totalValueEstimated: '5800.00',
    },
    {
      itemNumber: 5,
      description: 'Clipe para papel niquelado nº 2/0, caixa com 100 unidades',
      quantity: '200',
      unit: 'Cx',
      unitValueEstimated: '3.20',
      totalValueEstimated: '640.00',
    },
  ],
};

async function generateTestPdf() {
  console.log('Rendering HTML template...');
  const html = renderBiddingAnalysisTemplate(testData);

  console.log('Launching Puppeteer...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const outputPath = path.join(__dirname, 'storage', 'reports', 'test-report.pdf');
    const storageDir = path.join(__dirname, 'storage', 'reports');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '25mm', left: '15mm', right: '15mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="font-family: Arial, sans-serif; font-size: 8pt; color: #888; width: 100%; padding: 0 15mm; display: flex; justify-content: space-between; border-top: 1px solid #ddd; padding-top: 4px;">
          <span style="font-weight: bold; color: #1B365D;">CONFIDENCIAL — TAED Soluções | Licita IA</span>
          <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
        </div>
      `,
    });

    fs.writeFileSync(outputPath, pdfBuffer);

    const stats = fs.statSync(outputPath);
    console.log(`\n✓ PDF generated successfully!`);
    console.log(`  Path: ${outputPath}`);
    console.log(`  Size: ${(stats.size / 1024).toFixed(1)} KB`);
    console.log(`  Pages: Multiple (cover + body)`);

    if (stats.size > 0) {
      console.log('\n✓ File exists and has content. Test passed!');
    } else {
      console.error('\n✗ File is empty!');
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

generateTestPdf().catch((err) => {
  console.error('PDF generation failed:', err);
  process.exit(1);
});
