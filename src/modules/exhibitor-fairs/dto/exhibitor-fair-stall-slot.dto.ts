import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsInt, Min } from 'class-validator'
import { StallSize } from '@prisma/client'

/**
 * Representa um slot comprado pelo expositor na feira (por tamanho).
 * Ex.: SIZE_3X3 qty=2 unitPriceCents=12000.
 */
export class ExhibitorFairStallSlotDto {
  @ApiProperty({
    enum: StallSize,
    description: 'Tamanho da barraca comprado nesta feira.',
    example: 'SIZE_3X3',
  })
  @IsEnum(StallSize, { message: 'stallSize inválido.' })
  stallSize: StallSize

  @ApiProperty({
    description: 'Quantidade comprada deste tamanho.',
    example: 2,
  })
  @IsInt({ message: 'qty deve ser um inteiro.' })
  @Min(0, { message: 'qty não pode ser negativo.' })
  qty: number

  @ApiProperty({
    description: 'Preço unitário pago por barraca deste tamanho (em centavos).',
    example: 12000,
  })
  @IsInt({ message: 'unitPriceCents deve ser um inteiro.' })
  @Min(0, { message: 'unitPriceCents não pode ser negativo.' })
  unitPriceCents: number
}
