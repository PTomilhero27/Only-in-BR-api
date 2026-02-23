import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdjustmentType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * DTO para registrar ajuste financeiro em uma compra.
 * Pode ser desconto ou acréscimo.
 *
 * Importante:
 * - NÃO sobrescreve nada
 * - Sempre cria histórico
 */
export class CreatePurchaseAdjustmentDto {
  @ApiProperty({
    enum: AdjustmentType,
    example: AdjustmentType.DISCOUNT,
  })
  @IsEnum(AdjustmentType)
  type: AdjustmentType;

  @ApiProperty({
    example: 50000,
    description: 'Valor em centavos.',
  })
  @IsInt()
  @Min(1)
  amountCents: number;

  @ApiPropertyOptional({
    example: 'Desconto negociação antecipada',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
