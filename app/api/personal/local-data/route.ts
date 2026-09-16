import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const localDataPath = path.join(process.cwd(), 'data', 'personal_transactions.local.json');
    if (fs.existsSync(localDataPath)) {
      const content = fs.readFileSync(localDataPath, 'utf8');
      const transactions = JSON.parse(content);
      return NextResponse.json({ success: true, transactions });
    }
    return NextResponse.json({ success: true, transactions: [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, transactions: [] }, { status: 500 });
  }
}