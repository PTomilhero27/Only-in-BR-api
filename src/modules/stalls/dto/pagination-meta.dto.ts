// src/modules/stalls/dto/pagination-meta.dto.ts
import { ApiProperty } from '@nestjs/swagger'
import { IsInt, Min } from 'class-validator'

/**
 * Meta de paginação padrão.
 *
 * Responsabilidade:
 * - Padronizar informações de paginação em respostas.
 */
export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: 'Página atual (>= 1).' })
  @IsInt({ message: 'page deve ser inteiro' })
  @Min(1, { message: 'page deve ser >= 1' })
  page!: number

  @ApiProperty({ example: 20, description: 'Quantidade por página.' })
  @IsInt({ message: 'pageSize deve ser inteiro' })
  @Min(1, { message: 'pageSize deve ser >= 1' })
  pageSize!: number

  @ApiProperty({ example: 45, description: 'Total de itens encontrados.' })
  @IsInt({ message: 'totalItems deve ser inteiro' })
  @Min(0, { message: 'totalItems deve ser >= 0' })
  totalItems!: number

  @ApiProperty({ example: 3, description: 'Total de páginas.' })
  @IsInt({ message: 'totalPages deve ser inteiro' })
  @Min(1, { message: 'totalPages deve ser >= 1' })
  totalPages!: number
}
