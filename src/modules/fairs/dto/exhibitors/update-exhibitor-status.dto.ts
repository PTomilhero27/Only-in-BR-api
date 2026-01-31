import { ApiProperty } from '@nestjs/swagger'
import { IsEnum } from 'class-validator'
import { OwnerFairStatus } from '@prisma/client'

/**
 * DTO para editar o status do expositor dentro da feira.
 * Responsabilidade:
 * - Permitir avanço manual do workflow (MVP).
 * - No futuro, parte disso pode ser automático via pagamentos/contratos.
 */
export class UpdateExhibitorStatusDto {
  @ApiProperty({
    enum: OwnerFairStatus,
    example: OwnerFairStatus.AGUARDANDO_PAGAMENTO,
    description: 'Novo status do expositor no workflow da feira.',
  })
  @IsEnum(OwnerFairStatus, { message: 'status deve ser um valor válido de OwnerFairStatus.' })
  status!: OwnerFairStatus
}
