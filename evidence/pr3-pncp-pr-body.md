## Objetivo

Implementar o primeiro conector oficial do sistema próprio de alertas, usando exclusivamente a API pública de Consulta do PNCP.

## Rotas oficiais utilizadas

- `GET /api/consulta/v1/contratacoes/publicacao` para janela de data de publicação.
- `GET /api/consulta/v1/contratacoes/proposta` para contratações com recebimento de propostas em aberto.

## Alterações

- Cria `PncpConsultaProvider` com paginação por modalidade e cursor composto.
- Usa os códigos oficiais 1–13 da tabela de modalidade do PNCP.
- Suporta UF, código IBGE do município, modalidade, janela temporal e tamanho de página até 500.
- Mapeia o envelope oficial para o contrato interno de `BiddingSourceRaw`.
- Registra `SourceRegistry` e snapshots brutos com SHA-256 no fluxo de sincronização.
- Persiste número de controle PNCP, processo, modalidade oficial, órgão, município, datas, valor e status.
- Renomeia as rotas internas para `sources/pncp/sync` e `sources/pncp/health`.
- Adiciona configuração PNCP no `.env.example`.
- Adiciona fixtures e testes locais sem rede.

## Limites conscientes

O endpoint oficial consultado não entrega itens detalhados no mesmo envelope; `fetchBiddingItems` permanece vazio até um PR específico de detalhe oficial. O smoke test em produção foi tentado com uma requisição mínima e expirou sem bytes de resposta; por isso não foi tratado como prova de disponibilidade. Nenhum endpoint do Alerta Licitações ou de concorrentes foi chamado por este PR.

## Migrations

Nenhuma migration nova neste adapter. A implementação depende do modelo de proveniência do PR #3.

## Validações

- `pnpm --filter @licita-ia/api test:pncp` — 2 testes aprovados.
- `pnpm typecheck` — aprovado.
- `pnpm --filter @licita-ia/api build` — aprovado.
- `git diff --check` — aprovado.

## Base do PR

A branch inclui os commits dos PRs de isolamento e proveniência porque o repositório original ainda não os mesclou. Após os PRs anteriores serem aprovados, este diff será reduzido automaticamente ao adapter PNCP.
