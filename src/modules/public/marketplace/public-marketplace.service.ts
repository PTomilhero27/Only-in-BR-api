import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MarketplaceExpirationService } from '../../marketplace/marketplace-expiration.service';

@Injectable()
export class PublicMarketplaceService {
  constructor(
    private prisma: PrismaService,
    private expirationService: MarketplaceExpirationService,
  ) {}

  async getFairInfo(fairId: string) {
    const fair = await this.prisma.fair.findUnique({
      where: { id: fairId },
      select: {
        id: true,
        name: true,
        status: true,
        address: true,
        fairMap: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!fair) {
      throw new NotFoundException('Feira não encontrada ou não disponível.');
    }

    return fair;
  }

  async getFairMap(fairId: string) {
    await this.expirationService.validateAndExpireSlots(fairId);

    const fairMap = await this.prisma.fairMap.findUnique({
      where: { fairId },
      include: {
        template: {
          include: {
            elements: true,
          },
        },
        slots: {
          where: { isPublic: true },
          select: {
            id: true,
            fairMapElementId: true,
            code: true,
            label: true,
            priceCents: true,
            commercialStatus: true,
            allowedTentTypes: true,
          },
        },
      },
    });

    if (!fairMap) {
      throw new NotFoundException('Mapa da feira não encontrado.');
    }

    return fairMap;
  }
}
