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

/**
 * ✅ ExcelDatasetsService
 *
 * Responsável por:
 * - Definir o catálogo de datasets e fields permitidos (contrato do builder)
 * - Validar fieldKeys (via findField/getDatasetDefinition)
 * - Ser consumido como "registry" pelo ExcelGeneratorService (core)
 *
 * Observação importante:
 * - O "resolve" de cada field depende do formato do contexto (ctx) e do row (tabela).
 * - Quem monta ctx.root e ctx.lists é o módulo excel-exports.
 * - Aqui fornecemos resolvers seguros (getPath) para reduzir acoplamento.
 */
@Injectable()
export class ExcelDatasetsService implements ExcelRegistry {
  /**
   * Catálogo central: datasets disponíveis e seus campos.
   * ✅ No MVP, definimos keys "canônicas" e resolvemos via getPath.
   *
   * Convenção sugerida:
   * - Campos do contexto global (sheet dataset FAIR): prefixo "fair.*"
   * - Campos de linha em tabelas: "owner.*", "stall.*", "ownerFair.*", etc.
   */
  private readonly definitions: ExcelDatasetDefinition[] = [
    {
      dataset: ExcelDataset.FAIR,
      label: 'Feira',
      fields: [
        this.field('fair.id', 'ID da feira', ExcelValueFormat.TEXT),
        this.field('fair.name', 'Nome da feira', ExcelValueFormat.TEXT),
        this.field('fair.status', 'Status da feira', ExcelValueFormat.TEXT),
        this.field('fair.address', 'Endereço', ExcelValueFormat.TEXT),
        this.field('fair.stallsCapacity', 'Capacidade de barracas', ExcelValueFormat.INT),
        this.field('fair.stallsReserved', 'Barracas reservadas', ExcelValueFormat.INT),
        this.field('fair.stallsRemaining', 'Barracas disponíveis', ExcelValueFormat.INT),
        this.field('generatedAt', 'Gerado em', ExcelValueFormat.DATETIME),
      ],
    },

    {
      dataset: ExcelDataset.FAIR_EXHIBITORS,
      label: 'Expositores da feira',
      fields: [
        this.field('owner.id', 'ID do expositor', ExcelValueFormat.TEXT),
        this.field('owner.fullName', 'Nome do expositor', ExcelValueFormat.TEXT),
        this.field('owner.document', 'Documento (CPF/CNPJ)', ExcelValueFormat.TEXT),
        this.field('owner.email', 'E-mail', ExcelValueFormat.TEXT),
        this.field('owner.phone', 'Telefone', ExcelValueFormat.TEXT),

        this.field('ownerFair.status', 'Status (operacional)', ExcelValueFormat.TEXT),
        this.field('ownerFair.observations', 'Observações', ExcelValueFormat.TEXT),

        // Financeiro (depende do shape que excel-exports montar)
        this.field('payment.status', 'Status do pagamento', ExcelValueFormat.TEXT),
        this.field('payment.paidCents', 'Total pago (centavos)', ExcelValueFormat.MONEY_CENTS),
        this.field('payment.totalCents', 'Total devido (centavos)', ExcelValueFormat.MONEY_CENTS),
      ],
    },

    {
      dataset: ExcelDataset.FAIR_STALLS,
      label: 'Barracas da feira',
      fields: [
        this.field('stall.id', 'ID da barraca', ExcelValueFormat.TEXT),
        this.field('stall.pdvName', 'Nome (PDV)', ExcelValueFormat.TEXT),
        this.field('stall.stallType', 'Tipo', ExcelValueFormat.TEXT),
        this.field('stall.stallSize', 'Tamanho', ExcelValueFormat.TEXT),
        this.field('stall.machinesQty', 'Qtd. maquinhas', ExcelValueFormat.INT),
        this.field('stall.teamQty', 'Qtd. equipe', ExcelValueFormat.INT),

        this.field('owner.fullName', 'Expositor', ExcelValueFormat.TEXT),
        this.field('owner.document', 'Documento do expositor', ExcelValueFormat.TEXT),

        // Informações do vínculo/compra (depende do shape do row)
        this.field('purchase.totalCents', 'Valor da compra (centavos)', ExcelValueFormat.MONEY_CENTS),
        this.field('purchase.paidCents', 'Pago (centavos)', ExcelValueFormat.MONEY_CENTS),
        this.field('purchase.status', 'Status da compra', ExcelValueFormat.TEXT),
      ],
    },
  ];

  /**
   * Lista datasets para o builder.
   */
  listDatasets(): ExcelDatasetItemDto[] {
    return this.definitions.map((d) => ({
      dataset: d.dataset,
      label: d.label,
    }));
  }

  /**
   * Lista fields de um dataset para o builder.
   */
  listFields(dataset: ExcelDataset): ExcelDatasetFieldDto[] {
    const def = this.getDatasetDefinition(dataset);

    return def.fields.map((f) => ({
      key: f.key,
      label: f.label,
      format: f.format,
    }));
  }

  /**
   * ✅ ExcelRegistry implementation
   *
   * Retorna a definição completa do dataset.
   */
  getDatasetDefinition(dataset: ExcelDataset): ExcelDatasetDefinition {
    const found = this.definitions.find((d) => d.dataset === dataset);
    if (!found) {
      // Em teoria nunca deve acontecer porque dataset é enum,
      // mas mantemos erro claro para manutenção futura.
      throw new Error(`Dataset não suportado no catálogo: ${dataset}`);
    }
    return found;
  }

  /**
   * ✅ ExcelRegistry implementation
   *
   * Encontra um field do catálogo (ou null se não existir).
   * Usado pela validação de templates e pelo gerador em runtime.
   */
  findField(dataset: ExcelDataset, key: string): ExcelDatasetFieldDefinition | null {
    const def = this.getDatasetDefinition(dataset);
    return def.fields.find((f) => f.key === key) ?? null;
  }

  // =========================
  // Helpers internos
  // =========================

  /**
   * Cria um field do catálogo com resolver padrão.
   * Por padrão, resolve por path:
   * - Se for célula fixa (BIND) => resolve em ctx.root
   * - Se for tabela => resolve no row (se existir), e faz fallback no ctx.root
   */
  private field(key: string, label: string, format: ExcelValueFormat): ExcelDatasetFieldDefinition {
    return {
      key,
      label,
      format,
      resolve: (ctx: ExcelContext, row?: Record<string, unknown>) => {
        // 1) tenta resolver a partir do row (tabelas)
        const fromRow = row ? this.getPath(row, key) : undefined;
        if (fromRow !== undefined) return fromRow;

        // 2) fallback: tenta no root (células fixas / campos globais)
        return this.getPath(ctx.root ?? {}, key);
      },
    };
  }

  /**
   * Resolve um path "a.b.c" em um objeto.
   * ✅ Intenção: permitir que excel-exports monte objetos ricos sem acoplar
   * o gerador (e o catálogo) ao Prisma diretamente.
   */
  private getPath(obj: Record<string, unknown>, path: string): unknown {
    if (!obj || !path) return undefined;

    const parts = path.split('.');
    let current: any = obj;

    for (const p of parts) {
      if (current == null) return undefined;
      current = current[p];
    }

    return current;
  }
}
