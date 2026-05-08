import { notFound } from 'next/navigation';
import { getInvoiceWithClient, getAllSettings } from '@/lib/db/queries';
import { formatCurrency } from '@/lib/currency/format';
import type { Currency } from '@/lib/currency/format';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';
import PrintButton from '@/components/invoices/PrintButton';

const typeLabels: Record<string, string> = {
  monthly: 'Mensalidade',
  project: 'Projeto',
  proposal: 'Proposta Comercial',
};

const UNITS = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const HUNDREDS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
  'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function chunk(n: number): string {
  if (n === 0) return '';
  if (n < 20) return UNITS[n]!;
  if (n < 100) {
    const u = n % 10;
    return u === 0 ? TENS[Math.floor(n / 10)]! : `${TENS[Math.floor(n / 10)]} e ${UNITS[u]}`;
  }
  if (n === 100) return 'cem';
  const rest = n % 100;
  return rest === 0 ? HUNDREDS[Math.floor(n / 100)]! : `${HUNDREDS[Math.floor(n / 100)]} e ${chunk(rest)}`;
}

function inWords(n: number): string {
  if (n === 0) return 'zero';
  if (n < 1000) return chunk(n);
  if (n < 1_000_000) {
    const t = Math.floor(n / 1000);
    const rest = n % 1000;
    const tStr = t === 1 ? 'mil' : `${chunk(t)} mil`;
    if (rest === 0) return tStr;
    return `${tStr}${rest < 100 ? ' e ' : ' '}${chunk(rest)}`;
  }
  const m = Math.floor(n / 1_000_000);
  const rest = n % 1_000_000;
  const mStr = m === 1 ? 'um milhão' : `${chunk(m)} milhões`;
  if (rest === 0) return mStr;
  return `${mStr}${rest < 100 ? ' e ' : ' '}${inWords(rest)}`;
}

