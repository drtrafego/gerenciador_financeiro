# Casal do Tráfego — Gerenciador Financeiro

Sistema de gestão financeira completo para agência de tráfego pago (Meta Ads + Google Ads).

---

## Visão Geral

Controle de clientes, contratos, mensalidades, fluxo de caixa e emissão de propostas/faturas.
Multi-moeda (BRL / USD / ARS) com cotação automática via backend.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Banco de dados | Neon PostgreSQL serverless |
| ORM | Drizzle ORM |
| Auth | Stack Auth (substituindo NextAuth do repo base) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Gráficos | Recharts |
| PDF | @react-pdf/renderer |
| Formulários | React Hook Form + Zod |
| Cron | Vercel Cron (nativo) |
| Deploy | Vercel |

---

## Base do Projeto

Clonado de: `https://github.com/nextjs/saas-starter`

O repo base já provê:
- Next.js 15 + App Router + TypeScript
- Drizzle ORM + PostgreSQL (tabelas: users, teams, teamMembers, activityLogs, invitations)
- Auth própria via JWT/cookie (a ser **substituída** pelo Stack Auth)
- Dashboard layout base com shadcn/ui + Tailwind
- Stripe integrado (não será usado neste projeto)

### O que será removido do repo base
- `next-auth` / auth via JWT cookie customizado
- Stripe (checkout, webhook)
- Tabelas `users`, `teams`, `teamMembers`, `invitations` → gerenciadas pelo Stack Auth
- Página `/pricing`

---

## Módulos do Sistema

### 1. Clientes (`/clients`)
- CRUD completo
- Campos: nome, contato, email, telefone, moeda padrão, status, notas
- Status: `active` | `inactive` | `overdue`

### 2. Contratos (`/contracts`)
- Vinculados a clientes
- Tipos de fee:
  - `fixed_fee` — valor fixo mensal
  - `fixed_plus_percentage` — fixo + % sobre verba
  - `project` — projeto pontual
- Campos: dia de vencimento, data início/fim, moeda, status

### 3. Faturas (`/invoices`)
- Tipos: `monthly` | `project` | `proposal`
- Status: `draft` → `sent` → `paid` (ou `overdue` / `cancelled`)
- Numeração automática: `INV-2026-001`
- Geração de PDF via @react-pdf/renderer
- Página pública `/invoice/[id]` (sem autenticação)

### 4. Transações (`/transactions`)
- Tipos: `income` | `expense`
- Categorias livres
- Vinculadas a faturas e/ou clientes

### 5. Fluxo de Caixa (`/cash-flow`)
- Visão mensal de entradas e saídas
- Gráfico de barras (Recharts)
- Projeção baseada em contratos ativos

### 6. Configurações (`/settings`)
- Dados da agência (nome, email)
- Moeda preferida do dashboard (global para todos os usuários)
- Widget de cotação ao vivo
- Histórico de cotações dos últimos 30 dias

---

## Sistema de Cotação Multi-Moeda

### APIs em cascata (ordem de prioridade)

1. **Frankfurter** — `https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL,ARS`
   - Gratuita, sem API key, dados do BCE, atualiza ~16h CET

2. **ExchangeRate-API** — `https://open.er-api.com/v6/latest/USD`
   - Fallback gratuito sem key, atualiza 1x/dia

3. **fawazahmed0** — `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json`
   - Fallback CDN jsDelivr, 200+ moedas, sem rate limit

### Cron Job
- Rota: `GET /api/cron/update-rates`
- Agendamento: `0 21 * * *` (21h UTC = 18h Brasília)
- Proteção: header `Authorization: Bearer CRON_SECRET`
- Salva cotações na tabela `exchange_rates`

---

## Schema do Banco de Dados

### Tabelas novas (além do repo base)

#### `exchange_rates`
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| usd_brl | decimal(10,4) | Cotação USD→BRL |
| usd_ars | decimal(10,4) | Cotação USD→ARS |
| ars_brl | decimal(10,6) | Cotação ARS→BRL |
| source | text | API usada (frankfurter/er-api/fawazahmed0) |
| fetched_at | timestamp | Data da busca |

#### `system_settings`
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| key | text unique | Chave da configuração |
| value | text | Valor |
| updated_at | timestamp | Última atualização |

Registros padrão: `display_currency=BRL`, `agency_name=Casal do Tráfego`, `agency_email=...`

#### `clients`
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| name | text | Nome do cliente |
| contact_name | text | Nome do contato |
| email | text | Email |
| phone | text | Telefone |
| currency | enum | BRL \| USD \| ARS |
| status | enum | active \| inactive \| overdue |
| notes | text | Observações |

#### `contracts`
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| client_id | uuid FK | Cliente |
| type | enum | fixed_fee \| fixed_plus_percentage \| project |
| fixed_amount | decimal(10,2) | Valor fixo |
| percentage | decimal(5,2) | % sobre verba |
| ad_budget | decimal(10,2) | Verba gerenciada |
| currency | enum | BRL \| USD \| ARS |
| billing_day | integer | Dia do mês para cobrança |
| start_date | date | Início |
| end_date | date | Fim (opcional) |
| status | enum | active \| paused \| cancelled |

