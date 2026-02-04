import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator'

export enum SettleInstallmentsAction {
  SET_PAID = 'SET_PAID',
  SET_UNPAID = 'SET_UNPAID',
}

/**
 * DTO: Atalho para marcar/desfazer parcelas como pagas (por COMPRA).
 *
 * Regras:
 * - purchaseId obrigatório
 * - action obrigatório
 * - payAll=true OU numbers=[...]
 * - paidAt é date-only (YYYY-MM-DD) quando action=SET_PAID (opcional)
 */
export class SettleStallInstallmentsDto {
  @ApiProperty({
    example: 'cm166ncpu0003rk906y96crjq',
    description: 'ID da compra (OwnerFairPurchase) que terá as parcelas afetadas.',
  })
  @IsString()
  purchaseId: string

  @ApiProperty({
    enum: SettleInstallmentsAction,
    example: SettleInstallmentsAction.SET_PAID,
    description: 'Ação: marcar como paga (SET_PAID) ou desfazer (SET_UNPAID).',
  })
  @IsEnum(SettleInstallmentsAction)
  action: SettleInstallmentsAction

  @ApiPropertyOptional({
    example: true,
    description:
      'Se true, aplica a ação em todas as parcelas da compra. Se não informado/false, use "numbers".',
  })
  @IsOptional()
  @IsBoolean()
  payAll?: boolean

  @ApiPropertyOptional({
    example: [1],
    description:
      'Números das parcelas (1..N). Obrigatório quando payAll !== true.',
    type: [Number],
  })
  @ValidateIf((o) => o.payAll !== true)
  @IsArray({ message: 'numbers must be an array' })
  @ArrayMinSize(1, { message: 'numbers must contain at least 1 elements' })
  @IsInt({ each: true })
  @Min(1, { each: true })
  @IsOptional()
  numbers?: number[]

  @ApiPropertyOptional({
    example: '2026-02-04',
    description:
      'Data do pagamento (date-only: YYYY-MM-DD). O backend normaliza para 00:00Z.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'paidAt deve estar no formato YYYY-MM-DD.',
  })
  paidAt?: string

  @ApiPropertyOptional({
    example: 100000,
    description:
      'Valor pago em centavos (opcional). No atalho, se omitido, o backend pode aplicar a lógica padrão.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  paidAmountCents?: number
}
