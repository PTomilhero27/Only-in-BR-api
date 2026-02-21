/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SetFairMapTemplateDto } from './dto/set-fair-map-template.dto';
import { LinkBoothSlotDto } from './dto/link-booth-slot.dto';
import { MapElementType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FairMapAvailableStallFairDto } from './dto/fair-map-available-stall-fair.dto';

/**
 * FairMapsService
 *
 * Responsável por gerenciar a instância do mapa por feira:
 * - qual template está vinculado à feira
 * - quais slots (BOOTH_SLOT) estão vinculados a quais StallFair
 *
 * Decisão importante:
 * - O template guarda o desenho (elementos).
 * - A feira guarda somente o vínculo (slotClientKey -> stallFairId).
 */
@Injectable()
export class FairMapsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureFairExists(fairId: string) {
    const fair = await this.prisma.fair.findUnique({ where: { id: fairId } });
    if (!fair) throw new NotFoundException('Feira não encontrada.');
    return fair;
  }

  private async ensureTemplateExists(templateId: string) {
    const tpl = await this.prisma.mapTemplate.findUnique({
      where: { id: templateId },
      include: { elements: true },
    });
    if (!tpl) throw new NotFoundException('Planta (template) não encontrada.');
    return tpl;
  }

  /**
   * Vincula (ou troca) o template usado pela feira.
   *
   * Estratégia:
   * - Upsert de FairMap por fairId.
   * - Se trocar template, limpamos links antigos (slotClientKey antigo pode não existir).
   */
  async setTemplate(fairId: string, dto: SetFairMapTemplateDto) {
    await this.ensureFairExists(fairId);
    const tpl = await this.ensureTemplateExists(dto.templateId);

    const existing = await this.prisma.fairMap.findUnique({
      where: { fairId },
      select: { id: true, templateId: true },
    });

    await this.prisma.$transaction(async (tx) => {
      const fm = await tx.fairMap.upsert({
        where: { fairId },
        create: {
          fairId,
          templateId: tpl.id,
          templateVersionAtLink: tpl.version,
        },
        update: {
          templateId: tpl.id,
          templateVersionAtLink: tpl.version,
        },
      });

      if (existing && existing.templateId !== tpl.id) {
        await tx.fairMapBoothLink.deleteMany({ where: { fairMapId: fm.id } });
      }
    });

    return this.getFairMap(fairId);
  }

  /**
   * Retorna o mapa consolidado:
   * - template + elements
   * - links (slotClientKey -> stallFairId)
   *
   * ✅ Agora também retorna um resumo “stallFair” em cada link,
   * para o front renderizar o modal sem precisar de outra API.
   */
  async getFairMap(fairId: string) {
    await this.ensureFairExists(fairId);

    const fairMap = await this.prisma.fairMap.findUnique({
      where: { fairId },
      include: {
        template: { include: { elements: true } },
        links: {
          include: {
            stallFair: {
              include: {
                stall: true,
                ownerFair: { include: { owner: true } },
              },
            },
          },
        },
      },
    });

    if (!fairMap) {
      throw new NotFoundException(
        'Esta feira ainda não possui uma planta vinculada. Use PUT /fairs/:fairId/map.',
      );
    }

    return {
      fairId,
      fairMapId: fairMap.id,
      template: {
        id: fairMap.template.id,
        title: fairMap.template.title,
        backgroundUrl: fairMap.template.backgroundUrl,
        worldWidth: fairMap.template.worldWidth,
        worldHeight: fairMap.template.worldHeight,
        version: fairMap.template.version,
        elements: fairMap.template.elements.map((el) => ({
          clientKey: el.clientKey,
          type: el.type,
          x: el.x,
          y: el.y,
          rotation: el.rotation,
          width: el.width,
          height: el.height,
          label: el.label,
          number: el.number,
          points: el.points,
          radius: el.radius,
          style: el.style,
          isLinkable: el.isLinkable,
        })),
      },
      links: fairMap.links.map((l) => ({
        slotClientKey: l.slotClientKey,
        stallFairId: l.stallFairId,
        stallFair: {
          id: l.stallFair.id,
          stallPdvName: l.stallFair.stall.pdvName,
          stallSize: l.stallFair.stall.stallSize,
          ownerName: l.stallFair.ownerFair.owner.fullName ?? '—',
          ownerPhone: l.stallFair.ownerFair.owner.phone ?? null,
        },
      })),
    };
  }

  /**
   * Lista StallFairs “disponíveis” para vínculo no mapa:
   * - pertencem à feira
   * - e ainda NÃO estão vinculadas a nenhum slot (FairMapBoothLink)
   */
  async listAvailableStallFairs(
    fairId: string,
  ): Promise<FairMapAvailableStallFairDto[]> {
    await this.ensureFairExists(fairId);

    const fairMap = await this.prisma.fairMap.findUnique({
      where: { fairId },
      select: { id: true },
    });

    if (!fairMap) {
      throw new NotFoundException(
        'Esta feira ainda não possui uma planta vinculada.',
      );
    }

    const alreadyLinked = await this.prisma.fairMapBoothLink.findMany({
      where: { fairMapId: fairMap.id },
      select: { stallFairId: true },
    });

    const linkedIds = new Set(alreadyLinked.map((x) => x.stallFairId));

    const stallFairs = await this.prisma.stallFair.findMany({
      where: { fairId },
      include: {
        stall: true,
        ownerFair: { include: { owner: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return stallFairs
      .filter((sf) => !linkedIds.has(sf.id))
      .map((sf) => ({
        id: sf.id,
        stallPdvName: sf.stall.pdvName,
        stallSize: sf.stall.stallSize,
        ownerName: sf.ownerFair.owner.fullName ?? '—',
        ownerPhone: sf.ownerFair.owner.phone ?? null,
      }));
  }

  /**
   * Vincula/desvincula um slot BOOTH_SLOT a uma StallFair.
   *
   * Regras:
   * - O slot precisa existir no template atual e ser BOOTH_SLOT com isLinkable=true.
   * - A StallFair precisa pertencer à mesma feira (stallFair.fairId === fairId).
   * - `@@unique([fairMapId, stallFairId])` impede a mesma barraca em 2 slots.
   */
  async linkSlot(fairId: string, slotClientKey: string, dto: LinkBoothSlotDto) {
    await this.ensureFairExists(fairId);

    const fairMap = await this.prisma.fairMap.findUnique({
      where: { fairId },
      include: { template: { include: { elements: true } } },
    });

    if (!fairMap) {
      throw new NotFoundException(
        'Esta feira ainda não possui uma planta vinculada.',
      );
    }

    const slot = fairMap.template.elements.find(
      (e) => e.clientKey === slotClientKey,
    );

    if (!slot) {
      throw new BadRequestException('Slot não existe neste template.');
    }

    if (slot.type !== MapElementType.BOOTH_SLOT || !slot.isLinkable) {
      throw new BadRequestException(
        'Este elemento não é um slot de barraca linkável.',
      );
    }

    const stallFairId = dto.stallFairId ?? null;

    // Remover vínculo
    if (!stallFairId) {
      await this.prisma.fairMapBoothLink.deleteMany({
        where: { fairMapId: fairMap.id, slotClientKey },
      });
      return this.getFairMap(fairId);
    }

    // ✅ Validação forte: StallFair pertence à feira
    const stallFair = await this.prisma.stallFair.findUnique({
      where: { id: stallFairId },
      select: { id: true, fairId: true },
    });

    if (!stallFair) throw new BadRequestException('StallFair inválida.');
    if (stallFair.fairId !== fairId) {
      throw new BadRequestException('Esta barraca não pertence a esta feira.');
    }

    // Upsert do vínculo por slot
    await this.prisma.fairMapBoothLink.upsert({
      where: {
        fairMapId_slotClientKey: { fairMapId: fairMap.id, slotClientKey },
      },
      create: {
        fairMapId: fairMap.id,
        slotClientKey,
        stallFairId,
      },
      update: {
        stallFairId,
      },
    });

    return this.getFairMap(fairId);
  }
}
