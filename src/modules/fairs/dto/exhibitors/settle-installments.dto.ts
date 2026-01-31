import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  ValidateIf,
} from 'class-validator'

/**
 * Ação a ser aplicada nas parcelas.
 *
 * SET_PAID   → marca como paga
 * SET_UNPAID → desfaz pagamento
 *
 * Decisão:
 * - Usamos sobrescrita explícita para evitar endpoints duplicados
 *   (ex.: /pay e /unpay).
 */
export enum SettleInstallmentAction {
  SET_PAID = 'SET_PAID',
  SET_UNPAID = 'SET_UNPAID',
}

/**
 * DTO para sobrescrever o estado de parcelas de um plano de pagamento.
 *
 * Responsabilidade:
 * - Marcar OU desmarcar parcelas como pagas
 * - Permitir:
 *   - todas (payAll=true)
 *   - ou específicas (numbers=[...])
 *
 * Regras:
 * - É obrigatório informar:
 *   - payAll=true
 *   - OU numbers=[...]
 * - action define se é pagamento ou estorno lógico.
 *
 * Observação:
 * - paidAmountCents (se enviado) aplica o MESMO valor para todas as parcelas
 *   afetadas nesta operação (MVP).
 */
export class SettleInstallmentsDto {
  @ApiProperty({
    enum: SettleInstallmentAction,
    description: 'Ação a ser aplicada nas parcelas.',
    example: SettleInstallmentAction.SET_PAID,
  })
  @IsEnum(SettleInstallmentAction, {
    message: 'action deve ser SET_PAID ou SET_UNPAID.',
  })
  action!: SettleInstallmentAction

  @ApiPropertyOptional({
    description:
      'Se true, aplica a ação em TODAS as parcelas do plano (pagas ou em aberto, conforme action).',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'payAll deve ser boolean.' })
  payAll?: boolean

  @ApiPropertyOptional({
    description:
      'Números das parcelas (1..N) que devem receber a ação. Obrigatório se payAll não for true.',
    example: [1, 2],
    type: [Number],
  })
  @ValidateIf((v) => !v.payAll)
  @IsArray({ message: 'numbers deve ser um array.' })
  @IsInt({ each: true, message: 'Cada item de numbers deve ser inteiro.' })
  @IsPositive({ each: true, message: 'Cada item de numbers deve ser > 0.' })
  numbers?: number[]

  @ApiPropertyOptional({
    description:
      'Valor efetivamente pago (em centavos). Usado apenas quando action=SET_PAID. ' +
      'Se enviado, aplica o mesmo valor a todas as parcelas afetadas.',
    example: 400000,
  })
  @ValidateIf((v) => v.action === SettleInstallmentAction.SET_PAID)
  @IsOptional()
  @IsInt({ message: 'paidAmountCents deve ser inteiro.' })
  @IsPositive({ message: 'paidAmountCents deve ser > 0.' })
  paidAmountCents?: number

  @ApiPropertyOptional({
    description:
      'Data/hora do pagamento (ISO). Se não enviada, o backend usa a data atual.',
    example: '2026-01-29T14:30:00.000Z',
  })
  @ValidateIf((v) => v.action === SettleInstallmentAction.SET_PAID)
  @IsOptional()
  paidAt?: string
}
