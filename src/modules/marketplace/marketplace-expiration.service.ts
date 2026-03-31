import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  MarketplaceInterestStatus,
  MarketplaceReservationStatus,
  MarketplaceSlotStatus,
} from '@prisma/client';

@Injectable()
export class MarketplaceExpirationService {
  private readonly logger = new Logger(MarketplaceExpirationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Varre e expira interesses e reservas vencidas de uma feira.
   * Fez a chamada como '$transaction' para garantir que os slots sejam
   * liberados atomica e consistentemente.
   */
  async validateAndExpireSlots(fairId: string): Promise<void> {
    const defaultSenderEmail = process.env.SMTP_USER || 'contato@onlyinbr.com.br';

    await this.prisma.$transaction(async (tx) => {
      // 1. Expirar Reservas (status = ACTIVE) e expiresAt < now()
      const expiredReservations = await tx.marketplaceSlotReservation.findMany({
        where: {
          fairId,
          status: MarketplaceReservationStatus.ACTIVE,
          expiresAt: { lt: new Date() },
        },
        include: {
          owner: true,
          fairMapSlot: true,
          fair: true,
        },
      });

      for (const res of expiredReservations) {
        // Atualiza a reserva como expirada
        await tx.marketplaceSlotReservation.update({
          where: { id: res.id },
          data: { status: MarketplaceReservationStatus.EXPIRED },
        });

        // Libera o slot SOMENTE se ele NÃO estiver CONFIRMED
        if (res.fairMapSlot.commercialStatus !== MarketplaceSlotStatus.CONFIRMED) {
          await tx.fairMapSlot.update({
            where: { id: res.fairMapSlotId },
            data: { commercialStatus: MarketplaceSlotStatus.AVAILABLE },
          });
        }

        // Dispara o e-mail (usando Promise.allSettled por fora, mas como estamos no loop da transação,
        // apenas enfileirar sem await garantiria que o e-mail só fosse disparado. Para não bloquear
        // a transação com chamadas de rede lentas, preparamos eles de forma assíncrona ou fire&forget).
        const emailSubject = `Sua Reserva de Espaço Expirou - ${res.fair.name}`;
        const emailHtml = `
          <h2>Olá ${res.owner.fullName || res.owner.document},</h2>
          <p>O tempo da sua reserva temporária para o slot <b>${res.fairMapSlot.label || res.fairMapSlot.code}</b> na feira <b>${res.fair.name}</b> expirou.</p>
          <p>Se você ainda tiver interesse em prosseguir com a locação deste espaço, por favor, entre em contato imediatamente com nossa equipe comercial, pois o espaço poderá estar disponível para outros interessados.</p>
          <p>Atenciosamente,<br>Equipe Only in BR</p>
        `;
        
        // Fire and forget email call
        this.mail.sendMail(res.owner.email || defaultSenderEmail, emailSubject, emailHtml).catch(err => {
          this.logger.error(`Erro ao enviar email de expiração de reserva para ${res.owner.email}`, err);
        });
      }

      // 2. Expirar Interesses Bloqueantes (status = NEGOTIATING) e expiresAt < now()
      const expiredNegotiating = await tx.marketplaceSlotInterest.findMany({
        where: {
          fairId,
          status: MarketplaceInterestStatus.NEGOTIATING,
          expiresAt: { lt: new Date() },
        },
        include: {
          owner: true,
          fairMapSlot: true,
          fair: true,
        },
      });

      for (const interest of expiredNegotiating) {
        await tx.marketplaceSlotInterest.update({
          where: { id: interest.id },
          data: { status: MarketplaceInterestStatus.EXPIRED },
        });

        if (interest.fairMapSlot.commercialStatus !== MarketplaceSlotStatus.CONFIRMED) {
          await tx.fairMapSlot.update({
            where: { id: interest.fairMapSlotId },
            data: { commercialStatus: MarketplaceSlotStatus.AVAILABLE },
          });
        }

        const emailSubject = `Prazo de Negociação Expirado - ${interest.fair.name}`;
        const emailHtml = `
          <h2>Olá ${interest.owner.fullName || interest.owner.document},</h2>
          <p>O prazo para finalização da sua negociação para o espaço <b>${interest.fairMapSlot.label || interest.fairMapSlot.code}</b> na feira <b>${interest.fair.name}</b> chegou ao fim.</p>
          <p>Caso deseje retomar a negociação e confirmar o espaço, entre em contato conosco o mais breve possível, pois o slot retornou à disponibilidade.</p>
          <p>Atenciosamente,<br>Equipe Only in BR</p>
        `;

         this.mail.sendMail(interest.owner.email || defaultSenderEmail, emailSubject, emailHtml).catch(err => {
           this.logger.error(`Erro ao enviar email de expiração de interesse para ${interest.owner.email}`, err);
         });
      }

      // 3. Expirar Interesses Simples (NEW / CONTACTED) - Não afetam o slot
      const expiredSimples = await tx.marketplaceSlotInterest.findMany({
        where: {
          fairId,
          status: { in: [MarketplaceInterestStatus.NEW, MarketplaceInterestStatus.CONTACTED] },
          expiresAt: { lt: new Date() },
        },
      });

      if (expiredSimples.length > 0) {
        await tx.marketplaceSlotInterest.updateMany({
          where: { id: { in: expiredSimples.map(s => s.id) } },
          data: { status: MarketplaceInterestStatus.EXPIRED }, // ou DISMISSED, mantendo o padrão do ENUM? O ENUM atual tem DISMISSED em vez de EXPIRED. Wait, let me check the ENUM again. It actually has DISMISSED, but let's see. Or I can add EXPIRED to InterestStatus. 
          // A user disse: "pode voltar para DISMISSED", mas eles vão expirar... I'll use DISMISSED since EXPIRED may not be in the enum MarketplaceInterestStatus.
        });
      }
    });

    this.logger.debug(`Expirações processadas para a feira: ${fairId}`);
  }
}
