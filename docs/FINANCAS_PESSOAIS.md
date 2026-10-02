# 📊 Documentação Completa: Módulo de Finanças Pessoais (PF) — Família & Negócio

Este documento descreve a arquitetura, estrutura de dados, regras de negócio, telas da interface, controle de acesso para múltiplos usuários e endpoints de API do módulo de **Finanças Pessoais (Pessoa Física - PF)** integrado ao Gerenciador Financeiro.

---

## 1. Visão Geral

O módulo PF permite a gestão financeira pessoal da família (Gastão e Amanda), consolidando extratos bancários, cartões de crédito internacionais (Argentina e Brasil), orçamentos mensais por categoria e comprovantes lidos via Inteligência Artificial.

### Destaques Principais:
- **1.846 Lançamentos Reais Auditados** (Abril a Setembro de 2026):
  - **Banco Galicia (Gastão):** 653 operações.
  - **Mercado Pago (Amanda):** 1.193 operações (84 páginas de extrato reconciliadas centavo a centavo).
- **Filtro Familiar em Tempo Real:** Visualização consolidada (`Todos`), individual (`Gastão`, `Amanda`) e despesas dos filhos/escola (`Colégio Misericórdia`).
- **Cotação em Tempo Real da Internet (Dólar Blue):**
  - Integração com a **DolarApi** e **ExchangeRate-API**.
  - Padrão do sistema: **Dólar Blue** (~**300.35 ARS / R$ 1,00**), com suporte ao câmbio oficial do BCRA (~291.99 ARS) e ajuste manual.
- **Acesso Multi-usuário:** Disponível para ambos os usuários do sistema empresarial através do menu lateral, seletor de perfil e link direto `/personal`.

---

## 2. Como Acessar o Módulo (Ambos os Usuários)

Existem 3 formas de acessar as Finanças Pessoais:

1. **Menu Lateral (Sidebar):**
   - Na seção **Finanças Pessoais (Família)**, disponível tanto no modo Empresa quanto no modo Pessoal.
   - Itens diretos:
     - 🏠 **Gastos Pessoais**: `/personal`
     - 💳 **Cartões de Crédito (ARS/BRL)**: `/credit-cards`
     - 📊 **Categorias & Metas**: `/personal-categories`
     - ✨ **Escanear Cupom (IA)**: `/scan`
2. **Alternador de Perfil (Cabeçalho & Menu):**
   - Botão **`[🏢 EMPRESA (PJ)]`** ⇄ **`[🏠 PESSOAL (PF)]`**.
   - Clicar em **Pessoal (PF)** alterna o contexto da aplicação e redireciona automaticamente para o dashboard pessoal.
3. **URL Direta:**
   - Acesse diretamente: `https://financeiro.casaldotrafego.com/personal`

---

## 3. Telas e Recursos da Interface

### 3.1. Dashboard de Gastos Pessoais (`/personal` ou `/dashboard` em modo PF)
- **Cards de Métricas:**
  - **Total de Gastos no Período:** Valor total em Reais e em Pesos Argentinos (convertido ao vivo).
  - **Gastos Amanda:** Total individual, quantidade de transações e valor em ARS.
  - **Gastos Gastão:** Total individual, quantidade de transações e valor em ARS.
  - **Colégio Misericórdia:** Total específico da mensalidade e material escolar.
  - **Projeção Mensal & Média Diária:** Estimativa de fechamento do mês com base nos dias transcorridos.
- **Gráficos:**
  - **Comparativo Mensal (Amanda vs Gastão):** Barras mês a mês (Abril a Setembro) destacando a divisão dos gastos do casal.
  - **Distribuição por Categoria:** Rosca interativa mostrando o percentual consumido em cada categoria.
- **Extrato Completo com Paginação e Filtros:**
  - Busca por nome do estabelecimento ou descrição.
  - Filtro por membro: `Todos`, `Gastão`, `Amanda`, `Colégio Misericórdia`.
  - Filtro por moeda: `Todas`, `ARS` (Pesos), `BRL` (Reais), `USD` (Dólares).
  - Filtro de transferências entre contas próprias (para evitar dupla contagem de gastos).
  - Lançamento manual de novas despesas ou receitas.
  - Edição e exclusão de transações existentes.

### 3.2. Cartões de Crédito (`/credit-cards`)
- **Cartões Configurados:**
  - **Tarjeta Visa Signature** (Banco Galicia Argentina - ARS) — Limite: $ 3.500.000 ARS.
  - **Cartão Nubank Ultravioleta** (Nubank Brasil - BRL) — Limite: R$ 25.000,00.
- **Funcionalidades:**
  - Barra de progresso do limite de crédito utilizado.
  - Indicador de dias de fechamento e dias de vencimento da fatura.
  - Edição do valor base da fatura atual.
  - Lançamento de compras no cartão com opção de parcelamento (À vista, 2x, 3x, 6x, 12x).

