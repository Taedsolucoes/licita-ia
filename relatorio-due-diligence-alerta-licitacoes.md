# Due Diligence Técnica e Blueprint de Replicação — Alerta Licitação

**Projeto-alvo:** `Taedsolucoes/licita-ia`  
**Data da auditoria:** 21 de agosto de 2026  
**Escopo:** superfície pública do Alerta Licitação, fontes oficiais de dados de compras públicas, arquitetura clean-room equivalente e plano de ingestão escalável.  
**Autor:** Manus AI

## 1. Parecer executivo

O Alerta Licitação não aparenta ser apenas uma tela que consulta o PNCP em tempo real. As evidências públicas apontam para um **índice próprio**, alimentado por uma arquitetura híbrida que combina o PNCP, ComprasNet/Compras.gov.br, tribunais de contas, portais estaduais, portais privados, diários oficiais e sites diretamente mantidos por órgãos públicos. O próprio portal declara varredura diária de dezenas de fontes e publica um histórico de correções relacionadas a mudanças de sites e conectores. [1]

A mecânica de contagem por município sem palavra-chave é tecnicamente simples e importante: a aplicação mantém licitações normalizadas em banco próprio, com dimensões de UF, município, modalidade, portal, esfera, CNAE e datas; a página executa uma agregação `GROUP BY` sobre esse índice. Não há evidência de que o site obtenha todas essas contagens de uma chamada única ao PNCP. O comportamento é compatível com um banco local pré-indexado, facetas e agregações materializadas.

A fonte nacional mais importante para a réplica é o **PNCP**, complementado pela **API de Dados Abertos do Compras.gov.br**. O PNCP fornece consultas de contratações por publicação e por propostas abertas, além de detalhe, itens, resultados, documentos, histórico, atas e contratos. O Compras.gov.br fornece consultas distintas para contratações 14.133, legado SIASG/Comprasnet, itens, resultados, UASG, catálogo, pesquisa de preços e ARP. [2] [3]

O TCE-CE possui uma API pública estruturada que pode complementar a cobertura estadual, especialmente nos endpoints LCO de processos, publicações de editais, licitantes, itens e contratos. O TCE-PI publica um mural de licitações e uma aplicação de dados, mas a chamada automatizada ao mural foi dinâmica/bloqueada nesta auditoria. O TCU publica um webservice para suas próprias licitações e compras diretas, porém a chamada sem parâmetros retornou uma página de bloqueio, de modo que não deve ser incorporado como dependência primária sem validação adicional. [4] [5] [6]

> **Conclusão de engenharia:** a réplica funcional correta é um produto de dados com ingestão por conectores, normalização, snapshots, deduplicação por fonte, índice full-text e facetas. Não é uma simples cópia de telas nem uma chamada direta e síncrona a uma API nacional.

## 2. Limites da conclusão

Esta auditoria foi realizada sobre páginas públicas, documentação pública, OpenAPI público e smoke tests não destrutivos. Ela comprova comportamentos observáveis e contratos publicados, mas não comprova o código, o banco, as filas, os jobs, o provedor de nuvem, as credenciais ou os endpoints privados do Alerta. Não foi feita tentativa de contornar login, CAPTCHA, bloqueio, whitelist, rate limit ou controle de acesso.

Também não é possível declarar, apenas olhando a interface, que o Alerta usa determinada API pública em determinada página. A lista oficial de fontes publicada pelo próprio Alerta é evidência de cobertura declarada, não prova do protocolo técnico usado em cada integração. A classificação correta é: endpoint confirmado quando documentado pela autoridade e validado; portal confirmado quando a origem é pública, mas não há API formal; hipótese quando a relação é apenas inferida.

A API própria do Alerta foi deliberadamente excluída como fonte do nosso produto. O contrato público identificado na auditoria proíbe varredura completa, engenharia reversa da API e uso para desenvolver serviço concorrente, além de impor limite de chamadas e obrigações de atribuição. [7] Uma integração futura só deve existir com autorização contratual expressa e revisão jurídica independente.

