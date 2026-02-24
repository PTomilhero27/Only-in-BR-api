import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * MapElementStyleDto
 *
 * Representa o "style" persistido no MapTemplateElement.style (Json).
 *
 * Importante:
 * - O front usa este mesmo objeto para guardar metadados visuais do TEXT,
 *   como fontSize/boxed/padding/borderRadius.
 * - Como usamos ValidationPipe com forbidNonWhitelisted, precisamos declarar
 *   explicitamente essas propriedades para não dar erro 400.
 */
export class MapElementStyleDto {
  @ApiProperty({ example: '#CBD5E1' })
  @IsString()
  fill!: string;

  @ApiProperty({ example: '#0F172A' })
  @IsString()
  stroke!: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0)
  strokeWidth!: number;

  @ApiProperty({ example: 0.8 })
  @IsNumber()
  @Min(0)
  @Max(1)
  opacity!: number;

  // ===== Campos extras usados pelo TEXT (persistidos no mesmo JSON de style) =====

  @ApiPropertyOptional({
    example: 18,
    description: 'Opcional: tamanho da fonte (somente para TEXT).',
  })
  @IsOptional()
  @IsNumber()
  @Min(8)
  @Max(96)
  fontSize?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Opcional: se o TEXT renderiza com caixa (somente para TEXT).',
  })
  @IsOptional()
  @IsBoolean()
  boxed?: boolean;

  @ApiPropertyOptional({
    example: 10,
    description: 'Opcional: padding da caixa do TEXT.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  padding?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Opcional: borderRadius da caixa do TEXT.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  borderRadius?: number;
}
