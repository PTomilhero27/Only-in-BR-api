import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtPayload } from 'src/common/types/jwt-payload.type';
import { CreateFairSupplierDto } from './dto/create-fair-supplier.dto';
import { UpdateFairSupplierDto } from './dto/update-fair-supplier.dto';
import { FairSuppliersService } from './fair-suppliers.service';

import { FairSuppliersImportService } from './fair-suppliers-import.service';
import { UpdateFairSupplierImportConfigDto } from './dto/fair-supplier-import-config.dto';

import { FairSupplierImportPreviewResponseDto } from './dto/fair-supplier-import-preview.dto';

/**
 * Controller administrativo para cadastro de fornecedores/prestadores da feira.
 * Esse cadastro nao representa expositor; expositor vem de Owner/OwnerFair.
 */
@ApiTags('FairSuppliers')
@ApiBearerAuth()
@Controller('fairs/:fairId/suppliers')
export class FairSuppliersController {
  constructor(
    private readonly service: FairSuppliersService,
    private readonly importService: FairSuppliersImportService,
  ) {}

  @Get('import-config')
  @ApiOperation({ summary: 'Obter configuração de importação da planilha.' })
  getImportConfig(@Param('fairId') fairId: string) {
    return this.importService.getConfig(fairId);
  }

  @Get('import/test-metadata')
  @ApiOperation({ summary: 'Testar acesso à planilha e retornar metadados (abas disponíveis).' })
  testSpreadsheetMetadata(@Param('fairId') fairId: string) {
    return this.importService.getSpreadsheetMetadata(fairId);
  }

  @Get('import/test-values')
  @ApiOperation({ summary: 'Testar leitura de valores na planilha (values.get).' })
  testSpreadsheetValues(@Param('fairId') fairId: string) {
    return this.importService.testValues(fairId);
  }

  @Patch('import-config')
  @ApiOperation({ summary: 'Atualizar configuração de importação da planilha.' })
  updateImportConfig(
    @Param('fairId') fairId: string,
    @Body() dto: UpdateFairSupplierImportConfigDto,
  ) {
    return this.importService.updateConfig(fairId, dto);
  }

  @Post('import/preview')
  @HttpCode(200)
  @ApiOperation({ summary: 'Gerar prévia da importação de fornecedores.' })
  @ApiOkResponse({ type: FairSupplierImportPreviewResponseDto })
  previewImport(@Param('fairId') fairId: string) {
    return this.importService.preview(fairId);
  }

  @Post('import/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirmar importação de fornecedores da planilha.' })
  confirmImport(
    @Param('fairId') fairId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.importService.confirm(fairId, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar fornecedores/prestadores da feira.' })
  @ApiOkResponse({ description: 'Fornecedores retornados com parcelas.' })
  list(@Param('fairId') fairId: string) {
    return this.service.list(fairId);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Cadastrar fornecedor/prestador da feira.' })
  @ApiCreatedResponse({ description: 'Fornecedor criado.' })
  create(
    @Param('fairId') fairId: string,
    @Body() dto: CreateFairSupplierDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(fairId, dto, user.id);
  }

  @Patch(':supplierId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Editar fornecedor/prestador da feira.' })
  update(
    @Param('fairId') fairId: string,
    @Param('supplierId') supplierId: string,
    @Body() dto: UpdateFairSupplierDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(fairId, supplierId, dto, user.id);
  }

  @Delete(':supplierId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancelar cadastro de fornecedor/prestador.' })
  delete(
    @Param('fairId') fairId: string,
    @Param('supplierId') supplierId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.delete(fairId, supplierId, user.id);
  }
}