## 3. Perfil técnico observável do portal

A superfície pública tem características de uma aplicação predominantemente server-rendered, com formulários HTML, rotas semânticas e recursos JavaScript pontuais. O HTML da busca avançada possui token CSRF oculto, formulário `POST`, campos com nomes internos e ação de busca; não foi observada evidência suficiente para afirmar framework, linguagem de servidor ou banco específicos.

O portal expõe algumas páginas e contagens sem autenticação, mas restringe busca por itens, API, determinadas áreas comerciais e recursos do painel. A página de detalhes exibe o link para a origem oficial/portal, ações de favoritar, compartilhar, consulta de outras licitações do município e adição ao Google Agenda. A experiência combina catálogo público, aquisição de usuário, recursos autenticados e notificações.

O repositório `licita-ia` já possui NestJS, PostgreSQL, Prisma, Redis e BullMQ, com `Bidding`, `BiddingItem`, `IntegrationSyncRun`, matching, oportunidades, relatórios e notificações. O provider atual do Alerta foi projetado para o endpoint proprietário e, por isso, aceita apenas UF, palavra-chave, cursor, limite e `since`; ele precisa ser ampliado para um contrato canônico de filtros e múltiplos adapters.

## 4. Mapeamento página por página

| Rota pública | Comportamento observado | Filtros/campos relevantes | Implementação equivalente |
|---|---|---|---|
| `/` | Painel geral, últimas licitações, métricas e navegação principal | abertas, encerradas, vencendo hoje, fontes | consultas agregadas sobre `biddings` e `source_registry` |
| `/!estado` | Grade de UFs com contagens e links | UF | `GROUP BY uf` sobre registros abertos |
| `/!estado/{UF}` | Lista estadual com cobertura parcial para visitante | UF implícita | busca paginada por `uf`; card com ID, abertura, modalidade, órgão, município e objeto |
| `/!licitacao/{id}` | Ficha detalhada e link à origem | identificador da fonte/portal | detalhe canônico, documentos, eventos e link oficial |
| `/!busca` | Busca global; sem aspas, termos separados funcionam como OR; aspas indicam frase | `q`, paginação | PostgreSQL full-text + busca de frase/normalização |
| `/!buscaItens` | Área aparece na navegação, mas exigiu autenticação nesta sessão | texto de item | busca em `bidding_items`; gating por plano/login |
| `/!buscAvancada` | Formulário `POST` com token CSRF e limite declarado de 1.000 licitações | `q`, `da_i`, `da_f`, `UFList[]`, `tiposList[]`, `PortaisList[]`, `EsferasList[]`, `cnae`, `valorMinimo`, `acao=Buscar` | objeto de filtro com todos os campos opcionais; paginação keyset |
| `/!uasg` | Busca por código UASG ou parte do nome do órgão | UASG, nome do órgão | dimensão `agencies`/`uasg`, alimentada por Compras.gov.br |
| `/!uasg/lista` | Lista geral de UASGs | nenhum obrigatório | catálogo de órgãos/unidades com cache |
| `/!tipo` | Contagens de licitações abertas por modalidade e links por código interno | modalidade | `modality_catalog` + `source_modality_map` |
| `/!cnae` | CNAE, descrição e quantidade; módulo marcado como teste e com classificação parcial | CNAE | classificação/enriquecimento próprio; manter cobertura e `unknown` |
| `/!municipios` | Exige primeiro UF e direciona para `/!municipios/{UF}` | UF | dimensão de municípios + faceta por município |
| `/!municipios/{UF}` | Municípios do estado e contagens | UF, município | `GROUP BY municipality_ibge_code` |
| `/!termometro` | Série histórica por palavra-chave, ano e UF opcional | palavra, ano, UF | tabela de fatos/agregado mensal; semântica OR explícita |
| `/!pertodevoce` | Busca por proximidade geográfica | UF, município, raio de 50–500 km, estado único, palavra, modalidades, portais | geocódigo por município, PostGIS/Haversine e facetas |
| `/!alerta` | Cadastro/configuração de alertas por e-mail, com painel para usuário conectado | palavras, regiões, modalidades e canais | preferências por tenant/usuário e jobs de notificação |
| `/!mudancas` | Histórico de correções, novos portais e mudanças de conectores | período implícito | changelog de fonte e `IntegrationSyncRun` com eventos |
| `/!preco` | Faixas de valor; a página informa cobertura parcial do valor | até R$ 80 mil; R$ 80–150 mil; R$ 150–650 mil; R$ 650 mil–1,5 mi; acima de R$ 1,5 mi | faixa derivada + estado `valor_desconhecido` |
| `/!top10` | Ranking por visualizações acumuladas no site/aplicativo | mais/menos visualizadas | métrica própria de eventos de visualização |
| `/!vencendoHoje` | Usa data de abertura igual ao dia exibido; horários passados aparecem encerrados | data e hora de abertura | `proposal_due_date`/`opening_date` em timezone UTC e regra explícita |
| `/!serieTemporal` | Gráfico mensal de licitações encerradas; histórico antigo em backup | mês, ano | tabela de agregados mensais e retenção local |
| `/!desenvolvedores` | API própria com token/IP e termos de uso | não é fonte recomendada | manter fora do pipeline principal |
| `/!api` | Rota de documentação/consulta própria, com acesso condicionado | token | não usar para alimentar produto concorrente |

