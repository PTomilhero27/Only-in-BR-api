import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Public } from '../../../common/decorators/public.decorator';
import { PublicInterestsService } from './public-interests.service';
import { UpsertPublicInterestDto } from './dto/upsert-public-interest.dto';
import { PublicOwnerResponseDto } from './dto/public-owner-response.dto';

/**
 * PublicInterestsController
 *
 * Responsabilidade:
 * - Receber o cadastro inicial do interessado (sem autenticação).
 *
 * Decisão:
 * - Rotas públicas ficam sob /public para não misturar com rotas do painel (JWT).
 * - Apesar do nome "upsert" (legado), o comportamento agora é "create-only":
 *   se já existir cadastro com o documento, retornamos erro 400.
 */
@ApiTags('Public - Interests')
@Controller('public/interests')
export class PublicInterestsController {
  constructor(private readonly service: PublicInterestsService) {}

  @Public()
  @Post('upsert')
  @ApiOperation({
    summary: 'Cadastrar interessado (create-only)',
    description:
      'Cria um Owner com dados básicos. Se já existir Owner com o mesmo CPF/CNPJ (document), retorna erro 400.',
  })
  @ApiOkResponse({ type: PublicOwnerResponseDto })
  @ApiBadRequestResponse({
    description:
      'Payload inválido ou já existe cadastro com este CPF/CNPJ.',
  })
  async upsert(
    @Body() dto: UpsertPublicInterestDto,
  ): Promise<PublicOwnerResponseDto> {
    return this.service.upsert(dto);
  }
}
