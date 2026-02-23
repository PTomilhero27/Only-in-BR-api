import { ApiProperty } from '@nestjs/swagger'
import { OwnerFairPaymentStatus } from '@prisma/client'

/**
 * Resposta padrão para ações de pagamento/reagendamento no Admin,
 * permitindo atualizar UI com 1 retorno.
 */
export class InstallmentPaymentActionResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean

  @ApiProperty({ example: 'ckv9p0q2d0001m8x9l2z4abcd' })
  purchaseId!: string

  @ApiProperty({ enum: OwnerFairPaymentStatus, example: OwnerFairPaymentStatus.PARTIALLY_PAID })
  purchaseStatus!: OwnerFairPaymentStatus

  @ApiProperty({ example: 30000 })
  purchaseTotalCents!: number

  @ApiProperty({ example: 20000 })
  purchasePaidCents!: number

  @ApiProperty({
    description: 'paidAt da compra quando 100% quitada (ISO) ou null.',
    example: null,
    nullable: true,
  })
  purchasePaidAt!: string | null

  @ApiProperty({ example: 'inst_abc123' })
  installmentId!: string

  @ApiProperty({ example: 1 })
  installmentNumber!: number

  @ApiProperty({ example: 2000 })
  installmentAmountCents!: number

  @ApiProperty({
    description: 'Somatório pago na parcela (cache).',
    example: 1000,
  })
  installmentPaidAmountCents!: number

  @ApiProperty({
    description: 'paidAt da parcela quando quitada (cache) (ISO) ou null.',
    example: null,
    nullable: true,
  })
  installmentPaidAt!: string | null

  @ApiProperty({
    description: 'DueDate atualizado (ISO).',
    example: '2026-02-10T00:00:00.000Z',
  })
  installmentDueDate!: string
}
