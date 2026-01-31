// src/modules/stalls/dto/list-stalls-response.dto.ts
import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, ValidateNested } from 'class-validator'
import { StallListItemDto } from './stall-list-item.dto'
import { PaginationMetaDto } from './pagination-meta.dto'

/**
 * DTO de resposta paginada para listagem de barracas.
 *
 * Responsabilidade:
 * - Padronizar resposta (items + meta).
 */
export class ListStallsResponseDto {
  @ApiProperty({ type: [StallListItemDto] })
  @IsArray({ message: 'items deve ser um array' })
  @ValidateNested({ each: true })
  @Type(() => StallListItemDto)
  items!: StallListItemDto[]

  @ApiProperty({
    type: PaginationMetaDto,
    example: { page: 1, pageSize: 20, totalItems: 45, totalPages: 3 },
  })
  @ValidateNested()
  @Type(() => PaginationMetaDto)
  meta!: PaginationMetaDto
}
