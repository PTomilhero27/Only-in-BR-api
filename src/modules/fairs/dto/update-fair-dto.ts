import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { FairStatus } from '@prisma/client';
import { FairTaxUpsertDto } from './fair-tax.dto';

/**
 * DTO para atualização de uma feira (PATCH).
 *
 * Responsabilidade:
 * - Permitir edição parcial das informações básicas da feira.
 *
 * Decisões importantes:
 * - Este DTO NÃO permite editar ocorrências.
 * - Todos os campos são opcionais.
 *
 * Taxas:
 * - Se `taxes` vier:
 *   - id ausente => cria taxa
 *   - id presente => edita taxa (somente se não estiver em uso)
 *   - taxa existente que não vier na lista => tentativa de exclusão (somente se não estiver em uso)
 */
export class UpdateFairDto {
  @ApiPropertyOptional({
    example: 'Feira Gastronômica de Inverno',
    description: 'Novo nome da feira.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({
    example: 'Rua das Palmeiras, 500 - Centro',
    description: 'Novo endereço da feira.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  address?: string;

  @ApiPropertyOptional({
    enum: FairStatus,
    example: FairStatus.FINALIZADA,
    description: 'Novo status da feira.',
  })
  @IsOptional()
  @IsEnum(FairStatus)
  status?: FairStatus;

  @ApiPropertyOptional({
    example: 150,
    description: 'Capacidade máxima de barracas da feira.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  stallsCapacity?: number;

  @ApiPropertyOptional({
    type: [FairTaxUpsertDto],
    description: 'Lista final de taxas da feira (cria/edita/remove por diff).',
    example: [
      { id: 'tax-uuid-1', name: 'Taxa padrão', percentBps: 500 },
      { name: 'Taxa carrinho', percentBps: 700 },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FairTaxUpsertDto)
  taxes?: FairTaxUpsertDto[];
}
