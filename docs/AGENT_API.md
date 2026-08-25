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

Hoje são 39 handlers publicados (33 antes da cobrança automática, mais os 4 de `/billing`, mais o upload e o download de PDF de contrato).

Todos os endpoints recebem e devolvem JSON, com duas exceções, as duas de arquivo: `POST /contracts/:id/pdf` recebe `multipart/form-data` e `GET /contracts/:id/pdf` responde o PDF em binário.

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

Aqui e no `PATCH`, `pdfUrl` só aceita um link já hospedado. Para mandar o ARQUIVO em si, use `POST /contracts/:id/pdf`, descrito abaixo.

Atenção ao ler contratos: o `pdfUrl` de um arquivo que subiu pelo sistema aponta para storage privado e NÃO abre no navegador. Baixe com `GET /contracts/:id/pdf`. Um `pdfUrl` que você mesmo colou aqui continua sendo o link externo que você informou.

Resposta 201: objeto do contrato criado.

#### `PATCH /contracts/:id`

Atualiza campos do contrato, incluindo mudar `status` para `cancelled` ou `paused`. Mesmo schema de `POST /contracts`, mas parcial.

Contrato "finalizado" nunca é um status gravado no banco: é derivado da data de término (`endDate`) já ter passado. Ver `lib/contracts.ts`.

Não existe `DELETE /contracts/:id`.

#### `POST /contracts/:id/pdf`

Anexa o PDF assinado ao contrato: sobe o arquivo para o Vercel Blob e grava a URL em `pdfUrl`. É o caminho para quem tem o ARQUIVO em mãos e não um link já hospedado.

Único endpoint da API que recebe `multipart/form-data`. Campo obrigatório: `file`.

```bash
curl -X POST "https://financeiro.casaldotrafego.com/api/agent/v1/contracts/$ID/pdf" \
  -H "Authorization: Bearer $AGENT_API_KEY" \
  -F "file=@contrato-assinado.pdf"
```

Limite de 4MB por arquivo. Acima disso a resposta é 413; se o arquivo for muito maior, a plataforma corta a requisição antes de ela chegar no handler e nem gera linha de auditoria. Nesse caso, hospede o arquivo por fora e use `PATCH /contracts/:id` com `pdfUrl`.

O conteúdo é conferido pelo cabeçalho do próprio arquivo (`%PDF-`), não pelo `Content-Type` declarado: arquivo renomeado para `.pdf` é recusado com 400.

Se o contrato já tinha PDF, o novo SUBSTITUI o anterior, e o arquivo antigo é apagado do Blob (só quando ele estava hospedado lá; link externo colado via `PATCH` nunca é apagado). Não existe histórico de versões do PDF.

Resposta 200:
```json
{
  "contract": { "...": "objeto completo do contrato, com o pdfUrl novo" },
  "pdf": {
    "url": "https://....blob.vercel-storage.com/contracts/contrato-assinado-a1b2c3.pdf",
    "pathname": "contracts/contrato-assinado-a1b2c3.pdf",
    "sizeBytes": 184320,
    "sha256": "9f86d0818...",
    "replacedUrl": null
  }
}
```

Erros: 400 (campo `file` ausente, corpo não multipart, arquivo vazio ou não é PDF), 404 (contrato não existe, conferido ANTES do upload para não deixar arquivo órfão), 413 (acima de 4MB).

O arquivo fica em storage PRIVADO. O `pdfUrl` devolvido na resposta e nos GETs de contrato **não é um link clicável**: é o identificador do arquivo no storage e responde erro se alguém tentar abrir no navegador. Para obter o documento, use o `GET` abaixo.

#### `GET /contracts/:id/pdf`

Baixa o PDF do contrato. Junto com o `POST` acima, é uma das duas rotas de arquivo da API; esta responde binário, não JSON.

```bash
curl -H "Authorization: Bearer $AGENT_API_KEY" \
  "https://financeiro.casaldotrafego.com/api/agent/v1/contracts/$ID/pdf" \
  -o contrato.pdf
```

Resposta 200: o conteúdo do PDF, com `Content-Type: application/pdf` e `Content-Disposition: attachment`.

Erros:
- 404, o contrato não existe, não tem PDF anexado, ou o arquivo não está mais no storage.
- 409 `EXTERNAL_FILE`, o `pdfUrl` aponta para outro serviço (link colado via `PATCH`). A mensagem traz a URL, para você baixar direto da fonte. O sistema não serve conteúdo de domínio de terceiro.

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

Query: `limit`, `offset`, `status` ("pending" \| "sent" \| "failed" \| "cancelled" \| "completed"), `stage` ("due" \| "overdue_d2" \| "overdue_d5")

