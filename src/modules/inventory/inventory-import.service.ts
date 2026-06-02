import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { InventoryImportConfigDto } from './dto/inventory-import.dto';
import * as ExcelJS from 'exceljs';

function parseQuantity(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  // Limpa caracteres não numéricos mantendo o sinal de negativo
  const str = String(value).replace(/[^0-9-]/g, '');
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
}

function getCellValue(cell: any): any {
  if (cell === null || cell === undefined) return '';
  const val = cell.value;
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if ('richText' in val && Array.isArray(val.richText)) {
      return val.richText.map((t: any) => t.text || '').join('');
    }
    if ('result' in val) return val.result;
    if ('text' in val) return val.text;
  }
  return val;
}

@Injectable()
export class InventoryImportService {
  private readonly logger = new Logger(InventoryImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly inventoryService: InventoryService,
  ) {}

  async preview(dto: InventoryImportConfigDto) {
    const spreadsheetId = this.configService.get<string>('GOOGLE_SHEETS_INVENTORY_SPREADSHEET_ID');
    if (!spreadsheetId) {
      throw new BadRequestException('Configuração de planilha de estoque não encontrada (.env: GOOGLE_SHEETS_INVENTORY_SPREADSHEET_ID).');
    }

    let workbook: ExcelJS.Workbook;
    try {
      this.logger.log(`[InventoryImport] Baixando planilha pública: ${spreadsheetId}`);
      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Falha ao baixar planilha pública: ${response.status} ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(buffer) as any);
    } catch (error: any) {
      this.logger.error(`Erro ao carregar planilha do Google Sheets: ${error.message}`, error.stack);
      throw new BadRequestException(`Erro ao ler a planilha: ${error.message}. Certifique-se de que a planilha é pública e compartilhada para qualquer pessoa com o link.`);
    }

    let targetSheetName = (dto.sheetName || 'INVENTARIO MAIO').trim().toLowerCase();
    let worksheet = workbook.worksheets.find(s => s.name.trim().toLowerCase() === targetSheetName);
    
    if (!worksheet) {
      this.logger.warn(`Aba '${dto.sheetName || 'INVENTARIO MAIO'}' não encontrada. Utilizando fallback para a primeira aba: '${workbook.worksheets[0]?.name}'`);
      worksheet = workbook.worksheets[0];
    }

    if (!worksheet) {
      throw new BadRequestException('A planilha não possui abas válidas.');
    }

    const headerRow = dto.headerRow ?? 1;
    const dataStartRow = dto.dataStartRow ?? 2;

