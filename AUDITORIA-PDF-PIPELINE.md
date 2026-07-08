# Relatório de Auditoria — Pipeline de Relatórios/PDF (LicitaIA)

**Data:** 08/07/2026 · **Escopo:** integração AlertaLicitacao → worker BullMQ → geração de PDF (Puppeteer) → storage → deploy Render.
**Snapshot auditado:** `C:\Users\tayna\projects\licita-ia` (branch main local).

---

## 1. Bugs encontrados e correções aplicadas

### BUG 1 (CRÍTICO) — `render.yaml`: `env: node` ignorava o Dockerfile
O serviço estava declarado com `env: node` + `buildCommand`/`startCommand`. Nesse modo o Render **não usa o Dockerfile** — logo o chromium nunca seria instalado em produção e **toda geração de PDF falharia** com "Browser executable not found". O `dockerfilePath: apps/api/Dockerfile` presente no arquivo era simplesmente ignorado.
**Correção:** trocado para `runtime: docker` + `dockerCommand: sh -c "pnpm db:migrate && node --unhandled-rejections=throw dist/main.js"` (executado a partir do `WORKDIR /app/apps/api`). Removidos `buildCommand`/`startCommand` (inválidos em runtime docker) e os campos `healthCheckInterval/Timeout/UnhealthyThreshold` (não fazem parte do spec de Blueprint).

### BUG 2 (CRÍTICO) — `render.yaml`: disk sem `mountPath` e com chave inválida `id`
O bloco era `disk: { id: licita-ia-disk, sizeGB: 1 }`. O spec do Render exige `name` (não `id`) e **`mountPath` é obrigatório** — sem ele o disco não é montado e os PDFs gravados em `storage/reports` iam para o filesystem efêmero, **perdidos a cada deploy/restart**.
**Correção:**
```yaml
disk:
  name: licita-ia-disk
  mountPath: /app/apps/api/storage
  sizeGB: 1
```
O `mountPath` foi calculado a partir do código real: `ReportsService` usa `path.join(process.cwd(), 'storage', 'reports')` e o Dockerfile define `WORKDIR /app/apps/api` ⇒ diretório efetivo `/app/apps/api/storage/reports`.

### BUG 3 (ALTO) — `Dockerfile`/`render.yaml`: caminho errado do chromium no Alpine
`PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser`. Confirmado via pkgs.alpinelinux.org: no Alpine ≥3.15 o pacote `chromium` entrega o binário como **`/usr/bin/chromium`**; `chromium-browser` era só um symlink de compatibilidade (pacote separado `chromium-swiftshader`/link legado) que **não existe mais nas branches recentes** usadas pela imagem `node:20-alpine`. Em produção o Puppeteer falharia no launch.
**Correção:** `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` no Dockerfile **e** no `render.yaml`, mais um guard no build: `RUN test -x /usr/bin/chromium || exit 1` — se o Alpine mudar o caminho de novo, o build quebra em vez de quebrar em runtime.

### BUG 4 (ALTO) — `render.yaml`: `DATABASE_URL`/`REDIS_URL` com `scope: build`
Ambas estavam com `scope: build`, ou seja, **indisponíveis em runtime** — a API não conseguiria conectar em Postgres/Redis em produção.
**Correção:** removido `scope: build` (mantido `sync: false`).

### BUG 5 (MÉDIO) — Template importava Google Fonts via CDN
`bidding-analysis.template.ts` tinha `@import url('https://fonts.googleapis.com/...Inter...')`. Combinado com `waitUntil: 'networkidle0'`, isso significa: (a) sem rede/DNS no container, `setContent` espera a falha da request (lentidão/travamento potencial, e não havia `timeout` definido — default 30s, mas o `page.pdf` não tinha timeout algum); (b) fonte inconsistente entre ambientes.
**Correção:** removido o `@import`; stack de fontes trocada para fontes de sistema (`-apple-system, ... Arial, sans-serif`). Template agora é 100% self-contained — validado no teste com interceptação de rede: **0 requests externas** nos dois templates.

### BUG 6 (MÉDIO) — Puppeteer sem timeouts explícitos
`page.setContent` sem `timeout`, `page.pdf` sem `timeout`, launch sem `protocolTimeout`. Um Chromium travado bloquearia o worker BullMQ indefinidamente.
**Correção em `reports.service.ts`:** `protocolTimeout: 60_000` no launch, `timeout: 30_000` no `setContent`, `timeout: 60_000` no `page.pdf`.

