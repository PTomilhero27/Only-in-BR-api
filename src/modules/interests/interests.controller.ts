import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InterestsService } from './interests.service';
import { GrantPortalAccessDto } from './dto/grant-portal-access.dto';
import { GrantPortalAccessResponseDto } from './dto/grant-portal-access-response.dto';
import { ListInterestsResponseDto } from './dto/list-interests-response.dto';
import { ListInterestsDto } from './dto/list-interests.dto';
import { CreateExhibitorPasswordResetTokenResponseDto } from './dto/create-exhibitor-password-reset-token-response-dto';

/**
 * Controller do painel (admin) para Interessados.
 *
 * Responsabilidade:
 * - Listar interessados cadastrados (Owner) para triagem e ações internas.
 * - Disparar ações administrativas como "liberar acesso ao portal" e "reset de senha".
 *
 * Decisão:
 * - Este controller é 100% autenticado (JWT).
 * - Rotas públicas do portal ficam em /exhibitor-auth (outro módulo).
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
      'Lista interessados cadastrados. Suporta paginação e busca (q). ' +
      'Retorna também campos calculados para UI (hasPortalLogin e stallsCount).',
  })
  @ApiOkResponse({ type: ListInterestsResponseDto })
  async list(
    @Query() query: ListInterestsDto,
  ): Promise<ListInterestsResponseDto> {
    return this.interestsService.list(query);
  }

  @Post(':ownerId/portal-access')
  @ApiOperation({
    summary: 'Liberar acesso ao portal (gera link temporário)',
    description:
      'Cria/garante o User do expositor e gera um token temporário (30-60 min) ' +
      'para ativação de conta ou reset de senha (conforme dto.type).',
  })
  @ApiOkResponse({ type: GrantPortalAccessResponseDto })
  async grantPortalAccess(
    @Param('ownerId') ownerId: string,
    @Body() body: GrantPortalAccessDto,
  ): Promise<GrantPortalAccessResponseDto> {
    return this.interestsService.grantPortalAccess(ownerId, body);
  }

  @Post(':ownerId/password-reset-token')
  @ApiOperation({
    summary: 'Gerar token de reset de senha para o expositor (admin)',
    description:
      'Atalho para reset: reutiliza o mesmo fluxo de portal-access com type=RESET_PASSWORD. ' +
      'Retorna link e token temporário para o admin repassar ao expositor.',
  })
  @ApiOkResponse({ type: CreateExhibitorPasswordResetTokenResponseDto })
  async createPasswordResetToken(
    @Param('ownerId') ownerId: string,
  ): Promise<CreateExhibitorPasswordResetTokenResponseDto> {
    return this.interestsService.createPasswordResetToken({ ownerId });
  }
}
