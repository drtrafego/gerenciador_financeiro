# API do agente externo

API própria em `app/api/agent/v1/**` para o super agente externo (Telegram, orquestrado via Claude, rodando numa sessão tmux no servidor do dono) ler e operar o sistema financeiro. Autenticação por API key fixa (Bearer) e log de auditoria de toda chamada, inclusive leituras.

## 1. Quickstart

### Gerar a chave

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Configurar na Vercel

No projeto na Vercel, em Settings, Environment Variables, adicionar:

- `AGENT_API_KEY`: a chave gerada acima.
- `AGENT_API_KEY_PREVIOUS` (opcional): usada só durante rotação de chave, ver seção 5.
- `AGENT_RATE_LIMIT_PER_MINUTE` (opcional): padrão 60, ver seção 4.
- `TRUSTED_IPS` (opcional): allowlist de IP das rotas de máquina, CSV. Se não definida, vale a lista embutida no código (o IP do VPS). Ver seção 7.

Fazer redeploy depois de adicionar as variáveis.

Variável de ambiente na Vercel só passa a valer em um novo deploy, inclusive `TRUSTED_IPS`. Alterar o valor no painel sem redeploy não muda nada no que está no ar.

### Exemplo de chamada

```bash
curl -X GET "https://financeiro.casaldotrafego.com/api/agent/v1/clients?limit=10" \
  -H "Authorization: Bearer SUA_AGENT_API_KEY" \
  -H "x-agent-actor: telegram:123456789"
```

O header `x-agent-actor` é opcional. É um texto livre (por exemplo, o id do usuário do Telegram que disparou a ação) usado só para registrar quem fez a chamada no log de auditoria. Ele nunca autoriza nada, quem autoriza é sempre o Bearer token.

Toda resposta de erro segue o mesmo envelope:

```json
{ "error": { "code": "UNAUTHORIZED", "message": "Token inválido ou ausente" } }
```

## 2. Endpoints

Base: `https://financeiro.casaldotrafego.com/api/agent/v1`

Campos como `id`, `createdAt` e `invoiceNumber` nunca são aceitos em nenhum body de escrita. Se enviados, são silenciosamente descartados pela validação (Zod em modo "strip").

### Clientes

#### `GET /clients`

Lista clientes, paginado.

Headers: `Authorization: Bearer <token>`

Query: `limit` (padrão 50, máximo 200), `offset` (padrão 0)

Resposta 200:
```json
{ "data": [ { "id": "...", "name": "Cliente X", "status": "active", "...": "..." } ], "count": 42 }
```

#### `GET /clients/:id`

Detalhe de um cliente com seus contratos, faturas e transações.

Resposta 200:
```json
{ "id": "...", "name": "Cliente X", "contracts": [], "invoices": [], "transactions": [] }
```

Resposta 404:
```json
{ "error": { "code": "NOT_FOUND", "message": "Cliente não encontrado" } }
```

#### `POST /clients`

Cria um cliente.

Body:
| campo | tipo | obrigatório |
|---|---|---|
| name | string | sim |
| contactName | string \| null | não |
| email | string \| null | não |
| phone | string \| null | não |
| currency | "BRL" \| "USD" \| "ARS" | não, padrão BRL |
| status | "active" \| "inactive" \| "overdue" | não, padrão active |
| source | "referral" \| "organic" \| "meta" \| "google" \| null | não |
| document | string \| null | não |
| isTest | boolean | não, padrão false |
| notes | string \| null | não |

Resposta 201: objeto do cliente criado.

