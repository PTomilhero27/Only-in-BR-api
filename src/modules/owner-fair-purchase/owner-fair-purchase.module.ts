import { Module } from '@nestjs/common';
import { OwnerFairPurchasesController } from './owner-fair-purchase.controller';
import { OwnerFairPurchasesService } from './owner-fair-purchase.service';
import { AuditModule } from 'src/common/audit/audit.module';

@Module({
  controllers: [OwnerFairPurchasesController],
  providers: [OwnerFairPurchasesService],
  imports: [AuditModule],
})
export class OwnerFairPurchaseModule {}
