/**
 * AuthModule
 * Configura JWT de forma segura via ConfigService:
 * - Falha cedo se JWT_SECRET não existir
 * - Define expiresIn com valor padrão
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../user/user.module';

@Module({
    imports: [
        UsersModule,
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
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy],
})
export class AuthModule { }
