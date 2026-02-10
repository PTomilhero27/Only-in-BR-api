import { Module } from '@nestjs/common';
import { ExcelTemplatesController } from './excel-templates.controller';
import { ExcelTemplatesService } from './excel-templates.service';
import { ExcelDatasetsModule } from '../excel-datasets/excel-datasets.module';

@Module({
  controllers: [ExcelTemplatesController],
  providers: [ExcelTemplatesService],
  imports: [ExcelDatasetsModule],
})
export class ExcelTemplatesModule {}