Resposta 400:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "name: Required" } }
```

#### `PATCH /clients/:id`

Atualiza campos do cliente (todos opcionais, mesmo schema de `POST /clients` mas parcial).

Resposta 200: objeto do cliente atualizado.

#### `POST /clients/:id/deactivate`

Marca o cliente como `status: inactive`. Sem body.

Resposta 200: objeto do cliente atualizado.

Não existe `DELETE /clients/:id`: cliente é dado fiscal e histórico, nunca é apagado pela API.

### Contratos

#### `GET /contracts`

Lista contratos, paginado, com o nome do cliente.

Resposta 200:
```json
{ "data": [ { "contract": { "id": "...", "..." : "..." }, "clientName": "Cliente X" } ], "count": 12 }
```

#### `GET /contracts/:id`

Detalhe de um contrato (sem join, campos crus do banco).

#### `POST /contracts`

Cria um contrato.

Body:
| campo | tipo | obrigatório |
|---|---|---|
| clientId | uuid | sim |
| name | string \| null | não |
| type | "fixed_fee" \| "fixed_plus_percentage" \| "project" | sim |
| fixedAmount | number \| string | sim |
| percentage | number \| string \| null | não |
| adBudget | number \| string \| null | não |
| currency | "BRL" \| "USD" \| "ARS" | não, padrão BRL |
| billingDay | number (1 a 31) | não, padrão 5 |
| startDate | string "YYYY-MM-DD" | sim |
| endDate | string "YYYY-MM-DD" \| null | não |
| status | "active" \| "paused" \| "cancelled" | não, padrão active |
| description | string \| null | não |
| pdfUrl | string (URL já hospedada) \| null | não |

`pdfUrl` só aceita um link já hospedado (ex: um arquivo já subido em algum storage), a API não recebe upload binário.

Resposta 201: objeto do contrato criado.

#### `PATCH /contracts/:id`

Atualiza campos do contrato, incluindo mudar `status` para `cancelled` ou `paused`. Mesmo schema de `POST /contracts`, mas parcial.

Contrato "finalizado" nunca é um status gravado no banco: é derivado da data de término (`endDate`) já ter passado. Ver `lib/contracts.ts`.

Não existe `DELETE /contracts/:id`.

### Transações

#### `GET /transactions`

Lista transações, paginado.

Query: `limit`, `offset`, `from` ("YYYY-MM-DD"), `to` ("YYYY-MM-DD"), `type` ("income" \| "expense"), `clientId` (uuid)

Resposta 200:
```json
{ "data": [ { "transaction": { "...": "..." }, "clientName": "Cliente X", "clientIsTest": false } ], "count": 87 }
```

#### `GET /transactions/:id`

Detalhe de uma transação.

#### `POST /transactions`

Cria uma transação. Suporta parcelamento (mesmo comportamento do modal "Nova transação" do painel): quando `installments` for maior que 1, o valor total é dividido em N parcelas mensais, a última absorve o arredondamento, e cada parcela vira uma transação independente (sem recorrência).

Body:
| campo | tipo | obrigatório |
|---|---|---|
| type | "income" \| "expense" | sim |
| category | string | sim |
| description | string | sim |
| amount | number positivo (valor efetivo, com IOF se houver) | sim |
| baseAmount | number positivo \| null (valor original digitado, sem IOF) | não |
| iof | boolean | não, padrão false |
| currency | "BRL" \| "USD" \| "ARS" | não, padrão BRL |
| date | string "YYYY-MM-DD" | sim |
| isRecurring | boolean | não, padrão false |
| recurringEndsAt | string "YYYY-MM-DD" \| null | não |
| clientId | uuid \| null | não |
| invoiceId | uuid \| null | não |
| installments | number (1 a 60) | não, padrão 1 |

O IOF em USD é reversível: sempre editar/enviar `baseAmount` (o valor digitado), nunca calcular e enviar `amount` (o valor já com IOF aplicado) diretamente.

Resposta 201:
```json
{ "data": [ { "id": "...", "...": "..." } ], "count": 1 }
```
(`count` maior que 1 quando `installments` maior que 1: uma linha por parcela)

#### `PATCH /transactions/:id`

Atualiza campos de uma transação (mesmo schema de criação, sem `installments`, tudo opcional).

#### `POST /transactions/:id/deactivate-recurring`

Desativa a recorrência de uma transação (`recurringActive: false`). Sem body.

#### `POST /transactions/:id/reverse`

Corrige um lançamento errado sem apagar a linha original: cria um NOVO lançamento de sinal oposto ao original (income vira expense e vice versa), mesmo valor e mesma data do original, com a descrição prefixada por `Estorno de "..." (ref: <id original>)`. Não apaga nem edita a linha original. Sem body.

Resposta 201: objeto da nova transação de estorno.

Resposta 400 se a transação original for recorrente (desative a recorrência antes de estornar):
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Não é possível estornar uma transação recorrente. Desative a recorrência primeiro." } }
```

Não existe `DELETE /transactions/:id`: use `/reverse` para corrigir.

### Faturas

#### `GET /invoices`

