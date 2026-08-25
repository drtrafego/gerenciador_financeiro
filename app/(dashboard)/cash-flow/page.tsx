export const dynamic = "force-dynamic";

import { getCashFlowData } from "@/lib/db/queries";
import CashFlowClient from "@/components/cashflow/CashFlowClient";
import { resolvePeriod } from "@/lib/period";

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    year?: string;
    month?: string;
    to?: string;
    new?: string;
    clientId?: string;
  }>;
}) {
  const params = await searchParams;
  // Mesma regra de período do dashboard, incluindo a compatibilidade com os
  // links antigos de ?month&year e o "hoje" no horário do Brasil.
  const { from, to } = resolvePeriod(params);

  const data = await getCashFlowData(from, to);

  // Atalho do botão "Novo lançamento" da ficha do cliente:
  // /cash-flow?new=income&clientId=<uuid> chega aqui e abre o modal já com o
  // cliente selecionado. Qualquer outro valor de "new" é ignorado em silêncio.
  //
  // "new" é palavra reservada, então só funciona como params.new, nunca
  // desestruturado com o mesmo nome.
  const abrirNovo = params.new === "income" || params.new === "expense" ? params.new : undefined;

  // O cliente é validado contra a lista que já está em memória, NUNCA com uma
  // consulta nova por id: a coluna é uuid e o Postgres derruba a página inteira
  // com "invalid input syntax for type uuid" se o link vier truncado. Não
  // casando, o modal abre com o select em branco, sem erro e sem toast.
  const clienteInicial =
    abrirNovo && params.clientId && data.clients.some((c) => c.id === params.clientId)
      ? params.clientId
      : undefined;

  return (
    <CashFlowClient
      transactions={data.transactions}
      contractIncomes={data.contractIncomes}
      rate={data.rate}
      displayCurrency={data.displayCurrency as any}
      from={from}
      to={to}
      clients={data.clients}
      abrirNovo={abrirNovo}
      clienteInicial={clienteInicial}
    />
  );
}
