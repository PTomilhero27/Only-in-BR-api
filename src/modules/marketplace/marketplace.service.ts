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
  StallSize,
  Stall,
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

  async createReservation(
    ownerId: string,
    slotId: string,
    data?: { stallId?: string; selectedTentType?: StallSize },
  ) {
    console.log(ownerId);
    if (!ownerId) {
      throw new ForbiddenException(
        'Usuário logado não possui um Owner associado.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const slot = await tx.fairMapSlot.findUnique({
        where: { id: slotId },
        include: {
          fair: true,
          allowedTentTypes: true,
        },
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

      // 1. Determinar o tipo de barraca e validar
      let finalTentType: StallSize | null = data?.selectedTentType || null;
      let linkedStall: Stall | null = null;

      if (data?.stallId) {
        linkedStall = await tx.stall.findFirst({
          where: { id: data.stallId, ownerId },
        });
        if (!linkedStall) {
          throw new BadRequestException('Barraca vinculada não encontrada.');
        }
        // Se o usuário passou stallId, o tamanho da barraca prevalece ou deve coincidir
        if (!finalTentType) {
          finalTentType = linkedStall.stallSize;
        } else if (finalTentType !== linkedStall.stallSize) {
          throw new BadRequestException(
            `O tipo selecionado (${finalTentType}) não coincide com o tamanho da barraca (${linkedStall.stallSize}).`,
          );
        }
      }

      if (!finalTentType) {
        throw new BadRequestException(
          'É necessário selecionar um tipo de barraca ou vincular uma barraca.',
        );
      }

      // 2. Validar se o tipo é permitido no slot e capturar o preço
      const config = slot.allowedTentTypes.find(
        (c) => c.tentType === finalTentType,
      );
      if (!config) {
        throw new BadRequestException(
          `O tipo de barraca ${finalTentType} não é permitido para este slot.`,
        );
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      const reservation = await tx.marketplaceSlotReservation.create({
        data: {
          fairId: slot.fairId,
          fairMapSlotId: slotId,
          ownerId,
          stallId: data?.stallId || null,
          selectedTentType: finalTentType,
          priceCents: config.priceCents,
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

      // 3. Notificações por E-mail (Only in BR)
      const owner = await tx.owner.findUnique({
        where: { id: ownerId },
      });

      const slotLabel = slot.label || slot.code || slot.id;
      const formattedPrice = (config.priceCents / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });

      // --- E-mail para Equipe de Vendas ---
      const salesSubject = `[Only in BR] Nova Reserva: Slot ${slotLabel} - ${slot.fair.name}`;
      let stallInfoHtml = '<p><em>Nenhuma barraca vinculada ainda.</em></p>';
      if (linkedStall) {
        stallInfoHtml = `
          <p><strong>Nome da Barraca:</strong> ${linkedStall.pdvName}</p>
          <p><strong>Tipo:</strong> ${linkedStall.stallType}</p>
          <p><strong>Tamanho:</strong> ${linkedStall.stallSize}</p>
        `;
      }

      const salesHtml = `
        <h1>Nova Reserva de Slot (Only in BR)</h1>
        <p><strong>Feira:</strong> ${slot.fair.name}</p>
        <p><strong>Slot:</strong> ${slotLabel}</p>
        <p><strong>Tipo de Barraca:</strong> ${finalTentType}</p>
        <p><strong>Preço Capturado:</strong> ${formattedPrice}</p>
        <hr />
        <h3>Dados do Expositor:</h3>
        <p><strong>Nome:</strong> ${owner?.fullName || 'N/A'}</p>
        <p><strong>Email:</strong> ${owner?.email || 'N/A'}</p>
        <p><strong>Telefone:</strong> ${owner?.phone || 'N/A'}</p>
        <hr />
        <h3>Dados da Barraca:</h3>
        ${stallInfoHtml}
      `;

      const salesEmail = process.env.SALES_EMAIL || 'vendas@onlyinbr.com.br';
      this.mail.sendMail(salesEmail, salesSubject, salesHtml).catch((err) => {
        this.logger.error('Falha ao notificar vendas sobre reserva.', err);
      });

      // --- E-mail para o Expositor ---
      if (owner?.email) {
        const exhibitorSubject = `[Only in BR] Confirmação de Reserva: Slot ${slotLabel}`;
        const exhibitorHtml = `
          <h1>Sua reserva foi realizada com sucesso!</h1>
          <p>Olá, <strong>${owner.fullName}</strong>.</p>
          <p>Reservamos o slot <strong>${slotLabel}</strong> para você na feira <strong>${slot.fair.name}</strong>.</p>
          <p><strong>Tipo de barraca:</strong> ${finalTentType}</p>
          <p><strong>Valor:</strong> ${formattedPrice}</p>
          <p>Nossa equipe entrará em contato em breve para os próximos passos.</p>
          <br />
          <p>Atenciosamente,</p>
          <p><strong>Equipe Only in BR</strong></p>
        `;
        this.mail
          .sendMail(owner.email, exhibitorSubject, exhibitorHtml)
          .catch((err) => {
            this.logger.error(
              'Falha ao notificar expositor sobre reserva.',
              err,
            );
          });
      }

      return reservation;
    });
  }
}
