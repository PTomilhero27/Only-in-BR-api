import { Body, Controller, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtPayload } from 'src/common/types/jwt-payload.type';

import { OwnerFairPurchasesService } from './owner-fair-purchase.service';

import { SettleInstallmentsResponseDto } from './dto/settle-installments-response.dto';
import { SettleStallInstallmentsDto } from './dto/settle-stall-installments.dto';
import { RescheduleInstallmentDto } from './dto/reschedule-installment.dto';
import { CreateInstallmentPaymentDto } from './dto/create-installment-payment.dto';
import { InstallmentPaymentActionResponseDto } from './dto/installment-payment-action-response.dto';
import { CreatePurchaseAdjustmentDto } from './dto/create-purchase-adjustment.dto';

/**
 * Controller de ações financeiras por compra/parcela (OwnerFairPurchase).
 * Importante:
 * - Mantém o prefixo /fairs para NÃO quebrar o front.
 * - Centraliza regras de pagamento fora do FairsService.
 */
@ApiTags('OwnerFairPurchases')
@ApiBearerAuth()
@Controller('fairs')
export class OwnerFairPurchasesController {
  constructor(
    private readonly ownerFairPurchasesService: OwnerFairPurchasesService,
  ) {}

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
    return this.ownerFairPurchasesService.settleStallInstallments(
      fairId,
      ownerId,
      dto,
      user.id,
    );
  }

  @Patch(
    ':fairId/exhibitors/:ownerId/purchases/:purchaseId/installments/:number/reschedule',
  )
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
    return this.ownerFairPurchasesService.reschedulePurchaseInstallment(
      fairId,
      ownerId,
      purchaseId,
      Number(number),
      dto,
      user.id,
    );
  }

  @Post(
    ':fairId/exhibitors/:ownerId/purchases/:purchaseId/installments/:number/payments',
  )
  @ApiOperation({
    summary:
      'Registrar pagamento (histórico) em uma parcela (suporta parcial).',
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
    return this.ownerFairPurchasesService.createInstallmentPayment(
      fairId,
      ownerId,
      purchaseId,
      Number(number),
      dto,
      user.id,
    );
  }

  @Post(':fairId/exhibitors/:ownerId/purchases/:purchaseId/adjustments')
  @ApiOperation({
    summary: 'Criar ajuste financeiro (desconto ou acréscimo) na compra.',
  })
  @ApiCreatedResponse({ description: 'Ajuste criado com sucesso.' })
  @HttpCode(201)
  createPurchaseAdjustment(
    @Param('fairId') fairId: string,
    @Param('ownerId') ownerId: string,
    @Param('purchaseId') purchaseId: string,
    @Body() dto: CreatePurchaseAdjustmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ownerFairPurchasesService.createPurchaseAdjustment(
      fairId,
      ownerId,
      purchaseId,
      dto,
      user.id,
    );
  }
}