### BUG 7 (MÉDIO) — Footer duplicado e contagem de páginas quebrada no template
O template tinha um `.footer-fixed` no `<body>` usando classes `.pageNumber`/`.totalPages` — que **só funcionam dentro do `footerTemplate` do Puppeteer**, nunca no corpo da página. Como `reports.service.ts` já usa `displayHeaderFooter + footerTemplate`, o resultado era **footer duplicado** em cada página com "Página _ de _" vazio.
**Correção:** removido o footer in-body do template (o footer oficial do Puppeteer permanece). Confirmado no PDF gerado: rodapé único "Página 1 de 2 / ... de 11" correto.

### BUG 8 (BAIXO) — Datas date-only deslocadas por timezone
`formatDate` usava `toLocaleDateString('pt-BR')` sem `timeZone`. Datas de sessão armazenadas como UTC-midnight (ex.: `2025-04-28T00:00:00Z`) renderizariam como **27/04/2025** num servidor em UTC-3.
**Correção:** `timeZone: 'UTC'` para datas date-only nos dois templates; `timeZone: 'America/Sao_Paulo'` para o timestamp "gerado em".

### BUG 9 (BAIXO) — Card de risco cortava texto com labels largos
Com `riskLevel` nulo, o label "NÃO AVALIADO" espremia a descrição no flex row.
**Correção:** `flex-wrap: wrap` + `flex:1;min-width:140px` no corpo do card. Validado no PDF do caso nulo.

---

## 2. Respostas às 6 perguntas de validação

### Q1 — Autenticação da API AlertaLicitacao funciona?
**PARCIAL — código validado, chamada real NÃO testada (pendência).**
Auditoria do provider (`alerta-licitacao.provider.ts`) confirma implementação correta para modo real:
- Token via `ALERTALICITACAO_TOKEN`; sem token → MOCK mode com `logger.warn` explícito; com token → log "REAL mode" (linhas 93–101).
- Detecção de **HTML/página de login** em vez de JSON (linha 149): loga erro "token may be invalid" e retorna resultado vazio sem crashar.
- **Timeout**: `AbortSignal.timeout(30_000)` no fetch principal, 15s no detalhe, 10s no healthcheck.
- **Paginação por data**: parâmetro `data_insercao` formatado a partir de `options.since`/ontem.
- Token **redigido nos logs** (`token=<redacted>`).
- Lacuna conhecida: não há tratamento específico de HTTP 429 (rate limit) — cai no `!response.ok` genérico e retorna vazio; o job seguinte re-tenta. Aceitável, mas sem backoff dedicado.
⚠️ **Não é possível validar a autenticação real sem um `ALERTALICITACAO_TOKEN` de produção. Isso NÃO foi testado. Pendência explícita.**

### Q2 — Processamento e salvamento no banco?
**PARCIAL — código auditado, fluxo com Postgres/Redis reais não executado localmente.**
`reports.processor.ts` (worker BullMQ) delega a `ReportsService.generateReport`, que: renderiza o template → gera PDF → grava em `storage/reports` → calcula checksum SHA-256 → atualiza o registro `report` com `status: 'ready'`, `storageKey`, `fileName`, `checksum`, `generatedAt` (linhas 220–241 do service). Erros marcam o report como failed e propagam para retry do BullMQ. **Docker/Postgres não estavam disponíveis nesta máquina** (docker ausente), então o roundtrip com banco real não foi executado — apenas o núcleo de renderização foi testado de forma isolada e idêntica ao código de produção.

### Q3 — Geração de PDF sem erros com casos variados?
**SIM — testado com PDFs reais gravados em disco.** Harness (`.tmp-tools/testenv/run-pdf-test.js`) que bundla os **templates reais do repo** via esbuild e usa **exatamente as mesmas opções de Puppeteer do `ReportsService.renderHtmlToPdf`** (A4, printBackground, margens, footerTemplate, timeouts). Resultado (log real da execução final):

```
[OK] 01-normal: ...\storage\reports-test\01-normal.pdf | 166.6 KB | magic=%PDF- | 3430ms | external-requests=0
[OK] 02-texto-longo-acentos-60-itens: ... | 349.3 KB | magic=%PDF- | 1675ms | external-requests=0
[OK] 03-analise-nula: ... | 143.3 KB | magic=%PDF- | 2733ms | external-requests=0
[OK] 04-impugnacao: ... | 205.9 KB | magic=%PDF- | 3262ms | external-requests=0
ALL CASES PASSED
```
Casos cobertos: objectText de ~4.400 caracteres, acentos/especiais (ç ã é ê — • ½ § º ª & < >), tabela com **60 itens** (PDF de 11 páginas), e **todos os campos de análise nulos** (arrays vazios, datas nulas, valores nulos) — nenhuma exception, nenhum PDF vazio.