Lista faturas, paginado, com o nome do cliente.

#### `GET /invoices/:id`

Detalhe de uma fatura.

#### `POST /invoices`

Cria uma fatura (documento, nunca entra no fluxo de caixa).

Body:
| campo | tipo | obrigatório |
|---|---|---|
| clientId | uuid | sim |
| contractId | uuid \| null | não |
| type | "monthly" \| "project" \| "proposal" | sim |
| amount | number positivo | sim |
| currency | "BRL" \| "USD" \| "ARS" | não, padrão BRL |
| dueDate | string "YYYY-MM-DD" | sim |
| description | string \| null | não |
| notes | string \| null | não |
| paymentMethod | string \| null | não |

Fatura sempre nasce com `status: draft`.

#### `PATCH /invoices/:id/status`

Body: `{ "status": "draft" | "sent" | "cancelled" }`

NUNCA aceita `"paid"` aqui, use `POST /invoices/:id/mark-paid`.

Resposta 400 se tentar `status: "paid"`:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Use POST /invoices/:id/mark-paid para marcar uma fatura como paga." } }
```

Atenção: mudar o status para `"sent"` por aqui é só um flag no banco, não dispara nenhum e-mail nem qualquer outro envio. Para enviar a fatura de verdade, use `POST /invoices/:id/send-email`.

#### `POST /invoices/:id/mark-paid`

Marca a fatura como paga (`status: paid`, `paidAt: now()`). Nunca cria uma transaction: fatura é só documento, não entra no fluxo de caixa mesmo paga. Sem body.

#### `POST /invoices/:id/send-email`

Envia a fatura por e-mail de verdade (mesmo e-mail de recibo que o painel humano já envia, `lib/email/gmail.ts`). É a única rota desta API que efetivamente despacha alguma coisa para o cliente; `PATCH /invoices/:id/status` com `"sent"` NUNCA envia e-mail, é só um flag no banco, ver nota acima.

Body (opcional):
| campo | tipo | obrigatório |
|---|---|---|
| to | string, e-mail | não, padrão o `email` cadastrado do cliente |

Corpo vazio `{}` é válido. Se `to` não for enviado e o cliente não tiver `email` cadastrado, a resposta é 400:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Cliente não tem e-mail cadastrado. Informe \"to\" no body ou cadastre o e-mail do cliente antes de enviar." } }
```

Fatura com `status: cancelled` nunca é enviada, mesmo com `to` informado (evita mandar cobrança de algo já cancelado):
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Fatura cancelada não pode ser enviada por e-mail." } }
```

Resposta 200, mesmo quando o envio falha, por exemplo SMTP fora do ar. Quem decide o que fazer com a falha é o agente, olhando o campo `sent`:
```json
{ "invoice": { "...": "..." }, "sent": true, "error": null, "to": "cliente@exemplo.com" }
```

Falha de envio:
```json
{ "invoice": { "...": "..." }, "sent": false, "error": "mensagem do erro de SMTP", "to": "cliente@exemplo.com" }
```

Se o envio funcionar e a fatura estiver com `status: draft`, ela é promovida para `status: sent`. Fatura já `paid`, `cancelled` ou já `sent` nunca tem o status alterado por um reenvio.

Não existe `DELETE /invoices/:id`.

### Lembretes

#### `GET /reminders`

Lista lembretes, paginado.

Query: `limit`, `offset`, `status` ("pending" \| "sent" \| "failed" \| "cancelled" \| "completed")

#### `POST /reminders`

Cria um lembrete avulso.

Body:
| campo | tipo | obrigatório |
|---|---|---|
| clientId | uuid | sim |
| phone | string (mínimo 10 caracteres) | sim |
| triggerDate | string "YYYY-MM-DD" | sim |
| triggerTime | string "HH:MM" | não, padrão "08:00" |
| templateId | uuid \| null | não |
| customMessage | string \| null (substitui o template se preenchida) | não |
| invoiceId | uuid \| null | não |
| contractId | uuid \| null | não |
| startDate | string "YYYY-MM-DD" \| null | não |
| endDate | string "YYYY-MM-DD" \| null | não |
| recurring | boolean | não, padrão false |

#### `PATCH /reminders/:id`

Atualiza campos do lembrete (mesmo schema de criação, tudo opcional, exceto `clientId` que também pode ser alterado). Editar sempre volta `status` para `pending` e limpa `sentAt`/`errorMessage`, igual ao painel humano.

#### `POST /reminders/:id/cancel`

Marca `status: cancelled`. Sem body.

#### `DELETE /reminders/:id`

Apaga o lembrete. Este é o único recurso com DELETE de verdade na API: lembrete não é dado fiscal.

#### `POST /reminders/:id/send-now`

Dispara o envio do lembrete imediatamente: resolve a mensagem (usa `customMessage` se houver, senão monta a partir do template vinculado substituindo `{nome}`, `{valor}`, `{data}`, `{dias}`), chama o whatsapp-service e atualiza `status`, `sentAt` e `errorMessage` do lembrete conforme o resultado. Mesmo caminho que o cron de vencimentos usa hoje: se o lembrete for recorrente e o envio funcionar, a data avança um mês. Sem body.

Resposta 200:
```json
{ "reminder": { "...": "..." }, "sent": true, "error": null }
```

Resposta 400 se não houver mensagem resolvível:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Lembrete sem mensagem: preencha customMessage ou vincule um template." } }
```

