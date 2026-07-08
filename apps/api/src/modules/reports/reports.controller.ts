import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request } from 'express';
import * as fs from 'fs';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';

interface AuthUser {
  id: string;
  tenantId: string;
  role: string;
  email: string;
}

@Controller()
@UseGuards(AuthGuard('jwt'))
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  /**
   * POST /reports/biddings/:id/generate
   * Schedules async PDF generation for a bidding.
   */
  @Post('reports/biddings/:id/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  async scheduleGenerate(
    @Param('id') biddingId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.reportsService.scheduleReport(
      biddingId,
      user.tenantId,
    );
    return {
      message: 'Report generation scheduled',
      ...result,
    };
  }

  /**
   * GET /reports/:id
   * Returns report metadata.
   */
  @Get('reports/:id')
  async getReport(
    @Param('id') reportId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reportsService.getReport(reportId, user.tenantId);
  }

  /**
   * GET /reports/:id/download
   * Streams the PDF file and registers download audit.
   */
  @Get('reports/:id/download')
  async downloadReport(
    @Param('id') reportId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    const { filePath, fileName } = await this.reportsService.downloadReport(
      reportId,
      user.tenantId,
      user.id,
      ipAddress,
      userAgent,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

    stream.on('error', (_err) => {
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming file', statusCode: 500 });
      }
    });
  }

  /**
   * POST /reports/biddings/:id/impugnation
   * Generates an impugnation PDF synchronously and streams it to the client.
   */
  @Post('reports/biddings/:id/impugnation')
  async generateImpugnation(
    @Param('id') biddingId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const { pdfBuffer, fileName } = await this.reportsService.generateImpugnationPdf(
      biddingId,
      user.tenantId,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(pdfBuffer);
  }

  /**
   * GET /opportunities/:id/report
   * Returns the latest ready report for an opportunity.
   */
  @Get('opportunities/:id/report')
  async getOpportunityReport(
    @Param('id') opportunityId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reportsService.findByOpportunity(opportunityId, user.tenantId);
  }
}
