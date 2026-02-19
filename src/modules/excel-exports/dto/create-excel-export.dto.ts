import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

/**
 * DTO de geração de exportação Excel.
 *
 * Modelo (para crescer depois):
 * - templateId obrigatório
 * - scope: parâmetros de contexto (fairId hoje é obrigatório)
 *   - ownerId opcional: exporta só 1 expositor dentro da feira
 *
 * No futuro:
 * - scope pode suportar { ownerId } sem fairId (expositor em várias feiras)
 * - scope pode suportar { stallId } etc.
 */
class ExcelExportScopeDto {
  @ApiProperty({
    description: 'ID da feira (contexto obrigatório no MVP atual).',
    example: '2b5a0d6a-3c79-4ab0-9b3d-2b40d2a1f111',
  })
  @IsString()
  @IsUUID()
  fairId!: string;

  @ApiPropertyOptional({
    description:
      'ID do expositor (Owner). Se informado, exporta apenas para esse expositor dentro da feira.',
    example: 'ckx1abcde0001k9qwe1234567',
  })
  @IsOptional()
  @IsString()
  ownerId?: string;
}

export class CreateExcelExportDto {
  @ApiProperty({
    description: 'ID do template de Excel.',
    example: '9a2b1b1a-8f12-4b33-9a7f-3d1e9c1a2b3c',
  })
  @IsString()
  @IsUUID()
  templateId!: string;

  @ApiProperty({
    description: 'Escopo da exportação (contexto de dados).',
    type: ExcelExportScopeDto,
  })
  @ValidateNested()
  @Type(() => ExcelExportScopeDto)
  scope!: ExcelExportScopeDto;
}
