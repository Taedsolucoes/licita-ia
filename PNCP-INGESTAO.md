# Integrações de ingestão de licitações

Os provedores PNCP e Compras.gov.br escrevem em `biddings` por meio de `IntegrationService`, usando `source + sourceExternalId` como chave lógica. Nenhuma migration foi criada: o schema Prisma atual já possui a restrição de unicidade. Quando um registro é novo, o serviço agenda o matching na fila `matching`; os jobs dos conectores são processados pela fila BullMQ `bidding-ingest`.

## PNCP

As rotas exigem JWT e papel `taed_admin` ou `taed_operator`:

- `POST /api/internal/integrations/pncp/sync` — enfileira uma consulta por período e modalidade.
- `GET /api/internal/integrations/pncp/sync/{jobId}` — consulta o estado do job.
- `GET /api/internal/integrations/pncp/health` — verifica a API pública.

Exemplo: `POST /api/internal/integrations/pncp/sync?dataInicial=20261111&dataFinal=20261112&codigoModalidadeContratacao=6&tamanhoPagina=50&dataTipo=publicacao`.

Datas são `yyyyMMdd`; `codigoModalidadeContratacao` é obrigatório. `codigoModoDisputa`, `uf`, `codigoMunicipioIbge`, `palavraChave`, `tamanhoPagina`, `dataTipo` e `incluirItens` são opcionais. `maxPages` opcional limita o número de páginas processadas pelo job; sem ele, o padrão percorre todas as páginas disponíveis. O provider usa as APIs públicas de consulta e, opcionalmente, a API pública de itens.

## Compras.gov.br — Dados Abertos

Rotas autenticadas: `POST /api/internal/integrations/compras-gov/sync` enfileira uma consulta e `GET /api/internal/integrations/compras-gov/health` verifica a disponibilidade do OpenAPI.

O provider consulta `GET /modulo-contratacoes/1_consultarContratacoes_PNCP_14133`. A API oficial exige `dataPublicacaoPncpInicial` e `dataPublicacaoPncpFinal` no formato `YYYY-MM-DD`, além de `codigoModalidade`; a paginação usa `pagina` e `tamanhoPagina` (10–500). O job aceita os parâmetros do DTO PNCP (`dataInicial`, `dataFinal`, `codigoModalidadeContratacao`, `uf`, `codigoMunicipioIbge`, `palavraChave`, `tamanhoPagina` e `maxPages`) e os traduz para os nomes oficiais.

A resposta observada tem `resultado`, `totalRegistros`, `totalPaginas` e `paginasRestantes`. Os campos do registro incluem `numeroControlePNCP`, `idCompra`, `modalidadeNome`, `objetoCompra`, `valorTotalEstimado`, `dataPublicacaoPncp`, `unidadeOrgaoUfSigla` e outros dados de unidade e órgão. `numeroControlePNCP` é usado como `sourceExternalId`; os demais campos disponíveis são normalizados para o schema Prisma e o JSON original é preservado em `rawPayload`. A busca textual é aplicada localmente sobre o objeto. Não é feita hidratação de itens pelo Compras.gov.br neste provider.

## Petronect API Store

Rotas autenticadas: `POST /api/internal/integrations/petronect/public/open/sync` e `POST /api/internal/integrations/petronect/public/closed/sync` enfileiram, respectivamente, oportunidades públicas abertas e encerradas. `GET /api/internal/integrations/petronect/health` valida a configuração e tenta obter um token, sem requisitar oportunidades.

O provider implementa autenticação Bearer com fluxo OAuth `client_credentials`, cache temporário do token, seleção de ambiente e métodos `fetchPublicOpenOpportunities` / `fetchPublicClosedOpportunities`. **A página pública da Petronect confirma API Store, autenticação por token e ambiente sandbox, mas não publica os endpoints, o emissor OAuth, os parâmetros de paginação nem o schema das APIs de oportunidades.** Por isso, não foram inferidos ou chamados endpoints Petronect. Configure as URLs e confirme a forma do token e os nomes dos campos com a documentação técnica da API Store da assinatura. O adaptador aceita envelopes JSON comuns e mapeia campos com aliases, mas a forma real da resposta deve ser validada no sandbox Petronect antes de ativar produção.

