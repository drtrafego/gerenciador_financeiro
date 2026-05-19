import https from 'https';

const DB_URL = 'postgresql://neondb_owner:npg_VD5ygqlfn8tm@ep-gentle-cloud-ad4eeafv-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const statements = [
  `CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    body TEXT NOT NULL,
    is_default TEXT DEFAULT 'false',
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
    custom_message TEXT,
    trigger_date DATE NOT NULL,
    trigger_time TEXT DEFAULT '08:00',
    status TEXT DEFAULT 'pending',
    sent_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `INSERT INTO message_templates (name, body, is_default)
   SELECT 'Lembrete Padrão', 'Olá *{nome}*, passando para lembrar que seu honorário de *{valor}* vence em *{data}*. Qualquer dúvida, estamos à disposição!', 'true'
   WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE is_default = 'true')`
];

// Usa a API HTTP do Neon serverless
const url = new URL('https://ep-gentle-cloud-ad4eeafv-pooler.c-2.us-east-1.aws.neon.tech/sql');

async function runSql(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const options = {
      hostname: 'ep-gentle-cloud-ad4eeafv-pooler.c-2.us-east-1.aws.neon.tech',
      path: '/sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from('neondb_owner:npg_VD5ygqlfn8tm').toString('base64'),
        'Neon-Connection-String': DB_URL,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

for (const stmt of statements) {
  console.log('Executando:', stmt.trim().split('\n')[0]);
  const result = await runSql(stmt);
  console.log('Resultado:', JSON.stringify(result));
}
