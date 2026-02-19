import { Module } from '@nestjs/common';
import { ExcelExportRequirementsController } from './excel-export-requirements.controller';
import { ExcelExportRequirementsService } from './excel-export-requirements.service';
import { ExcelDatasetsModule } from '../excel-datasets/excel-datasets.module';

@Module({
  controllers: [ExcelExportRequirementsController],
  providers: [ExcelExportRequirementsService],
  imports: [ExcelDatasetsModule],
})
export class ExcelExportRequirementsModule {}
