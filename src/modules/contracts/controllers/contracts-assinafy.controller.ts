import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateAssinafySignUrlDto } from '../dto/assinafy/create-sign-url.dto';
import { CreateAssinafySignUrlResponseDto } from '../dto/assinafy/create-sign-url-response.dto';
import { ContractsAssinafyService } from '../services/contracts-assinafy.service';

@ApiTags('Contracts')
@Controller('contracts/assinafy')
export class ContractsAssinafyController {
  constructor(private readonly assinafy: ContractsAssinafyService) {}

  @Post('sign-url')
  @ApiOperation({
    summary: 'Gera (ou reutiliza) o link de assinatura do contrato na Assinafy',
    description:
      'Pré-requisito: o PDF já deve ter sido enviado ao Storage e salvo em Contract.pdfPath. ' +
      'Este endpoint cria/busca signer, cria documento na Assinafy (se necessário), aguarda processamento e gera signUrl.',
  })
  async createSignUrl(
    @Body() body: CreateAssinafySignUrlDto,
  ): Promise<CreateAssinafySignUrlResponseDto> {
    return this.assinafy.createOrReuseSignUrl(body);
  }
}