### 4.1 Taxonomia de modalidade observada

A página de modalidades expõe códigos internos próprios. Foram observados: Pregão eletrônico (`5`), Dispensa (`6`), Concorrência (`2`), Chamamento público (`11`), Registro de preço (`10`), Inexigibilidade (`7`), Pregão (`13`), Pregão presencial (`8`), Concorrência eletrônica (`17`), Leilão (`3`), Cotação Eletrônica (`15`), Convite (`1`) e Concurso (`9`). Esses códigos não devem ser confundidos automaticamente com os códigos nacionais do PNCP; o sistema deve manter o código original de cada fonte e um código canônico interno.

### 4.2 Taxonomia de portais observada

A página de proximidade lista, entre outros, Compras Governamentais/ComprasNET, Licitações-E/Banco do Brasil, BEC-SP, PNCP, PRODESP, BLL Compras, BNC Compras, BBMNET, Portal de Compras Públicas, LicitaNET, Compras BR, M2A Compras e “Demais portais”. O mesmo portal declara ainda LicitaCON-RS, E-Lic-SC, Licitar Digital, Publinexo, DOU, portais estaduais, TCEs, Petronect, Casa da Moeda, agências de fomento, sites municipais e outros. [1]

## 5. APIs públicas confirmadas

### 5.1 PNCP — consulta de contratações

**Base confirmada:** `https://pncp.gov.br/api/consulta`. O manual oficial descreve consulta pública sem autenticação para operações de leitura. [2]

| Uso | Endpoint | Parâmetros essenciais |
|---|---|---|
| Publicações | `GET https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao` | `dataInicial`, `dataFinal`, `codigoModalidadeContratacao`, `pagina`; opcionais `uf`, `codigoMunicipioIbge`, `cnpj`, `codigoUnidadeAdministrativa`, `idUsuario`, `tamanhoPagina` |
| Propostas abertas | `GET https://pncp.gov.br/api/consulta/v1/contratacoes/proposta` | `dataFinal`, `codigoModalidadeContratacao`, `pagina`; opcionais UF, município IBGE, CNPJ, unidade e usuário |
| Atas por vigência | `GET https://pncp.gov.br/api/consulta/v1/atas` | `dataInicial`, `dataFinal`, `pagina`; opcionais CNPJ, unidade, usuário, `tamanhoPagina` |
| Contratos por publicação | `GET https://pncp.gov.br/api/consulta/v1/contratos` | `dataInicial`, `dataFinal`, `pagina`; opcionais CNPJ, unidade, usuário, `tamanhoPagina` |

