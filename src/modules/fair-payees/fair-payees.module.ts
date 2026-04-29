import { Module } from '@nestjs/common';
import { FairPayeesService } from './fair-payees.service';

@Module({
  providers: [FairPayeesService],
  exports: [FairPayeesService],
})
export class FairPayeesModule {}
