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

  private validatePdfOrThrow(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Arquivo não enviado. Campo esperado: file.');
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
  }

  @Post('templates/:templateId/pdf')
  @ApiParam({
    name: 'templateId',
    description: 'ID do template principal do contrato (DocumentTemplate.id)',
    example: '8b0b6d8f-8c7f-4c2a-9a5e-1b5d8c2fdc1a',
  })
  @ApiOperation({
    summary:
      'Upload do PDF do contrato (cria Contract se necessário) e salva pdfPath',
    description:
      'Recebe PDF (multipart/form-data) + fairId/ownerId e opcionalmente contractId. ' +
      'O templateId vem na rota e é validado como contrato principal da feira. ' +
      'Se contractId não for informado, o sistema cria/acha o Contract pelo OwnerFair (1:1) e continua o upload.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fairId: { type: 'string', format: 'uuid' },
        ownerId: { type: 'string' },
        contractId: {
          type: 'string',
          format: 'uuid',
          nullable: true,
          description:
            'Opcional. Se não informado, o sistema cria/acha o Contract do OwnerFair.',
        },
        file: { type: 'string', format: 'binary' },
      },
      required: ['fairId', 'ownerId', 'file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdfByTemplate(
    @Param('templateId') templateId: string,
    @Body() body: UploadContractPdfDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadContractPdfResponseDto> {
    this.validatePdfOrThrow(file);

    return this.storage.uploadContractPdf({
      contractId: body.contractId, 
      fairId: body.fairId,
      ownerId: body.ownerId,
      templateId, 
      fileBuffer: file.buffer,
    });
  }
}
