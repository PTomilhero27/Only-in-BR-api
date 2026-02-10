import { Module } from '@nestjs/common';
import { ExcelDatasetsController } from './excel-datasets.controller';
import { ExcelDatasetsService } from './excel-datasets.service';
import { ExcelCoreModule } from 'src/excel/excel-core.module';

@Module({
  controllers: [ExcelDatasetsController],
  providers: [ExcelDatasetsService],
  imports: [ExcelCoreModule],
  exports: [ExcelDatasetsService]
})
export class ExcelDatasetsModule {}
