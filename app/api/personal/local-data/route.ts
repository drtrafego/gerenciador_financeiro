import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const candidates = [
      'd:/Meu Drive/Bilder Ai/mvp_gerenciador_financeiro/dr-trafego-finance/data/personal_transactions.local.json',
      'd:\\Meu Drive\\Bilder Ai\\mvp_gerenciador_financeiro\\dr-trafego-finance\\data\\personal_transactions.local.json',
      path.join(process.cwd(), 'data', 'personal_transactions.local.json'),
      path.join(process.cwd(), 'dr-trafego-finance', 'data', 'personal_transactions.local.json'),
      'C:/Users/User/.gemini/antigravity/brain/50e49594-c541-4cfe-bfb5-46fb6523caa1/scratch/parsed_galicia_transactions.json'
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        const transactions = JSON.parse(content);
        if (Array.isArray(transactions) && transactions.length > 0) {
          return NextResponse.json({ success: true, count: transactions.length, transactions });
        }
      }
    }
    return NextResponse.json({ success: true, count: 0, transactions: [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, transactions: [] }, { status: 500 });
  }
}