import { Body, Controller, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { ExcelExportsService } from './excel-exports.service';
import { CreateExcelExportDto } from './dto/create-excel-export.dto';

/**
 * ✅ ExcelExportsController
 *
 * Endpoint de exportação do Excel.
 * Importante:
 * - Retorna o arquivo como download (.xlsx)
 * - A autenticação é aplicada por default pelo guard global do projeto.
 */
@ApiTags('Excel - Exports')
@ApiBearerAuth()
@Controller('excel-exports')
export class ExcelExportsController {
  constructor(private readonly excelExportsService: ExcelExportsService) {}

  @Post()
  @ApiOperation({
    summary: 'Gera um Excel a partir de um template e parâmetros (fairId obrigatório, ownerId opcional).',
  })
  async create(@Body() dto: CreateExcelExportDto, @Res() res: Response) {
    const { filename, buffer } = await this.excelExportsService.generate(dto);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.send(buffer);
  }
}
