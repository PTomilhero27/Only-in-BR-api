import { ApiProperty } from '@nestjs/swagger'
import { OwnerFairPaymentStatus, StallSize } from '@prisma/client'
import { IsEnum, IsInt, IsString, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { ExhibitorFairPurchaseInstallmentDto } from './exhibitor-fair-purchase-installment.dto'

/**
 * Linha de compra (OwnerFairPurchase) para o portal.
 *
 * Por que existe:
 * - No Admin vocês optaram por NÃO agrupar compras.
 * - O portal consome linha por linha (purchaseId) ao vincular barracas.
 */
export class ExhibitorFairPurchaseDto {
  @ApiProperty({ example: 'ckx9p3z5p0001q8l1p2abcxyz', description: 'ID da compra.' })
  @IsString()
  id!: string

  @ApiProperty({ enum: StallSize, example: StallSize.SIZE_3X3, description: 'Tamanho comprado.' })
  @IsEnum(StallSize)
  stallSize!: StallSize

  @ApiProperty({ example: 1, description: 'Quantidade comprada nesta linha (recomendado = 1).' })
  @IsInt()
  @Min(1)
  qty!: number

  @ApiProperty({ example: 0, description: 'Quantidade já consumida por StallFair.' })
  @IsInt()
  @Min(0)
  usedQty!: number

  @ApiProperty({
    example: 1,
    description: 'Quantidade restante disponível (derivada: max(0, qty - usedQty)).',
  })
  @IsInt()
  @Min(0)
  remainingQty!: number

  @ApiProperty({ example: 150000, description: 'Preço unitário (centavos).' })
  @IsInt()
  @Min(0)
  unitPriceCents!: number

  @ApiProperty({ example: 150000, description: 'Total (centavos).' })
  @IsInt()
  @Min(0)
  totalCents!: number

  @ApiProperty({ example: 50000, description: 'Entrada paga (centavos).' })
  @IsInt()
  @Min(0)
  paidCents!: number

  @ApiProperty({ example: 2, description: 'Quantidade de parcelas do restante.' })
  @IsInt()
  @Min(0)
  installmentsCount!: number

  @ApiProperty({
    enum: OwnerFairPaymentStatus,
    example: OwnerFairPaymentStatus.PARTIALLY_PAID,
    description: 'Status financeiro desta compra.',
  })
  @IsEnum(OwnerFairPaymentStatus)
  status!: OwnerFairPaymentStatus

  @ApiProperty({
    type: [ExhibitorFairPurchaseInstallmentDto],
    description: 'Parcelas desta compra.',
  })
  @ValidateNested({ each: true })
  @Type(() => ExhibitorFairPurchaseInstallmentDto)
  installments!: ExhibitorFairPurchaseInstallmentDto[]
}
