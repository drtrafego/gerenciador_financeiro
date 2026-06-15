const { Client } = require('pg');
const fs = require('fs');

// Lê POSTGRES_URL do .env.local
const env = fs.readFileSync('.env.local', 'utf8');
const m = env.match(/^POSTGRES_URL=(.+)$/m);
if (!m) { console.error('POSTGRES_URL não encontrada'); process.exit(1); }
const connectionString = m[1].trim();

// Migração ADITIVA: só adiciona colunas novas, nunca toca em dados existentes.
const statements = [
  `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS base_amount NUMERIC(10,2)`,
  `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS iof BOOLEAN DEFAULT false`,
  `ALTER TABLE recurring_expenses ADD COLUMN IF NOT EXISTS base_amount NUMERIC(10,2)`,
  `ALTER TABLE recurring_expenses ADD COLUMN IF NOT EXISTS iof BOOLEAN DEFAULT false`,
];

(async () => {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  for (const stmt of statements) {
    console.log('Executando:', stmt);
    await client.query(stmt);
    console.log('OK');
  }
  const { rows } = await client.query(`
    SELECT table_name, column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name IN ('transactions', 'recurring_expenses')
      AND column_name IN ('base_amount', 'iof')
    ORDER BY table_name, column_name
  `);
  console.log('Colunas confirmadas:', JSON.stringify(rows, null, 2));
  await client.end();
})().catch((e) => { console.error(e); process.exit(1); });
