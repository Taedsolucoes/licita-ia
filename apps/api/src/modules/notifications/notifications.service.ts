import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import { PushService } from './push.service';
import {
  RegisterDeviceDto,
  UpdateNotificationPreferencesDto,
} from './dto/notifications.dto';

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
  ) {}

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    const existing = await this.prisma.device.findFirst({
      where: { fcmToken: dto.token },
      select: { id: true },
    });
    const data = {
      userId,
      platform: dto.platform,
      lastSeenAt: new Date(),
    };

    const device = existing
      ? await this.prisma.device.update({ where: { id: existing.id }, data })
      : await this.prisma.device.create({ data: { ...data, fcmToken: dto.token } });

    return { registered: true, deviceId: device.id };
  }

  async unregisterDevice(userId: string, token: string) {
    const result = await this.prisma.device.deleteMany({ where: { userId, fcmToken: token } });
    return { removed: result.count > 0 };
  }

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
            source: true,
            biddingNumber: true,
            agencyName: true,
            objectText: true,
            objectSummary: true,
            municipalityName: true,
            uf: true,
            estimatedValue: true,
          },
        },
        tenant: {
          select: {
            id: true,
            whatsappNumber: true,
            corporateName: true,
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
    const title = 'Nova oportunidade compatível';
    const summary = (
      opportunity.bidding.objectSummary ??
      opportunity.bidding.objectText ??
      opportunity.bidding.biddingNumber ??
      'Nova licitação compatível'
    ).slice(0, 280);
    const agencyName = opportunity.bidding.agencyName ?? 'Órgão não informado';
    const cityState = [opportunity.bidding.municipalityName, opportunity.bidding.uf]
      .filter(Boolean)
      .join(' - ');
    const estimatedValue = opportunity.bidding.estimatedValue
      ? `R$ ${Number(opportunity.bidding.estimatedValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      : 'Valor não informado';
    const compatibilityPercent = Math.max(0, Math.min(100, Math.round(Number(opportunity.matchingScore) * 100)));
    const body = [agencyName, cityState || 'Local não informado', estimatedValue, `${compatibilityPercent}% compatibilidade`, summary].join(' · ');

    // Persist an in-app record independently of device/push availability.
    for (const user of users) {
      await this.prisma.notification.createMany({
        data: [{
          tenantId,
          userId: user.id,
          opportunityId,
          channel: 'in_app',
          templateCode: 'opportunity_alert',
          payload: {
            title,
            body,
            agencyName,
            objectSummary: summary,
            city: opportunity.bidding.municipalityName,
            uf: opportunity.bidding.uf,
            estimatedValue: opportunity.bidding.estimatedValue?.toString() ?? null,
            compatibilityPercent,
            source: opportunity.bidding.source,
            opportunityId,
            destination: 'Dashboard',
            highlightOpportunityId: opportunityId,
          },
          status: 'sent',
          sentAt: now,
        }],
        skipDuplicates: true,
      });
    }

    // ── Push per user ──────────────────────────────────────────────
    for (const user of users) {
      const userPref =
        (await this.prisma.notificationPreference.findFirst({
          where: { tenantId, userId: user.id },
        })) ?? tenantPref;

      const allowPush = userPref?.allowPush ?? true;
      const inQuiet = isInQuietHours(
        userPref?.quietHoursStart ?? null,
        userPref?.quietHoursEnd ?? null,
      );

      const deviceTokens = [...new Set(user.devices.map((device) => device.fcmToken).filter(Boolean))];
      if (!allowPush || inQuiet || deviceTokens.length === 0) {
        if (inQuiet) {
          this.logger.debug(`User ${user.id} in quiet hours, skipping push`);
        }
        continue;
      }

      const pushCreated = await this.prisma.notification.createMany({
        data: [{
          tenantId,
          userId: user.id,
          opportunityId,
          channel: 'push',
          templateCode: 'opportunity_alert',
          payload: { title, body, source: opportunity.bidding.source, highlightOpportunityId: opportunityId },
          status: 'queued',
        }],
        skipDuplicates: true,
      });
      if (pushCreated.count === 0) continue;
      const notification = await this.prisma.notification.findFirst({
        where: { tenantId, userId: user.id, opportunityId, channel: 'push', templateCode: 'opportunity_alert' },
        select: { id: true },
      });
      if (!notification) continue;

      const pushData = {
        opportunityId,
        highlightOpportunityId: opportunityId,
        destination: 'Dashboard',
        source: opportunity.bidding.source ?? '',
        agencyName,
        city: opportunity.bidding.municipalityName ?? '',
        uf: opportunity.bidding.uf ?? '',
        compatibilityPercent: String(compatibilityPercent),
        type: 'opportunity_alert',
      };
      const results = await Promise.allSettled(
        deviceTokens.map((token) => this.pushService.sendPush(token, title, body, pushData)),
      );
      const messageIds = results.flatMap((result) =>
        result.status === 'fulfilled' && result.value ? [result.value] : [],
      );
      const failures = results.filter((result) => result.status === 'rejected');
      const partialFailure = failures.length > 0
        ? `Falha em ${failures.length}/${results.length} dispositivos: ${failures
            .map((result) => result.status === 'rejected' ? String(result.reason) : '')
            .join('; ')}`
        : null;

      if (messageIds.length > 0) {
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: 'sent',
            sentAt: now,
            providerMessageId: JSON.stringify(messageIds),
            failedReason: partialFailure,
          },
        });
        if (partialFailure) {
          this.logger.warn(`Push partially failed for user ${user.id}: ${partialFailure}`);
        }
      } else {
        const failureReason = failures
          .map((result) => result.status === 'rejected' ? String(result.reason) : '')
          .join('; ') || 'Nenhum provedor retornou um identificador de mensagem.';
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: 'failed',
            failedReason: failureReason,
          },
        });
        this.logger.error(`Push failed for user ${user.id}: ${failureReason}`);
      }
    }

    // ── WhatsApp to tenant number ──────────────────────────────────
    const tenantPhone = opportunity.tenant.whatsappNumber;
    if (tenantPhone) {
      const allowWa = tenantPref?.allowWhatsapp ?? true;
      const inQuiet = isInQuietHours(
        tenantPref?.quietHoursStart ?? null,
        tenantPref?.quietHoursEnd ?? null,
      );

      if (allowWa && !inQuiet && users.length > 0) {
        const firstUser = users[0];

        const whatsappCreated = await this.prisma.notification.createMany({
          data: [{
            tenantId,
            userId: firstUser.id,
            opportunityId,
            channel: 'whatsapp',
            templateCode: 'opportunity_alert',
            payload: { phone: tenantPhone },
            status: 'queued',
          }],
          skipDuplicates: true,
        });
        if (whatsappCreated.count > 0) {
          const notification = await this.prisma.notification.findFirst({
            where: { tenantId, userId: firstUser.id, opportunityId, channel: 'whatsapp', templateCode: 'opportunity_alert' },
            select: { id: true },
          });

          if (notification) {
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
    const where = { userId, channel: 'in_app' };

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
                    source: true,
                    biddingNumber: true,
                    agencyName: true,
                    objectSummary: true,
                    municipalityName: true,
                    uf: true,
                    estimatedValue: true,
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
