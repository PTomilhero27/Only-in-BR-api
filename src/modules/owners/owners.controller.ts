/**
 * Controller do Portal (Expositor) para o próprio perfil (Owner).
 *
 * Rotas:
 * - GET  /owners/me   => retorna o perfil do Owner logado
 * - PATCH /owners/me  => atualiza campos editáveis do Owner logado
 *
 * Segurança:
 * - JWT obrigatório (JwtAuthGuard)
 * - Usa @CurrentUser para determinar ownerId (não aceitamos ownerId via body/param)
 */
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtPayload } from 'src/common/types/jwt-payload.type';

import { OwnersService } from './owners.service';
import { OwnerMeResponseDto } from './dto/owner-me-response.dto';
import { UpdateOwnerMeDto } from './dto/update-owner-me.dto';

@ApiTags('Owners (Portal)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('owners')
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Obter meu perfil (Owner)',
    description:
      'Retorna os dados cadastrais do expositor autenticado. Documento e e-mail são retornados para visualização, mas não são editáveis via PATCH.',
  })
  @ApiOkResponse({ type: OwnerMeResponseDto })
  async getMe(@CurrentUser() user: JwtPayload): Promise<OwnerMeResponseDto> {
    console.log("user")
    console.log(user)
    return this.ownersService.getMe(user);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Atualizar meu perfil (Owner)',
    description:
      'Atualiza os dados editáveis do expositor autenticado. Documento e e-mail não são aceitos no payload (somente leitura).',
  })
  @ApiOkResponse({ type: OwnerMeResponseDto })
  async updateMe(
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateOwnerMeDto,
  ): Promise<OwnerMeResponseDto> {
    return this.ownersService.updateMe(user, body);
  }
}
