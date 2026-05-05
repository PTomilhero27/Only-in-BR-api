import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FairSupplierImportInstallmentDto {
  @ApiProperty()
  number: number;

  @ApiProperty()
  amountCents: number;

  @ApiProperty()
  description: string;

  @ApiProperty()
  paymentMoment: string;
}

export class FairSupplierImportPreviewDataDto {
  @ApiPropertyOptional()
  id?: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  holderName: string;

  @ApiProperty()
  holderDocument: string;

  @ApiProperty()
  pixKey: string;

  @ApiProperty()
  pixKeyType: string;

  @ApiProperty()
  pixKeyConfidence: string;

  @ApiProperty()
  serviceDescription: string;

  @ApiProperty()
  totalAmountCents: number;

  @ApiProperty()
  preEventAmountCents: number;

  @ApiProperty()
  postEventAmountCents: number;

  @ApiProperty({ type: [FairSupplierImportInstallmentDto] })
  installments: FairSupplierImportInstallmentDto[];

  @ApiProperty({ 
    description: 'Status original extraído da planilha (PAGO ou NAO_PAGO)', 
    example: 'NAO_PAGO' 
  })
  importedStatus: string;

  @ApiProperty({ 
    description: 'Status real a ser salvo no sistema para este fornecedor (PAID, PENDING, etc)', 
    example: 'PENDING' 
  })
  supplierStatus: string;

  @ApiPropertyOptional()
  notes?: string;
}

export class FairSupplierImportPreviewRowDto {
  @ApiProperty()
  rowNumber: number;

  @ApiProperty({ example: 'CREATE' })
  action: 'CREATE' | 'UPDATE';

  @ApiProperty({ example: 'VALID' })
  status: 'VALID' | 'INVALID' | 'WARNING';

  @ApiProperty({ type: FairSupplierImportPreviewDataDto })
  supplier: FairSupplierImportPreviewDataDto;

  @ApiProperty({ type: [String] })
  errors: string[];

  @ApiProperty({ type: [String] })
  warnings: string[];
}

export class FairSupplierImportPreviewSummaryDto {
  @ApiProperty()
  totalRows: number;

  @ApiProperty()
  validCount: number;

  @ApiProperty()
  newCount: number;

  @ApiProperty()
  updateCount: number;

  @ApiProperty()
  errorCount: number;

  @ApiProperty()
  warningCount: number;
}

export class FairSupplierImportPreviewResponseDto {
  @ApiProperty({ type: FairSupplierImportPreviewSummaryDto })
  summary: FairSupplierImportPreviewSummaryDto;

  @ApiProperty({ type: [FairSupplierImportPreviewRowDto] })
  rows: FairSupplierImportPreviewRowDto[];
}
