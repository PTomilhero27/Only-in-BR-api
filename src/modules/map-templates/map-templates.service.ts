/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { MapElementType, Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateMapTemplateDto } from "./dto/create-map-template.dto";
import { UpdateMapTemplateDto } from "./dto/update-map-template.dto";

/**
 * MapTemplatesService
 *
 * Este service centraliza a regra de negócio das Plantas (templates reutilizáveis).
 *
 * Objetivos:
 * - Garantir que elementos salvos estejam consistentes por tipo (LINE, TREE, BOOTH_SLOT etc.)
 * - Evitar contratos implícitos: DTOs + validações claras
 * - Persistir os elementos de forma eficiente (createMany)
 *
 * Nota técnica importante (Prisma + JSON):
 * - Em createMany, o Prisma costuma exigir Prisma.InputJsonValue (e não JsonValue).
 * - Também é mais seguro usar `undefined` quando o JSON opcional não existe (ex.: points).
 */
@Injectable()
export class MapTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper: converte um valor JS comum para InputJsonValue (quando existir).
   * - Retornamos undefined quando valor é null/undefined para não "setar" o campo.
   * - Isso evita conflito de typing com campos Json? em createMany.
   */
  private toInputJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === null || value === undefined) return undefined;
    return value as Prisma.InputJsonValue;
  }

  /**
   * Valida coerência mínima dos elementos para evitar salvar estruturas inválidas.
   * Mantemos validações objetivas e baratas, suficientes para estabilidade do dado.
   */
  private validateElements(elements: CreateMapTemplateDto["elements"]) {
    const seen = new Set<string>();

    for (const el of elements) {
      if (seen.has(el.clientKey)) {
        throw new BadRequestException(`clientKey duplicado: ${el.clientKey}`);
      }
      seen.add(el.clientKey);

      // Regras por tipo
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

      // Linkável: somente BOOTH_SLOT
      if (el.isLinkable && el.type !== MapElementType.BOOTH_SLOT) {
        throw new BadRequestException(
          `Somente BOOTH_SLOT pode ser isLinkable=true (clientKey=${el.clientKey}).`,
        );
      }
    }
  }

  /**
   * Cria um novo template e persiste os elementos em lote (createMany).
   * Fazemos transaction para garantir consistência.
   */
  async create(dto: CreateMapTemplateDto) {
    this.validateElements(dto.elements);

    const created = await this.prisma.$transaction(async (tx) => {
      // 1) cria o template
      const tpl = await tx.mapTemplate.create({
        data: {
          title: dto.title,
          description: dto.description ?? null,
          backgroundUrl: dto.backgroundUrl ?? null,
          worldWidth: dto.worldWidth ?? 2000,
          worldHeight: dto.worldHeight ?? 1200,
        },
      });

      // 2) cria elementos em lote (se houver)
      if (dto.elements.length) {
        /**
         * Tipamos explicitamente o array para o tipo do Prisma.
         * Isso evita “briga” de inferência do TypeScript no createMany.
         */
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

          // ✅ JSON: InputJsonValue + undefined quando não existir
          points: this.toInputJson(el.points),
          style: this.toInputJson(el.style)!, // style é obrigatório no DTO

          isLinkable: el.type === MapElementType.BOOTH_SLOT ? !!el.isLinkable : false,
        }));

        await tx.mapTemplateElement.createMany({ data });
      }

      // 3) retorna com include de elements
      return tx.mapTemplate.findUnique({
        where: { id: tpl.id },
        include: { elements: true },
      });
    });

    return created;
  }

  /**
   * Lista templates (ordenado por updatedAt desc).
   */
  async list() {
    return this.prisma.mapTemplate.findMany({
      orderBy: { updatedAt: "desc" },
      include: { elements: true },
    });
  }

  /**
   * Retorna um template por id.
   */
  async getById(id: string) {
    const tpl = await this.prisma.mapTemplate.findUnique({
      where: { id },
      include: { elements: true },
    });

    if (!tpl) throw new NotFoundException("Planta não encontrada.");
    return tpl;
  }

  /**
   * Atualiza template.
   *
   * Estratégia:
   * - Se vier `elements`, fazemos REPLACE (apaga e recria) e incrementa version.
   * - Isso simplifica o fluxo do editor no front e evita merges complexos agora.
   */
  async update(id: string, dto: UpdateMapTemplateDto) {
    await this.getById(id);

    if (dto.elements) {
      this.validateElements(dto.elements);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Se for replace de elements: remove tudo e recria
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

            // ✅ JSON: InputJsonValue + undefined quando não existir
            points: this.toInputJson(el.points),
            style: this.toInputJson(el.style)!,

            isLinkable: el.type === MapElementType.BOOTH_SLOT ? !!el.isLinkable : false,
          }));

          await tx.mapTemplateElement.createMany({ data });
        }
      }

      // Atualiza campos do template
      const tpl = await tx.mapTemplate.update({
        where: { id },
        data: {
          title: dto.title ?? undefined,
          description: dto.description ?? undefined,
          backgroundUrl: dto.backgroundUrl ?? undefined,
          worldWidth: dto.worldWidth ?? undefined,
          worldHeight: dto.worldHeight ?? undefined,

          // Incrementa version apenas quando houve replace de elements
          version: dto.elements ? { increment: 1 } : undefined,
        },
      });

      // Retorna com include
      return tx.mapTemplate.findUnique({
        where: { id: tpl.id },
        include: { elements: true },
      });
    });

    return updated;
  }

  /**
   * Exclui template.
   *
   * Observação:
   * - Futuro: impedir delete se estiver em uso por FairMap (quando criarmos fair-maps).
   */
  async delete(id: string) {
    await this.getById(id);

    await this.prisma.mapTemplate.delete({ where: { id } });
    return { ok: true };
  }
}
