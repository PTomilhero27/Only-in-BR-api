import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { ExcelExportRequirementsService } from './excel-export-requirements.service';
import { ExcelExportRequirementsResponseDto } from './dto/excel-export-requirements-response.dto';

/**
 * Endpoint que o front chama:
 * - manda templateId
 * - recebe params + opções para autocompletes
 */
@ApiTags('Excel - Export Requirements')
@ApiBearerAuth()
@Controller('excel-export-requirements')
export class ExcelExportRequirementsController {
  constructor(private readonly service: ExcelExportRequirementsService) {}

  @Get(':templateId')
  @ApiOperation({
    summary:
      'Resolve dinamicamente os parâmetros e opções necessárias para exportar um Excel a partir do template.',
  })
  @ApiParam({
    name: 'templateId',
    description: 'ID do template (UUID).',
    example: 'd91e0425-29d5-4228-94f1-329e40065ddc',
  })
  @ApiOkResponse({ type: ExcelExportRequirementsResponseDto })
  async get(@Param('templateId') templateId: string) {
    return this.service.getRequirements(templateId);
  }
}
