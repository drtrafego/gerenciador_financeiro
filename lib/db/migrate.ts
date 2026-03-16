import { db } from './drizzle';
import { sql } from 'drizzle-orm';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// Códigos de erro PostgreSQL que são seguros de ignorar (já existe)
const SAFE_ERROR_CODES = new Set(['42P07', '42710', '42701']);

async function runMigrations() {
  console.log('Running database migrations...');
  const migrationsDir = path.join(process.cwd(), 'lib/db/migrations');

  try {
    const files = (await fs.readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sqlContent = await fs.readFile(filePath, 'utf-8');

      // Drizzle separa statements com "--> statement-breakpoint"
      const statements = sqlContent
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean);

      for (const statement of statements) {
        try {
          await db.execute(sql.raw(statement));
        } catch (err: any) {
          if (SAFE_ERROR_CODES.has(err?.code)) {
            // Tabela/constraint/coluna já existe — ok em re-runs
            continue;
          }
          throw err;
        }
      }
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
