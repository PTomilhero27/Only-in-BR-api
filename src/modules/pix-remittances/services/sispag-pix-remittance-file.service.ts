import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PixKeyType } from '@prisma/client';

export type SispagCompanyBankConfig = {
  document: string;
  agency: string;
  account: string;
  accountDigit: string;
  name: string;
};

export type SispagPixRemittanceInput = {
  remittanceId: string;
  paymentDate: Date;
  company: SispagCompanyBankConfig;
  items: Array<{
    amountCents: number;
    payeeName: string;
    payeeDocument: string;
    pixKeyType: PixKeyType;
    pixKey: string;
    txId?: string | null;
  }>;
};

type SispagPixItem = SispagPixRemittanceInput['items'][number];

/**
 * Este service isola a complexidade do arquivo Itau/CNAB para evitar espalhar regra bancaria pelo dominio financeiro.
 */
@Injectable()
export class SispagPixRemittanceFileService {
  private readonly bankCode = '341';
  private readonly batchCode = '0001';
  private readonly bankName = 'BANCO ITAU SA';

  generate(params: SispagPixRemittanceInput) {
    const lines: string[] = [];

    // Header de Arquivo
    lines.push(this.buildFileHeader(params));

    // Header de Lote
    lines.push(this.buildBatchHeader(params));

    let sequencial = 1;

    for (const item of params.items) {
      // Segmento A
      lines.push(this.buildSegmentA(params, item, sequencial));

      // Segmento B: obrigatorio para PIX Transferencia por chave.
      lines.push(this.buildSegmentB(params, item, sequencial));
      sequencial++;
    }

    // Trailer de Lote
    lines.push(this.buildBatchTrailer(params));

    // Trailer de Arquivo
    lines.push(this.buildFileTrailer(params));

    // Valida que cada linha tem exatamente 240 caracteres
    lines.forEach((line, index) => {
      if (line.length !== 240) {
        throw new InternalServerErrorException(
          `Erro ao gerar CNAB 240: A linha ${index + 1} possui ${line.length} caracteres.`,
        );
      }
    });

    return {
      fileContent: `${lines.join('\r\n')}\r\n`,
    };
  }

  private buildFileHeader(params: SispagPixRemittanceInput): string {
    const now = new Date();
    let line = this.blankLine();

    line = this.set(line, 1, 3, this.bankCode, '9');
    line = this.set(line, 4, 7, '0000', '9');
    line = this.set(line, 8, 8, '0', '9');
    line = this.set(line, 15, 17, '080', '9');
    line = this.set(
      line,
      18,
      18,
      this.registrationType(params.company.document),
      '9',
    );
    line = this.set(
      line,
      19,
      32,
      this.onlyDigits(params.company.document),
      '9',
    );
    line = this.set(line, 53, 57, this.onlyDigits(params.company.agency), '9');
    line = this.set(line, 59, 70, this.onlyDigits(params.company.account), '9');
    line = this.set(
      line,
      72,
      72,
      this.onlyDigits(params.company.accountDigit),
      '9',
    );
    line = this.set(line, 73, 102, params.company.name, 'X');
    line = this.set(line, 103, 132, this.bankName, 'X');
    line = this.set(line, 143, 143, '1', '9');
    line = this.set(line, 144, 151, this.formatDate(now), '9');
    line = this.set(line, 152, 157, this.formatTime(now), '9');
    line = this.set(line, 158, 166, '0', '9');
    line = this.set(line, 167, 171, '0', '9');

    return line;
  }

  private buildBatchHeader(params: SispagPixRemittanceInput): string {
    let line = this.blankLine();

    line = this.set(line, 1, 3, this.bankCode, '9');
    line = this.set(line, 4, 7, this.batchCode, '9');
    line = this.set(line, 8, 8, '1', '9');
    line = this.set(line, 9, 9, 'C', 'X');
    line = this.set(line, 10, 11, '20', '9');
    line = this.set(line, 12, 13, '45', '9');
    line = this.set(line, 14, 16, '040', '9');
    line = this.set(
      line,
      18,
      18,
      this.registrationType(params.company.document),
      '9',
    );
    line = this.set(
      line,
      19,
      32,
      this.onlyDigits(params.company.document),
      '9',
    );
    line = this.set(line, 53, 57, this.onlyDigits(params.company.agency), '9');
    line = this.set(line, 59, 70, this.onlyDigits(params.company.account), '9');
    line = this.set(
      line,
      72,
      72,
      this.onlyDigits(params.company.accountDigit),
      '9',
    );
    line = this.set(line, 73, 102, params.company.name, 'X');
    line = this.set(line, 173, 177, '0', '9');
    line = this.set(line, 213, 220, '0', '9');

    return line;
  }

