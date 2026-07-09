# Deploy do Preview Web no Vercel — Licita IA (mobile-client)

Este guia explica como publicar o app `apps/mobile-client` (Expo + react-native-web) como um
**preview web estático** no Vercel, usando a sua própria conta Vercel.

> Este preview serve apenas para o cliente visualizar o app funcionando no navegador. As builds
> nativas (iOS/Android) continuam sendo feitas separadamente via EAS Build — isso não muda.

## 1. Pré-requisitos

- O repositório GitHub `licita-ia` já está com o build web configurado (`vercel.json` +
  script `build:web` em `apps/mobile-client/package.json`).
- Você precisa de acesso ao repositório no GitHub (para o Vercel importar) e de uma conta Vercel
  (gratuita ou paga).

## 2. Importar o projeto no Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login (ou crie uma conta) com o GitHub.
2. Clique em **Add New... → Project**.
3. Selecione **Import Git Repository** e escolha o repositório `Taedsolucoes/licita-ia`.
4. Na tela de configuração do projeto, ajuste os campos abaixo antes de clicar em **Deploy**.

## 3. Configuração do projeto (monorepo)

Como este é um monorepo (pnpm workspaces com `apps/api` e `apps/mobile-client`), é necessário
apontar o Vercel apenas para a pasta do app mobile:

| Campo (Vercel)      | Valor                                  |
|---------------------|-----------------------------------------|
| **Root Directory**  | `apps/mobile-client`                    |
| **Framework Preset** | `Other` (não é Next.js/Vite — é build customizado) |
| **Build Command**   | `npm run build:web` (já definido em `vercel.json`, você pode deixar o padrão detectado) |
| **Output Directory**| `dist` (já definido em `vercel.json`)   |
| **Install Command** | padrão (`npm install`) — o Vercel detecta o `package-lock.json` da própria pasta |

O arquivo `apps/mobile-client/vercel.json` já contém:

```json
{
  "buildCommand": "npm run build:web",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Isso garante:
- O comando de build correto (`expo export -p web`, via script `build:web`).
- A pasta de saída correta (`dist`, gerada pelo `expo export`).
- O rewrite de SPA (qualquer rota client-side cai em `index.html`, evitando 404 ao navegar/recarregar
  páginas internas do app).

> Observação: como o Root Directory está definido como `apps/mobile-client`, o Vercel roda
> `npm install` e o `buildCommand` **dentro dessa pasta**, usando o `package-lock.json` próprio do
> app (não o `pnpm-lock.yaml` da raiz do monorepo). Isso foi validado localmente e funciona sem
> depender do restante do monorepo.

## 4. Variável de ambiente — apontar para o backend real

Antes de fazer o deploy (ou logo depois, em **Settings → Environment Variables**), adicione:

| Nome                    | Valor                                                              |
|-------------------------|---------------------------------------------------------------------|
| `EXPO_PUBLIC_API_URL`   | `https://lively-inspiration-production-684b.up.railway.app/api`     |

> Ajuste o valor para a URL de produção real do backend (Railway/Render), sempre incluindo o
> prefixo `/api` do NestJS. Sem essa variável, o app usa o valor padrão já configurado no código
> (`apps/mobile-client/src/config/env.ts`), mas é recomendado definir explicitamente no Vercel para
> deixar claro qual ambiente está sendo usado no preview.

Depois de adicionar/alterar a variável, é necessário fazer um **Redeploy** (Vercel não aplica env
vars novas em builds já existentes).

## 5. Deploy

Clique em **Deploy**. O Vercel irá:
1. Clonar o repositório e entrar em `apps/mobile-client`.
2. Rodar `npm install`.
3. Rodar `npm run build:web` (gera a pasta `dist`).
4. Publicar o conteúdo de `dist` como site estático, com o rewrite de SPA configurado.

Ao final, você receberá uma URL pública (ex: `https://licita-ia-client.vercel.app`) para enviar ao
cliente.

## 6. Validação local (já realizada nesta auditoria)

- `npm run build:web` executado com sucesso em `apps/mobile-client`, gerando `dist/` com
  `index.html`, `favicon.ico`, `metadata.json` e o bundle JS em
  `dist/_expo/static/js/web/index-*.js` (~1.11 MB).
- Testado servindo a pasta `dist` localmente com um servidor HTTP simples: `index.html` e o bundle
  JS responderam com status `200`.
- Testado rodando o build tanto a partir da raiz do monorepo (`npm run build:web --prefix
  apps/mobile-client`) quanto de dentro da própria pasta (`apps/mobile-client && npm run
  build:web`) — ambos funcionam. A configuração recomendada acima (Root Directory =
  `apps/mobile-client`) foi validada também com um `npm install` standalone (usando apenas o
  `package-lock.json` da própria pasta), sem depender do `pnpm-lock.yaml` da raiz.

## 7. Limitações conhecidas do preview web

- Este é um preview **web** gerado via `react-native-web`; funcionalidades exclusivamente nativas
  (notificações push nativas, câmera nativa, etc.) podem ter comportamento limitado ou não
  funcionar no navegador. Isso é uma limitação inerente ao react-native-web, não um bug de
  configuração.
- Nenhuma mudança visual, de layout ou de comportamento de tela foi feita nesta tarefa — apenas
  configuração de build/infraestrutura.