Cada lembrete devolve também o campo `stage`, a etapa do ciclo de cobrança daquele vencimento: `due` é o aviso do dia do vencimento (é o que toda linha antiga representa), `overdue_d2` e `overdue_d5` são as cobranças de atraso. `trigger_date` é sempre a data de VENCIMENTO, nunca a data em que a mensagem saiu.

`stage` é só filtro de leitura: NUNCA é aceito em body de escrita, nem em `POST /reminders` nem em `PATCH /reminders/:id`. Quem define a etapa é o cron, e editar um lembrete preserva a etapa que ele já tinha.

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

Em lembrete automático sem `customMessage` salva, quem monta o texto é o SERVIDOR, em vez de cair no template genérico do painel, que fala em vencimento futuro. Ele reconstrói:

- cobrança de atraso (`stage` igual a `overdue_d2` ou `overdue_d5`): o texto daquela etapa, com a data do vencimento;
- primeira parcela de um contrato (`stage` igual a `due`, quando o vencimento é o primeiro do contrato pela conta de `start_date` mais `billing_day`): o texto de boas vindas, que avisa que o serviço está começando;
- vencimento adiado por fim de semana (`stage` igual a `due`): o texto que explica o adiamento, com a data real do vencimento.

Vencimento comum continua saindo do template padrão do painel, que é onde esse texto se edita. Se houver `customMessage`, ela tem prioridade sobre tudo isso, igual a qualquer outro lembrete.

Lembrete com contrato ou fatura vinculada, sem `customMessage` e sem template próprio, usa o template padrão do painel como fallback (antes disso ele respondia 400 "Lembrete sem mensagem"; era o caso da linha que o cron cria como falha quando o cliente está sem telefone cadastrado). Lembrete avulso sem template nenhum continua respondendo 400, porque não haveria valor para preencher no texto.

Cobrança de atraso de um vencimento já confirmado como pago nunca é reenviada, nem por aqui. Resposta 400:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Vencimento já confirmado como pago em 05/08/2026. Desfaça a confirmação antes de cobrar." } }
```
Para reenviar mesmo assim, use `POST /billing/payments/unconfirm` antes.

#### `GET /reminders/templates`

Lista templates de mensagem.

#### `POST /reminders/templates`

Cria um template.

Body: `{ "name": string, "body": string, "clientId": uuid | null }`

`body` aceita as variáveis `{nome}`, `{valor}`, `{data}`, `{dias}`. `clientId` nulo cria um template genérico, com `clientId` preenchido o template é específico daquele cliente.

### Cobrança e confirmação de pagamento

Três avisos que valem para toda esta seção:

> **1. Confirmar pagamento é idempotente.** A chave de negócio é `(contractId, dueDate)`. Confirmar duas vezes devolve a mesma confirmação, com `alreadyConfirmed: true`, e não duplica nada.
>
> **2. Confirmar pagamento NÃO gera transaction e NÃO mexe em fatura.** Não entra no fluxo de caixa, não muda status de invoice, não muda status do cliente. O lançamento financeiro continua sendo feito à parte, como sempre foi.
>
> **3. Confirmar bloqueia só as COBRANÇAS DE ATRASO daquele vencimento (D+2 e D+5).** O aviso do dia do vencimento não é afetado: ele já saiu antes, e o do mês seguinte é outro vencimento, com outra chave.

#### `POST /billing/payments/confirm`

Confirma o pagamento de um vencimento e interrompe as cobranças de atraso dele.

Body:
| campo | tipo | obrigatório |
|---|---|---|
| contractId | uuid | não, se `clientId` ou `phone` resolverem para um único contrato |
| clientId | uuid | não |
| phone | string (telefone cadastrado do cliente) | não |
| dueDate | string "YYYY-MM-DD" | não, padrão o vencimento em aberto mais recente na janela de 45 dias |
| amount | number \| string | não, padrão o valor fixo do contrato |
| note | string \| null | não |

Pelo menos um entre `contractId`, `clientId` e `phone` é obrigatório.

`source` é gravado pelo SERVIDOR como `"agent"`, nunca vem do body. `actor` é o valor já resolvido do header `x-agent-actor`.

Resposta 200:
```json
{
  "confirmation": { "id": "...", "contractId": "...", "dueDate": "2026-08-05", "amount": "1500.00", "source": "agent", "actor": "telegram:123456789", "confirmedAt": "2026-08-07T12:30:00.000Z" },
  "alreadyConfirmed": false,
  "dunningCancelled": ["overdue_d2", "overdue_d5"]
}
```

`dunningCancelled` lista as etapas de cobrança que não serão mais enviadas por causa desta confirmação: as que estavam pendentes (canceladas agora) e as que ainda nem tinham sido criadas mas cuja data de envio ainda estava por vir.

Resposta 409 quando o alvo é ambíguo. São dois casos, e em ambos a API se recusa a adivinhar qual pagamento foi feito.

Caso 1, o telefone ou o cliente têm vencimento em aberto em mais de um contrato:
```json
{ "error": { "code": "AMBIGUOUS_TARGET", "message": "Mais de um vencimento em aberto para este alvo. Informe contractId e dueDate. Opções: Meta Ads (uuid, vencimento 2026-08-05); Google Ads (uuid, vencimento 2026-08-05)" } }
```

Caso 2, um contrato só, porém com dois ou mais vencimentos em aberto (cliente com mais de um mês atrasado) e sem `dueDate` no corpo:
```json
{ "error": { "code": "AMBIGUOUS_TARGET", "message": "Este contrato tem 2 vencimentos em aberto. Informe dueDate. Opções: Meta Ads (uuid, vencimento 2026-08-05); Meta Ads (uuid, vencimento 2026-07-05)" } }
```

Resposta 400 quando a data não é um vencimento válido daquele contrato:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "2026-08-07 não é uma data de vencimento deste contrato. O vencimento daquele mês é 2026-08-05." } }
```

