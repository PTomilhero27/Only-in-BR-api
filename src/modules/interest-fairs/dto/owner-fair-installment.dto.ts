import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * DTO de uma parcela do plano de pagamento do vínculo Owner ↔ Fair.
 *
 * Convenção:
 * - dueDate: "YYYY-MM-DD"
 * - paidAt: "YYYY-MM-DD" (quando marcado como pago)
 *
 * Observação:
 * - No banco, dueDate/paidAt são DateTime.
 * - No contrato HTTP usamos date-only (melhor para UI e validação).
 */
export class OwnerFairInstallmentDto {
  @ApiProperty({
    description: 'Número da parcela (1..12).',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @Max(12)
  number!: number;

  @ApiProperty({
    description: 'Data de vencimento (YYYY-MM-DD).',
    example: '2026-01-30',
  })
  @IsString()
  dueDate!: string;

  @ApiProperty({
    description: 'Valor previsto da parcela (em centavos).',
    example: 400000,
  })
  @IsInt()
  @Min(0)
  amountCents!: number;

  @ApiPropertyOptional({
    description:
      'Data em que a parcela foi paga (YYYY-MM-DD). Null/ausente = ainda não paga.',
    example: '2026-01-30',
  })
  @IsOptional()
  @IsString()
  paidAt?: string | null;

  @ApiPropertyOptional({
    description:
      'Valor efetivamente pago (em centavos). Útil para divergências/ajustes.',
    example: 400000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  paidAmountCents?: number | null;
}