O retorno de publicação contém número de controle PNCP, número/ano da compra, processo, instrumento, modalidade, modo de disputa, situação, objeto, valores, datas de abertura/encerramento de propostas, órgão, unidade, código IBGE, município, UF e `linkSistemaOrigem`. O retorno de atas e contratos preserva os vínculos com a contratação por `numeroControlePNCPCompra`.

### 5.2 PNCP — detalhe e enriquecimento

A configuração OpenAPI publicada em `https://pncp.gov.br/api/pncp/v3/api-docs/swagger-config` aponta para `https://pncp.gov.br/pncp-api/v3/api-docs`. A especificação lista, entre outras, as seguintes rotas de leitura:

```text
GET /v1/orgaos/{cnpj}/compras/{ano}/{sequencial}
GET /v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens
GET /v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens/{numeroItem}
GET /v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/arquivos
GET /v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/historico
GET /v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens/{numeroItem}/resultados
GET /v1/orgaos/{cnpj}/contratos/contratacao/{anoContratacao}/{sequencialContratacao}
```

A inspeção do OpenAPI não encontrou `bearerAuth` explícito na maioria das operações GET de consulta, enquanto operações de arquivos excluídos declaram token. Mesmo assim, cada rota deve ser validada com smoke test limitado, monitoramento e respeito ao contrato atualizado.

### 5.3 Dados Abertos Compras.gov.br

**Base confirmada:** `https://dadosabertos.compras.gov.br`. A documentação oficial e o OpenAPI estão em `https://dadosabertos.compras.gov.br/swagger-ui/index.html` e `https://dadosabertos.compras.gov.br/v3/api-docs`. [3]

| Domínio | Endpoint exato | Uso |
|---|---|---|
| Contratações 14.133 | `GET /modulo-contratacoes/1_consultarContratacoes_PNCP_14133` | lista por publicação, modalidade, órgão, unidade, UF e município IBGE |
| Detalhe 14.133 | `GET /modulo-contratacoes/1.1_consultarContratacoes_PNCP_14133_Id` | detalhe por `tipo` e `codigo` |
| Itens 14.133 | `GET /modulo-contratacoes/2_consultarItensContratacoes_PNCP_14133` | itens por unidade, órgão, situação, catálogo, NCM/PDM e período |
| Detalhe de item | `GET /modulo-contratacoes/2.1_consultarItensContratacoes_PNCP_14133_Id` | item por `tipo`, `codigo` e `idCompraItem` |
| Resultados | `GET /modulo-contratacoes/3_consultarResultadoItensContratacoes_PNCP_14133` | vencedor, fornecedor, porte, situação e valor homologado |
| Legado SIASG | `GET /modulo-legado/1_consultarLicitacao` | UASG, aviso, modalidade, publicação e indicador 14.133 |
| Detalhe legado | `GET /modulo-legado/1.1_consultarLicitacao_Id` | detalhe da licitação legada |
| Itens legados | `GET /modulo-legado/2_consultarItemLicitacao` | itens da licitação |
| Compras sem licitação | `GET /modulo-legado/5_consultarComprasSemLicitacao` | dispensas/inexigibilidades e datas de publicação/ratificação |
| UASG | `GET /modulo-uasg/1_consultarUasg` | código, órgão, UF e status |
| Órgãos | `GET /modulo-uasg/2_consultarOrgao` | cadastro organizacional |
| Material | `GET /modulo-material/4_consultarItemMaterial` | catálogo CATMAT/material |
| Serviço | `GET /modulo-servico/6_consultarItemServico` | catálogo CATSER/serviço |
| Pesquisa de preço | `GET /modulo-pesquisa-preco/1_consultarMaterial` | preço praticado de material |
| Pesquisa de serviço | `GET /modulo-pesquisa-preco/3_consultarServico` | preço praticado de serviço |
| ARP | `GET /modulo-arp/2_consultarARPItem` | item de ata de registro de preço |