A validação da data aceita, além do vencimento calculado pelo `billingDay` atual do contrato, qualquer data que já tenha histórico de aviso ou confirmação registrada. Isso existe porque o `billingDay` é editável: sem essa regra, mudar o dia de vencimento do contrato tornaria impossível confirmar o pagamento de qualquer mês anterior à mudança.

Resposta 404 quando o contrato não existe, ou quando nada está em aberto para o alvo informado:
```json
{ "error": { "code": "NOT_FOUND", "message": "Vencimento em aberto não encontrado" } }
```

#### `POST /billing/payments/unconfirm`

Desfaz a confirmação. Idempotente: desfazer o que não existe devolve `removed: false`.

Body:
| campo | tipo | obrigatório |
|---|---|---|
| contractId | uuid | sim |
| dueDate | string "YYYY-MM-DD" | sim |

Os dois são obrigatórios de propósito: não existe resolução por telefone aqui, desfazer é operação de correção e exige o alvo exato.

Resposta 200:
```json
{ "removed": true, "contractId": "...", "dueDate": "2026-08-05" }
```

Desfazer depois que a data do D+5 já passou NÃO reenvia nada: o ciclo daquele vencimento simplesmente volta a aparecer como em aberto e encerrado. Para cobrar de novo, mande a mensagem por um lembrete avulso.

#### `GET /billing/open-dues`

Vencimentos de contratos ativos na janela pedida, com o estado do ciclo de cobrança de cada um.

Query: `phone`, `clientId`, `contractId` (pelo menos um é obrigatório), `days` (padrão 45, máximo 120), `limit`, `offset`

Resposta 200:
```json
{
  "data": [
    {
      "contractId": "...",
      "contractName": "Meta Ads",
      "clientId": "...",
      "clientName": "Cliente X",
      "phone": "5511999999999",
      "dueDate": "2026-08-05",
      "amount": "1500.00",
      "cycleStatus": "dunned_d2",
      "stagesSent": ["due", "overdue_d2"],
      "nextStage": "overdue_d5",
      "nextSendDate": "2026-08-12",
      "confirmed": false,
      "confirmedAt": null,
      "confirmedBy": null
    }
  ],
  "count": 1
}
```

Valores de `cycleStatus`: `pending` (nada enviado ainda), `notified` (aviso do vencimento enviado), `dunned_d2`, `dunned_d5`, `closed` (as duas cobranças já passaram, segue em aberto), `due_failed` (o aviso falhou, o cliente nem soube), `paid` (pagamento confirmado).

