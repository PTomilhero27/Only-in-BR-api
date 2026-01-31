/**
 * AuthService
 * - valida credenciais
 * - gera access_token
 * - cria usuário com senha hash
 */
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../user/user.service'; 

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwt: JwtService,
  ) {}

async login(email: string, password: string) {
  const user = await this.usersService.findByEmail(email);
  if (!user) {
    throw new UnauthorizedException('Credenciais inválidas.');
  }

  /**
   * 🔐 Regra de negócio:
   * - Usuário sem senha ainda NÃO pode logar
   * - Isso indica conta não ativada/liberada
   */
  if (!user.password) {
    throw new UnauthorizedException(
      'Acesso ainda não liberado. Aguarde a aprovação.'
    );
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    throw new UnauthorizedException('Credenciais inválidas.');
  }

  const access_token = await this.jwt.signAsync({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    access_token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}


  async register(name: string, email: string, password: string) {
    const exists = await this.usersService.findByEmail(email);
    if (exists) throw new ConflictException('E-mail já cadastrado.');

    const hashed = await bcrypt.hash(password, 10);
    const user = await this.usersService.create({ name, email, password: hashed });

    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
}
