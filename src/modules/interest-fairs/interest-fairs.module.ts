import { Module } from '@nestjs/common';
import { InterestFairsController } from './interest-fairs.controller';
import { InterestFairsService } from './interest-fairs.service';

@Module({
  controllers: [InterestFairsController],
  providers: [InterestFairsService]
})
export class InterestFairsModule {}
