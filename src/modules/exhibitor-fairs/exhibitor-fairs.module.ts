import { Module } from '@nestjs/common';
import { ExhibitorFairsController } from './exhibitor-fairs.controller';
import { ExhibitorFairsService } from './exhibitor-fairs.service';

@Module({
  controllers: [ExhibitorFairsController],
  providers: [ExhibitorFairsService]
})
export class ExhibitorFairsModule {}
