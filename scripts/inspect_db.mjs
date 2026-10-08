import postgres from 'postgres';
import fs from 'fs';

// Carrega POSTGRES_URL do .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
let postgresUrl = '';
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('POSTGRES_URL=')) {
    postgresUrl = trimmed.substring('POSTGRES_URL='.length).trim();
    if (postgresUrl.startsWith('"') && postgresUrl.endsWith('"')) {
      postgresUrl = postgresUrl.slice(1, -1);
    }
    if (postgresUrl.startsWith("'") && postgresUrl.endsWith("'")) {
      postgresUrl = postgresUrl.slice(1, -1);
    }
  }
}

if (!postgresUrl) {
  console.error('POSTGRES_URL não encontrado no .env.local');
  process.exit(1);
}

const sql = postgres(postgresUrl, { ssl: 'require' });

async function inspect() {
  console.log('--- 1. TABELAS EXISTENTES ---');
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;
  console.log(tables.map(t => t.table_name));

  console.log('\n--- 2. USUÁRIOS NA TABELA USERS ---');
  try {
    const users = await sql`SELECT id, name, email, role, created_at FROM users;`;
    console.log(users);
  } catch (e) {
    console.log('Erro ao ler users:', e.message);
  }

  console.log('\n--- 3. CHAVES NA TABELA SYSTEM_SETTINGS ---');
  try {
    const settings = await sql`SELECT key, length(value) as val_len, updated_at FROM system_settings;`;
    console.log(settings);

    // Se existir personal_custom_transactions, veja o conteúdo
    const customTx = await sql`SELECT key, value FROM system_settings WHERE key = 'personal_custom_transactions';`;
    if (customTx.length > 0) {
      console.log('personal_custom_transactions length:', customTx[0].value.length);
      try {
        const parsed = JSON.parse(customTx[0].value);
        console.log(`Encontradas ${parsed.length} transações customizadas em personal_custom_transactions.`);
        console.log('Amostra:', parsed.slice(0, 5));
      } catch (err) {
        console.log('Erro ao parsear JSON:', err.message);
      }
    } else {
      console.log('personal_custom_transactions NÃO EXISTE no banco Neon!');
    }
  } catch (e) {
    console.log('Erro ao ler system_settings:', e.message);
  }

  console.log('\n--- 4. TRANSAÇÕES NA TABELA TRANSACTIONS (PJ/EMPRESA) ---');
  try {
    const count = await sql`SELECT count(*) FROM transactions;`;
    console.log('Total de transações PJ:', count[0].count);
    const sample = await sql`SELECT id, date, amount, description, type, category FROM transactions ORDER BY created_at DESC LIMIT 5;`;
    console.log('Últimas transações PJ inseridas:', sample);
  } catch (e) {
    console.log('Erro ao ler transactions:', e.message);
  }

  await sql.end();
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
