import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InventoryMovementResponseDto } from './dto/inventory-movement-response.dto';
import { ListInventoryMovementsDto } from './dto/list-inventory-movements.dto';
import { InventoryMovementsService } from './inventory-movements.service';

/**
 * Controller administrativo do historico de estoque.
 * Expoe somente leitura; qualquer escrita de movimento passa pelo modulo de itens ou reservas.
 */
@ApiTags('InventoryMovements')
@ApiBearerAuth()
@Controller('inventory/movements')
export class InventoryMovementsController {
  constructor(private readonly service: InventoryMovementsService) {}

  /** Lista o historico completo de movimentacoes de estoque. */
  @Get()
  @ApiOperation({ summary: 'Listar movimentacoes de estoque.' })
  @ApiOkResponse({ type: [InventoryMovementResponseDto] })
  list(@Query() query: ListInventoryMovementsDto) {
    return this.service.list(query);
  }
}
