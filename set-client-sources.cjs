const { Client } = require('pg');
const fs = require('fs');

// Lê POSTGRES_URL do .env.local
const env = fs.readFileSync('.env.local', 'utf8');
const m = env.match(/^POSTGRES_URL=(.+)$/m);
if (!m) { console.error('POSTGRES_URL não encontrada'); process.exit(1); }
const connectionString = m[1].trim();

// ─────────────────────────────────────────────────────────────
// PREENCHER AQUI a origem de cada cliente já cadastrado.
// Chave = trecho do nome do cliente (case-insensitive, casa por "contém").
// Valor = canal: 'referral' (Indicação) | 'organic' (Orgânico) | 'meta' | 'google'
//
// Exemplo:
//   'Pontucar': 'google',
//   'Charcutaria': 'meta',
//   'Gramado': 'referral',
// ─────────────────────────────────────────────────────────────
const MAP = {
  'pra cima': 'organic',
  'Felipe Matias': 'google',
  'Locadora': 'organic',
  'Paulistinha': 'organic',
  'Ruck': 'google',
  'Vinicius': 'google',
};

(async () => {
  const entries = Object.entries(MAP);
  if (entries.length === 0) {
    console.log('Nenhum cliente no MAP. Liste os clientes do banco para preencher:');
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await client.connect();
    const { rows } = await client.query(`SELECT name, source FROM clients ORDER BY name`);
    rows.forEach((r) => console.log(`  - ${r.name}  (origem atual: ${r.source ?? 'não informado'})`));
    await client.end();
    return;
  }

  const valid = ['referral', 'organic', 'meta', 'google'];
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  for (const [nameLike, source] of entries) {
    if (!valid.includes(source)) {
      console.error(`Canal inválido "${source}" para "${nameLike}". Use: ${valid.join(', ')}`);
      continue;
    }
    const { rowCount, rows } = await client.query(
      `UPDATE clients SET source = $1, updated_at = now()
       WHERE name ILIKE $2 RETURNING name`,
      [source, `%${nameLike}%`]
    );
    if (rowCount === 0) {
      console.warn(`Nenhum cliente casou com "${nameLike}"`);
    } else {
      console.log(`${source} <- ${rows.map((r) => r.name).join(', ')}`);
    }
  }
  await client.end();
})().catch((e) => { console.error(e); process.exit(1); });
