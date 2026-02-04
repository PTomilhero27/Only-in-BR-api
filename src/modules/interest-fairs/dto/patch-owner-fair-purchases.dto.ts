import { ApiProperty } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { OwnerFairPurchaseLineDto } from './owner-fair-purchase-line.dto'

/**
 * ✅ PatchOwnerFairPurchasesDto
 *
 * Responsabilidade:
 * - Receber a lista completa (linhas) de compras da feira
 * - O endpoint faz "replace total" no banco
 */
export class PatchOwnerFairPurchasesDto {
  @ApiProperty({
    description:
      'Lista completa de compras (1 linha por barraca comprada). O backend fará replace total.',
    type: [OwnerFairPurchaseLineDto],
    example: {
      purchases: [
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
    },
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OwnerFairPurchaseLineDto)
  purchases!: OwnerFairPurchaseLineDto[]
}
