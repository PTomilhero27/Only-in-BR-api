#!/usr/bin/env node
/**
 * Script para gerar um módulo NestJS seguindo a arquitetura do projeto:
 * - src/modules/<nome>/
 *   - <nome>.module.ts
 *   - <nome>.controller.ts
 *   - <nome>.service.ts
 *   - dto/
 *
 * Como usar:
 *   pnpm gen:module fairs
 *
 * Decisões:
 * - Usamos o Nest CLI por ser o gerador oficial e manter consistência.
 * - Criamos também a pasta dto (o CLI não cria por padrão).
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rawName = process.argv[2];

if (!rawName) {
  console.error("❌ Você precisa informar o nome do módulo. Ex: pnpm gen:module fairs");
  process.exit(1);
}

// Normaliza: letras minúsculas e remove espaços
const moduleName = rawName.trim().toLowerCase();

// Validação simples para evitar nome inválido
if (!/^[a-z0-9-]+$/.test(moduleName)) {
  console.error("❌ Nome inválido. Use apenas letras, números e hífen. Ex: fairs, fair-shows");
  process.exit(1);
}

const baseDir = process.cwd();
const moduleDir = path.join(baseDir, "src", "modules", moduleName);
const dtoDir = path.join(moduleDir, "dto");

if (fs.existsSync(moduleDir)) {
  console.error(`❌ O módulo "${moduleName}" já existe em: src/modules/${moduleName}`);
  process.exit(1);
}

try {
  console.log(`🚀 Gerando módulo NestJS: ${moduleName}`);

  // Gera module/controller/service no caminho correto
  execSync(`pnpm nest g module modules/${moduleName}`, { stdio: "inherit" });
  execSync(`pnpm nest g controller modules/${moduleName} --no-spec`, { stdio: "inherit" });
  execSync(`pnpm nest g service modules/${moduleName} --no-spec`, { stdio: "inherit" });

  // Cria pasta dto
  fs.mkdirSync(dtoDir, { recursive: true });

  // Cria um README.md simples para orientar o módulo (opcional, mas ajuda manutenção)
  const readmePath = path.join(moduleDir, "README.md");
  fs.writeFileSync(
    readmePath,
    `# Módulo: ${moduleName}

Este módulo é responsável por ...

## Estrutura
- \`${moduleName}.module.ts\`
- \`${moduleName}.controller.ts\`
- \`${moduleName}.service.ts\`
- \`dto/\` (contratos de entrada/saída e validações)
`,
    "utf8"
  );

  console.log(`✅ Módulo "${moduleName}" criado em src/modules/${moduleName}`);
  console.log("👉 Próximo passo: criar DTOs em src/modules/" + moduleName + "/dto");
} catch (err) {
  console.error("❌ Erro ao gerar o módulo:", err?.message ?? err);
  process.exit(1);
}
