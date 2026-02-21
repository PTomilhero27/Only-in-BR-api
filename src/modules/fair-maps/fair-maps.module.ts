import { Module } from '@nestjs/common';
import { FairMapsController } from './fair-maps.controller';
import { FairMapsService } from './fair-maps.service';

@Module({
  controllers: [FairMapsController],
  providers: [FairMapsService]
})
export class FairMapsModule {}