A operação de contratações 14.133 exige no OpenAPI `dataPublicacaoPncpInicial`, `dataPublicacaoPncpFinal` no formato `YYYY-MM-DD` e `codigoModalidade`. A paginação válida observada foi de 10 a 500 registros; `tamanhoPagina=1` retornou HTTP 400 com a mensagem de intervalo inválido. Uma chamada limitada com tamanho 10 retornou HTTP 200 e o envelope `resultado`, `totalRegistros`, `totalPaginas` e `paginasRestantes`.

**Exemplo oficial de consulta da nossa camada de ingestão:**

```text
GET https://dadosabertos.compras.gov.br/modulo-contratacoes/1_consultarContratacoes_PNCP_14133
  ?pagina=1
  &tamanhoPagina=500
  &dataPublicacaoPncpInicial=2026-08-20
  &dataPublicacaoPncpFinal=2026-08-21
  &codigoModalidade=6
```

O resultado vazio é válido e deve ser diferente de erro, timeout ou bloqueio.

### 5.4 TCE-CE — API SIM

**Base confirmada:** `https://api-dados-abertos.tce.ce.gov.br/sim/`. O OpenAPI está em `https://api-dados-abertos.tce.ce.gov.br/sim/openapi_prod.yaml`. [4]

| Endpoint | Obrigatórios | Utilidade |
|---|---|---|
| `GET /processos_administrativos_contratacoes` | `codigo_municipio`, `data_inicio`, `data_fim` | processos de contratação |
| `GET /publicacoes_editais_processos_administrativos_parcerias` | município e intervalo | publicações/editais |
| `GET /licitantes_fornecedores_bens_servicos` | município e intervalo | licitantes/fornecedores |
| `GET /itens_compoem_bens_servicos` | município e intervalo | itens |
| `GET /dotacoes_utilizadas_contratacoes` | município e datas | dotações |
| `GET /contratos` | município e intervalo de celebração | contratos |
| `GET /contratados` | conforme schema | contratados |

A API aceita `$format=json|xml`, `$count` de até 1.000 e `$start_index` para paginação. O catálogo LCO não expõe, nos endpoints principais, um filtro de modalidade equivalente ao PNCP; a modalidade pode ter de ser derivada ou obtida de campo retornado.

### 5.5 TCU e TCE-PI

O TCU publica `https://portal.tcu.gov.br/lumis/api/rest/licitacoestcu/lumgetdata/list.xml` como endpoint de licitações e compras diretas, além de rota para termos contratuais. No smoke test público sem parâmetros, o endpoint respondeu HTML de acesso bloqueado. Assim, a fonte deve ser classificada como **endpoint publicado, contrato não validado**, e não como dependência pronta.

O TCE-PI mantém Mural de Licitações e Portal da Cidadania. A aplicação redirecionou para domínio atualizado e a rota do mural carregou como aplicação dinâmica/sem conteúdo textual na sessão; o HTML obtido continha apenas recursos PrimeFaces e não expôs um contrato de API. Classificação: **portal público, API não confirmada**. Isso não autoriza explorar rotas internas ou contornar bloqueios.

## 6. Modelo de dados recomendado

O modelo deve ter quatro chaves conceituais: fonte, registro externo, contratação canônica e snapshot bruto. A unicidade mínima é `(source_code, source_external_id)`. Itens, documentos, eventos e contratos precisam ser filhos da contratação, preservando a proveniência.

| Entidade | Campos críticos |
|---|---|
| `source_registry` | código, nome, autoridade, base/API URL, protocolo, escopo, limite, termos, status |
| `municipalities` | código IBGE, nome normalizado, UF, latitude/longitude |
| `modality_catalog` | código canônico, nome exibido, família legal |
| `source_modality_map` | fonte, código original, rótulo original, modalidade canônica |
| `biddings` | source, external ID, PNCP control number, processo, órgão, UASG, UF, município, modalidade, datas, valor, status, object text, timestamps |
| `bidding_items` | item, descrição, quantidade, unidade, valor, CATMAT/CATSER/NCM/PDM, status |
| `bidding_documents` | tipo, título, URL oficial, MIME, checksum, data, storage autorizado |
| `bidding_events` | retificação, publicação, abertura, suspensão, cancelamento, atualização |
| `raw_ingest_records` | payload, hash, status HTTP, fonte, run, versão do parser |
| `integration_sync_runs` | janela, cursor, páginas, latência, lidos/criados/atualizados, erro |
| `ingestion_cursors` | fonte, tipo de cursor, valor, janela, atualização |

