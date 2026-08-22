import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import { PushService } from './push.service';
import { MailService } from '../auth/mail.service';
import { UpdateNotificationPreferencesDto } from './dto/notifications.dto';

export interface OpportunityAlertJobData {
  type: 'opportunity_alert';
  opportunityId: string;
  tenantId: string;
}

export interface ProposalSubmittedJobData {
  type: 'proposal_submitted';
  participationId: string;
  tenantId: string;
  tenantName: string;
  opportunityId?: string;
  biddingNumber?: string;
  consolidatedTotalValue?: number | string | null;
  recipientUserId: string;
  channel: string;
}

function isInQuietHours(start: string | null, end: string | null): boolean {
  if (!start || !end) return false;

  const now = new Date();
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    // Normal range e.g. 09:00 – 18:00
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Wraps around midnight e.g. 22:00 – 08:00
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private whatsAppService: WhatsAppService,
    private pushService: PushService,
    private mailService: MailService,
  ) {}

  // ----------------------------------------------------------------
  // Core processing
  // ----------------------------------------------------------------

  /**
   * Dispatched by MatchingService after a new opportunity is created.
   * Sends push to all tenant users and WhatsApp to the tenant number.
   */
  async processNotification(opportunityId: string, tenantId: string): Promise<void> {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: {
        bidding: {
          select: {
            biddingNumber: true,
            agencyName: true,
            objectSummary: true,
            estimatedValue: true,
            municipalityName: true,
            uf: true,
            sourceUrl: true,
          },
        },
        tenant: {
          select: {
            id: true,
            whatsappNumber: true,
            corporateName: true,
            companyFilter: {
              select: {
                notificaEmail: true,
                notificaWhatsapp: true,
                notificaPush: true,
              },
            },
          },
        },
      },
    });

    if (!opportunity) {
      this.logger.warn(`Opportunity ${opportunityId} not found, skipping notification`);
      return;
    }

    // Tenant users with devices
    const users = await this.prisma.user.findMany({
      where: { tenantId, isActive: true },
      include: { devices: true },
    });

    // Tenant-level preference fallback
    const tenantPref = await this.prisma.notificationPreference.findFirst({
      where: { tenantId, userId: null },
    });

    const now = new Date();
    const title = 'Nova Oportunidade';
    const summary =
      opportunity.bidding.objectSummary ??
      opportunity.bidding.biddingNumber ??
      'Nova licitação compatível';
    const body = `${opportunity.tenant.corporateName}: ${summary}`;

    // ── Push per user ──────────────────────────────────────────────
    for (const user of users) {
      const userPref =
        (await this.prisma.notificationPreference.findFirst({
          where: { tenantId, userId: user.id },
        })) ?? tenantPref;

      const allowPush = userPref?.allowPush ?? opportunity.tenant.companyFilter?.notificaPush ?? true;
      const inQuiet = isInQuietHours(
        userPref?.quietHoursStart ?? null,
        userPref?.quietHoursEnd ?? null,
      );

      if (!allowPush || inQuiet || user.devices.length === 0) {
        if (inQuiet) {
          this.logger.debug(`User ${user.id} in quiet hours, skipping push`);
        }
        continue;
      }

      // Use first registered device
      const device = user.devices[0];

      const notification = await this.prisma.notification.create({
        data: {
          tenantId,
          userId: user.id,
          opportunityId,
          channel: 'push',
          templateCode: 'opportunity_alert',
          payload: { title, body },
          status: 'queued',
        },
      });

      try {
        const msgId = await this.pushService.sendPush(device.fcmToken, title, body, {
          opportunityId,
          type: 'opportunity_alert',
        });

        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { status: 'sent', sentAt: now, providerMessageId: msgId },
        });
      } catch (err) {
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: 'failed',
            failedReason: err instanceof Error ? err.message : String(err),
          },
        });
        this.logger.error(`Push failed for user ${user.id}: ${String(err)}`);
      }
    }

    // ── WhatsApp to tenant number ──────────────────────────────────
    const tenantPhone = opportunity.tenant.whatsappNumber;
    if (tenantPhone) {
      const allowWa = tenantPref?.allowWhatsapp ?? opportunity.tenant.companyFilter?.notificaWhatsapp ?? true;
      const inQuiet = isInQuietHours(
        tenantPref?.quietHoursStart ?? null,
        tenantPref?.quietHoursEnd ?? null,
      );

      if (allowWa && !inQuiet && users.length > 0) {
        const firstUser = users[0];

        const notification = await this.prisma.notification.create({
          data: {
            tenantId,
            userId: firstUser.id,
            opportunityId,
            channel: 'whatsapp',
            templateCode: 'opportunity_alert',
            payload: { phone: tenantPhone },
            status: 'queued',
          },
        });

        try {
          const msgId = await this.whatsAppService.sendOpportunityAlert(tenantPhone, {
            biddingNumber: opportunity.bidding.biddingNumber ?? undefined,
            agencyName: opportunity.bidding.agencyName ?? undefined,
            objectSummary: opportunity.bidding.objectSummary ?? undefined,
            estimatedValue: opportunity.bidding.estimatedValue?.toString(),
            matchingScore: opportunity.matchingScore,
          });

          await this.prisma.notification.update({
            where: { id: notification.id },
            data: { status: 'sent', sentAt: now, providerMessageId: msgId },
          });
        } catch (err) {
          await this.prisma.notification.update({
            where: { id: notification.id },
            data: {
              status: 'failed',
              failedReason: err instanceof Error ? err.message : String(err),
            },
          });
          this.logger.error(`WhatsApp failed for tenant ${tenantId}: ${String(err)}`);
        }
      }
    }

    // ── E-mail to active tenant users ─────────────────────────────────
    const allowEmail = opportunity.tenant.companyFilter?.notificaEmail ?? true;
    if (allowEmail) {
      for (const user of users) {
        if (!user.email) continue;
        const notification = await this.prisma.notification.create({
          data: {
            tenantId,
            userId: user.id,
            opportunityId,
            channel: 'email',
            templateCode: 'opportunity_alert',
            payload: { recipient: user.email, subject: `LicitaIA — Nova oportunidade${opportunity.bidding.biddingNumber ? ` ${opportunity.bidding.biddingNumber}` : ''}` },
            status: 'queued',
          },
        });

        try {
          await this.mailService.sendOpportunityAlertEmail(user.email, {
            biddingNumber: opportunity.bidding.biddingNumber,
            agencyName: opportunity.bidding.agencyName,
            objectSummary: opportunity.bidding.objectSummary,
            municipalityName: opportunity.bidding.municipalityName,
            uf: opportunity.bidding.uf,
            estimatedValue: opportunity.bidding.estimatedValue?.toString() ?? null,
            sourceUrl: opportunity.bidding.sourceUrl,
          });
          await this.prisma.notification.update({
            where: { id: notification.id },
            data: { status: 'sent', sentAt: now },
          });
        } catch (err) {
          await this.prisma.notification.update({
            where: { id: notification.id },
            data: { status: 'failed', failedReason: err instanceof Error ? err.message : String(err) },
          });
          this.logger.error(`Email failed for user ${user.id}: ${String(err)}`);
        }
      }
    }

    // Mark first notification timestamp on opportunity
    if (!opportunity.firstNotifiedAt) {
      await this.prisma.opportunity.update({
        where: { id: opportunityId },
        data: { firstNotifiedAt: now },
      });
    }

    this.logger.log(
      `processNotification complete: opportunityId=${opportunityId} users=${users.length}`,
    );
  }

  /**
   * Dispatched by ParticipationService after a proposal is submitted.
   * Sends push to a specific TAED admin user.
   */
  async processProposalNotification(jobData: ProposalSubmittedJobData): Promise<void> {
    const {
      recipientUserId,
      participationId,
      opportunityId,
      biddingNumber,
      consolidatedTotalValue,
      tenantName,
    } = jobData;

    const adminUser = await this.prisma.user.findUnique({
      where: { id: recipientUserId },
      include: { devices: true },
    });

    if (!adminUser) {
      this.logger.warn(`Admin user ${recipientUserId} not found, skipping notification`);
      return;
    }

    const userPref =
      (await this.prisma.notificationPreference.findFirst({
        where: { tenantId: adminUser.tenantId, userId: adminUser.id },
      })) ??
      (await this.prisma.notificationPreference.findFirst({
        where: { tenantId: adminUser.tenantId, userId: null },
      }));

    const allowPush = userPref?.allowPush ?? true;
    const inQuiet = isInQuietHours(
      userPref?.quietHoursStart ?? null,
      userPref?.quietHoursEnd ?? null,
    );

    if (inQuiet) {
      this.logger.debug(`Admin user ${recipientUserId} in quiet hours, skipping`);
      return;
    }

    if (!allowPush || adminUser.devices.length === 0) {
      this.logger.debug(
        `Admin user ${recipientUserId} no push allowed or no devices, skipping`,
      );
      return;
    }

    const now = new Date();
    const title = 'Nova Proposta Recebida';
    const totalStr = consolidatedTotalValue != null ? String(consolidatedTotalValue) : null;
    const body = totalStr
      ? `${tenantName} enviou proposta para ${biddingNumber ?? participationId} — R$ ${totalStr}`
      : `${tenantName} enviou proposta para ${biddingNumber ?? participationId}`;

    const device = adminUser.devices[0];

    const notification = await this.prisma.notification.create({
      data: {
        tenantId: adminUser.tenantId,
        userId: adminUser.id,
        opportunityId: opportunityId ?? null,
        channel: 'push',
        templateCode: 'proposal_submitted',
        payload: { title, body, participationId },
        status: 'queued',
      },
    });

    try {
      const msgId = await this.pushService.sendPush(device.fcmToken, title, body, {
        participationId,
        opportunityId: opportunityId ?? '',
        type: 'proposal_submitted',
      });

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'sent', sentAt: now, providerMessageId: msgId },
      });
    } catch (err) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'failed',
          failedReason: err instanceof Error ? err.message : String(err),
        },
      });
      this.logger.error(`Push failed for admin ${recipientUserId}: ${String(err)}`);
    }
  }

  // ----------------------------------------------------------------
  // REST helpers
  // ----------------------------------------------------------------

  async listNotifications(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { userId };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          opportunity: {
            include: {
              bidding: {
                select: {
                  biddingNumber: true,
                  agencyName: true,
                  objectSummary: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async markRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) throw new ForbiddenException('Access denied');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { status: 'read' },
    });
  }

  async getPreferences(userId: string, tenantId: string) {
    const userPref = await this.prisma.notificationPreference.findFirst({
      where: { tenantId, userId },
    });
    if (userPref) return userPref;

    const tenantPref = await this.prisma.notificationPreference.findFirst({
      where: { tenantId, userId: null },
    });

    return (
      tenantPref ?? {
        id: null,
        tenantId,
        userId,
        allowPush: true,
        allowWhatsapp: true,
        quietHoursStart: null,
        quietHoursEnd: null,
        createdAt: null,
        updatedAt: null,
      }
    );
  }

  async upsertPreferences(
    userId: string,
    tenantId: string,
    dto: UpdateNotificationPreferencesDto,
  ) {
    const existing = await this.prisma.notificationPreference.findFirst({
      where: { tenantId, userId },
    });

    if (existing) {
      return this.prisma.notificationPreference.update({
        where: { id: existing.id },
        data: {
          allowPush: dto.allowPush ?? existing.allowPush,
          allowWhatsapp: dto.allowWhatsapp ?? existing.allowWhatsapp,
          quietHoursStart:
            dto.quietHoursStart !== undefined
              ? dto.quietHoursStart
              : existing.quietHoursStart,
          quietHoursEnd:
            dto.quietHoursEnd !== undefined ? dto.quietHoursEnd : existing.quietHoursEnd,
        },
      });
    }

    return this.prisma.notificationPreference.create({
      data: {
        tenantId,
        userId,
        allowPush: dto.allowPush ?? true,
        allowWhatsapp: dto.allowWhatsapp ?? true,
        quietHoursStart: dto.quietHoursStart,
        quietHoursEnd: dto.quietHoursEnd,
      },
    });
  }
}
