import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UpdateExhibitorPayoutImportConfigDto {
  @ApiProperty({
    example: '1YGInOf0tRZzh5GYunmbP_eud67-prd2FuYM3VBnJ6hk',
    description: 'ID da planilha no Google Sheets.',
  })
  @IsString()
  @IsNotEmpty()
  spreadsheetId!: string;

  @ApiProperty({
    example: 'Remessa Pix',
    description: 'Nome da aba da planilha.',
  })
  @IsString()
  @IsNotEmpty()
  sheetName!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({
    example: 3,
    description: 'Linha onde esta o cabecalho tecnico da planilha.',
  })
  headerRow?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({
    example: 4,
    description: 'Linha onde comecam os dados da planilha.',
  })
  dataStartRow?: number;
}