Índices obrigatórios: `(status, uf, municipality_ibge_code, modality_normalized, proposal_due_date)`, `(publication_date, source_updated_at)`, `(agency_document, uasg)`, trigram em objeto e GIN em `tsvector`. Para raio, usar PostGIS se disponível; caso contrário, coordenadas por município e Haversine em worker/aplicação.

## 7. Consultas e facetas

A busca sem palavra-chave deve ser válida quando existir qualquer outro filtro. Município, modalidade, UF, esfera, portal, CNAE, faixa de valor, datas e raio são filtros independentes. O endpoint interno deve validar somente consistência dos valores e limites, não exigir `keyword`.

A faceta por município é:

```sql
SELECT municipality_ibge_code, max(municipality_name) AS municipality_name,
       uf, count(*)::bigint AS total_open
FROM biddings
WHERE status = 'open'
  AND ($1::char(2) IS NULL OR uf = $1)
  AND ($2::varchar(50) IS NULL OR modality_normalized = $2)
  AND ($3::timestamptz IS NULL OR proposal_due_date >= $3)
  AND ($4::timestamptz IS NULL OR proposal_due_date < $4)
GROUP BY municipality_ibge_code, uf
ORDER BY total_open DESC, municipality_name
LIMIT $5;
```

A consulta com itens deve usar `EXISTS` ou `COUNT(DISTINCT b.id)` para não multiplicar licitações pela quantidade de itens. A paginação pública pode exibir página numerada, mas a API interna e os workers devem preferir cursor keyset baseado em `proposal_due_date`, `publication_date` e `id`.

O comportamento textual observado deve ser reproduzido de forma explícita: termos sem aspas usam OR; expressões entre aspas usam frase. A implementação deve documentar stemming, acentuação, `unaccent`, pluralização e busca em objeto, título, órgão, município e itens.

## 8. Plano de ingestão executável

### Fase A — base nacional P0

Implementar `PncpConsultaAdapter` e `ComprasDadosAbertosAdapter`. O primeiro deve buscar publicações e propostas abertas em janelas móveis; o segundo deve buscar contratações 14.133 e legado SIASG por modalidade e janela de publicação. Cada página é persistida como raw snapshot antes do mapper.

Usar sobreposição de 48 horas no PNCP e de 24–72 horas no Compras.gov.br. O backfill deve ser tarefa administrativa explícita, particionada por data/modalidade/UF, com limite de páginas. Itens, resultados e documentos devem ser enriquecidos em segundo estágio, somente para novos ou modificados.

### Fase B — estaduais P1

Implementar TCE-CE com fila por município e intervalo. Adicionar TCE-PI depois de documentar o contrato do mural ou obter autorização técnica. Criar conectores estaduais somente após o smoke test confirmar formato, paginação, termos e comportamento de falhas.

### Fase C — portais restantes P2

A lista do Alerta pode ser usada como inventário de priorização, não como prova de APIs. Para Licitações-E, Caixa, BEC, LicitaCON, E-Lic, LicitaNet, Licitar Digital, BLL, BNC, BBMNET, M2A, portais estaduais, diários e sites municipais, manter ficha por fonte com protocolo, cobertura, chave, data, rate limit, autorização e último sucesso. Onde não existir API pública, usar somente feed, arquivo ou página cuja automação seja permitida; não contornar login, CAPTCHA ou bloqueio.

### Fila e jobs

| Fila | Propósito | Política |
|---|---|---|
| `ingest-source` | páginas por fonte/janela | 5 retries, backoff exponencial |
| `ingest-detail` | detalhes/itens/documentos | concorrência 5–20 |
| `normalize-bidding` | mapear canonical record | 3 retries |
| `matching` | matching existente por tenant | manter fluxo atual |
| `documents` | download autorizado/metadata | concorrência 2–5 |
| `facets-refresh` | materialized views/contagens | singleton |
| `health-check` | contrato e latência | a cada 5 min |

