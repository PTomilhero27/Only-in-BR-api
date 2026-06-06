import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class CreateInventoryCategoryDto {
  @ApiProperty({ example: 'Bebidas', description: 'Nome da categoria de estoque.' })
  @IsString()
  @MaxLength(100)
  name!: string;
}
