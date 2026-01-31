import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { OwnerFairItemDto } from './owner-fair-item.dto';

/**
 * Resposta para "listar feiras vinculadas a um interessado".
 */
export class ListOwnerFairsResponseDto {
  @ApiProperty({
    description: 'ID do Owner (interessado/expositor).',
    example: 'ckv_owner_123',
  })
  @IsString()
  @IsNotEmpty()
  ownerId!: string;

  @ApiProperty({
    description: 'Vínculos Owner↔Fair.',
    type: () => [OwnerFairItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OwnerFairItemDto)
  items!: OwnerFairItemDto[];
}
