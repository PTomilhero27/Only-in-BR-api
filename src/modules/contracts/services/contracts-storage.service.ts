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
  contractId?: string;
  fairId: string;
  ownerId: string;
  templateId: string;
  fileBuffer: Buffer;
}) {
  if (!params.fileBuffer?.length) {
    throw new BadRequestException('Arquivo vazio.');
  }

  const ownerFair = await this.prisma.ownerFair.findFirst({
    where: { fairId: params.fairId, ownerId: params.ownerId },
    select: { id: true, owner: { select: { document: true } } },
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

  const template = await this.prisma.documentTemplate.findUnique({
    where: { id: params.templateId },
    select: { id: true, status: true, isAddendum: true },
  });

  if (!template) {
    throw new NotFoundException('Template de contrato não encontrado.');
  }

  if (template.isAddendum) {
    throw new BadRequestException(
      'Template informado é um aditivo. Este upload é apenas do contrato principal.',
    );
  }

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

  const contract = await this.prisma.$transaction(async (tx) => {
    if (params.contractId) {
      const found = await tx.contract.findUnique({
        where: { id: params.contractId },
        select: {
          id: true,
          ownerFairId: true,
          templateId: true,
          signUrl: true,
          assinafyDocumentId: true,
        },
      });

      if (!found) {
        throw new NotFoundException('Contrato (Contract.id) não encontrado.');
      }

      if (found.ownerFairId !== ownerFair.id) {
        throw new BadRequestException(
          'Este contrato não pertence ao expositor/feira informados (ownerFairId divergente).',
        );
      }

      // ✅ recomendado: não trocar template silenciosamente
      if (found.templateId !== params.templateId) {
        throw new BadRequestException(
          'O contrato existente está vinculado a outro template. ' +
            'Isso indica mudança de contrato principal da feira. ' +
            'Crie/recrie o contrato (reset do fluxo) antes de enviar um novo PDF.',
        );
      }

      return found;
    }

    // fluxo novo: 1:1 por ownerFairId
    const upserted = await tx.contract.upsert({
      where: { ownerFairId: ownerFair.id },
      create: {
        ownerFairId: ownerFair.id,
        templateId: params.templateId,
      },
      update: {}, // ✅ não força mudar templateId aqui
      select: {
        id: true,
        ownerFairId: true,
        templateId: true,
        signUrl: true,
        assinafyDocumentId: true,
      },
    });

    // se já existia e templateId diferente, falha (mesma regra)
    if (upserted.templateId !== params.templateId) {
      throw new BadRequestException(
        'Já existe um contrato para este expositor nesta feira, mas com outro template. ' +
          'Isso indica mudança de contrato principal. Recrie/reset o contrato antes de enviar novo PDF.',
      );
    }

    return upserted;
  });

  if (contract.signUrl || contract.assinafyDocumentId) {
    throw new ConflictException(
      'Este contrato já possui link de assinatura gerado. ' +
        'Para evitar inconsistência, não é permitido reenviar/gerar outro PDF. ' +
        'Se precisar atualizar o contrato, primeiro cancele/reset o fluxo de assinatura.',
    );
  }

  const pdfPath = this.buildContractPdfPath({
    fairId: params.fairId,
    ownerDocument,
    contractId: contract.id,
    createdAt: new Date(),
  });

  const { error } = await this.supabase.storage
    .from(this.bucketName)
    .upload(pdfPath, params.fileBuffer, {
      contentType: 'application/pdf',
      cacheControl: '0',
      upsert: false,
    });

  if (error) {
    throw new InternalServerErrorException(
      `Erro ao enviar PDF do contrato: ${error.message}`,
    );
  }

  await this.prisma.contract.update({
    where: { id: contract.id },
    data: { pdfPath },
  });

  const { data: signed, error: signedError } = await this.supabase.storage
    .from(this.bucketName)
    .createSignedUrl(pdfPath, 60 * 10);

  if (signedError) {
    return { contractId: contract.id, pdfPath };
  }

  return { contractId: contract.id, pdfPath, signedUrl: signed?.signedUrl } as any;
}


}
