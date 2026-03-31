import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PublicMarketplaceService } from './public-marketplace.service';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Public Marketplace')
@Controller('public/marketplace')
export class PublicMarketplaceController {
  constructor(private readonly service: PublicMarketplaceService) {}

  @Public()
  @Get('fairs/:fairId')
  @ApiOperation({
    summary: 'Obtém informações públicas da feira para o marketplace',
  })
  async getFairInfo(@Param('fairId') fairId: string) {
    return this.service.getFairInfo(fairId);
  }

  @Public()
  @Get('fairs/:fairId/map')
  @ApiOperation({ summary: 'Obtém o mapa da feira e os slots disponíveis' })
  async getFairMap(@Param('fairId') fairId: string) {
    return this.service.getFairMap(fairId);
  }
}
