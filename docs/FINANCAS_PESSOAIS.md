# 📊 Documentação: Módulo de Finanças Pessoais (PF) — Gastão & Amanda

Este documento descreve a arquitetura, estrutura de dados, regras de extração e componentes do módulo de **Finanças Pessoais (Pessoa Física - PF)** integrado ao Gerenciador Financeiro do Casal do Tráfego.

---

## 1. Visão Geral

O módulo PF permite aos membros da família gerenciar e visualizar todo o fluxo financeiro pessoal (entradas, saídas, categorias de despesas, orçamentos e comparativos mês a mês) consolidando fontes bancárias distintas em uma interface unificada e responsiva.

### Destaques da Implementação:
- **1.846 Lançamentos Reais Consolidados** (período de Abril a Setembro de 2026).
- **Extratos Integrados:**
  - **Banco Galicia (Gastão):** 653 transações.
  - **Mercado Pago (Amanda):** 1.193 transações (84 páginas extraídas e auditadas até os centavos).
- **Filtro Familiar em Tempo Real:** Permite alternar instantaneamente entre `Todos`, `👤 Gastão` e `👤 Amanda`.
- **Cálculo Multi-moeda:** Conversão dinâmica e unificada entre **ARS** (Pesos Argentinos), **BRL** (Reais) e **USD** (Dólares).

---

## 2. Estrutura de Arquivos

| Arquivo | Descrição |
|---|---|
| `lib/transactionData.ts` | Base de dados modular com as 1.846 transações tipadas de Gastão e Amanda. |
| `components/dashboard/PersonalDashboardView.tsx` | Componente principal do dashboard PF ("use client"), contendo gráficos, KPIs, orçamentos, extrato e filtros. |
| `lib/ai/receiptScanner.ts` | Mecanismo de IA e OCR para importação e leitura de novos cupons/extratos. |
| `scratch/merge_amanda.py` | Script de automação e auditoria utilizado para extrair e validar o extrato do Mercado Pago. |
| `scratch/combined_personal_transactions.json` | Cópia JSON bruta de segurança dos 1.846 registros consolidados. |

---

## 3. Modelo de Dados (`PersonalTransaction`)

Cada lançamento respeita a interface TypeScript estrita definida em `PersonalDashboardView.tsx`:

```typescript
export interface PersonalTransaction {
  id: string;               // Identificador único (ex: tx-amanda-mp-123456 ou tx-galicia-...)
  date: string;             // Formato ISO: YYYY-MM-DD
  merchant: string;         // Nome amigável do estabelecimento ou descrição limpa
  description?: string;     // Descrição detalhada do extrato bancário
  amount: number;           // Valor absoluto positivo
  currency: Currency;       // 'ARS' | 'BRL' | 'USD'
  type: 'expense' | 'income'; // Despesa ou Receita
  category: string;         // Categoria normalizada em Português
  subcategory?: string;     // Subcategoria para detalhamento
  childTag?: string;        // Identificador familiar: 'Gastão' ou 'Amanda'
  parentTag?: string;       // Tag familiar complementar
  language: 'pt' | 'es';    // Idioma de detecção original
  selected?: boolean;       // Controle de seleção em massa
}
```

---

## 4. Auditoria e Validação dos Extratos

### Extrato Mercado Pago (Amanda Ferreira Felix Silva)
- **Documento original:** `media_1789587633646.pdf` (84 páginas de movimentações).
- **Período:** 01/04/2026 a 14/09/2026.
- **Validação de Totais com o Extrato Oficial:**
  - **Entradas Totais:** $\$ 12.735.544,76$ (100% conferido)
  - **Saídas Totais:** $\$ -12.722.018,87$ (100% conferido)
  - **Lançamentos Extraídos:** 1.193 operações.

### Extratos Banco Galicia (Gastão de Matos Junior)
- **Documento original:** Extratos mensais de Abril a Setembro de 2026.
- **Lançamentos Extraídos:** 653 operações.

### Distribuição Consolidada por Mês:
- **Setembro/2026:** 168 lançamentos
- **Agosto/2026:** 439 lançamentos
- **Julho/2026:** 348 lançamentos
- **Junho/2026:** 160 lançamentos
- **Maio/2026:** 430 lançamentos
- **Abril/2026:** 301 lançamentos
- **Total Geral:** **1.846 lançamentos**

---

## 5. Regras de Categorização Automática

O parser classifica os lançamentos de acordo com as seguintes regras de negócio:

1. **Transporte & Veículo:**
   - Palavras-chave: `SUBE`, `Viaje con QR`, `Subte`, `Emova`, `Uber`, `DiDi`.
2. **Alimentação & Supermercado:**
   - Palavras-chave: `Carrefour`, `Coto`, `Verduleria`, `Panaderia`, `Confiteria`, `Pizza`, `McDonald's`, `Havanna`, `Starbucks`, `Rappi`, `Hey Muzza`, etc.
3. **Saúde & Bem-Estar:**
   - Palavras-chave: `Farmacity`, `Farmácia`, médicos e exames.
4. **Filhos & Família:**
   - Mensalidades e atividades: `Colegio Misericordia Belgrano`.
5. **Moradia & Serviços:**
   - Concessionárias e serviços: `Edenor`, `Metrogas`, `Telecom Argentina / Personal Flow`, `Claro`.
6. **Compras & Vestuário:**
   - E-commerce e varejo: `Mercado Libre`, `Temu`, `Shein`, `EBANX`, `Macowens`, `Livrarias`.
7. **Lazer & Entretenimento:**
   - Assinaturas de streaming e passeios: `Netflix`, `Spotify`, cinemas.
8. **Transferências & Outros:**
   - Movimentações bancárias entre contas familiares ou terceiros (`Transferencia enviada` / `Transferencia recibida`).

---

## 6. Funcionalidades da Interface

### 1. Seletor de Membro Familiar
Localizado diretamente acima do extrato de transações:
- `[ Todos ]`: Exibe a soma de todas as receitas, despesas e lançamentos de toda a família.
- `[ 👤 Gastão ]`: Filtra os cartões e extrato apenas com dados do Gastão.
- `[ 👤 Amanda ]`: Filtra os cartões e extrato apenas com dados da Amanda.

### 2. Seletor de Período Dinâmico
- Integrado com `PeriodBar` e `resolvePeriod()`.
- Suporta visualização mensal (Mês corrente por padrão) ou períodos customizados via URL params `?from=YYYY-MM-DD&to=YYYY-MM-DD`.

### 3. Gráficos Interativos (Recharts)
- **Rosca de Distribuição por Categoria:** Exibe o percentual e o valor convertido para BRL de cada área de gasto.
- **Histórico Mensal (6 Meses):** Barras comparativas de Receitas vs Despesas.
- **Comparativo MoM (Month-over-Month):** Variação percentual e monetária em relação ao mês anterior.

### 4. Responsividade Completa
- **Telas Desktop (> 768px):** Tabela de alta densidade com paginação suave e colunas detalhadas (Data, Descrição, Moeda, Categoria, Vínculo, Valor, Ações).
- **Telas Mobile (< 768px):** Cards modernos em bloco com badges coloridos e toque facilitado.

---

## 7. Como Importar Novos Extratos

Para adicionar novos extratos no futuro:
1. Faça upload do PDF através do botão "Importar Comprovante / Extrato" na interface web.
2. O leitor `lib/ai/receiptScanner.ts` reconhece arquivos OFX, CSV, TXT e PDF.
3. As transações são processadas e mescladas automaticamente ao `localStorage` e ao estado da aplicação sem perder dados preexistentes.
