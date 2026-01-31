import { Injectable } from '@nestjs/common'
import { AuditAction, AuditEntity } from '@prisma/client'
import { PrismaTransaction } from 'src/prisma/prisma.types'

/**
 * AuditService (genérico)
 *
 * Responsabilidade:
 * - Centralizar a escrita de logs (AuditLog) para evitar duplicação nos módulos.
 *
 * Decisão:
 * - Recebe `tx` (transaction client) para garantir atomicidade:
 *   (mudança + audit log) sempre no mesmo commit.
 */
@Injectable()
export class AuditService {
  /**
   * Registra um evento de auditoria.
   *
   * Importante:
   * - `tx` deve ser o client da transação (do prisma.$transaction),
   *   e NÃO o PrismaService.
   */
  async log(
    tx: PrismaTransaction,
    params: {
      action: AuditAction
      entity: AuditEntity
      entityId: string
      actorUserId: string
      before?: unknown | null
      after?: unknown | null
      meta?: unknown | null
    },
  ) {
    return tx.auditLog.create({
      data: {
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        actorUserId: params.actorUserId,
        before: (params.before ?? null) as any,
        after: (params.after ?? null) as any,
        meta: (params.meta ?? null) as any,
      },
    })
  }
}
