import { Module } from '@nestjs/common';
import { PublicMarketplaceController } from './public-marketplace.controller';
import { PublicMarketplaceService } from './public-marketplace.service';
import { MarketplaceModule } from '../../marketplace/marketplace.module';

@Module({
  imports: [MarketplaceModule],
  controllers: [PublicMarketplaceController],
  providers: [PublicMarketplaceService],
})
export class PublicMarketplaceModule {}
