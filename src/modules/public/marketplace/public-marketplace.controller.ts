import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PublicMarketplaceService } from './public-marketplace.service';
import { FairShowcaseService } from '../../fair-showcase/fair-showcase.service';
import { Public } from '../../../common/decorators/public.decorator';

/**
 * Controller público do Marketplace.
 *
 * Rotas públicas (sem JWT):
 * - GET /public/marketplace/fairs              → lista feiras publicadas
 * - GET /public/marketplace/fairs/:fairId      → detalhe da feira
 * - GET /public/marketplace/fairs/:fairId/map  → mapa + slots
 */
@ApiTags('Public Marketplace')
@Controller('public/marketplace')
export class PublicMarketplaceController {
  constructor(
    private readonly service: PublicMarketplaceService,
    private readonly showcaseService: FairShowcaseService,
  ) {}

  @Public()
  @Get('fairs')
  @ApiOperation({
    summary: 'Listar feiras futuras publicadas',
    description:
      'Retorna feiras com vitrine publicada (isPublished=true) e status ATIVA. ' +
      'Inclui campos calculados: startDate, endDate, availableSlotsCount, priceRange.',
  })
  async listPublishedFairs() {
    return this.showcaseService.listPublished();
  }

  @Public()
  @Get('fairs/:fairId')
  @ApiOperation({
    summary: 'Detalhes de uma feira futura publicada',
    description:
      'Retorna todas as informações da feira (editorial + slots calculados). ' +
      'Retorno compatível com o schema FutureFair do frontend.',
  })
  async getFairDetail(@Param('fairId') fairId: string) {
    return this.showcaseService.getPublicDetail(fairId);
  }

  @Public()
  @Get('fairs/:fairId/map')
  @ApiOperation({ summary: 'Obtém o mapa da feira e os slots disponíveis' })
  async getFairMap(@Param('fairId') fairId: string) {
    return this.service.getFairMap(fairId);
  }
}
