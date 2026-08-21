## Objetivo

Adicionar o adapter oficial do Compras.gov.br ao sistema próprio de alertas, sem utilizar a API privada do Alerta Licitações e sem inferir endpoints privados.

## Fonte e operação utilizada

A implementação usa a API pública `https://dadosabertos.compras.gov.br`, operação `GET /modulo-contratacoes/1_consultarContratacoes_PNCP_14133`, documentada no Swagger público e destinada a contratações sob a Lei 14.133/2021.

## Alterações

O PR cria `ComprasPublicasProvider`, com paginação por modalidade, cursor composto, janela incremental, filtros por UF e código IBGE do município, mapeamento do DTO oficial `VwFtPNCPCompraDTO` e registro de proveniência/snapshot no pipeline multi-fonte. O `IntegrationService` passa a sincronizar PNCP e Compras.gov.br separadamente, agregando seus resultados e mantendo um `IntegrationSyncRun` por fonte. Também são adicionados os parâmetros de ambiente, fixture e testes locais.

O smoke test oficial revelou e foi incorporado ao código: `tamanhoPagina` deve estar entre 10 e 500. A resposta oficial para o intervalo testado foi um envelope válido vazio, com `resultado`, `totalRegistros`, `totalPaginas` e `paginasRestantes`.

## Limites conscientes

O Compras.gov.br não expõe, neste adapter, a consulta de propostas abertas equivalente à rota pública do PNCP; esse modo é rejeitado explicitamente para evitar falso positivo. Os endpoints de detalhe e itens exigem semântica pública de `tipo` e `codigo` que será validada em PR próprio. Nenhum endpoint do Alerta Licitações ou de concorrentes foi chamado.

## Migrations

Nenhuma migration nova. O PR depende do modelo de proveniência criado no PR #3.

## Validações

`pnpm --filter @licita-ia/api test:public-sources` aprovou 4 testes; `pnpm typecheck` foi aprovado; o build NestJS foi aprovado; `git diff --check` foi aprovado; o smoke test oficial do Compras.gov.br respondeu com HTTP válido e envelope vazio.

A branch inclui os commits dos PRs anteriores porque o repositório original ainda não os mesclou; depois desses merges o diff efetivo deste PR será reduzido ao adapter Compras.gov.br, às configurações e à orquestração multi-fonte.
