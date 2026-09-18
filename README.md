# 🚀 Gerenciador Financeiro (Casal do Tráfego & Pessoal)

Sistema completo de Gestão Financeira Empresarial (PJ) e Pessoal (PF) construído com **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, **Drizzle ORM** e **PostgreSQL**.

---

## 📋 Requisitos Prévios

Antes de começar, certifique-se de ter instalado em sua máquina:

- **Node.js**: `v18.x` ou superior (Recomendado `v20.x`)
- **Gerenciador de Pacotes**: `pnpm` (recomendado) ou `npm` / `yarn`
- **Banco de Dados PostgreSQL**: Instância local ou provedor na nuvem ([Neon](https://neon.tech), [Supabase](https://supabase.com), etc.)
- **Git**

---

## 🚀 Passo a Passo para Instalação e Execução (Desenvolvedores)

### 1. Clonar o Repositório

```bash
git clone https://github.com/drtrafego/gerenciador_financeiro.git
cd gerenciador_financeiro
```

---

### 2. Instalar as Dependências

```bash
# Utilizando pnpm (Recomendado)
pnpm install

# Ou utilizando npm
npm install
```

---

### 3. Configurar as Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto (você pode copiar o modelo `.env.example`):

```bash
cp .env.example .env.local
```

Preencha as variáveis no arquivo `.env.local`:

```env
# Banco de dados PostgreSQL
POSTGRES_URL=postgresql://usuario:senha@localhost:5432/finance_db?sslmode=require

# Autenticação Stack Auth
NEXT_PUBLIC_STACK_PROJECT_ID=sua_stack_project_id
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=pck_sua_chave_publica
STACK_SECRET_SERVER_KEY=ssk_sua_chave_secreta

# Chaves de Segurança
AUTH_SECRET=um_segredo_forte_gerado_aleatoriamente
CRON_SECRET=segredo_para_execucao_de_crons

# URL da Aplicação
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Envio de Emails (Gmail SMTP - Opcional)
GMAIL_USER=seuemail@gmail.com
GMAIL_APP_PASSWORD=sua_senha_de_app_gmail
```

---

### 4. Configurar e Popular o Banco de Dados

```bash
# Executar as migrações do banco de dados
pnpm db:migrate

# (Opcional) Popular o banco de dados com dados de teste
pnpm db:seed
```

---

### 5. Iniciar o Servidor de Desenvolvimento

```bash
# Iniciar em modo de desenvolvimento com Turbopack
pnpm dev
```

Acesse [http://localhost:3000](http://localhost:3000) no seu navegador.

---

## 🌐 Deploy em Domínio ou Subdomínio Próprio

A aplicação pode ser publicada em um **subdomínio próprio** (ex: `finance.seudominio.com`, `gestao.suaempresa.com.br`) ou no **domínio raiz** (`seudominio.com`). Abaixo estão os dois métodos principais de deploy:

---

### Método 1: O Melhor Caminho — GitHub ➔ Vercel (Recomendado & Deploy Automático)

Este é o **melhor e mais recomendado caminho**: você envia seu código para o **GitHub** e a **Vercel** lê o repositório. Toda vez que você ou outro desenvolvedor/agente fizer um `git push origin main`, a Vercel compila e atualiza o seu subdomínio **automaticamente em poucos segundos** (CI/CD Contínuo).

#### Passo 1: Subir seu Código para o GitHub
Se você já clonou ou fez alterações no código localmente, envie as atualizações para a branch principal do GitHub:
```bash
git add .
git commit -m "feat: configuracoes para producao"
git push origin main
```

#### Passo 2: Conectar o Repositório do GitHub à Vercel
1. Crie uma conta ou acesse [vercel.com](https://vercel.com) (você pode fazer login diretamente com sua conta do GitHub).
2. No painel principal, clique em **"Add New..."** -> **"Project"**.
3. Selecione o seu repositório **`gerenciador_financeiro`** na lista e clique em **"Import"**.
4. Em **Environment Variables** (Variáveis de Ambiente), cadastre as mesmas chaves do seu `.env.local`:
   - `POSTGRES_URL` (Sua URL de conexão do PostgreSQL no Neon, Supabase ou ElephantSQL)
   - `NEXT_PUBLIC_STACK_PROJECT_ID`
   - `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY`
   - `STACK_SECRET_SERVER_KEY`
   - `AUTH_SECRET`
   - `CRON_SECRET`
   - `NEXT_PUBLIC_APP_URL` -> Coloque o endereço do seu subdomínio final (ex: `https://finance.seudominio.com`)
5. Clique em **"Deploy"**. A Vercel criará o projeto e gerará um link inicial em segundos.

#### Passo 3: Configurar o Subdomínio ou Domínio Próprio
1. Dentro do projeto na Vercel, vá no menu superior em **Settings** -> **Domains**.
2. Digite o seu subdomínio desejado (ex: `finance.seudominio.com` ou `gestao.suaempresa.com.br`) e clique em **Add**.
3. Acesse o painel de controle do seu domínio onde a zona DNS está hospedada (Cloudflare, Registro.br, Hostinger, GoDaddy, Namecheap, etc.):
   - **Para Subdomínio** (ex: `finance.seudominio.com`):
     - **Tipo**: `CNAME`
     - **Nome / Host**: `finance` (ou o nome do seu subdomínio)
     - **Valor / Destino**: `cname.vercel-dns.com`
     - **TTL**: `Auto`
   - **Para Domínio Principal** (ex: `seudominio.com`):
     - **Tipo**: `A`
     - **Nome / Host**: `@`
     - **Valor / IP**: `76.76.21.21`

💡 **Pronto!** Em poucos segundos o certificado de segurança SSL (HTTPS) é gerado gratuitamente e o seu subdomínio fica online. A partir de agora, qualquer novo `git push` no GitHub atualizará o site automaticamente!

---

### Método 2: Deploy em Servidor VPS Próprio (Ubuntu / Nginx / PM2 / Certbot)

Se você utiliza um servidor VPS próprio (Hetzner, DigitalOcean, AWS, Linode, Contabo), siga este passo a passo:

#### 1. Clonar e Compilar no Servidor
```bash
git clone https://github.com/drtrafego/gerenciador_financeiro.git /var/www/gerenciador_financeiro
cd /var/www/gerenciador_financeiro

# Instalar dependências
pnpm install

# Configurar variáveis no .env.local
cp .env.example .env.local
nano .env.local # Edite POSTGRES_URL e NEXT_PUBLIC_APP_URL=https://finance.seudominio.com

# Rodar migrações do banco e compilar
pnpm db:migrate
pnpm build
```

#### 2. Iniciar a Aplicação com PM2 (Segundo Plano)
```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar o servidor Next.js na porta 3000
pm2 start npm --name "gerenciador-financeiro" -- start -- -p 3000

# Salvar processo para reiniciar automaticamente caso a VPS reinicie
pm2 save
pm2 startup
```

#### 3. Configurar Proxy Reverso no Nginx
Crie um arquivo de bloco de servidor Nginx:
```bash
sudo nano /etc/nginx/sites-available/finance.seudominio.com
```

Cole o conteúdo de configuração do Nginx:
```nginx
server {
    listen 80;
    server_name finance.seudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ative o site e reinicie o Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/finance.seudominio.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 4. Gerar Certificado SSL Grátis (HTTPS) com Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d finance.seudominio.com
```

O Certbot ativará o protocolo seguro HTTPS no seu subdomínio com renovação automática!

---

## 🤖 Guias e Instruções para Agentes de IA (AGENTS / AI DEVS)

Se você é um **Agente de IA** (Antigravity, Claude, Cursor, Devin, Windsurf) trabalhando nesta base de código, siga rigorosamente as diretrizes abaixo para executar, modificar e testar a aplicação sem quebrar nada:

### 1. Checklist de Inicialização para Agentes
1. **Verificar Instalação**: Execute `pnpm install` ou `npm install`.
2. **Checar Compilação de Tipos**: Execute sempre `npx tsc --noEmit` para garantir 0 erros de TypeScript antes e depois de qualquer edição.
3. **Ambiente `.env.local`**: Caso o arquivo `.env.local` não exista, copie `.env.example` para `.env.local`.

### 2. Estrutura Principal de Arquivos
- `app/(dashboard)/layout.tsx`: Layout mestre contendo os Provedores de Estado (`ProfileProvider`, `SidebarProvider`, `ValuesVisibilityProvider`), `Sidebar` e `Header`.
- `components/dashboard/PersonalDashboardView.tsx`: Dashboard Pessoal (PF) completo com métricas, seletor de datas `PeriodBar`, gráficos Recharts, cards de orçamento, seletor de membro (`Todos` / `👤 Gastão` / `👤 Amanda`) e lista responsiva de lançamentos.
- `lib/transactionData.ts`: Base de dados consolidada com **1.846 lançamentos reais** de Gastão (Banco Galicia) e Amanda (Mercado Pago).
- `docs/FINANCAS_PESSOAIS.md`: Documentação técnica completa do módulo de finanças pessoais, auditoria de extratos e categorização.
- `lib/ai/receiptScanner.ts`: Módulo de inteligência artificial e OCR para leitura e extração de comprovantes, cupons fiscais e extratos bancários.
- `lib/contexts/ProfileContext.tsx`: Gerencia a alternância entre os perfis **PJ (Empresa)** e **PF (Pessoal)**.
- `lib/db/schema.ts`: Schemas de tabelas do banco de dados Drizzle ORM (clientes, contratos, faturas, transações, etc.).

### 3. Regras de Negócio e Categorização Obrigatórias
Ao adicionar ou modificar lançamentos financeiros nesta aplicação, obedeça às seguintes regras:
- **Transporte & Veículo**: Lançamentos com `UBER`, `EMOVA`, `SUBTE`, `SUBE`, `CABIFY` devem obrigatoriamente pertencer a `Transporte & Veículo` (`Uber / Cabify` ou `Transporte Público (SUBE/Subte)`).
- **Filhos & Família**: Mensalidades escolares (ex: `Colegio Misericordia` / `Asociacion Hijas de la Misericordia`) pertencem estritamente a `Filhos & Família` -> `Escola / Colegiatura`.
- **Alimentação & Supermercado**: Compras em `Coto`, `Carrefour`, `Disco`, `Jumbo`, `Dia %`, `iFood`, `PedidosYa`, etc.
- **Geral & Diversos**: Lançamentos históricos genéricos ou sem identificação específica devem ser alocados na categoria `📦 Geral & Diversos` (`Lançamentos Históricos`).

### 4. Boas Práticas de UI / Layout Responsivo
- **Breakpoints**: A alternância entre tabela e cards móveis ocorre no breakpoint `md` (768px). Celulares e telas pequenas usam cards empilhados (`block md:hidden`), enquanto desktop/tablets usam a tabela com rolagem horizontal suave (`hidden md:block overflow-x-auto min-w-[750px]`).
- **Badges de Moeda**: As moedas são exibidas estritamente pelas siglas **`ARS`**, **`BRL`** e **`USD`** com a classe `whitespace-nowrap inline-flex items-center` para impedir quebras em duas linhas.

### 5. Validação de Alterações para Agentes
Antes de finalizar qualquer tarefa, execute:
```bash
npx tsc --noEmit
```
Certifique-se de obter resultado sem nenhum erro de compilação.

---

## 🛠️ Tabela de Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `pnpm dev` ou `npm run dev` | Inicia o servidor de desenvolvimento com Turbopack |
| `npx tsc --noEmit` | Valida a checagem de tipos TypeScript (0 erros obrigatórios) |
| `pnpm build` ou `npm run build` | Compila a aplicação para produção |
| `pnpm start` ou `npm run start` | Inicia o servidor de produção compilado |
| `pnpm db:migrate` | Aplica as migrações do Drizzle no banco PostgreSQL |
| `pnpm db:generate` | Gera arquivos de migração a partir do schema em `lib/db/schema.ts` |
| `pnpm db:studio` | Abre a interface visual do Drizzle Studio no navegador |

---

## 📱 Suporte Responsivo
A aplicação é 100% responsiva para desktop, notebooks, tablets e smartphones, com menu lateral recolhível e alternância dinâmica PJ/PF.
