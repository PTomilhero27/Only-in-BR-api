import { Module } from '@nestjs/common';
import { MagicLinksController } from './magic-links.controller';
import { MagicLinksService } from './magic-links.service';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [MagicLinksController],
  providers: [MagicLinksService]
})
export class MagicLinksModule {}
