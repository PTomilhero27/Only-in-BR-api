import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  AuditEntity,
  ExhibitorPayoutSource,
  ExhibitorPayoutStatus,
  PixKeyType,
} from '@prisma/client';
import { google } from 'googleapis';
import { AuditService } from 'src/common/audit/audit.service';
import { detectPixKeyType } from 'src/common/utils/detect-pix-key-type';
import { PrismaService } from 'src/prisma/prisma.service';

const DEFAULT_EXHIBITOR_PAYOUT_IMPORT_CONFIG = {
  spreadsheetId: '1YGInOf0tRZzh5GYunmbP_eud67-prd2FuYM3VBnJ6hk',
  sheetName: 'Remessa Pix',
  headerRow: 3,
  dataStartRow: 4,
};

function parseCurrencyToCents(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Math.round(value * 100);

  const raw = String(value).trim();
  if (!raw) return 0;

  const normalized = raw
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function normalizeDocument(value: unknown): string {
  return String(value ?? '').replace(/[^\d]+/g, '');
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_\-]+/g, '')
    .toLowerCase();
}

@Injectable()
export class ExhibitorPayoutsImportService {
  private readonly logger = new Logger(ExhibitorPayoutsImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async getConfig(fairId: string) {
    await this.requireFair(fairId);

    const config = await (this.prisma as any).exhibitorPayoutImportConfig.findUnique(
      { where: { fairId } },
    );

    return config ?? { fairId, ...DEFAULT_EXHIBITOR_PAYOUT_IMPORT_CONFIG };
  }

  async updateConfig(
    fairId: string,
    dto: {
      spreadsheetId: string;
      sheetName: string;
      headerRow?: number;
      dataStartRow?: number;
    },
  ) {
    await this.requireFair(fairId);

    return (this.prisma as any).exhibitorPayoutImportConfig.upsert({
      where: { fairId },
      update: {
        spreadsheetId: dto.spreadsheetId.trim(),
        sheetName: dto.sheetName.trim(),
        headerRow: dto.headerRow ?? DEFAULT_EXHIBITOR_PAYOUT_IMPORT_CONFIG.headerRow,
        dataStartRow:
          dto.dataStartRow ?? DEFAULT_EXHIBITOR_PAYOUT_IMPORT_CONFIG.dataStartRow,
      },
      create: {
        fairId,
        spreadsheetId: dto.spreadsheetId.trim(),
        sheetName: dto.sheetName.trim(),
        headerRow: dto.headerRow ?? DEFAULT_EXHIBITOR_PAYOUT_IMPORT_CONFIG.headerRow,
        dataStartRow:
          dto.dataStartRow ?? DEFAULT_EXHIBITOR_PAYOUT_IMPORT_CONFIG.dataStartRow,
      },
    });
  }

  async preview(fairId: string) {
    const config = await this.getConfig(fairId);
    const rows = await this.fetchSheetData(
      config.spreadsheetId,
      config.sheetName,
      config.headerRow,
    );

    if (rows.length < 1) {
      throw new BadRequestException('Planilha vazia ou sem dados.');
    }

    const dataStartRowIndex = config.dataStartRow - config.headerRow;
    if (dataStartRowIndex < 1) {
      throw new BadRequestException(
        'dataStartRow deve ser maior que headerRow.',
      );
    }

    const headers = rows[0].map(normalizeHeader);
    const colMap = {
      nomeTitularConta: headers.indexOf('nometitularconta'),
      documentoTitularConta: headers.indexOf('documentotitularconta'),
      chavePix: headers.indexOf('chavepix'),
      valorTotal: headers.indexOf('valortotal'),
    };

    const missingColumns = Object.entries(colMap)
      .filter(([, index]) => index === -1)
      .map(([name]) => name);

    if (missingColumns.length > 0) {
      throw new BadRequestException(
        `Colunas obrigatorias nao encontradas na planilha: ${missingColumns.join(', ')}.`,
      );
    }

    const ownerFairs = await this.prisma.ownerFair.findMany({
      where: { fairId },
      include: { owner: true, exhibitorPayout: true },
    });

    const result = {
      summary: {
        totalRows: 0,
        validCount: 0,
        newCount: 0,
        updateCount: 0,
        errorCount: 0,
        warningCount: 0,
      },
      rows: [] as any[],
    };

    for (let i = dataStartRowIndex; i < rows.length; i++) {
      const row = rows[i];
      if (
        !row ||
        row.length === 0 ||
        (!row[colMap.nomeTitularConta] &&
          !row[colMap.documentoTitularConta] &&
          !row[colMap.chavePix] &&
          !row[colMap.valorTotal])
      ) {
        continue;
      }

      result.summary.totalRows++;

      const holderName = String(row[colMap.nomeTitularConta] ?? '').trim();
      const holderDocument = normalizeDocument(row[colMap.documentoTitularConta]);
      const pixKeyInput = String(row[colMap.chavePix] ?? '').trim();
      const grossAmountCents = parseCurrencyToCents(row[colMap.valorTotal]);
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!holderName) errors.push('Nome do titular obrigatorio.');
      if (!holderDocument) errors.push('Documento do titular obrigatorio.');
      if (!pixKeyInput) errors.push('Chave PIX obrigatoria.');
      if (grossAmountCents <= 0) {
        errors.push('valorTotal deve ser maior que zero.');
      }

      const pixDetection = detectPixKeyType(pixKeyInput, holderDocument);
      if (!pixDetection.type) {
        errors.push(
          `Nao foi possivel identificar o tipo da chave PIX: ${pixDetection.reason}`,
        );
      }
      if (pixDetection.confidence === 'LOW') {
        warnings.push(
          `Confianca baixa no tipo da chave PIX: ${pixDetection.reason}`,
        );
      }

      const ownerFair = this.findOwnerFair(ownerFairs, holderDocument, holderName);
      if (!ownerFair) {
        errors.push(
          'Expositor/OwnerFair existente nao encontrado nesta feira. A importacao nao cria expositor novo.',
        );
      }

      const existingPayout = ownerFair?.exhibitorPayout;
      if (
        existingPayout?.status === ExhibitorPayoutStatus.PAID ||
        existingPayout?.status === ExhibitorPayoutStatus.INCLUDED_IN_REMITTANCE
      ) {
        errors.push(
          'Repasse existente ja foi pago ou incluido em remessa e nao pode ser atualizado pela importacao.',
        );
      }

      const action = existingPayout ? 'UPDATE' : 'CREATE';
      const isValid = errors.length === 0;

      result.rows.push({
        rowNumber: config.headerRow + i,
        action,
        status: isValid ? (warnings.length > 0 ? 'WARNING' : 'VALID') : 'INVALID',
        payout: {
          payoutId: existingPayout?.id,
          ownerFairId: ownerFair?.id ?? null,
          ownerId: ownerFair?.ownerId ?? null,
          name: ownerFair?.owner.fullName ?? holderName,
          holderName,
          holderDocument,
          pixKey: pixDetection.normalizedKey || pixKeyInput,
          pixKeyType: pixDetection.type,
          pixKeyConfidence: pixDetection.confidence,
          grossAmountCents,
          netAmountCents: grossAmountCents,
        },
        errors,
        warnings,
      });

      if (isValid) {
        result.summary.validCount++;
        if (action === 'CREATE') result.summary.newCount++;
        else result.summary.updateCount++;
        if (warnings.length > 0) result.summary.warningCount++;
      } else {
        result.summary.errorCount++;
      }
    }

    return result;
  }