#### `invoices`
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| invoice_number | text unique | ex: INV-2026-001 |
| client_id | uuid FK | Cliente |
| contract_id | uuid FK | Contrato (opcional) |
| type | enum | monthly \| project \| proposal |
| amount | decimal(10,2) | Valor |
| currency | enum | BRL \| USD \| ARS |
| status | enum | draft \| sent \| paid \| overdue \| cancelled |
| due_date | date | Vencimento |
| paid_at | timestamp | Data do pagamento |

#### `transactions`
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| type | enum | income \| expense |
| category | text | Categoria |
| description | text | Descrição |
| amount | decimal(10,2) | Valor |
| currency | enum | BRL \| USD \| ARS |
| date | date | Data |
| invoice_id | uuid FK | Fatura vinculada (opcional) |
| client_id | uuid FK | Cliente vinculado (opcional) |

---

## Autenticação — Stack Auth

Substituir o sistema de JWT cookie do saas-starter pelo Stack Auth.

### Arquivos gerados pelo wizard (`npx @stackframe/init-stack@latest`)
- `stack/server.ts` — `stackServerApp` para Server Components
- `stack/client.ts` — `stackClientApp` para Client Components
- `app/handler/[...stack]/page.tsx` — rotas de sign-in/sign-up

### Variáveis de ambiente necessárias
```
NEXT_PUBLIC_STACK_PROJECT_ID=
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=
STACK_SECRET_SERVER_KEY=
```

### RBAC
- Roles: `admin` | `viewer`
- Configurado via dashboard do Stack Auth
- Verificação: `await user.hasPermission('admin')`

---

## Variáveis de Ambiente

```env
# Banco de dados
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require

# Stack Auth
NEXT_PUBLIC_STACK_PROJECT_ID=
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=
STACK_SECRET_SERVER_KEY=

# Vercel Cron
CRON_SECRET=string_aleatoria_segura

# App
NEXT_PUBLIC_APP_NAME=Casal do Tráfego
NEXT_PUBLIC_APP_URL=https://finance.drtrafego.com.br
```

---

## Design System

| Elemento | Valor |
|---|---|
| Modo | Dark por padrão |
| Cor primária | indigo-500 (`#6366f1`) |
| Background | zinc-950 |
| Cards | zinc-900 + border zinc-800 |
| Fonte | Inter |

### Status Badges
| Status | Cor |
|---|---|
| active / paid | green-500 |
| overdue | red-500 |
| draft | zinc-400 |
| sent | blue-500 |
| cancelled | zinc-600 |
| paused | yellow-500 |

---

## Estrutura de Pastas (additions ao repo base)

```
/
├── app/
│   ├── (dashboard)/
│   │   ├── page.tsx                    ← dashboard home com métricas
│   │   ├── clients/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── contracts/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── invoices/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── cash-flow/page.tsx
│   │   ├── transactions/
│   │   │   ├── page.tsx
│   │   │   └── new/page.tsx
│   │   └── settings/
│   │       ├── page.tsx
│   │       ├── exchange-rates/page.tsx
│   │       └── users/page.tsx
│   ├── api/
│   │   └── cron/
│   │       └── update-rates/route.ts
│   └── invoice/
│       └── [id]/page.tsx               ← pública, sem auth
├── lib/
│   ├── currency/
│   │   ├── fetchRates.ts               ← 3 APIs em cascata
│   │   └── format.ts                   ← formatCurrency + convertAmount
│   └── db/
│       └── schema.ts                   ← schema completo
├── components/
│   ├── dashboard/
│   │   ├── MetricCard.tsx
│   │   ├── RevenueChart.tsx
│   │   ├── CashFlowChart.tsx
│   │   └── OverdueList.tsx
│   ├── invoices/
│   │   └── InvoicePDF.tsx
│   └── settings/
│       └── ExchangeRateWidget.tsx
└── vercel.json                         ← cron config
```

---

## Convenções

- Valores monetários: `decimal(10,2)` no banco — nunca `float`
- Datas: UTC no banco, exibidas em `America/Sao_Paulo`
- Mutações: Server Actions (não API routes para CRUD)
- Loading: Suspense + skeletons
- Feedback: Toast via shadcn Sonner
- Paginação: 10 itens por página
- Layout: sidebar colapsável, mobile responsive

---

## Ordem de Implementação

1. [ ] Clonar saas-starter + conectar ao Neon
2. [ ] `pnpm db:push` — schema base
3. [ ] Adicionar tabelas novas no schema.ts + migrar
4. [ ] `lib/currency/fetchRates.ts` — 3 APIs em cascata
5. [ ] `app/api/cron/update-rates/route.ts` + `vercel.json`
6. [ ] `lib/currency/format.ts` — formatCurrency + convertAmount
7. [ ] Substituir dashboard home com métricas da agência
8. [ ] Módulo Clientes (CRUD)
9. [ ] Módulo Contratos
10. [ ] Módulo Faturas + geração de PDF
11. [ ] Fluxo de Caixa + Transações
12. [ ] Configurações + widget de cotação
13. [ ] Página pública `/invoice/[id]`
14. [ ] Testar cron + fallback de APIs
15. [ ] Deploy Vercel + variáveis de ambiente + ativar cron
