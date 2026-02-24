import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateMapTemplateElementDto } from './create-map-template-element.dto';

/**
 * CreateMapTemplateDto
 *
 * Representa o payload para criação de uma nova Planta (MapTemplate).
 *
 * Decisões de domínio:
 * - O template pode ter 0 ou mais elementos.
 * - worldWidth/worldHeight têm defaults no service se não forem enviados.
 * - elements é obrigatório (mas pode ser []), para manter contrato explícito.
 */
export class CreateMapTemplateDto {
  @ApiProperty({
    example: 'Planta Principal 2026',
    description: 'Título da planta.',
  })
  @IsString()
  title!: string;

  @ApiPropertyOptional({
    example: 'Layout oficial da feira gastronômica.',
    description: 'Descrição opcional da planta.',
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.site.com/mapa.png',
    description:
      'URL opcional da imagem de fundo usada como referência visual.',
  })
  @IsOptional()
  @IsString()
  backgroundUrl?: string | null;

  @ApiPropertyOptional({
    example: 2000,
    description:
      'Largura base do mundo do mapa (em pixels). Default: 2000.',
  })
  @IsOptional()
  @IsInt()
  @Min(100)
  worldWidth?: number;

  @ApiPropertyOptional({
    example: 1200,
    description:
      'Altura base do mundo do mapa (em pixels). Default: 1200.',
  })
  @IsOptional()
  @IsInt()
  @Min(100)
  worldHeight?: number;

  @ApiProperty({
    type: [CreateMapTemplateElementDto],
    description:
      'Lista de elementos que compõem a planta (RECT, LINE, TREE, CIRCLE, BOOTH_SLOT etc).',
    example: [],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMapTemplateElementDto)
  elements!: CreateMapTemplateElementDto[];
}