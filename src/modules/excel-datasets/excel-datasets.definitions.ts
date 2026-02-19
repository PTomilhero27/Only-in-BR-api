import { ExcelDataset, ExcelValueFormat } from '@prisma/client';
import {
  ExcelDatasetDefinition,
  ExcelDatasetFieldDefinition,
} from 'src/excel/types/excel-registry.type';

/**
 * Um helper type para montar os fields usando a factory do service (this.field).
 */
type FieldFactory = (
  fieldKey: string,
  label: string,
  format: ExcelValueFormat,
  group?: string,
  hint?: string,
) => ExcelDatasetFieldDefinition;

/**
 * ✅ Catálogo em arquivo separado
 * - o Service injeta a função `field(...)` pra não duplicar lógica do resolve
 */
export function buildExcelDatasetDefinitions(
  field: FieldFactory,
): ExcelDatasetDefinition[] {
  return [
    // =========================
    // SINGLE — FAIR
    // =========================
    {
      dataset: ExcelDataset.FAIR_INFO,
      label: 'Feira (Dados)',
      scope: [
        {
          key: 'fairId',
          label: 'Feira',
          type: 'UUID',
          required: true,
          hint: 'Obrigatório para gerar o contexto da feira.',
        },
      ],
      fields: [
        field('fair.id', 'ID da feira', ExcelValueFormat.TEXT, 'Feira'),
        field('fair.name', 'Nome da feira', ExcelValueFormat.TEXT, 'Feira'),
        field('fair.status', 'Status da feira', ExcelValueFormat.TEXT, 'Feira'),
        field(
          'fair.address',
          'Endereço completo',
          ExcelValueFormat.TEXT,
          'Feira',
        ),
        field(
          'fair.stallsCapacity',
          'Capacidade de barracas',
          ExcelValueFormat.INT,
          'Capacidade',
        ),

        field(
          'fair.occurrencesText',
          'Ocorrências (texto)',
          ExcelValueFormat.TEXT,
          'Datas',
          'Se o export preencher occurrencesText com um resumo das ocorrências.',
        ),

        field('generatedAt', 'Gerado em', ExcelValueFormat.DATETIME, 'Sistema'),
      ],
    },

    {
      dataset: ExcelDataset.FAIR_SUMMARY,
      label: 'Feira (Resumo)',
      scope: [
        {
          key: 'fairId',
          label: 'Feira',
          type: 'UUID',
          required: true,
          hint: 'Obrigatório para KPIs e resumo da feira.',
        },
      ],
      fields: [
        field(
          'summary.stallsReserved',
          'Barracas reservadas (total)',
          ExcelValueFormat.INT,
          'Capacidade',
          'Campo calculado no export (ex.: soma de OwnerFair.stallsQty).',
        ),
        field(
          'summary.stallsRemaining',
          'Barracas disponíveis',
          ExcelValueFormat.INT,
          'Capacidade',
          'Campo calculado no export (capacity - reserved).',
        ),

        field(
          'summary.exhibitorsCount',
          'Expositores (qtd)',
          ExcelValueFormat.INT,
          'KPI',
        ),
        field(
          'summary.stallsLinkedCount',
          'Barracas vinculadas (qtd)',
          ExcelValueFormat.INT,
          'KPI',
        ),

        field('generatedAt', 'Gerado em', ExcelValueFormat.DATETIME, 'Sistema'),
      ],
    },

    // =========================
    // SINGLE — OWNER
    // =========================
    {
      dataset: ExcelDataset.OWNER_INFO,
      label: 'Expositor (Dados)',
      scope: [
        {
          key: 'ownerId',
          label: 'Expositor',
          type: 'CUID',
          required: true,
          hint: 'Obrigatório para gerar o contexto do expositor.',
        },
      ],
      fields: [
        field(
          'owner.id',
          'ID do expositor',
          ExcelValueFormat.TEXT,
          'Expositor',
        ),
        field(
          'owner.personType',
          'Tipo (PF/PJ)',
          ExcelValueFormat.TEXT,
          'Expositor',
        ),
        field(
          'owner.fullName',
          'Nome / Razão Social',
          ExcelValueFormat.TEXT,
          'Expositor',
        ),
        field(
          'owner.document',
          'Documento (CPF/CNPJ)',
          ExcelValueFormat.TEXT,
          'Expositor',
        ),
        field('owner.email', 'E-mail', ExcelValueFormat.TEXT, 'Contato'),
        field('owner.phone', 'Telefone', ExcelValueFormat.TEXT, 'Contato'),

        field(
          'owner.addressFull',
          'Endereço',
          ExcelValueFormat.TEXT,
          'Endereço',
        ),
        field('owner.addressCity', 'Cidade', ExcelValueFormat.TEXT, 'Endereço'),
        field('owner.addressState', 'UF', ExcelValueFormat.TEXT, 'Endereço'),
        field('owner.addressZipcode', 'CEP', ExcelValueFormat.TEXT, 'Endereço'),
        field(
          'owner.addressNumber',
          'Número',
          ExcelValueFormat.TEXT,
          'Endereço',
        ),

        field('owner.pixKey', 'Chave Pix', ExcelValueFormat.TEXT, 'Financeiro'),
        field('owner.bankName', 'Banco', ExcelValueFormat.TEXT, 'Financeiro'),
        field(
          'owner.bankAgency',
          'Agência',
          ExcelValueFormat.TEXT,
          'Financeiro',
        ),
        field(
          'owner.bankAccount',
          'Conta',
          ExcelValueFormat.TEXT,
          'Financeiro',
        ),
        field(
          'owner.bankAccountType',
          'Tipo de conta',
          ExcelValueFormat.TEXT,
          'Financeiro',
        ),
        field(
          'owner.bankHolderDoc',
          'CPF/CNPJ do titular',
          ExcelValueFormat.TEXT,
          'Financeiro',
        ),
        field(
          'owner.bankHolderName',
          'Nome do titular',
          ExcelValueFormat.TEXT,
          'Financeiro',
        ),

        field(
          'owner.stallsDescription',
          'Descrição das barracas',
          ExcelValueFormat.TEXT,
          'Operação',
        ),

        field('generatedAt', 'Gerado em', ExcelValueFormat.DATETIME, 'Sistema'),
      ],
    },

    {
      dataset: ExcelDataset.OWNER_SUMMARY,
      label: 'Expositor (Resumo)',
      scope: [
        {
          key: 'ownerId',
          label: 'Expositor',
          type: 'CUID',
          required: true,
          hint: 'Obrigatório para KPIs do expositor.',
        },
      ],
      fields: [
        field(
          'summary.fairsCount',
          'Feiras vinculadas (qtd)',
          ExcelValueFormat.INT,
          'KPI',
        ),
        field(
          'summary.stallsCount',
          'Barracas cadastradas (qtd)',
          ExcelValueFormat.INT,
          'KPI',
        ),
        field('generatedAt', 'Gerado em', ExcelValueFormat.DATETIME, 'Sistema'),
      ],
    },

    // =========================
    // SINGLE — STALL
    // =========================
    {
      dataset: ExcelDataset.STALL_INFO,
      label: 'Barraca (Dados)',
      scope: [
        {
          key: 'stallId',
          label: 'Barraca',
          type: 'CUID',
          required: true,
          hint: 'Obrigatório para gerar contexto da barraca.',
        },
      ],
      fields: [
        field('stall.id', 'ID da barraca', ExcelValueFormat.TEXT, 'Barraca'),
        field('stall.pdvName', 'Nome (PDV)', ExcelValueFormat.TEXT, 'Barraca'),
        field(
          'stall.bannerName',
          'Nome do banner',
          ExcelValueFormat.TEXT,
          'Barraca',
        ),
        field(
          'stall.mainCategory',
          'Categoria principal',
          ExcelValueFormat.TEXT,
          'Barraca',
        ),
        field('stall.stallType', 'Tipo', ExcelValueFormat.TEXT, 'Barraca'),
        field('stall.stallSize', 'Tamanho', ExcelValueFormat.TEXT, 'Barraca'),

        field(
          'stall.machinesQty',
          'Qtd. maquinhas',
          ExcelValueFormat.INT,
          'Operação',
        ),
        field('stall.teamQty', 'Qtd. equipe', ExcelValueFormat.INT, 'Operação'),

        field(
          'powerNeed.needsGas',
          'Precisa de gás',
          ExcelValueFormat.BOOL,
          'Infra',
        ),
        field(
          'powerNeed.outlets110',
          'Tomadas 110v',
          ExcelValueFormat.INT,
          'Infra',
        ),
        field(
          'powerNeed.outlets220',
          'Tomadas 220v',
          ExcelValueFormat.INT,
          'Infra',
        ),
        field(
          'powerNeed.outletsOther',
          'Outras tomadas',
          ExcelValueFormat.INT,
          'Infra',
        ),
        field('powerNeed.gasNotes', 'Obs. gás', ExcelValueFormat.TEXT, 'Infra'),
        field('powerNeed.notes', 'Obs. infra', ExcelValueFormat.TEXT, 'Infra'),

        field(
          'owner.id',
          'ID do expositor',
          ExcelValueFormat.TEXT,
          'Expositor',
        ),
        field(
          'owner.fullName',
          'Expositor',
          ExcelValueFormat.TEXT,
          'Expositor',
        ),
        field(
          'owner.document',
          'Documento do expositor',
          ExcelValueFormat.TEXT,
          'Expositor',
        ),

        field('generatedAt', 'Gerado em', ExcelValueFormat.DATETIME, 'Sistema'),
      ],
    },

    {
      dataset: ExcelDataset.STALL_SUMMARY,
      label: 'Barraca (Resumo)',
      scope: [
        {
          key: 'stallId',
          label: 'Barraca',
          type: 'CUID',
          required: true,
          hint: 'Obrigatório para KPIs da barraca.',
        },
      ],
      fields: [
        field(
          'summary.fairsCount',
          'Feiras vinculadas (qtd)',
          ExcelValueFormat.INT,
          'KPI',
        ),
        field('generatedAt', 'Gerado em', ExcelValueFormat.DATETIME, 'Sistema'),
      ],
    },

    // =========================
    // MULTI — FAIR EXHIBITORS
    // =========================
    {
      dataset: ExcelDataset.FAIR_EXHIBITORS_LIST,
      label: 'Lista: Expositores da feira',
      scope: [
        {
          key: 'fairId',
          label: 'Feira',
          type: 'UUID',
          required: true,
          hint: 'Obrigatório: lista por feira.',
        },
        {
          key: 'ownerId',
          label: 'Expositor (opcional)',
          type: 'CUID',
          required: false,
          hint: 'Filtra para 1 expositor.',
        },
      ],
      fields: [
        field(
          'owner.id',
          'ID do expositor',
          ExcelValueFormat.TEXT,
          'Expositor',
        ),
        field(
          'owner.fullName',
          'Nome do expositor',
          ExcelValueFormat.TEXT,
          'Expositor',
        ),
        field(
          'owner.document',
          'Documento (CPF/CNPJ)',
          ExcelValueFormat.TEXT,
          'Expositor',
        ),
        field('owner.email', 'E-mail', ExcelValueFormat.TEXT, 'Contato'),
        field('owner.phone', 'Telefone', ExcelValueFormat.TEXT, 'Contato'),

        field(
          'ownerFair.status',
          'Status (operacional)',
          ExcelValueFormat.TEXT,
          'Feira',
        ),
        field(
          'ownerFair.stallsQty',
          'Barracas reservadas (qty)',
          ExcelValueFormat.INT,
          'Feira',
        ),
        field(
          'ownerFair.contractSignedAt',
          'Assinado em',
          ExcelValueFormat.DATETIME,
          'Contrato',
        ),
        field(
          'ownerFair.observations',
          'Observações',
          ExcelValueFormat.TEXT,
          'Feira',
        ),

        field(
          'financial.totalCents',
          'Total (centavos)',
          ExcelValueFormat.MONEY_CENTS,
          'Financeiro',
          'Campo calculado no export: soma totalCents das compras do expositor na feira.',
        ),
        field(
          'financial.paidCents',
          'Pago (centavos)',
          ExcelValueFormat.MONEY_CENTS,
          'Financeiro',
          'Campo calculado no export: soma paidCents/parcelas pagas.',
        ),
        field(
          'financial.pendingCents',
          'Pendente (centavos)',
          ExcelValueFormat.MONEY_CENTS,
          'Financeiro',
          'Campo calculado no export: total - pago.',
        ),
        field(
          'financial.status',
          'Status financeiro (resumo)',
          ExcelValueFormat.TEXT,
          'Financeiro',
          'Campo calculado no export (ex.: PAID/PENDING/PARTIALLY_PAID/OVERDUE).',
        ),
      ],
    },

    // =========================
    // MULTI — FAIR STALLS
    // =========================
    {
      dataset: ExcelDataset.FAIR_STALLS_LIST,
      label: 'Lista: Barracas da feira',
      scope: [
        {
          key: 'fairId',
          label: 'Feira',
          type: 'UUID',
          required: true,
          hint: 'Obrigatório: lista por feira.',
        },
        {
          key: 'ownerId',
          label: 'Expositor (opcional)',
          type: 'CUID',
          required: false,
          hint: 'Filtra por expositor.',
        },
      ],
      fields: [
        field('stall.id', 'ID da barraca', ExcelValueFormat.TEXT, 'Barraca'),
        field('stall.pdvName', 'Nome (PDV)', ExcelValueFormat.TEXT, 'Barraca'),
        field(
          'stall.bannerName',
          'Nome do banner',
          ExcelValueFormat.TEXT,
          'Barraca',
        ),
        field(
          'stall.mainCategory',
          'Categoria principal',
          ExcelValueFormat.TEXT,
          'Barraca',
        ),
        field('stall.stallType', 'Tipo', ExcelValueFormat.TEXT, 'Barraca'),
        field('stall.stallSize', 'Tamanho', ExcelValueFormat.TEXT, 'Barraca'),
        field(
          'stall.machinesQty',
          'Qtd. maquinhas',
          ExcelValueFormat.INT,
          'Operação',
        ),
        field('stall.teamQty', 'Qtd. equipe', ExcelValueFormat.INT, 'Operação'),

        field(
          'powerNeed.needsGas',
          'Precisa de gás',
          ExcelValueFormat.BOOL,
          'Infra',
        ),

        field(
          'owner.fullName',
          'Expositor',
          ExcelValueFormat.TEXT,
          'Expositor',
        ),
        field(
          'owner.document',
          'Documento do expositor',
          ExcelValueFormat.TEXT,
          'Expositor',
        ),

        field(
          'purchase.totalCents',
          'Valor da compra (centavos)',
          ExcelValueFormat.MONEY_CENTS,
          'Financeiro',
        ),
        field(
          'purchase.paidCents',
          'Pago (centavos)',
          ExcelValueFormat.MONEY_CENTS,
          'Financeiro',
        ),
        field(
          'purchase.status',
          'Status da compra',
          ExcelValueFormat.TEXT,
          'Financeiro',
        ),
      ],
    },

    // =========================
    // MULTI — FAIR PURCHASES
    // =========================
    {
      dataset: ExcelDataset.FAIR_PURCHASES_LIST,
      label: 'Lista: Compras da feira',
      scope: [
        {
          key: 'fairId',
          label: 'Feira',
          type: 'UUID',
          required: true,
          hint: 'Obrigatório: lista de compras por feira.',
        },
        {
          key: 'ownerId',
          label: 'Expositor (opcional)',
          type: 'CUID',
          required: false,
          hint: 'Filtra para 1 expositor.',
        },
      ],
      fields: [
        field('purchase.id', 'ID da compra', ExcelValueFormat.TEXT, 'Compra'),
        field('purchase.stallSize', 'Tamanho', ExcelValueFormat.TEXT, 'Compra'),
        field('purchase.qty', 'Quantidade', ExcelValueFormat.INT, 'Compra'),
        field(
          'purchase.unitPriceCents',
          'Unitário (centavos)',
          ExcelValueFormat.MONEY_CENTS,
          'Compra',
        ),
        field(
          'purchase.totalCents',
          'Total (centavos)',
          ExcelValueFormat.MONEY_CENTS,
          'Compra',
        ),
        field(
          'purchase.paidCents',
          'Pago (centavos)',
          ExcelValueFormat.MONEY_CENTS,
          'Pagamento',
        ),
        field('purchase.status', 'Status', ExcelValueFormat.TEXT, 'Pagamento'),
        field(
          'purchase.paidAt',
          'Pago em',
          ExcelValueFormat.DATETIME,
          'Pagamento',
        ),

        field(
          'owner.id',
          'ID do expositor',
          ExcelValueFormat.TEXT,
          'Expositor',
        ),
        field(
          'owner.fullName',
          'Expositor',
          ExcelValueFormat.TEXT,
          'Expositor',
        ),
        field(
          'owner.document',
          'Documento',
          ExcelValueFormat.TEXT,
          'Expositor',
        ),

        field('ownerFair.id', 'ID OwnerFair', ExcelValueFormat.TEXT, 'Feira'),
        field(
          'ownerFair.status',
          'Status operacional',
          ExcelValueFormat.TEXT,
          'Feira',
        ),
      ],
    },

    // =========================
    // MULTI — OWNER FAIRS
    // =========================
    {
      dataset: ExcelDataset.OWNER_FAIRS_LIST,
      label: 'Lista: Feiras do expositor',
      scope: [
        {
          key: 'ownerId',
          label: 'Expositor',
          type: 'CUID',
          required: true,
          hint: 'Obrigatório: lista de feiras do expositor.',
        },
      ],
      fields: [
        field('fair.id', 'ID da feira', ExcelValueFormat.TEXT, 'Feira'),
        field('fair.name', 'Nome da feira', ExcelValueFormat.TEXT, 'Feira'),
        field('fair.status', 'Status da feira', ExcelValueFormat.TEXT, 'Feira'),

        field(
          'ownerFair.status',
          'Status operacional',
          ExcelValueFormat.TEXT,
          'Expositor',
        ),
        field(
          'ownerFair.stallsQty',
          'Barracas reservadas',
          ExcelValueFormat.INT,
          'Expositor',
        ),
        field(
          'ownerFair.contractSignedAt',
          'Contrato assinado em',
          ExcelValueFormat.DATETIME,
          'Contrato',
        ),
      ],
    },

    // =========================
    // MULTI — OWNER STALLS
    // =========================
    {
      dataset: ExcelDataset.OWNER_STALLS_LIST,
      label: 'Lista: Barracas do expositor',
      scope: [
        {
          key: 'ownerId',
          label: 'Expositor',
          type: 'CUID',
          required: true,
          hint: 'Obrigatório: lista de barracas do expositor.',
        },
      ],
      fields: [
        field('stall.id', 'ID da barraca', ExcelValueFormat.TEXT, 'Barraca'),
        field('stall.pdvName', 'Nome (PDV)', ExcelValueFormat.TEXT, 'Barraca'),
        field(
          'stall.bannerName',
          'Nome do banner',
          ExcelValueFormat.TEXT,
          'Barraca',
        ),
        field(
          'stall.mainCategory',
          'Categoria principal',
          ExcelValueFormat.TEXT,
          'Barraca',
        ),
        field('stall.stallType', 'Tipo', ExcelValueFormat.TEXT, 'Barraca'),
        field('stall.stallSize', 'Tamanho', ExcelValueFormat.TEXT, 'Barraca'),
        field(
          'stall.machinesQty',
          'Qtd. maquinhas',
          ExcelValueFormat.INT,
          'Operação',
        ),
        field('stall.teamQty', 'Qtd. equipe', ExcelValueFormat.INT, 'Operação'),
        field(
          'powerNeed.needsGas',
          'Precisa de gás',
          ExcelValueFormat.BOOL,
          'Infra',
        ),
      ],
    },

    // =========================
    // MULTI — STALL FAIRS
    // =========================
    {
      dataset: ExcelDataset.STALL_FAIRS_LIST,
      label: 'Lista: Vínculos da barraca com feiras (StallFair)',
      scope: [
        {
          key: 'stallId',
          label: 'Barraca',
          type: 'CUID',
          required: true,
          hint: 'Obrigatório: lista de feiras onde a barraca está vinculada.',
        },
      ],
      fields: [
        field(
          'stallFair.id',
          'ID do vínculo',
          ExcelValueFormat.TEXT,
          'Vínculo',
        ),
        field(
          'stallFair.createdAt',
          'Vinculado em',
          ExcelValueFormat.DATETIME,
          'Vínculo',
        ),

        field('fair.id', 'ID da feira', ExcelValueFormat.TEXT, 'Feira'),
        field('fair.name', 'Nome da feira', ExcelValueFormat.TEXT, 'Feira'),
        field('fair.status', 'Status da feira', ExcelValueFormat.TEXT, 'Feira'),

        field('purchase.id', 'ID da compra', ExcelValueFormat.TEXT, 'Compra'),
        field(
          'purchase.stallSize',
          'Tamanho comprado',
          ExcelValueFormat.TEXT,
          'Compra',
        ),
        field(
          'purchase.totalCents',
          'Total (centavos)',
          ExcelValueFormat.MONEY_CENTS,
          'Compra',
        ),
        field(
          'purchase.paidCents',
          'Pago (centavos)',
          ExcelValueFormat.MONEY_CENTS,
          'Compra',
        ),
        field(
          'purchase.status',
          'Status financeiro',
          ExcelValueFormat.TEXT,
          'Compra',
        ),
      ],
    },
  ];
}