  async confirm(fairId: string, actorUserId: string) {
    const previewResult = await this.preview(fairId);
    const validRows = previewResult.rows.filter((row) => row.status === 'VALID');

    if (validRows.length === 0) {
      throw new BadRequestException('Nao ha linhas validas para importar.');
    }

    let createdCount = 0;
    let updatedCount = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const row of validRows) {
        const payoutData = row.payout;

        await tx.owner.update({
          where: { id: payoutData.ownerId },
          data: {
            bankHolderName: payoutData.holderName,
            bankHolderDoc: payoutData.holderDocument,
            pixKey: payoutData.pixKey,
            pixKeyType: payoutData.pixKeyType as PixKeyType,
          },
        });

        if (row.action === 'CREATE') {
          const payout = await tx.exhibitorPayout.create({
            data: {
              ownerFairId: payoutData.ownerFairId,
              grossAmountCents: payoutData.grossAmountCents,
              discountAmountCents: 0,
              adjustmentAmountCents: 0,
              netAmountCents: payoutData.netAmountCents,
              source: ExhibitorPayoutSource.IMPORTED,
              status: ExhibitorPayoutStatus.PENDING,
              createdByUserId: actorUserId,
            },
          });

          await this.audit.log(tx, {
            action: AuditAction.CREATE,
            entity: AuditEntity.EXHIBITOR_PAYOUT,
            entityId: payout.id,
            actorUserId,
            after: payout,
            meta: { fairId, source: 'SPREADSHEET_IMPORT', rowNumber: row.rowNumber },
          });

          createdCount++;
          continue;
        }

        const before = await tx.exhibitorPayout.findUnique({
          where: { id: payoutData.payoutId },
        });

        const payout = await tx.exhibitorPayout.update({
          where: { id: payoutData.payoutId },
          data: {
            grossAmountCents: payoutData.grossAmountCents,
            discountAmountCents: 0,
            adjustmentAmountCents: 0,
            netAmountCents: payoutData.netAmountCents,
            source: ExhibitorPayoutSource.IMPORTED,
            status: ExhibitorPayoutStatus.PENDING,
          },
        });

        await this.audit.log(tx, {
          action: AuditAction.UPDATE,
          entity: AuditEntity.EXHIBITOR_PAYOUT,
          entityId: payout.id,
          actorUserId,
          before,
          after: payout,
          meta: { fairId, source: 'SPREADSHEET_IMPORT', rowNumber: row.rowNumber },
        });

        updatedCount++;
      }

