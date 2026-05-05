import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { google } from 'googleapis';
import { detectPixKeyType } from 'src/common/utils/detect-pix-key-type';
import { AuditAction, AuditEntity, FairSupplierStatus, PixKeyType } from '@prisma/client';

function parseCurrencyToCents(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Math.round(value * 100);
  
  // Manter dígitos, sinal negativo e vírgula
  let str = String(value).replace(/[^0-9,-]/g, '');
  // Trocar vírgula por ponto para o parseFloat
  str = str.replace(',', '.');
  
  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}


@Injectable()
export class FairSuppliersImportService {
  private readonly logger = new Logger(FairSuppliersImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getConfig(fairId: string) {
    const config = await this.prisma.fairSupplierImportConfig.findUnique({
      where: { fairId },
    });
    return config;
  }

  async updateConfig(fairId: string, dto: { spreadsheetId: string; sheetName: string; headerRow?: number; dataStartRow?: number }) {
    return this.prisma.fairSupplierImportConfig.upsert({
      where: { fairId },
      update: {
        spreadsheetId: dto.spreadsheetId,
        sheetName: dto.sheetName,
        headerRow: dto.headerRow ?? 2,
        dataStartRow: dto.dataStartRow ?? 3,
      },
      create: {
        fairId,
        spreadsheetId: dto.spreadsheetId,
        sheetName: dto.sheetName,
        headerRow: dto.headerRow ?? 2,
        dataStartRow: dto.dataStartRow ?? 3,
      },
    });
  }

  private buildSheetRange(sheetName: string, startRow: number, endColumn = 'I') {
    const safeSheetName = sheetName.trim().replace(/'/g, "''");
    return `'${safeSheetName}'!A${startRow}:${endColumn}`;
  }

  private async getGoogleSheetsClient() {
    let base64 = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_BASE64');
    
    if (!base64) {
      throw new BadRequestException('Nenhuma credencial do Google configurada no servidor (GOOGLE_SERVICE_ACCOUNT_BASE64). Verifique as variáveis de ambiente.');
    }
    base64 = base64.trim();

    let credentialsStr = '';
    try {
      credentialsStr = Buffer.from(base64, 'base64').toString('utf-8');
    } catch (err) {
      throw new BadRequestException('O conteúdo de GOOGLE_SERVICE_ACCOUNT_BASE64 não é um base64 válido.');
    }

    let credentials;
    try {
      credentials = JSON.parse(credentialsStr);
    } catch (err) {
      throw new BadRequestException('A credencial decodificada não é um JSON válido. Verifique o conteúdo do service account.');
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client as any });
    
    this.logger.log(`[GoogleSheets] client_email: ${credentials.client_email}`);
    this.logger.log(`[GoogleSheets] private_key presente: ${Boolean(credentials.private_key)}`);

    return { sheets, clientEmail: credentials.client_email };
  }

  async getSpreadsheetMetadata(fairId: string) {
    let config = await this.getConfig(fairId);
    let spreadsheetId = config?.spreadsheetId;

    if (!config) {
      spreadsheetId = this.configService.get<string>('GOOGLE_SHEETS_SPREADSHEET_ID');
      if (!spreadsheetId) {
        throw new BadRequestException('Configuração de importação não encontrada para esta feira (banco) e sem fallback no .env.');
      }
    }

    spreadsheetId = spreadsheetId!.trim();

    let clientEmail = 'desconhecido';
    try {
      const clientResult = await this.getGoogleSheetsClient();
      clientEmail = clientResult.clientEmail;
      const { sheets } = clientResult;
      this.logger.log(`[GoogleSheets] client_email: ${clientEmail}`);
      this.logger.log(`[GoogleSheets] test-metadata spreadsheetId raw: ${JSON.stringify(spreadsheetId)}`);
      this.logger.log(`[GoogleSheets] spreadsheetId length: ${spreadsheetId.length}`);

      const response = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'spreadsheetId,properties.title,sheets.properties',
      });

      return {
        spreadsheetId: response.data.spreadsheetId,
        title: response.data.properties?.title,
        sheets: response.data.sheets?.map(s => ({
          sheetId: s.properties?.sheetId,
          title: s.properties?.title,
        })),
      };
    } catch (error: any) {
      if (error?.status === 404 || error?.message?.includes('Requested entity was not found')) {
        throw new BadRequestException(`Planilha não encontrada ou não compartilhada com a service account ${clientEmail}. Verifique spreadsheetId, permissões e se a Google Sheets API está ativa.`);
      }
      this.logger.error(`Erro ao buscar metadata da planilha: ${error.message}`, error.stack);
      throw new BadRequestException(`Erro ao ler metadados da planilha: ${error.message}`);
    }
  }

  private async fetchSheetData(rawSpreadsheetId: string, sheetName: string, headerRow: number) {
    try {
      const spreadsheetId = rawSpreadsheetId.trim();
      const { sheets, clientEmail } = await this.getGoogleSheetsClient();

      const range = this.buildSheetRange(sheetName, headerRow, 'I');
      
      this.logger.log(`[GoogleSheets] client_email: ${clientEmail}`);
      this.logger.log(`[GoogleSheets] fetch spreadsheetId raw: ${JSON.stringify(spreadsheetId)}`);
      this.logger.log(`[GoogleSheets] range: ${range}`);

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      return response.data.values || [];
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      if (error?.status === 400 || error?.status === 404 || error?.message?.includes('Requested entity was not found') || error?.message?.includes('Unable to parse range')) {
        throw new BadRequestException(`Aba '${sheetName}' não encontrada na planilha ou range inválido.`);
      }

      this.logger.error(`Erro ao buscar dados da planilha: ${error.message}`, error.stack);
      throw new BadRequestException(`Erro ao ler a planilha: ${error.message}`);
    }
  }

  async testValues(fairId: string) {
    // 1. Testa metadata primeiro para garantir permissões e pegar clientEmail
    const metadata = await this.getSpreadsheetMetadata(fairId);

    let config = await this.getConfig(fairId);
    let source = config ? 'DATABASE' : 'ENV';
    
    let spreadsheetId = config?.spreadsheetId;
    let sheetName = config?.sheetName ?? 'Página1';
    let headerRow = (config as any)?.headerRow ?? 2;
    // let dataStartRow = (config as any)?.dataStartRow ?? 3;

    if (!config) {
      spreadsheetId = this.configService.get<string>('GOOGLE_SHEETS_SPREADSHEET_ID');
      if (!spreadsheetId) {
        throw new BadRequestException('Configuração de importação não encontrada para esta feira (banco) e sem fallback no .env.');
      }
    }

    this.logger.log(`[GoogleSheets] spreadsheetId source: ${source}`);

    // Primeiro teste
    const testRange1 = this.buildSheetRange(sheetName, 1, 'I');
    try {
      const { sheets } = await this.getGoogleSheetsClient();
      await sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId!, range: testRange1 });
      this.logger.log(`[GoogleSheets] testValues range 1 OK: ${testRange1}`);
    } catch (err: any) {
      throw new BadRequestException(`Erro ao ler aba '${sheetName}' (range ${testRange1}): ${err.message}`);
    }

    // Segundo teste
    const testRange2 = this.buildSheetRange(sheetName, headerRow, 'I');
    try {
      const { sheets } = await this.getGoogleSheetsClient();
      await sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId!, range: testRange2 });
      this.logger.log(`[GoogleSheets] testValues range 2 OK: ${testRange2}`);
    } catch (err: any) {
      throw new BadRequestException(`Erro ao ler aba '${sheetName}' (range ${testRange2}): ${err.message}`);
    }

    return {
      success: true,
      spreadsheetId,
      sheetName,
      message: 'Leitura de valores (values.get) validada com sucesso em ambas as faixas.',
    };
  }

  async preview(fairId: string) {
    // 1. Diagnóstico e validação primária
    await this.getSpreadsheetMetadata(fairId);
    await this.testValues(fairId);

    let config = await this.getConfig(fairId);
    let source = config ? 'DATABASE' : 'ENV';
    
    let spreadsheetId = config?.spreadsheetId;
    let sheetName = config?.sheetName ?? 'Página1';
    let headerRow = (config as any)?.headerRow ?? 2;
    let dataStartRow = (config as any)?.dataStartRow ?? 3;

    if (!config) {
      spreadsheetId = this.configService.get<string>('GOOGLE_SHEETS_SPREADSHEET_ID');
      if (!spreadsheetId) {
        throw new BadRequestException('Configuração de importação não encontrada para esta feira (banco) e sem fallback no .env.');
      }
    }

    this.logger.log(`[GoogleSheets] spreadsheetId source: ${source}`);

    // 2. Leitura dos dados se os metadados (permissão/ID) foram OK
    const rows = await this.fetchSheetData(spreadsheetId!, sheetName, headerRow);
    if (rows.length < 1) {
      throw new BadRequestException('Planilha vazia ou sem dados.');
    }

    const headerRowIndex = 0; // Porque o range já começa do headerRow
    const dataStartRowIndex = dataStartRow - headerRow;

    if (rows.length <= headerRowIndex) {
      throw new BadRequestException(`A linha de cabeçalho configurada (${(config as any)?.headerRow}) não existe na planilha.`);
    }

    const headers = rows[headerRowIndex].map(h => String(h).trim().toLowerCase());
    
    const colMap = {
      fornecedor: headers.indexOf('fornecedor'),
      nomeTitularConta: headers.indexOf('nometitularconta'),
      documentoTitularConta: headers.indexOf('documentotitularconta'),
      chavePix: headers.indexOf('chavepix'),
      pagamentoPreEvento: headers.indexOf('pagamentopreevento'),
      pagamentoPosEvento: headers.indexOf('pagamentoposevento'),
      valorTotal: headers.indexOf('valortotal'),
      status: headers.indexOf('status'),
      observacoes: headers.indexOf('observacoes'),
    };

    if (colMap.fornecedor === -1 || colMap.chavePix === -1) {
      throw new BadRequestException('Colunas obrigatórias não encontradas na planilha (fornecedor, chavePix). Verifique se a configuração de headerRow está correta.');
    }

    const currentSuppliers = await this.prisma.fairSupplier.findMany({
      where: { fairId },
      include: { installments: true },
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

    // Percorrer a partir da linha configurada para os dados
    for (let i = dataStartRowIndex; i < rows.length; i++) {
      const row = rows[i];
      // Ignorar linha vazia
      if (!row || row.length === 0 || (!row[colMap.fornecedor] && !row[colMap.documentoTitularConta])) continue;

      result.summary.totalRows++;
      
      const supplierName = String(row[colMap.fornecedor] || '').trim();
      const holderName = String(row[colMap.nomeTitularConta] || '').trim();
      const holderDocStr = String(row[colMap.documentoTitularConta] || '').trim();
      const pixKeyStr = String(row[colMap.chavePix] || '').trim();
      const preEventoStr = row[colMap.pagamentoPreEvento];
      const posEventoStr = row[colMap.pagamentoPosEvento];
      const valorTotalStr = row[colMap.valorTotal];
      const statusStr = String(row[colMap.status] || '').trim().toUpperCase();
      const observacoes = String(row[colMap.observacoes] || '').trim();

      const errors: string[] = [];
      const warnings: string[] = [];

      // Validacoes obrigatorias para PIX
      if (!holderName) errors.push('Nome do titular obrigatório.');
      if (!holderDocStr) errors.push('Documento do titular obrigatório.');
      if (!pixKeyStr) errors.push('Chave PIX obrigatória.');
      if (!statusStr) errors.push('Status obrigatório.');
      if (statusStr !== 'PAGO' && statusStr !== 'NÃO PAGO' && statusStr !== 'NAO PAGO') {
        errors.push('Status deve ser PAGO ou NÃO PAGO.');
      }

      const holderDocNormalized = holderDocStr.replace(/[^\d]+/g, '');
      const pixDetection = detectPixKeyType(pixKeyStr, holderDocNormalized);

      if (!pixDetection.type) {
        errors.push(`Não foi possível identificar o tipo da chave PIX: ${pixDetection.reason}`);
      }

      if (pixDetection.confidence === 'LOW') {
        warnings.push(`Confiança baixa no tipo da chave PIX: ${pixDetection.reason}`);
      }

      const preEventoCents = parseCurrencyToCents(preEventoStr);
      const posEventoCents = parseCurrencyToCents(posEventoStr);
      const valorTotalCents = parseCurrencyToCents(valorTotalStr);

      if (valorTotalStr && (preEventoCents === 0 && posEventoCents === 0)) {
        errors.push('Se o valor total está preenchido, deve haver pelo menos uma parcela (pré ou pós evento).');
      }

      if (preEventoCents + posEventoCents !== valorTotalCents && valorTotalCents > 0) {
         errors.push('A soma das parcelas é diferente do valor total.');
      }
      
      const calculatedTotal = preEventoCents + posEventoCents;

      // Parcelas
      const installments: any[] = [];
      let numberCount = 1;
      if (preEventoCents > 0) {
        installments.push({
          number: numberCount++,
          amountCents: preEventoCents,
          description: 'Pré-evento',
          paymentMoment: 'PRE_EVENT',
        });
      }
      if (posEventoCents > 0) {
        installments.push({
          number: numberCount++,
          amountCents: posEventoCents,
          description: 'Pós-evento',
          paymentMoment: 'POST_EVENT',
        });
      }

      // Procurar existente: preferir holderDocNormalized.
      let existing: any = null;
      if (holderDocNormalized) {
        existing = currentSuppliers.find(s => s.document.replace(/[^\d]+/g, '') === holderDocNormalized);
      }
      if (!existing && supplierName) {
         // fallback: pelo nome interno do fornecedor se nao achou por doc
         existing = currentSuppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
      }

      let action: 'CREATE' | 'UPDATE' = existing ? 'UPDATE' : 'CREATE';
      let isValid = errors.length === 0;

      const normalizedImportedStatus = statusStr === 'PAGO' ? 'PAGO' : 'NAO_PAGO';
      const supplierStatus = normalizedImportedStatus === 'PAGO' ? 'PAID' : 'PENDING';

      result.rows.push({
        rowNumber: i + 1,
        action,
        status: isValid ? (warnings.length > 0 ? 'WARNING' : 'VALID') : 'INVALID',
        supplier: {
          id: existing?.id,
          name: supplierName || holderName,
          holderName,
          holderDocument: holderDocNormalized,
          pixKey: pixDetection.normalizedKey || pixKeyStr,
          pixKeyType: pixDetection.type,
          pixKeyConfidence: pixDetection.confidence,
          serviceDescription: 'Fornecedor/prestador da feira importado via planilha.',
          totalAmountCents: calculatedTotal > 0 ? calculatedTotal : valorTotalCents,
          preEventAmountCents: preEventoCents,
          postEventAmountCents: posEventoCents,
          installments,
          importedStatus: normalizedImportedStatus,
          supplierStatus: supplierStatus,
          notes: observacoes,
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
    
    if (previewResult.summary.validCount === 0) {
      throw new BadRequestException('Não há linhas válidas para importar.');
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const row of previewResult.rows) {
      if (row.status !== 'VALID') continue;

      const s = row.supplier;
      const isPaid = s.status === 'PAGO';
      const supplierStatus: FairSupplierStatus = isPaid ? 'PAID' : 'PENDING';
      const paidAmount = isPaid ? s.totalAmountCents : 0;
      const pendingAmount = isPaid ? 0 : s.totalAmountCents;

      if (row.action === 'CREATE') {
        const createdSupplier = await this.prisma.fairSupplier.create({
          data: {
            fairId,
            name: s.name,
            document: s.holderDocument,
            holderName: s.holderName,
            holderDocument: s.holderDocument,
            pixKey: s.pixKey,
            pixKeyType: s.pixKeyType as PixKeyType,
            description: s.serviceDescription,
            totalAmountCents: s.totalAmountCents,
            paidAmountCents: paidAmount,
            pendingAmountCents: pendingAmount,
            status: supplierStatus,
            createdByUserId: actorUserId,
            installments: {
              create: s.installments.map((inst: any) => ({
                number: inst.number,
                description: inst.description,
                amountCents: inst.amountCents,
                status: isPaid ? 'PAID' : 'PENDING',
                paidAmountCents: isPaid ? inst.amountCents : 0,
                paidAt: isPaid ? new Date() : null,
              })),
            },
          },
        });
        
        await this.prisma.auditLog.create({
          data: {
            action: AuditAction.CREATE,
            entity: AuditEntity.FAIR_SUPPLIER,
            entityId: createdSupplier.id,
            actorUserId,
            meta: { source: 'SPREADSHEET_IMPORT' },
          }
        });

        createdCount++;
      } else if (row.action === 'UPDATE' && s.id) {
        // Regra: Atualizar fornecedor existente.
        // Não sobrescrever parcela já paga, a menos que a regra esteja explícita (aqui vamos atualizar dados basicos).
        
        // Pega como está no banco para ver o que fazer com as parcelas
        const existingSupplier = await this.prisma.fairSupplier.findUnique({
           where: { id: s.id },
           include: { installments: true }
        });
        if (!existingSupplier) continue;

        await this.prisma.fairSupplier.update({
          where: { id: s.id },
          data: {
            name: s.name,
            document: s.holderDocument,
            holderName: s.holderName,
            holderDocument: s.holderDocument,
            pixKey: s.pixKey,
            pixKeyType: s.pixKeyType as PixKeyType,
            // Re-calcula total se necessário, mas mantemos o que veio da planilha como fonte de verdade para o total
            totalAmountCents: s.totalAmountCents,
            status: isPaid ? 'PAID' : existingSupplier.status, // Se ja tava pago na planilha, fica PAGO. Sendo PENDING na planilha, não volta se já foi pago, mas vamos ser simples: planilha manda.
          }
        });

        // Atualizar parcelas
        for (const inst of s.installments) {
           const existingInst = existingSupplier.installments.find(x => x.number === inst.number);
           if (existingInst) {
             // Se já está paga, não mexer a menos que seja para corrigir, mas a regra diz "Não sobrescrever parcela já paga"
             if (existingInst.status !== 'PAID') {
               await this.prisma.fairSupplierInstallment.update({
                  where: { id: existingInst.id },
                  data: {
                    amountCents: inst.amountCents,
                    description: inst.description,
                    status: isPaid ? 'PAID' : 'PENDING',
                    paidAmountCents: isPaid ? inst.amountCents : 0,
                    paidAt: isPaid ? new Date() : null,
                  }
               });
             }
           } else {
             // criar parcela nova se vier na planilha
             await this.prisma.fairSupplierInstallment.create({
                data: {
                  supplierId: s.id,
                  number: inst.number,
                  description: inst.description,
                  amountCents: inst.amountCents,
                  status: isPaid ? 'PAID' : 'PENDING',
                  paidAmountCents: isPaid ? inst.amountCents : 0,
                  paidAt: isPaid ? new Date() : null,
                }
             });
           }
        }
        
        await this.prisma.auditLog.create({
          data: {
            action: AuditAction.UPDATE,
            entity: AuditEntity.FAIR_SUPPLIER,
            entityId: s.id,
            actorUserId,
            meta: { source: 'SPREADSHEET_IMPORT' },
          }
        });

        updatedCount++;
      }
    }

    // Recalcular saldos gerais
    // Isso é bom para manter a coerência caso alguma parcela tenha ficado de fora da atualizacao
    const config = await this.getConfig(fairId);

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE, // Ou CREATE se preferir um evento mestre
        entity: AuditEntity.FAIR, // Ou uma entidade customizada
        entityId: fairId,
        actorUserId,
        meta: { 
          source: 'SPREADSHEET_IMPORT_FINISHED',
          fairId,
          spreadsheetId: config?.spreadsheetId,
          sheetName: config?.sheetName,
          totalRows: previewResult.summary.totalRows,
          createdCount,
          updatedCount,
          errorCount: previewResult.summary.errorCount
        },
      }
    });

    return {
      message: 'Importação concluída com sucesso.',
      createdCount,
      updatedCount,
    };
  }
}
