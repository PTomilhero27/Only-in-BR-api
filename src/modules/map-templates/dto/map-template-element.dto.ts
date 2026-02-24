/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MapElementStyleDto } from './map-template-style.dto';
import { MapElementType } from '@prisma/client';

/**
 * DTO de elemento da planta.
 *
 * Importante:
 * - O front envia o `clientKey` como identificador estável (ex.: "el_xxx").
 * - O backend valida coerência por tipo (ex.: LINE precisa de points).
 */
export class MapTemplateElementDto {
  @ApiProperty({
    example: 'el_a1b2c3',
    description: 'Chave estável gerada no front para identificar o elemento.',
  })
  @IsString()
  clientKey!: string;

  @ApiProperty({
    enum: MapElementType,
    example: MapElementType.BOOTH_SLOT,
    description: 'Tipo do elemento do mapa (slot, retângulo, texto, etc.)',
  })
  @IsEnum(MapElementType)
  type!: MapElementType;

  @ApiProperty({
    example: 120.5,
    description: 'Posição X no mundo (coordenada absoluta)',
  })
  @IsNumber()
  x!: number;

  @ApiProperty({
    example: 340.2,
    description: 'Posição Y no mundo (coordenada absoluta)',
  })
  @IsNumber()
  y!: number;

  @ApiPropertyOptional({ example: 0, description: 'Rotação em graus' })
  @IsOptional()
  @IsNumber()
  rotation?: number;

  @ApiPropertyOptional({
    example: 44,
    description: 'Largura (para RECT/SQUARE/BOOTH_SLOT)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  width?: number;

  @ApiPropertyOptional({
    example: 32,
    description: 'Altura (para RECT/SQUARE/BOOTH_SLOT)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  height?: number;

  @ApiPropertyOptional({
    example: 'Palco',
    description:
      'Label textual (usado em RECT/SQUARE; BOOTH_SLOT normalmente não usa)',
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({
    example: 12,
    description: "Número (usado em BOOTH_SLOT para exibir '12' no desenho)",
  })
  @IsOptional()
  @IsInt()
  number?: number;

  @ApiPropertyOptional({
    example: [10, 10, 200, 200, 240, 180],
    description:
      'Pontos da linha no formato [x1,y1,x2,y2,...]. Obrigatório quando type=LINE.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(4)
  points?: number[];

  @ApiPropertyOptional({
    example: 14,
    description: 'Raio (usado quando type=TREE)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  radius?: number;

  @ApiProperty({
    type: MapElementStyleDto,
    description: 'Estilo básico do elemento (fill/stroke/strokeWidth/opacity).',
  })
  @ValidateNested()
  @Type(() => MapElementStyleDto)
  style!: MapElementStyleDto;

  @ApiPropertyOptional({
    example: true,
    description:
      'Se o elemento é linkável. Deve ser true somente para type=BOOTH_SLOT.',
  })
  @IsOptional()
  @IsBoolean()
  isLinkable?: boolean;
}
