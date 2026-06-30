import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ContractType, FairStatus, OwnerFairStatus } from '@prisma/client';
import { CreateContractDto } from '../dto/contracts/create-contract.dto';
import { AddFairLinkDto } from '../dto/contracts/add-fair-link.dto';
import { ContractsStorageService } from './contracts-storage.service';
import { ContractsAssinafyService } from './contracts-assinafy.service';


/**
 * ContractManagementService
 *
 * Responsabilidade:
 * - CRUD avançado de contratos por tipo (FAIR_DEFAULT, MULTI_FAIR, EXHIBITOR_SPECIFIC).
 * - Gerenciamento de ContractFairLink (feiras adicionais de contrato multi-feira).
 * - Listagem de contratos por feira e por expositor.
 *
 * Regras de negócio:
 * - Um expositor não pode ter 2 contratos do mesmo tipo na mesma feira (@@unique).
 * - EXHIBITOR_SPECIFIC prevalece sobre FAIR_DEFAULT no fluxo de assinatura.
 * - MULTI_FAIR permite vincular feiras extras via ContractFairLink.
 */
@Injectable()
export class ContractManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ContractsStorageService,
    private readonly assinafy: ContractsAssinafyService,
  ) {}

  /**
   * Cria um contrato com tipo específico.
   */
  async createContract(dto: CreateContractDto) {
    // 1) Validar OwnerFair
    const ownerFair = await this.prisma.ownerFair.findUnique({
      where: { id: dto.ownerFairId },
      select: {
        id: true,
        ownerId: true,
        fairId: true,
        fair: { select: { id: true, status: true } },
      },
    });

    if (!ownerFair) {
      throw new NotFoundException('OwnerFair não encontrado.');
    }

    if (ownerFair.fair.status === FairStatus.FINALIZADA) {
      throw new BadRequestException(
        'Não é possível criar contrato para feira finalizada.',
      );
    }

    // 2) Validar template
    const template = await this.prisma.documentTemplate.findUnique({
      where: { id: dto.templateId },
      select: { id: true, isAddendum: true, status: true },
    });

    if (!template) {
      throw new NotFoundException('Template não encontrado.');
    }

    if (template.isAddendum) {
      throw new BadRequestException(
        'Este template é um aditivo. Escolha um template principal.',
      );
    }

    // 3) Verificar se já existe contrato do mesmo tipo
    const existing = await this.prisma.contract.findUnique({
      where: {
        ownerFairId_type: {
          ownerFairId: dto.ownerFairId,
          type: dto.type,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        `Já existe um contrato do tipo ${dto.type} para este expositor nesta feira.`,
      );
    }

    // 4) Se MULTI_FAIR, validar linkedFairIds
    if (dto.type === ContractType.MULTI_FAIR) {
      if (!dto.linkedFairIds?.length) {
        throw new BadRequestException(
          'Para contrato MULTI_FAIR, informe ao menos uma feira adicional em linkedFairIds.',
        );
      }

      // Verificar que as feiras existem
      const fairs = await this.prisma.fair.findMany({
        where: { id: { in: dto.linkedFairIds } },
        select: { id: true },
      });

      const foundIds = new Set(fairs.map((f) => f.id));
      const missing = dto.linkedFairIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        throw new NotFoundException(
          `Feiras não encontradas: ${missing.join(', ')}`,
        );
      }
    }

    // 5) Criar contrato (e links se MULTI_FAIR)
    const contract = await this.prisma.contract.create({
      data: {
        ownerFairId: dto.ownerFairId,
        templateId: dto.templateId,
        type: dto.type,
        title: dto.title ?? null,
        notes: dto.notes ?? null,
        ...(dto.type === ContractType.MULTI_FAIR && dto.linkedFairIds?.length
          ? {
              fairLinks: {
                create: dto.linkedFairIds.map((fairId) => ({ fairId })),
              },
            }
          : {}),
      },
      include: {
        fairLinks: true,
        template: {
          select: { id: true, title: true, status: true },
        },
      },
    });

    return contract;
  }

  /**
   * Lista contratos de uma feira específica.
   * Inclui contratos DEFAULT, SPECIFIC e MULTI_FAIR que referenciem esta feira.
   */
  async listContractsByFair(fairId: string) {
    // Contratos diretos (ownerFair.fairId == fairId)
    const directContracts = await this.prisma.contract.findMany({
      where: {
        ownerFair: { fairId },
      },
      include: {
        ownerFair: {
          select: {
            id: true,
            ownerId: true,
            owner: {
              select: { id: true, fullName: true, document: true },
            },
          },
        },
        template: {
          select: { id: true, title: true, status: true },
        },
        fairLinks: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Contratos MULTI_FAIR que referenciam esta feira via ContractFairLink
    const linkedContracts = await this.prisma.contract.findMany({
      where: {
        type: ContractType.MULTI_FAIR,
        fairLinks: { some: { fairId } },
        // Excluir os que já vieram acima
        NOT: { ownerFair: { fairId } },
      },
      include: {
        ownerFair: {
          select: {
            id: true,
            ownerId: true,
            fairId: true,
            owner: {
              select: { id: true, fullName: true, document: true },
            },
          },
        },
        template: {
          select: { id: true, title: true, status: true },
        },
        fairLinks: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return [...directContracts, ...linkedContracts];
  }

  /**
   * Lista contratos de um expositor em todas as feiras.
   */
  async listContractsByOwner(ownerId: string) {
    return this.prisma.contract.findMany({
      where: {
        ownerFair: { ownerId },
      },
      include: {
        ownerFair: {
          select: {
            id: true,
            fairId: true,
            fair: { select: { id: true, name: true } },
          },
        },
        template: {
          select: { id: true, title: true, status: true },
        },
        fairLinks: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Detalhe completo de um contrato.
   */
  async getContractDetail(contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        ownerFair: {
          select: {
            id: true,
            ownerId: true,
            fairId: true,
            status: true,
            contractSignedAt: true,
            owner: {
              select: {
                id: true,
                fullName: true,
                document: true,
                email: true,
              },
            },
            fair: {
              select: { id: true, name: true, status: true },
            },
          },
        },
        template: {
          select: {
            id: true,
            title: true,
            status: true,
            isAddendum: true,
            content: true,
          },
        },
        addendumTemplate: {
          select: { id: true, title: true, status: true },
        },
        fairLinks: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado.');
    }

    return contract;
  }

  /**
   * Adiciona uma feira a um contrato MULTI_FAIR.
   */
  async addFairLink(contractId: string, dto: AddFairLinkDto) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, type: true },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado.');
    }

    if (contract.type !== ContractType.MULTI_FAIR) {
      throw new BadRequestException(
        'Só é possível adicionar feiras a contratos do tipo MULTI_FAIR.',
      );
    }

    // Verificar se a feira existe
    const fair = await this.prisma.fair.findUnique({
      where: { id: dto.fairId },
      select: { id: true },
    });

    if (!fair) {
      throw new NotFoundException('Feira não encontrada.');
    }

    // Verificar se já está vinculada
    const existing = await this.prisma.contractFairLink.findUnique({
      where: {
        contractId_fairId: { contractId, fairId: dto.fairId },
      },
    });

    if (existing) {
      throw new ConflictException(
        'Esta feira já está vinculada a este contrato.',
      );
    }

    return this.prisma.contractFairLink.create({
      data: {
        contractId,
        fairId: dto.fairId,
        ownerFairId: dto.ownerFairId ?? null,
      },
    });
  }

  /**
   * Remove uma feira de um contrato MULTI_FAIR.
   */
  async removeFairLink(contractId: string, fairId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, type: true },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado.');
    }

    if (contract.type !== ContractType.MULTI_FAIR) {
      throw new BadRequestException(
        'Só é possível remover feiras de contratos do tipo MULTI_FAIR.',
      );
    }

    const link = await this.prisma.contractFairLink.findUnique({
      where: {
        contractId_fairId: { contractId, fairId },
      },
    });

    if (!link) {
      throw new NotFoundException(
        'Vínculo feira/contrato não encontrado.',
      );
    }

    return this.prisma.contractFairLink.delete({
      where: { id: link.id },
    });
  }

  /**
   * Remove um contrato (somente se não tiver PDF/assinatura).
   */
  async deleteContract(contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        pdfPath: true,
        signedAt: true,
        assinafyDocumentId: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado.');
    }

    if (contract.signedAt) {
      throw new BadRequestException(
        'Não é possível excluir um contrato já assinado.',
      );
    }

    if (contract.assinafyDocumentId) {
      throw new BadRequestException(
        'Não é possível excluir um contrato com fluxo de assinatura ativo. Cancele o fluxo primeiro.',
      );
    }

    return this.prisma.contract.delete({
      where: { id: contractId },
    });
  }

  /**
   * Reinicia o fluxo de um contrato (deleta o PDF e cancela a assinatura no Assinafy).
   */
  async resetContract(contractId: string): Promise<{ success: boolean }> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        pdfPath: true,
        signedAt: true,
        assinafyDocumentId: true,
        ownerFairId: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado.');
    }

    if (contract.signedAt) {
      throw new BadRequestException(
        'Não é possível reiniciar o fluxo de um contrato já assinado.',
      );
    }

    // 1) Deletar PDF do Supabase Storage se existir
    if (contract.pdfPath) {
      await this.storage.deleteContractPdf(contract.pdfPath);
    }

    // 2) Tentar cancelar o fluxo de assinatura no Assinafy se existir
    if (contract.assinafyDocumentId) {
      await this.assinafy.cancelDocument(contract.assinafyDocumentId);
    }

    // 3) Atualizar banco de dados em uma transação
    await this.prisma.$transaction(async (tx) => {
      // Limpar campos de geração do contrato
      await tx.contract.update({
        where: { id: contractId },
        data: {
          pdfPath: null,
          assinafyDocumentId: null,
          assinafySignerId: null,
          signUrl: null,
          signUrlExpiresAt: null,
        },
      });

      // Limpar sinalizador de assinatura no vínculo do expositor
      await tx.ownerFair.update({
        where: { id: contract.ownerFairId },
        data: {
          contractSignedAt: null,
        },
      });

      // Recalcular o status operacional do OwnerFair
      const ownerFair = await tx.ownerFair.findUnique({
        where: { id: contract.ownerFairId },
        include: {
          stallFairs: true,
          ownerFairPurchases: true,
        },
      });

      if (ownerFair) {
        const purchases = ownerFair.ownerFairPurchases || [];
        const totalCents = purchases.reduce((acc, p) => acc + (p.totalCents ?? 0), 0);
        const paidCents = purchases.reduce((acc, p) => acc + (p.paidCents ?? 0), 0);
        const remainingCents = Math.max(0, totalCents - paidCents);

        const isFullyPaid = remainingCents === 0;

        let nextStatus: OwnerFairStatus;
        if (!isFullyPaid) {
          nextStatus = OwnerFairStatus.AGUARDANDO_PAGAMENTO;
        } else {
          nextStatus = OwnerFairStatus.AGUARDANDO_ASSINATURA;
        }

        if (ownerFair.status !== nextStatus) {
          await tx.ownerFair.update({
            where: { id: ownerFair.id },
            data: { status: nextStatus },
          });
        }
      }
    });

    return { success: true };
  }
}