function amountInWords(amount: number, currency: string): string {
  const int = Math.floor(amount);
  const cents = Math.round((amount - int) * 100);
  const names: Record<string, [string, string, string, string]> = {
    BRL: ['real', 'reais', 'centavo', 'centavos'],
    USD: ['dólar', 'dólares', 'centavo', 'centavos'],
    ARS: ['peso', 'pesos', 'centavo', 'centavos'],
  };
  const [sg, pl, csg, cpl] = names[currency] ?? names['BRL']!;
  let result = '';
  if (int > 0) result = `${inWords(int)} ${int === 1 ? sg : pl}`;
  if (cents > 0) result = `${result}${result ? ' e ' : ''}${inWords(cents)} ${cents === 1 ? csg : cpl}`;
  if (!result) result = `zero ${pl}`;
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [row, settings] = await Promise.all([getInvoiceWithClient(id), getAllSettings()]);
  if (!row) notFound();

  const { invoice, client } = row;
  const agencyEmail = settings['agency_email'] ?? '';
  const agencyCnpj = settings['agency_cnpj'] ?? '';
  const agencyAddress = settings['agency_address'] ?? '';
  const agencyCity = settings['agency_city'] ?? '';
  const invoicePaymentMethod = invoice.paymentMethod ?? '';
  const isPaid = invoice.status === 'paid';
  const isOverdue = invoice.status === 'overdue';

  const rawAmount = parseFloat(invoice.amount ?? '0');
  const currency = (invoice.currency as Currency) ?? 'BRL';
  const amount = formatCurrency(rawAmount, currency);
  const amountWords = amountInWords(rawAmount, currency);

  const emittedDate = invoice.createdAt
    ? new Date(invoice.createdAt).toLocaleDateString('pt-BR', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo',
      })
    : null;

  const dueDate = new Date(invoice.dueDate + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const paidDate = isPaid && invoice.paidAt
    ? new Date(invoice.paidAt).toLocaleDateString('pt-BR', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-2xl">

        {/* Recibo — documento branco */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 print:shadow-none print:border-none">

          {/* Faixa verde topo */}
          <div className="h-2 bg-gradient-to-r from-emerald-600 to-emerald-400" />

          {/* Header: empresa + número */}
          <div className="px-10 py-8 border-b border-dashed border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Emitido por</p>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Construa Seu Sucesso</h1>
                {agencyEmail && (
                  <p className="text-xs text-gray-500 mt-1">{agencyEmail}</p>
                )}
                {agencyCnpj && (
                  <p className="text-xs text-gray-500">CNPJ: {agencyCnpj}</p>
                )}
                {agencyAddress && (
                  <p className="text-xs text-gray-500">{agencyAddress}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Recibo</p>
                <p className="font-mono text-xl font-bold text-gray-900">
                  {invoice.invoiceNumber ?? `REC-${id.slice(0, 8).toUpperCase()}`}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">{typeLabels[invoice.type] ?? invoice.type}</p>
              </div>
            </div>

            <div className="mt-7 text-center">
              <h2 className="text-2xl font-black uppercase tracking-[0.3em] text-gray-900">
                Recibo de Pagamento
              </h2>
            </div>
          </div>

          {/* Datas */}
          <div className="px-10 py-5 border-b border-dashed border-gray-200">
            <div className={`grid gap-4 ${paidDate ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {emittedDate && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Emissão</p>
                  <p className="text-sm font-medium text-gray-800">{emittedDate}</p>
                  {agencyCity && (
                    <p className="text-xs text-gray-400">{agencyCity}</p>
                  )}
                </div>
              )}
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Vencimento</p>
                <p className={`text-sm font-medium ${isOverdue ? 'text-red-500' : 'text-gray-800'}`}>
                  {dueDate}
                </p>
              </div>
              {paidDate && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Pagamento</p>
                  <p className="text-sm font-medium text-emerald-600">{paidDate}</p>
                </div>
              )}
            </div>
          </div>

          {/* Recebemos de */}
          <div className="px-10 py-6 border-b border-dashed border-gray-200">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Recebemos de</p>
            <p className="text-xl font-bold text-gray-900">{client?.name ?? '—'}</p>
            {client?.email && <p className="text-sm text-gray-500 mt-1">{client.email}</p>}
          </div>

          {/* Referente a */}
          <div className="px-10 py-6 border-b border-dashed border-gray-200">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-3">Referente a</p>
            <div className="flex justify-between items-start gap-8">
              <p className="text-gray-700 flex-1">
                {invoice.description ?? 'Serviços de gestão de tráfego pago'}
              </p>
              <p className="text-base font-semibold text-gray-900 shrink-0">
                {formatCurrency(rawAmount, currency)}
              </p>
            </div>
          </div>

          {/* Forma de pagamento */}
          {invoicePaymentMethod && (
            <div className="px-10 py-5 border-b border-dashed border-gray-200">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Forma de pagamento</p>
              <p className="text-sm text-gray-700">{invoicePaymentMethod}</p>
            </div>
          )}

          {/* Total */}
          <div className="px-10 py-7 bg-gray-50">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 font-medium">Valor Total</span>
              <span className="text-4xl font-black text-gray-900">{amount}</span>
            </div>
            <p className="mt-2 text-xs text-gray-400 italic text-right">({amountWords})</p>

            {/* Badge de status */}
            <div className="mt-5">
              {isPaid && (
                <div className="flex items-center gap-2 justify-center bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl py-3 px-4">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-semibold">Fatura quitada</span>
                  {paidDate && <span className="text-xs text-emerald-600 opacity-70">em {paidDate}</span>}
                </div>
              )}
              {isOverdue && (
                <div className="flex items-center gap-2 justify-center bg-red-50 border border-red-200 text-red-600 rounded-xl py-3 px-4">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-semibold">Esta fatura está vencida</span>
                </div>
              )}
              {invoice.status === 'sent' && (
                <div className="flex items-center gap-2 justify-center bg-blue-50 border border-blue-200 text-blue-600 rounded-xl py-3 px-4">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-semibold">Aguardando pagamento</span>
                </div>
              )}
            </div>
          </div>

          {/* Assinatura */}
          <div className="px-10 py-8 border-t border-dashed border-gray-200 print:py-12">
            {emittedDate && (
              <p className="text-xs text-gray-400 mb-8">
                {agencyCity ? `${agencyCity}, ` : ''}{emittedDate}
              </p>
            )}
            <div className="flex justify-end">
              <div className="text-center">
                <div className="w-52 border-t border-gray-400 pt-2">
                  <p className="text-xs text-gray-500 font-medium">Construa Seu Sucesso</p>
                  {agencyCnpj && (
                    <p className="text-[10px] text-gray-400">{agencyCnpj}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div className="px-10 py-4 bg-gray-50 border-t border-gray-100 text-center">
            <p className="text-[10px] text-gray-400">
              Este documento é válido como comprovante de pagamento &middot; Construa Seu Sucesso
            </p>
          </div>
        </div>

        {/* Botão imprimir — não aparece na impressão */}
        <div className="mt-6 text-center print:hidden">
          <PrintButton />
        </div>
      </div>
    </div>
  );
}
