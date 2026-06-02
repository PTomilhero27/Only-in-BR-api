import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtPayload } from 'src/common/types/jwt-payload.type';
import { InventoryService } from './inventory.service';
import { InventoryImportService } from './inventory-import.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { ListInventoryItemsDto } from './dto/list-inventory-items.dto';
import { InventoryItemResponseDto } from './dto/inventory-item-response.dto';
import { InventoryItemDetailsResponseDto } from './dto/inventory-item-details-response.dto';
import { CheckInventoryAvailabilityDto, InventoryAvailabilityResponseDto } from './dto/availability.dto';
import { CreateInventoryMovementDto } from '../inventory-movements/dto/create-inventory-movement.dto';
import { InventoryImportConfigDto } from './dto/inventory-import.dto';

/**
 * Controller administrativo de itens do estoque.
 * Expoe cadastro, consulta de disponibilidade e movimentacoes manuais; todas as rotas usam o JwtAuthGuard global.
 */
@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly service: InventoryService,
    private readonly importService: InventoryImportService,
  ) {}

  /** Gerar prévia da importação do estoque via planilha. */
  @Post('import/preview')
  @HttpCode(200)
  @ApiOperation({ summary: 'Gerar previa da importacao de itens do estoque.' })
  previewImport(@Body() dto: InventoryImportConfigDto) {
    return this.importService.preview(dto);
  }

  /** Confirmar importação do estoque via planilha. */
  @Post('import/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirmar importacao de itens do estoque.' })
  confirmImport(@Body() dto: InventoryImportConfigDto, @CurrentUser() user: JwtPayload) {
    return this.importService.confirm(dto, user.id);
  }

  /** Lista itens cadastrados com filtros para a tela de almoxarifado. */
  @Get('items')
  @ApiOperation({ summary: 'Listar itens de estoque.' })
  list(@Query() query: ListInventoryItemsDto) {
    return this.service.list(query);
  }

  /** Cria um item de estoque a partir do cadastro administrativo. */
  @Post('items')
  @HttpCode(201)
  @ApiOperation({ summary: 'Criar item de estoque.' })
  @ApiCreatedResponse({ type: InventoryItemResponseDto })
  create(@Body() dto: CreateInventoryItemDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.id);
  }

  /** Detalha um item com disponibilidade, reservas abertas e ultimas movimentacoes. */
  @Get('items/:id')
  @ApiOperation({ summary: 'Detalhar item de estoque.' })
  @ApiOkResponse({ type: InventoryItemDetailsResponseDto })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /** Edita dados cadastrais do item sem apagar historico operacional. */
  @Patch('items/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Editar item de estoque.' })
  update(@Param('id') id: string, @Body() dto: UpdateInventoryItemDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user.id);
  }

  /** Inativa item por soft delete para preservar movimentos e reservas. */
  @Delete('items/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inativar item de estoque.' })
  softDelete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.softDelete(id, user.id);
  }

  /** Registra entrada, ajuste ou dano manual para um item especifico. */
  @Post('items/:id/movements')
  @HttpCode(201)
  @ApiOperation({ summary: 'Registrar movimentacao manual de estoque.' })
  createMovement(
    @Param('id') id: string,
    @Body() dto: CreateInventoryMovementDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createManualMovement(id, dto, user.id);
  }

  /** Verifica disponibilidade em lote antes de criar/aprovar reservas. */
  @Post('availability/check')
  @HttpCode(200)
  @ApiOperation({ summary: 'Checar disponibilidade de itens.' })
  @ApiOkResponse({ type: InventoryAvailabilityResponseDto })
  async checkAvailability(@Body() dto: CheckInventoryAvailabilityDto) {
    return { items: await this.service.checkAvailability(dto.items) };
  }
}
