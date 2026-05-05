import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  AuditEntity,
  ExhibitorPayoutStatus,
  FairSupplierInstallmentStatus,
  FairSupplierStatus,
  PixRemittanceGenerationMode,
  PixRemittancePayeeType,
  PixRemittanceStatus,
  PixKeyType,
} from '@prisma/client';
import { AuditService } from 'src/common/audit/audit.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePixRemittanceDto } from './dto/create-pix-remittance.dto';
import { CreatePixRemittanceItemDto } from './dto/create-pix-remittance-item.dto';
import { MarkPixRemittancePaidDto } from './dto/mark-pix-remittance-paid.dto';
import { PayableItemResponseDto } from './dto/payable-item-response.dto';
import {
  SispagPixRemittanceFileService,
  SispagCompanyBankConfig,
} from './services/sispag-pix-remittance-file.service';

/**
 * Este service centraliza as regras financeiras da remessa para garantir que parcelas
 * não sejam pagas ou incluídas em duplicidade.
 *
 * Responsabilidades:
 * - Listar itens elegíveis (payable-items)
 * - Criar remessas com suporte a SINGLE e SPLIT_TWO
 * - Marcar remessa como paga e propagar status para parcelas/fornecedores
 * - Cancelar remessa e reverter status das parcelas
 * - Baixar arquivo de remessa
 */
