import { db } from './drizzle';
import { sql } from 'drizzle-orm';
import { promises as fs } from 'node:fs';
import path from 'node:path';

async function runMigrations() {
  console.log('Running database migrations...');
  const migrationsDir = path.join(process.cwd(), 'lib/db/migrations');

  try {
    const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sqlContent = await fs.readFile(filePath, 'utf-8');
      await db.execute(sql.raw(sqlContent));
      console.log(`✓ ${file}`);
    }
    console.log('Migrations complete.');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
  process.exit(0);
}

runMigrations();
