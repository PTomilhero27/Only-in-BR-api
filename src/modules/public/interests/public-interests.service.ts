import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PersonType, UserRole } from '@prisma/client';
import { UpsertPublicInterestDto } from './dto/upsert-public-interest.dto';
import { PublicOwnerResponseDto } from './dto/public-owner-response.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyEmailResponseDto } from './dto/verify-email-response.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { MailService } from '../../mail/mail.service';

import * as bcrypt from 'bcrypt';
import { createHash, randomInt } from 'crypto';

/**
 * Service público do cadastro de interessados.
 *
 * Responsabilidade:
 * - Criar cadastro inicial (Owner) com dados básicos + User EXHIBITOR com senha.
 * - Gerar código de 6 dígitos e enviar por email para validação.
 * - Verificar o código e ativar a conta.
 * - Reenviar o código (rate-limit: 1 por minuto).
 *
 * Decisão:
 * - NÃO é upsert: se já existir Owner com o documento, retornamos erro (400).
 * - O User é criado com isActive=false até a verificação de email.
 * - Após verificar, Owner.emailVerifiedAt é marcado e User.isActive=true.
 * - O expositor pode logar imediatamente (sem aprovação do admin).
 */
@Injectable()
export class PublicInterestsService {
  private readonly logger = new Logger(PublicInterestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // ──────────────────────────────────────────────
  // Cadastro (create-only + password + email code)
  // ──────────────────────────────────────────────

  async upsert(dto: UpsertPublicInterestDto): Promise<PublicOwnerResponseDto> {
    const document = this.digitsOnly(dto.document);
    this.assertPersonTypeMatchesDocument(dto.personType, document);

    const email = dto.email.trim().toLowerCase();

    // ✅ Regra: não permitir cadastrar novamente (document)
    const existsByDoc = await this.prisma.owner.findUnique({
      where: { document },
      select: { id: true },
    });

    if (existsByDoc) {
      throw new BadRequestException(
        'Já existe um cadastro com este CPF/CNPJ.',
      );
    }

    // ✅ Regra: não permitir email duplicado no User
    const existsByEmail = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existsByEmail) {
      throw new BadRequestException(
        'Este e-mail já está em uso. Use outro e-mail ou recupere sua senha.',
      );
    }

    // ✅ Hash da senha
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // ✅ Transação: cria Owner + User + EmailVerificationToken
    const { owner, code } = await this.prisma.$transaction(async (tx) => {
      // 1) Cria Owner
      const newOwner = await tx.owner.create({
        data: {
          personType: dto.personType,
          document,
          fullName: dto.fullName?.trim() ?? null,
          email: email,
          phone: dto.phone ? this.digitsOnly(dto.phone) : null,
          stallsDescription: dto.stallsDescription?.trim() ?? null,
        },
      });

      // 2) Cria User EXHIBITOR (inativo até verificar email)
      const user = await tx.user.create({
        data: {
          name: dto.fullName?.trim() ?? null,
          email,
          password: passwordHash,
          role: UserRole.EXHIBITOR,
          isActive: false, // ativado após verificar email
          passwordSetAt: new Date(),
          ownerId: newOwner.id,
        },
      });

      // 3) Gera código de 6 dígitos
      const verificationCode = this.generateSixDigitCode();
      const codeHash = this.hashCode(verificationCode);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          codeHash,
          expiresAt,
        },
      });

