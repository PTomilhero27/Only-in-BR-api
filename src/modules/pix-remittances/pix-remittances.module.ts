import { Module } from '@nestjs/common';
import { AuditModule } from 'src/common/audit/audit.module';
import { PixRemittancesController } from './pix-remittances.controller';
import { PixRemittancesService } from './pix-remittances.service';
import { SispagPixRemittanceFileService } from './services/sispag-pix-remittance-file.service';

/**
 * Módulo de remessas PIX da feira.
 * Expõe os endpoints para geração, listagem, download, pagamento e cancelamento de remessas.
 */
@Module({
  imports: [AuditModule],
  controllers: [PixRemittancesController],
  providers: [PixRemittancesService, SispagPixRemittanceFileService],
})
export class PixRemittancesModule {}
