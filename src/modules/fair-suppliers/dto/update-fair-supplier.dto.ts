import { PartialType } from '@nestjs/swagger';
import { CreateFairSupplierDto } from './create-fair-supplier.dto';

/**
 * DTO de edicao de fornecedor/prestador.
 * Mantem o mesmo contrato do cadastro, mas todos os campos sao opcionais.
 */
export class UpdateFairSupplierDto extends PartialType(CreateFairSupplierDto) {}