    const rows: any[][] = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const rowValues: any[] = [];
      const maxCol = worksheet.columnCount;
      for (let col = 1; col <= maxCol; col++) {
        const cell = row.getCell(col);
        rowValues.push(getCellValue(cell));
      }
      rows.push(rowValues);
    });

    if (rows.length < 1) {
      throw new BadRequestException('A aba selecionada está vazia.');
    }

    const headerRowIndex = headerRow - 1;
    const dataStartRowIndex = dataStartRow - 1;

    if (rows.length <= headerRowIndex) {
      throw new BadRequestException(`A linha de cabeçalho configurada (${headerRow}) não existe na planilha.`);
    }

    const headers = rows[headerRowIndex].map(h => String(h || '').trim().toLowerCase());
    
    const colMap = {
      produto: headers.indexOf('produto'),
      estoqueAtual: headers.indexOf('estoque atual'),
      estoqueUnd: headers.indexOf('estoque und'),
      observacoes: headers.indexOf('observações'),
      imagem: headers.indexOf('imagem do produto'),
    };

    if (colMap.produto === -1) {
      throw new BadRequestException('Coluna obrigatória "PRODUTO" não encontrada na linha de cabeçalho da planilha de estoque.');
    }

    const result = {
      summary: {
        totalRows: 0,
        validCount: 0,
        newCount: 0,
        updateCount: 0,
        errorCount: 0,
      },
      rows: [] as any[],
    };

    for (let i = dataStartRowIndex; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const productName = String(row[colMap.produto] || '').trim();
      // Se não houver nome do produto na linha, ignoramos (evita processar rodapés ou linhas vazias)
      if (!productName) continue;

      result.summary.totalRows++;
      
      const rawEstoqueAtual = colMap.estoqueAtual !== -1 ? row[colMap.estoqueAtual] : undefined;
      const rawEstoqueUnd = colMap.estoqueUnd !== -1 ? row[colMap.estoqueUnd] : undefined;
      const rawObservacoes = colMap.observacoes !== -1 ? row[colMap.observacoes] : '';
      const rawImagem = colMap.imagem !== -1 ? row[colMap.imagem] : '';

      const errors: string[] = [];
      const warnings: string[] = [];

      // Mapeia a quantidade. Se 'ESTOQUE ATUAL' estiver preenchido, prioriza ele. Caso contrário, tenta 'Estoque UND'.
      let quantity = 0;
      if (rawEstoqueAtual !== undefined && String(rawEstoqueAtual).trim() !== '') {
        quantity = parseQuantity(rawEstoqueAtual);
      } else if (rawEstoqueUnd !== undefined && String(rawEstoqueUnd).trim() !== '') {
        quantity = parseQuantity(rawEstoqueUnd);
      }

      if (quantity < 0) {
        errors.push('A quantidade de estoque não pode ser negativa.');
      }

      const notes = String(rawObservacoes || '').trim();
      const imageUrl = String(rawImagem || '').trim();

      const existingItem = await this.prisma.inventoryItem.findFirst({
        where: {
          name: {
            equals: productName,
            mode: 'insensitive',
          },
        },
      });

      const action = existingItem ? 'UPDATE' : 'CREATE';
      const isValid = errors.length === 0;

      result.rows.push({
        rowNumber: i + 1,
        action,
        status: isValid ? 'VALID' : 'INVALID',
        item: {
          id: existingItem?.id || null,
          name: productName,
          quantity,
          notes: notes || null,
          imageUrl: imageUrl || null,
          existingItem: existingItem
            ? {
                id: existingItem.id,
                name: existingItem.name,
                category: existingItem.category,
                unit: existingItem.unit,
                imageUrl: existingItem.imageUrl,
                location: existingItem.location,
                currentQty: existingItem.quantity,
                minQty: existingItem.minQuantity,
                status: existingItem.status,
                notes: existingItem.notes,
              }
            : null,
        },
        errors,
        warnings,
      });

      if (isValid) {
        result.summary.validCount++;
        if (action === 'CREATE') {
          result.summary.newCount++;
        } else {
          result.summary.updateCount++;
        }
      } else {
        result.summary.errorCount++;
      }
    }

    return result;
  }

  async confirm(dto: InventoryImportConfigDto, actorUserId: string) {
    const previewResult = await this.preview(dto);
    
    if (previewResult.summary.validCount === 0) {
      throw new BadRequestException('Não há itens válidos para importar.');
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const row of previewResult.rows) {
      if (row.status !== 'VALID') continue;

      const itemData = row.item;

      if (row.action === 'CREATE') {
        await this.inventoryService.create(
          {
            name: itemData.name,
            quantity: itemData.quantity,
            notes: itemData.notes || undefined,
            imageUrl: itemData.imageUrl || undefined,
            unit: 'UN',
          },
          actorUserId,
        );
        createdCount++;
      } else if (row.action === 'UPDATE' && itemData.id) {
        await this.inventoryService.update(
          itemData.id,
          {
            quantity: itemData.quantity,
            notes: itemData.notes || undefined,
            imageUrl: itemData.imageUrl || undefined,
          },
          actorUserId,
        );
        updatedCount++;
      }
    }

    return {
      message: 'Importação de estoque concluída com sucesso.',
      createdCount,
      updatedCount,
    };
  }
}
