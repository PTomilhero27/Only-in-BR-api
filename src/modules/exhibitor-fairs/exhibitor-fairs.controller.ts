import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from 'src/common/decorators/current-user.decorator'
import type { JwtPayload } from 'src/common/types/jwt-payload.type'

import { ExhibitorFairsService } from './exhibitor-fairs.service'
import { ListMyFairsResponseDto } from './dto/list-my-fairs.response.dto'
import { LinkStallParamsDto } from './dto/link-stall.params.dto'
import { LinkStallQueryDto } from './dto/link-stall.query.dto'
import { LinkStallResponseDto } from './dto/link-stall.response.dto'
import { UnlinkStallResponseDto } from './dto/unlink-stall.response.dto'
import { UnlinkStallParamsDto } from './dto/unlink-stall.params.dto'

/**
 * Controller de Feiras do Expositor (Portal do Expositor).
 *
 * Responsabilidade:
 * - Fornecer dados para a tela "Feiras" do portal (listagem)
 * - Vincular e desvincular barracas do expositor em uma feira
 *
 * Importante:
 * - Autenticação obrigatória via JWT
 * - Autorização sempre baseada em user.id => resolve ownerId no service
 * - O Portal NÃO altera o financeiro; ele apenas "consome" compras existentes
 */
@ApiTags('Exhibitor / Fairs')
@ApiBearerAuth()
@Controller('exhibitor/fairs')
export class ExhibitorFairsController {
  constructor(private readonly service: ExhibitorFairsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar minhas feiras (expositor logado)' })
  listMine(@CurrentUser() user: JwtPayload): Promise<ListMyFairsResponseDto> {
    return this.service.listMyFairsByMe(user.id)
  }

  @Post(':fairId/stalls/:stallId')
  @ApiOperation({
    summary:
      'Vincular uma barraca minha em uma feira (consome uma compra OwnerFairPurchase compatível)',
  })
  linkStall(
    @CurrentUser() user: JwtPayload,
    @Param() params: LinkStallParamsDto,
    @Query() query: LinkStallQueryDto,
  ): Promise<LinkStallResponseDto> {
    return this.service.linkStallToFairByMe(user.id, params.fairId, params.stallId, query.purchaseId)
  }

  @Delete(':fairId/stalls/:stallId')
  @ApiOperation({ summary: 'Desvincular uma barraca minha de uma feira (devolve consumo da compra)' })
  unlinkStall(
    @CurrentUser() user: JwtPayload,
    @Param() params: UnlinkStallParamsDto,
  ): Promise<UnlinkStallResponseDto> {
    return this.service.unlinkStallFromFairByMe(user.id, params.fairId, params.stallId)
  }
}