Respostas 429, 502, 503 e 504 são retryable. Respostas 400/422 vão para dead-letter com parâmetros sanitizados. Respostas 401/403 pausam a fonte e geram alerta. Um adapter não pode fazer retry agressivo em loop.

### Idempotência

Calcular SHA-256 do payload normalizado. Se a mesma chave e hash já existem, registrar duplicata. Se o hash mudou, salvar novo snapshot, atualizar o canônico e criar evento de retificação/atualização. Nunca apagar automaticamente uma licitação que deixou de aparecer em uma janela; utilizar `last_seen_at` e reconciliação posterior.

## 9. Roteiro de codificação no licita-ia

1. Criar `SourceRegistry`, `RawIngestRecord`, `BiddingEvent`, `IngestionCursor` e `SourceModalityMap` no Prisma.
2. Evoluir `Bidding` e `BiddingItem` com proveniência, códigos originais, `pncpControlNumber`, `sourceUpdatedAt`, `lastSeenAt`, catálogo e campos de busca.
3. Criar interface `PublicProcurementAdapter` e preservar o provider atual como adaptador opcional, isolado e desabilitado por padrão.
4. Implementar `PncpConsultaAdapter` com consulta de publicação/propostas abertas e enriquecimento por detalhe/itens.
5. Implementar `ComprasDadosAbertosAdapter` para 14.133 e legado SIASG/Comprasnet.
6. Refatorar `IntegrationService` para jobs por fonte/janela/partição, com checkpoints e métricas.
7. Adicionar repositório de busca canônica e procedimentos de facetas no backend.
8. Atualizar a tela de busca avançada com filtros opcionais, contagens por município/modalidade/UF e estados loading/empty/error.
9. Executar validação de cobertura por recortes reais e medir duplicidade, atraso, volume por fonte e latência p95.
10. Só depois iniciar conectores estaduais/municipais e automações de alertas.

## 10. Critérios de aceite

A implementação será considerada pronta para MVP quando conseguir ingerir uma janela limitada do PNCP e do Compras.gov.br, persistir raw + canonical, reexecutar sem duplicatas, recuperar itens, responder busca por município sem palavra-chave, contar facetas sem multiplicação por joins, filtrar por modalidade e data, exibir origem oficial e registrar falhas por fonte.

Para produção nacional, os critérios adicionais são: cada fonte com contrato e autorização documentados; cursor persistente; observabilidade; dead-letter; reconciliação; proteção de credenciais; política LGPD; testes de mapper por fixture real; teste de regressão para retificações; e plano de contingência quando um portal mudar sua estrutura.

## 11. Referências

[1]: https://alertalicitacao.com.br/!sobre "Alerta Licitação — Quem somos e fontes de consulta"
[2]: https://www.gov.br/pncp/pt-br/pncp/copy_of_manuais/ManualPNCPAPIConsultasVerso1.0.pdf/@@display-file/file "Manual PNCP API Consultas"
[3]: https://dadosabertos.compras.gov.br/swagger-ui/index.html "API de Dados Abertos do Compras.gov.br"
[4]: https://api-dados-abertos.tce.ce.gov.br/sim/ "API de Dados Abertos do SIM — TCE-CE"
[5]: https://sites.tcu.gov.br/dados-abertos/webservices-tcu/ "Webservices — TCU"
[6]: https://sistemas.tce.pi.gov.br/muralic/ "Mural de Licitações — TCE-PI"
[7]: https://alertalicitacao.com.br/contrato/TermosAPIAlertaLicitacao.pdf "Termos públicos da API Alerta Licitação"
[8]: https://pncp.gov.br/api/pncp/v3/api-docs/swagger-config "Configuração OpenAPI pública do PNCP"
[9]: https://pncp.gov.br/pncp-api/v3/api-docs "OpenAPI de integração/consulta do PNCP"
