# Deploy do LICITA IA na Vercel

## Arquitetura recomendada

Use dois serviços separados, não duas Vercel Functions no mesmo projeto:

- **Frontend:** `apps/mobile-client`, exportado pelo Expo como site estático e publicado na Vercel.
- **API e workers:** `apps/api`, executado como serviço Node/Docker persistente no Render (ou outro host de containers persistentes). O `render.yaml` já define esse serviço, health check em `/health`, banco PostgreSQL, Redis e disco para relatórios.

A API NestJS inicia workers BullMQ para ingestão/matching/relatórios/notificações e possui `IntegrationScheduler`. Os jobs de PNCP e Compras.gov.br são enfileirados e respondem `202` com um `jobId`; o trabalho demorado é feito pelo worker após a resposta HTTP. Uma função Vercel por requisição não substitui esse worker persistente, nem deve ser usada como processo BullMQ ou scheduler.

A URL do frontend deve apontar diretamente para a API persistente. Não se configura um `vercel.json` para a API, pois isso sugeriria uma arquitetura serverless incompatível com as filas e workers atuais.

## Projeto Vercel do frontend

Importe o repositório GitHub como um projeto Vercel e configure **Root Directory** como `apps/mobile-client`. Mantenha a opção de incluir arquivos fora desse diretório habilitada, pois o app usa o workspace pnpm da raiz. A Vercel documenta um projeto por diretório implantável em monorepos e instalação filtrada com pnpm [documentação de monorepos](https://vercel.com/docs/monorepos).

O arquivo [`apps/mobile-client/vercel.json`](apps/mobile-client/vercel.json) define:

- Instalação filtrada pelo workspace `mobile-client` com lockfile congelado.
- Build `pnpm run build:web`, equivalente ao script do pacote `expo export -p web`.
- Saída estática `dist`.
- Rewrite de rotas para `/index.html`, mantendo a URL e suportando fallback SPA em refresh. A Vercel documenta rewrites como encaminhamento interno sem alterar a URL visível [documentação de rewrites](https://vercel.com/docs/routing/rewrites).

Configure no projeto Vercel esta variável de **Build/Preview e Production**, conforme o ambiente:

- `EXPO_PUBLIC_API_URL`: URL HTTPS pública da API incluindo o prefixo `/api`, por exemplo `https://api.seu-dominio.com/api`. Como Expo substitui `EXPO_PUBLIC_*` durante o build, não inclua segredos nesse valor.

`EXPO_PUBLIC_EAS_PROJECT_ID` é usado pelo app nativo para push e não é necessário no Web.

## Variáveis do backend

Configure as variáveis no host persistente da API. Nunca as coloque no projeto Vercel do frontend.

**Obrigatórias para produção:**

- `DATABASE_URL`: conexão PostgreSQL usada pelo Prisma. Para Supabase, use a conexão PostgreSQL do projeto e confira o modo de conexão e os parâmetros indicados pelo Supabase/Prisma para o ambiente; o app não usa uma URL pública Supabase no frontend.
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`: conexão Redis usada pelo BullMQ. O código atual lê esses campos separadamente; não substitua por `REDIS_URL` sem alterar o código.
- `JWT_SECRET`: segredo aleatório forte, exclusivo de produção. O código possui fallback de desenvolvimento, que não deve ser usado em produção.
- `CORS_ORIGIN`: origens HTTPS exatas do frontend, separadas por vírgula quando houver mais de uma. Inclua o domínio de produção e o domínio Preview estável usado nos testes.
- `NODE_ENV=production`.

**Runtime e recuperação de senha:**

- `PORT`: fornecida pelo host; a API usa `3000` como fallback local.
- `JWT_ACCESS_EXPIRATION=15m` e `JWT_REFRESH_EXPIRATION=7d`: opcionais, com esses valores padrão no código.
- `APP_WEB_URL`: domínio HTTPS do frontend usado nos links de redefinição de senha.
- Para envio real de e-mail, configurar `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` e, se necessário, `SMTP_SECURE`. Sem SMTP, o serviço fica em modo de log/mock.

**Integrações opcionais:**

- Alerta Licitação: `ALERTA_LICITACAO_API_KEY`. É opcional; sem ela, o provedor existente pode operar em modo mock. `SYNC_INTERVAL_MS` também é opcional e tem padrão de 30 minutos.
- PNCP: endpoint público sem credencial. `PNCP_CONSULTA_BASE_URL`, `PNCP_INTEGRACAO_BASE_URL`, `PNCP_REQUEST_TIMEOUT_MS` (padrão 30000), `PNCP_MAX_RETRIES` (3) e `PNCP_REQUEST_DELAY_MS` (100) podem ser ajustados.
- Compras.gov.br: endpoint público sem credencial. `COMPRAS_GOV_BASE_URL` e `COMPRAS_GOV_REQUEST_TIMEOUT_MS` (padrão 30000) são configuráveis.
- Petronect: se contratado/configurado, preencher `PETRONECT_ENV`, `PETRONECT_CLIENT_ID`, `PETRONECT_CLIENT_SECRET`, URLs de token e de editais (`PETRONECT_TOKEN_URL_*`, `PETRONECT_PUBLIC_OPEN_URL_*`, `PETRONECT_PUBLIC_CLOSED_URL_*`) e `PETRONECT_REQUEST_TIMEOUT_MS`.
- Push Firebase: `FIREBASE_SERVICE_ACCOUNT_JSON`. Opcional; sem credencial, push FCM fica em modo mock.
- WhatsApp: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`; nomes de modelos opcionais `WHATSAPP_TEMPLATE_OPPORTUNITY` e `WHATSAPP_TEMPLATE_PARTICIPATION`.

A lista de integrações e seus defaults também está em [`apps/api/.env.example`](apps/api/.env.example). O `.env.example` documenta nomes e placeholders; valores reais devem ser cadastrados como secrets no host.

## PNCP/Compras.gov.br, timeouts e serverless

Os providers têm timeout individual configurável de 30 segundos. PNCP também tem até três tentativas e um intervalo mínimo de 100 ms entre chamadas. Uma ingestão pode paginar por diversos resultados e, portanto, exceder largamente a duração de uma única função HTTP; o endpoint de sincronização apenas adiciona o job à fila, e `BiddingIngestionProcessor` o executa no worker BullMQ.

Não tente resolver isso aumentando `maxDuration` de uma Function da Vercel: a ingestão já foi projetada como job assíncrono, e o processo que o consome precisa permanecer conectado ao Redis. A Vercel informa limites máximos de duração por plano para Functions (Hobby: 300 s; Pro/Enterprise: 800 s normalmente, com extensão beta de até 1800 s) e encerra a invocação quando o limite é atingido [limites oficiais](https://vercel.com/docs/functions/limitations). Isso não transforma a Function em worker persistente.

No serviço de API, mantenha as filas habilitadas e monitore conectividade Redis, retries, falhas dos jobs e limites/rate limits dos provedores. Os valores atuais de 30 segundos são timeout por requisição externa, não prazo total do job.

## Preview e publicação

O preview do frontend pelo Git requer que o repositório esteja importado e conectado a uma conta/time Vercel. Um push para `feat/pncp-direct-integration` cria Preview Deployment se a integração Git estiver habilitada. O frontend de Preview precisa de uma URL de API que aceite essa origem em `CORS_ORIGIN`; se o ambiente de API não autorizar o hostname do Preview, a página carrega, mas as chamadas do navegador serão bloqueadas por CORS.

Não promova a branch à produção nem faça merge em `main` apenas para testar o Preview. Para deploy via CLI, a Vercel CLI precisa estar instalada e autenticada; essa configuração deve ser feita no ambiente do proprietário, sem colocar token Vercel no repositório ou em mensagens.
