import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  OwnerFairPaymentStatus,
  OwnerFairStatus,
  PersonType,
  StallSize,
  StallType,
} from '@prisma/client'

/**
 * DTO de header da feira para a tela “Barracas vinculadas”.
 * Responsabilidade:
 * - Expor informações essenciais da feira para montar o topo da página.
 * - Incluir métricas de capacidade: capacity/reserved/remaining.
 * - Evitar vazamento do schema do Prisma.
 */
export class FairHeaderDto {
  @ApiProperty({ example: '0f9d6b6b-7a0c-4b2b-8d6d-91a1c5a5b63d' })
  id!: string

  @ApiProperty({ example: 'Feira gastronômica botecagem' })
  name!: string

  @ApiProperty({ example: 'ATIVA' })
  status!: string

  @ApiProperty({ example: 'Praça Central, 100 - Centro, Goiânia/GO' })
  address!: string

  @ApiProperty({
    description: 'Capacidade total de barracas permitidas na feira.',
    example: 60,
  })
  stallsCapacity!: number

  @ApiProperty({
    description: 'Total de barracas reservadas (soma de OwnerFair.stallsQty).',
    example: 12,
  })
  stallsReserved!: number

  @ApiProperty({
    description: 'Total de barracas restantes (capacity - reserved).',
    example: 48,
  })
  stallsRemaining!: number

  @ApiProperty({
    description: 'Ocorrências (dias/horários) da feira, ordenadas por data.',
    example: [
      {
        id: 'b7b9020b-1c24-4a3d-9f84-c9b98ad6de5f',
        startsAt: '2026-02-14T18:00:00.000Z',
        endsAt: '2026-02-14T23:59:00.000Z',
      },
    ],
  })
  occurrences!: Array<{
    id: string
    startsAt: string
    endsAt: string
  }>

  @ApiProperty({ example: '2026-01-10T12:30:00.000Z' })
  createdAt!: string

  @ApiProperty({ example: '2026-01-11T09:00:00.000Z' })
  updatedAt!: string
}

/**
 * DTO mínimo do Owner para tabela.
 * Responsabilidade:
 * - Exibir identificação e contato sem “vazar” campos sensíveis/irrelevantes.
 */
export class FairExhibitorOwnerDto {
  @ApiProperty({ example: 'ckv8l0t4w0001z9abcd1234xy' })
  id!: string

  @ApiProperty({ enum: PersonType, example: PersonType.PF })
  personType!: PersonType

  @ApiProperty({
    description: 'CPF/CNPJ normalizado (somente dígitos).',
    example: '06877511107',
  })
  document!: string

  @ApiPropertyOptional({ example: 'Heloisa Lima Vale' })
  fullName?: string | null

  @ApiPropertyOptional({ example: 'helo14vale@gmail.com' })
  email?: string | null

  @ApiPropertyOptional({ example: '62916604667' })
  phone?: string | null
}

/**
 * DTO de compra por tamanho (slots) dentro de uma feira.
 * Responsabilidade:
 * - Detalhar como a compra foi distribuída por tamanho.
 */
export class FairExhibitorSlotDto {
  @ApiProperty({ enum: StallSize, example: StallSize.SIZE_3X3 })
  stallSize!: StallSize

  @ApiProperty({
    description: 'Quantidade comprada para este tamanho.',
    example: 2,
  })
  qty!: number

  @ApiProperty({
    description: 'Valor unitário em centavos (evita ponto flutuante).',
    example: 35000,
  })
  unitPriceCents!: number
}

/**
 * DTO resumido de uma barraca vinculada à feira.
 * Responsabilidade:
 * - Mostrar na tabela e no modal de detalhes, sem payload excessivo.
 */
export class FairLinkedStallDto {
  @ApiProperty({ example: 'ckv8l0t4w0001z9abcdstall01' })
  id!: string

  @ApiProperty({ example: 'Pastel da Nega' })
  pdvName!: string

  @ApiProperty({ enum: StallType, example: StallType.OPEN })
  stallType!: StallType

  @ApiProperty({ enum: StallSize, example: StallSize.SIZE_3X3 })
  stallSize!: StallSize

  @ApiProperty({ example: 2 })
  machinesQty!: number

  @ApiPropertyOptional({ example: 'Banner Pastel da Nega' })
  bannerName?: string | null

  @ApiPropertyOptional({ example: 'Salgados' })
  mainCategory?: string | null

  @ApiProperty({ example: 3 })
  teamQty!: number
}

/**
 * DTO de parcela do plano de pagamento.
 * Responsabilidade:
 * - Permitir UI rica (lista de parcelas, vencimentos, pagas/não pagas).
 * - Útil para modal “Baixar parcelas”.
 */
export class FairPaymentInstallmentDto {
  @ApiProperty({
    description: 'Número da parcela (1..N).',
    example: 1,
  })
  number!: number

