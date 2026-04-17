import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { ValidateTokenDto } from './dto/validate-token.dto';
import {
  ValidateTokenFailureReason,
  ValidateTokenResponseDto,
} from './dto/validate-token-response.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { SetPasswordResponseDto } from './dto/set-password-response.dto';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { LoginExhibitorDto } from './dto/login-exhibitor.dto';
import { LoginExhibitorResponseDto } from './dto/login-exhibitor-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ForgotPasswordResponseDto } from './dto/forgot-password-response.dto';
import { PasswordTokenType, UserRole } from '@prisma/client';
import { MailService } from '../mail/mail.service';

/**
 * Service de autenticação do expositor.
 *
 * Responsabilidade:
 * - Validar tokens temporários
 * - Ativar conta ou redefinir senha
 * - ✅ Realizar login (email + senha) e gerar JWT
 * - ✅ Recuperação de senha self-service (forgot-password)
 *
 * Segurança:
 * - Token é armazenado em hash
 * - Uso único
 * - Expiração obrigatória
 */
@Injectable()
export class ExhibitorAuthService {
  private readonly logger = new Logger(ExhibitorAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async validateToken(
    dto: ValidateTokenDto,
  ): Promise<ValidateTokenResponseDto> {
    const tokenHash = this.hashToken(dto.token);
    const now = new Date();

    const token = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash },
      include: {
        user: {
          include: {
            owner: true,
          },
        },
      },
    });

    if (!token) {
      return { ok: false, reason: ValidateTokenFailureReason.INVALID };
    }

    if (token.usedAt) {
      return { ok: false, reason: ValidateTokenFailureReason.USED };
    }

    if (token.expiresAt <= now) {
      return { ok: false, reason: ValidateTokenFailureReason.EXPIRED };
    }

    if (
      !token.user ||
      token.user.role !== UserRole.EXHIBITOR ||
      !token.user.ownerId
    ) {
      return { ok: false, reason: ValidateTokenFailureReason.INVALID };
    }

    return {
      ok: true,
      ownerId: token.user.ownerId,
      tokenType: token.type as any,
      expiresAt: token.expiresAt.toISOString(),
      email: token.user.email,
      displayName: token.user.owner?.fullName ?? null,
    };
  }

  async setPassword(dto: SetPasswordDto): Promise<SetPasswordResponseDto> {
    const tokenHash = this.hashToken(dto.token);

    const token = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!token || !token.user) {
      throw new BadRequestException('Token inválido ou expirado.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

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
    ]);

    return { success: true };
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
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        email,
        role: UserRole.EXHIBITOR,
        isActive: true,
      },
      include: {
        owner: true,
      },
    });

    if (!user || !user.ownerId || !user.owner) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    // Primeiro acesso ainda não definiu senha
    if (!user.password) {
      throw new UnauthorizedException(
        'A conta ainda não foi ativada. Use o link de ativação.',
      );
    }

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    // ✅ JWT payload mínimo (evitar vazar dados)
    const payload = {
      sub: user.id,
      role: user.role,
      ownerId: user.ownerId,
    };

    const accessToken = await this.jwt.signAsync(payload);

    return {
      accessToken,
      owner: {
        id: user.owner.id,
        personType: user.owner.personType as any,
        document: user.owner.document,
        fullName: user.owner.fullName,
        email: user.owner.email,
      },
    };
  }

  // ──────────────────────────────────────────────
  // Recuperação de senha (self-service)
  // ──────────────────────────────────────────────

  /**
   * ✅ Forgot password: envia email com link de reset.
   *
   * Decisão de segurança:
   * - Sempre retorna mensagem genérica (não vazar se email existe).
   * - Se o email não existir, retorna sucesso silenciosamente.
   * - Invalida tokens antigos antes de criar novo.
   */
  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const genericMessage =
      'Se o e-mail estiver cadastrado, enviaremos um link para redefinir sua senha.';

    const portalBaseUrl = process.env.PORTAL_EXHIBITOR_BASE_URL;

    // Busca User EXHIBITOR ativo pelo email
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        role: UserRole.EXHIBITOR,
        isActive: true,
      },
      select: {
        id: true,
        ownerId: true,
        owner: { select: { fullName: true } },
      },
    });

    // Segurança: se não encontrar, retorna sucesso genérico
    if (!user || !user.ownerId) {
      return { message: genericMessage };
    }

    // ✅ Invalidar tokens antigos
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    // ✅ Gerar novo token
    const rawToken = this.generateToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        type: PasswordTokenType.RESET_PASSWORD,
        expiresAt,
      },
    });

    // ✅ Enviar email com link de reset
    if (portalBaseUrl) {
      const resetUrl = `${portalBaseUrl}/ativar?token=${encodeURIComponent(rawToken)}`;
      await this.sendResetPasswordEmail(
        email,
        user.owner?.fullName ?? '',
        resetUrl,
      );
    } else {
      this.logger.warn(
        'PORTAL_EXHIBITOR_BASE_URL não configurado. Email de reset não enviado.',
      );
    }

    return { message: genericMessage };
  }

  // ──────────────────────────────────────────────
  // Helpers internos
  // ──────────────────────────────────────────────

  /**
   * Gera hash do token bruto.
   * Precisa ser idêntico ao usado na geração do token no admin.
   */
  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Token aleatório, URL-safe.
   */
  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Envia email com link de reset de senha.
   */
  private async sendResetPasswordEmail(
    email: string,
    name: string,
    resetUrl: string,
  ): Promise<void> {
    const displayName = name || 'Expositor';

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">Only in BR</h1>
          <div style="width: 40px; height: 3px; background: linear-gradient(90deg, #e94560, #0f3460); margin: 12px auto;"></div>
        </div>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Olá, <strong>${displayName}</strong>!
        </p>

        <p style="color: #555; font-size: 15px; line-height: 1.6;">
          Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha:
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}"
             style="display: inline-block; background: linear-gradient(135deg, #e94560, #0f3460); color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; padding: 14px 40px; border-radius: 8px;">
            Redefinir minha senha
          </a>
        </div>

        <p style="color: #777; font-size: 13px; text-align: center;">
          Este link é válido por <strong>30 minutos</strong>.
        </p>

        <p style="color: #999; font-size: 12px; line-height: 1.5;">
          Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br />
          <span style="color: #0f3460; word-break: break-all;">${resetUrl}</span>
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />

        <p style="color: #999; font-size: 12px; text-align: center; line-height: 1.5;">
          Se você não solicitou esta alteração, ignore este e-mail. Sua senha permanecerá a mesma.<br />
          © ${new Date().getFullYear()} Only in BR — Todos os direitos reservados.
        </p>
      </div>
    `;

    const sent = await this.mail.sendMail(
      email,
      'Redefinir senha — Only in BR',
      html,
    );

    if (!sent) {
      this.logger.warn(`Email de reset não enviado para ${email}.`);
    }
  }
}
