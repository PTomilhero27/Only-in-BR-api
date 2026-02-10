import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { ExcelTemplatesService } from './excel-templates.service';
import { CreateExcelTemplateDto } from './dto/create-excel-template.dto';
import { UpdateExcelTemplateDto } from './dto/update-excel-template.dto';
import { ExcelTemplateListItemDto } from './dto/excel-template-list-item.dto';
import { ExcelTemplateResponseDto } from './dto/excel-template-response.dto';

/**
 * ✅ ExcelTemplatesController
 *
 * Endpoints de CRUD para o designer de templates de Excel.
 * Importante:
 * - Rotas autenticadas por default (guard global do projeto)
 * - Validações são feitas no service (fieldKey, colisões, etc.)
 */
@ApiTags('Excel - Templates')
@ApiBearerAuth()
@Controller('excel-templates')
export class ExcelTemplatesController {
  constructor(private readonly excelTemplatesService: ExcelTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista templates de Excel (visão enxuta).' })
  @ApiOkResponse({ type: ExcelTemplateListItemDto, isArray: true })
  list(): Promise<ExcelTemplateListItemDto[]> {
    return this.excelTemplatesService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtém um template completo (sheets/cells/tables/columns).' })
  @ApiParam({ name: 'id', description: 'ID do template.' })
  @ApiOkResponse({ type: ExcelTemplateResponseDto })
  getById(@Param('id') id: string): Promise<ExcelTemplateResponseDto> {
    return this.excelTemplatesService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria um template de Excel.' })
  @ApiOkResponse({ type: ExcelTemplateResponseDto })
  create(@Body() dto: CreateExcelTemplateDto): Promise<ExcelTemplateResponseDto> {
    console.log('Received create template request:', dto); // Log para debug
    return this.excelTemplatesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Atualiza um template. MVP: se "sheets" for enviado, substitui toda a estrutura (replace).',
  })
  @ApiParam({ name: 'id', description: 'ID do template.' })
  @ApiOkResponse({ type: ExcelTemplateResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateExcelTemplateDto): Promise<ExcelTemplateResponseDto> {
    return this.excelTemplatesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um template.' })
  @ApiParam({ name: 'id', description: 'ID do template.' })
  @ApiOkResponse({ description: 'Template removido com sucesso.' })
  async remove(@Param('id') id: string): Promise<{ ok: true }> {
    await this.excelTemplatesService.remove(id);
    return { ok: true };
  }
}
