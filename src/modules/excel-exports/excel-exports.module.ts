import { Module } from '@nestjs/common';
import { ExcelExportsController } from './excel-exports.controller'; 
import { ExcelExportsService } from './excel-exports.service';
import { ExcelCoreModule } from 'src/excel/excel-core.module';
import { ExcelDatasetsModule } from '../excel-datasets/excel-datasets.module';

@Module({
  controllers: [ExcelExportsController],
  providers: [ExcelExportsService],
  imports: [ExcelCoreModule, ExcelDatasetsModule],
})
export class ExcelExportsModule {}
