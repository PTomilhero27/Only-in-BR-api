import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ContractsStorageService } from '../services/contracts-storage.service';
import { UploadContractPdfDto } from '../dto/assinafy/upload-contract-pdf-dto';
import { UploadContractPdfResponseDto } from '../dto/assinafy/upload-contract-pdf-response.dto';

@ApiTags('Contracts')
@Controller('contracts')
export class ContractsFilesController {
  constructor(private readonly storage: ContractsStorageService) {}

  @Post(':id/pdf')
  @ApiParam({
    name: 'id',
    description: 'ID do contrato (Contract.id) que receberá o PDF',
    example: '8b0b6d8f-8c7f-4c2a-9a5e-1b5d8c2fdc1a',
  })
  @ApiOperation({
    summary:
      'Upload do PDF do contrato (valida feira + owner + template) e salva pdfPath',
    description:
      'Recebe um PDF (multipart/form-data) + fairId/ownerId/templateId. ' +
      'Valida vínculo do expositor na feira e se o template é o contrato principal da feira. ' +
      'Sobe no Supabase Storage e salva Contract.pdfPath versionado (evita cache e PDFs antigos).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fairId: { type: 'string', format: 'uuid' },
        ownerId: { type: 'string' },
        templateId: { type: 'string', format: 'uuid' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['fairId', 'ownerId', 'templateId', 'file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(
    @Param('id') contractId: string,
    @Body() body: UploadContractPdfDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadContractPdfResponseDto> {
    /**
     * Esta rota recebe um PDF e delega a validação + persistência para o service.
     * Mantemos validações básicas no controller para dar feedback rápido ao client.
     */
    if (!file) {
      throw new BadRequestException(
        'Arquivo não enviado. Campo esperado: file.',
      );
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException(
        'Formato inválido. Envie um arquivo PDF (application/pdf).',
      );
    }

    // opcional: valida assinatura "%PDF"
    if (file.buffer?.length >= 4) {
      const sig = file.buffer.subarray(0, 4).toString('utf8');
      if (sig !== '%PDF') {
        throw new BadRequestException(
          'Arquivo inválido. Conteúdo não parece ser PDF.',
        );
      }
    }

    return this.storage.uploadContractPdf({
      contractId,
      fairId: body.fairId,
      ownerId: body.ownerId,
      templateId: body.templateId,
      fileBuffer: file.buffer,
    });
  }
}
