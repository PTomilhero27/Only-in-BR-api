/**
 * Service do Portal para manipulação do perfil do Owner.
 *
 * Regras de negócio:
 * - O portal edita apenas o Owner vinculado ao usuário autenticado (user.ownerId).
 * - NÃO aceita alterações de document/email/personType por este endpoint (somente leitura).
 * - Valida coerência personType x document (tamanho) usando dados do banco (fonte de verdade).
 *
 * Decisão:
 * - O contrato do portal usa nomes “amigáveis” (name, zipCode, etc.),
 *   e este service faz o mapeamento para o schema real do Prisma.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PersonType } from '@prisma/client';

import type { JwtPayload } from 'src/common/types/jwt-payload.type';
import { OwnerMeResponseDto } from './dto/owner-me-response.dto';
import { UpdateOwnerMeDto } from './dto/update-owner-me.dto';

@Injectable()
export class OwnersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna o perfil do expositor autenticado.
   * - Documento/e-mail/tipo vêm sempre do banco e são somente leitura no portal.
   */
  async getMe(user: JwtPayload): Promise<OwnerMeResponseDto> {
    const ownerId = await this.requireOwnerId(user.id);

    const owner = await this.prisma.owner.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
        personType: true,
        document: true,
        fullName: true,
        email: true,
        phone: true,
        stallsDescription: true,

        // Endereço (schema Prisma atual)
        addressZipcode: true,
        addressFull: true,
        addressCity: true,
        addressState: true,
        addressNumber: true,

        // Financeiro (schema Prisma atual)
        pixKey: true,
        bankAccountType: true,
        bankName: true,
        bankAgency: true,
        bankAccount: true,
        bankHolderName: true,
        bankHolderDoc: true,
      },
    });

    if (!owner) throw new NotFoundException('Owner não encontrado.');

    return this.toMeResponse(owner);
  }

  /**
   * Atualiza o perfil do expositor autenticado.
   *
   * Importante:
   * - Ignoramos qualquer tentativa de alterar personType/document/email (não estão no DTO).
   * - Validamos consistência PF/PJ com o documento armazenado (defesa extra).
   */
  async updateMe(user: JwtPayload, dto: UpdateOwnerMeDto): Promise<OwnerMeResponseDto> {
    const ownerId = await this.requireOwnerId(user.id);

    const existing = await this.prisma.owner.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
        document: true,
        personType: true,
      },
    });

    if (!existing) throw new NotFoundException('Owner não encontrado.');

    // Coerência PF/PJ com o documento armazenado (fonte de verdade).
    this.assertPersonTypeMatchesDocument(existing.personType, existing.document);

    const updated = await this.prisma.owner.update({
      where: { id: ownerId },
      data: {
        // -----------------------
        // Dados pessoais
        // -----------------------
        fullName: dto.name,
        phone: dto.phone ?? null,
        stallsDescription: dto.stallsDescription ?? null,

        // -----------------------
        // Endereço (schema Prisma atual)
        // -----------------------
        addressZipcode: dto.zipCode ?? null,
        addressFull: dto.addressFull ?? null,
        addressNumber: dto.addressNumber ?? null,
        addressCity: dto.city ?? null,
        addressState: dto.state ? dto.state.toUpperCase() : null,

        // -----------------------
        // Financeiro (schema Prisma atual)
        // -----------------------
        pixKey: dto.pixKey ?? null,
        bankAccountType: dto.bankAccountType ?? null,
        bankName: dto.bankName ?? null,
        bankAgency: dto.bankAgency ?? null,
        bankAccount: dto.bankAccount ?? null,
        bankHolderName: dto.bankHolderName ?? null,
        bankHolderDoc: dto.bankHolderDocument ?? null,
      },
      select: {
        id: true,
        personType: true,
        document: true,
        fullName: true,
        email: true,
        phone: true,
        stallsDescription: true,

        addressZipcode: true,
        addressFull: true,
        addressCity: true,
        addressState: true,
        addressNumber: true,

        pixKey: true,
        bankAccountType: true,
        bankName: true,
        bankAgency: true,
        bankAccount: true,
        bankHolderName: true,
        bankHolderDoc: true,
      },
    });

    return this.toMeResponse(updated);
  }

  /**
   * Garante que o JWT tem ownerId.
   * Se não tiver, significa que este usuário não está vinculado a um expositor.
   */
  private async requireOwnerId(userId: string): Promise<string> {
    if (!userId) throw new BadRequestException('userId ausente no token.');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, ownerId: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException('Usuário não encontrado ou inativo.');
    }

    if (!user.ownerId) {
      throw new BadRequestException('Este usuário não está vinculado a um expositor (ownerId).');
    }

    return user.ownerId;
  }

  /**
   * Mapeia o Owner do Prisma para o contrato do portal.
   *
   * Observação:
   * - “name” no portal corresponde a “fullName” no Prisma.
   * - zip/city/state etc. mapeiam para addressZipcode/addressCity/addressState.
   * - bankHolderDocument no portal corresponde a bankHolderDoc no Prisma.
   */
  private toMeResponse(owner: any): OwnerMeResponseDto {
    return {
      id: owner.id,

      // Somente leitura
      personType: owner.personType,
      document: owner.document,
      email: owner.email ?? null,

      // Pessoal
      name: owner.fullName ?? null,
      phone: owner.phone ?? null,
      stallsDescription: owner.stallsDescription ?? null,

      // Endereço
      zipCode: owner.addressZipcode ?? null,
      addressFull: owner.addressFull ?? null,
      addressNumber: owner.addressNumber ?? null,
      city: owner.addressCity ?? null,
      state: owner.addressState ?? null,

      // Financeiro
      pixKey: owner.pixKey ?? null,
      bankAccountType: owner.bankAccountType ?? null,
      bankName: owner.bankName ?? null,
      bankAgency: owner.bankAgency ?? null,
      bankAccount: owner.bankAccount ?? null,
      bankHolderName: owner.bankHolderName ?? null,
      bankHolderDocument: owner.bankHolderDoc ?? null,
    };
  }

  /**
   * Coerência PF/PJ x documento (armazenado normalizado).
   * - PF => 11 dígitos
   * - PJ => 14 dígitos
   */
  private assertPersonTypeMatchesDocument(personType: PersonType, document: string): void {
    const len = document.length;

    if (personType === PersonType.PF && len !== 11) {
      throw new BadRequestException('personType=PF requer document com 11 dígitos (CPF).');
    }

    if (personType === PersonType.PJ && len !== 14) {
      throw new BadRequestException('personType=PJ requer document com 14 dígitos (CNPJ).');
    }
  }
}
