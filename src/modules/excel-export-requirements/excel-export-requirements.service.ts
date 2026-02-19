import { Injectable, NotFoundException } from '@nestjs/common';
import { ExcelDataset } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ExcelDatasetsService } from '../excel-datasets/excel-datasets.service';

import { ExcelExportRequirementsResponseDto } from './dto/excel-export-requirements-response.dto';
import { ExcelExportRequirementParamDto } from './dto/excel-export-requirement-param.dto';
import { ExcelExportOptionItemDto } from './dto/excel-export-option-item.dto';
import {
  ExcelDatasetScopeParam,
  ExcelScopeParamKey,
} from 'src/excel/types/excel-registry.type';

/**
 * ExcelExportRequirementsService
 *
 * Responsabilidade:
 * - Receber templateId
 * - Ler datasets usados nas abas
 * - Consultar catálogo (ExcelDatasetsService) para descobrir `scope`
 * - Retornar params + opções para autocomplete
 */
@Injectable()
export class ExcelExportRequirementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly datasets: ExcelDatasetsService,
  ) {}

  async getRequirements(
    templateId: string,
  ): Promise<ExcelExportRequirementsResponseDto> {
    const template = await this.prisma.excelTemplate.findUnique({
      where: { id: templateId },
      include: {
        sheets: { select: { dataset: true } },
      },
    });

    if (!template) throw new NotFoundException('Template não encontrado.');

    const usedDatasets = Array.from(
      new Set(template.sheets.map((s) => s.dataset)),
    );

    const params = this.resolveParamsFromDatasets(usedDatasets);

    const options: ExcelExportRequirementsResponseDto['options'] = {};
    const needs = new Set(params.map((p) => p.key));

    if (needs.has('fairId')) options.fairId = await this.listFairOptions();
    if (needs.has('ownerId')) options.ownerId = await this.listOwnerOptions();
    if (needs.has('stallId')) options.stallId = await this.listStallOptions();

    return { params, options };
  }

  /**
   * Une os scopes de todos os datasets usados.
   * - se algum required=true => obrigatório
   * - junta "requiredByDatasets" para explicar na UI
   */
  private resolveParamsFromDatasets(
    datasets: ExcelDataset[],
  ): ExcelExportRequirementParamDto[] {
    const map = new Map<ExcelScopeParamKey, ExcelExportRequirementParamDto>();

    for (const ds of datasets) {
      const def = this.datasets.getDatasetDefinition(ds); // ✅ agora tem scope no tipo
      const scope: ExcelDatasetScopeParam[] = def.scope ?? [];

      for (const p of scope) {
        const prev = map.get(p.key);
        if (!prev) {
          map.set(p.key, {
            key: p.key,
            label: p.label,
            type: p.type,
            required: p.required,
            hint: p.hint,
            requiredByDatasets: [String(ds)],
          });
        } else {
          map.set(p.key, {
            ...prev,
            required: prev.required || p.required,
            requiredByDatasets: Array.from(
              new Set([...(prev.requiredByDatasets ?? []), String(ds)]),
            ),
          });
        }
      }
    }

    const order: ExcelScopeParamKey[] = ['fairId', 'ownerId', 'stallId'];
    return Array.from(map.values()).sort(
      (a, b) => order.indexOf(a.key) - order.indexOf(b.key),
    );
  }

  /**
   * MVP: lista curta para autocomplete (sem search).
   * Evolução futura: endpoints com ?search= para não carregar tudo.
   */
  private async listFairOptions(): Promise<ExcelExportOptionItemDto[]> {
    const fairs = await this.prisma.fair.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, name: true, status: true },
    });

    return fairs.map((f) => ({
      id: f.id,
      label: f.name,
      meta: { status: f.status },
    }));
  }

  private async listOwnerOptions(): Promise<ExcelExportOptionItemDto[]> {
    const owners = await this.prisma.owner.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 300,
      select: { id: true, fullName: true, document: true },
    });

    return owners.map((o) => ({
      id: o.id,
      label: `${o.fullName ?? 'Sem nome'} • ${o.document ?? 'sem doc'}`,
      meta: { fullName: o.fullName, document: o.document },
    }));
  }

  private async listStallOptions(): Promise<ExcelExportOptionItemDto[]> {
    const stalls = await this.prisma.stall.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 300,
      select: {
        id: true,
        pdvName: true,
        stallSize: true,
        owner: { select: { fullName: true, document: true } },
      },
    });

    return stalls.map((s) => ({
      id: s.id,
      label: `${s.pdvName} • ${String(s.stallSize)}`,
      meta: {
        stallSize: s.stallSize,
        ownerName: s.owner?.fullName,
        ownerDocument: s.owner?.document,
      },
    }));
  }
}
