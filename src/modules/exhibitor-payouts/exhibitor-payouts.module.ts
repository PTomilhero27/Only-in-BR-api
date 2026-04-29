import { Module } from '@nestjs/common';
import { AuditModule } from 'src/common/audit/audit.module';
import { ExhibitorPayoutsController } from './exhibitor-payouts.controller';
import { ExhibitorPayoutsService } from './exhibitor-payouts.service';

@Module({
  imports: [AuditModule],
  controllers: [ExhibitorPayoutsController],
  providers: [ExhibitorPayoutsService],
})
export class ExhibitorPayoutsModule {}
