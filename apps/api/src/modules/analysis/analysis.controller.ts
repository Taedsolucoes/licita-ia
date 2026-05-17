import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Res,
  Optional,
  Inject,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as path from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AnalysisService } from './analysis.service';
import { ReportsService } from '../reports/reports.service';
import { QUEUE_NAMES } from '../queue/queue.module';

interface AnalyzeBodyDto {
  opportunityId?: string;
  tenantId?: string;
  biddingId?: string;
  editalUrl?: string;
  editalContent?: string;
}

@Controller('analysis')
export class AnalysisController {
  private readonly logger = new Logger(AnalysisController.name);

  constructor(
    private analysisService: AnalysisService,
    private reportsService: ReportsService,
    @Optional() @Inject(getQueueToken(QUEUE_NAMES.ANALYSIS)) private analysisQueue: Queue | null,
  ) {}

  // ─── GET: list analyses (with optional tenantId filter) ──────────────────────

  @Get()
  async listAnalyses(@Query('tenantId') tenantId?: string) {
    return this.analysisService.listAnalyses(tenantId);
  }

  // ─── GET: fetch analysis by bidding ─────────────────────────────────────────

  @Get('biddings/:biddingId')
  async getAnalysis(@Param('biddingId', ParseUUIDPipe) biddingId: string) {
    return this.analysisService.getAnalysisByBiddingId(biddingId);
  }

  // ─── POST: send analysis to tenant ───────────────────────────────────────────

  @Post(':id/send-to-tenant')
  @HttpCode(HttpStatus.OK)
  async sendToTenant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { tenantId: string },
  ) {
    return this.analysisService.sendToTenant(id, body.tenantId);
  }

  // ─── GET: fetch analysis by id ───────────────────────────────────────────────

  @Get(':id')
  async getAnalysisById(@Param('id', ParseUUIDPipe) id: string) {
    return this.analysisService.getAnalysisById(id);
  }

  // ─── GET: generate PDF from analysis ────────────────────────────────────────

  @Get(':id/pdf')
  async getAnalysisPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const analysis = await this.analysisService.getAnalysisById(id);
    const biddingId = analysis.biddingId;

    const fileName = `analise-${id.substring(0, 8)}-${Date.now()}.pdf`;

    try {
      const pdfBuffer = await this.reportsService.generateAnalysisPdfBuffer(biddingId, analysis);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length,
      });
      res.end(pdfBuffer);
    } catch (err) {
      throw new BadRequestException(
        `Falha ao gerar PDF: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ─── POST: trigger async analysis for a bidding ──────────────────────────────

  @Post('biddings/:biddingId/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  async generateAnalysis(@Param('biddingId', ParseUUIDPipe) biddingId: string) {
    if (this.analysisQueue) {
      const job = await this.analysisQueue.add(
        'analyze-edital',
        { biddingId },
        { attempts: 3, backoff: { type: 'exponential', delay: 10000 } },
      );
      return { jobId: job.id, biddingId, status: 'queued' };
    }
    // Fallback: run analysis synchronously if queue is not available
    await this.analysisService.analyzeEdital(biddingId);
    return { biddingId, status: 'completed' };
  }

  // ─── POST: analyze by opportunityId/tenantId/biddingId or raw content ────────

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  async analyze(@Body() dto: AnalyzeBodyDto) {
    // Case 1: biddingId — use existing bidding in DB
    if (dto.biddingId) {
      await this.analysisService.analyzeEdital(dto.biddingId);
      const result = await this.analysisService.getAnalysisByBiddingId(dto.biddingId);
      return result;
    }

    // Case 2: raw edital content
    if (dto.editalContent) {
      const result = await this.analysisService.analyzeFromText(dto.editalContent, {
        opportunityId: dto.opportunityId,
        tenantId: dto.tenantId,
      });
      return result;
    }

    // Case 3: editalUrl — fetch and analyze
    if (dto.editalUrl) {
      let content: string;
      try {
        const resp = await fetch(dto.editalUrl, { signal: AbortSignal.timeout(30000) });
        content = await resp.text();
      } catch (err) {
        throw new BadRequestException(
          `Falha ao buscar edital da URL: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      const result = await this.analysisService.analyzeFromText(content, {
        opportunityId: dto.opportunityId,
        tenantId: dto.tenantId,
      });
      return result;
    }

    throw new BadRequestException(
      'Informe biddingId, editalContent ou editalUrl para análise.',
    );
  }

  // ─── POST: upload PDF/DOCX and analyze ───────────────────────────────────────

  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
      fileFilter: (_req, file: { originalname: string }, cb: (err: Error | null, accept: boolean) => void) => {
        const allowed = ['.pdf', '.docx', '.doc', '.txt'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`Tipo de arquivo não suportado: ${ext}`), false);
        }
      },
    }),
  )
  async uploadAndAnalyze(
    @UploadedFile() file: { originalname: string; buffer: Buffer; size: number; mimetype: string } | undefined,
    @Body() body: { opportunityId?: string; tenantId?: string; biddingId?: string },
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }

    // Extract text from the uploaded file
    let content: string;
    const ext = path.extname(file.originalname).toLowerCase();

    if (ext === '.txt') {
      content = file.buffer.toString('utf-8');
    } else if (ext === '.pdf') {
      // Use pdf-parse for proper text extraction
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(file.buffer);
        content = data.text ?? '';
        this.logger.log(`Texto extraído do PDF (${file.originalname}): ${content.substring(0, 500)}...`);
      } catch (err) {
        this.logger.error(`pdf-parse falhou: ${err instanceof Error ? err.message : String(err)}`);
        content = '';
      }
      if (!content || content.trim().length < 100) {
        content = `[Arquivo PDF: ${file.originalname}]\n\nConteúdo não pôde ser extraído automaticamente.\n\nTamanho: ${(file.size / 1024).toFixed(1)} KB`;
      }
    } else if (ext === '.docx' || ext === '.doc') {
      // Use mammoth for DOCX extraction
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        content = result.value ?? '';
        this.logger.log(`Texto extraído do DOCX (${file.originalname}): ${content.substring(0, 500)}...`);
      } catch (err) {
        this.logger.error(`mammoth falhou: ${err instanceof Error ? err.message : String(err)}`);
        content = '';
      }
      if (!content || content.trim().length < 100) {
        content = `[Arquivo DOCX: ${file.originalname}]\n\nConteúdo extraído do documento Word.\n\nTamanho: ${(file.size / 1024).toFixed(1)} KB`;
      }
    } else {
      content = file.buffer.toString('utf-8');
    }

    const result = await this.analysisService.analyzeFromText(content, {
      opportunityId: body.opportunityId,
      tenantId: body.tenantId,
      biddingId: body.biddingId,
    });

    // Save analysis to DB and get the id back
    const savedId = await this.analysisService.saveUploadAnalysis(result);

    // Get compatible companies (computed server-side)
    const compatibleCompanies = await this.analysisService.computeCompatibleCompanies(result);

    return {
      id: savedId,
      fileName: file.originalname,
      fileSize: file.size,
      contentLength: content.length,
      analysis: {
        ...result,
        compatibleCompanies,
      },
    };
  }
}
