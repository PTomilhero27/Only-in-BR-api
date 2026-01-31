/**
 * UsersService
 * Responsável por queries de usuário no banco via Prisma.
 */
import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    console.log(id)
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: { name: string; email: string; password: string; role?: UserRole }) {
    return this.prisma.user.create({ data });
  }
}
