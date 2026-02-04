import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsEnum, IsInt, IsOptional, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { StallSize } from '@prisma/client'
import { OwnerFairInstallmentDto } from './owner-fair-installment.dto'

/**
 * DTO de compra 1 por 1 (linha).
 *
 * Decisão:
 * - Não existe "qty" no input (o backend força qty = 1).
 * - Cada item do array purchases cria uma linha OwnerFairPurchase independente.
 */
export class OwnerFairPurchaseDto {
  @ApiProperty({
    enum: StallSize,
    example: StallSize.SIZE_3X3,
    description: 'Tamanho da barraca comprada (linha 1 por 1).',
  })
  @IsEnum(StallSize)
  stallSize: StallSize

  @ApiProperty({
    example: 300000,
    description: 'Valor da barraca (preço unitário) em centavos.',
  })
  @IsInt()
  @Min(0)
  unitPriceCents: number

  @ApiPropertyOptional({
    example: 100000,
    description:
      'Valor já pago (entrada) em centavos. Deve ser <= unitPriceCents.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  paidCents?: number

  @ApiPropertyOptional({
    example: 2,
    description:
      'Quantidade de parcelas do restante (0 se pago integralmente).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  installmentsCount?: number

  @ApiPropertyOptional({
    type: [OwnerFairInstallmentDto],
    description:
      'Lista de parcelas do restante. Obrigatória quando houver valor restante.',
    example: [
      { number: 1, dueDate: '2026-02-03', amountCents: 100000 },
      { number: 2, dueDate: '2026-02-10', amountCents: 100000 },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OwnerFairInstallmentDto)
  installments?: OwnerFairInstallmentDto[]
}
