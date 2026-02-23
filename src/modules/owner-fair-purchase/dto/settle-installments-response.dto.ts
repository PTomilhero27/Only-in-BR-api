import { ApiProperty } from '@nestjs/swagger';
import { OwnerFairPaymentStatus } from '@prisma/client';

/**
 * Resposta enxuta para a UI do Admin atualizar badges/cards
 * após marcar/desfazer parcelas.
 */
export class SettleInstallmentsResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({
    description: 'ID da compra (OwnerFairPurchase) atualizada.',
    example: 'ckv9p0q2d0001m8x9l2z4abcd',
  })
  purchaseId!: string;

  @ApiProperty({
    description: 'Status financeiro recalculado da compra.',
    enum: OwnerFairPaymentStatus,
    example: OwnerFairPaymentStatus.PARTIALLY_PAID,
  })
  status!: OwnerFairPaymentStatus;

  @ApiProperty({
    description: 'Total de parcelas desta compra.',
    example: 3,
  })
  installmentsCount!: number;

  @ApiProperty({
    description: 'Quantidade de parcelas pagas.',
    example: 1,
  })
  paidCount!: number;

  @ApiProperty({
    description:
      'Total pago na compra em centavos (entrada + parcelas pagas), recalculado.',
    example: 20000,
  })
  paidCents!: number;

  @ApiProperty({
    description: 'Total da compra em centavos.',
    example: 30000,
  })
  totalCents!: number;
}
