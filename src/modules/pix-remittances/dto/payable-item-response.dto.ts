import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PixKeyType, PixRemittancePayeeType, FairSupplierInstallmentStatus, ExhibitorPayoutStatus } from '@prisma/client';

/**
 * DTO que representa um item disponivel ou nao para selecao na hora de gerar remessa.
 */
export class PayableItemResponseDto {
  @ApiProperty({ enum: PixRemittancePayeeType })
  payeeType!: PixRemittancePayeeType;

  @ApiPropertyOptional()
  supplierId?: string;

  @ApiPropertyOptional()
  supplierInstallmentId?: string;

  @ApiPropertyOptional()
  exhibitorPayoutId?: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  holderName?: string;

  @ApiPropertyOptional()
  holderDocument?: string;

  @ApiPropertyOptional()
  pixKey?: string;

  @ApiPropertyOptional({ enum: PixKeyType })
  pixKeyType?: PixKeyType;

  @ApiProperty()
  amountCents!: number;

  @ApiProperty()
  totalAmountCents!: number;

  @ApiProperty()
  paidAmountCents!: number;

  @ApiProperty()
  pendingAmountCents!: number;

  @ApiPropertyOptional()
  installmentNumber?: number;

  @ApiPropertyOptional()
  paymentMoment?: Date;

  @ApiProperty({ description: 'Status atual da parcela ou repasse' })
  status!: FairSupplierInstallmentStatus | ExhibitorPayoutStatus | string;

  @ApiProperty({ description: 'Indica se pode ser selecionado para uma nova remessa' })
  canBeSelected!: boolean;

  @ApiPropertyOptional({ description: 'Motivo caso canBeSelected seja falso' })
  disabledReason?: string;
}
