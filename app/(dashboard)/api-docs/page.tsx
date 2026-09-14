"use client";

import React, { useState } from "react";
import { 
  Code, 
  Copy, 
  Check, 
  Search, 
  Terminal, 
  ShieldCheck, 
  Building2, 
  Home, 
  ExternalLink,
  Key
} from "lucide-react";

interface EndpointDoc {
  id: string;
  module: "pj" | "pf";
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  title: string;
  description: string;
  headers?: string[];
  queryParams?: { name: string; type: string; required?: boolean; desc: string }[];
  bodyParams?: { name: string; type: string; required?: boolean; desc: string }[];
  sampleRequestJson?: string;
  sampleResponseJson: string;
}

const ENDPOINTS: EndpointDoc[] = [
  // PF Endpoints
  {
    id: "pf-get-tx",
    module: "pf",
    method: "GET",
    path: "/api/agent/v1/personal/transactions",
    title: "Listar Transações Pessoais",
    description: "Retorna o histórico de transações pessoais em multi-moeda (ARS, BRL, USD), filtradas por categoria, tipo ou dependente.",
    queryParams: [
      { name: "type", type: "string", desc: "Filtro por tipo: 'expense' (despesa) ou 'income' (receita)" },
      { name: "category", type: "string", desc: "Nome da categoria (ex: 'Filhos & Família', 'Alimentação & Supermercado')" },
      { name: "childTag", type: "string", desc: "Nome do dependente/filho vinculado (ex: 'Matheus', 'Sofia')" },
      { name: "currency", type: "string", desc: "Filtro por moeda: 'ARS', 'BRL', 'USD'" },
    ],
    sampleResponseJson: JSON.stringify({
      data: [
        {
          id: "tx-pf-178941",
          date: "2026-09-14",
          merchant: "Colegio Escolar",
          description: "Mensalidade escolar",
          amount: 45000,
          currency: "ARS",
          type: "expense",
          category: "Filhos & Família",
          childTag: "Matheus",
          language: "pt"
        }
      ],
      count: 1
    }, null, 2)
  },
  {
    id: "pf-post-tx",
    module: "pf",
    method: "POST",
    path: "/api/agent/v1/personal/transactions",
    title: "Lançar / Registrar Gasto Pessoal",
    description: "Cria um novo lançamento financeiro pessoal ou receita (pró-labore/entradas) vinculado ou não a um dependente.",
    bodyParams: [
      { name: "date", type: "string", required: true, desc: "Data no formato YYYY-MM-DD" },
      { name: "merchant", type: "string", required: true, desc: "Estabelecimento / Local do gasto" },
      { name: "amount", type: "number", required: true, desc: "Valor numérico do gasto" },
      { name: "currency", type: "string", required: true, desc: "Moeda: 'ARS', 'BRL' ou 'USD'" },
      { name: "type", type: "string", required: true, desc: "'expense' para despesa ou 'income' para receita" },
      { name: "category", type: "string", required: true, desc: "Nome da categoria registrada" },
      { name: "childTag", type: "string", desc: "Nome do filho/dependente associado (opcional)" },
      { name: "description", type: "string", desc: "Detalhes ou observações adicionais" }
    ],
    sampleRequestJson: JSON.stringify({
      date: "2026-09-14",
      merchant: "Coto Supermercado",
      amount: 18500,
      currency: "ARS",
      type: "expense",
      category: "Alimentação & Supermercado",
      description: "Compras da semana"
    }, null, 2),
    sampleResponseJson: JSON.stringify({
      id: "tx-pf-178942",
      date: "2026-09-14",
      merchant: "Coto Supermercado",
      amount: 18500,
      currency: "ARS",
      type: "expense",
      category: "Alimentação & Supermercado",
      description: "Compras da semana"
    }, null, 2)
  },
  {
    id: "pf-delete-tx",
    module: "pf",
    method: "DELETE",
    path: "/api/agent/v1/personal/transactions",
    title: "Excluir Transação Pessoal",
    description: "Remove um lançamento financeiro pessoal por ID.",
    queryParams: [
      { name: "id", type: "string", required: true, desc: "ID único da transação a remover (ex: tx-pf-178941)" }
    ],
    sampleResponseJson: JSON.stringify({ success: true, deletedId: "tx-pf-178941" }, null, 2)
  },
  {
    id: "pf-categories",
    module: "pf",
    method: "GET",
    path: "/api/agent/v1/personal/categories",
    title: "Obter Categorias & Emojis Pessoais",
    description: "Retorna a lista completa de categorias pessoais com emojis, limites de meta e estilos de cor.",
    sampleResponseJson: JSON.stringify({
      data: [
        { id: "cat-children", namePt: "Filhos & Família", nameEs: "Hijos y Familia", limit: 3500, emoji: "👦", color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
        { id: "cat-food", namePt: "Alimentação & Supermercado", nameEs: "Alimentación y Supermercado", limit: 4500, emoji: "🍕", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" }
      ]
    }, null, 2)
  },
  {
    id: "pf-credit-cards",
    module: "pf",
    method: "GET",
    path: "/api/agent/v1/personal/credit-cards",
    title: "Cartões de Crédito & Faturas Pessoais",
    description: "Retorna a lista de cartões de crédito configurados, faturas bases em BRL/ARS e compras parceladas vigentes.",
    sampleResponseJson: JSON.stringify({
      data: [
        {
          id: "card-brl-bb",
          name: "Banco do Brasil Visa (BRL)",
          currency: "BRL",
          baseInvoice: 0,
          limit: 15000,
          themeColor: "indigo",
          purchases: []
        }
      ]
    }, null, 2)
  },
  {
    id: "pf-dependents",
    module: "pf",
    method: "GET",
    path: "/api/agent/v1/personal/dependents",
    title: "Listar Dependentes / Filhos",
    description: "Retorna a lista de nomes dos dependentes/filhos cadastrados no perfil do usuário.",
    sampleResponseJson: JSON.stringify({ data: ["Matheus", "Sofia"] }, null, 2)
  },
  {
    id: "pf-scan",
    module: "pf",
    method: "POST",
    path: "/api/agent/v1/personal/scan",
    title: "Escanear Comprovante com IA",
    description: "Envia o texto ou imagem de um comprovante fiscal/recibo para leitura automática e estruturação via Inteligência Artificial.",
    bodyParams: [
      { name: "receiptText", type: "string", desc: "Texto OCR ou conteúdo copiado do comprovante" },
      { name: "imageBase64", type: "string", desc: "Imagem do recibo codificada em Base64" }
    ],
    sampleRequestJson: JSON.stringify({
      receiptText: "COTO C.I.C.S.A. TICKET FACTURA A BUE 14/09/2026 TOTAL $ 24.500"
    }, null, 2),
    sampleResponseJson: JSON.stringify({
      parsed: {
        merchant: "COTO C.I.C.S.A.",
        amount: 24500,
        currency: "ARS",
        category: "Alimentação & Supermercado",
        date: "2026-09-14"
      }
    }, null, 2)
  },

  // PJ Endpoints
  {
    id: "pj-get-clients",
    module: "pj",
    method: "GET",
    path: "/api/agent/v1/clients",
    title: "Listar Clientes (PJ)",
    description: "Lista os clientes da agência com paginação e status.",
    queryParams: [
      { name: "limit", type: "number", desc: "Padrão 50, máximo 200" },
      { name: "offset", type: "number", desc: "Padrão 0" }
    ],
    sampleResponseJson: JSON.stringify({
      data: [
        { id: "c123", name: "Cliente Exemplo Ltda", status: "active", currency: "BRL" }
      ],
      count: 1
    }, null, 2)
  },
  {
    id: "pj-metrics",
    module: "pj",
    method: "GET",
    path: "/api/agent/v1/dashboard/metrics",
    title: "Métricas Gerais da Empresa (PJ)",
    description: "Retorna faturamento, MRR, inadimplência, gráfico mensal e resumo financeiro empresarial.",
    sampleResponseJson: JSON.stringify({
      mrr: 45000,
      activeClients: 18,
      overdueClients: 1,
      overdueAmount: 2500,
      periodReceived: 42500,
      periodExpense: 12000
    }, null, 2)
  },
  {
    id: "pj-billing-confirm",
    module: "pj",
    method: "POST",
    path: "/api/agent/v1/billing/payments/confirm",
    title: "Confirmar Pagamento de Cliente (PJ)",
    description: "Confirma o pagamento de uma mensalidade de contrato de cliente e interrompe cobranças automáticas de atraso no WhatsApp (D+2 e D+5).",
    bodyParams: [
      { name: "contractId", type: "string", desc: "ID do contrato (opcional se phone ou clientId forem únicos)" },
      { name: "phone", type: "string", desc: "Telefone do cliente cadastrado" },
      { name: "dueDate", type: "string", desc: "Data do vencimento no formato YYYY-MM-DD" },
      { name: "amount", type: "number", desc: "Valor pago (padrão o valor fixo do contrato)" }
    ],
    sampleRequestJson: JSON.stringify({
      phone: "5511999999999",
      dueDate: "2026-09-05"
    }, null, 2),
    sampleResponseJson: JSON.stringify({
      confirmation: {
        id: "conf-123",
        dueDate: "2026-09-05",
        amount: "2500.00",
        source: "agent"
      },
      alreadyConfirmed: false,
      dunningCancelled: ["overdue_d2", "overdue_d5"]
    }, null, 2)
  }
];

export default function ApiDocsPage() {
  const [filterModule, setFilterModule] = useState<"all" | "pf" | "pj">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeSnippetTab, setActiveSnippetTab] = useState<Record<string, "curl" | "python" | "node">>({});

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://financeiro.casaldotrafego.com";

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredEndpoints = ENDPOINTS.filter(ep => {
    if (filterModule !== "all" && ep.module !== filterModule) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return ep.path.toLowerCase().includes(q) || ep.title.toLowerCase().includes(q) || ep.description.toLowerCase().includes(q);
    }
    return true;
  });

  const generateSnippet = (ep: EndpointDoc, lang: "curl" | "python" | "node") => {
    const fullUrl = `${baseUrl}${ep.path}`;
    
    if (lang === "curl") {
      let cmd = `curl -X ${ep.method} "${fullUrl}" \\\n  -H "Authorization: Bearer SUA_AGENT_API_KEY" \\\n  -H "x-agent-actor: super_agente_v1"`;
      if (ep.sampleRequestJson && (ep.method === "POST" || ep.method === "PATCH")) {
        cmd += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${ep.sampleRequestJson.replace(/\n/g, "")}'`;
      }
      return cmd;
    }

    if (lang === "python") {
      let code = `import requests\n\nurl = "${fullUrl}"\nheaders = {\n    "Authorization": "Bearer SUA_AGENT_API_KEY",\n    "x-agent-actor": "super_agente_v1",\n    "Content-Type": "application/json"\n}\n`;
      if (ep.sampleRequestJson && (ep.method === "POST" || ep.method === "PATCH")) {
        code += `data = ${ep.sampleRequestJson}\nresponse = requests.${ep.method.toLowerCase()}(url, headers=headers, json=data)\n`;
      } else {
        code += `response = requests.${ep.method.toLowerCase()}(url, headers=headers)\n`;
      }
      code += `print(response.json())`;
      return code;
    }

    // Node.js fetch
    let nodeCode = `const response = await fetch("${fullUrl}", {\n  method: "${ep.method}",\n  headers: {\n    "Authorization": "Bearer SUA_AGENT_API_KEY",\n    "x-agent-actor": "super_agente_v1",\n    "Content-Type": "application/json"\n  }`;
    if (ep.sampleRequestJson && (ep.method === "POST" || ep.method === "PATCH")) {
      nodeCode += `,\n  body: JSON.stringify(${ep.sampleRequestJson})`;
    }
    nodeCode += `\n});\nconst data = await response.json();\nconsole.log(data);`;
    return nodeCode;
  };

  const getMethodBadgeClass = (method: string) => {
    switch (method) {
      case "GET": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "POST": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "PATCH": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "DELETE": return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      default: return "bg-zinc-800 text-zinc-300";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-zinc-900 to-indigo-950 p-6 rounded-2xl border border-purple-500/20 shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Code className="w-6 h-6 text-purple-400" />
              Documentação da API do Agente
            </h1>
            <p className="text-xs text-zinc-300 max-w-2xl">
              Conecte seu Super Agente (Telegram, Claude, automações N8N ou scripts Python) diretamente à plataforma financeira (PF & PJ).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://github.com/drtrafego/gerenciador_financeiro"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-all border border-zinc-700"
            >
              <ExternalLink size={14} className="text-purple-400" />
              <span>Ver no GitHub</span>
            </a>
          </div>
        </div>

        {/* Guia de Autenticação Rápida */}
        <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="flex items-start gap-3">
            <Key className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">1. Autenticação via Bearer Token</p>
              <p className="text-zinc-400 text-[11px] mt-0.5">
                Envie a variável <code className="text-purple-300 bg-purple-950/60 px-1 py-0.5 rounded">AGENT_API_KEY</code> no cabeçalho HTTP:
              </p>
              <code className="block mt-1 p-1.5 bg-zinc-900 rounded text-zinc-300 font-mono text-[11px] border border-zinc-800">
                Authorization: Bearer SUA_CHAVE_AQUI
              </code>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">2. Identificação do Ator (Audit Log)</p>
              <p className="text-zinc-400 text-[11px] mt-0.5">
                Opcional: envie o identificador da origem para o registro de auditoria:
              </p>
              <code className="block mt-1 p-1.5 bg-zinc-900 rounded text-zinc-300 font-mono text-[11px] border border-zinc-800">
                x-agent-actor: telegram:123456789
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Bar de Pesquisa & Filtros */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
          <button
            onClick={() => setFilterModule("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              filterModule === "all"
                ? "bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/20"
                : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white"
            }`}
          >
            Todos os Endpoints ({ENDPOINTS.length})
          </button>
          <button
            onClick={() => setFilterModule("pf")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              filterModule === "pf"
                ? "bg-pink-600 text-white border-pink-500 shadow-md shadow-pink-600/20"
                : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white"
            }`}
          >
            <Home size={13} />
            <span>Finanças Pessoais (PF)</span>
          </button>
          <button
            onClick={() => setFilterModule("pj")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              filterModule === "pj"
                ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20"
                : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white"
            }`}
          >
            <Building2 size={13} />
            <span>Empresa (PJ)</span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por rota ou nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-purple-500 outline-none"
          />
        </div>
      </div>

      {/* Lista de Endpoints */}
      <div className="space-y-4">
        {filteredEndpoints.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-zinc-800 rounded-2xl space-y-2">
            <p className="text-sm font-semibold text-zinc-400">Nenhum endpoint encontrado para sua busca.</p>
            <p className="text-xs text-zinc-500">Tente buscar por termos como 'transactions', 'personal' ou 'clients'.</p>
          </div>
        ) : (
          filteredEndpoints.map((ep) => {
            const currentTab = activeSnippetTab[ep.id] || "curl";
            const snippet = generateSnippet(ep, currentTab);

            return (
              <div key={ep.id} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4 hover:border-zinc-700 transition-colors">
                {/* Header do Endpoint */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-lg border font-mono font-bold text-xs ${getMethodBadgeClass(ep.method)}`}>
                        {ep.method}
                      </span>
                      <span className="font-mono text-sm font-bold text-white">{ep.path}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                        ep.module === 'pf' ? 'bg-pink-500/10 text-pink-300 border-pink-500/20' : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                      }`}>
                        {ep.module === 'pf' ? 'Finanças Pessoais' : 'Empresa PJ'}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-zinc-200 mt-1">{ep.title}</h3>
                    <p className="text-xs text-zinc-400">{ep.description}</p>
                  </div>

                  <button
                    onClick={() => handleCopy(snippet, ep.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-800 transition-colors self-start md:self-auto"
                  >
                    {copiedId === ep.id ? (
                      <>
                        <Check size={14} className="text-emerald-400" />
                        <span className="text-emerald-400">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} className="text-purple-400" />
                        <span>Copiar Chamada</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Parâmetros se houver */}
                {((ep.queryParams && ep.queryParams.length > 0) || (ep.bodyParams && ep.bodyParams.length > 0)) && (
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider">Parâmetros & Atributos:</p>
                    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950">
                      <table className="w-full text-left text-xs text-zinc-300">
                        <thead className="bg-zinc-900/80 text-zinc-400 font-semibold text-[10px]">
                          <tr>
                            <th className="p-2.5">Campo</th>
                            <th className="p-2.5">Tipo</th>
                            <th className="p-2.5">Obrigatório</th>
                            <th className="p-2.5">Descrição</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                          {ep.queryParams?.map(p => (
                            <tr key={p.name} className="hover:bg-zinc-900/30">
                              <td className="p-2.5 text-purple-300 font-bold">{p.name} <span className="text-[9px] text-zinc-500 font-sans">(query)</span></td>
                              <td className="p-2.5 text-zinc-400">{p.type}</td>
                              <td className="p-2.5">{p.required ? <span className="text-rose-400 font-bold">Sim</span> : <span className="text-zinc-600">Não</span>}</td>
                              <td className="p-2.5 text-zinc-300 font-sans">{p.desc}</td>
                            </tr>
                          ))}
                          {ep.bodyParams?.map(p => (
                            <tr key={p.name} className="hover:bg-zinc-900/30">
                              <td className="p-2.5 text-pink-300 font-bold">{p.name} <span className="text-[9px] text-zinc-500 font-sans">(body)</span></td>
                              <td className="p-2.5 text-zinc-400">{p.type}</td>
                              <td className="p-2.5">{p.required ? <span className="text-rose-400 font-bold">Sim</span> : <span className="text-zinc-600">Não</span>}</td>
                              <td className="p-2.5 text-zinc-300 font-sans">{p.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Exemplo de Código Tabbed */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-zinc-950 px-3 py-2 rounded-t-xl border-t border-x border-zinc-800">
                    <div className="flex items-center gap-2">
                      <Terminal size={14} className="text-purple-400" />
                      <span className="text-xs font-bold text-zinc-300">Exemplo de Código</span>
                    </div>

                    <div className="flex gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
                      <button
                        onClick={() => setActiveSnippetTab({ ...activeSnippetTab, [ep.id]: "curl" })}
                        className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md transition-colors ${
                          currentTab === "curl" ? "bg-purple-600 text-white" : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        cURL
                      </button>
                      <button
                        onClick={() => setActiveSnippetTab({ ...activeSnippetTab, [ep.id]: "python" })}
                        className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md transition-colors ${
                          currentTab === "python" ? "bg-purple-600 text-white" : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        Python
                      </button>
                      <button
                        onClick={() => setActiveSnippetTab({ ...activeSnippetTab, [ep.id]: "node" })}
                        className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md transition-colors ${
                          currentTab === "node" ? "bg-purple-600 text-white" : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        Node.js
                      </button>
                    </div>
                  </div>

                  <pre className="p-3.5 bg-zinc-950 rounded-b-xl border border-zinc-800 text-xs font-mono text-zinc-300 overflow-x-auto leading-relaxed">
                    <code>{snippet}</code>
                  </pre>
                </div>

                {/* Resposta JSON de Exemplo */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-zinc-400">Resposta de Sucesso (HTTP 200/201):</span>
                  <pre className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800/80 text-[11px] font-mono text-emerald-400/90 overflow-x-auto max-h-48">
                    <code>{ep.sampleResponseJson}</code>
                  </pre>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
