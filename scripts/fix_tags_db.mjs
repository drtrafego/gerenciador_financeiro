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

async function fixTags() {
  const res = await sql`SELECT value FROM system_settings WHERE key = 'personal_custom_transactions'`;
  if (res.length === 0) return;

  const txs = JSON.parse(res[0].value);
  const updated = txs.map(t => {
    if (t.childTag && t.childTag.trim() !== '') return t;

    const desc = `${t.merchant || ''} ${t.description || ''} ${t.category || ''}`.toLowerCase();
    if (desc.includes('bernardo') || desc.includes('futebol') || desc.includes('campeonato') || desc.includes('escola') || desc.includes('misericordia') || t.category === 'Filhos & Família') {
      return { ...t, childTag: 'Filhos & Família' };
    }
    if (desc.includes('abl') || desc.includes('aysa') || desc.includes('luz') || desc.includes('agua') || desc.includes('aluguel') || t.category === 'Moradia & Serviços') {
      return { ...t, childTag: 'Família / Casa' };
    }
    return { ...t, childTag: 'Amanda e Gastão' };
  });

  const jsonStr = JSON.stringify(updated);
  await sql`UPDATE system_settings SET value = ${jsonStr}, updated_at = NOW() WHERE key = 'personal_custom_transactions'`;
  console.log(`Atualizadas ${updated.length} transações no banco Neon com tags familiares!`);

  for (const t of updated) {
    console.log(`${t.date} | ${t.merchant} | ${t.amount} ${t.currency} | tag: ${t.childTag}`);
  }

  await sql.end();
}

fixTags().catch(console.error);
