import { Module } from '@nestjs/common';
import { MapTemplatesController } from './map-templates.controller';
import { MapTemplatesService } from './map-templates.service';

@Module({
  controllers: [MapTemplatesController],
  providers: [MapTemplatesService]
})
export class MapTemplatesModule {}
