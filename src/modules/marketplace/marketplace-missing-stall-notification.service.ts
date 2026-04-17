import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AuditAction,
  AuditEntity,
  MarketplaceReservationStatus,
  MarketplaceSlotStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

type NotifyMissingStallInput = {
  reservationId: string;
  actorUserId: string;
  force?: boolean;
  notes?: string;
};

@Injectable()
export class MarketplaceMissingStallNotificationService {
  private readonly logger = new Logger(
    MarketplaceMissingStallNotificationService.name,
  );
  private readonly cooldownHours = 24;
  private readonly auditReason = 'marketplace_notify_missing_stall';

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private toAuditJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private escapeHtml(value: string | null | undefined): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    }).format(date);
  }

  private buildEmail(input: {
    fairName: string;
    ownerName: string;
    slotLabel: string;
    slotType: string | null;
    notes?: string | null;
  }) {
    const fairName = this.escapeHtml(input.fairName);
    const ownerName = this.escapeHtml(input.ownerName || 'Expositor');
    const slotLabel = this.escapeHtml(input.slotLabel);
    const slotType = this.escapeHtml(input.slotType ?? 'Nao informado');
    const notes = this.escapeHtml(input.notes);

    const subject = `Seu espaco ja esta confirmado na ${input.fairName} - falta vincular sua barraca`;

    const portalBaseUrl = process.env.PORTAL_EXHIBITOR_BASE_URL?.trim();
    const portalUrl = portalBaseUrl ? portalBaseUrl.replace(/\/$/, '') : null;
    const portalUrlHtml = portalUrl ? this.escapeHtml(portalUrl) : null;

    const notesHtml = input.notes
      ? `
        <div style="margin-top: 24px; padding: 16px 18px; border-radius: 12px; background: #fff6e6; border: 1px solid #f3d29b;">
          <p style="margin: 0 0 8px; color: #6b4f1d; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">
            Recado da equipe
          </p>
          <p style="margin: 0; color: #5a4b35; font-size: 14px; line-height: 1.6;">
            ${notes}
          </p>
        </div>
      `
      : '';

    const buttonHtml = portalUrl && portalUrlHtml
      ? `
        <div style="text-align: center; margin: 32px 0;">
          <a href="${portalUrlHtml}"
             style="display: inline-block; background: linear-gradient(135deg, #0f3460, #e94560); color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px;">
            Acessar meu portal
          </a>
        </div>
        <p style="color: #8b8b8b; font-size: 12px; line-height: 1.5; text-align: center;">
          Se o botao nao funcionar, copie e cole este link no navegador:<br />
          <span style="color: #0f3460; word-break: break-all;">${portalUrlHtml}</span>
        </p>
      `
      : '';

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 32px 24px; background: #f7f8fb;">
        <div style="background: #ffffff; border-radius: 18px; padding: 32px 28px; box-shadow: 0 10px 30px rgba(15, 52, 96, 0.08);">
          <div style="text-align: center; margin-bottom: 28px;">
            <h1 style="color: #1a1a2e; font-size: 26px; margin: 0;">Only in BR</h1>
            <div style="width: 46px; height: 4px; background: linear-gradient(90deg, #e94560, #0f3460); margin: 14px auto;"></div>
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Seu espaco ja esta reservado e confirmado
            </p>
          </div>

          <p style="color: #333; font-size: 16px; line-height: 1.7; margin: 0 0 16px;">
            Ola, <strong>${ownerName}</strong>!
          </p>

          <p style="color: #4b5563; font-size: 15px; line-height: 1.7; margin: 0 0 18px;">
            Seu espaco na feira <strong>${fairName}</strong> ja esta com o slot
            <strong>${slotLabel}</strong> confirmado, mas ainda nao identificamos
            uma barraca vinculada a esse espaco.
          </p>

          <div style="padding: 18px 20px; border-radius: 14px; background: linear-gradient(180deg, #f9fafb, #eef2f7); border: 1px solid #e5e7eb;">
            <p style="margin: 0 0 8px; color: #111827; font-size: 14px;">
              <strong>Feira:</strong> ${fairName}
            </p>
            <p style="margin: 0 0 8px; color: #111827; font-size: 14px;">
              <strong>Slot:</strong> ${slotLabel}
            </p>
            <p style="margin: 0; color: #111827; font-size: 14px;">
              <strong>Tipo reservado:</strong> ${slotType}
            </p>
          </div>

          <p style="color: #4b5563; font-size: 15px; line-height: 1.7; margin: 24px 0 0;">
            Para concluir essa etapa, acesse seu portal e vincule a barraca correta ao espaco confirmado.
            Isso ajuda nossa equipe a finalizar a organizacao do mapa e da operacao da feira.
          </p>

          ${notesHtml}
          ${buttonHtml}

          <hr style="border: none; border-top: 1px solid #ececec; margin: 32px 0 24px;" />

          <p style="margin: 0; color: #8b8b8b; font-size: 12px; line-height: 1.6; text-align: center;">
            Se voce ja concluiu essa vinculacao recentemente, pode desconsiderar esta mensagem.<br />
            &copy; ${new Date().getFullYear()} Only in BR - Todos os direitos reservados.
          </p>
        </div>
      </div>
    `;

    return { subject, html };
  }

  private async createNotificationAuditLog(input: {
    actorUserId: string;
    reservationId: string;
    fairId: string;
    fairMapSlotId: string;
    recipientEmail: string | null;
    success: boolean;
    force: boolean;
    notes?: string | null;
    reason: string;
    errorMessage?: string | null;
  }) {
    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.CREATE,
        entity: AuditEntity.PAYMENT,
        entityId: input.reservationId,
        actorUserId: input.actorUserId,
        before: this.toAuditJson({}),
        after: this.toAuditJson({
          success: input.success,
          recipientEmail: input.recipientEmail,
          errorMessage: input.errorMessage ?? null,
        }),
        meta: this.toAuditJson({
          reservationId: input.reservationId,
          fairId: input.fairId,
          fairMapSlotId: input.fairMapSlotId,
          recipientEmail: input.recipientEmail,
          force: input.force,
          notes: input.notes ?? null,
          reason: input.reason,
        }),
      },
    });
  }

  private async getLatestSuccessfulNotification(
    reservationId: string,
  ): Promise<{ createdAt: Date } | null> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        entity: AuditEntity.PAYMENT,
        entityId: reservationId,
      },
      select: {
        createdAt: true,
        after: true,
        meta: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const successfulLog = logs.find((log) => {
      const after = log.after as { success?: boolean } | null;
      const meta = log.meta as { reason?: string } | null;

      return after?.success === true && meta?.reason === this.auditReason;
    });

    return successfulLog ? { createdAt: successfulLog.createdAt } : null;
  }

  async notifyMissingStall(input: NotifyMissingStallInput) {
    const reservation = await this.prisma.marketplaceSlotReservation.findUnique({
      where: { id: input.reservationId },
      include: {
        fair: {
          select: {
            id: true,
            name: true,
          },
        },
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        fairMapSlot: {
          select: {
            id: true,
            fairMapId: true,
            fairMapElementId: true,
            label: true,
            code: true,
            commercialStatus: true,
          },
        },
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reserva nao encontrada.');
    }

    if (reservation.status !== MarketplaceReservationStatus.CONVERTED) {
      throw new BadRequestException(
        'So e permitido alertar reservas ja convertidas/confirmadas.',
      );
    }

    if (
      reservation.fairMapSlot.commercialStatus !== MarketplaceSlotStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        'So e permitido alertar quando o slot estiver CONFIRMED.',
      );
    }

    const slotLink = await this.prisma.fairMapBoothLink.findUnique({
      where: {
        fairMapId_slotClientKey: {
          fairMapId: reservation.fairMapSlot.fairMapId,
          slotClientKey: reservation.fairMapSlot.fairMapElementId,
        },
      },
      select: {
        id: true,
        stallFairId: true,
      },
    });

    if (slotLink) {
      throw new ConflictException(
        'Este slot ja possui uma barraca vinculada. O alerta por e-mail nao e mais necessario.',
      );
    }

    if (!reservation.owner.email) {
      await this.createNotificationAuditLog({
        actorUserId: input.actorUserId,
        reservationId: reservation.id,
        fairId: reservation.fairId,
        fairMapSlotId: reservation.fairMapSlotId,
        recipientEmail: null,
        success: false,
        force: Boolean(input.force),
        notes: input.notes,
        reason: 'missing_recipient_email',
        errorMessage: 'Expositor sem e-mail cadastrado.',
      });

      throw new BadRequestException(
        'O expositor desta reserva nao possui e-mail cadastrado.',
      );
    }

    const latestSuccessfulNotification =
      await this.getLatestSuccessfulNotification(reservation.id);

    if (latestSuccessfulNotification && !input.force) {
      const cooldownMs = this.cooldownHours * 60 * 60 * 1000;
      const nextAllowedAt = new Date(
        latestSuccessfulNotification.createdAt.getTime() + cooldownMs,
      );

      if (nextAllowedAt > new Date()) {
        throw new ConflictException(
          `Ja existe um alerta recente enviado para esta reserva. Aguarde ate ${this.formatDateTime(nextAllowedAt)} ou envie com force=true.`,
        );
      }
    }

    const slotLabel =
      reservation.fairMapSlot.label ||
      reservation.fairMapSlot.code ||
      reservation.fairMapSlot.fairMapElementId;

    const { subject, html } = this.buildEmail({
      fairName: reservation.fair.name,
      ownerName: reservation.owner.fullName ?? 'Expositor',
      slotLabel,
      slotType: reservation.selectedTentType ?? null,
      notes: input.notes ?? null,
    });

    const sent = await this.mail.sendMail(reservation.owner.email, subject, html);

    await this.createNotificationAuditLog({
      actorUserId: input.actorUserId,
      reservationId: reservation.id,
      fairId: reservation.fairId,
      fairMapSlotId: reservation.fairMapSlotId,
      recipientEmail: reservation.owner.email,
      success: sent,
      force: Boolean(input.force),
      notes: input.notes,
      reason: this.auditReason,
      errorMessage: sent ? null : 'MailService retornou falha no envio.',
    });

    if (!sent) {
      this.logger.warn(
        `Falha ao enviar alerta de barraca pendente para reserva ${reservation.id}.`,
      );
      throw new ServiceUnavailableException(
        'Nao foi possivel enviar o e-mail de alerta neste momento.',
      );
    }

    return {
      success: true,
      message: 'E-mail de alerta enviado com sucesso.',
      reservationId: reservation.id,
      fairId: reservation.fairId,
      fairMapSlotId: reservation.fairMapSlotId,
      recipientEmail: reservation.owner.email,
      sentAt: new Date().toISOString(),
    };
  }
}
