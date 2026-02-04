import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/**
 * Parcela do plano de pagamento de UMA barraca vinculada na feira (StallFair).
 * - dueDate e paidAt são "date-only" no retorno (YYYY-MM-DD) para UI.
 */
export class OwnerFairStallInstallmentDto {
  @ApiProperty({ description: 'Número da parcela (1..N).', example: 1 })
  @IsInt()
  @Min(1)
  number!: number;

  @ApiProperty({ description: 'Data de vencimento (YYYY-MM-DD).', example: '2026-02-10' })
  @IsString()
  @IsNotEmpty()
  dueDate!: string;

  @ApiProperty({ description: 'Valor da parcela em centavos.', example: 25000 })
  @IsInt()
  @Min(0)
  amountCents!: number;

  @ApiPropertyOptional({
    description: 'Data de pagamento (YYYY-MM-DD) ou null se não pago.',
    example: '2026-02-10',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  paidAt!: string | null;

  @ApiPropertyOptional({
    description: 'Valor efetivamente pago em centavos (ou null).',
    example: 25000,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  paidAmountCents!: number | null;
}
