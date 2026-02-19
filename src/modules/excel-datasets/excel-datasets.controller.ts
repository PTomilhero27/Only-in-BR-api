import { Controller, Get, Param, ParseEnumPipe } from '@nestjs/common';
import { ExcelDataset } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { ExcelDatasetsService } from './excel-datasets.service';
import { ExcelDatasetItemDto } from './dto/excel-dataset-item.dto';
import { ExcelDatasetFieldDto } from './dto/excel-dataset-field.dto';

@ApiTags('Excel - Datasets')
@ApiBearerAuth()
@Controller('excel/datasets')
export class ExcelDatasetsController {
  constructor(private readonly excelDatasetsService: ExcelDatasetsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista os datasets disponíveis no catálogo (com scope).',
  })
  @ApiOkResponse({ type: ExcelDatasetItemDto, isArray: true })
  listDatasets(): ExcelDatasetItemDto[] {
    return this.excelDatasetsService.listDatasets();
  }

  @Get(':dataset/fields')
  @ApiOperation({ summary: 'Lista os fields disponíveis para um dataset.' })
  @ApiParam({
    name: 'dataset',
    enum: ExcelDataset,
    description: 'Dataset do catálogo.',
  })
  @ApiOkResponse({ type: ExcelDatasetFieldDto, isArray: true })
  listFields(
    @Param('dataset', new ParseEnumPipe(ExcelDataset)) dataset: ExcelDataset,
  ): ExcelDatasetFieldDto[] {
    return this.excelDatasetsService.listFields(dataset);
  }
}
