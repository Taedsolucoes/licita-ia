import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import puppeteer from 'puppeteer';
import type { BiddingItem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_NAMES } from '../queue/queue.module';
import {
  renderBiddingAnalysisTemplate,
  BiddingReportData,
  DocumentAlertData,
  ImpugnationPointData,
  PaymentConditionsData,
  AdditionalDocumentData,
  ItemAnalysisData,
} from './templates/bidding-analysis.template';
import {
  renderImpugnationTemplate,
  ImpugnationReportData,
} from './templates/impugnation.template';

export interface ReportJobData {
  biddingId: string;
  tenantId: string;
  opportunityId?: string;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly storageDir: string;

  constructor(
    private prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.REPORTS) private reportsQueue: Queue,
  ) {
    this.storageDir = path.join(process.cwd(), 'storage', 'reports');
    this.ensureStorageDir();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
      this.logger.log(`Created storage directory: ${this.storageDir}`);
    }
  }

  /**
   * Schedule async report generation for a bidding+tenant combination.
   * Creates the report metadata record in 'queued' state.
   */
  async scheduleReport(
    biddingId: string,
    tenantId: string,
    opportunityId?: string,
  ): Promise<{ reportId: string; jobId: string }> {
    // Avoid duplicate queued/processing reports
    const existing = await this.prisma.report.findFirst({
      where: {
        biddingId,
        tenantId,
        status: { in: ['queued', 'processing', 'ready'] },
      },
    });

    if (existing) {
      this.logger.debug(
        `Report already exists for bidding=${biddingId} tenant=${tenantId}: id=${existing.id} status=${existing.status}`,
      );
      return { reportId: existing.id, jobId: 'existing' };
    }

    const report = await this.prisma.report.create({
      data: {
        tenantId,
        biddingId,
        opportunityId: opportunityId ?? null,
        reportType: 'bidding_analysis',
        status: 'queued',
        createdBySystem: true,
      },
    });

    const job = await this.reportsQueue.add(
      'generate-report',
      {
        biddingId,
        tenantId,
        opportunityId,
        reportId: report.id,
      } satisfies ReportJobData & { reportId: string },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    this.logger.log(
      `Scheduled report generation: reportId=${report.id} jobId=${job.id} bidding=${biddingId} tenant=${tenantId}`,
    );

    return { reportId: report.id, jobId: String(job.id) };
  }

  /**
   * Core method: generate a PDF from bidding data and save to filesystem.
   * Called by the BullMQ processor.
   */
  async generateReport(
    reportId: string,
    biddingId: string,
    tenantId: string,
    opportunityId?: string,
  ): Promise<void> {
    this.logger.log(`Generating report ${reportId} for bidding=${biddingId} tenant=${tenantId}`);

    // Mark as processing
    await this.prisma.report.update({
      where: { id: reportId },
      data: { status: 'processing' },
    });

    try {
      // Fetch bidding with items
      const bidding = await this.prisma.bidding.findUnique({
        where: { id: biddingId },
        include: {
          items: {
            orderBy: { itemNumber: 'asc' },
          },
        },
      });

      if (!bidding) {
        throw new Error(`Bidding ${biddingId} not found`);
      }

      // Fetch analysis (optional — render gracefully if not yet run)
      const analysis = await this.prisma.biddingAnalysis.findUnique({
        where: { biddingId },
      });

      // Fetch tenant
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { tradeName: true, corporateName: true, cnpj: true },
      });

      const tenantName = tenant?.tradeName || tenant?.corporateName || 'Cliente';
      const tenantCnpj = tenant?.cnpj ?? null;

      // Parse JSON fields from analysis (stored as Prisma Json)
      const documentAlerts = parseJsonArray<DocumentAlertData>(analysis?.documentAlerts);
      const impugnationPoints = parseJsonArray<ImpugnationPointData>(analysis?.impugnationPoints);
      const paymentConditions = parseJsonObject<PaymentConditionsData>(analysis?.paymentConditions);
      const rawAnalysis = analysis?.rawAnalysis as Record<string, unknown> | null | undefined;
      const deliveryLocations = extractDeliveryLocations(rawAnalysis);

      // Build report data
      const reportData: BiddingReportData = {
        biddingId: bidding.id,
        biddingNumber: bidding.biddingNumber,
        modality: bidding.modality,
        uasg: bidding.uasg,
        sphere: bidding.sphere,
        agencyName: bidding.agencyName,
        objectText: bidding.objectText,
        objectSummary: bidding.objectSummary,
        proposalDueDate: bidding.proposalDueDate,
        openingDate: bidding.openingDate,
        estimatedValue: bidding.estimatedValue?.toString() ?? null,
        municipalityName: bidding.municipalityName,
        uf: bidding.uf,
        riskLevel: analysis?.riskLevel ?? bidding.riskLevel,
        judgmentCriteria: extractJudgmentCriteria(rawAnalysis),
        items: bidding.items.map((item: BiddingItem) => ({
          itemNumber: item.itemNumber,
          description: item.description,
          quantity: item.quantity.toString(),
          unit: item.unit,
          unitValueEstimated: item.unitValueEstimated?.toString() ?? null,
          totalValueEstimated: item.totalValueEstimated?.toString() ?? null,
        })),
        // Analysis fields
        executiveSummary: analysis?.executiveSummary ?? null,
        documentAlerts,
        impugnationPoints,
        paymentConditions,
        guaranteeContractual: analysis?.guaranteeContractual ?? null,
        guaranteeObject: analysis?.guaranteeObject ?? null,
        analysisRecommendation: analysis?.recommendation ?? null,
        deliveryLocation: analysis?.deliveryLocation ?? null,
        deliveryDeadline: analysis?.deliveryDeadline ?? null,
        deliveryLocations,
        additionalDocuments: buildAdditionalDocuments(documentAlerts),
        objectCategory: extractObjectCategory(rawAnalysis),
        objectCategoryType: extractObjectCategoryType(rawAnalysis),
        itemAnalysis: [],
        tenantName,
        tenantCnpj,
        generatedAt: new Date(),
      };

      // Render HTML
      const html = renderBiddingAnalysisTemplate(reportData);

      // Generate PDF via Puppeteer
      const pdfBuffer = await this.renderHtmlToPdf(html);

      // Generate checksum
      const checksum = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

      // Save to filesystem
      const fileName = `relatorio-${biddingId.substring(0, 8)}-${Date.now()}.pdf`;
      const storageKey = fileName;
      const filePath = path.join(this.storageDir, fileName);

      fs.writeFileSync(filePath, pdfBuffer);

      const fileSize = pdfBuffer.length;
      this.logger.log(
        `PDF saved: ${filePath} (${(fileSize / 1024).toFixed(1)} KB) checksum=${checksum.substring(0, 16)}...`,
      );

      // Update report record
      await this.prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'ready',
          storageKey,
          fileName,
          checksum,
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });

      // Mark opportunity analysis_completed_at if provided
      if (opportunityId) {
        await this.prisma.opportunity.update({
          where: { id: opportunityId },
          data: { analysisCompletedAt: new Date() },
        });
      }

      this.logger.log(`Report ${reportId} generated successfully`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Report ${reportId} generation failed: ${errorMsg}`);

      await this.prisma.report.update({
        where: { id: reportId },
        data: { status: 'failed' },
      });

      throw error;
    }
  }

  /**
   * Generate an impugnation PDF synchronously and return the buffer.
   * The PDF is also persisted to disk and its record saved to the reports table.
   */
  async generateImpugnationPdf(
    biddingId: string,
    tenantId: string,
  ): Promise<{ filePath: string; fileName: string; pdfBuffer: Buffer }> {
    this.logger.log(`Generating impugnation PDF for bidding=${biddingId} tenant=${tenantId}`);

    // Fetch bidding
    const bidding = await this.prisma.bidding.findUnique({
      where: { id: biddingId },
    });

    if (!bidding) {
      throw new NotFoundException(`Bidding ${biddingId} not found`);
    }

    // Fetch analysis — impugnation PDF requires it
    const analysis = await this.prisma.biddingAnalysis.findUnique({
      where: { biddingId },
    });

    // Fetch tenant
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { tradeName: true, corporateName: true, cnpj: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const tenantName = tenant.tradeName || tenant.corporateName || 'Cliente';

    const impugnationPoints = parseJsonArray<ImpugnationPointData>(analysis?.impugnationPoints);
    const documentAlerts = parseJsonArray<DocumentAlertData>(analysis?.documentAlerts);

    const reportData: ImpugnationReportData = {
      biddingId: bidding.id,
      biddingNumber: bidding.biddingNumber,
      modality: bidding.modality,
      uasg: bidding.uasg,
      agencyName: bidding.agencyName,
      objectText: bidding.objectText,
      objectSummary: bidding.objectSummary,
      openingDate: bidding.openingDate,
      estimatedValue: bidding.estimatedValue?.toString() ?? null,
      municipalityName: bidding.municipalityName,
      uf: bidding.uf,
      impugnationPoints,
      documentAlerts,
      tenantName,
      tenantCnpj: tenant.cnpj ?? null,
      tenantAddress: null,
      generatedAt: new Date(),
    };

    const html = renderImpugnationTemplate(reportData);
    const pdfBuffer = await this.renderHtmlToPdf(html);

    const fileName = `impugnacao-${biddingId.substring(0, 8)}-${Date.now()}.pdf`;
    const filePath = path.join(this.storageDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    const checksum = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    // Persist report record
    await this.prisma.report.create({
      data: {
        tenantId,
        biddingId,
        reportType: 'impugnation',
        status: 'ready',
        storageKey: fileName,
        fileName,
        checksum,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdBySystem: false,
      },
    });

    this.logger.log(
      `Impugnation PDF saved: ${filePath} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`,
    );

    return { filePath, fileName, pdfBuffer };
  }

  /**
   * Get report metadata by ID with tenant access check.
   */
  async getReport(reportId: string, tenantId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }
    if (report.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied');
    }

    return report;
  }

  /**
   * Stream a PDF file for download, registering audit in report_downloads.
   */
  async downloadReport(
    reportId: string,
    tenantId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ filePath: string; fileName: string }> {
    const report = await this.getReport(reportId, tenantId);

    if (report.status !== 'ready') {
      throw new NotFoundException(
        `Report is not ready yet. Current status: ${report.status}`,
      );
    }

    if (!report.storageKey) {
      throw new NotFoundException('Report file not found');
    }

    const filePath = path.join(this.storageDir, report.storageKey);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Report file missing from storage');
    }

    // Register download
    await this.prisma.reportDownload.create({
      data: {
        reportId,
        userId,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });

    return { filePath, fileName: report.fileName ?? `relatorio-${reportId}.pdf` };
  }

  /**
   * Find report by opportunity ID.
   */
  async findByOpportunity(opportunityId: string, tenantId: string) {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }
    if (opportunity.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied');
    }

    const report = await this.prisma.report.findFirst({
      where: {
        opportunityId,
        tenantId,
        status: { not: 'failed' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!report) {
      throw new NotFoundException('No report found for this opportunity');
    }

    return report;
  }

  /**
   * Generate a PDF buffer directly from an analysis object (for on-demand /pdf endpoint).
   */
  async generateAnalysisPdfBuffer(
    biddingId: string | null | undefined,
    analysis: {
      id: string;
      biddingId: string | null;
      riskLevel: string;
      recommendation: string;
      executiveSummary: string;
      documentAlerts: unknown;
      impugnationPoints: unknown;
      paymentConditions: unknown;
      guaranteeContractual: string | null;
      guaranteeObject: string | null;
      objectDescription: string | null;
      deliveryLocation: string | null;
      deliveryDeadline: string | null;
      bidding?: {
        biddingNumber: string | null;
        modality: string | null;
        uasg: string | null;
        sphere: string | null;
        agencyName: string | null;
        objectText: string;
        objectSummary: string | null;
        proposalDueDate: Date | null;
        openingDate: Date | null;
        estimatedValue: unknown;
        municipalityName: string | null;
        uf: string | null;
        items?: BiddingItem[];
      } | null;
    },
  ): Promise<Buffer> {
    if (!biddingId) {
      throw new NotFoundException('Bidding ID is required to generate analysis PDF');
    }

    // Fetch bidding if not preloaded
    const bidding = analysis.bidding ?? await this.prisma.bidding.findUnique({
      where: { id: biddingId },
      include: { items: { orderBy: { itemNumber: 'asc' } } },
    });

    if (!bidding) {
      throw new NotFoundException(`Bidding ${biddingId} not found`);
    }

    const items = (bidding.items ?? []) as BiddingItem[];

    const documentAlerts = parseJsonArray<DocumentAlertData>(analysis.documentAlerts);
    const impugnationPoints = parseJsonArray<ImpugnationPointData>(analysis.impugnationPoints);
    const paymentConditions = parseJsonObject<PaymentConditionsData>(analysis.paymentConditions);

    const reportData: BiddingReportData = {
      biddingId,
      biddingNumber: bidding.biddingNumber ?? null,
      modality: bidding.modality ?? null,
      uasg: bidding.uasg ?? null,
      sphere: bidding.sphere ?? null,
      agencyName: bidding.agencyName ?? null,
      objectText: bidding.objectText,
      objectSummary: bidding.objectSummary ?? null,
      proposalDueDate: bidding.proposalDueDate ?? null,
      openingDate: bidding.openingDate ?? null,
      estimatedValue: bidding.estimatedValue != null ? String(bidding.estimatedValue) : null,
      municipalityName: bidding.municipalityName ?? null,
      uf: bidding.uf ?? null,
      riskLevel: analysis.riskLevel,
      judgmentCriteria: null,
      items: items.map((item: BiddingItem) => ({
        itemNumber: item.itemNumber,
        description: item.description,
        quantity: item.quantity.toString(),
        unit: item.unit,
        unitValueEstimated: item.unitValueEstimated?.toString() ?? null,
        totalValueEstimated: item.totalValueEstimated?.toString() ?? null,
      })),
      executiveSummary: analysis.executiveSummary,
      documentAlerts,
      impugnationPoints,
      paymentConditions,
      guaranteeContractual: analysis.guaranteeContractual,
      guaranteeObject: analysis.guaranteeObject,
      analysisRecommendation: analysis.recommendation,
      deliveryLocation: analysis.deliveryLocation,
      deliveryDeadline: analysis.deliveryDeadline,
      deliveryLocations: [],
      additionalDocuments: buildAdditionalDocuments(documentAlerts),
      objectCategory: null,
      objectCategoryType: null,
      itemAnalysis: [],
      tenantName: 'LicitaIA',
      tenantCnpj: null,
      generatedAt: new Date(),
    };

    const html = renderBiddingAnalysisTemplate(reportData);
    return this.renderHtmlToPdf(html);
  }

  /**
   * Render HTML string to PDF buffer using Puppeteer.
   */
  private async renderHtmlToPdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          bottom: '24mm',
          left: '10mm',
          right: '10mm',
        },
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: `
          <div style="font-family: Inter, Arial, sans-serif; font-size: 7.5pt; color: #6B7280; width: 100%; padding: 0 10mm; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 700; color: #1B3A6B;">LicitaIA — Inteligência em Licitações</span>
            <span>Relatório Técnico Inteligente</span>
            <span>Sistema LicitaIA — Página <span class="pageNumber" style="font-weight:700;color:#1B3A6B;"></span> de <span class="totalPages" style="font-weight:700;color:#1B3A6B;"></span></span>
          </div>
        `,
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }
}

// ─── JSON parse helpers ───────────────────────────────────────────────────────

function parseJsonArray<T>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonObject<T>(value: unknown): T | null {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value as T;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as T) : null;
    } catch {
      return null;
    }
  }
  return null;
}

// ─── Report data enrichment helpers ──────────────────────────────────────────

function extractDeliveryLocations(rawAnalysis: Record<string, unknown> | null | undefined): string[] {
  if (!rawAnalysis) return [];
  try {
    const basicInfo = rawAnalysis['basicInfo'] as Record<string, unknown> | undefined;
    const locs = basicInfo?.['locais_entrega'] as Array<Record<string, string>> | undefined;
    if (Array.isArray(locs) && locs.length > 0) {
      return locs.map((l) => {
        const addr = l['endereco_completo'] ?? '';
        const city = l['cidade_uf'] ?? '';
        return city ? `${addr} — ${city}` : addr;
      }).filter(Boolean);
    }
    const local = basicInfo?.['local_execucao'] as string | undefined;
    return local ? [local] : [];
  } catch {
    return [];
  }
}

function extractJudgmentCriteria(rawAnalysis: Record<string, unknown> | null | undefined): string | null {
  if (!rawAnalysis) return null;
  try {
    const basicInfo = rawAnalysis['basicInfo'] as Record<string, unknown> | undefined;
    return (basicInfo?.['criterio_julgamento'] as string) ?? null;
  } catch {
    return null;
  }
}

function extractObjectCategory(rawAnalysis: Record<string, unknown> | null | undefined): string | null {
  if (!rawAnalysis) return null;
  try {
    const basicInfo = rawAnalysis['basicInfo'] as Record<string, unknown> | undefined;
    return (basicInfo?.['categoria_objeto'] as string) ??
           (basicInfo?.['especificacao_servico'] as string)?.split(' ').slice(0, 3).join(' ') ?? null;
  } catch {
    return null;
  }
}

function extractObjectCategoryType(rawAnalysis: Record<string, unknown> | null | undefined): string | null {
  if (!rawAnalysis) return null;
  try {
    const basicInfo = rawAnalysis['basicInfo'] as Record<string, unknown> | undefined;
    return (basicInfo?.['tipo_objeto'] as string) ?? null;
  } catch {
    return null;
  }
}

function buildAdditionalDocuments(documentAlerts: DocumentAlertData[]): AdditionalDocumentData[] {
  return documentAlerts.map((a) => ({
    name: a.document,
    description: a.reason,
    legalBasis: a.item,
    status: 'nao_possui',
  }));
}
