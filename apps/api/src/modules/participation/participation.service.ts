import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_NAMES } from '../queue/queue.module';
import { UpdateParticipationItemsDto } from './dto/participation.dto';

@Injectable()
export class ParticipationService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private notificationsQueue: Queue,
  ) {}

  async participate(opportunityId: string, userId: string, tenantId: string) {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { bidding: true },
    });

    if (!opportunity) throw new NotFoundException('Opportunity not found');
    if (opportunity.tenantId !== tenantId) throw new ForbiddenException('Access denied');

    const existing = await this.prisma.participation.findUnique({
      where: { opportunityId },
    });
    if (existing) throw new ConflictException('Already participating in this opportunity');

    // Update opportunity status
    await this.prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: 'accepted' },
    });

    const participation = await this.prisma.participation.create({
      data: {
        tenantId,
        opportunityId,
        acceptedByUserId: userId,
        status: 'draft',
      },
      include: {
        opportunity: {
          include: {
            bidding: {
              select: {
                id: true,
                biddingNumber: true,
                agencyName: true,
                objectSummary: true,
              },
            },
          },
        },
      },
    });

    return participation;
  }

  async decline(opportunityId: string, tenantId: string) {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opportunity) throw new NotFoundException('Opportunity not found');
    if (opportunity.tenantId !== tenantId) throw new ForbiddenException('Access denied');

    await this.prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: 'declined' },
    });

    return { message: 'Opportunity declined' };
  }

  async getById(participationId: string, tenantId: string, isAdmin = false) {
    const participation = await this.prisma.participation.findUnique({
      where: { id: participationId },
      include: {
        opportunity: {
          include: {
            bidding: { include: { items: true } },
          },
        },
        items: {
          include: {
            biddingItem: true,
          },
        },
        acceptedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (!participation) throw new NotFoundException('Participation not found');
    if (!isAdmin && participation.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied');
    }

    return participation;
  }

  async updateItems(
    participationId: string,
    tenantId: string,
    dto: UpdateParticipationItemsDto,
  ) {
    const participation = await this.prisma.participation.findUnique({
      where: { id: participationId },
    });
    if (!participation) throw new NotFoundException('Participation not found');
    if (participation.tenantId !== tenantId) throw new ForbiddenException('Access denied');
    if (participation.status === 'submitted_to_taed') {
      throw new BadRequestException('Cannot edit items after submission');
    }

    if (dto.items.length === 0) {
      throw new BadRequestException('At least one item is required');
    }

    // Validate bidding items belong to the opportunity's bidding
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: participation.opportunityId },
      select: { biddingId: true },
    });
    if (!opportunity) throw new NotFoundException('Opportunity not found');

    const biddingItemIds = dto.items.map((i) => i.biddingItemId);
    const biddingItems = await this.prisma.biddingItem.findMany({
      where: { id: { in: biddingItemIds }, biddingId: opportunity.biddingId },
    });
    if (biddingItems.length !== biddingItemIds.length) {
      throw new BadRequestException('One or more item IDs are invalid');
    }

    // Upsert participation items and recalculate total
    let totalValue = 0;

    await this.prisma.$transaction(async (tx) => {
      // Delete existing items for clean re-save
      await tx.participationItem.deleteMany({ where: { participationId } });

      for (const item of dto.items) {
        const biddingItem = biddingItems.find((bi) => bi.id === item.biddingItemId);
        if (!biddingItem) continue;

        const qty = Number(biddingItem.quantity);
        const finalTotal = item.finalUnitPrice * qty;
        totalValue += finalTotal;

        await tx.participationItem.create({
          data: {
            participationId,
            biddingItemId: item.biddingItemId,
            brand: item.brand,
            finalUnitPrice: item.finalUnitPrice,
            quantity: qty,
            finalTotalPrice: finalTotal,
          },
        });
      }

      await tx.participation.update({
        where: { id: participationId },
        data: { consolidatedTotalValue: totalValue },
      });
    });

    return this.prisma.participation.findUnique({
      where: { id: participationId },
      include: { items: { include: { biddingItem: true } } },
    });
  }

  async submit(participationId: string, tenantId: string) {
    const participation = await this.prisma.participation.findUnique({
      where: { id: participationId },
      include: {
        items: true,
        tenant: true,
        opportunity: {
          include: { bidding: true },
        },
      },
    });

    if (!participation) throw new NotFoundException('Participation not found');
    if (participation.tenantId !== tenantId) throw new ForbiddenException('Access denied');
    if (participation.status === 'submitted_to_taed') {
      throw new BadRequestException('Participation already submitted');
    }
    if (participation.items.length === 0) {
      throw new BadRequestException('Cannot submit without items');
    }

    const now = new Date();

    // Update status
    const updated = await this.prisma.participation.update({
      where: { id: participationId },
      data: {
        status: 'submitted_to_taed',
        submittedAt: now,
        taedNotifiedAt: now,
      },
    });

    // Find admin users to notify
    const adminUsers = await this.prisma.user.findMany({
      where: { role: { in: ['taed_admin', 'taed_operator'] }, isActive: true },
      select: { id: true, tenantId: true },
    });

    // Publish notification job for each admin user
    for (const adminUser of adminUsers) {
      await this.notificationsQueue.add('proposal-submitted', {
        type: 'proposal_submitted',
        participationId,
        tenantId,
        tenantName: participation.tenant.corporateName,
        opportunityId: participation.opportunityId,
        biddingNumber: participation.opportunity.bidding.biddingNumber,
        consolidatedTotalValue: participation.consolidatedTotalValue,
        recipientUserId: adminUser.id,
        channel: 'push',
      });
    }

    return updated;
  }

  async listParticipations(
    tenantId: string | null,
    isAdmin: boolean,
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;
    const where = isAdmin ? {} : { tenantId: tenantId! };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.participation.count({ where }),
      this.prisma.participation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          tenant: { select: { id: true, corporateName: true, tradeName: true } },
          opportunity: {
            include: {
              bidding: {
                select: {
                  id: true,
                  biddingNumber: true,
                  agencyName: true,
                  objectSummary: true,
                  estimatedValue: true,
                },
              },
            },
          },
          items: { include: { biddingItem: { select: { itemNumber: true, description: true, unit: true } } } },
        },
      }),
    ]);

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
