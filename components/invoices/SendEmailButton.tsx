'use client';

import { useState, useTransition } from 'react';
import { Mail, CheckCircle, AlertCircle, X } from 'lucide-react';
import { sendReceiptEmailAction } from '@/app/(dashboard)/invoices/actions';

interface Props {
  invoiceId: string;
  defaultEmail?: string;
}

export default function SendEmailButton({ invoiceId, defaultEmail }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSend = () => {
    if (!email) return;
    setResult(null);
    startTransition(async () => {
      const res = await sendReceiptEmailAction(invoiceId, email);
      setResult(res.ok ? 'success' : 'error');
    });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
      >
        <Mail className="h-4 w-4" />
        Enviar por e-mail
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2">
      <Mail className="h-4 w-4 text-zinc-500 shrink-0" />
      <input
        type="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setResult(null); }}
        placeholder="email@cliente.com"
        className="bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none w-48"
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        autoFocus
      />
      {result === 'success' && (
        <span className="flex items-center gap-1 text-xs text-green-400 shrink-0">
          <CheckCircle className="h-3.5 w-3.5" /> Enviado
        </span>
      )}
      {result === 'error' && (
        <span className="flex items-center gap-1 text-xs text-red-400 shrink-0">
          <AlertCircle className="h-3.5 w-3.5" /> Erro
        </span>
      )}
      <button
        onClick={handleSend}
        disabled={isPending || !email}
        className="shrink-0 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-2.5 py-1 text-xs font-medium text-white transition-colors"
      >
        {isPending ? '...' : 'Enviar'}
      </button>
      <button onClick={() => setOpen(false)} className="text-zinc-600 hover:text-zinc-400 shrink-0">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
