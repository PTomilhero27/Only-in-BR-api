import { Injectable } from '@nestjs/common';
import { PixKeyType, PixRemittancePayeeType } from '@prisma/client';

type SispagPixItem = {
  payeeType: PixRemittancePayeeType;
  amountCents: number;
  payeeName: string;
  payeeDocument: string;
  pixKeyType: PixKeyType;
  pixKey: string;
  txId?: string | null;
};

/**
 * Service que isola a complexidade do arquivo SISPAG/CNAB de PIX.
 * No MVP geramos uma estrutura textual deterministica com um unico lote de transferencia PIX
 * para fornecedores/diversos; a evolucao para layout bancario completo fica concentrada aqui.
 */
@Injectable()
export class SispagPixRemittanceFileService {
  generate(params: {
    fairId: string;
    remittanceId: string;
    paymentDate: Date;
    items: SispagPixItem[];
  }) {
    const paymentDate = this.formatDate(params.paymentDate);
    const fileName = `sispag-pix-${params.fairId}-${paymentDate}-${params.remittanceId.slice(0, 8)}.txt`;

    const lines = [
      this.join(['HEADER', params.remittanceId, params.fairId, paymentDate]),
      ...params.items.map((item, index) =>
        this.join([
          'ITEM',
          String(index + 1).padStart(6, '0'),
          item.payeeType,
          this.onlyDigits(item.payeeDocument),
          item.payeeName,
          item.pixKeyType,
          item.pixKey,
          String(item.amountCents),
          item.txId ?? '',
          '20',
        ]),
      ),
      this.join([
        'TRAILER',
        String(params.items.length),
        String(params.items.reduce((sum, item) => sum + item.amountCents, 0)),
      ]),
    ];

    return {
      fileName,
      fileContent: `${lines.join('\r\n')}\r\n`,
    };
  }

  private join(fields: string[]) {
    return fields.map((field) => field.replace(/\r?\n/g, ' ').trim()).join(';');
  }

  private formatDate(date: Date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  private onlyDigits(value: string) {
    return value.replace(/\D/g, '');
  }
}
