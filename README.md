# DR.TRÁFEGO Finance

Sistema financeiro completo para agências de tráfego pago. Gestão de clientes, contratos, faturas, transações e fluxo de caixa com suporte a múltiplas moedas (BRL, USD, ARS).

## Stack

- **Next.js 15** (App Router, Server Components, Server Actions)
- **TypeScript** strict
- **Tailwind CSS v4** + shadcn/ui
- **Drizzle ORM** + **PostgreSQL** (Neon)
- **Stack Auth** (autenticação JWT + convites)
- **Nodemailer** (envio de recibos via Gmail SMTP)
- **Vercel Blob** (armazenamento de PDFs de contratos)
- **Stripe** (pagamentos)
- **Recharts** (gráficos)
- Deploy: **Vercel**

---

## Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
# Banco de dados (Neon PostgreSQL)
POSTGRES_URL=postgresql://user:password@host/dbname?sslmode=require

# Stack Auth
NEXT_PUBLIC_STACK_PROJECT_ID=
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=pck_***
STACK_SECRET_SERVER_KEY=ssk_***

# Segurança
AUTH_SECRET=
CRON_SECRET=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Email (Gmail SMTP)
GMAIL_USER=seuemail@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

---

## Setup

```bash
# Instalar dependências
pnpm install

# Rodar migrações do banco
pnpm db:migrate

# Iniciar dev server
pnpm dev
```

---

## Scripts

| Script | Descrição |
|--------|-----------|
| `pnpm dev` | Dev server com Turbopack |
| `pnpm build` | Build de produção |
| `pnpm start` | Servidor de produção |
| `pnpm db:migrate` | Executar migrações |
| `pnpm db:generate` | Gerar novas migrações a partir do schema |
| `pnpm db:studio` | Abrir Drizzle Studio (UI visual do banco) |
| `pnpm db:seed` | Popular banco com dados de desenvolvimento |

> **Atenção:** `pnpm db:migrate` requer `POSTGRES_URL` no ambiente. Em desenvolvimento, as variáveis do `.env.local` não são carregadas automaticamente pelo drizzle-kit. Use:
> ```bash
> node -e "require('dotenv').config({path:'.env.local'}); const {execSync} = require('child_process'); execSync('pnpm db:migrate', {stdio:'inherit', env: process.env});"
> ```

---

## Módulos

### Clientes
- Cadastro com nome, contato, email, telefone, moeda preferida e status
- Campo `document` (CPF/CNPJ) para uso em recibos
- Status: `active` | `inactive` | `overdue`

### Contratos
- Vinculados a clientes
- Campo **Nome do Serviço** para diferenciar múltiplos contratos do mesmo cliente (ex: "Tráfego Meta Ads", "Google Ads")
- Tipos de contrato: `fixed_fee` | `fixed_plus_percentage` | `project`
- Suporte a PDF do contrato (armazenado no Vercel Blob)
- Dia de cobrança configurável por contrato

### Faturas
- Numeração automática: `INV-YYYY-XXX`
- Tipos: `monthly` | `project` | `proposal`
- Status: `draft` | `sent` | `paid` | `overdue` | `cancelled`
- Ao selecionar um contrato, valor e moeda são preenchidos automaticamente
- Campo **Forma de pagamento** por fatura (cada cliente paga de forma diferente)
- Marcar como paga cria uma transação de receita automaticamente
- Envio de recibo por email (Gmail SMTP) com destinatário digitado no momento

### Recibo Público (`/invoice/[id]`)
- Página pública sem autenticação
- Dados da empresa (Construa Seu Sucesso) carregados das configurações
- Campos exibidos: CNPJ, endereço completo, cidade, e-mail
- Valor por extenso em português (BRL/USD/ARS)
- Forma de pagamento da fatura
- Linha de assinatura com "Cidade, DD de mês de AAAA"
- Botão de impressão (CSS print-friendly)

### Transações
- Tipos: `income` | `expense`
- Suporte a **recorrência** com data de término opcional
- Opção de **IOF (3,38%)** para transações em USD pagas com cartão
- Categorização livre

