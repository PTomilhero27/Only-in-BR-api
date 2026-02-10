import { Module } from '@nestjs/common';
import { ExcelGeneratorService } from './excel-generator.service';

/**
 * ✅ ExcelCoreModule
 *
 * Este módulo centraliza serviços reutilizáveis da feature Excel
 * que não pertencem a endpoints específicos.
 *
 * Por que existe:
 * - Evita duplicação de lógica de geração de Excel
 * - Permite que módulos (excel-exports, futuramente outros) injetem o gerador
 * - Mantém o "core" desacoplado de controllers e regras específicas de dataset
 */
@Module({
    providers: [ExcelGeneratorService],
    exports: [ExcelGeneratorService],
})
export class ExcelCoreModule { }
