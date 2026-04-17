import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CreateAssinafySignUrlDto } from '../dto/assinafy/create-sign-url.dto';
import { CreateAssinafySignUrlResponseDto } from '../dto/assinafy/create-sign-url-response.dto';
import { FairStatus, OwnerFairStatus } from '@prisma/client';

/**
 * ContractsAssinafyService
 *
 * Responsabilidade:
 * - Criar/buscar signer
 * - Criar documento na Assinafy a partir do PDF salvo no Supabase Storage
 * - Aguardar processamento do documento (metadata_processing)
 * - Criar assignment virtual e derivar signUrl
 * - Persistir IDs/URL no Contract
 *
 * Regras de negócio (2026):
 * - 1 Contract por OwnerFair (ownerFairId unique)
 * - PDF é fonte de verdade (Contract.pdfPath)
 *
 * ✅ Regra nova solicitada:
 * - Se contract.signUrl já está preenchido => BLOQUEIA (não pode gerar novamente).
 *   Motivo: o PDF enviado para a Assinafy deve ser o "último" e não pode mudar depois.
 */
@Injectable()
export class ContractsAssinafyService {
  private readonly supabase: SupabaseClient;

  /** bucket do storage */
  private readonly bucketName = 'contracts';

  constructor(private readonly prisma: PrismaService) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar configuradas no .env',
      );
    }

    this.supabase = createClient(url, key, { auth: { persistSession: false } });
  }

  private mustEnv(name: string) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env: ${name}`);
    return v;
  }

  private assinafyBaseUrl() {
    return this.mustEnv('ASSINAFY_API_URL').replace(/\/$/, '');
  }

  private assinafyAccountId() {
    return this.mustEnv('ASSINAFY_ACCOUNT_ID');
  }

  private assinafyKey() {
    return this.mustEnv('ASSINAFY_API_KEY');
  }

  private signBaseUrl() {
    return (
      process.env.ASSINAFY_SIGN_BASE_URL || 'https://app.assinafy.com.br/sign'
    ).replace(/\/$/, '');
  }

  private normalizeKey(s: string) {
    return (s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60);
  }

  private normalizeEmail(email: string) {
    return (email || '').trim().toLowerCase();
  }

  private getHttpErrorStatus(error: unknown): number | null {
    if (error instanceof HttpException) {
      return error.getStatus();
    }

    return null;
  }

  private isSignerAlreadyExistsError(error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error || '');
    const normalized = message
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    return (
      normalized.includes('signatario com este e-mail ja existe') ||
      normalized.includes('signatario com este email ja existe') ||
      normalized.includes('already exists')
    );
  }

  /**
   * Baixa o PDF do Supabase Storage usando service role.
   * Evita depender de signedUrl.
   */
  private async downloadPdfFromStorage(pdfPath: string): Promise<Buffer> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .download(pdfPath);

    if (error) {
      throw new InternalServerErrorException(
        `Erro ao baixar PDF do Storage: ${error.message}`,
      );
    }
    if (!data) {
      throw new InternalServerErrorException(
        'Storage não retornou arquivo do PDF.',
      );
    }

    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
  }

  private async assinafyCreateSigner(params: {
    name: string;
    email: string;
  }): Promise<string> {
    const normalizedEmail = this.normalizeEmail(params.email);
    const res = await fetch(
      `${this.assinafyBaseUrl()}/accounts/${this.assinafyAccountId()}/signers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.assinafyKey()}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          full_name: params.name,
          email: normalizedEmail,
        }),
      },
    );

    const text = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      throw new HttpException(
        data?.message || data?.error || `Assinafy error (${res.status})`,
        res.status,
      );
    }

    const signerId = data?.id ?? data?.data?.[0]?.id ?? data?.data?.id;
    if (!signerId) {
      throw new InternalServerErrorException(
        'Assinafy não retornou signer id.',
      );
    }

    return String(signerId);
  }

  private async assinafyFindSignerByEmail(
    email: string,
  ): Promise<string | null> {
    const normalizedEmail = this.normalizeEmail(email);
    const url =
      `${this.assinafyBaseUrl()}/accounts/${this.assinafyAccountId()}/signers?email=` +
      encodeURIComponent(normalizedEmail);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.assinafyKey()}`,
        Accept: 'application/json',
      },
    });

    const text = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      throw new HttpException(
        data?.message ||
          data?.error ||
          `Assinafy list signers error (${res.status})`,
        res.status,
      );
    }

    const list = Array.isArray(data) ? data : data.items || data.data || [];
    const found = list.find(
      (s: any) =>
        this.normalizeEmail(String(s?.email || '')) === normalizedEmail,
    );

    if (!found?.id) return null;
    return String(found.id);
  }

  private async assinafyTryFindSignerByEmail(
    email: string,
  ): Promise<string | null> {
    try {
      return await this.assinafyFindSignerByEmail(email);
    } catch (error) {
      const status = this.getHttpErrorStatus(error);

      if (status && [400, 404, 405, 422, 501].includes(status)) {
        return null;
      }

      throw error;
    }
  }

  private async assinafyGetOrCreateSigner(params: {
    name: string;
    email: string;
  }): Promise<{ signerId: string; created: boolean }> {
    const existing = await this.assinafyTryFindSignerByEmail(params.email);
    if (existing) {
      return { signerId: existing, created: false };
    }

    try {
      const signerId = await this.assinafyCreateSigner(params);
      return { signerId, created: true };
    } catch (error) {
      if (this.isSignerAlreadyExistsError(error)) {
        const found = await this.assinafyTryFindSignerByEmail(params.email);
        if (found) return { signerId: found, created: false };
      }

      throw error;
    }
  }

  private async persistSignerReference(params: {
    ownerId: string;
    contractId: string;
    signerId: string;
    ownerSignerId?: string | null;
    contractSignerId?: string | null;
  }) {
    const shouldUpdateOwner = params.ownerSignerId !== params.signerId;
    const shouldUpdateContract = params.contractSignerId !== params.signerId;

    if (shouldUpdateOwner && shouldUpdateContract) {
      await this.prisma.$transaction([
        this.prisma.owner.update({
          where: { id: params.ownerId },
          data: { assinafySignerId: params.signerId },
        }),
        this.prisma.contract.update({
          where: { id: params.contractId },
          data: { assinafySignerId: params.signerId },
        }),
      ]);
      return;
    }

    if (shouldUpdateOwner) {
      await this.prisma.owner.update({
        where: { id: params.ownerId },
        data: { assinafySignerId: params.signerId },
      });
    }

    if (shouldUpdateContract) {
      await this.prisma.contract.update({
        where: { id: params.contractId },
        data: { assinafySignerId: params.signerId },
      });
    }
  }

  private async resolveSignerId(params: {
    ownerId: string;
    contractId: string;
    ownerSignerId?: string | null;
    contractSignerId?: string | null;
    name: string;
    email: string;
  }) {
    const persistedSignerId = params.ownerSignerId ?? params.contractSignerId;

    if (persistedSignerId) {
      await this.persistSignerReference({
        ownerId: params.ownerId,
        contractId: params.contractId,
        signerId: persistedSignerId,
        ownerSignerId: params.ownerSignerId,
        contractSignerId: params.contractSignerId,
      });

      return persistedSignerId;
    }

    const signer = await this.assinafyGetOrCreateSigner({
      name: params.name,
      email: params.email,
    });

    await this.persistSignerReference({
      ownerId: params.ownerId,
      contractId: params.contractId,
      signerId: signer.signerId,
      ownerSignerId: params.ownerSignerId,
      contractSignerId: params.contractSignerId,
    });

    return signer.signerId;
  }

  private async assinafyCreateDocumentFromPdf(params: {
    title: string;
    pdfBuffer: Buffer;
    filename: string;
  }): Promise<string> {
    const fd = new FormData();
    const blob = new Blob([new Uint8Array(params.pdfBuffer)], {
      type: 'application/pdf',
    });
    fd.append('file', blob, params.filename);

    const res = await fetch(
      `${this.assinafyBaseUrl()}/accounts/${this.assinafyAccountId()}/documents`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.assinafyKey()}`,
          Accept: 'application/json',
        },
        body: fd,
      },
    );

    const text = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      throw new BadRequestException(
        data?.message ||
          data?.error ||
          `Erro ao criar documento (${res.status})`,
      );
    }

    const documentId = data?.id ?? data?.data?.id ?? data?.data?.[0]?.id;
    if (!documentId) {
      throw new InternalServerErrorException(
        'Assinafy não retornou document id.',
      );
    }

    return String(documentId);
  }

  private async assinafyWaitDocumentReady(
    documentId: string,
    timeoutMs = 60_000,
  ) {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      const res = await fetch(
        `${this.assinafyBaseUrl()}/documents/${documentId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.assinafyKey()}`,
            Accept: 'application/json',
          },
        },
      );

      const payload = await res.json().catch(() => ({}));

      const docStatus =
        payload?.data?.status ??
        payload?.status ??
        payload?.document?.status ??
        null;

      if (docStatus && docStatus !== 'metadata_processing') {
        return docStatus;
      }

      await new Promise((r) => setTimeout(r, 1000));
    }

    throw new InternalServerErrorException(
      'Timeout aguardando documento sair de metadata_processing',
    );
  }

  private async assinafyCreateAssignmentVirtual(params: {
    documentId: string;
    signerId: string;
    expirationISO?: string;
  }): Promise<{ signUrl: string; assignmentId?: string | null }> {
    const res = await fetch(
      `${this.assinafyBaseUrl()}/documents/${params.documentId}/assignments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.assinafyKey()}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          signerIds: [params.signerId],
          method: 'virtual',
          expiration: params.expirationISO ?? undefined,
        }),
      },
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new BadRequestException(
        data?.message || 'Erro ao criar assignment na Assinafy.',
      );
    }

    const signUrl = `${this.signBaseUrl()}/${params.documentId}`;
    return { signUrl, assignmentId: data?.id ?? null };
  }

  /**
   * createOrReuseSignUrl
   *
   * ✅ Regra nova:
   * - se signUrl estiver preenchida, BLOQUEIA.
   * - se contractSignedAt estiver preenchido, BLOQUEIA.
   */
  /**
   * createOrReuseSignUrl
   *
   * Responsabilidade:
   * - Garantir que existe um Contract para o OwnerFair
   * - Garantir que existe PDF salvo (pdfPath)
   * - Criar/reutilizar signer
   * - Criar/reutilizar document
   * - Criar assignment virtual e derivar signUrl
   *
   * Regra de robustez para o front:
   * - Se signUrl já existir, RETORNA (reused=true), não lança erro.
   * - Se já assinou (contractSignedAt ou Contract.signedAt), RETORNA (alreadySigned=true).
   *
   * Motivo:
   * - O front pode ter timeout/abort e reenviar request. Isso não pode quebrar UX nem causar “travamento”.
   */
  async createOrReuseSignUrl(dto: CreateAssinafySignUrlDto): Promise<
    CreateAssinafySignUrlResponseDto & {
      reused?: boolean;
      alreadySigned?: boolean;
    }
  > {
    // 1) valida vínculo OwnerFair (âncora)
    const ownerFair = await this.prisma.ownerFair.findUnique({
      where: { ownerId_fairId: { ownerId: dto.ownerId, fairId: dto.fairId } },
      select: {
        id: true,
        status: true,
        contractSignedAt: true,
        owner: {
          select: {
            id: true,
            document: true,
            assinafySignerId: true,
          },
        },
        fair: {
          select: {
            status: true,
            contractSettings: { select: { templateId: true } },
          },
        },
      },
    });

    if (!ownerFair) {
      throw new NotFoundException(
        'Expositor não está vinculado a esta feira (OwnerFair não encontrado).',
      );
    }

    if (ownerFair.fair.status === FairStatus.FINALIZADA) {
      throw new BadRequestException(
        'Não é possível gerar contrato para uma feira finalizada.',
      );
    }

    const mainTemplateId = ownerFair.fair?.contractSettings?.templateId;
    if (!mainTemplateId) {
      throw new BadRequestException(
        'A feira não possui contrato principal configurado (FairContractSettings).',
      );
    }

    // 2) garante Contract (1 por ownerFairId)
    const contract = await this.prisma.contract.upsert({
      where: { ownerFairId: ownerFair.id },
      update: {
        templateId: mainTemplateId,
      },
      create: {
        ownerFairId: ownerFair.id,
        templateId: mainTemplateId,
      },
      select: {
        id: true,
        pdfPath: true,
        signedAt: true,
        assinafyDocumentId: true,
        assinafySignerId: true,
        signUrl: true,
        signUrlExpiresAt: true,
      },
    });

    const knownSignerId =
      ownerFair.owner.assinafySignerId ?? contract.assinafySignerId ?? null;

    if (knownSignerId) {
      await this.persistSignerReference({
        ownerId: ownerFair.owner.id,
        contractId: contract.id,
        signerId: knownSignerId,
        ownerSignerId: ownerFair.owner.assinafySignerId,
        contractSignerId: contract.assinafySignerId,
      });
    }

    /**
     * ✅ Caso já esteja assinado:
     * Retornamos OK para o front, para ele parar de tentar e atualizar a tela.
     */
    if (ownerFair.contractSignedAt || contract.signedAt) {
      return {
        signUrl: contract.signUrl ?? '',
        contractId: contract.id,
        assinafyDocumentId: contract.assinafyDocumentId ?? '',
        assinafySignerId: knownSignerId ?? '',
        reused: true,
        alreadySigned: true,
      };
    }

    /**
     * ✅ Caso já exista link:
     * NÃO lançar erro. Apenas devolver o que já foi gerado.
     * Isso resolve: “criou mas o front não recebeu resposta”.
     */
    if (contract.signUrl) {
      // garante status operacional coerente (se ainda não assinou)
      if (ownerFair.status !== OwnerFairStatus.AGUARDANDO_ASSINATURA) {
        await this.prisma.ownerFair.update({
          where: { id: ownerFair.id },
          data: { status: OwnerFairStatus.AGUARDANDO_ASSINATURA },
        });
      }

      return {
        signUrl: contract.signUrl,
        contractId: contract.id,
        assinafyDocumentId: contract.assinafyDocumentId ?? '',
        assinafySignerId: knownSignerId ?? '',
        reused: true,
      };
    }

    // 3) precisa ter pdfPath
    if (!contract.pdfPath) {
      throw new BadRequestException(
        'pdfPath ainda está vazio. Gere e envie o PDF para o Storage antes de criar o documento na Assinafy.',
      );
    }

    // 4) signer (cria/reutiliza)
    const signerId = await this.resolveSignerId({
      ownerId: ownerFair.owner.id,
      contractId: contract.id,
      ownerSignerId: ownerFair.owner.assinafySignerId,
      contractSignerId: contract.assinafySignerId,
      name: dto.name,
      email: dto.email,
    });

    // 5) documentId (cria/reutiliza)
    let documentId = contract.assinafyDocumentId;
    if (!documentId) {
      const pdfBuffer = await this.downloadPdfFromStorage(contract.pdfPath);

      const safeName = this.normalizeKey(dto.name || 'Expositor');
      const safeBrand = this.normalizeKey(dto.brand || 'sem_marca');
      const ownerDoc = (ownerFair.owner.document || 'sem_doc').replace(
        /\D/g,
        '',
      );
      const filename = `Contrato_${ownerDoc}_${safeBrand}_${safeName}.pdf`;

      documentId = await this.assinafyCreateDocumentFromPdf({
        title: `Contrato_${ownerDoc}`,
        pdfBuffer,
        filename,
      });

      await this.prisma.contract.update({
        where: { id: contract.id },
        data: { assinafyDocumentId: documentId },
      });
    }

    // 6) aguarda documento pronto
    await this.assinafyWaitDocumentReady(documentId);

    // 7) cria assignment e gera signUrl
    const { signUrl } = await this.assinafyCreateAssignmentVirtual({
      documentId,
      signerId,
      expirationISO: dto.expiresAtISO,
    });

    const signUrlExpiresAt = dto.expiresAtISO
      ? new Date(dto.expiresAtISO)
      : null;

    // 8) persiste link + expiração
    await this.prisma.contract.update({
      where: { id: contract.id },
      data: {
        signUrl,
        signUrlExpiresAt: signUrlExpiresAt ?? undefined,
      },
    });

    // 9) atualiza status operacional (assinatura pendente)
    if (ownerFair.status !== OwnerFairStatus.AGUARDANDO_ASSINATURA) {
      await this.prisma.ownerFair.update({
        where: { id: ownerFair.id },
        data: { status: OwnerFairStatus.AGUARDANDO_ASSINATURA },
      });
    }

    return {
      signUrl,
      contractId: contract.id,
      assinafyDocumentId: documentId,
      assinafySignerId: signerId,
      reused: false,
    };
  }
}