  private buildSegmentA(
    params: SispagPixRemittanceInput,
    item: SispagPixItem,
    sequencial: number,
  ): string {
    let line = this.blankLine();

    line = this.set(line, 1, 3, this.bankCode, '9');
    line = this.set(line, 4, 7, this.batchCode, '9');
    line = this.set(line, 8, 8, '3', '9');
    line = this.set(line, 9, 13, String(sequencial), '9');
    line = this.set(line, 14, 14, 'A', 'X');
    line = this.set(line, 15, 17, '000', '9');
    line = this.set(line, 18, 20, '009', '9');
    line = this.set(line, 21, 23, '0', '9');
    line = this.set(line, 44, 73, item.payeeName, 'X');
    line = this.set(
      line,
      74,
      93,
      this.documentNumber(params.remittanceId, sequencial),
      'X',
    );
    line = this.set(line, 94, 101, this.formatDate(params.paymentDate), '9');
    line = this.set(line, 102, 104, 'REA', 'X');
    line = this.set(line, 113, 114, '04', 'X');
    line = this.set(line, 115, 119, '0', '9');
    line = this.set(line, 120, 134, String(item.amountCents), '9');
    line = this.set(line, 155, 162, '0', '9');
    line = this.set(line, 163, 177, '0', '9');
    line = this.set(line, 198, 203, '0', '9');
    line = this.set(line, 204, 217, this.onlyDigits(item.payeeDocument), '9');
    line = this.set(line, 230, 230, '0', 'X');

    return line;
  }

  private buildSegmentB(
    params: SispagPixRemittanceInput,
    item: SispagPixItem,
    sequencial: number,
  ): string {
    let line = this.blankLine();

    line = this.set(line, 1, 3, this.bankCode, '9');
    line = this.set(line, 4, 7, this.batchCode, '9');
    line = this.set(line, 8, 8, '3', '9');
    line = this.set(line, 9, 13, String(sequencial), '9');
    line = this.set(line, 14, 14, 'B', 'X');
    line = this.set(line, 15, 16, this.pixKeyTypeCode(item.pixKeyType), 'X');
    line = this.set(
      line,
      18,
      18,
      this.registrationType(item.payeeDocument),
      '9',
    );
    line = this.set(line, 19, 32, this.onlyDigits(item.payeeDocument), '9');
    line = this.set(line, 33, 62, item.txId ?? '', 'X');
    line = this.set(line, 63, 127, '0', '9');
    line = this.set(
      line,
      128,
      227,
      this.normalizePixKey(item.pixKeyType, item.pixKey),
      'X',
    );

    return line;
  }

  private buildBatchTrailer(params: SispagPixRemittanceInput): string {
    const totalRecords = params.items.length * 2 + 2;
    const totalAmountCents = params.items.reduce(
      (sum, item) => sum + item.amountCents,
      0,
    );
    let line = this.blankLine();

    line = this.set(line, 1, 3, this.bankCode, '9');
    line = this.set(line, 4, 7, this.batchCode, '9');
    line = this.set(line, 8, 8, '5', '9');
    line = this.set(line, 18, 23, String(totalRecords), '9');
    line = this.set(line, 24, 41, String(totalAmountCents), '9');
    line = this.set(line, 42, 59, '0', '9');

    return line;
  }

  private buildFileTrailer(params: SispagPixRemittanceInput): string {
    const totalRecords = params.items.length * 2 + 4;
    let line = this.blankLine();

    line = this.set(line, 1, 3, this.bankCode, '9');
    line = this.set(line, 4, 7, '9999', '9');
    line = this.set(line, 8, 8, '9', '9');
    line = this.set(line, 18, 23, '1', '9');
    line = this.set(line, 24, 29, String(totalRecords), '9');

    return line;
  }

  private blankLine() {
    return ''.padEnd(240, ' ');
  }

  private set(
    line: string,
    start: number,
    end: number,
    value: string,
    picture: '9' | 'X',
  ) {
    const size = end - start + 1;
    const formatted =
      picture === '9'
        ? this.onlyDigits(value).slice(-size).padStart(size, '0')
        : this.normalizeText(value).slice(0, size).padEnd(size, ' ');

    return line.slice(0, start - 1) + formatted + line.slice(end);
  }

  private onlyDigits(value: string) {
    return String(value ?? '').replace(/\D/g, '');
  }

  private normalizeText(value: string) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, ' ')
      .toUpperCase();
  }

  private normalizePixKey(type: PixKeyType, value: string) {
    if (type === PixKeyType.CPF || type === PixKeyType.CNPJ) {
      return this.onlyDigits(value);
    }
    return this.normalizeText(value).trim();
  }

  private registrationType(document: string) {
    return this.onlyDigits(document).length <= 11 ? '1' : '2';
  }

  private pixKeyTypeCode(type: PixKeyType) {
    const codes: Record<PixKeyType, string> = {
      [PixKeyType.PHONE]: '01',
      [PixKeyType.EMAIL]: '02',
      [PixKeyType.CPF]: '03',
      [PixKeyType.CNPJ]: '03',
      [PixKeyType.RANDOM]: '04',
    };

    return codes[type];
  }

  private documentNumber(remittanceId: string, sequencial: number) {
    return `${remittanceId.replace(/[^a-zA-Z0-9]/g, '').slice(-14)}${String(sequencial).padStart(6, '0')}`;
  }

  private formatDate(date: Date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    return `${day}${month}${year}`;
  }

  private formatTime(date: Date) {
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    return `${hour}${minute}${second}`;
  }
}