      return { owner: newOwner, code: verificationCode };
    });

    // ✅ Enviar email com código (fora da transação para não bloquear)
    await this.sendVerificationEmail(email, dto.fullName ?? '', code);

    return {
      ownerId: owner.id,
      message: 'Código de verificação enviado para seu email.',
    };
  }

  // ──────────────────────────────────────────────
  // Verificar email
  // ──────────────────────────────────────────────

  async verifyEmail(dto: VerifyEmailDto): Promise<VerifyEmailResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const codeHash = this.hashCode(dto.code.trim());
    const now = new Date();

    // Busca User pelo email
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        role: UserRole.EXHIBITOR,
      },
      select: { id: true, ownerId: true, isActive: true },
    });

    if (!user) {
      throw new BadRequestException(
        'Código inválido ou expirado. Verifique e tente novamente.',
      );
    }

    // Busca token válido
    const token = await this.prisma.emailVerificationToken.findFirst({
      where: {
        userId: user.id,
        codeHash,
        usedAt: null,
        expiresAt: { gt: now },
      },
    });

    if (!token) {
      throw new BadRequestException(
        'Código inválido ou expirado. Verifique e tente novamente.',
      );
    }

    // ✅ Transação: marcar token como usado + ativar user + marcar email verificado
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: token.id },
        data: { usedAt: now },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { isActive: true },
      }),
      ...(user.ownerId
        ? [
            this.prisma.owner.update({
              where: { id: user.ownerId },
              data: { emailVerifiedAt: now },
            }),
          ]
        : []),
    ]);

    return { success: true };
  }

  // ──────────────────────────────────────────────
  // Reenviar código
  // ──────────────────────────────────────────────

  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    const email = dto.email.trim().toLowerCase();

    // Busca User pelo email
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        role: UserRole.EXHIBITOR,
      },
      select: {
        id: true,
        isActive: true,
        owner: { select: { fullName: true, emailVerifiedAt: true } },
      },
    });

    if (!user) {
      // Segurança: retorna sucesso genérico
      return { message: 'Se o e-mail estiver cadastrado, enviaremos um novo código.' };
    }

    // Já verificou
    if (user.owner?.emailVerifiedAt) {
      throw new BadRequestException(
        'Este e-mail já foi verificado. Faça login.',
      );
    }

    // Rate limit: não permitir reenviar se o último código foi criado há menos de 1 minuto
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentToken = await this.prisma.emailVerificationToken.findFirst({
      where: {
        userId: user.id,
        createdAt: { gt: oneMinuteAgo },
      },
      select: { id: true },
    });

    if (recentToken) {
      throw new BadRequestException(
        'Aguarde pelo menos 1 minuto antes de solicitar um novo código.',
      );
    }

    // ✅ Invalida tokens antigos e cria novo
    const code = this.generateSixDigitCode();
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          codeHash,
          expiresAt,
        },
      }),
    ]);

    // ✅ Enviar email
    await this.sendVerificationEmail(
      email,
      user.owner?.fullName ?? '',
      code,
    );

    return {
      message: 'Se o e-mail estiver cadastrado, enviaremos um novo código.',
    };
  }

  // ──────────────────────────────────────────────
  // Helpers internos
  // ──────────────────────────────────────────────

  private digitsOnly(value: string): string {
    return (value ?? '').replace(/\D/g, '');
  }

  private assertPersonTypeMatchesDocument(
    personType: PersonType,
    document: string,
  ): void {
    const len = document.length;

    if (personType === PersonType.PF && len !== 11) {
      throw new BadRequestException(
        'personType=PF requer document com 11 dígitos (CPF).',
      );
    }

    if (personType === PersonType.PJ && len !== 14) {
      throw new BadRequestException(
        'personType=PJ requer document com 14 dígitos (CNPJ).',
      );
    }
  }

  /**
   * Gera código numérico de 6 dígitos (100000–999999).
   * Usa crypto.randomInt para melhor entropia.
   */
  private generateSixDigitCode(): string {
    return randomInt(100000, 999999).toString();
  }

  /**
   * Hash do código para armazenamento seguro.
   * SHA-256 é suficiente para códigos de vida curta.
   */
  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  /**
   * Envia email com o código de verificação.
   */
  private async sendVerificationEmail(
    email: string,
    name: string,
    code: string,
  ): Promise<void> {
    const displayName = name || 'Expositor';

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">Only in BR</h1>
          <div style="width: 40px; height: 3px; background: linear-gradient(90deg, #e95045ff, #f8dc3aff); margin: 12px auto;"></div>
        </div>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Olá, <strong>${displayName}</strong>!
        </p>

        <p style="color: #555; font-size: 15px; line-height: 1.6;">
          Recebemos seu cadastro. Para verificar seu e-mail, use o código abaixo:
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <div style="display: inline-block; background: linear-gradient(135deg, #0f3460, #1a1a2e); color: #ffffff; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px 32px; border-radius: 12px;">
            ${code}
          </div>
        </div>

        <p style="color: #777; font-size: 13px; text-align: center;">
          Este código é válido por <strong>30 minutos</strong>.
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />

        <p style="color: #999; font-size: 12px; text-align: center; line-height: 1.5;">
          Se você não solicitou este cadastro, ignore este e-mail.<br />
          © ${new Date().getFullYear()} Only in BR — Todos os direitos reservados.
        </p>
      </div>
    `;

    const sent = await this.mail.sendMail(
      email,
      'Código de verificação — Only in BR',
      html,
    );

    if (!sent) {
      this.logger.warn(
        `Email de verificação não enviado para ${email}. Código: ${code}`,
      );
    }
  }
}