#### `GET /reminders/templates`

Lista templates de mensagem.

#### `POST /reminders/templates`

Cria um template.

Body: `{ "name": string, "body": string, "clientId": uuid | null }`

`body` aceita as variáveis `{nome}`, `{valor}`, `{data}`, `{dias}`. `clientId` nulo cria um template genérico, com `clientId` preenchido o template é específico daquele cliente.

### Dashboard e relatórios

#### `GET /dashboard/metrics`

Query: `from`, `to` (ambos "YYYY-MM-DD", opcionais, padrão o mês corrente inteiro)

Mesma fonte de dados usada pelo painel humano (`lib/db/queries.ts`, função `getDashboardData`), os números do Telegram têm que bater com o painel. Clientes com `isTest: true` já saem de todos os totais.

Resposta 200 inclui, entre outros: `periodIncome`, `periodExpense`, `mrr`, `activeClients`, `overdueClients`, `monthExpense`, `overdueInvoices`, `upcomingInvoices`, `recentInvoices`, `chartData`, `sourceBreakdown`, `rate`, `displayCurrency`.

#### `GET /dashboard/cash-flow`

Query: `from`, `to` (mesmo padrão do endpoint acima)

Mesma fonte de dados usada pela página humana de fluxo de caixa (`lib/db/queries.ts`, função `getCashFlowData`): fluxo de caixa é composto só por contratos (projeção pelo `billingDay`) e lançamentos manuais, faturas nunca entram aqui mesmo pagas.

Resposta 200:
```json
{ "from": "...", "to": "...", "transactions": [], "contractIncomes": [], "rate": { "usd_brl": 5.87, "usd_ars": 1429 }, "displayCurrency": "BRL", "clients": [] }
```

#### `GET /reports/overdue`

Faturas com `status: overdue` e clientes com `status: overdue` junto dos contratos ativos de cada um. Clientes de teste (`isTest: true`) já saem do relatório.

Resposta 200:
```json
{ "overdueInvoices": [ { "invoice": {}, "clientName": "...", "clientPhone": "..." } ], "overdueClients": [ { "client": {}, "contracts": [] } ] }
```

#### `GET /exchange-rates/latest`

Última cotação registrada (`usdBrl`, `usdArs`, `arsBrl`, `fetchedAt`).

Resposta 404 se ainda não houver nenhuma cotação salva.

## 3. Paginação

Toda lista aceita `limit` (padrão 50, máximo 200) e `offset` (padrão 0) na query string. Resposta sempre no formato:

```json
{ "data": [ "..." ], "count": 128 }
```

`count` é o total de linhas que batem com os filtros aplicados, não o tamanho da página retornada. Para percorrer todas as páginas, incrementar `offset` em `limit` até `offset >= count`.

## 4. Rate limit

Limite padrão: 60 chamadas por minuto por `actor` (o valor do header `x-agent-actor`, ou `"agent"` quando o header não é enviado). Configurável via `AGENT_RATE_LIMIT_PER_MINUTE`.

Ao exceder, a resposta é 429:
```json
{ "error": { "code": "RATE_LIMITED", "message": "Limite de chamadas por minuto excedido" } }
```

