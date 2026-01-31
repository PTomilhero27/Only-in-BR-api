import { Body, Controller, Post } from '@nestjs/common'
import { ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger'

import { Public } from '../../common/decorators/public.decorator'
import { ExhibitorAuthService } from './exhibitor-auth.service'
import { ValidateTokenDto } from './dto/validate-token.dto'
import { ValidateTokenResponseDto } from './dto/validate-token-response.dto'
import { SetPasswordDto } from './dto/set-password.dto'
import { SetPasswordResponseDto } from './dto/set-password-response.dto'
import { LoginExhibitorDto } from './dto/login-exhibitor.dto'
import { LoginExhibitorResponseDto } from './dto/login-exhibitor-response.dto'

/**
 * Controller público para autenticação do expositor.
 *
 * Rotas públicas (token-based e login):
 * - POST /exhibitor-auth/validate-token
 * - POST /exhibitor-auth/set-password
 * - POST /exhibitor-auth/login
 *
 * Observação:
 * - O restante do portal será autenticado via JWT posteriormente.
 */
@ApiTags('Exhibitor Auth')
@Controller('exhibitor-auth')
export class ExhibitorAuthController {
  constructor(private readonly service: ExhibitorAuthService) {}

  @Public()
  @Post('validate-token')
  @ApiOperation({ summary: 'Validar token de ativação ou reset de senha' })
  @ApiOkResponse({ type: ValidateTokenResponseDto })
  validateToken(@Body() dto: ValidateTokenDto): Promise<ValidateTokenResponseDto> {
    return this.service.validateToken(dto)
  }

  @Public()
  @Post('set-password')
  @ApiOperation({ summary: 'Definir senha usando token (ativação ou reset)' })
  @ApiOkResponse({ type: SetPasswordResponseDto })
  setPassword(@Body() dto: SetPasswordDto): Promise<SetPasswordResponseDto> {
    return this.service.setPassword(dto)
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login do expositor (email + senha)' })
  @ApiOkResponse({ type: LoginExhibitorResponseDto })
  login(@Body() dto: LoginExhibitorDto): Promise<LoginExhibitorResponseDto> {
    return this.service.login(dto)
  }
}