@Injectable()
export class PixRemittancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly fileService: SispagPixRemittanceFileService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // PAYABLE ITEMS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Lista parcelas de fornecedores disponíveis para entrar em remessa PIX.
   * Retorna todas as parcelas com um flag `canBeSelected` e, quando não elegível,
   * uma `disabledReason` para o front exibir ao usuário.
   */
  async listPayableItems(fairId: string): Promise<PayableItemResponseDto[]> {
    await this.requireFair(fairId);

    const suppliers = await this.prisma.fairSupplier.findMany({
      where: { fairId, status: { not: FairSupplierStatus.CANCELLED } },
      include: { installments: true },
      orderBy: [{ name: 'asc' }],
    });

    const result: PayableItemResponseDto[] = [];

    for (const supplier of suppliers) {
      for (const installment of supplier.installments) {
        // Apenas parcelas PENDING ou INCLUDED_IN_REMITTANCE aparecem
        if (
          installment.status === FairSupplierInstallmentStatus.PAID ||
          installment.status === FairSupplierInstallmentStatus.CANCELLED
        ) {
          continue;
        }

        const item: PayableItemResponseDto = {
          payeeType: PixRemittancePayeeType.SUPPLIER,
          supplierId: supplier.id,
          supplierInstallmentId: installment.id,
          name: supplier.name,
          holderName: supplier.holderName ?? undefined,
          holderDocument: supplier.holderDocument ?? undefined,
          pixKey: supplier.pixKey ?? undefined,
          pixKeyType: supplier.pixKeyType ?? undefined,
          amountCents: installment.amountCents,
          totalAmountCents: supplier.totalAmountCents,
          paidAmountCents: supplier.paidAmountCents,
          pendingAmountCents: supplier.pendingAmountCents,
          installmentNumber: installment.number,
          paymentMoment: installment.dueDate ?? undefined,
          status: installment.status,
          canBeSelected: false,
          disabledReason: undefined,
        };

        // Regras de elegibilidade
        if (supplier.status === FairSupplierStatus.PAID) {
          item.disabledReason = 'Fornecedor já está quitado.';
        } else if (
          installment.status ===
          FairSupplierInstallmentStatus.INCLUDED_IN_REMITTANCE
        ) {
          item.disabledReason = 'Parcela já incluída em remessa ativa.';
        } else if (!supplier.pixKey || !supplier.pixKeyType) {
          item.disabledReason = 'Fornecedor sem chave PIX.';
        } else if (!supplier.holderDocument) {
          item.disabledReason = 'Fornecedor sem documento do titular.';
        } else if (!supplier.holderName) {
          item.disabledReason = 'Fornecedor sem nome do titular.';
        } else if (installment.amountCents <= 0) {
          item.disabledReason = 'Parcela com valor zerado.';
        } else {
          item.canBeSelected = true;
        }

        result.push(item);
      }
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LIST / GET
  // ─────────────────────────────────────────────────────────────────────────────

  async list(fairId: string) {
    await this.requireFair(fairId);
    return this.prisma.pixRemittance.findMany({
      where: { fairId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(fairId: string, remittanceId: string) {
    return this.findRemittanceInFair(fairId, remittanceId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Cria uma ou duas remessas dependendo do mode:
   * - SINGLE: cria 1 PixRemittance com todos os itens
   * - SPLIT_TWO: cria 2 PixRemittance, cada uma com os itens do grupo 1 e 2 respectivamente
   *
   * Todo o processo ocorre em uma única transação Prisma.
   */
  async create(
    fairId: string,
    dto: CreatePixRemittanceDto,
    actorUserId: string,
  ) {
    const fair = await this.requireFair(fairId);

    const mode = dto.mode;

    if (!dto.items?.length) {
      throw new BadRequestException(
        'Informe ao menos um item para gerar a remessa.',
      );
    }

    // Validar shape de cada item
    dto.items.forEach((item) => this.assertItemShape(item, mode));

    // Validar sem duplicatas
    this.assertNoDuplicateItems(dto.items);

    // Validar divisão de grupos se SPLIT_TWO
    if (mode === PixRemittanceGenerationMode.SPLIT_TWO) {
      this.assertSplitGroups(dto.items);
    }

    // Carregar dados do banco e validar elegibilidade
    const supplierItems = await this.loadAndValidateSupplierItems(
      fairId,
      dto.items,
    );

    const paymentDate = dto.paymentDate
      ? new Date(dto.paymentDate)
      : new Date();
    if (Number.isNaN(paymentDate.getTime())) {
      throw new BadRequestException('paymentDate inválido.');
    }

    // Carregar configurações bancárias da empresa pagadora
    const company = this.loadCompanyConfig();

    const createdRemittances: any[] = [];

    return this.prisma.$transaction(async (tx) => {
      if (mode === PixRemittanceGenerationMode.SINGLE) {
        // ── SINGLE: uma única remessa ──────────────────────────────────────────
        const remittance = await this.createSingleRemittance(
          tx,
          fairId,
          dto,
          supplierItems,
          paymentDate,
          company,
          actorUserId,
          null,
          fair.name,
        );
        createdRemittances.push(remittance);
      } else {
        // ── SPLIT_TWO: dois grupos ────────────────────────────────────────────
        const group1Items = supplierItems.filter((item) => item.group === 1);
        const group2Items = supplierItems.filter((item) => item.group === 2);

        if (!group1Items.length || !group2Items.length) {
          throw new BadRequestException(
            'SPLIT_TWO exige pelo menos um item em cada grupo (1 e 2).',
          );
        }

        const remittance1 = await this.createSingleRemittance(
          tx,
          fairId,
          dto,
          group1Items,
          paymentDate,
          company,
          actorUserId,
          1,
          fair.name,
        );
        const remittance2 = await this.createSingleRemittance(
          tx,
          fairId,
          dto,
          group2Items,
          paymentDate,
          company,
          actorUserId,
          2,
          fair.name,
        );

        createdRemittances.push(remittance1, remittance2);
      }

      // Atualizar todas as parcelas para INCLUDED_IN_REMITTANCE
      for (const item of supplierItems) {
        await tx.fairSupplierInstallment.update({
          where: { id: item.supplierInstallmentId! },
          data: {
            status: FairSupplierInstallmentStatus.INCLUDED_IN_REMITTANCE,
          },
        });
      }

      // Auditoria
      await this.audit.log(tx, {
        action: AuditAction.CREATE,
        entity: AuditEntity.PIX_REMITTANCE,
        entityId: createdRemittances[0].id,
        actorUserId,
        after: createdRemittances,
        meta: {
          mode,
          fairId,
          remittanceIds: createdRemittances.map((r) => r.id),
          totalItems: supplierItems.length,
          totalAmountCents: supplierItems.reduce(
            (s, i) => s + i.amountCents,
            0,
          ),
          groups: createdRemittances.map((r) => ({
            groupNumber: r.groupNumber,
            items: r.totalItems,
            totalAmountCents: r.totalAmountCents,
          })),
        },
      });

      // Montar resposta com downloadUrl para cada remessa criada
      return {
        createdRemittances: createdRemittances.map((r) => ({
          id: r.id,
          fileName: r.fileName,
          groupNumber: r.groupNumber ?? null,
          totalItems: r.totalItems,
          totalAmountCents: r.totalAmountCents,
          downloadUrl: `/fairs/${fairId}/pix-remittances/${r.id}/download`,
        })),
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MARK PAID
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Marca a remessa como paga e propaga o status PAID para cada parcela incluída.
   * Recalcula o status financeiro de cada fornecedor afetado.
   */
  async markPaid(
    fairId: string,
    remittanceId: string,
    dto: MarkPixRemittancePaidDto,
    actorUserId: string,
  ) {
    const remittance = await this.findRemittanceInFair(fairId, remittanceId);

    if (remittance.status !== PixRemittanceStatus.GENERATED) {
      throw new ConflictException(
        'Somente remessa com status GENERATED pode ser marcada como paga.',
      );
    }

    const paidAt = new Date(dto.paidAt);
    if (Number.isNaN(paidAt.getTime())) {
      throw new BadRequestException('paidAt inválido.');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of remittance.items) {
        if (
          item.payeeType === PixRemittancePayeeType.SUPPLIER &&
          item.supplierInstallmentId
        ) {
          // Atualizar parcela
          const installment = await tx.fairSupplierInstallment.update({
            where: { id: item.supplierInstallmentId },
            data: {
              status: FairSupplierInstallmentStatus.PAID,
              paidAt,
              paidAmountCents: item.amountCents,
            },
            select: { supplierId: true },
          });

          // Recalcular fornecedor
          await this.recomputeSupplier(tx, installment.supplierId);
        }

        if (
          item.payeeType === PixRemittancePayeeType.EXHIBITOR &&
          item.exhibitorPayoutId
        ) {
          await tx.exhibitorPayout.update({
            where: { id: item.exhibitorPayoutId },
            data: {
              status: ExhibitorPayoutStatus.PAID,
              paidAt,
              paidAmountCents: item.amountCents,
            },
          });
        }
      }

      const updated = await tx.pixRemittance.update({
        where: { id: remittanceId },
        data: { status: PixRemittanceStatus.PAID, paidAt },
        include: { items: true },
      });

      await this.audit.log(tx, {
        action: AuditAction.UPDATE,
        entity: AuditEntity.PIX_REMITTANCE,
        entityId: remittanceId,
        actorUserId,
        before: remittance,
        after: updated,
        meta: { fairId, paidAt: paidAt.toISOString() },
      });

      return updated;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CANCEL
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Cancela uma remessa GENERATED e reverte as parcelas para PENDING.
   * Não exclui registros históricos.
   */
  async cancel(fairId: string, remittanceId: string, actorUserId: string) {
    const remittance = await this.findRemittanceInFair(fairId, remittanceId);

    if (remittance.status !== PixRemittanceStatus.GENERATED) {
      throw new ConflictException(
        'Somente remessa com status GENERATED pode ser cancelada.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of remittance.items) {
        if (
          item.payeeType === PixRemittancePayeeType.SUPPLIER &&
          item.supplierInstallmentId
        ) {
          await tx.fairSupplierInstallment.update({
            where: { id: item.supplierInstallmentId },
            data: { status: FairSupplierInstallmentStatus.PENDING },
          });
        }

        if (
          item.payeeType === PixRemittancePayeeType.EXHIBITOR &&
          item.exhibitorPayoutId
        ) {
          await tx.exhibitorPayout.update({
            where: { id: item.exhibitorPayoutId },
            data: { status: ExhibitorPayoutStatus.PENDING },
          });
        }
      }

      const updated = await tx.pixRemittance.update({
        where: { id: remittanceId },
        data: {
          status: PixRemittanceStatus.CANCELLED,
          cancelledAt: new Date(),
        },
        include: { items: true },
      });

      await this.audit.log(tx, {
        action: AuditAction.UPDATE,
        entity: AuditEntity.PIX_REMITTANCE,
        entityId: remittanceId,
        actorUserId,
        before: remittance,
        after: updated,
        meta: { fairId, cancelled: true },
      });

      return updated;
    });
  }

  /**
   * Cancela uma remessa gerada e cria uma nova remessa com os itens enviados.
   * Serve para corrigir selecao, valores ou dados antes de considerar a remessa paga.
   */
  async redo(
    fairId: string,
    remittanceId: string,
    dto: CreatePixRemittanceDto,
    actorUserId: string,
  ) {
    await this.cancel(fairId, remittanceId, actorUserId);
    return this.create(fairId, dto, actorUserId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DOWNLOAD
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Retorna o conteúdo e nome do arquivo da remessa para download.
   */
  async getDownloadFile(fairId: string, remittanceId: string) {
    const remittance = await this.findRemittanceInFair(fairId, remittanceId);

    if (!remittance.fileContent || !remittance.fileName) {
      throw new NotFoundException('Arquivo da remessa não encontrado.');
    }

    return {
      fileName: remittance.fileName,
      fileContent: remittance.fileContent,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS PRIVADOS
  // ─────────────────────────────────────────────────────────────────────────────

  private async createSingleRemittance(
    tx: any,
    fairId: string,
    dto: CreatePixRemittanceDto,
    items: NormalizedSupplierItem[],
    paymentDate: Date,
    company: SispagCompanyBankConfig,
    actorUserId: string,
    groupNumber: number | null,
    fairName: string,
  ) {
    const totalAmountCents = items.reduce((s, i) => s + i.amountCents, 0);

    // Nome do arquivo
    const dateStr = this.formatDate(paymentDate);
    const fairSlug = this.slugifyFileName(fairName);
    const fileName = groupNumber
      ? `remessa-pix-${fairSlug}-grupo-${groupNumber}-${dateStr}.txt`
      : `remessa-pix-${fairSlug}-${dateStr}.txt`;

    // Criar registro inicial
    const remittance = await tx.pixRemittance.create({
      data: {
        fairId,
        paymentDate,
        description: dto.description ?? null,
        generationMode: dto.mode,
        groupNumber,
        fileName,
        status: PixRemittanceStatus.GENERATED,
        totalItems: items.length,
        totalAmountCents,
        createdByUserId: actorUserId,
      },
    });

    // Gerar conteúdo do arquivo
    const { fileContent } = this.fileService.generate({
      remittanceId: remittance.id,
      paymentDate,
      company,
      items: items.map((item) => ({
        amountCents: item.amountCents,
        payeeName: item.payeeName,
        payeeDocument: item.payeeDocument,
        pixKeyType: item.pixKeyType,
        pixKey: item.pixKey,
        txId: item.txId,
      })),
    });

    // Salvar fileContent
    await tx.pixRemittance.update({
      where: { id: remittance.id },
      data: { fileContent },
    });

    // Criar itens da remessa
    await tx.pixRemittanceItem.createMany({
      data: items.map((item) => ({
        pixRemittanceId: remittance.id,
        payeeType: item.payeeType,
        supplierInstallmentId: item.supplierInstallmentId ?? null,
        exhibitorPayoutId: item.exhibitorPayoutId ?? null,
        amountCents: item.amountCents,
        payeeName: item.payeeName,
        payeeDocument: item.payeeDocument,
        pixKeyType: item.pixKeyType,
        pixKey: item.pixKey,
        txId: item.txId ?? null,
      })),
    });

    return {
      ...remittance,
      fileContent,
      totalItems: items.length,
      totalAmountCents,
    };
  }

  private async loadAndValidateSupplierItems(
    fairId: string,
    items: CreatePixRemittanceItemDto[],
  ): Promise<NormalizedSupplierItem[]> {
    const supplierDtos = items.filter(
      (item) => item.payeeType === PixRemittancePayeeType.SUPPLIER,
    );

    if (!supplierDtos.length) {
      throw new BadRequestException('Informe ao menos um item de fornecedor.');
    }

    const ids = supplierDtos.map(
      (item) => item.supplierInstallmentId as string,
    );

    const installments = await this.prisma.fairSupplierInstallment.findMany({
      where: { id: { in: ids } },
      include: { supplier: true },
    });

    if (installments.length !== ids.length) {
      throw new NotFoundException(
        'Uma ou mais parcelas de fornecedor não foram encontradas.',
      );
    }

    return installments.map((installment) => {
      const dto = supplierDtos.find(
        (d) => d.supplierInstallmentId === installment.id,
      )!;

      // Parcela pertence à feira
      if (installment.supplier.fairId !== fairId) {
        throw new BadRequestException(
          `Parcela ${installment.id} não pertence à feira da rota.`,
        );
      }

      // Parcela deve estar PENDING
      if (installment.status !== FairSupplierInstallmentStatus.PENDING) {
        throw new ConflictException(
          `Parcela ${installment.id} não está PENDING (status atual: ${installment.status}).`,
        );
      }

      // Fornecedor deve ter PIX
      if (!installment.supplier.pixKey || !installment.supplier.pixKeyType) {
        throw new BadRequestException(
          `Fornecedor "${installment.supplier.name}" não possui chave PIX configurada.`,
        );
      }

      // Fornecedor deve ter documento do titular
      if (!installment.supplier.holderDocument) {
        throw new BadRequestException(
          `Fornecedor "${installment.supplier.name}" não possui documento do titular.`,
        );
      }

      // Fornecedor deve ter nome do titular
      if (!installment.supplier.holderName) {
        throw new BadRequestException(
          `Fornecedor "${installment.supplier.name}" não possui nome do titular.`,
        );
      }

      // amountCents do DTO deve ser > 0 e <= valor da parcela
      if (!dto.amountCents || dto.amountCents <= 0) {
        throw new BadRequestException(
          `Valor inválido para a parcela ${installment.id}.`,
        );
      }

      if (dto.amountCents > installment.amountCents) {
        throw new BadRequestException(
          `Valor informado (${dto.amountCents}) é maior que o valor da parcela (${installment.amountCents}).`,
        );
      }

      // Validar grupo
      if (dto.group !== undefined && dto.group !== 1 && dto.group !== 2) {
        throw new BadRequestException('O campo group deve ser 1 ou 2.');
      }

      return {
        payeeType: PixRemittancePayeeType.SUPPLIER,
        supplierInstallmentId: installment.id,
        exhibitorPayoutId: null,
        amountCents: dto.amountCents,
        payeeName: installment.supplier.holderName,
        payeeDocument: installment.supplier.holderDocument,
        pixKeyType: installment.supplier.pixKeyType as PixKeyType,
        pixKey: installment.supplier.pixKey,
        txId: null,
        group: dto.group ?? 1,
      };
    });
  }

  private assertItemShape(
    item: CreatePixRemittanceItemDto,
    mode: PixRemittanceGenerationMode,
  ) {
    const hasSupplier = Boolean(item.supplierInstallmentId);
    const hasExhibitor = Boolean(item.exhibitorPayoutId);

    if (hasSupplier && hasExhibitor) {
      throw new BadRequestException(
        'Informe somente supplierInstallmentId ou exhibitorPayoutId, não ambos.',
      );
    }
    if (!hasSupplier && !hasExhibitor) {
      throw new BadRequestException(
        'Informe supplierInstallmentId ou exhibitorPayoutId.',
      );
    }
    if (item.payeeType === PixRemittancePayeeType.SUPPLIER && !hasSupplier) {
      throw new BadRequestException(
        'supplierInstallmentId é obrigatório para payeeType=SUPPLIER.',
      );
    }
    if (item.payeeType === PixRemittancePayeeType.EXHIBITOR && !hasExhibitor) {
      throw new BadRequestException(
        'exhibitorPayoutId é obrigatório para payeeType=EXHIBITOR.',
      );
    }

    // Validar group no modo SPLIT_TWO
    if (mode === PixRemittanceGenerationMode.SPLIT_TWO) {
      if (item.group === undefined || item.group === null) {
        throw new BadRequestException(
          'No modo SPLIT_TWO todos os itens precisam ter o campo group (1 ou 2).',
        );
      }
      if (item.group !== 1 && item.group !== 2) {
        throw new BadRequestException('O campo group deve ser 1 ou 2.');
      }
    }
  }

  private assertNoDuplicateItems(items: CreatePixRemittanceItemDto[]) {
    const keys = items.map(
      (item) =>
        `${item.payeeType}:${item.supplierInstallmentId ?? item.exhibitorPayoutId}`,
    );
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException(
        'Não é permitido repetir itens na mesma remessa.',
      );
    }
  }

  private assertSplitGroups(items: CreatePixRemittanceItemDto[]) {
    const hasGroup1 = items.some((i) => i.group === 1);
    const hasGroup2 = items.some((i) => i.group === 2);
    if (!hasGroup1 || !hasGroup2) {
      throw new BadRequestException(
        'Para SPLIT_TWO é necessário ter pelo menos um item no grupo 1 e um no grupo 2.',
      );
    }
  }

  private loadCompanyConfig(): SispagCompanyBankConfig {
    const doc = process.env.SISPAG_COMPANY_DOCUMENT ?? '65112374000144';
    const agency = process.env.SISPAG_COMPANY_AGENCY ?? '0062';
    const account = process.env.SISPAG_COMPANY_ACCOUNT ?? '98794';
    const accountDigit = process.env.SISPAG_COMPANY_ACCOUNT_DIGIT ?? '6';
    const name =
      process.env.SISPAG_COMPANY_NAME ?? 'ONLYINBR PRODUCOES CULTURAIS L';

    if (!doc || !agency || !account || !accountDigit || !name) {
      throw new InternalServerErrorException(
        'Configuração bancária da empresa pagadora incompleta. ' +
          'Verifique as variáveis: SISPAG_COMPANY_DOCUMENT, SISPAG_COMPANY_AGENCY, ' +
          'SISPAG_COMPANY_ACCOUNT, SISPAG_COMPANY_ACCOUNT_DIGIT, SISPAG_COMPANY_NAME.',
      );
    }

    return { document: doc, agency, account, accountDigit, name };
  }

  private async requireFair(fairId: string) {
    const fair = await this.prisma.fair.findUnique({
      where: { id: fairId },
      select: { id: true, name: true },
    });
    if (!fair) throw new NotFoundException('Feira não encontrada.');
    return fair;
  }

  private async findRemittanceInFair(fairId: string, remittanceId: string) {
    const remittance = await this.prisma.pixRemittance.findUnique({
      where: { id: remittanceId },
      include: { items: true },
    });

    if (!remittance || remittance.fairId !== fairId) {
      throw new NotFoundException('Remessa PIX não encontrada nesta feira.');
    }

    return remittance;
  }

  private async recomputeSupplier(tx: any, supplierId: string) {
    const supplier = await tx.fairSupplier.findUniqueOrThrow({
      where: { id: supplierId },
      include: { installments: true },
    });

    const paidAmountCents = supplier.installments
      .filter((i: any) => i.status === FairSupplierInstallmentStatus.PAID)
      .reduce((sum: number, i: any) => sum + (i.paidAmountCents ?? 0), 0);

    const pendingAmountCents = Math.max(
      supplier.totalAmountCents - paidAmountCents,
      0,
    );

    let status: FairSupplierStatus = FairSupplierStatus.PENDING;
    if (
      paidAmountCents >= supplier.totalAmountCents &&
      supplier.totalAmountCents > 0
    ) {
      status = FairSupplierStatus.PAID;
    } else if (paidAmountCents > 0) {
      status = FairSupplierStatus.PARTIALLY_PAID;
    }

    await tx.fairSupplier.update({
      where: { id: supplierId },
      data: { paidAmountCents, pendingAmountCents, status },
    });
  }

  private formatDate(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  private slugifyFileName(value: string) {
    return (
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'feira'
    );
  }
}

// Tipo interno para itens normalizados já validados
type NormalizedSupplierItem = {
  payeeType: PixRemittancePayeeType;
  supplierInstallmentId: string | null;
  exhibitorPayoutId: string | null;
  amountCents: number;
  payeeName: string;
  payeeDocument: string;
  pixKeyType: PixKeyType;
  pixKey: string;
  txId: string | null;
  group: number;
};
