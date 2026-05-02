import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

interface ParticipacaoSummary {
  totalOportunidades: number;
  participou: number;
  ganhou: number;
  pctParticipou: number;
  pctGanhou: number;
}

interface DashboardSummary {
  participacao: ParticipacaoSummary;
  valorTotalGanho: Decimal | number;
  perfilBusca: object | null;
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(tenantId: string): Promise<DashboardSummary> {
    const [
      totalOportunidades,
      totalParticipou,
      totalGanhou,
      valorGanho,
      perfilBusca,
    ] = await Promise.all([
      this.prisma.opportunity.count({ where: { tenantId } }),
      this.prisma.participation.count({ where: { tenantId } }),
      this.prisma.result.count({ where: { tenantId, status: 'ganhou' } }),
      this.prisma.result.aggregate({
        where: { tenantId, status: 'ganhou' },
        _sum: { valorContrato: true },
      }),
      this.prisma.companyFilter.findUnique({ where: { tenantId } }),
    ]);

    const pctParticipou = totalOportunidades > 0
      ? Math.round((totalParticipou / totalOportunidades) * 100)
      : 0;
    const pctGanhou = totalParticipou > 0
      ? Math.round((totalGanhou / totalParticipou) * 100)
      : 0;

    return {
      participacao: {
        totalOportunidades,
        participou: totalParticipou,
        ganhou: totalGanhou,
        pctParticipou,
        pctGanhou,
      },
      valorTotalGanho: valorGanho._sum.valorContrato ?? 0,
      perfilBusca,
    };
  }

  async getDocuments(tenantId: string): Promise<object[]> {
    return this.prisma.document.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getResults(tenantId: string): Promise<object[]> {
    const results = await this.prisma.result.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = await Promise.all(
      results.map(async (result) => {
        let bidding = null;
        if (result.biddingId) {
          bidding = await this.prisma.bidding.findUnique({
            where: { id: result.biddingId },
            select: {
              id: true,
              biddingNumber: true,
              agencyName: true,
              objectSummary: true,
              estimatedValue: true,
              uf: true,
              municipalityName: true,
              openingDate: true,
            },
          });
        }
        return { ...result, bidding };
      }),
    );

    return enriched;
  }
}
