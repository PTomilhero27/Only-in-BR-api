import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * DTO para editar um repasse de expositor.
 * Valores financeiros so podem mudar enquanto o repasse ainda esta pendente.
 */
export class UpdateExhibitorPayoutDto {
  @ApiPropertyOptional({
    description: 'Novo valor bruto ganho na feira, em centavos.',
    example: 1000000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  grossAmountCents?: number;

  @ApiPropertyOptional({
    description: 'Novo total de descontos antes do repasse, em centavos.',
    example: 50000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  discountAmountCents?: number;

  @ApiPropertyOptional({
    description: 'Novo ajuste manual opcional, positivo ou negativo.',
    example: 0,
  })
  @IsOptional()
  @IsInt()
  adjustmentAmountCents?: number;

  @ApiPropertyOptional({
    description: 'Nova data prevista para pagamento.',
    example: '2026-05-20T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @ApiPropertyOptional({
    description: 'Observacao interna do financeiro.',
    example: 'Ajuste por devolucao.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
