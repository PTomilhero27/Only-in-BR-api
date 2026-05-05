import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateFairSupplierImportConfigDto {
  @ApiProperty({ description: 'ID da planilha no Google Sheets' })
  @IsString()
  @IsNotEmpty()
  spreadsheetId!: string;

  @ApiProperty({ description: 'Nome da aba da feira na planilha' })
  @IsString()
  @IsNotEmpty()
  sheetName!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({
    example: 2,
    description: 'Linha onde está o cabeçalho técnico da planilha. Na planilha atual, é a linha 2.',
  })
  headerRow?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({
    example: 3,
    description: 'Linha onde começam os dados da planilha. Na planilha atual, é a linha 3.',
  })
  dataStartRow?: number;
}
