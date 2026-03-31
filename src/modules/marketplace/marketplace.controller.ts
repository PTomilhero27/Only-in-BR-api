import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MarketplaceService } from './marketplace.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Marketplace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly service: MarketplaceService) {}

  @Post('slots/:slotId/interests')
  @ApiOperation({ summary: 'Demonstra interesse em um slot do mapa' })
  async createInterest(
    @Param('slotId') slotId: string,
    @Body('message') message: string,
    @CurrentUser() user: any,
  ) {
    return this.service.createInterest(user.ownerId, slotId, message);
  }

  @Post('slots/:slotId/reservations')
  @ApiOperation({ summary: 'Reserva um slot do mapa temporariamente' })
  async createReservation(
    @Param('slotId') slotId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.createReservation(user.ownerId, slotId);
  }
}
