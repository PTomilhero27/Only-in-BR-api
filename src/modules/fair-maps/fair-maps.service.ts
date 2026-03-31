import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SetFairMapTemplateDto } from './dto/set-fair-map-template.dto';
import { LinkBoothSlotDto } from './dto/link-booth-slot.dto';
import { FairStatus, MapElementType } from '@prisma/client';
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
 *
 * Ajuste importante desta versão:
 * - Sempre sincronizamos os links com os slots realmente existentes
 *   no template atual.
 * - Isso evita sobras quando um slot é removido, recriado ou deixa de
 *   ser linkável no editor da planta.
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

    if (!tpl) {
      throw new NotFoundException('Planta (template) não encontrada.');
    }

    return tpl;
  }

  /**
   * Remove vínculos inválidos para o template atual da feira.
   *
   * Casos limpos aqui:
   * - slotClientKey não existe mais no template
   * - elemento existe, mas não é BOOTH_SLOT
   * - elemento existe, mas não é linkável
   * - vínculo aponta para StallFair que não pertence mais à feira
   *
   * Essa limpeza é essencial porque o template pode ser editado depois
   * de já existirem vínculos salvos.
   */
  private async syncInvalidLinksWithCurrentTemplate(fairId: string) {
    const fairMap = await this.prisma.fairMap.findUnique({
      where: { fairId },
      include: {
        template: {
          include: {
            elements: true,
          },
        },
        links: {
          include: {
            stallFair: {
              select: {
                id: true,
                fairId: true,
              },
            },
          },
        },
      },
    });

    if (!fairMap) {
      throw new NotFoundException(
        'Esta feira ainda não possui uma planta vinculada.',
      );
    }

    const validSlotKeys = new Set(
      fairMap.template.elements
        .filter(
          (el) =>
            el.type === MapElementType.BOOTH_SLOT && Boolean(el.isLinkable),
        )
        .map((el) => el.clientKey),
    );

    const invalidLinkIds = fairMap.links
      .filter((link) => {
        const slotStillExists = validSlotKeys.has(link.slotClientKey);
        const stallFairBelongsToFair =
          !!link.stallFair && link.stallFair.fairId === fairId;

        return !slotStillExists || !stallFairBelongsToFair;
      })
      .map((link) => link.id);

    if (invalidLinkIds.length > 0) {
      await this.prisma.fairMapBoothLink.deleteMany({
        where: {
          id: {
            in: invalidLinkIds,
          },
        },
      });
    }

    return fairMap.id;
  }

  /**
   * Vincula (ou troca) o template usado pela feira.
   *
   * Estratégia:
   * - Upsert de FairMap por fairId.
   * - Se trocar template, limpamos todos os links antigos.
   * - Mesmo sem trocar template, executamos sincronização ao final,
   *   pois o template pode ter sido editado desde o último vínculo.
   */
  async setTemplate(fairId: string, dto: SetFairMapTemplateDto) {
    const fair = await this.ensureFairExists(fairId);
    if (fair.status === FairStatus.FINALIZADA) {
      throw new BadRequestException(
        'Não é possível alterar a planta de uma feira finalizada.',
      );
    }
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

      /**
       * Se houve troca de template, limpamos tudo porque os slots
       * do template anterior não fazem mais sentido.
       */
      if (existing && existing.templateId !== tpl.id) {
        await tx.fairMapBoothLink.deleteMany({
          where: { fairMapId: fm.id },
        });
      }
    });

    /**
     * Mesmo mantendo o mesmo template, garantimos que os vínculos
     * continuam compatíveis com os slots atuais.
     */
    await this.syncInvalidLinksWithCurrentTemplate(fairId);

    return this.getFairMap(fairId);
  }

  /**
   * Retorna o mapa consolidado:
   * - template + elements
   * - links (slotClientKey -> stallFairId)
   *
   * Também devolve um resumo de StallFair para o modal operacional do front.
   *
   * Ajuste importante:
   * - Antes de retornar, sincronizamos e removemos vínculos inválidos.
   * - Assim o front recebe apenas links que realmente existem no template atual.
   */
  async getFairMap(fairId: string) {
    await this.ensureFairExists(fairId);

    await this.syncInvalidLinksWithCurrentTemplate(fairId);

    const fairMap = await this.prisma.fairMap.findUnique({
      where: { fairId },
      include: {
        template: {
          include: {
            elements: true,
          },
        },
        links: {
          include: {
            stallFair: {
              include: {
                stall: true,
                ownerFair: {
                  include: {
                    owner: true,
                  },
                },
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

    /**
     * Por segurança extra, filtramos novamente em memória os links
     * para garantir que o retorno do front só contenha slots válidos.
     */
    const validSlotKeys = new Set(
      fairMap.template.elements
        .filter(
          (el) =>
            el.type === MapElementType.BOOTH_SLOT && Boolean(el.isLinkable),
        )
        .map((el) => el.clientKey),
    );

    const validLinks = fairMap.links.filter(
      (l) =>
        validSlotKeys.has(l.slotClientKey) && l.stallFair?.fairId === fairId,
    );

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
      links: validLinks.map((l) => ({
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
   * - e ainda NÃO estão vinculadas a nenhum slot válido
   *
   * Ajuste:
   * - sincronizamos os links antes da listagem para não bloquear
   *   barracas por causa de vínculo órfão.
   */
  async listAvailableStallFairs(
    fairId: string,
  ): Promise<FairMapAvailableStallFairDto[]> {
    await this.ensureFairExists(fairId);

    await this.syncInvalidLinksWithCurrentTemplate(fairId);

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
        ownerFair: {
          include: {
            owner: true,
          },
        },
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
   * - A StallFair precisa pertencer à mesma feira.
   * - Se o slot não existir mais, a própria sincronização anterior já limpa o link antigo.
   */
  async linkSlot(fairId: string, slotClientKey: string, dto: LinkBoothSlotDto) {
    const fair = await this.ensureFairExists(fairId);
    if (fair.status === FairStatus.FINALIZADA) {
      throw new BadRequestException(
        'Não é possível alterar os vínculos do mapa de uma feira finalizada.',
      );
    }

    await this.syncInvalidLinksWithCurrentTemplate(fairId);

    const fairMap = await this.prisma.fairMap.findUnique({
      where: { fairId },
      include: {
        template: {
          include: {
            elements: true,
          },
        },
      },
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

    /**
     * Remover vínculo explicitamente.
     */
    if (!stallFairId) {
      await this.prisma.fairMapBoothLink.deleteMany({
        where: {
          fairMapId: fairMap.id,
          slotClientKey,
        },
      });

      return this.getFairMap(fairId);
    }

    /**
     * Validação forte: a barraca precisa existir e pertencer à feira atual.
     */
    const stallFair = await this.prisma.stallFair.findUnique({
      where: { id: stallFairId },
      select: {
        id: true,
        fairId: true,
      },
    });

    if (!stallFair) {
      throw new BadRequestException('StallFair inválida.');
    }

    if (stallFair.fairId !== fairId) {
      throw new BadRequestException('Esta barraca não pertence a esta feira.');
    }

    /**
     * Garantimos 1 slot -> 1 barraca.
     */
    await this.prisma.fairMapBoothLink.upsert({
      where: {
        fairMapId_slotClientKey: {
          fairMapId: fairMap.id,
          slotClientKey,
        },
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
