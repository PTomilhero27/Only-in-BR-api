import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MarketplaceInterestStatus,
  MarketplaceSlotStatus,
  StallSize,
} from '@prisma/client';
import type { JwtPayload } from '../../common/types/jwt-payload.type';
import { PrismaService } from '../../prisma/prisma.service';
import { MarketplaceReservationConfirmationService } from './marketplace-reservation-confirmation.service';
import { ConfirmReservationDto } from './dto/confirm-reservation.dto';
import { NotifyMissingStallDto } from './dto/notify-missing-stall.dto';
import { MarketplaceMissingStallNotificationService } from './marketplace-missing-stall-notification.service';

@Injectable()
export class AdminMarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationConfirmation: MarketplaceReservationConfirmationService,
    private readonly missingStallNotification: MarketplaceMissingStallNotificationService,
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

  async updateSlotTentTypes(
    fairMapSlotId: string,
    configurations: { tentType: StallSize; priceCents: number }[],
  ) {
    const slot = await this.prisma.fairMapSlot.findUnique({
      where: { id: fairMapSlotId },
    });

    if (!slot) {
      throw new NotFoundException('Slot não encontrado.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.fairMapSlotTentType.deleteMany({
        where: { fairMapSlotId },
      });

      await tx.fairMapSlotTentType.createMany({
        data: configurations.map((configuration) => ({
          fairMapSlotId,
          tentType: configuration.tentType,
          priceCents: configuration.priceCents,
        })),
      });

      if (configurations.length > 0) {
        const minPrice = Math.min(
          ...configurations.map((configuration) => configuration.priceCents),
        );
        await tx.fairMapSlot.update({
          where: { id: fairMapSlotId },
          data: { priceCents: minPrice },
        });
      }

      return tx.fairMapSlot.findUnique({
        where: { id: fairMapSlotId },
        include: { allowedTentTypes: true },
      });
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
        stall: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async confirmReservation(
    reservationId: string,
    dto: ConfirmReservationDto,
    actor: JwtPayload,
  ) {
    return this.reservationConfirmation.confirm({
      reservationId,
      actorUserId: actor.id,
      source: 'ADMIN_PANEL',
      payment: {
        unitPriceCents: dto.unitPriceCents,
        paidCents: dto.paidCents,
        installmentsCount: dto.installmentsCount,
        installments: dto.installments,
        approval: {
          approved: true,
          approvedAt: new Date(),
          approvalReference: 'admin_manual_confirmation',
          provider: 'admin',
        },
      },
      binding: {
        stallId: dto.stallId,
      },
    });
  }

  async notifyMissingStall(
    reservationId: string,
    dto: NotifyMissingStallDto,
    actor: JwtPayload,
  ) {
    return this.missingStallNotification.notifyMissingStall({
      reservationId,
      actorUserId: actor.id,
      force: dto.force,
      notes: dto.notes,
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

      if (
        status === MarketplaceInterestStatus.NEGOTIATING &&
        interest.fairMapSlot.commercialStatus === MarketplaceSlotStatus.AVAILABLE
      ) {
        await tx.fairMapSlot.update({
          where: { id: interest.fairMapSlotId },
          data: { commercialStatus: MarketplaceSlotStatus.RESERVED },
        });
      }

      if (
        status === MarketplaceInterestStatus.CONVERTED &&
        interest.fairMapSlot.commercialStatus !== MarketplaceSlotStatus.CONFIRMED
      ) {
        await tx.fairMapSlot.update({
          where: { id: interest.fairMapSlotId },
          data: { commercialStatus: MarketplaceSlotStatus.CONFIRMED },
        });
      }

      if (
        (status === MarketplaceInterestStatus.DISMISSED ||
          status === MarketplaceInterestStatus.EXPIRED) &&
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
