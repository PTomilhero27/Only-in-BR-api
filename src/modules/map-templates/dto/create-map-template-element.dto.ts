import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MapElementType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MapElementStyleDto } from './map-template-style.dto';

/**
 * CreateMapTemplateElementDto
 *
 * Representa 1 elemento da planta enviado pelo front.
 *
 * Regras de domínio:
 * - LINE → precisa de points (>=4 e par)
 * - TREE → precisa de radius
 * - CIRCLE → precisa de radius
 * - RECT/SQUARE/BOOTH_SLOT → precisam de width/height
 * - isLinkable=true → somente permitido para BOOTH_SLOT
 *
 * Observação:
 * Validações específicas por tipo são reforçadas no service (validateElements).
 */
export class CreateMapTemplateElementDto {
  @ApiProperty({
    example: 'el_abcd123',
    description:
      'Chave estável gerada no front. Usada para vínculo de slot (BOOTH_SLOT).',
  })
  @IsString()
  clientKey!: string;

  @ApiProperty({
    enum: MapElementType,
    example: MapElementType.RECT,
  })
  @IsEnum(MapElementType)
  type!: MapElementType;

  // =============================
  // Transform base
  // =============================

  @ApiProperty({ example: 100 })
  @IsNumber()
  x!: number;

  @ApiProperty({ example: 200 })
  @IsNumber()
  y!: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  rotation?: number;

  // =============================
  // RECT / SQUARE / BOOTH_SLOT
  // =============================

  @ApiPropertyOptional({
    example: 120,
    description:
      'Largura do elemento (obrigatório para RECT/SQUARE/BOOTH_SLOT).',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  width?: number;

  @ApiPropertyOptional({
    example: 80,
    description:
      'Altura do elemento (obrigatório para RECT/SQUARE/BOOTH_SLOT).',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  height?: number;

  @ApiPropertyOptional({
    example: 'Área Gourmet',
    description: 'Texto opcional exibido dentro do elemento.',
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Número da barraca (usado principalmente em BOOTH_SLOT).',
  })
  @IsOptional()
  @IsNumber()
  number?: number;

  // =============================
  // LINE
  // =============================

  @ApiPropertyOptional({
    type: [Number],
    example: [10, 10, 90, 90],
    description:
      'Somente LINE: array no formato [x1,y1,x2,y2,...] com tamanho par.',
  })
  @IsOptional()
  @IsArray()
  points?: number[];

  // =============================
  // TREE / CIRCLE
  // =============================

  @ApiPropertyOptional({
    example: 20,
    description:
      'Raio do elemento (obrigatório para TREE e CIRCLE).',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  radius?: number;

  // =============================
  // STYLE (JSON)
  // =============================

  @ApiProperty({
    type: MapElementStyleDto,
    description:
      'Objeto de estilo persistido como JSON no banco.',
  })
  @ValidateNested()
  @Type(() => MapElementStyleDto)
  style!: MapElementStyleDto;

  // =============================
  // BOOTH_SLOT
  // =============================

  @ApiPropertyOptional({
    example: true,
    description:
      'Define se o elemento é linkável. Somente permitido para BOOTH_SLOT.',
  })
  @IsOptional()
  @IsBoolean()
  isLinkable?: boolean;
}