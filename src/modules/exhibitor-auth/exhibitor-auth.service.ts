import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { PrismaService } from 'src/prisma/prisma.service'
import { ValidateTokenDto } from './dto/validate-token.dto'
import {
  ValidateTokenFailureReason,
  ValidateTokenResponseDto,
} from './dto/validate-token-response.dto'
import { SetPasswordDto } from './dto/set-password.dto'
import { SetPasswordResponseDto } from './dto/set-password-response.dto'
import * as bcrypt from 'bcrypt'
import { createHash } from 'crypto'
import { JwtService } from '@nestjs/jwt'
import { LoginExhibitorDto } from './dto/login-exhibitor.dto'
import { LoginExhibitorResponseDto } from './dto/login-exhibitor-response.dto'
import { UserRole } from '@prisma/client'

/**
 * Service de autenticação do expositor.
 *
 * Responsabilidade:
 * - Validar tokens temporários
 * - Ativar conta ou redefinir senha
 * - ✅ Realizar login (email + senha) e gerar JWT
 *
 * Segurança:
 * - Token é armazenado em hash
 * - Uso único
 * - Expiração obrigatória
 */
@Injectable()
export class ExhibitorAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async validateToken(dto: ValidateTokenDto): Promise<ValidateTokenResponseDto> {
    const tokenHash = this.hashToken(dto.token)
    const now = new Date()

    const token = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash },
      include: {
        user: {
          include: {
            owner: true,
          },
        },
      },
    })

    if (!token) {
      return { ok: false, reason: ValidateTokenFailureReason.INVALID }
    }

    if (token.usedAt) {
      return { ok: false, reason: ValidateTokenFailureReason.USED }
    }

    if (token.expiresAt <= now) {
      return { ok: false, reason: ValidateTokenFailureReason.EXPIRED }
    }

    if (!token.user || token.user.role !== UserRole.EXHIBITOR || !token.user.ownerId) {
      return { ok: false, reason: ValidateTokenFailureReason.INVALID }
    }

    return {
      ok: true,
      ownerId: token.user.ownerId,
      tokenType: token.type as any,
      expiresAt: token.expiresAt.toISOString(),
      email: token.user.email,
      displayName: token.user.owner?.fullName ?? null,
    }
  }

  async setPassword(dto: SetPasswordDto): Promise<SetPasswordResponseDto> {
    const tokenHash = this.hashToken(dto.token)

    const token = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    })

    if (!token || !token.user) {
      throw new BadRequestException('Token inválido ou expirado.')
    }

    const passwordHash = await bcrypt.hash(dto.password, 10)

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: token.userId },
        data: {
          password: passwordHash,
          passwordSetAt: new Date(),
          isActive: true,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
    ])

    return { success: true }
  }

  /**
   * ✅ Login do expositor (email + senha).
   *
   * Regras:
   * - User deve existir e ser EXHIBITOR, ativo, com ownerId
   * - password deve estar setada (password != null)
   * - valida bcrypt
   *
   * Retorno:
   * - JWT + owner mínimo
   */
  async login(dto: LoginExhibitorDto): Promise<LoginExhibitorResponseDto> {
    const email = dto.email.trim().toLowerCase()

    const user = await this.prisma.user.findFirst({
      where: {
        email,
        role: UserRole.EXHIBITOR,
        isActive: true,
      },
      include: {
        owner: true,
      },
    })

    if (!user || !user.ownerId || !user.owner) {
      throw new UnauthorizedException('Credenciais inválidas.')
    }

    // Primeiro acesso ainda não definiu senha
    if (!user.password) {
      throw new UnauthorizedException('A conta ainda não foi ativada. Use o link de ativação.')
    }

    const ok = await bcrypt.compare(dto.password, user.password)
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas.')
    }

    // ✅ JWT payload mínimo (evitar vazar dados)
    const payload = {
      sub: user.id,
      role: user.role,
      ownerId: user.ownerId,
    }

    const accessToken = await this.jwt.signAsync(payload)

    return {
      accessToken,
      owner: {
        id: user.owner.id,
        personType: user.owner.personType as any,
        document: user.owner.document,
        fullName: user.owner.fullName,
        email: user.owner.email,
      },
    }
  }

  /**
   * Gera hash do token bruto.
   * Precisa ser idêntico ao usado na geração do token no admin.
   */
  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex')
  }
}
