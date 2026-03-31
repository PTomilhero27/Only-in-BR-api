import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  MarketplaceInterestStatus,
  MarketplaceReservationStatus,
  MarketplaceSlotStatus,
} from '@prisma/client';

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async createInterest(ownerId: string, slotId: string, message?: string) {
    if (!ownerId) {
      throw new ForbiddenException(
        'Usuário logado não possui um Owner associado.',
      );
    }

    const slot = await this.prisma.fairMapSlot.findUnique({
      where: { id: slotId },
      include: { fair: true },
    });

    if (!slot) {
      throw new NotFoundException('Slot não encontrado.');
    }
    if (slot.commercialStatus !== MarketplaceSlotStatus.AVAILABLE) {
      throw new BadRequestException(
        'Este slot não está disponível para interesse.',
      );
    }

    const activeInterests = ['NEW', 'CONTACTED']; // ou usar o enum local
    const existingInterest =
      await this.prisma.marketplaceSlotInterest.findFirst({
        where: {
          fairMapSlotId: slotId,
          ownerId,
          status: {
            in: [
              MarketplaceInterestStatus.NEW,
              MarketplaceInterestStatus.CONTACTED,
            ],
          },
        },
      });

    if (existingInterest) {
      throw new BadRequestException(
        'Você já possui um interesse ativo para este slot.',
      );
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48); // default to 48 hours for expiration

    const interest = await this.prisma.marketplaceSlotInterest.create({
      data: {
        fairId: slot.fairId,
        fairMapSlotId: slot.id,
        ownerId,
        message,
        status: MarketplaceInterestStatus.NEW,
        expiresAt,
      },
    });

    const owner = await this.prisma.owner.findUnique({
      where: { id: ownerId },
    });

    // Notificar vendas
    const emailSubject = `Novo interesse no slot ${slot.label || slot.code} - Feira: ${slot.fair.name}`;
    const emailHtml = `
      <h1>Novo Interesse de Expositor</h1>
      <p><strong>Feira:</strong> ${slot.fair.name}</p>
      <p><strong>Slot:</strong> ${slot.label || slot.code || slot.id}</p>
      <p><strong>Preço:</strong> ${(slot.priceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
      <h2>Expositor:</h2>
      <p><strong>Nome:</strong> ${owner?.fullName || ''}</p>
      <p><strong>Documento:</strong> ${owner?.document || ''}</p>
      <p><strong>Email:</strong> ${owner?.email || ''}</p>
      <p><strong>Telefone:</strong> ${owner?.phone || ''}</p>
      <p><strong>Mensagem:</strong> ${message || 'Nenhuma'}</p>
    `;

    // Process.env.SALES_EMAIL -> configure after
    const salesEmail = process.env.SALES_EMAIL || 'vendas@seu-dominio.com.br';

    // Fire and forget ou await
    this.mail.sendMail(salesEmail, emailSubject, emailHtml).catch((err) => {
      this.logger.error(
        'Falha ao enviar e-mail de notificação de interesse.',
        err,
      );
    });

    return interest;
  }

  async createReservation(ownerId: string, slotId: string) {
    if (!ownerId) {
      throw new ForbiddenException(
        'Usuário logado não possui um Owner associado.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const slot = await tx.fairMapSlot.findUnique({
        where: { id: slotId },
      });

      if (!slot) {
        throw new NotFoundException('Slot não encontrado.');
      }
      if (slot.commercialStatus !== MarketplaceSlotStatus.AVAILABLE) {
        throw new BadRequestException(
          'Este slot não está disponível para reserva.',
        );
      }

      // Bloquear concorrência (duplicidade)
      const existingActiveReservation =
        await tx.marketplaceSlotReservation.findFirst({
          where: {
            fairMapSlotId: slotId,
            status: MarketplaceReservationStatus.ACTIVE,
          },
        });

      if (existingActiveReservation) {
        throw new BadRequestException('Este slot já possui uma reserva ativa.');
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      const reservation = await tx.marketplaceSlotReservation.create({
        data: {
          fairId: slot.fairId,
          fairMapSlotId: slotId,
          ownerId,
          status: MarketplaceReservationStatus.ACTIVE,
          expiresAt,
        },
      });

      await tx.fairMapSlot.update({
        where: { id: slotId },
        data: {
          commercialStatus: MarketplaceSlotStatus.RESERVED,
        },
      });

      return reservation;
    });
  }
}
