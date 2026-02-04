import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { StallSize } from '@prisma/client'
import { OwnerFairPurchaseInstallmentDto } from './owner-fair-purchase-installment.dto'

/**
 * ✅ OwnerFairPurchaseLineDto
 *
 * Representa 1 compra (1 linha) de barraca.
 * Decisão:
 * - Cada linha equivale a 1 unidade vendida no admin (qty = 1 no banco).
 */
export class OwnerFairPurchaseLineDto {
  @ApiProperty({
    description: 'Tamanho da barraca comprado.',
    enum: StallSize,
    example: 'SIZE_3X3',
  })
  @IsEnum(StallSize)
  stallSize!: StallSize

  @ApiProperty({
    description: 'Preço unitário da barraca (em centavos).',
    example: 300000,
  })
  @IsInt()
  @Min(0)
  unitPriceCents!: number

  @ApiPropertyOptional({
    description: 'Valor pago no ato (entrada), em centavos.',
    example: 100000,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  paidCents?: number

  @ApiPropertyOptional({
    description:
      'Quantidade de parcelas do restante (0..12). Se houver restante, deve ser > 0.',
    example: 2,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  installmentsCount?: number

  @ApiPropertyOptional({
    description:
      'Lista de parcelas. Obrigatório quando installmentsCount > 0. Deve ter exatamente N itens.',
    type: [OwnerFairPurchaseInstallmentDto],
    example: [
      { number: 1, dueDate: '2026-02-03', amountCents: 100000 },
      { number: 2, dueDate: '2026-02-10', amountCents: 100000 },
    ],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => OwnerFairPurchaseInstallmentDto)
  installments?: OwnerFairPurchaseInstallmentDto[]
}
