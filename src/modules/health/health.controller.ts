/**
 * HealthController
 * ---------------------------------------------------------
 * Este controller expõe endpoints simples de healthcheck.
 *
 * Importante:
 * - Deve ser público (sem JWT), pois o Railway/monitoramento não envia token.
 * - Retorna informações mínimas para diagnóstico rápido.
 */
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna 200 se a API está de pé.
   * Também testa conexão com o banco via `SELECT 1`.
   */
  @Public()
  @Get()
  @ApiOkResponse({
    description: 'Healthcheck da API (inclui ping no banco)',
    schema: {
      example: {
        status: 'ok',
        uptimeSeconds: 123,
        db: 'ok',
        timestamp: '2026-01-30T23:59:59.000Z',
      },
    },
  })
  async health() {
    const startedAt = Date.now();

    try {
      // Ping rápido no banco (não depende de nenhuma tabela específica)
      await this.prisma.$queryRaw`SELECT 1`;
      const elapsedMs = Date.now() - startedAt;

      return {
        status: 'ok',
        uptimeSeconds: Math.floor(process.uptime()),
        db: 'ok',
        responseMs: elapsedMs,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      const elapsedMs = Date.now() - startedAt;

      // Mantemos 200? Eu recomendo retornar 200 com db=down ou retornar 503.
      // Para healthcheck de deploy, geralmente 503 é melhor para sinalizar problema real.
      return {
        status: 'degraded',
        uptimeSeconds: Math.floor(process.uptime()),
        db: 'down',
        responseMs: elapsedMs,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
