// src/modules/interests/dto/list-interests.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * DTO de query params para listagem de interessados (painel admin).
 *
 * Responsabilidade:
 * - Validar paginação, ordenação e busca.
 *
 * Decisão:
 * - `q` é busca livre (nome/email/cidade/documento).
 * - `sort` é um enum de strings (mais simples para o front).
 *
 * Observação importante:
 * - Query params chegam como string no Nest.
 * - Por isso usamos class-transformer para converter `page` e `pageSize` para number.
 */
export class ListInterestsDto {
  @ApiPropertyOptional({
    description: 'Busca livre por nome, e-mail, cidade e documento.',
    example: 'heloisa',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  /**
   * Página (1-based).
   */
  @ApiPropertyOptional({ description: 'Página (1-based).', default: 1, example: 1 })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value)))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  /**
   * Tamanho da página.
   */
  @ApiPropertyOptional({ description: 'Itens por página.', default: 20, example: 20 })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value)))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  /**
   * Ordenação do grid.
   */
  @ApiPropertyOptional({
    description: 'Ordenação suportada.',
    default: 'updatedAt_desc',
    enum: ['updatedAt_desc', 'createdAt_desc'],
  })
  @IsOptional()
  @IsIn(['updatedAt_desc', 'createdAt_desc'])
  sort?: 'updatedAt_desc' | 'createdAt_desc';
}
