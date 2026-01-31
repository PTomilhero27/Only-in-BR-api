// src/modules/interests/interests.controller.ts
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InterestsService } from './interests.service';
import { GrantPortalAccessDto } from './dto/grant-portal-access.dto';
import { GrantPortalAccessResponseDto } from './dto/grant-portal-access-response.dto';
import { ListInterestsResponseDto } from './dto/list-interests-response.dto';
import { ListInterestsDto } from './dto/list-interests.dto';

/**
 * Controller do painel (admin) para Interessados.
 *
 * Responsabilidade:
 * - Listar interessados cadastrados (Owner) para triagem e ações internas.
 * - Disparar ações administrativas como "liberar acesso ao portal".
 *
 * Decisão:
 * - Este controller é 100% autenticado (JWT).
 * - Rotas públicas não aparecem aqui (ficam em /public).
 */
@ApiTags('Interests (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interests')
export class InterestsController {
  constructor(private readonly interestsService: InterestsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar interessados (painel)',
    description:
      'Lista interessados cadastrados. Suporta paginação e busca (q). Retorna também campos calculados para UI (acesso e barracas).',
  })
  @ApiOkResponse({ type: ListInterestsResponseDto })
  async list(@Query() query: ListInterestsDto): Promise<ListInterestsResponseDto> {
    return this.interestsService.list(query);
  }

  @Post(':ownerId/portal-access')
  @ApiOperation({
    summary: 'Liberar acesso ao portal (gera link temporário)',
    description:
      'Cria/garante o User do expositor e gera um token temporário (30-60 min) para ativação de conta ou reset de senha.',
  })
  @ApiOkResponse({ type: GrantPortalAccessResponseDto })
  async grantPortalAccess(
    @Param('ownerId') ownerId: string,
    @Body() body: GrantPortalAccessDto,
  ): Promise<GrantPortalAccessResponseDto> {
    return this.interestsService.grantPortalAccess(ownerId, body);
  }
}
