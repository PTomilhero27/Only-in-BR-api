import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OwnerFairStatus } from '@prisma/client';

/**
 * Service responsável por processar eventos do webhook da Assinafy.
 *
 * Responsabilidades:
 * - Ser resiliente e idempotente (o mesmo evento pode chegar mais de uma vez).
 * - Marcar o contrato como assinado (Contract.signedAt) e o vínculo (OwnerFair.contractSignedAt).
 * - Recalcular o status operacional do OwnerFair com base em:
 *   1) assinatura concluída
 *   2) pagamentos quitados (todas as compras pagas)
 *   3) barracas vinculadas (StallFair) compatíveis com a quantidade reservada (OwnerFair.stallsQty)
 *
 * Observação:
 * - Este service NÃO deve lançar exceções “não tratadas” por webhook,
 *   mas o controller já envolve em try/catch e sempre responde 200.
 */
@Injectable()
export class ContractsAssinafyWebhooksService {
  private readonly logger = new Logger(ContractsAssinafyWebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Processa um evento da Assinafy.
   * Regra: só processamos `document_ready` (documento certificado/pronto).
   */
  async handleEvent(payload: any) {
    const event = String(payload?.event || '').toLowerCase();

    // ✅ Mantemos o comportamento do handler antigo: só agir em `document_ready`.
    if (event !== 'document_ready') {
      return { ok: true, ignored: true, event };
    }

    // ✅ O id do documento na Assinafy vem em object.id
    const assinafyDocumentId = String(payload?.object?.id || '').trim();
    if (!assinafyDocumentId) {
      return { ok: true, updated: false, reason: 'missing_object_id' };
    }

    const now = new Date();

    // ✅ Transação garante consistência (assinatura + status) mesmo com concorrência/retries.
    const result = await this.prisma.$transaction(async (tx) => {
      // 1) Encontrar contrato pelo assinafyDocumentId
      const contract = await tx.contract.findFirst({
        where: { assinafyDocumentId },
        select: {
          id: true,
          ownerFairId: true,
          signedAt: true,
          assinafyDocumentId: true,
        },
      });

      if (!contract?.id) {
        // ✅ Não falha: webhooks podem chegar fora de ordem ou com IDs desconhecidos.
        return {
          ok: true,
          updated: false,
          reason: 'contract_not_found',
          assinafyDocumentId,
        };
      }

      // 2) Carregar vínculo do expositor na feira
      const ownerFair = await tx.ownerFair.findUnique({
        where: { id: contract.ownerFairId },
        select: {
          id: true,
          stallsQty: true,
          status: true,
          contractSignedAt: true,
        },
      });

      if (!ownerFair?.id) {
        return {
          ok: true,
          updated: false,
          reason: 'owner_fair_not_found',
          ownerFairId: contract.ownerFairId,
        };
      }

      // 3) Marcar assinatura (idempotente)
      // - OwnerFair.contractSignedAt é o sinal operacional de "assinou"
      // - Contract.signedAt é o histórico do contrato em si
      const shouldSetOwnerFairSignedAt = !ownerFair.contractSignedAt;
      const shouldSetContractSignedAt = !contract.signedAt;

      if (shouldSetOwnerFairSignedAt) {
        await tx.ownerFair.update({
          where: { id: ownerFair.id },
          data: { contractSignedAt: now },
        });
      }

      if (shouldSetContractSignedAt) {
        await tx.contract.update({
          where: { id: contract.id },
          data: { signedAt: now },
        });
      }

      // 4) Calcular “pagou tudo?”
      // Estratégia: considerar quitado quando TODAS as compras têm paidCents >= totalCents.
      // Motivo: evita depender de status calculado, e funciona bem mesmo com histórico/parcelas.
      const purchases = await tx.ownerFairPurchase.findMany({
        where: { ownerFairId: ownerFair.id },
        select: { id: true, totalCents: true, paidCents: true },
      });

      // Se ainda não tem nenhuma compra criada, assumimos que NÃO está pago.
      // (isso impede "CONCLUÍDO" sem ter financeiro definido)
      const isPaidAll =
        purchases.length > 0 &&
        purchases.every((p) => (p.paidCents ?? 0) >= (p.totalCents ?? 0));

      // 5) Calcular “vinculou todas as barracas compradas?”
      const stallsLinked = await tx.stallFair.count({
        where: { ownerFairId: ownerFair.id },
      });

      const stallsBought = ownerFair.stallsQty ?? 0;

      // Regra:
      // - se comprou N barracas, deve vincular N
      // - usamos >= para não travar caso haja inconsistência momentânea (ex.: duplicidade corrigida depois)
      const isAllLinked = stallsBought > 0 ? stallsLinked >= stallsBought : false;

      // 6) Definir próximo status (pós-assinatura)
      // Importante:
      // - Depois que assinou, o status não volta para AGUARDANDO_ASSINATURA.
      // - Se ainda falta pagamento: AGUARDANDO_PAGAMENTO
      // - Se pagou tudo e faltam vínculos: AGUARDANDO_BARRACAS
      // - Se pagou tudo e vinculou tudo: CONCLUIDO
      let nextStatus: OwnerFairStatus;

      if (!isPaidAll) {
        nextStatus = OwnerFairStatus.AGUARDANDO_PAGAMENTO;
      } else if (!isAllLinked) {
        nextStatus = OwnerFairStatus.AGUARDANDO_BARRACAS;
      } else {
        nextStatus = OwnerFairStatus.CONCLUIDO;
      }

      // 7) Persistir o status calculado (somente se mudou)
      if (ownerFair.status !== nextStatus) {
        await tx.ownerFair.update({
          where: { id: ownerFair.id },
          data: { status: nextStatus },
        });
      }

      return {
        ok: true,
        updated: true,
        assinafyDocumentId,
        contractId: contract.id,
        ownerFairId: ownerFair.id,
        signature: {
          ownerFairContractSignedAtSet: shouldSetOwnerFairSignedAt,
          contractSignedAtSet: shouldSetContractSignedAt,
        },
        computed: {
          isPaidAll,
          stallsBought,
          stallsLinked,
          isAllLinked,
          nextStatus,
        },
      };
    });

    // Log “resumo” para debug sem vazar payload inteiro
    this.logger.log(
      `[webhook] document_ready docId=${assinafyDocumentId} updated=${result?.updated} status=${result?.computed?.nextStatus}`,
    );

    return result;
  }
}
