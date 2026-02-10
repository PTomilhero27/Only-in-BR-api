import { PartialType } from '@nestjs/swagger';
import { CreateExcelTemplateDto } from './create-excel-template.dto';

/**
 * DTO de atualização do template.
 *
 * Estratégia MVP:
 * - Patch funciona como "replace" do conteúdo (sheets/cells/tables).
 * - Permite evolução rápida sem complexidade de nested update.
 */
export class UpdateExcelTemplateDto extends PartialType(CreateExcelTemplateDto) {}
