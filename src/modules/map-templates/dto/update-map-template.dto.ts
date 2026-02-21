import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MapTemplateElementDto } from './map-template-element.dto';

/**
 * DTO de atualização da Planta.
 * Observação:
 * - Vamos fazer "replace" de elements (substitui tudo), incrementando version.
 * - Isso simplifica e evita merge parcial inconsistênte por enquanto.
 */
export class UpdateMapTemplateDto {
  @ApiPropertyOptional({ example: 'Planta Praça Central - 2026 (Rev. 2)' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    example: 'Revisão com mais tendas e slots reposicionados.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '/maps/praca-central-v2.png' })
  @IsOptional()
  @IsString()
  backgroundUrl?: string;

  @ApiPropertyOptional({ example: 2400 })
  @IsOptional()
  @IsInt()
  @Min(200)
  @Max(20000)
  worldWidth?: number;

  @ApiPropertyOptional({ example: 1400 })
  @IsOptional()
  @IsInt()
  @Min(200)
  @Max(20000)
  worldHeight?: number;

  @ApiPropertyOptional({
    type: [MapTemplateElementDto],
    description:
      'Quando enviado, substitui todos os elementos (replace) e incrementa version.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => MapTemplateElementDto)
  elements?: MapTemplateElementDto[];
}
