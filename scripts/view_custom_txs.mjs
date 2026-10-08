import postgres from 'postgres';
import fs from 'fs';
const envContent = fs.readFileSync('.env.local', 'utf8');
let postgresUrl = '';
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('POSTGRES_URL=')) {
    postgresUrl = trimmed.substring('POSTGRES_URL='.length).trim().replace(/["']/g, '');
  }
}
const sql = postgres(postgresUrl, { ssl: 'require' });
const res = await sql`SELECT value FROM system_settings WHERE key = 'personal_custom_transactions'`;
const txs = JSON.parse(res[0].value);
for (const t of txs) {
  console.log(`${t.date} | ${t.merchant} | ${t.amount} ${t.currency} | ${t.category} | ${t.childTag || 'sem tag'} | id: ${t.id}`);
}
await sql.end();
