import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * DTO para registrar quanto um expositor ganhou na feira.
 * O expositor ja existe como Owner/OwnerFair; aqui gravamos apenas o valor a repassar.
 */
export class CreateExhibitorPayoutDto {
  @ApiProperty({
    description:
      'ID do vinculo OwnerFair que identifica o expositor dentro da feira.',
    example: 'owner_fair_id',
  })
  @IsString()
  ownerFairId!: string;

  @ApiProperty({
    description: 'Valor bruto ganho pelo expositor na feira, em centavos.',
    example: 1000000,
  })
  @IsInt()
  @Min(0)
  grossAmountCents!: number;

  @ApiPropertyOptional({
    description: 'Descontos aplicados antes do repasse, em centavos.',
    example: 50000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  discountAmountCents?: number;

  @ApiPropertyOptional({
    description: 'Ajuste manual opcional. Pode ser positivo ou negativo.',
    example: 0,
  })
  @IsOptional()
  @IsInt()
  adjustmentAmountCents?: number;

  @ApiPropertyOptional({
    description: 'Data prevista para pagamento do repasse.',
    example: '2026-05-20T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional({
    description:
      'Observacao interna do financeiro sobre a origem/ajuste do valor.',
    example: 'Valor liquido apurado apos fechamento da feira.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
