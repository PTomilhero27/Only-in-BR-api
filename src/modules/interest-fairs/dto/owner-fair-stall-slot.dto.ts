import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, Min } from 'class-validator';
import { StallSize } from '@prisma/client';

/**
 * DTO de um item de compra por tamanho dentro do vínculo Owner ↔ Fair.
 *
 * Responsabilidade:
 * - Representar um "slot" (tamanho + quantidade + valor unitário)
 * - Ser reutilizado em create e update
 */
export class OwnerFairStallSlotDto {
  @ApiProperty({
    description: 'Tamanho da barraca comprado.',
    enum: StallSize,
    example: StallSize.SIZE_3X3,
  })
  @IsEnum(StallSize)
  stallSize!: StallSize;

  @ApiProperty({
    description: 'Quantidade comprada deste tamanho.',
    example: 2,
  })
  @IsInt()
  @Min(1)
  qty!: number;

  @ApiProperty({
    description: 'Valor unitário pago por este tamanho (em centavos).',
    example: 150000,
  })
  @IsInt()
  @Min(0)
  unitPriceCents!: number;
}
