"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./src/app.module");
const inventory_import_service_1 = require("./src/modules/inventory/inventory-import.service");
async function bootstrap() {
    console.log('Iniciando o contexto do NestJS para teste...');
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const service = app.get(inventory_import_service_1.InventoryImportService);
    console.log('Testando o método preview...');
    const result = await service.preview({});
    console.log('Resumo da Prévia (Preview Summary):');
    console.log(JSON.stringify(result.summary, null, 2));
    console.log(`Total de linhas retornadas: ${result.rows.length}`);
    if (result.rows.length > 0) {
        console.log('Exemplo da primeira linha processada:');
        console.log(JSON.stringify(result.rows[0], null, 2));
        console.log('Exemplo da última linha processada:');
        console.log(JSON.stringify(result.rows[result.rows.length - 1], null, 2));
    }
    await app.close();
    console.log('Teste concluído com sucesso!');
}
bootstrap().catch((err) => {
    console.error('Erro durante o teste:', err);
    process.exit(1);
});
//# sourceMappingURL=test-import-scratch.js.map