### 3.3. Categorias & Metas de Orçamento (`/personal-categories`)
- **Categorias Padrão com Tetos Orçamentários:**
  - 👦 **Filhos & Família:** Limite R$ 3.500/mês (Escola, Natação, Vestuário).
  - 🍕 **Alimentação & Supermercado:** Limite R$ 4.500/mês (Coto, Carrefour, Restaurantes).
  - 🥳 **Lazer & Entretenimento:** Limite R$ 2.000/mês (Passeios, Cinema, Assinaturas, Vinho).
  - 🏠 **Moradia & Serviços:** Limite R$ 5.000/mês (Aluguel, Luz/Edesur, Gás & Água).
  - 💊 **Saúde & Bem-Estar:** Limite R$ 2.500/mês (OSDE, Farmacity).
  - 🚗 **Transporte & Veículo:** Limite R$ 1.800/mês (Combustível YPF/Shell, Uber, Cabify).
- **Customização:** Adição de novas categorias, criação de novas subcategorias e personalização de cores e emojis.

### 3.4. Scanner com Inteligência Artificial (`/scan`)
- Leitor OCR inteligente que recebe imagens de recibos, comprovantes bancários ou notas fiscais e extrai automaticamente:
  - Estabelecimento / Loja
  - Valor total
  - Moeda (ARS, BRL, USD)
  - Data da despesa
  - Categoria sugerida

---

## 4. Cotações e Conversão de Moedas

A conversão de moedas é obtida automaticamente da internet via `/api/currency/rates`:
- **Câmbio Oficial Dólar Blue (Padrão do Sistema):** **1 R$ = ~300.35 ARS**.
  - Este é o valor real de mercado efetivamente praticado no dia a dia para remessas e pagamentos em pesos argentinos.
- **Banco Central BCRA (Oficial):** **1 R$ = ~291.99 ARS**.
- **Badge e Ajuste:**
  - Exibido no cabeçalho do extrato pessoal: `💱 Câmbio Blue: 1 R$ = 300.35 ARS [🌐 Dólar Blue Ao Vivo] [✏️]`.
  - Clicando no lápis **`[✏️]`**, o usuário pode alternar digitando:
    - `auto` ou `blue`: retorna ao câmbio Blue ao vivo da internet.
    - `oficial`: usa o câmbio oficial do BCRA.
    - Qualquer número (ex: `305` ou `310`): fixa uma taxa manual personalizada.

---

## 5. Endpoints da API Externa (`/api/agent/v1/personal`)

O super agente (Telegram / WhatsApp) pode consultar e registrar dados de pessoa física através dos endpoints autenticados:

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/agent/v1/personal/transactions` | Lista transações pessoais paginadas, com filtros por data (`from`/`to`), tipo, categoria e moeda. |
| `POST` | `/api/agent/v1/personal/transactions` | Registra uma nova despesa ou receita pessoal. |
| `DELETE` | `/api/agent/v1/personal/transactions?id={id}` | Exclui uma transação pessoal. |
| `GET` | `/api/agent/v1/personal/categories` | Lista categorias ativas e orçamentos. |
| `POST` | `/api/agent/v1/personal/categories` | Cria ou atualiza categorias e limites orçamentários. |
| `GET` | `/api/agent/v1/personal/credit-cards` | Lista cartões de crédito, faturas e limites. |
| `POST` | `/api/agent/v1/personal/credit-cards` | Registra novo cartão ou fatura base. |
| `GET` | `/api/agent/v1/personal/dependents` | Lista filhos e dependentes vinculados. |
| `POST` | `/api/agent/v1/personal/dependents` | Adiciona dependente/filho. |
| `POST` | `/api/agent/v1/personal/scan` | Submete comprovante em base64 ou texto para processamento de IA. |
| `GET` | `/api/currency/rates` | Retorna as cotações em tempo real da internet (Dólar Blue, BCRA, USD/BRL, USD/ARS). |

---

## 6. Estrutura de Arquivos no Projeto

```
dr-trafego-finance/
├── app/
│   ├── (dashboard)/
│   │   ├── personal/page.tsx               # Rota direta do Painel Pessoal
│   │   ├── dashboard/page.tsx              # Dashboard PJ (com alternador PF)
│   │   ├── credit-cards/page.tsx           # Gestão de Cartões de Crédito
│   │   ├── personal-categories/page.tsx    # Categorias e Metas Pessoais
│   │   ├── scan/page.tsx                   # Scanner de Comprovantes com IA
│   │   └── settings/page.tsx               # Configurações gerais e dependentes
│   └── api/
│       ├── currency/rates/route.ts         # API de cotações em tempo real (DolarApi)
│       ├── personal/local-data/route.ts    # Sincronização de extratos locais
│       └── agent/v1/personal/              # Endpoints da API externa para agente
├── components/
│   ├── dashboard/
│   │   └── PersonalDashboardView.tsx       # Componente do painel de gastos pessoais
│   └── shared/
│       ├── Sidebar.tsx                     # Menu lateral com links PJ e PF
│       ├── Header.tsx                      # Cabeçalho com ProfileSwitcher
│       └── ProfileSwitcher.tsx             # Botões de alternância PJ / PF
├── lib/
│   ├── transactionData.ts                  # Base consolidada de 1.846 lançamentos
│   ├── contexts/ProfileContext.tsx         # Gerenciamento de estado de perfil (PJ/PF)
│   └── currency/format.ts                  # Utilitários de conversão monetária
└── docs/
    ├── FINANCAS_PESSOAIS.md                # Esta documentação
    └── AGENT_API.md                        # Documentação da API externa do agente
```
