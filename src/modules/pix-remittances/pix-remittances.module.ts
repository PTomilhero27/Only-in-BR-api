import { Module } from '@nestjs/common';
import { AuditModule } from 'src/common/audit/audit.module';
import { FairPayeesModule } from '../fair-payees/fair-payees.module';
import { PixRemittancesController } from './pix-remittances.controller';
import { PixRemittancesService } from './pix-remittances.service';
import { SispagPixRemittanceFileService } from './sispag-pix-remittance-file.service';

@Module({
  imports: [AuditModule, FairPayeesModule],
  controllers: [PixRemittancesController],
  providers: [PixRemittancesService, SispagPixRemittanceFileService],
})
export class PixRemittancesModule {}
