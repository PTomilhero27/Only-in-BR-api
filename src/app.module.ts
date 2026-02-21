import { Global, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { UsersModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { FairsModule } from './modules/fairs/fairs.module';
import { InterestsModule } from './modules/interests/interests.module';
import { InterestFairsModule } from './modules/interest-fairs/interest-fairs.module';
import { StallsModule } from './modules/stalls/stalls.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { ExhibitorAuthModule } from './modules/exhibitor-auth/exhibitor-auth.module';
import { OwnersModule } from './modules/owners/owners.module';
import { ExhibitorFairsModule } from './modules/exhibitor-fairs/exhibitor-fairs.module';
import { PublicInterestsModule } from './modules/public/interests/public-interests.module';
import { HealthModule } from './modules/health/health.module';
import { ExcelTemplatesModule } from './modules/excel-templates/excel-templates.module';
import { ExcelExportsModule } from './modules/excel-exports/excel-exports.module';
import { ExcelDatasetsModule } from './modules/excel-datasets/excel-datasets.module';
import { ExcelExportRequirementsModule } from './modules/excel-export-requirements/excel-export-requirements.module';
import { MapTemplatesModule } from './modules/map-templates/map-templates.module';
import { FairMapsModule } from './modules/fair-maps/fair-maps.module';

@Global()
@Module({
  imports: [
    HealthModule,
    PrismaModule,
    ConfigModule.forRoot({ isGlobal: true }),
    UsersModule,
    AuthModule,
    FairsModule,
    InterestsModule,
    InterestFairsModule,
    StallsModule,
    ContractsModule,
    ExhibitorAuthModule,
    OwnersModule,
    ExhibitorFairsModule,

    PublicInterestsModule,
    ExcelTemplatesModule,
    ExcelExportsModule,
    ExcelDatasetsModule,
    ExcelExportRequirementsModule,
    MapTemplatesModule,
    FairMapsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
