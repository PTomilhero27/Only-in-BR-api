// src/modules/stalls/dto/list-stalls.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

/**
 * DTO de listagem de barracas (painel do expositor).
 *
 * Responsabilidade:
 * - Definir filtros/paginação para listar barracas do expositor autenticado.
 *
 * Decisão:
 * - ownerId NÃO vem do client (vem do JWT no backend).
 * - Este DTO é apenas para filtros opcionais.
 */
export class ListStallsDto {
  @ApiPropertyOptional({
    example: 'pastel',
    description:
      'Busca livre (case-insensitive) por nome do PDV, nome de banner, categoria principal etc.',
  })
  @IsOptional()
  @IsString({ message: 'q deve ser uma string' })
  q?: string

  @ApiPropertyOptional({
    example: 1,
    description: 'Página atual (>= 1).',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page deve ser um número inteiro' })
  @Min(1, { message: 'page deve ser >= 1' })
  page?: number

  @ApiPropertyOptional({
    example: 20,
    description: 'Tamanho da página (1..100).',
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize deve ser um número inteiro' })
  @Min(1, { message: 'pageSize deve ser >= 1' })
  @Max(100, { message: 'pageSize deve ser <= 100' })
  pageSize?: number

  @ApiPropertyOptional({
    example: 'updatedAt_desc',
    description: 'Ordenação suportada.',
    enum: ['updatedAt_desc', 'createdAt_desc'],
    default: 'updatedAt_desc',
  })
  @IsOptional()
  @IsIn(['updatedAt_desc', 'createdAt_desc'], {
    message: 'sort deve ser updatedAt_desc ou createdAt_desc',
  })
  sort?: 'updatedAt_desc' | 'createdAt_desc'
}
