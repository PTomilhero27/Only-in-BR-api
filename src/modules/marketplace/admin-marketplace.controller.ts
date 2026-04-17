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
import {
  MarketplaceInterestStatus,
  MarketplaceSlotStatus,
} from '@prisma/client';
import { AdminMarketplaceService } from './admin-marketplace.service';
import { UpdateSlotTentTypesDto } from './dto/update-slot-tent-types.dto';
import { ConfirmReservationDto } from './dto/confirm-reservation.dto';
import { NotifyMissingStallDto } from './dto/notify-missing-stall.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/types/jwt-payload.type';

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

  @Patch('slots/:slotId/tent-types')
  @HttpCode(200)
  @ApiOperation({ summary: 'Configura tipos de barraca permitidos e preços.' })
  updateSlotTentTypes(
    @Param('slotId') slotId: string,
    @Body() dto: UpdateSlotTentTypesDto,
  ) {
    return this.service.updateSlotTentTypes(slotId, dto.configurations);
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

  @Post('reservations/:id/confirm')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Confirma uma reserva e converte para vínculo na feira, compra financeira e barraca vinculada quando existir.',
  })
  confirmReservation(
    @Param('id') reservationId: string,
    @Body() dto: ConfirmReservationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.confirmReservation(reservationId, dto, user);
  }

  @Post('reservations/:id/notify-missing-stall')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Envia alerta por e-mail ao expositor quando o slot estiver confirmado, mas ainda sem barraca vinculada.',
  })
  notifyMissingStall(
    @Param('id') reservationId: string,
    @Body() dto: NotifyMissingStallDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.notifyMissingStall(reservationId, dto, user);
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
