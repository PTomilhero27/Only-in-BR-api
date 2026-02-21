import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * DTO que representa o style básico usado no Konva.
 * Mantemos explícito para evitar “JSON solto” e ajudar no Swagger.
 */
export class MapTemplateStyleDto {
  @ApiProperty({
    example: '#CBD5E1',
    description: 'Cor de preenchimento (fill)',
  })
  @IsString()
  fill!: string;

  @ApiProperty({
    example: '#0F172A',
    description: 'Cor da borda/linha (stroke)',
  })
  @IsString()
  stroke!: string;

  @ApiProperty({ example: 2, description: 'Espessura da borda/linha' })
  @IsNumber()
  @Min(0)
  strokeWidth!: number;

  @ApiPropertyOptional({
    example: 0.85,
    description: 'Opacidade (0..1). Quando omitido, assume 1.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  opacity?: number;
}
