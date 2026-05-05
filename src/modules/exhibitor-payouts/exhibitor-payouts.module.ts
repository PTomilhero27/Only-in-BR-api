import { Module } from '@nestjs/common';
import { AuditModule } from 'src/common/audit/audit.module';
import { ExhibitorPayoutsController } from './exhibitor-payouts.controller';
import { ExhibitorPayoutsImportService } from './exhibitor-payouts-import.service';
import { ExhibitorPayoutsService } from './exhibitor-payouts.service';

@Module({
  imports: [AuditModule],
  controllers: [ExhibitorPayoutsController],
  providers: [ExhibitorPayoutsService, ExhibitorPayoutsImportService],
})
export class ExhibitorPayoutsModule {}
