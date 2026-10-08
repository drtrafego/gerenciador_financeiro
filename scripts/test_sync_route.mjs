import fs from 'fs';

// Simula a requisição POST para /api/personal/transactions
async function test() {
  const { POST } = await import('./app/api/personal/transactions/route.js');
  const req = new Request('http://localhost:3000/api/personal/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'sync',
      localTransactions: [
        { id: 'tx-test-1', merchant: 'Teste Local', amount: 100, date: '2026-10-08', currency: 'BRL', type: 'expense' }
      ]
    })
  });

  const res = await POST(req);
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Success:', data.success);
  console.log('customTransactions length:', data.customTransactions?.length);
}

test().catch(console.error);
