import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsISO8601, IsString } from 'class-validator'
import { StallSize } from '@prisma/client'

/**
 * Barraca já vinculada à feira (StallFair + Stall).
 */
export class ExhibitorFairLinkedStallDto {
  @ApiProperty({
    description: 'ID da barraca.',
    example: 'ckz8y2w2k0001u9a9abcd1234',
  })
  @IsString()
  stallId: string

  @ApiProperty({
    description: 'Nome da barraca (PDV).',
    example: 'Pastel do Zé',
  })
  @IsString()
  pdvName: string

  @ApiProperty({
    enum: StallSize,
    description: 'Tamanho da barraca vinculada.',
    example: 'SIZE_3X3',
  })
  @IsEnum(StallSize)
  stallSize: StallSize

  @ApiProperty({
    description: 'Data/hora (ISO) em que a barraca foi vinculada na feira.',
    example: '2026-01-29T12:34:56.000Z',
  })
  @IsISO8601()
  linkedAt: string
}
