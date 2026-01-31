// src/modules/interests/dto/list-interests-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { ListInterestsItemDto } from './list-interests-item.dto';

/**
 * DTO de resposta paginada do GET /interests (painel).
 *
 * Decisão:
 * - Mantém `meta` com page, pageSize e totais para paginação padrão do front.
 */
export class ListInterestsResponseDto {
  @ApiProperty({ type: [ListInterestsItemDto] })
  items: ListInterestsItemDto[];

  @ApiProperty({
    example: { page: 1, pageSize: 20, totalItems: 120, totalPages: 6 },
  })
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
