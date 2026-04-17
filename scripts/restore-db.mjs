import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const DB_CONTAINER = 'feira_gastro_db';
const DB_NAME = 'onlyinbr_dev';
const DB_USER = 'postgres';
const DUMP_FILE = 'dump_prod.dump';

function run(command, options = {}) {
  console.log(`> ${command}`);
  try {
    return execSync(command, { stdio: 'inherit', ...options });
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    process.exit(1);
  }
}

async function restore() {
  console.log('🚀 Iniciando processo de restauração do banco de dados...');

  // 1. Verificar se o arquivo de dump existe
  if (!existsSync(DUMP_FILE)) {
    console.error(`❌ Erro: Arquivo ${DUMP_FILE} não encontrado no diretório raiz.`);
    process.exit(1);
  }

  // 2. Recriar o banco de dados (garantir estado limpo)
  console.log('🧹 Limpando banco de dados local...');
  try {
    run(`docker exec ${DB_CONTAINER} dropdb -U ${DB_USER} --if-exists --force ${DB_NAME}`);
  } catch (e) {
    // Pode falhar se houver conexões ativas, mas o start:dev deve estar parado
    console.warn('⚠️  Aviso: Não foi possível derrubar o banco (pode haver conexões ativas). Tentando continuar...');
  }
  run(`docker exec ${DB_CONTAINER} createdb -U ${DB_USER} ${DB_NAME}`);

  // 3. Copiar dump para dentro do container e restaurar
  console.log('📦 Restaurando dados de produção...');
  run(`docker cp ${DUMP_FILE} ${DB_CONTAINER}:/tmp/${DUMP_FILE}`);
  run(`docker exec ${DB_CONTAINER} pg_restore -U ${DB_USER} -d ${DB_NAME} -v /tmp/${DUMP_FILE} --no-owner --no-privileges`);
  run(`docker exec ${DB_CONTAINER} rm /tmp/${DUMP_FILE}`);

  // 4. Rodar as migrações locais ou sincronizar o schema (ex: FairShowcase)
  console.log('🔄 Sincronizando schema com Prisma (db push)...');
  run('pnpm exec prisma db push --skip-generate --accept-data-loss');

  console.log('✅ Banco de dados restaurado e schema atualizado com sucesso!');
}

restore().catch((err) => {
  console.error('❌ Falha crítica no processo de restauração:', err);
  process.exit(1);
});
