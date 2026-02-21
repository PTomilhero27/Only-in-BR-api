import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';
import { FairMapsService } from './fair-maps.service';
import { SetFairMapTemplateDto } from './dto/set-fair-map-template.dto';
import { LinkBoothSlotDto } from './dto/link-booth-slot.dto';
import { FairMapResponseDto } from './dto/fair-map-response.dto';
import { FairMapAvailableStallFairDto } from './dto/fair-map-available-stall-fair.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

/**
 * FairMapsController
 *
 * Endpoints administrativos para:
 * - Vincular planta (template) a uma feira
 * - Buscar mapa consolidado (template + links)
 * - Vincular slot de barraca a uma StallFair
 * - Listar StallFairs disponíveis (sem vínculo no mapa) para autocomplete
 */
@ApiTags('Fair Maps')
@ApiBearerAuth()
@Controller('fairs/:fairId/map')
export class FairMapsController {
  constructor(private readonly service: FairMapsService) {}

  @Get()
  @ApiOperation({ summary: 'Obter mapa da feira (template + links)' })
  @ApiResponse({ status: 200, type: FairMapResponseDto })
  async get(@Param('fairId') fairId: string) {
    return this.service.getFairMap(fairId);
  }

  @Put()
  @ApiOperation({ summary: 'Vincular/trocar o template usado pela feira' })
  @ApiResponse({ status: 200, type: FairMapResponseDto })
  async setTemplate(
    @Param('fairId') fairId: string,
    @Body() dto: SetFairMapTemplateDto,
  ) {
    return this.service.setTemplate(fairId, dto);
  }

  @Patch('slots/:slotClientKey/link')
  @ApiOperation({
    summary: 'Vincular/desvincular um slot BOOTH_SLOT a uma StallFair',
  })
  @ApiResponse({ status: 200, type: FairMapResponseDto })
  async linkSlot(
    @Param('fairId') fairId: string,
    @Param('slotClientKey') slotClientKey: string,
    @Body() dto: LinkBoothSlotDto,
  ) {
    return this.service.linkSlot(fairId, slotClientKey, dto);
  }

  @Get('available-stall-fairs')
  @ApiOperation({
    summary:
      'Listar StallFairs da feira que ainda NÃO estão vinculadas a slots (autocomplete do modal)',
  })
  @ApiResponse({ status: 200, type: [FairMapAvailableStallFairDto] })
  async availableStallFairs(@Param('fairId') fairId: string) {
    return this.service.listAvailableStallFairs(fairId);
  }
}
