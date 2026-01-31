import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDocumentTemplateDto } from '../dto/templates/create-document-template.dto';
import { ListDocumentTemplatesDto } from '../dto/templates/list-document-templates.dto';
import { UpdateDocumentTemplateDto } from '../dto/templates/update-document-template.dto';

@Injectable()
export class DocumentTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDocumentTemplateDto) {
    const created = await this.prisma.documentTemplate.create({
      data: {
        title: dto.title,
        isAddendum: dto.isAddendum ?? false,
        hasRegistration: dto.hasRegistration ?? true,
        status: dto.status ?? 'DRAFT',
        content: dto.content,
        // createdByUserId: userId (se quiser amarrar no @CurrentUser depois)
      },
    });

    return created;
  }

  /**
   * Lista templates.
   *
   * Novidade:
   * - mode=summary retorna payload leve (sem content) e inclui usage.fairsCount para UI.
   * - mode=full mantém retorno completo (incluindo content).
   */
  async list(query: ListDocumentTemplatesDto) {
    const where: any = {};

    if (query.status) where.status = query.status;
    if (typeof query.isAddendum === 'boolean') where.isAddendum = query.isAddendum;

    const mode = query.mode ?? 'full';

    // -------------------------
    // 1) FULL: mantém compatível
    // -------------------------
    if (mode === 'full') {
      return this.prisma.documentTemplate.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
      });
    }

    // -------------------------
    // 2) SUMMARY: sem content + fairsCount
    // -------------------------
    const templates = await this.prisma.documentTemplate.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        isAddendum: true,
        hasRegistration: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!templates.length) return [];

    const ids = templates.map((t) => t.id);

    // 2.1) Contratos principais: conta feiras que configuraram este template (FairContractSettings)
    const mainCounts = await this.prisma.fairContractSettings.groupBy({
      by: ['templateId'],
      where: { templateId: { in: ids } },
      _count: { _all: true },
    });

    const mainMap = new Map<string, number>();
    for (const row of mainCounts) {
      mainMap.set(row.templateId, row._count._all);
    }

    // 2.2) Aditivos: conta feiras distintas que usam esse template via OwnerFairAddendum -> OwnerFair(fairId)
    // Observação: Prisma permite distinct em findMany.
    // Vamos buscar pares únicos { templateId, ownerFair.fairId } e contar no JS.
    const addendumPairs = await this.prisma.ownerFairAddendum.findMany({
      where: { templateId: { in: ids } },
      select: {
        templateId: true,
        ownerFair: { select: { fairId: true } },
      },
      distinct: ['templateId', 'ownerFairId'], // garante unicidade por vínculo; depois a gente dedup por fairId
    });

    const addendumMap = new Map<string, Set<string>>();
    for (const row of addendumPairs) {
      const set = addendumMap.get(row.templateId) ?? new Set<string>();
      set.add(row.ownerFair.fairId);
      addendumMap.set(row.templateId, set);
    }

    // monta resposta final
    return templates.map((t) => {
      const fairsCount = t.isAddendum
        ? addendumMap.get(t.id)?.size ?? 0
        : mainMap.get(t.id) ?? 0;

      return {
        ...t,
        usage: {
          fairsCount,
        },
      };
    });
  }

  async getById(id: string) {
    const found = await this.prisma.documentTemplate.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Template não encontrado.');
    return found;
  }

  async update(id: string, dto: UpdateDocumentTemplateDto) {
    await this.ensureExists(id);

    const updated = await this.prisma.documentTemplate.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.isAddendum !== undefined ? { isAddendum: dto.isAddendum } : {}),
        ...(dto.hasRegistration !== undefined ? { hasRegistration: dto.hasRegistration } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
      },
    });

    return updated;
  }

  async remove(id: string) {
    await this.ensureExists(id);

    // Se quiser proteger delete quando já estiver em uso por FairContractSettings/Contract/Addendum:
    // aqui dá pra checar relações e sugerir ARCHIVED.
    return this.prisma.documentTemplate.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.documentTemplate.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Template não encontrado.');
  }
}
