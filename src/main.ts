import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

/**
 * Converte uma string de CORS_ORIGINS (CSV) em array de origins.
 * Ex.: "http://localhost:3000,https://admin.onlyinbr.com.br"
 */
function parseCorsOrigins(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Decide a lista de origins permitidas para CORS.
 * - Preferência total: variável CORS_ORIGINS
 * - Fallback dev: localhost (admin e expositor)
 * - Em produção, se não houver CORS_ORIGINS, retorna lista vazia (mais seguro)
 */
function getCorsOrigins(): string[] {
  const fromEnv = parseCorsOrigins(process.env.CORS_ORIGINS);
  if (fromEnv.length > 0) return fromEnv;

  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv !== 'production') {
    return ['http://localhost:3000', 'http://localhost:3002'];
  }

  return [];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ Validação global (padrão profissional)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  /**
   * ✅ CORS
   * - Em produção, configure CORS_ORIGINS com os domínios permitidos (sem path).
   * - Exemplos:
   *   - https://expositor.onlyinbr.com.br
   *   - https://admin.onlyinbr.com.br
   */
  const corsOrigins = getCorsOrigins();

  app.enableCors({
    origin: (origin, callback) => {
      // Caso de chamadas sem Origin (ex.: curl, health checks, server-to-server)
      if (!origin) return callback(null, true);

      // Se a lista estiver vazia em produção, bloqueia por segurança
      if (corsOrigins.length === 0)
        return callback(new Error('CORS: origem não permitida'), false);

      // Libera se o origin está na allowlist
      if (corsOrigins.includes(origin)) return callback(null, true);

      return callback(
        new Error(`CORS: origem não permitida: ${origin}`),
        false,
      );
    },
    credentials: true,
  });

  // ✅ Swagger
  const config = new DocumentBuilder()
    .setTitle('Feira Gastronômica API')
    .setDescription('API do sistema da feira gastronômica')
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);

  const baseUrl = `http://localhost:${port}`;
  console.log(`✅ API rodando em: ${baseUrl}`);
  console.log(`📚 Swagger em: ${baseUrl}/docs`);
  console.log(`🩺 Health em: ${baseUrl}/health`);
  console.log(
    `🌐 CORS origins permitidos: ${corsOrigins.length ? corsOrigins.join(', ') : '(nenhum)'} `,
  );
}

bootstrap();
