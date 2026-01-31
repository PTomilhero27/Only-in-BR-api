// src/modules/stalls/stalls.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { StallSize, StallType } from '@prisma/client'

import { UpsertStallDto } from './dto/upsert-stall.dto'
import { ListStallsResponseDto } from './dto/list-stalls-response.dto'
import { StallListItemDto } from './dto/stall-list-item.dto'

/**
 * Service autenticado de Barracas (portal).
 *
 * Responsabilidade:
 * - CRUD de barracas do expositor autenticado
 *
 * Decisão:
 * - Barraca pertence ao Owner (via User.ownerId).
 * - O service resolve ownerId a partir do userId do JWT, evitando bug de "id errado".
 * - Não mexe em vínculo com feira aqui (StallFair é outro caso de uso).
 */
@Injectable()
export class StallsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca e valida o ownerId a partir do userId do token.
   * Mantém a regra de autorização concentrada no backend.
   */
  private async getOwnerIdOrThrow(userId: string): Promise<string> {
    if (!userId) throw new BadRequestException('userId ausente no token.')

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, ownerId: true, isActive: true },
    })

    if (!user || !user.isActive) {
      throw new NotFoundException('Usuário não encontrado ou inativo.')
    }

    if (!user.ownerId) {
      throw new BadRequestException('Este usuário não está vinculado a um expositor (ownerId).')
    }

    return user.ownerId
  }

  /**
   * Regra do produto:
   * - Se stallType=TRAILER => stallSize deve ser TRAILER também.
   */
  private resolveStallSize(stallType: StallType, stallSize: StallSize): StallSize {
    if (stallType === StallType.TRAILER) return StallSize.TRAILER
    return stallSize
  }

  /** Normaliza o nome do PDV para evitar duplicidade por variação de caixa/espaço */
  private normalizePdvName(value: string): string {
    return (value ?? '').trim().toLowerCase()
  }

  /**
   * Lista barracas do Owner autenticado.
   */
  async listByMe(userId: string, page = 1, pageSize = 20): Promise<ListStallsResponseDto> {
    const ownerId = await this.getOwnerIdOrThrow(userId)

    const safePage = Math.max(1, Number(page) || 1)
    const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 20))

    const skip = (safePage - 1) * safePageSize
    const take = safePageSize

    const [totalItems, rows] = await Promise.all([
      this.prisma.stall.count({ where: { ownerId } }),
      this.prisma.stall.findMany({
        where: { ownerId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          pdvName: true,
          machinesQty: true,
          bannerName: true,
          mainCategory: true,
          stallType: true,
          stallSize: true,
          teamQty: true,
          createdAt: true,
          updatedAt: true,

          powerNeed: true,
          equipments: { orderBy: { id: 'asc' } },

          menuCategories: {
            orderBy: [{ order: 'asc' }, { id: 'asc' }],
            include: {
              products: { orderBy: [{ order: 'asc' }, { id: 'asc' }] },
            },
          },
        },
      }),
    ])

    const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize))

    const items: StallListItemDto[] = rows.map((s) => ({
      id: s.id,
      pdvName: s.pdvName,
      machinesQty: s.machinesQty,
      bannerName: s.bannerName ?? null,
      mainCategory: s.mainCategory ?? null,
      stallType: s.stallType as StallType,
      stallSize: s.stallSize as StallSize,
      teamQty: s.teamQty,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),

      powerNeed: s.powerNeed
        ? {
            outlets110: s.powerNeed.outlets110,
            outlets220: s.powerNeed.outlets220,
            outletsOther: s.powerNeed.outletsOther,
            needsGas: s.powerNeed.needsGas,
            gasNotes: s.powerNeed.gasNotes ?? null,
            notes: s.powerNeed.notes ?? null,
          }
        : null,

      equipments: (s.equipments ?? []).map((e) => ({
        id: e.id,
        name: e.name,
        qty: e.qty,
      })),

      categories: (s.menuCategories ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        order: c.order,
        products: (c.products ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          priceCents: p.priceCents,
          order: p.order,
        })),
      })),
    }))

    return {
      items,
      meta: {
        page: safePage,
        pageSize: safePageSize,
        totalItems,
        totalPages,
      },
    }
  }

  /**
   * Cria uma barraca completa para o Owner do usuário logado.
   */
  async createByMe(userId: string, dto: UpsertStallDto) {
    const ownerId = await this.getOwnerIdOrThrow(userId)

    const pdvNameNormalized = this.normalizePdvName(dto.pdvName)

    const duplicated = await this.prisma.stall.findUnique({
      where: { ownerId_pdvNameNormalized: { ownerId, pdvNameNormalized } },
      select: { id: true },
    })
    if (duplicated) throw new ConflictException('Você já possui uma barraca com esse nome.')

    const stallType: StallType = dto.stallType
    const stallSize: StallSize = this.resolveStallSize(stallType, dto.stallSize)

    const equipments = dto.equipments ?? []
    const categories = dto.categories ?? []

    const created = await this.prisma.$transaction(async (tx) => {
      const stall = await tx.stall.create({
        data: {
          ownerId,
          pdvName: dto.pdvName,
          pdvNameNormalized,
          machinesQty: dto.machinesQty ?? 0,
          bannerName: dto.bannerName ?? null,
          mainCategory: dto.mainCategory ?? null,
          stallType,
          stallSize,
          teamQty: dto.teamQty ?? 1,

          powerNeed: dto.power
            ? {
                create: {
                  outlets110: dto.power.outlets110 ?? 0,
                  outlets220: dto.power.outlets220 ?? 0,
                  outletsOther: dto.power.outletsOther ?? 0,
                  needsGas: dto.power.needsGas ?? false,
                  gasNotes: dto.power.gasNotes ?? null,
                  notes: dto.power.notes ?? null,
                },
              }
            : undefined,

          equipments: equipments.length
            ? { create: equipments.map((e) => ({ name: e.name, qty: e.qty })) }
            : undefined,

          menuCategories: categories.length
            ? {
                create: categories.map((c, idx) => ({
                  name: c.name,
                  order: Number.isFinite(c.order) ? c.order : idx,
                  products: {
                    create: (c.products ?? []).map((p, pIdx) => ({
                      name: p.name,
                      priceCents: p.priceCents,
                      order: Number.isFinite(p.order) ? p.order : pIdx,
                    })),
                  },
                })),
              }
            : undefined,
        },
        select: { id: true },
      })

      return stall
    })

    return { stallId: created.id }
  }

  /**
   * Atualiza uma barraca do Owner do usuário logado.
   */
  async updateByMe(userId: string, stallId: string, dto: UpsertStallDto) {
    const ownerId = await this.getOwnerIdOrThrow(userId)

    const current = await this.prisma.stall.findFirst({
      where: { id: stallId, ownerId },
      select: { id: true },
    })
    if (!current) throw new NotFoundException('Barraca não encontrada.')

    const pdvNameNormalized = this.normalizePdvName(dto.pdvName)

    const duplicated = await this.prisma.stall.findFirst({
      where: { ownerId, pdvNameNormalized, id: { not: stallId } },
      select: { id: true },
    })
    if (duplicated) throw new ConflictException('Você já possui outra barraca com esse nome.')

    const stallType: StallType = dto.stallType
    const stallSize: StallSize = this.resolveStallSize(stallType, dto.stallSize)

    const equipments = dto.equipments ?? []
    const categories = dto.categories ?? []
    const power = dto.power

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.stall.update({
        where: { id: stallId },
        data: {
          pdvName: dto.pdvName,
          pdvNameNormalized,
          machinesQty: dto.machinesQty ?? 0,
          bannerName: dto.bannerName ?? null,
          mainCategory: dto.mainCategory ?? null,
          stallType,
          stallSize,
          teamQty: dto.teamQty ?? 1,
        },
      })

      await tx.stallMenuProduct.deleteMany({ where: { category: { stallId } } })
      await tx.stallMenuCategory.deleteMany({ where: { stallId } })
      await tx.stallEquipment.deleteMany({ where: { stallId } })
      await tx.stallPowerNeed.deleteMany({ where: { stallId } })

      if (power) {
        await tx.stallPowerNeed.create({
          data: {
            stallId,
            outlets110: power.outlets110 ?? 0,
            outlets220: power.outlets220 ?? 0,
            outletsOther: power.outletsOther ?? 0,
            needsGas: power.needsGas ?? false,
            gasNotes: power.gasNotes ?? null,
            notes: power.notes ?? null,
          },
        })
      }

      if (equipments.length) {
        await tx.stallEquipment.createMany({
          data: equipments.map((e) => ({ stallId, name: e.name, qty: e.qty })),
        })
      }

      for (let i = 0; i < categories.length; i++) {
        const c = categories[i]
        const catOrder = Number.isFinite(c.order) ? c.order : i

        const category = await tx.stallMenuCategory.create({
          data: { stallId, name: c.name, order: catOrder },
          select: { id: true },
        })

        const products = c.products ?? []
        if (products.length) {
          await tx.stallMenuProduct.createMany({
            data: products.map((p, pIdx) => ({
              categoryId: category.id,
              name: p.name,
              priceCents: p.priceCents,
              order: Number.isFinite(p.order) ? p.order : pIdx,
            })),
          })
        }
      }

      return tx.stall.findUnique({ where: { id: stallId }, select: { id: true } })
    })

    return { stallId: updated!.id }
  }

  /**
   * Remove uma barraca do Owner do usuário logado.
   */
  async removeByMe(userId: string, stallId: string) {
    const ownerId = await this.getOwnerIdOrThrow(userId)

    const current = await this.prisma.stall.findFirst({
      where: { id: stallId, ownerId },
      select: { id: true },
    })
    if (!current) throw new NotFoundException('Barraca não encontrada.')

    await this.prisma.$transaction(async (tx) => {
      await tx.stallMenuProduct.deleteMany({ where: { category: { stallId } } })
      await tx.stallMenuCategory.deleteMany({ where: { stallId } })
      await tx.stallEquipment.deleteMany({ where: { stallId } })
      await tx.stallPowerNeed.deleteMany({ where: { stallId } })
      await tx.stallFair.deleteMany({ where: { stallId } })
      await tx.stall.delete({ where: { id: stallId } })
    })

    return { ok: true }
  }
}
