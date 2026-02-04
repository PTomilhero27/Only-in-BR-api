import { ApiProperty } from '@nestjs/swagger'
import { ArrayMinSize, IsArray, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { OwnerFairPurchaseDto } from './owner-fair-purchase.dto'

/**
 * DTO do fluxo do Admin:
 * - Vincula interessado (Owner) a uma feira (OwnerFair)
 * - Já salva as compras 1 por 1 (OwnerFairPurchase) e suas parcelas
 */
export class LinkInterestToFairDto {
  @ApiProperty({
    example: 'b494d390-dfb5-43c0-84b0-479259c79694',
    description: 'ID da feira (Fair).',
  })
  @IsString()
  fairId: string

  @ApiProperty({
    type: [OwnerFairPurchaseDto],
    description:
      'Lista de compras 1 por 1 (cada item vira uma linha OwnerFairPurchase).',
    example: [
      {
        stallSize: 'SIZE_3X3',
        unitPriceCents: 300000,
        paidCents: 100000,
        installmentsCount: 2,
        installments: [
          { number: 1, dueDate: '2026-02-03', amountCents: 100000 },
          { number: 2, dueDate: '2026-02-10', amountCents: 100000 },
        ],
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OwnerFairPurchaseDto)
  purchases: OwnerFairPurchaseDto[]
}
