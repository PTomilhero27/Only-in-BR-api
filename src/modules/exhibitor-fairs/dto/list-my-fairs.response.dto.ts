import { ApiProperty } from '@nestjs/swagger'
import { ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { ExhibitorFairListItemDto } from './exhibitor-fair-list-item.dto'

/**
 * Response da listagem de feiras do expositor no portal.
 */
export class ListMyFairsResponseDto {
  @ApiProperty({
    type: [ExhibitorFairListItemDto],
    description: 'Lista de feiras vinculadas ao expositor.',
  })
  @ValidateNested({ each: true })
  @Type(() => ExhibitorFairListItemDto)
  items!: ExhibitorFairListItemDto[]
}
