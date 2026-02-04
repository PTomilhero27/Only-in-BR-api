import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from 'src/prisma/prisma.service';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ====== já existiam ======

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: { name: string; email: string; password: string; role?: UserRole }) {
    return this.prisma.user.create({ data });
  }

  // ====== novos (Admin) ======

  /**
   * Lista usuários do painel (role != EXHIBITOR).
   */
  async listNonExhibitors(dto: ListUsersDto) {
    const page = Number(dto.page ?? 1);
    const pageSize = Number(dto.pageSize ?? 20);
    const search = (dto.search ?? '').trim();

    const isActive =
      dto.isActive === undefined
        ? undefined
        : dto.isActive === 'true'
          ? true
          : dto.isActive === 'false'
            ? false
            : undefined;

    if (dto.isActive !== undefined && isActive === undefined) {
      throw new BadRequestException('isActive deve ser "true" ou "false".');
    }

    const where: Prisma.UserWhereInput = {
      role: { not: UserRole.EXHIBITOR },
      ...(isActive === undefined ? {} : { isActive }),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          passwordSetAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return { items, page, pageSize, total };
  }

  /**
   * Detalhe (para edição).
   */
  async getDetail(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        passwordSetAt: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!u) throw new NotFoundException('Usuário não encontrado.');
    return u;
  }

  /**
   * Atualiza usuário do painel (não permite editar EXHIBITOR aqui).
   * Inclui troca de senha (opcional).
   */
  async updateNonExhibitor(id: string, dto: UpdateUserDto, actorUserId: string) {
    const before = await this.prisma.user.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Usuário não encontrado.');

    if (before.role === UserRole.EXHIBITOR) {
      throw new BadRequestException('Usuário EXHIBITOR não pode ser editado por este endpoint.');
    }

    if (dto.role === UserRole.EXHIBITOR) {
      throw new BadRequestException('Role EXHIBITOR deve ser gerenciada pelo fluxo do portal/expositor.');
    }

    if (dto.email && dto.email !== before.email) {
      const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (exists) throw new ConflictException('E-mail já cadastrado.');
    }

    const data: Prisma.UserUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.role !== undefined ? { role: dto.role } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };

    if (dto.password) {
      const hashed = await bcrypt.hash(dto.password, 10);
      data.password = hashed;
      data.passwordSetAt = new Date();
    }

    const after = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        passwordSetAt: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // ✅ auditoria simples (se você tiver service, depois a gente refatora)
    await this.prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'USER',
        entityId: id,
        actorUserId,
        before: before as any,
        after: after as any,
      },
    });

    return after;
  }
}