      await this.audit.log(tx, {
        action: AuditAction.UPDATE,
        entity: AuditEntity.FAIR,
        entityId: fairId,
        actorUserId,
        meta: {
          source: 'SPREADSHEET_IMPORT_FINISHED',
          totalRows: previewResult.summary.totalRows,
          createdCount,
          updatedCount,
          errorCount: previewResult.summary.errorCount,
        },
      });
    });

    return {
      message: 'Importacao de repasses de expositores concluida com sucesso.',
      createdCount,
      updatedCount,
    };
  }

  private async requireFair(fairId: string) {
    const fair = await this.prisma.fair.findUnique({
      where: { id: fairId },
      select: { id: true },
    });
    if (!fair) throw new BadRequestException('Feira nao encontrada.');
  }

  private findOwnerFair(
    ownerFairs: any[],
    holderDocument: string,
    holderName: string,
  ) {
    const byDocument = holderDocument
      ? ownerFairs.find((ownerFair) => {
          const ownerDocument = normalizeDocument(ownerFair.owner.document);
          const bankHolderDoc = normalizeDocument(ownerFair.owner.bankHolderDoc);
          return (
            ownerDocument === holderDocument || bankHolderDoc === holderDocument
          );
        })
      : null;

    if (byDocument) return byDocument;

    const normalizedName = holderName.trim().toLowerCase();
    if (!normalizedName) return null;

    return ownerFairs.find((ownerFair) => {
      const fullName = String(ownerFair.owner.fullName ?? '').trim().toLowerCase();
      const bankHolderName = String(ownerFair.owner.bankHolderName ?? '')
        .trim()
        .toLowerCase();
      return fullName === normalizedName || bankHolderName === normalizedName;
    });
  }

  private buildSheetRange(sheetName: string, startRow: number) {
    const safeSheetName = sheetName.trim().replace(/'/g, "''");
    return `'${safeSheetName}'!A${startRow}:Z`;
  }

  private async getGoogleSheetsClient() {
    const base64 = this.configService
      .get<string>('GOOGLE_SERVICE_ACCOUNT_BASE64')
      ?.trim();

    if (!base64) {
      throw new BadRequestException(
        'Nenhuma credencial do Google configurada no servidor (GOOGLE_SERVICE_ACCOUNT_BASE64).',
      );
    }

    let credentials: any;
    try {
      credentials = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
    } catch {
      throw new BadRequestException(
        'GOOGLE_SERVICE_ACCOUNT_BASE64 nao e um base64/JSON valido.',
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client as any });

    return { sheets, clientEmail: credentials.client_email };
  }

  private async fetchSheetData(
    rawSpreadsheetId: string,
    sheetName: string,
    headerRow: number,
  ) {
    const spreadsheetId = rawSpreadsheetId.trim();
    const range = this.buildSheetRange(sheetName, headerRow);

    try {
      const { sheets, clientEmail } = await this.getGoogleSheetsClient();

      this.logger.log(`[GoogleSheets] client_email: ${clientEmail}`);
      this.logger.log(`[GoogleSheets] range: ${range}`);

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      return response.data.values ?? [];
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;

      if (
        error?.status === 400 ||
        error?.status === 404 ||
        error?.message?.includes('Requested entity was not found') ||
        error?.message?.includes('Unable to parse range')
      ) {
        throw new BadRequestException(
          `Planilha/aba nao encontrada ou nao compartilhada com a service account onlyinbr-sheets@onlyinbr-admin.iam.gserviceaccount.com. Range lido: ${range}.`,
        );
      }

      this.logger.error(`Erro ao ler planilha: ${error.message}`, error.stack);
      throw new BadRequestException(`Erro ao ler a planilha: ${error.message}`);
    }
  }
}
