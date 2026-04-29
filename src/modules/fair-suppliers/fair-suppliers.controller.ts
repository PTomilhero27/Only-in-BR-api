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

/**
 * Controller administrativo para cadastro de fornecedores/prestadores da feira.
 * Esse cadastro nao representa expositor; expositor vem de Owner/OwnerFair.
 */
@ApiTags('FairSuppliers')
@ApiBearerAuth()
@Controller('fairs/:fairId/suppliers')
export class FairSuppliersController {
  constructor(private readonly service: FairSuppliersService) {}

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
