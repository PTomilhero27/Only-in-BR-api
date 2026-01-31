import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PersonType } from '@prisma/client';
import { UpsertPublicInterestDto } from './dto/upsert-public-interest.dto';
import { PublicOwnerResponseDto } from './dto/public-owner-response.dto';

/**
 * Service público do cadastro de interessados.
 *
 * Responsabilidade:
 * - Criar cadastro inicial (Owner) com dados básicos.
 *
 * Decisão:
 * - NÃO é upsert: se já existir Owner com o documento, retornamos erro (400).
 * - Isso evita "cadastro duplicado" e força o fluxo correto (triagem + aprovação no admin).
 */
@Injectable()
export class PublicInterestsService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(dto: UpsertPublicInterestDto): Promise<PublicOwnerResponseDto> {
    try {
      const document = this.digitsOnly(dto.document);
      this.assertPersonTypeMatchesDocument(dto.personType, document);

      // ✅ Regra nova: não permitir cadastrar novamente
      const exists = await this.prisma.owner.findUnique({
        where: { document },
        select: { id: true },
      });

      if (exists) {
        throw new BadRequestException('Já existe um cadastro com este CPF/CNPJ.');
      }

      const owner = await this.prisma.owner.create({
        data: {
          personType: dto.personType,
          document,
          fullName: dto.fullName?.trim() ?? null,
          email: dto.email?.trim().toLowerCase() ?? null,
          phone: dto.phone ? this.digitsOnly(dto.phone) : null,
          stallsDescription: dto.stallsDescription?.trim() ?? null,
        },
      });

      return { ownerId: owner.id };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException('Não foi possível salvar os dados no momento.');
    }
  }

  private digitsOnly(value: string): string {
    return (value ?? '').replace(/\D/g, '');
  }

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
