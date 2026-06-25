const { Client } = require('pg');
const fs = require('fs');

// Lê POSTGRES_URL do .env.local
const env = fs.readFileSync('.env.local', 'utf8');
const m = env.match(/^POSTGRES_URL=(.+)$/m);
if (!m) { console.error('POSTGRES_URL não encontrada'); process.exit(1); }
const connectionString = m[1].trim();

// Migração ADITIVA: só adiciona a coluna de origem, nunca toca em dados existentes.
const statements = [
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS source text`,
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
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'source'
  `);
  console.log('Coluna confirmada:', JSON.stringify(rows, null, 2));
  await client.end();
})().catch((e) => { console.error(e); process.exit(1); });