## Variáveis de ambiente

PNCP público, sem credenciais:

```env
PNCP_CONSULTA_BASE_URL=https://pncp.gov.br/api/consulta
PNCP_INTEGRACAO_BASE_URL=https://pncp.gov.br/api/pncp
PNCP_REQUEST_TIMEOUT_MS=30000
PNCP_MAX_RETRIES=3
PNCP_REQUEST_DELAY_MS=100
```

Compras.gov.br público:

```env
COMPRAS_GOV_BASE_URL=https://dadosabertos.compras.gov.br
COMPRAS_GOV_REQUEST_TIMEOUT_MS=30000
```

Petronect — defina `PETRONECT_ENV=sandbox` inicialmente, guarde `PETRONECT_CLIENT_ID` e `PETRONECT_CLIENT_SECRET` apenas como secrets no ambiente do backend, e configure as URLs fornecidas pela assinatura API Store:

```env
PETRONECT_ENV=sandbox
PETRONECT_CLIENT_ID=
PETRONECT_CLIENT_SECRET=
PETRONECT_TOKEN_URL_SANDBOX=
PETRONECT_TOKEN_URL_PRODUCTION=
PETRONECT_PUBLIC_OPEN_URL_SANDBOX=
PETRONECT_PUBLIC_CLOSED_URL_SANDBOX=
PETRONECT_PUBLIC_OPEN_URL_PRODUCTION=
PETRONECT_PUBLIC_CLOSED_URL_PRODUCTION=
PETRONECT_REQUEST_TIMEOUT_MS=30000
```

A aplicação também depende das variáveis existentes de banco e fila, incluindo `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT` e, quando aplicável, `REDIS_PASSWORD`. Configure secrets no ambiente do serviço backend (por exemplo, Render); não versione credenciais nem as exponha no app móvel. Se o PostgreSQL estiver no Supabase, use a string de conexão recomendada para o runtime do Render.

## Validação

Foi feito GET real a `https://dadosabertos.compras.gov.br/modulo-contratacoes/1_consultarContratacoes_PNCP_14133` com `pagina=1`, `tamanhoPagina=10`, `dataPublicacaoPncpInicial=2026-01-01`, `dataPublicacaoPncpFinal=2026-11-12` e `codigoModalidade=6`; a API respondeu HTTP 200 com 10 registros e o envelope descrito acima. Também foram consultadas as especificações OpenAPI públicas de Compras.gov.br e a página pública da API Store Petronect.

No sandbox, PostgreSQL e Redis locais foram iniciados e as seis migrations existentes aplicadas, sem novas migrations. O build NestJS e o typecheck passaram. Jobs BullMQ reais de PNCP e Compras.gov.br foram executados com `maxPages=1` usando dados públicos, e cada job foi repetido. Os jobs terminaram com sucesso; a primeira execução gravou 7 novos registros PNCP e atualizou 3 registros já existentes, e a execução repetida criou 0 registros e atualizou 10. Compras.gov.br gravou 10 registros e, na repetição, criou 0 e atualizou 10. As contagens consultadas no banco foram 118 registros com `source=pncp` e 10 com `source=compras-gov` — o banco já continha registros do teste anterior, por isso os totais são maiores que os registros desta rodada.

Petronect não foi chamada, pois não há credenciais e os endpoints exatos são privados à assinatura API Store. Os registros de licitação foram verificados diretamente no banco após ingestão. O backend existente não oferece listagem direta de `biddings`; `GET /opportunities` lista oportunidades tenant-scoped geradas pelo pipeline de matching, não é um endpoint de leitura universal dos registros brutos de ingestão.
