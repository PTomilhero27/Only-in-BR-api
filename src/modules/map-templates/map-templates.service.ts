/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { MapElementType, Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { UpdateMapTemplateDto } from "./dto/update-map-template.dto";
import { CreateMapTemplateDto } from "./dto/create-map-template.dto";

/**
 * MapTemplatesService
 *
 * Regras principais:
 * - validação por tipo (LINE/TREE/CIRCLE/RECT/SQUARE/BOOTH_SLOT)
 * - REPLACE de elements no update
 */
@Injectable()
export class MapTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  private toInputJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === null || value === undefined) return undefined;
    return value as Prisma.InputJsonValue;
  }

  /**
   * ✅ IMPORTANTE:
   * O tipo correto aqui é o DTO de INPUT (CreateMapTemplateDto["elements"]),
   * e NÃO um DTO de response.
   */
  private validateElements(elements: CreateMapTemplateDto["elements"]) {
    const seen = new Set<string>();

    for (const el of elements) {
      if (seen.has(el.clientKey)) {
        throw new BadRequestException(`clientKey duplicado: ${el.clientKey}`);
      }
      seen.add(el.clientKey);

      if (el.type === MapElementType.LINE) {
        if (!el.points || el.points.length < 4 || el.points.length % 2 !== 0) {
          throw new BadRequestException(
            `Elemento LINE (${el.clientKey}) precisa de points com tamanho par e >= 4.`,
          );
        }
      }

      if (el.type === MapElementType.TREE) {
        if (typeof el.radius !== "number" || el.radius <= 0) {
          throw new BadRequestException(
            `Elemento TREE (${el.clientKey}) precisa de radius > 0.`,
          );
        }
      }

      // ✅ NOVO: CIRCLE
      if (el.type === MapElementType.CIRCLE) {
        if (typeof el.radius !== "number" || el.radius <= 0) {
          throw new BadRequestException(
            `Elemento CIRCLE (${el.clientKey}) precisa de radius > 0.`,
          );
        }
      }

      if (
        el.type === MapElementType.RECT ||
        el.type === MapElementType.SQUARE ||
        el.type === MapElementType.BOOTH_SLOT
      ) {
        if (typeof el.width !== "number" || typeof el.height !== "number") {
          throw new BadRequestException(
            `Elemento ${el.type} (${el.clientKey}) precisa de width e height.`,
          );
        }
        if (el.width <= 0 || el.height <= 0) {
          throw new BadRequestException(
            `Elemento ${el.type} (${el.clientKey}) precisa de width/height > 0.`,
          );
        }
      }

      if (el.isLinkable && el.type !== MapElementType.BOOTH_SLOT) {
        throw new BadRequestException(
          `Somente BOOTH_SLOT pode ser isLinkable=true (clientKey=${el.clientKey}).`,
        );
      }
    }
  }

  async create(dto: CreateMapTemplateDto) {
    this.validateElements(dto.elements);

    const created = await this.prisma.$transaction(async (tx) => {
      const tpl = await tx.mapTemplate.create({
        data: {
          title: dto.title,
          description: dto.description ?? null,
          backgroundUrl: dto.backgroundUrl ?? null,
          worldWidth: dto.worldWidth ?? 2000,
          worldHeight: dto.worldHeight ?? 1200,
        },
      });

      if (dto.elements.length) {
        const data: Prisma.MapTemplateElementCreateManyInput[] = dto.elements.map((el) => ({
          templateId: tpl.id,
          clientKey: el.clientKey,
          type: el.type,
          x: el.x,
          y: el.y,
          rotation: el.rotation ?? 0,

          width: el.width ?? null,
          height: el.height ?? null,

          label: el.label ?? null,
          number: el.number ?? null,

          radius: el.radius ?? null,

          points: this.toInputJson(el.points),
          style: this.toInputJson(el.style)!,

          isLinkable: el.type === MapElementType.BOOTH_SLOT ? !!el.isLinkable : false,
        }));

        await tx.mapTemplateElement.createMany({ data });
      }

      return tx.mapTemplate.findUnique({
        where: { id: tpl.id },
        include: { elements: true },
      });
    });

    return created;
  }

  async list() {
    return this.prisma.mapTemplate.findMany({
      orderBy: { updatedAt: "desc" },
      include: { elements: true },
    });
  }

  async getById(id: string) {
    const tpl = await this.prisma.mapTemplate.findUnique({
      where: { id },
      include: { elements: true },
    });

    if (!tpl) throw new NotFoundException("Planta não encontrada.");
    return tpl;
  }

  async update(id: string, dto: UpdateMapTemplateDto) {
    await this.getById(id);

    if (dto.elements) {
      this.validateElements(dto.elements);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.elements) {
        await tx.mapTemplateElement.deleteMany({ where: { templateId: id } });

        if (dto.elements.length) {
          const data: Prisma.MapTemplateElementCreateManyInput[] = dto.elements.map((el) => ({
            templateId: id,
            clientKey: el.clientKey,
            type: el.type,
            x: el.x,
            y: el.y,
            rotation: el.rotation ?? 0,

            width: el.width ?? null,
            height: el.height ?? null,

            label: el.label ?? null,
            number: el.number ?? null,

            radius: el.radius ?? null,

            points: this.toInputJson(el.points),
            style: this.toInputJson(el.style)!,

            isLinkable: el.type === MapElementType.BOOTH_SLOT ? !!el.isLinkable : false,
          }));

          await tx.mapTemplateElement.createMany({ data });
        }
      }

      const tpl = await tx.mapTemplate.update({
        where: { id },
        data: {
          title: dto.title ?? undefined,
          description: dto.description ?? undefined,
          backgroundUrl: dto.backgroundUrl ?? undefined,
          worldWidth: dto.worldWidth ?? undefined,
          worldHeight: dto.worldHeight ?? undefined,
          version: dto.elements ? { increment: 1 } : undefined,
        },
      });

      return tx.mapTemplate.findUnique({
        where: { id: tpl.id },
        include: { elements: true },
      });
    });

    return updated;
  }

  async delete(id: string) {
    await this.getById(id);
    await this.prisma.mapTemplate.delete({ where: { id } });
    return { ok: true };
  }
}