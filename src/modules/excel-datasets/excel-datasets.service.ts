import { Injectable } from '@nestjs/common';
import { ExcelDataset, ExcelValueFormat } from '@prisma/client';

import { ExcelContext } from '../../excel/types/excel-context.type';
import {
  ExcelDatasetDefinition,
  ExcelDatasetFieldDefinition,
  ExcelRegistry,
} from '../../excel/types/excel-registry.type';

import { ExcelDatasetFieldDto } from './dto/excel-dataset-field.dto';
import { ExcelDatasetItemDto } from './dto/excel-dataset-item.dto';
import { buildExcelDatasetDefinitions } from './excel-datasets.definitions';

@Injectable()
export class ExcelDatasetsService implements ExcelRegistry {
  /**
   * ✅ Catálogo agora fica em arquivo separado.
   * Aqui só “montamos” ele passando a factory `this.field`.
   */
  private readonly definitions: ExcelDatasetDefinition[] =
    buildExcelDatasetDefinitions(this.field.bind(this));

  listDatasets(): ExcelDatasetItemDto[] {
    return this.definitions.map((d) => ({
      dataset: d.dataset,
      label: d.label,
      scope: d.scope ?? [],
    }));
  }

  listFields(dataset: ExcelDataset): ExcelDatasetFieldDto[] {
    const def = this.getDatasetDefinition(dataset);
    return def.fields.map((f) => ({
      fieldKey: f.fieldKey,
      label: f.label,
      format: f.format,
      group: f.group,
      hint: f.hint,
    }));
  }

  getDatasetDefinition(dataset: ExcelDataset): ExcelDatasetDefinition {
    const found = this.definitions.find((d) => d.dataset === dataset);
    if (!found)
      throw new Error(`Dataset não suportado no catálogo: ${dataset}`);
    return found;
  }

  findField(
    dataset: ExcelDataset,
    fieldKey: string,
  ): ExcelDatasetFieldDefinition | null {
    const def = this.getDatasetDefinition(dataset);
    return def.fields.find((f) => f.fieldKey === fieldKey) ?? null;
  }

  private field(
    fieldKey: string,
    label: string,
    format: ExcelValueFormat,
    group?: string,
    hint?: string,
  ): ExcelDatasetFieldDefinition {
    return {
      fieldKey,
      label,
      format,
      group,
      hint,
      resolve: (ctx: ExcelContext, row?: Record<string, unknown>) => {
        // 1) tenta resolver a partir da row (MULTI)
        const fromRow = row ? this.getPath(row, fieldKey) : undefined;
        if (fromRow !== undefined) return fromRow;

        // 2) fallback no ctx.root (SINGLE ou campos globais)
        return this.getPath((ctx.root ?? {}) as any, fieldKey);
      },
    };
  }

  private getPath(obj: Record<string, unknown>, path: string): unknown {
    if (!obj || !path) return undefined;

    const parts = path.split('.');
    let current: unknown = obj;

    for (const p of parts) {
      if (current == null) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[p];
    }

    return current;
  }
}
