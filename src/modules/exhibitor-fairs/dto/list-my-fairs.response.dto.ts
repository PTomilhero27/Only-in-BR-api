import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, ValidateNested } from 'class-validator'

import { ExhibitorFairListItemDto } from './exhibitor-fair-list-item.dto'

/**
 * Response da listagem de feiras do expositor.
 * Mantém padrão com "items" para combinar com outros endpoints do portal.
 */
export class ListMyFairsResponseDto {
  @ApiProperty({
    type: [ExhibitorFairListItemDto],
    description: 'Lista de feiras vinculadas ao expositor logado.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExhibitorFairListItemDto)
  items: ExhibitorFairListItemDto[]
}
