import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * DTO de parcela de fornecedor/prestador.
 * Cada parcela pode entrar separadamente em uma remessa PIX da feira.
 */
export class FairSupplierInstallmentDto {
  @ApiProperty({ description: 'Numero sequencial da parcela.', example: 1 })
  @IsInt()
  @Min(1)
  number!: number;

  @ApiProperty({
    description: 'Valor da parcela em centavos.',
    example: 250000,
  })
  @IsInt()
  @Min(1)
  amountCents!: number;

  @ApiPropertyOptional({
    description: 'Vencimento previsto da parcela.',
    example: '2026-05-10T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional({
    description: 'Descricao da parcela para exibicao na remessa.',
    example: 'Parcela 1 - Seguranca',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