  @ApiProperty({
    description: 'Data prevista do pagamento (ISO).',
    example: '2026-02-10T00:00:00.000Z',
  })
  dueDate!: string

  @ApiProperty({
    description: 'Valor previsto da parcela (centavos).',
    example: 50000,
  })
  amountCents!: number

  @ApiPropertyOptional({
    description: 'Quando foi pago (ISO). Null => ainda não pago.',
    example: '2026-02-10T12:00:00.000Z',
  })
  paidAt?: string | null

  @ApiPropertyOptional({
    description: 'Valor efetivamente pago (centavos).',
    example: 50000,
  })
  paidAmountCents?: number | null
}

/**
 * Resumo de pagamento para exibição na tabela.
 * Responsabilidade:
 * - Expor um contrato simples e direto pro front.
 * - Incluir métricas prontas: paidCount, nextDueDate, overdueCount.
 *
 * Decisão:
 * - Incluímos `installments` por padrão para viabilizar modal sem outra chamada.
 * - Se ficar pesado no futuro, podemos colocar um flag para “expandir”.
 */
export class FairPaymentSummaryDto {
  @ApiProperty({ enum: OwnerFairPaymentStatus, example: OwnerFairPaymentStatus.PARTIALLY_PAID })
  status!: OwnerFairPaymentStatus

  @ApiProperty({
    description: 'Valor total acordado (centavos).',
    example: 150000,
  })
  totalCents!: number

  @ApiProperty({
    description: 'Quantidade total de parcelas (1 = à vista).',
    example: 3,
  })
  installmentsCount!: number

  @ApiProperty({
    description: 'Quantidade de parcelas pagas (paidAt != null).',
    example: 1,
  })
  paidCount!: number

  @ApiPropertyOptional({
    description: 'Próxima data de vencimento em aberto (ISO).',
    example: '2026-03-10T00:00:00.000Z',
  })
  nextDueDate?: string | null

  @ApiProperty({
    description: 'Lista com todas as datas de vencimento combinadas (ISO).',
    example: ['2026-02-10T00:00:00.000Z', '2026-03-10T00:00:00.000Z', '2026-04-10T00:00:00.000Z'],
    type: [String],
  })
  dueDates!: string[]

  @ApiProperty({
    description: 'Quantidade de parcelas vencidas e não pagas.',
    example: 0,
  })
  overdueCount!: number

  @ApiPropertyOptional({ type: [FairPaymentInstallmentDto] })
  installments?: FairPaymentInstallmentDto[]
}

/**
 * Linha principal da tabela “Barracas vinculadas”.
 * Responsabilidade:
 * - Consolidar compra vs vinculado
 * - Expor status efetivo para a UI
 * - Trazer resumo de pagamento
 */
export class FairExhibitorRowDto {
  @ApiProperty({ example: 'ckv8l0t4w0001z9abownerfair1' })
  ownerFairId!: string

  @ApiProperty({ example: '0f9d6b6b-7a0c-4b2b-8d6d-91a1c5a5b63d' })
  fairId!: string

  @ApiProperty({ type: FairExhibitorOwnerDto })
  owner!: FairExhibitorOwnerDto

  @ApiProperty({
    description: 'Total de barracas compradas nesta feira.',
    example: 2,
  })
  stallsQtyPurchased!: number

  @ApiProperty({ type: [FairExhibitorSlotDto] })
  stallSlots!: FairExhibitorSlotDto[]

  @ApiProperty({
    description: 'Total de barracas já vinculadas na feira.',
    example: 1,
  })
  stallsQtyLinked!: number

  @ApiProperty({ type: [FairLinkedStallDto] })
  linkedStalls!: FairLinkedStallDto[]

  @ApiProperty({ enum: OwnerFairStatus, example: OwnerFairStatus.SELECIONADO })
  status!: OwnerFairStatus

  @ApiProperty({
    description:
      'Indica se o expositor está completo (pagamento OK + contrato assinado + vinculou todas as barracas compradas).',
    example: false,
  })
  isComplete!: boolean

  @ApiPropertyOptional({
    description: 'Data/hora de assinatura do contrato (ISO).',
    example: '2026-02-01T14:30:00.000Z',
  })
  contractSignedAt?: string | null

  @ApiPropertyOptional({
    description: 'Resumo do plano de pagamento (se existir).',
    type: FairPaymentSummaryDto,
  })
  payment?: FairPaymentSummaryDto | null
}

/**
 * Resposta do endpoint de expositores.
 * Responsabilidade:
 * - Manter contrato consistente: header da feira + itens.
 */
export class FairExhibitorsResponseDto {
  @ApiProperty({ type: FairHeaderDto })
  fair!: FairHeaderDto

  @ApiProperty({ type: [FairExhibitorRowDto] })
  items!: FairExhibitorRowDto[]
}
