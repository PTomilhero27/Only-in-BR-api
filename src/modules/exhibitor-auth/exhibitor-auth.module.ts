import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

import { ExhibitorAuthController } from './exhibitor-auth.controller'
import { ExhibitorAuthService } from './exhibitor-auth.service'
import { PrismaModule } from 'src/prisma/prisma.module'
import { ConfigService } from '@nestjs/config'

/**
 * Módulo de autenticação do expositor.
 *
 * Decisão:
 * - Usa JwtModule para emitir accessToken no login.
 * - As rotas validate-token/set-password continuam públicas.
 */
@Module({
  imports: [
    PrismaModule,
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const secret = config.get<string>('JWT_SECRET'); 
                if (!secret) throw new Error('JWT_SECRET não definido no .env');

                const expiresIn = (config.get<string>('JWT_EXPIRES_IN') ?? '1d') as any;

                return {
                    secret,
                    signOptions: { expiresIn },
                };
            },
        }),
    ],
  controllers: [ExhibitorAuthController],
  providers: [ExhibitorAuthService],
})
export class ExhibitorAuthModule {}
