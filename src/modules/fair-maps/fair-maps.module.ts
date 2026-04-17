import { Module } from '@nestjs/common';
import { FairMapsController } from './fair-maps.controller';
import { FairMapsService } from './fair-maps.service';
import { MarketplaceModule } from '../marketplace/marketplace.module';

@Module({
  imports: [MarketplaceModule],
  controllers: [FairMapsController],
  providers: [FairMapsService],
  exports: [FairMapsService],
})
export class FairMapsModule {}
