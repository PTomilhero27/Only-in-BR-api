import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger'
import { FairsService } from './fairs.service'
import { CreateFairDto } from './dto/create-fair-dto'
import { UpdateFairDto } from './dto/update-fair-dto'
import { ListFairsDto } from './dto/list-fair-dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { JwtPayload } from 'src/common/types/jwt-payload.type'
import { UpdateExhibitorStatusDto } from './dto/exhibitors/update-exhibitor-status.dto'
import { FairExhibitorsResponseDto } from './dto/exhibitors/fair-exhibitors.dto'
import { SettleInstallmentsDto } from './dto/exhibitors/settle-installments.dto'
import { SettleInstallmentsResponseDto } from './dto/exhibitors/settle-installments-response.dto'
import { FairStatus } from '@prisma/client'

/**
 * Controller de Feiras.
 * Responsabilidade:
 * - Expor endpoints de CRUD de feiras (sempre autenticados)
 * - Expor endpoints de gestão de expositores dentro de uma feira
 *
 * Observação:
 * - A capacidade de barracas (stallsCapacity) é definida na criação/edição da feira.
 * - A validação de limite ao vincular expositor é feita no módulo do vínculo (OwnerFair),
 *   pois é lá que a reserva efetivamente acontece.
 */
@ApiTags('Fairs')
@ApiBearerAuth()
@Controller('fairs')
export class FairsController {
  constructor(private readonly fairsService: FairsService) {}

  @HttpCode(200)
  @Post()
  @ApiOperation({ summary: 'Criar feira' })
  @ApiCreatedResponse({ description: 'Feira criada com sucesso.' })
  create(@Body() dto: CreateFairDto, @CurrentUser() user: JwtPayload) {
    return this.fairsService.create(dto, user.id)
  }

  @HttpCode(200)
  @Patch(':id')
  @ApiOperation({ summary: 'Editar feira' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFairDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.fairsService.update(id, dto, user.id)
  }

  @HttpCode(200)
  @Get()
  @ApiOperation({ summary: 'Listar feiras' })
  @ApiQuery({ name: 'status', required: false, enum: FairStatus })
  list(@Query() query: ListFairsDto) {
    return this.fairsService.list(query)
  }

  @Get(':id/exhibitors')
  @ApiOperation({
    summary:
      'Listar expositores (owners) vinculados à feira com barracas, compra e informações de pagamento',
  })
  @ApiOkResponse({ type: FairExhibitorsResponseDto })
  listExhibitors(@Param('id') fairId: string) {
    return this.fairsService.listExhibitorsWithStalls(fairId)
  }

  @Patch(':fairId/exhibitors/:ownerId/status')
  @ApiOperation({ summary: 'Editar status do expositor dentro da feira' })
  @HttpCode(200)
  updateExhibitorStatus(
    @Param('fairId') fairId: string,
    @Param('ownerId') ownerId: string,
    @Body() dto: UpdateExhibitorStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.fairsService.updateExhibitorStatus(fairId, ownerId, dto, user.id)
  }

  @Patch(':fairId/exhibitors/:ownerId/payment/installments/settle')
  @ApiOperation({
    summary:
      'Sobrescrever pagamento de parcelas do expositor (marcar como paga / desfazer)',
  })
  @ApiOkResponse({ type: SettleInstallmentsResponseDto })
  @HttpCode(200)
  settleInstallments(
    @Param('fairId') fairId: string,
    @Param('ownerId') ownerId: string,
    @Body() dto: SettleInstallmentsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.fairsService.settleInstallments(fairId, ownerId, dto, user.id)
  }
}
