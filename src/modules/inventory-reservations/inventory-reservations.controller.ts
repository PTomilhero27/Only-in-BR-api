import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtPayload } from 'src/common/types/jwt-payload.type';
import { ApproveInventoryReservationDto } from './dto/approve-inventory-reservation.dto';
import { CancelInventoryReservationDto } from './dto/cancel-inventory-reservation.dto';
import { CreateInventoryReservationDto } from './dto/create-inventory-reservation.dto';
import { InventoryReservationDetailsResponseDto } from './dto/inventory-reservation-details-response.dto';
import { InventoryReservationResponseDto } from './dto/inventory-reservation-response.dto';
import { ListInventoryReservationsDto } from './dto/list-inventory-reservations.dto';
import { PickupInventoryReservationDto } from './dto/pickup-inventory-reservation.dto';
import { ReturnInventoryReservationDto } from './dto/return-inventory-reservation.dto';
import { InventoryReservationsService } from './inventory-reservations.service';

/**
 * Controller administrativo das reservas de estoque.
 * Cada endpoint representa uma etapa operacional do almoxarifado e permanece protegido pelo guard global.
 */
@ApiTags('InventoryReservations')
@ApiBearerAuth()
@Controller('inventory/reservations')
export class InventoryReservationsController {
  constructor(private readonly service: InventoryReservationsService) {}

  /** Lista reservas para acompanhamento operacional. */
  @Get()
  @ApiOperation({ summary: 'Listar reservas de estoque.' })
  @ApiOkResponse({ type: [InventoryReservationResponseDto] })
  list(@Query() query: ListInventoryReservationsDto) {
    return this.service.list(query);
  }

  /** Cria uma reserva em lote sem baixar o estoque. */
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Criar reserva de estoque.' })
  @ApiCreatedResponse({ type: InventoryReservationDetailsResponseDto })
  create(@Body() dto: CreateInventoryReservationDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.id);
  }

  /** Detalha reserva com itens e historico. */
  @Get(':id')
  @ApiOperation({ summary: 'Detalhar reserva de estoque.' })
  @ApiOkResponse({ type: InventoryReservationDetailsResponseDto })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /** Aprova reserva e bloqueia disponibilidade. */
  @Patch(':id/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Aprovar reserva de estoque.' })
  approve(@Param('id') id: string, @Body() dto: ApproveInventoryReservationDto, @CurrentUser() user: JwtPayload) {
    return this.service.approve(id, dto, user.id);
  }

  /** Marca reserva como em separacao. */
  @Patch(':id/separating')
  @HttpCode(200)
  @ApiOperation({ summary: 'Marcar reserva como em separacao.' })
  markSeparating(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.markSeparating(id, user.id);
  }

  /** Marca reserva como pronta para retirada. */
  @Patch(':id/ready')
  @HttpCode(200)
  @ApiOperation({ summary: 'Marcar reserva como pronta para retirada.' })
  markReady(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.markReady(id, user.id);
  }

  /** Registra retirada, baixa estoque e gera movimentos OUT. */
  @Patch(':id/pickup')
  @HttpCode(200)
  @ApiOperation({ summary: 'Marcar retirada da reserva.' })
  pickup(@Param('id') id: string, @Body() dto: PickupInventoryReservationDto, @CurrentUser() user: JwtPayload) {
    return this.service.pickup(id, dto, user.id);
  }

  /** Registra devolucao, perdas, consumo e danos. */
  @Patch(':id/return')
  @HttpCode(200)
  @ApiOperation({ summary: 'Registrar devolucao da reserva.' })
  returnItems(@Param('id') id: string, @Body() dto: ReturnInventoryReservationDto, @CurrentUser() user: JwtPayload) {
    return this.service.returnItems(id, dto, user.id);
  }

  /** Cancela reserva ainda nao retirada. */
  @Patch(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancelar reserva de estoque.' })
  cancel(@Param('id') id: string, @Body() dto: CancelInventoryReservationDto, @CurrentUser() user: JwtPayload) {
    return this.service.cancel(id, dto, user.id);
  }
}
