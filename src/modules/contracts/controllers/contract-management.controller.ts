import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ContractManagementService } from '../services/contract-management.service';
import { CreateContractDto } from '../dto/contracts/create-contract.dto';
import { AddFairLinkDto } from '../dto/contracts/add-fair-link.dto';

@ApiTags('Contracts')
@ApiBearerAuth()
@Controller('contracts')
export class ContractManagementController {
  constructor(private readonly service: ContractManagementService) {}

  @Post()
  @ApiOperation({
    summary: 'Criar contrato com tipo específico',
    description:
      'Cria um contrato para um expositor em uma feira. ' +
      'Tipos: FAIR_DEFAULT, MULTI_FAIR, EXHIBITOR_SPECIFIC. ' +
      'Para MULTI_FAIR, informe linkedFairIds com as feiras adicionais.',
  })
  @ApiResponse({ status: 201, description: 'Contrato criado com sucesso.' })
  create(@Body() dto: CreateContractDto) {
    return this.service.createContract(dto);
  }

  @Get('fair/:fairId')
  @ApiOperation({
    summary: 'Listar contratos de uma feira',
    description:
      'Lista todos os contratos vinculados a uma feira, incluindo MULTI_FAIR que a referenciem.',
  })
  @ApiParam({ name: 'fairId', description: 'ID da feira' })
  @ApiResponse({ status: 200, description: 'Lista de contratos.' })
  listByFair(@Param('fairId') fairId: string) {
    return this.service.listContractsByFair(fairId);
  }

  @Get('owner/:ownerId')
  @ApiOperation({
    summary: 'Listar contratos de um expositor',
    description: 'Lista todos os contratos de um expositor em todas as feiras.',
  })
  @ApiParam({ name: 'ownerId', description: 'ID do expositor (Owner)' })
  @ApiResponse({ status: 200, description: 'Lista de contratos.' })
  listByOwner(@Param('ownerId') ownerId: string) {
    return this.service.listContractsByOwner(ownerId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalhe completo de um contrato',
    description:
      'Retorna informações completas do contrato incluindo template, expositor, feira e feiras vinculadas.',
  })
  @ApiParam({ name: 'id', description: 'ID do contrato' })
  @ApiResponse({ status: 200, description: 'Contrato encontrado.' })
  @ApiResponse({ status: 404, description: 'Contrato não encontrado.' })
  getById(@Param('id') id: string) {
    return this.service.getContractDetail(id);
  }

  @Post(':id/fair-links')
  @ApiOperation({
    summary: 'Adicionar feira ao contrato multi-feira',
    description: 'Vincula uma feira adicional a um contrato do tipo MULTI_FAIR.',
  })
  @ApiParam({ name: 'id', description: 'ID do contrato MULTI_FAIR' })
  @ApiResponse({ status: 201, description: 'Feira vinculada com sucesso.' })
  addFairLink(@Param('id') id: string, @Body() dto: AddFairLinkDto) {
    return this.service.addFairLink(id, dto);
  }

  @Delete(':id/fair-links/:fairId')
  @ApiOperation({
    summary: 'Remover feira do contrato multi-feira',
    description: 'Remove o vínculo de uma feira adicional de um contrato MULTI_FAIR.',
  })
  @ApiParam({ name: 'id', description: 'ID do contrato MULTI_FAIR' })
  @ApiParam({ name: 'fairId', description: 'ID da feira a desvincular' })
  @ApiResponse({ status: 200, description: 'Vínculo removido.' })
  removeFairLink(
    @Param('id') id: string,
    @Param('fairId') fairId: string,
  ) {
    return this.service.removeFairLink(id, fairId);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Excluir contrato',
    description:
      'Exclui um contrato que ainda não tenha PDF ou assinatura. ' +
      'Para contratos com fluxo ativo, cancele antes.',
  })
  @ApiParam({ name: 'id', description: 'ID do contrato' })
  @ApiResponse({ status: 200, description: 'Contrato excluído.' })
  @ApiResponse({ status: 400, description: 'Não pode excluir (assinado ou fluxo ativo).' })
  remove(@Param('id') id: string) {
    return this.service.deleteContract(id);
  }

  @Post(':id/reset')
  @ApiOperation({
    summary: 'Reiniciar fluxo de contrato',
    description:
      'Exclui o PDF do Storage, cancela o fluxo de assinatura na Assinafy e reseta status/campos do contrato, ' +
      'permitindo gerar/upload de um novo contrato.',
  })
  @ApiParam({ name: 'id', description: 'ID do contrato' })
  @ApiResponse({ status: 200, description: 'Fluxo do contrato reiniciado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Não é possível reiniciar fluxo (contrato assinado).' })
  @ApiResponse({ status: 404, description: 'Contrato não encontrado.' })
  reset(@Param('id') id: string) {
    return this.service.resetContract(id);
  }
}