### Q4 — Formatação correta?
**SIM — verificado por extração de texto dos PDFs gerados.**
- Acentos renderizados corretamente: "ç Ç ã Ã õ Õ é É ê Ê í Í ó Ó ú Ú à À â — – • ½ § º ª R$ 1.234.567,89" legíveis no PDF (página 2 do caso 02).
- Caso nulo mostra fallbacks corretos ("Não informado", "Não consta", "NÃO AVALIADO", "Verificar no edital") sem layout quebrado.
- Rodapé com paginação correta: "Página 1 de 2" / "Página 2 de 11" (após o fix do footer duplicado).
- Texto longo quebra em múltiplas páginas sem corte (11 páginas no caso 02).
- Escape de HTML confirmado: `& < >` aparecem como texto, não como markup.
- Observação: os PDFs de teste foram gerados com Chrome no Windows; em produção será o chromium do Alpine + `ttf-freefont` — a stack de fontes agora usa fontes de sistema, cobertas pelo pacote instalado no Dockerfile.

### Q5 — Libs instaladas corretamente no Render?
**AGORA SIM (após correções) — antes, NÃO.** Três defeitos impediam: (1) `env: node` fazia o Render ignorar o Dockerfile inteiro (nenhum chromium); (2) `PUPPETEER_EXECUTABLE_PATH` apontava para `/usr/bin/chromium-browser`, caminho inexistente no Alpine atual — o correto é `/usr/bin/chromium` (verificado no índice de pacotes do Alpine); (3) disk sem `mountPath`. Tudo corrigido; o Dockerfile agora também **falha no build** se o binário do chromium não existir no caminho esperado. ⚠️ O build Docker em si não pôde ser executado localmente (Docker não instalado nesta máquina) — validação final ocorrerá no primeiro deploy.

### Q6 — Fluxo completo ponta a ponta?
**PARCIAL.** Cadeia auditada por código: provider (fetch/mock) → persistência de biddings → job BullMQ → processor → service → template → Puppeteer → PDF em disco → update no banco. O trecho **template → Puppeteer → PDF em disco** foi executado de verdade com 4 cenários (ver Q3). Os elos que dependem de infraestrutura externa **não** foram executados: API real do AlertaLicitacao (sem token), Postgres/Redis/BullMQ (sem Docker nesta máquina) e o deploy Render. Pendências listadas abaixo.

---

## 3. Evidências (artefatos)

| Arquivo | Tamanho | Páginas |
|---|---|---|
| `C:\Users\tayna\projects\licita-ia\storage\reports-test\01-normal.pdf` | 170.561 bytes | — |
| `C:\Users\tayna\projects\licita-ia\storage\reports-test\02-texto-longo-acentos-60-itens.pdf` | 357.673 bytes | 11 |
| `C:\Users\tayna\projects\licita-ia\storage\reports-test\03-analise-nula.pdf` | 146.718 bytes | 2 |
| `C:\Users\tayna\projects\licita-ia\storage\reports-test\04-impugnacao.pdf` | 210.842 bytes | — |

Harness de teste reproduzível: `C:\Users\tayna\projects\licita-ia\.tmp-tools\testenv\run-pdf-test.js` (rodar com `node run-pdf-test.js`; requer Chrome instalado).

Sanidade de sintaxe dos 4 arquivos TS alterados: transformados com esbuild (experimentalDecorators) sem erros.

---

## 4. Pendências explícitas (não testado / requer acesso)

1. **Integração real AlertaLicitacao**: requer `ALERTALICITACAO_TOKEN` de produção. Nenhuma chamada real foi feita. Testar em staging: healthcheck do provider + fetch de 1 dia de dados, conferindo logs "REAL mode" e ausência do aviso de HTML/login.
2. **Rate limit (HTTP 429)**: sem tratamento dedicado no provider (cai no erro genérico). Avaliar backoff se a API real limitar.
3. **Build Docker + deploy Render**: Docker não disponível nesta máquina; o Dockerfile corrigido tem guard de build para o chromium, mas o primeiro deploy no Render deve ser acompanhado (verificar mount do disk em `/app/apps/api/storage` via shell do Render: `df -h` / `mount | grep storage`).
4. **Roundtrip com Postgres/Redis/BullMQ**: não executado localmente (sem Docker). O código foi auditado; recomendo smoke test em staging: enfileirar 1 relatório e conferir `status='ready'` + arquivo no disk.
5. **Git indisponível nesta máquina**: as correções estão aplicadas nos arquivos locais, porém **não foi possível criar o branch `fix/pdf-pipeline` nem commitar** (git não instalado). Arquivos alterados prontos para commit: `render.yaml`, `apps/api/Dockerfile`, `apps/api/src/modules/reports/reports.service.ts`, `apps/api/src/modules/reports/templates/bidding-analysis.template.ts`, `apps/api/src/modules/reports/templates/impugnation.template.ts`.