Resposta 400 sem nenhum filtro:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Informe pelo menos um filtro: phone, clientId ou contractId." } }
```

#### `GET /billing/dunning-status`

O mesmo item do `open-dues` mais o histórico completo do ciclo.

Query: `contractId` (obrigatório), `dueDate` (opcional, padrão o vencimento mais recente do contrato)

Resposta 200: os campos do item acima, mais:
```json
{
  "reminders": [
    { "id": "...", "stage": "due", "status": "sent", "triggerDate": "2026-08-05", "sentAt": "2026-08-05T12:30:00.000Z", "errorMessage": null, "customMessage": "Oi Isabela! ..." }
  ],
  "confirmation": null
}
```

#### Como a automação decide o dia do envio

A data de vencimento (`dueDate`, gravada em `trigger_date`) é canônica e nunca muda. O que a automação calcula é a data de ENVIO de cada uma das três mensagens, por estas regras, nesta ordem:

1. O aviso sai no dia do vencimento; o D+2, dois dias depois; o D+5, cinco dias depois.
2. Se a data cair no sábado ou no domingo, o envio anda para a segunda-feira. Feriado nacional NÃO adia nada, por decisão do dono: mensagem em feriado é lida do mesmo jeito, e manter tabela de feriado desatualizada seria pior.
3. Entre duas mensagens consecutivas do mesmo vencimento sempre existem pelo menos 2 dias úteis, contados a partir da data EFETIVA de envio da anterior, não da nominal.

Exemplo por extenso, vencimento no sábado 15/08/2026:

- Aviso: 15/08 é sábado, então o aviso sai na segunda, 17/08, com o texto explicando que o vencimento caiu no fim de semana e citando a data real, 15/08.
- D+2: a data nominal seria 17/08, o mesmo dia do aviso. Pela regra 3, ele é empurrado para quarta, 19/08.
- D+5: a data nominal seria quinta, 20/08, que fica a só um dia útil do D+2. Também é empurrado, para sexta, 21/08.

Exemplo com vencimento em dia útil, sexta 14/08/2026: aviso na sexta 14/08, D+2 nominal cai no domingo e vira segunda 17/08, que fica a 1 dia útil do aviso, então anda para terça 18/08; D+5 sai na quinta 20/08.

O campo `nextSendDate` do `open-dues` já entrega essa conta pronta, o agente não precisa recalcular nada.

#### Casos que o agente precisa saber responder

- **Cliente com 2 contratos e só um foi pago:** confirme um `contractId` só. A confirmação é por contrato e por data de vencimento, então o contrato não pago continua sendo cobrado normalmente. Sem `contractId`, a resposta é 409.
- **Contrato cancelado ou pausado:** para de ser cobrado automaticamente na hora, porque o cron só olha contrato com `status: active`. Não precisa confirmar pagamento para "silenciar" um contrato encerrado, basta o status.
- **Desconfirmar depois que a data do D+5 já passou:** não reenvia nada. As datas de envio são calculadas a partir do vencimento, e o que passou, passou.

### Dashboard e relatórios

#### `GET /dashboard/metrics`

Query: `from`, `to` (ambos "YYYY-MM-DD", opcionais, padrão o mês corrente inteiro)

Mesma fonte de dados usada pelo painel humano (`lib/db/queries.ts`, função `getDashboardData`), os números do Telegram têm que bater com o painel. Clientes com `isTest: true` já saem de todos os totais.

Resposta 200 inclui, entre outros: `periodReceived`, `periodToReceive`, `periodIncome`, `periodExpense`, `previous`, `previousPeriod`, `mrr`, `activeClients`, `overdueClients`, `overdueAmount`, `contratosNovos`, `contratosEncerrados`, `overdueInvoices`, `upcomingInvoices`, `recentInvoices`, `chartData`, `chartCurrency`, `sourceBreakdown`, `rate`, `displayCurrency`.

Leitura dos campos de dinheiro, para não somar duas vezes:

- `periodReceived` é o que entrou de fato: transação lançada com data já passada mais honorário de contrato com pagamento confirmado.
- `periodToReceive` é o que ainda está em aberto no período.
- `periodIncome` é a soma dos dois, ou seja, o total previsto do intervalo. Era o único número que existia antes, e é por isso que ele nunca fechava com o extrato bancário.
- `previous` traz os mesmos totais do período anterior (`received`, `toReceive`, `expense`, `income`, `balance`, `mrr`) e `previousPeriod` diz qual intervalo é esse. Serve para responder "melhorou ou piorou" sem recalcular nada.
- `activeClients` conta clientes com contrato vigente, derivado do contrato. Não é mais o campo `status` do cadastro do cliente.
- `overdueClients`, `overdueAmount` e `overdueInvoices` são derivados da data de vencimento, não do status digitado no painel.
- `chartData` vem SEMPRE em reais, cada mês convertido pela cotação da época, e `chartCurrency` declara isso. Diferente dos totais do período, ele não segue o `displayCurrency`: converter os pontos do gráfico de novo seria conversão dupla, e ainda pela cotação de hoje.

O campo `monthExpense` foi REMOVIDO: ele somava moedas diferentes sem converter, não tinha data final (engolia parcelas futuras) e ignorava o período. Use `periodExpense`.

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

No upload de PDF (`POST /contracts/:id/pdf`) o arquivo NUNCA entra no log: o `request_data` guarda só nome tratado, tamanho, `Content-Type` declarado, se houve substituição e o `sha256` do conteúdo. O hash é o que permite provar depois qual arquivo foi anexado, sem armazenar um byte dele.

No download (`GET /contracts/:id/pdf`) vale o mesmo: ficam gravados tamanho e tipo, nunca o conteúdo. A linha é escrita antes de o arquivo começar a trafegar, então um 200 no log significa "download autorizado e iniciado", não "download concluído".

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
