import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * DTO de Taxa (% sobre vendas) no contexto da Feira.
 *
 * Responsabilidade:
 * - Representar o payload de criação/edição de taxas no CRUD da feira.
 *
 * Decisão:
 * - Se `id` vier => é edição de uma taxa existente
 * - Se `id` não vier => é criação de uma nova taxa
 */
export class FairTaxUpsertDto {
  @ApiPropertyOptional({
    example: '9baf093e-1a44-4c20-8c45-2d8cf6b6a111',
    description:
      'ID da taxa. Se informado, indica edição. Se omitido, indica criação.',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({
    example: 'Taxa padrão',
    description: 'Nome exibido da taxa.',
  })
  @IsString()
  name!: string;

  @ApiProperty({
    example: 500,
    description:
      'Percentual em basis points (bps). Ex.: 500 = 5.00% | 250 = 2.50%',
  })
  @IsInt()
  @Min(1)
  @Max(10000)
  percentBps!: number;
}
