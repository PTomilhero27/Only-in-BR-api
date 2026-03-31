import { Module } from '@nestjs/common';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceExpirationService } from './marketplace-expiration.service';
import { MailModule } from '../mail/mail.module';
import { AdminMarketplaceController } from './admin-marketplace.controller';
import { AdminMarketplaceService } from './admin-marketplace.service';

@Module({
  imports: [MailModule],
  controllers: [MarketplaceController, AdminMarketplaceController],
  providers: [MarketplaceService, MarketplaceExpirationService, AdminMarketplaceService],
  exports: [MarketplaceExpirationService],
})
export class MarketplaceModule {}
