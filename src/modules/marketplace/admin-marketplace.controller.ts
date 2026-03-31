import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MarketplaceInterestStatus, MarketplaceSlotStatus } from '@prisma/client';
import { AdminMarketplaceService } from './admin-marketplace.service';

@ApiTags('Admin Marketplace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/marketplace')
export class AdminMarketplaceController {
  constructor(private readonly service: AdminMarketplaceService) {}

  @Patch('slots/:slotId/price')
  @HttpCode(200)
  @ApiOperation({ summary: 'Edita o preço do slot.' })
  updateSlotPrice(
    @Param('slotId') slotId: string,
    @Body('priceCents') priceCents: number,
  ) {
    return this.service.updateSlotPrice(slotId, priceCents);
  }

  @Patch('slots/:slotId/status')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Muda forçadamente o status comercial do slot no mapa.',
  })
  updateSlotStatus(
    @Param('slotId') slotId: string,
    @Body('status') status: MarketplaceSlotStatus,
  ) {
    return this.service.updateSlotStatus(slotId, status);
  }

  @Post('slots/:slotId/block')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bloqueia temporariamente um slot.' })
  blockSlot(@Param('slotId') slotId: string) {
    return this.service.updateSlotStatus(slotId, MarketplaceSlotStatus.BLOCKED);
  }

  @Post('slots/:slotId/unblock')
  @HttpCode(200)
  @ApiOperation({ summary: 'Libera temporariamente um slot.' })
  unblockSlot(@Param('slotId') slotId: string) {
    return this.service.updateSlotStatus(
      slotId,
      MarketplaceSlotStatus.AVAILABLE,
    );
  }

  @Get('fairs/:fairId/interests')
  @ApiOperation({ summary: 'Lista os interessados em slots desta feira.' })
  listInterests(@Param('fairId') fairId: string) {
    return this.service.listFairInterests(fairId);
  }

  @Get('fairs/:fairId/reservations')
  @ApiOperation({
    summary: 'Lista as reservas ativas, expiradas de slots desta feira.',
  })
  listReservations(@Param('fairId') fairId: string) {
    return this.service.listFairReservations(fairId);
  }

  @Patch('interests/:id/status-and-expiration')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Muda o status do lead/interesse e opcionalmente adiciona uma expiração (ex: negociação -> trava mapa temporariamente).',
  })
  updateInterestStatus(
    @Param('id') interestId: string,
    @Body()
    body: {
      status: MarketplaceInterestStatus;
      expiresAt?: string;
    },
  ) {
    const parsedDate = body.expiresAt ? new Date(body.expiresAt) : null;
    return this.service.updateInterestStatusAndExpiration(
      interestId,
      body.status,
      parsedDate,
    );
  }
}