### Fluxo de Caixa
- Visão consolidada de receitas e despesas
- Filtros por período e categoria
- Suporte a despesas recorrentes da agência

### Dashboard
- MRR (Monthly Recurring Revenue) com conversão de moedas
- Alertas de faturas vencidas e próximas do vencimento
- Gráficos de receita dos últimos 6 meses
- Clientes ativos e inadimplentes

### Configurações
- **Dados da empresa** (aparecem nos recibos): nome, CNPJ/CPF, endereço, cidade, e-mail
- **Moeda de exibição** padrão do sistema (BRL/USD/ARS)
- **Cotações de câmbio** (USD/BRL, USD/ARS, ARS/BRL) — atualização automática via cron diário
- **Ocultar valores** no dashboard

---

## Banco de Dados

### Tabelas principais

| Tabela | Descrição |
|--------|-----------|
| `users` | Usuários do sistema |
| `teams` | Times / empresas |
| `clients` | Clientes da agência |
| `contracts` | Contratos com clientes |
| `invoices` | Faturas emitidas |
| `transactions` | Receitas e despesas |
| `recurring_expenses` | Custos fixos mensais da agência |
| `exchange_rates` | Cotações de câmbio (atualizado por cron) |
| `system_settings` | Configurações chave-valor do sistema |

### Migrações disponíveis

| Arquivo | Descrição |
|---------|-----------|
| `0001_*` | Schema inicial |
| `0002_*` | Adições ao schema base |
| `0003_*` | Campos de recorrência em transações |
| `0004_*` | Tabela de despesas recorrentes |
| `0005_add_client_document.sql` | Campo CPF/CNPJ no cliente |
| `0006_add_invoice_payment_method.sql` | Forma de pagamento na fatura |
| `0007_add_contract_name.sql` | Nome do serviço no contrato |

---

## API Routes

| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/user` | GET | Dados do usuário autenticado |
| `/api/team` | GET | Dados do time do usuário |
| `/api/contracts/pdf?id=` | GET | Redirect para PDF do contrato |
| `/api/cron/update-rates` | GET | Atualiza cotações (requer `Authorization: Bearer $CRON_SECRET`) |

---

## Autenticação

Baseada em **JWT com cookies** + **Stack Auth** como provider OIDC.

- Login/cadastro com email e senha
- Convites por email com atribuição de papel (`member` | `owner`)
- Log de atividades automático (sign in, sign out, alterações de conta)
- Soft delete de contas (campo `deletedAt`)

---

## Deploy (Vercel)

1. Conectar repositório no Vercel
2. Configurar variáveis de ambiente no painel (Settings → Environment Variables)
3. Configurar cron job para atualização de cotações:
   ```
   GET /api/cron/update-rates
   Authorization: Bearer $CRON_SECRET
   Schedule: 0 9 * * 1-5  (dias úteis às 9h)
   ```
4. Fazer deploy — migrações devem ser rodadas manualmente na primeira vez

---

## Estrutura de Pastas

```
dr-trafego-finance/
├── app/
│   ├── (dashboard)/          # Rotas autenticadas
│   │   ├── clients/
│   │   ├── contracts/
│   │   ├── invoices/
│   │   ├── cash-flow/
│   │   ├── transactions/
│   │   ├── settings/
│   │   └── dashboard/
│   ├── (login)/              # Rotas de autenticação
│   ├── invoice/[id]/         # Recibo público (sem auth)
│   └── api/                  # API Routes
├── components/
│   ├── cashflow/
│   ├── clients/
│   ├── dashboard/
│   ├── invoices/
│   ├── settings/
│   └── ui/                   # Componentes base (shadcn)
├── lib/
│   ├── auth/                 # Sessão e middleware de auth
│   ├── currency/             # Conversão e formatação de moedas
│   ├── db/                   # Schema, queries, migrações
│   └── email/                # Gmail SMTP
└── server/
    └── actions/              # Server Actions reutilizáveis
```
