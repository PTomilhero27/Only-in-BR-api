import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  MarketplaceInterestStatus,
  MarketplaceSlotStatus,
} from '@prisma/client';

@Injectable()
export class AdminMarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async updateSlotPrice(fairMapSlotId: string, priceCents: number) {
    if (priceCents < 0) {
      throw new BadRequestException('Preço inválido.');
    }

    const slot = await this.prisma.fairMapSlot.findUnique({
      where: { id: fairMapSlotId },
    });

    if (!slot) {
      throw new NotFoundException('Slot não encontrado.');
    }

    return this.prisma.fairMapSlot.update({
      where: { id: fairMapSlotId },
      data: { priceCents },
    });
  }

  async updateSlotStatus(fairMapSlotId: string, status: MarketplaceSlotStatus) {
    const slot = await this.prisma.fairMapSlot.findUnique({
      where: { id: fairMapSlotId },
    });

    if (!slot) {
      throw new NotFoundException('Slot não encontrado.');
    }

    return this.prisma.fairMapSlot.update({
      where: { id: fairMapSlotId },
      data: { commercialStatus: status },
    });
  }

  async listFairInterests(fairId: string) {
    return this.prisma.marketplaceSlotInterest.findMany({
      where: { fairId },
      include: {
        owner: true,
        fairMapSlot: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listFairReservations(fairId: string) {
    return this.prisma.marketplaceSlotReservation.findMany({
      where: { fairId },
      include: {
        owner: true,
        fairMapSlot: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateInterestStatusAndExpiration(
    interestId: string,
    status: MarketplaceInterestStatus,
    expiresAt: Date | null,
  ) {
    const interest = await this.prisma.marketplaceSlotInterest.findUnique({
      where: { id: interestId },
      include: { fairMapSlot: true },
    });

    if (!interest) {
      throw new NotFoundException('Interesse não encontrado.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedInterest = await tx.marketplaceSlotInterest.update({
        where: { id: interestId },
        data: {
          status,
          expiresAt,
        },
      });

      // Se o admin setou o interesse para NEGOTIATING ou CONVERTED
      // E o slot estava AVAILABLE, o admin provavelmente quer trancar o mapa.
      // O admin já pode gerenciar o slot fisicamente no `updateSlotStatus`,
      // mas se estivermos em "NEGOTIATING", seria bom forçar "RESERVED".
      if (
        status === MarketplaceInterestStatus.NEGOTIATING &&
        interest.fairMapSlot.commercialStatus === MarketplaceSlotStatus.AVAILABLE
      ) {
        await tx.fairMapSlot.update({
          where: { id: interest.fairMapSlotId },
          data: { commercialStatus: MarketplaceSlotStatus.RESERVED },
        });
      }

      // Se confirmou a venda do interesse, passamos o Mapa para CONFIRMED
      if (
        status === MarketplaceInterestStatus.CONVERTED &&
        interest.fairMapSlot.commercialStatus !== MarketplaceSlotStatus.CONFIRMED
      ) {
        await tx.fairMapSlot.update({
          where: { id: interest.fairMapSlotId },
          data: { commercialStatus: MarketplaceSlotStatus.CONFIRMED },
        });
      }

      // Se dispensou ou expirou um interesse q tava em negociação
      if (
        (status === MarketplaceInterestStatus.DISMISSED || status === MarketplaceInterestStatus.EXPIRED) &&
        interest.fairMapSlot.commercialStatus === MarketplaceSlotStatus.RESERVED
      ) {
        await tx.fairMapSlot.update({
          where: { id: interest.fairMapSlotId },
          data: { commercialStatus: MarketplaceSlotStatus.AVAILABLE },
        });
      }

      return updatedInterest;
    });
  }
}
