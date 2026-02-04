import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class ContractsStorageService {
  private readonly supabase: SupabaseClient;

  /**
   * Nome do bucket de Storage onde os PDFs ficam.
   * Manter constante evita "strings mágicas" espalhadas.
   */
  private readonly bucketName = 'contracts';

  constructor(private readonly prisma: PrismaService) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar configuradas no .env',
      );
    }

    this.supabase = createClient(url, key);
  }

  private digitsOnly(s: string) {
    return (s || '').replace(/\D/g, '');
  }

  /**
   * ✅ Path versionado para evitar cache/stale.
   *
   * Por que isso existe?
   * - Se você usa sempre ".../contract.pdf" com upsert,
   *   o browser/CDN pode continuar servindo a versão antiga.
   * - Versionando, cada PDF novo tem um caminho único => nunca pega cache errado.
   */
  private buildContractPdfPath(params: {
    fairId: string;
    ownerDocument: string;
    contractId: string;
    createdAt?: Date;
  }) {
    const doc = this.digitsOnly(params.ownerDocument || 'sem_doc');
    const stamp = (params.createdAt ?? new Date())
      .toISOString()
      .replace(/[:.]/g, '-') // compatível com paths
      .replace('T', '_')
      .slice(0, 19);

    // Ex.: {fairId}/{cpf}/contracts/{contractId}/2026-02-03_16-01-10.pdf
    return `${params.fairId}/${doc}/contracts/${params.contractId}/${stamp}.pdf`;
  }

  /**
   * Upload do PDF validando:
   * - Owner está vinculado à feira (OwnerFair)
   * - Template existe e é o principal da feira
   * - Contract.id pertence ao ownerFairId correto (evita salvar PDF no contrato errado)
   * - ✅ Regra nova: se já existe link/fluxo de assinatura (signUrl ou assinafyDocumentId),
   *   NÃO permite novo upload (congela a versão do PDF que a Assinafy vai assinar)
   * - Salva Contract.pdfPath com path versionado (evita cache e arquivo antigo)
   */
  async uploadContractPdf(params: {
    contractId: string;
    fairId: string;
    ownerId: string;
    templateId: string;
    fileBuffer: Buffer;
  }) {
    // 0) valida buffer mínimo
    if (!params.fileBuffer?.length) {
      throw new BadRequestException('Arquivo vazio.');
    }

    // 1) valida vínculo OwnerFair (âncora de segurança)
    const ownerFair = await this.prisma.ownerFair.findFirst({
      where: {
        fairId: params.fairId,
        ownerId: params.ownerId,
      },
      select: {
        id: true,
        owner: { select: { document: true } },
      },
    });

    if (!ownerFair) {
      throw new NotFoundException(
        'Expositor não está vinculado a esta feira (OwnerFair não encontrado).',
      );
    }

    const ownerDocument = ownerFair.owner.document;
    if (!ownerDocument) {
      throw new BadRequestException('Owner não possui documento cadastrado.');
    }

    // 2) valida template existe
    const template = await this.prisma.documentTemplate.findUnique({
      where: { id: params.templateId },
      select: { id: true, status: true, isAddendum: true },
    });

    if (!template) {
      throw new NotFoundException('Template de contrato não encontrado.');
    }

    // 3) valida template principal da feira
    const fairSettings = await this.prisma.fairContractSettings.findUnique({
      where: { fairId: params.fairId },
      select: { templateId: true },
    });

    if (!fairSettings?.templateId) {
      throw new BadRequestException(
        'A feira não possui um contrato principal configurado (FairContractSettings).',
      );
    }

    if (fairSettings.templateId !== params.templateId) {
      throw new BadRequestException(
        'O template informado não é o contrato principal configurado para esta feira.',
      );
    }

    // 4) valida que o contractId realmente pertence a este ownerFair
    const contract = await this.prisma.contract.findUnique({
      where: { id: params.contractId },
      select: {
        id: true,
        ownerFairId: true,
        templateId: true,

        /**
         * ✅ Campos que indicam que a assinatura já foi iniciada.
         * Se qualquer um existir, congelamos o PDF para não gerar inconsistência.
         */
        signUrl: true,
        assinafyDocumentId: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contrato (Contract.id) não encontrado.');
    }

    if (contract.ownerFairId !== ownerFair.id) {
      throw new BadRequestException(
        'Este contrato não pertence ao expositor/feira informados (ownerFairId divergente).',
      );
    }

    /**
     * ✅ Regra simples solicitada:
     * Se já existe signUrl (ou documento na Assinafy), não permitir novo upload.
     *
     * Motivo:
     * - Evita que o usuário gere uma versão nova do PDF depois que o link foi criado,
     *   gerando divergência entre o que está no Supabase e o que a Assinafy está assinando.
     */
    if (contract.signUrl || contract.assinafyDocumentId) {
      throw new ConflictException(
        'Este contrato já possui link de assinatura gerado. ' +
          'Para evitar inconsistência, não é permitido reenviar/gerar outro PDF. ' +
          'Se precisar atualizar o contrato, primeiro cancele/reset o fluxo de assinatura.',
      );
    }

    // mantém templateId consistente
    if (contract.templateId !== params.templateId) {
      // decisão: atualizar templateId do contrato para refletir o principal da feira
      // (evita divergências caso o contrato tenha sido criado com template antigo)
      await this.prisma.contract.update({
        where: { id: contract.id },
        data: { templateId: params.templateId },
      });
    }

    // 5) build path versionado
    const pdfPath = this.buildContractPdfPath({
      fairId: params.fairId,
      ownerDocument,
      contractId: contract.id,
      createdAt: new Date(),
    });

    // 6) upload no Supabase Storage
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(pdfPath, params.fileBuffer, {
        contentType: 'application/pdf',

        /**
         * Cache control:
         * - Mesmo com path versionado, deixamos cache baixo para reduzir efeitos de CDN.
         * - Se você futuramente servir public URL com CDN, isso ajuda.
         */
        cacheControl: '0',

        // Path é único, então upsert não é necessário.
        // Mantemos false para evitar sobrescrita acidental.
        upsert: false,
      });

    if (error) {
      throw new InternalServerErrorException(
        `Erro ao enviar PDF do contrato: ${error.message}`,
      );
    }

    // 7) salva no banco (o PDF que o sistema deve servir é SEMPRE o último path)
    await this.prisma.contract.update({
      where: { id: contract.id },
      data: { pdfPath },
    });

    /**
     * ✅ opcional para debug: gerar signed URL de curta duração
     * Assim você consegue comparar imediatamente "o PDF do Supabase" com o que acabou de gerar.
     */
    const { data: signed, error: signedError } =
      await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(pdfPath, 60 * 10); // 10 min

    if (signedError) {
      // não falha o fluxo por isso; é apenas conveniência
      return { contractId: contract.id, pdfPath };
    }

    return {
      contractId: contract.id,
      pdfPath,
      signedUrl: signed?.signedUrl,
    } as any;
  }
}
