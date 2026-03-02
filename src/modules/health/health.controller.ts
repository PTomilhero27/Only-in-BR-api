import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOkResponse({
    description: 'Healthcheck da API com ping no banco',
    schema: {
      example: {
        status: 'ok',
        uptimeSeconds: 123,
        db: 'ok',
        responseMs: 12,
        timestamp: '2026-01-30T23:59:59.000Z',
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'API no ar, mas banco indisponivel',
    schema: {
      example: {
        status: 'degraded',
        uptimeSeconds: 123,
        db: 'down',
        responseMs: 18,
        timestamp: '2026-01-30T23:59:59.000Z',
      },
    },
  })
  async health() {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const elapsedMs = Date.now() - startedAt;

      return {
        status: 'ok',
        uptimeSeconds: Math.floor(process.uptime()),
        db: 'ok',
        responseMs: elapsedMs,
        timestamp: new Date().toISOString(),
      };
    } catch {
      const elapsedMs = Date.now() - startedAt;

      throw new ServiceUnavailableException({
        status: 'degraded',
        uptimeSeconds: Math.floor(process.uptime()),
        db: 'down',
        responseMs: elapsedMs,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
