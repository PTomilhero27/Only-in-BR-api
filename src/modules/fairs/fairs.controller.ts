import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger'
import { FairStatus } from '@prisma/client'

import { FairsService } from './fairs.service'
import { CreateFairDto } from './dto/create-fair-dto'
import { UpdateFairDto } from './dto/update-fair-dto'
import { ListFairsDto } from './dto/list-fair-dto'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { JwtPayload } from 'src/common/types/jwt-payload.type'

import { UpdateExhibitorStatusDto } from './dto/exhibitors/update-exhibitor-status.dto'
import { FairExhibitorsResponseDto } from './dto/exhibitors/fair-exhibitors.dto'

import { SettleInstallmentsResponseDto } from './dto/exhibitors/settle-installments-response.dto'
import { SettleStallInstallmentsDto } from './dto/exhibitors/settle-stall-installments.dto'
import { RescheduleInstallmentDto } from './dto/exhibitors/reschedule-installment.dto'
import { CreateInstallmentPaymentDto } from './dto/exhibitors/create-installment-payment.dto'
import { InstallmentPaymentActionResponseDto } from './dto/exhibitors/installment-payment-action-response.dto'
import { UpdateOwnerFairObservationsDto } from './dto/exhibitors/update-ownerfair-observations.dto'

/**
 * Controller de Feiras.
 * Responsabilidade:
 * - CRUD de feiras
 * - Gestão de expositores por feira
 * - Ações financeiras por compra/parcela (com histórico)
 *
 * Observação de arquitetura:
 * - Este controller apenas faz “routing + validação via DTO”.
 * - Toda regra de negócio (inclusive validações do domínio) fica no service.
 */
@ApiTags('Fairs')
@ApiBearerAuth()
@Controller('fairs')
export class FairsController {
  constructor(private readonly fairsService: FairsService) {}

  // ---------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------

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

  // ---------------------------------------------------------
  // Expositores por feira
  // ---------------------------------------------------------

  @Get(':id/exhibitors')
  @ApiOperation({
    summary:
      'Listar expositores (owners) vinculados à feira com barracas, compras e informações de pagamento',
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

  // ---------------------------------------------------------
  // Ações financeiras (por compra / parcelas)
  // ---------------------------------------------------------

  @Patch(':fairId/exhibitors/:ownerId/payment/installments/settle')
  @ApiOperation({
    summary:
      'Atalho: marcar/desfazer parcelas como pagas por compra (OwnerFairPurchase).',
  })
  @ApiOkResponse({ type: SettleInstallmentsResponseDto })
  @HttpCode(200)
  settleInstallments(
    @Param('fairId') fairId: string,
    @Param('ownerId') ownerId: string,
    @Body() dto: SettleStallInstallmentsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.fairsService.settleStallInstallments(fairId, ownerId, dto, user.id)
  }

  @Patch(':fairId/exhibitors/:ownerId/purchases/:purchaseId/installments/:number/reschedule')
  @ApiOperation({
    summary: 'Reprogramar vencimento de uma parcela (negociação).',
  })
  @ApiOkResponse({ type: InstallmentPaymentActionResponseDto })
  @HttpCode(200)
  rescheduleInstallment(
    @Param('fairId') fairId: string,
    @Param('ownerId') ownerId: string,
    @Param('purchaseId') purchaseId: string,
    @Param('number') number: string,
    @Body() dto: RescheduleInstallmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.fairsService.reschedulePurchaseInstallment(
      fairId,
      ownerId,
      purchaseId,
      Number(number),
      dto,
      user.id,
    )
  }

  @Post(':fairId/exhibitors/:ownerId/purchases/:purchaseId/installments/:number/payments')
  @ApiOperation({
    summary: 'Registrar pagamento (histórico) em uma parcela (suporta parcial).',
  })
  @ApiCreatedResponse({ type: InstallmentPaymentActionResponseDto })
  @HttpCode(201)
  createInstallmentPayment(
    @Param('fairId') fairId: string,
    @Param('ownerId') ownerId: string,
    @Param('purchaseId') purchaseId: string,
    @Param('number') number: string,
    @Body() dto: CreateInstallmentPaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.fairsService.createInstallmentPayment(
      fairId,
      ownerId,
      purchaseId,
      Number(number),
      dto,
      user.id,
    )
  }


    /**
   * Atualiza as observações internas do admin para um expositor (Owner) dentro de uma feira.
   * Observação: estamos ancorando pelo par (fairId, ownerId) para evitar o client precisar do ownerFairId.
   */
  @Patch(':fairId/exhibitors/:ownerId/observations')
  @ApiOperation({
    summary: 'Atualizar observações do expositor na feira',
    description: 'Permite ao admin salvar observações no vínculo Owner ↔ Fair (OwnerFair).',
  })
  updateExhibitorObservations(
    @Param('fairId') fairId: string,
    @Param('ownerId') ownerId: string,
    @Body() dto: UpdateOwnerFairObservationsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.fairsService.updateExhibitorObservations({
      fairId,
      ownerId,
      observations: dto.observations ?? null,
      actorUserId: user.id,
    });
  }
}
