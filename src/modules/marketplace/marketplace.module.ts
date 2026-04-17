import { Module } from '@nestjs/common';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceExpirationService } from './marketplace-expiration.service';
import { MailModule } from '../mail/mail.module';
import { AdminMarketplaceController } from './admin-marketplace.controller';
import { AdminMarketplaceService } from './admin-marketplace.service';
import { MarketplaceReservationConfirmationService } from './marketplace-reservation-confirmation.service';
import { MarketplaceMissingStallNotificationService } from './marketplace-missing-stall-notification.service';

@Module({
  imports: [MailModule],
  controllers: [MarketplaceController, AdminMarketplaceController],
  providers: [
    MarketplaceService,
    MarketplaceExpirationService,
    MarketplaceReservationConfirmationService,
    MarketplaceMissingStallNotificationService,
    AdminMarketplaceService,
  ],
  exports: [
    MarketplaceExpirationService,
    MarketplaceReservationConfirmationService,
    MarketplaceMissingStallNotificationService,
  ],
})
export class MarketplaceModule {}
