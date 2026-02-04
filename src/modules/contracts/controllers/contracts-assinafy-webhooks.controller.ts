import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
  Query,
  Logger,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { AssinafyWebhookDto } from '../dto/assinafy/assinafy-webhook.dto';
import { ContractsAssinafyWebhooksService } from '../services/contracts-assinafy-webhooks.service';

@ApiTags('Contracts')
@Controller('contracts/assinafy')
export class ContractsAssinafyWebhooksController {
  private readonly logger = new Logger(ContractsAssinafyWebhooksController.name);

  constructor(private readonly service: ContractsAssinafyWebhooksService) {}

 @Public()
@Post('webhook')
async handleWebhook(
  @Query('token') token: string,
  @Body() payload: any, // ✅ NÃO usar DTO aqui
) {
  const expected = process.env.ASSINAFY_WEBHOOK_TOKEN;

  // ✅ Webhook nunca deve disparar 4xx/5xx (evita retries)
  if (!expected) {
    this.logger.error('[webhook] ASSINAFY_WEBHOOK_TOKEN não configurado');
    return { ok: true, ignored: true, reason: 'missing_env_token' };
  }

  if (!token || token !== expected) {
    this.logger.warn('[webhook] token inválido');
    return { ok: true, ignored: true, reason: 'invalid_token' };
  }

  this.logger.log(
    `[webhook] event=${payload?.event} objectId=${payload?.object?.id} account=${payload?.account_id}`,
  );

  try {
    const result = await this.service.handleEvent(payload);
    return result ?? { ok: true };
  } catch (err: any) {
    this.logger.error(
      `[webhook] ERROR event=${payload?.event} objectId=${payload?.object?.id} msg=${err?.message}`,
      err?.stack,
    );
    return { ok: true, ignored: true, reason: 'internal_error' };
  }
}

}
