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
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyEmailResponseDto } from './dto/verify-email-response.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';

/**
 * PublicInterestsController
 *
 * Responsabilidade:
 * - Receber o cadastro inicial do interessado (sem autenticação).
 * - Verificar email via código de 6 dígitos.
 * - Reenviar código de verificação.
 *
 * Decisão:
 * - Rotas públicas ficam sob /public para não misturar com rotas do painel (JWT).
 * - O cadastro cria Owner + User EXHIBITOR + envia código de verificação por email.
 */
@ApiTags('Public - Interests')
@Controller('public/interests')
export class PublicInterestsController {
  constructor(private readonly service: PublicInterestsService) {}

  @Public()
  @Post('upsert')
  @ApiOperation({
    summary: 'Cadastrar interessado (create-only + senha + código de verificação)',
    description:
      'Cria um Owner + User EXHIBITOR com senha. Envia código de 6 dígitos por email. ' +
      'Se já existir Owner com o mesmo CPF/CNPJ, retorna erro 400.',
  })
  @ApiOkResponse({ type: PublicOwnerResponseDto })
  @ApiBadRequestResponse({
    description: 'Payload inválido ou já existe cadastro com este CPF/CNPJ.',
  })
  async upsert(
    @Body() dto: UpsertPublicInterestDto,
  ): Promise<PublicOwnerResponseDto> {
    return this.service.upsert(dto);
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({
    summary: 'Verificar email com código de 6 dígitos',
    description:
      'Valida o código enviado por email. Ativa a conta do expositor (User.isActive=true). ' +
      'Após a verificação, o expositor pode fazer login.',
  })
  @ApiOkResponse({ type: VerifyEmailResponseDto })
  @ApiBadRequestResponse({
    description: 'Código inválido, expirado ou email não encontrado.',
  })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
  ): Promise<VerifyEmailResponseDto> {
    return this.service.verifyEmail(dto);
  }

  @Public()
  @Post('resend-verification')
  @ApiOperation({
    summary: 'Reenviar código de verificação',
    description:
      'Gera um novo código de 6 dígitos e envia por email. ' +
      'Rate-limit: 1 reenvio por minuto.',
  })
  @ApiOkResponse({
    schema: {
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Email já verificado ou rate-limit atingido.',
  })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    return this.service.resendVerification(dto);
  }
}
