import { Module } from '@nestjs/common';
import { PublicMarketplaceController } from './public-marketplace.controller';
import { PublicMarketplaceService } from './public-marketplace.service';
import { MarketplaceModule } from '../../marketplace/marketplace.module';
import { FairShowcaseModule } from '../../fair-showcase/fair-showcase.module';

@Module({
  imports: [MarketplaceModule, FairShowcaseModule],
  controllers: [PublicMarketplaceController],
  providers: [PublicMarketplaceService],
})
export class PublicMarketplaceModule {}
