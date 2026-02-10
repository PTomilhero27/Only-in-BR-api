import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * DTO de geração de exportação Excel.
 *
 * Regras do MVP:
 * - templateId obrigatório
 * - fairId obrigatório (contexto base)
 * - ownerId opcional (exporta para 1 expositor)
 */
export class CreateExcelExportDto {
  @ApiProperty({
    description: 'ID do template de Excel.',
    example: '9a2b1b1a-8f12-4b33-9a7f-3d1e9c1a2b3c',
  })
  @IsString()
  @IsUUID()
  templateId!: string;

  @ApiProperty({
    description: 'ID da feira (contexto obrigatório).',
    example: '2b5a0d6a-3c79-4ab0-9b3d-2b40d2a1f111',
  })
  @IsString()
  @IsUUID()
  fairId!: string;

  @ApiPropertyOptional({
    description:
      'ID do expositor (Owner). Se informado, exporta apenas para esse expositor.',
    example: 'ckx1abcde0001k9qwe1234567',
  })
  @IsOptional()
  @IsString()
  ownerId?: string;
}