## 5. Rotação de chave

Para trocar `AGENT_API_KEY` sem downtime:

1. Copiar o valor atual de `AGENT_API_KEY` para `AGENT_API_KEY_PREVIOUS`.
2. Gerar uma chave nova e colocar em `AGENT_API_KEY`.
3. Fazer o redeploy. Nesse momento, tanto a chave nova quanto a antiga são aceitas.
4. Atualizar o agente externo (Telegram) para usar a chave nova.
5. Depois de confirmar que o agente externo já está usando a chave nova, remover `AGENT_API_KEY_PREVIOUS` e fazer o redeploy final.

## 6. Auditoria

Toda chamada à API do agente, inclusive leituras (`GET`), gera exatamente uma linha na tabela `agent_audit_log`: quem chamou (`actor`, do header `x-agent-actor`, nunca usado para autorizar), método e endpoint, corpo da requisição já validado pelo Zod, snapshot do registro antes e depois da mutação quando aplicável, status HTTP, sucesso ou falha, mensagem de erro (sem stack trace nem connection string), IP, user agent e duração em milissegundos.

Tentativas com token inválido também geram uma linha, com `actor: "unknown"` e `success: false`, para dar visibilidade de acesso indevido.

Tentativa vinda de um IP fora da allowlist também gera uma linha, com `actor: "blocked-ip"`, `status_code: 403` e o IP recusado no `error_message`. O `actor` gravado é sempre a constante `"blocked-ip"`, nunca o header `x-agent-actor` informado pelo chamador bloqueado, para que uma origem externa não consiga consumir o rate limit do actor legítimo.

A escrita do log de auditoria nunca derruba a resposta HTTP principal: se a gravação falhar, o erro só aparece no log do servidor.

## 7. Allowlist de IP

Segunda camada de defesa, aplicada antes da autenticação nas rotas de máquina: a API do agente (`app/api/agent/v1/**`) e os callbacks do WhatsApp (`/api/wpp/disconnected` e `/api/wpp/reconnected`). Ela não substitui o Bearer nem o `x-wpp-secret`, só reduz a superfície: quem não vem da origem esperada nem chega a ser autenticado.

A origem esperada é o VPS Hostinger, que hospeda o agente externo e o whatsapp-service.

### Configuração

`TRUSTED_IPS` é um CSV de IPs, sem espaços, comparados por igualdade exata (não há suporte a CIDR):

```
TRUSTED_IPS=31.97.21.249
```

Se a variável não estiver definida, vale a lista embutida no código, que hoje contém só o IP do VPS.

### Resposta de bloqueio

Na API do agente, o bloqueio é 403:

```json
{"error":{"code":"FORBIDDEN","message":"Origem não autorizada"}}
```

A mensagem nunca revela o IP recusado nem a allowlist, esse detalhe fica só no log de auditoria. Nos callbacks do WhatsApp, o bloqueio é 403 com `{"error":"Forbidden"}`.

### Ambientes

Em `pnpm dev` a checagem é ignorada automaticamente. Preview na Vercel NÃO é isento: preview também roda como `production`, então precisa de um IP autorizado igual à produção.

### Kill switch

Para desligar a camada de IP de propósito, use exatamente:

```
TRUSTED_IPS=*
```

Apagar a variável NÃO desliga a checagem, só faz voltar para a lista embutida no código.

### Trocar o IP do VPS

1. Descobrir o IP de saída novo, rodando no próprio VPS: `curl -s https://api.ipify.org`.
2. Conferir no Neon quais IPs estão sendo recusados:
   ```sql
   select created_at, ip, error_message, user_agent from agent_audit_log where actor = 'blocked-ip' order by created_at desc limit 20;
   ```
3. Na Vercel, setar `TRUSTED_IPS=IP_NOVO,31.97.21.249` (mantendo o antigo durante a transição).
4. Fazer o redeploy.
5. Em emergência, `TRUSTED_IPS=*` mais redeploy libera tudo enquanto o problema é investigado.

### Modo de falha por IPv6

Se o VPS passar a sair por IPv6, o IP que chega deixa de bater com a lista e a chamada é bloqueada mesmo vindo da máquina certa. Resolve forçando IPv4 no agente (`curl --ipv4`) ou adicionando o endereço IPv6 à `TRUSTED_IPS`.
