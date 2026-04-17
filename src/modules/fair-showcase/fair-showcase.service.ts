import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CreateFairShowcaseDto } from './dto/create-fair-showcase.dto';
import { UpdateFairShowcaseDto } from './dto/update-fair-showcase.dto';
import { FairMapsService } from '../fair-maps/fair-maps.service';

/**
 * Service do módulo FairShowcase (Vitrine Pública de Feiras).
 *
 * Responsabilidade:
 * - CRUD da vitrine (FairShowcase) para o painel admin.
 * - Upload de imagens no Supabase Storage (bucket `showcase`).
 * - Endpoints públicos para listar/detalhar feiras publicadas.
 *
 * Decisão:
 * - FairShowcase é 1:1 com Fair. Nem toda feira precisa de vitrine.
 * - Campos calculados (slots, datas, preços) são derivados no query público.
 * - Imagens ficam no Supabase Storage com URL pública.
 */
@Injectable()
export class FairShowcaseService {
  private readonly logger = new Logger(FairShowcaseService.name);
  private readonly supabase: SupabaseClient;
  private readonly bucketName = 'showcase';

  constructor(
    private readonly prisma: PrismaService,
    private readonly fairMapsService: FairMapsService,
  ) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      this.logger.warn(
        'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados. Upload de imagens desabilitado.',
      );
      this.supabase = null as any;
    } else {
      this.supabase = createClient(url, key, {
        auth: { persistSession: false },
      });
    }
  }

  // ──────────────────────────────────────────────
  // Admin: CRUD
  // ──────────────────────────────────────────────

  /**
   * Listar todas as vitrines (com dados da feira).
   */
  async list() {
    const showcases = await this.prisma.fairShowcase.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        fair: {
          select: {
            id: true,
            name: true,
            status: true,
            address: true,
            stallsCapacity: true,
            occurrences: {
              orderBy: { startsAt: 'asc' },
              select: { startsAt: true, endsAt: true },
            },
          },
        },
      },
    });

    return showcases.map((s) => this.toAdminResponse(s));
  }

  /**
   * Buscar vitrine de uma feira. Retorna null se não existir.
   */
  async getByFairId(fairId: string) {
    const showcase = await this.prisma.fairShowcase.findUnique({
      where: { fairId },
      include: {
        fair: {
          select: {
            id: true,
            name: true,
            status: true,
            address: true,
            stallsCapacity: true,
            occurrences: {
              orderBy: { startsAt: 'asc' },
              select: { startsAt: true, endsAt: true },
            },
          },
        },
      },
    });

    if (!showcase) return null;
    return this.toAdminResponse(showcase);
  }

  /**
   * Criar vitrine para uma feira.
   */
  async create(fairId: string, dto: CreateFairShowcaseDto) {
    const fair = await this.prisma.fair.findUnique({
      where: { id: fairId },
      select: { id: true, name: true, address: true },
    });

    if (!fair) throw new NotFoundException('Feira não encontrada.');

    const existing = await this.prisma.fairShowcase.findUnique({
      where: { fairId },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException(
        'Esta feira já possui uma vitrine. Use PATCH para editar.',
      );
    }

    const showcase = await this.prisma.fairShowcase.create({
      data: {
        fairId,
        subtitle: dto.subtitle ?? null,
        description: dto.description ?? null,
        shortDescription: dto.shortDescription ?? null,
        coverImageUrl: dto.coverImageUrl ?? null,
        galleryImageUrls: (dto.galleryImageUrls ?? []) as any,
        benefits: (dto.benefits ?? []) as any,
        faq: (dto.faq ?? []) as any,
        whatsappNumber: dto.whatsappNumber ?? null,
        city: dto.city ?? null,
        state: dto.state ?? null,
        locationLat: dto.locationLat ?? null,
        locationLng: dto.locationLng ?? null,
        isPublished: dto.isPublished ?? false,
      },
      include: {
        fair: {
          select: {
            id: true,
            name: true,
            status: true,
            address: true,
            stallsCapacity: true,
            occurrences: {
              orderBy: { startsAt: 'asc' },
              select: { startsAt: true, endsAt: true },
            },
          },
        },
      },
    });

    return this.toAdminResponse(showcase);
  }

  /**
   * Atualizar vitrine (PATCH parcial).
   */
  async update(fairId: string, dto: UpdateFairShowcaseDto) {
    const showcase = await this.prisma.fairShowcase.findUnique({
      where: { fairId },
      select: { id: true },
    });

    if (!showcase) {
      throw new NotFoundException(
        'Vitrine não encontrada para esta feira. Crie uma primeiro.',
      );
    }

    const data: any = {};
    if (dto.subtitle !== undefined) data.subtitle = dto.subtitle;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.shortDescription !== undefined) data.shortDescription = dto.shortDescription;
    if (dto.coverImageUrl !== undefined) data.coverImageUrl = dto.coverImageUrl;
    if (dto.galleryImageUrls !== undefined) data.galleryImageUrls = dto.galleryImageUrls;
    if (dto.benefits !== undefined) data.benefits = dto.benefits;
    if (dto.faq !== undefined) data.faq = dto.faq;
    if (dto.whatsappNumber !== undefined) data.whatsappNumber = dto.whatsappNumber;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.state !== undefined) data.state = dto.state;
    if (dto.locationLat !== undefined) data.locationLat = dto.locationLat;
    if (dto.locationLng !== undefined) data.locationLng = dto.locationLng;
    if (dto.isPublished !== undefined) data.isPublished = dto.isPublished;

    const updated = await this.prisma.fairShowcase.update({
      where: { fairId },
      data,
      include: {
        fair: {
          select: {
            id: true,
            name: true,
            status: true,
            address: true,
            stallsCapacity: true,
            occurrences: {
              orderBy: { startsAt: 'asc' },
              select: { startsAt: true, endsAt: true },
            },
          },
        },
      },
    });

    return this.toAdminResponse(updated);
  }

  /**
   * Remover vitrine.
   */
  async remove(fairId: string) {
    const showcase = await this.prisma.fairShowcase.findUnique({
      where: { fairId },
      select: { id: true },
    });

    if (!showcase) {
      throw new NotFoundException('Vitrine não encontrada.');
    }

    await this.prisma.fairShowcase.delete({ where: { fairId } });

    return { deleted: true };
  }

  /**
   * Publicar/despublicar vitrine.
   */
  async togglePublish(fairId: string, publish: boolean) {
    const showcase = await this.prisma.fairShowcase.findUnique({
      where: { fairId },
      select: { id: true },
    });

    if (!showcase) {
      throw new NotFoundException('Vitrine não encontrada.');
    }

    const updated = await this.prisma.fairShowcase.update({
      where: { fairId },
      data: { isPublished: publish },
      include: {
        fair: {
          select: {
            id: true,
            name: true,
            status: true,
            address: true,
            stallsCapacity: true,
            occurrences: {
              orderBy: { startsAt: 'asc' },
              select: { startsAt: true, endsAt: true },
            },
          },
        },
      },
    });

    return this.toAdminResponse(updated);
  }

  // ──────────────────────────────────────────────
  // Upload de imagens (Supabase Storage)
  // ──────────────────────────────────────────────

  /**
   * ✅ Upload de imagem para o Supabase Storage (bucket `showcase`).
   *
   * Retorna a URL pública da imagem.
   * O admin usa essa URL para salvar em coverImageUrl ou galleryImageUrls.
   */
  async uploadImage(
    fairId: string,
    file: Express.Multer.File,
  ): Promise<{ url: string }> {
    if (!this.supabase) {
      throw new InternalServerErrorException(
        'Supabase não configurado. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    if (!file?.buffer?.length) {
      throw new BadRequestException('Arquivo vazio.');
    }

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de arquivo não suportado: ${file.mimetype}. Use: ${allowedTypes.join(', ')}.`,
      );
    }

    // Limite de 5MB
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('Imagem deve ter no máximo 5MB.');
    }

    // Path: showcase/{fairId}/{timestamp}-{originalname}
    const ext = file.originalname?.split('.').pop() ?? 'jpg';
    const timestamp = Date.now();
    const safeName = file.originalname
      ?.replace(/[^a-zA-Z0-9.-]/g, '_')
      ?.slice(0, 50) ?? 'image';
    const storagePath = `${fairId}/${timestamp}-${safeName}`;

    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      this.logger.error(`Supabase upload error: ${error.message}`);
      throw new InternalServerErrorException(
        `Erro ao enviar imagem: ${error.message}`,
      );
    }

    // Gera URL pública
    const { data: publicUrlData } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(storagePath);

    return { url: publicUrlData.publicUrl };
  }

  /**
   * ✅ Remover imagem do Supabase Storage.
   */
  async removeImage(storagePath: string): Promise<{ removed: boolean }> {
    if (!this.supabase) {
      throw new InternalServerErrorException('Supabase não configurado.');
    }

    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .remove([storagePath]);

    if (error) {
      this.logger.warn(`Erro ao remover imagem: ${error.message}`);
    }

    return { removed: !error };
  }

  // ──────────────────────────────────────────────
  // Público: listagem e detalhe
  // ──────────────────────────────────────────────

  /**
   * ✅ Lista feiras publicadas (para o portal público).
   *
   * Retorna formato compatível com o schema FutureFair do frontend.
   */
  async listPublished() {
    const showcases = await this.prisma.fairShowcase.findMany({
      where: {
        isPublished: true,
        fair: { status: 'ATIVA' },
      },
      select: { fairId: true },
    });

    // ✅ Força sincronização de cada feira para garantir contagens reais na listagem
    for (const s of showcases) {
      try {
        await this.fairMapsService.syncDetailedFairMap(s.fairId);
      } catch (e) {
        /* ignora se a feira ainda não tiver mapa */
      }
    }

    const finalShowcases = await this.prisma.fairShowcase.findMany({
      where: {
        isPublished: true,
        fair: { status: 'ATIVA' },
      },
      include: {
        fair: {
          select: {
            id: true,
            name: true,
            address: true,
            occurrences: {
              orderBy: { startsAt: 'asc' },
              select: { startsAt: true, endsAt: true },
            },
            fairMapSlots: {
              where: { isPublic: true },
              select: {
                priceCents: true,
                commercialStatus: true,
              },
            },
          },
        },
      },
    });

    return {
      items: finalShowcases.map((s) => this.toPublicFair(s)),
    };
  }

  /**
   * ✅ Detalhe de uma feira publicada (para o portal público).
   */
  async getPublicDetail(fairId: string) {
    // ✅ Garante que o status comercial esteja sincronizado com os vínculos do mapa
    try {
      await this.fairMapsService.syncDetailedFairMap(fairId);
    } catch (e) {
      /* ignora se não houver mapa */
    }

    const showcase = await this.prisma.fairShowcase.findFirst({
      where: {
        fairId,
        isPublished: true,
        fair: { status: 'ATIVA' },
      },
      include: {
        fair: {
          select: {
            id: true,
            name: true,
            address: true,
            occurrences: {
              orderBy: { startsAt: 'asc' },
              select: { startsAt: true, endsAt: true },
            },
            fairMapSlots: {
              where: { isPublic: true },
              select: {
                priceCents: true,
                commercialStatus: true,
              },
            },
          },
        },
      },
    });

    if (!showcase) {
      throw new NotFoundException('Feira não encontrada ou não publicada.');
    }

    return this.toPublicFair(showcase);
  }

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  /**
   * Formata resposta admin.
   */
  private toAdminResponse(showcase: any) {
    const occ = showcase.fair?.occurrences ?? [];
    const startDate = occ.length
      ? new Date(
          Math.min(...occ.map((o: any) => new Date(o.startsAt).getTime())),
        ).toISOString()
      : null;
    const endDate = occ.length
      ? new Date(
          Math.max(...occ.map((o: any) => new Date(o.endsAt).getTime())),
        ).toISOString()
      : null;

    return {
      id: showcase.id,
      fairId: showcase.fairId,
      fair: {
        id: showcase.fair.id,
        name: showcase.fair.name,
        status: showcase.fair.status,
        address: showcase.fair.address,
        stallsCapacity: showcase.fair.stallsCapacity,
        startDate,
        endDate,
      },
      subtitle: showcase.subtitle,
      description: showcase.description,
      shortDescription: showcase.shortDescription,
      coverImageUrl: showcase.coverImageUrl,
      galleryImageUrls: showcase.galleryImageUrls ?? [],
      benefits: showcase.benefits ?? [],
      faq: showcase.faq ?? [],
      whatsappNumber: showcase.whatsappNumber,
      city: showcase.city,
      state: showcase.state,
      locationLat: showcase.locationLat,
      locationLng: showcase.locationLng,
      isPublished: showcase.isPublished,
      createdAt: showcase.createdAt?.toISOString?.() ?? showcase.createdAt,
      updatedAt: showcase.updatedAt?.toISOString?.() ?? showcase.updatedAt,
    };
  }

  /**
   * ✅ Formata para o contrato público (FutureFair do frontend).
   *
   * Campos calculados:
   * - startDate/endDate: min/max das occurrences
   * - availableSlotsCount: slots com commercialStatus=AVAILABLE
   * - totalSlotsCount: total de slots públicos
   * - priceRangeMinCents/priceRangeMaxCents: min/max de priceCents
   */
  private toPublicFair(showcase: any) {
    const fair = showcase.fair;
    const occ = fair.occurrences ?? [];
    const slots = fair.fairMapSlots ?? [];

    const startDate = occ.length
      ? new Date(
          Math.min(...occ.map((o: any) => new Date(o.startsAt).getTime())),
        )
          .toISOString()
          .slice(0, 10)
      : null;

    const endDate = occ.length
      ? new Date(
          Math.max(...occ.map((o: any) => new Date(o.endsAt).getTime())),
        )
          .toISOString()
          .slice(0, 10)
      : null;

    const availableSlots = slots.filter(
      (s: any) => s.commercialStatus === 'AVAILABLE',
    );
    const pricesInCents = slots
      .map((s: any) => s.priceCents)
      .filter((p: any) => p != null && p > 0);

    return {
      id: fair.id,
      name: fair.name,
      subtitle: showcase.subtitle ?? null,
      city: showcase.city ?? null,
      state: showcase.state ?? null,
      address: fair.address ?? null,
      startDate,
      endDate,
      coverImageUrl: showcase.coverImageUrl ?? null,
      description: showcase.description ?? null,
      shortDescription: showcase.shortDescription ?? null,

      availableSlotsCount: availableSlots.length,
      totalSlotsCount: slots.length,
      priceRangeMinCents: pricesInCents.length
        ? Math.min(...pricesInCents)
        : null,
      priceRangeMaxCents: pricesInCents.length
        ? Math.max(...pricesInCents)
        : null,

      galleryImageUrls: showcase.galleryImageUrls ?? [],
      benefits: showcase.benefits ?? [],
      faq: showcase.faq ?? [],

      whatsappNumber: showcase.whatsappNumber ?? null,
      locationLatLng:
        showcase.locationLat != null && showcase.locationLng != null
          ? { lat: showcase.locationLat, lng: showcase.locationLng }
          : null,
    };
  }
}
