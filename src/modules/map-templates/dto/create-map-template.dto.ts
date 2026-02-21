import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
 * DTO de criação de uma Planta (MapTemplate).
 * Este endpoint cria o "template reutilizável" do layout do evento.
 */
export class CreateMapTemplateDto {
  @ApiProperty({
    example: 'Planta Praça Central - 2026',
    description: 'Título amigável da planta (reutilizável entre feiras).',
  })
  @IsString()
  title!: string;

  @ApiPropertyOptional({
    example: 'Layout com palco, tendas e 40 slots de barracas.',
    description: 'Descrição opcional para facilitar identificação.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: '/maps/praca-central.png',
    description:
      'Referência opcional do background (não fazemos upload). Pode ser URL ou path conhecido pelo front.',
  })
  @IsOptional()
  @IsString()
  backgroundUrl?: string;

  @ApiPropertyOptional({
    example: 2000,
    description: 'Largura do mundo (coordenadas absolutas). Default: 2000.',
  })
  @IsOptional()
  @IsInt()
  @Min(200)
  @Max(20000)
  worldWidth?: number;

  @ApiPropertyOptional({
    example: 1200,
    description: 'Altura do mundo (coordenadas absolutas). Default: 1200.',
  })
  @IsOptional()
  @IsInt()
  @Min(200)
  @Max(20000)
  worldHeight?: number;

  @ApiProperty({
    type: [MapTemplateElementDto],
    description:
      'Lista de elementos do desenho. Pode ser vazia para começar do zero.',
  })
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => MapTemplateElementDto)
  elements!: MapTemplateElementDto[];
}
