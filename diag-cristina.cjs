// Diagnóstico temporário: por que a Cristina recebeu cobrança mesmo tendo pago.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envPath = path.join(__dirname, '.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const line = env.split(/\r?\n/).find((l) => l.startsWith('POSTGRES_URL=') || l.startsWith('DATABASE_URL='));
const url = line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const r1 = await c.query(
    `select custom_message from reminders where id = '49471c46-5d63-458e-8aab-aac407f815bf'`
  );
  console.log('\n=== MENSAGEM ENVIADA HOJE PARA A CRISTINA ===\n');
  console.log(r1.rows[0].custom_message);

  const cols = await c.query(
    `select column_name from information_schema.columns where table_name = 'agent_audit_log' order by ordinal_position`
  );
  console.log('\n=== COLUNAS agent_audit_log ===');
  console.log(cols.rows.map((r) => r.column_name).join(', '));

  const r2 = await c.query(
    `select created_at, actor, method, endpoint, status_code from agent_audit_log
     where created_at > now() - interval '5 days' order by created_at desc limit 40`
  );
  console.log('\n=== AUDIT LOG (5 dias) ===');
  console.table(r2.rows);

  await c.end();
})().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
