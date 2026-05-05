import { Module } from '@nestjs/common';
import { AuditModule } from 'src/common/audit/audit.module';
import { FairSuppliersController } from './fair-suppliers.controller';
import { FairSuppliersService } from './fair-suppliers.service';

import { FairSuppliersImportService } from './fair-suppliers-import.service';

@Module({
  imports: [AuditModule],
  controllers: [FairSuppliersController],
  providers: [FairSuppliersService, FairSuppliersImportService],
})
export class FairSuppliersModule {}
