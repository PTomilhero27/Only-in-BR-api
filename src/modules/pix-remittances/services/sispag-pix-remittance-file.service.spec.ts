import { PixKeyType } from '@prisma/client';
import { SispagPixRemittanceFileService } from './sispag-pix-remittance-file.service';

describe('SispagPixRemittanceFileService', () => {
  const service = new SispagPixRemittanceFileService();

  it('gera arquivo com registros de 240 bytes em CRLF com quebra final', () => {
    const { fileContent } = service.generate({
      remittanceId: 'remittance-test-id',
      paymentDate: new Date('2026-05-05T12:00:00.000Z'),
      company: {
        document: '65112374000144',
        agency: '0062',
        account: '98794',
        accountDigit: '6',
        name: 'ONLYINBR PRODUCOES CULTURAIS L',
      },
      items: [
        {
          amountCents: 12345,
          payeeName: 'FORNECEDOR TESTE',
          payeeDocument: '12345678000195',
          pixKeyType: PixKeyType.CNPJ,
          pixKey: '12345678000195',
        },
      ],
    });

    expect(fileContent).toContain('\r\n');
    expect(fileContent.endsWith('\r\n')).toBe(true);

    const records = fileContent.split('\r\n');
    expect(records).toHaveLength(7);
    expect(records.at(-1)).toBe('');

    const cnabRecords = records.slice(0, -1);
    expect(cnabRecords.map((record) => record.length)).toEqual([
      240, 240, 240, 240, 240, 240,
    ]);
    expect(
      cnabRecords.map((record) => Buffer.byteLength(record, 'ascii')),
    ).toEqual([240, 240, 240, 240, 240, 240]);
    expect(Buffer.byteLength(fileContent, 'ascii')).toBe(6 * 240 + 6 * 2);
  });
});
