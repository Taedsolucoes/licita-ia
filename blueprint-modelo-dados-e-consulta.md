# Blueprint de Dados e Consulta — Licita-IA

**Autor:** Manus AI  
**Objetivo:** armazenar e consultar licitações provenientes de PNCP, Compras.gov.br e conectores estaduais/privados autorizados, reproduzindo a experiência de filtros facetados observada no Alerta Licitação sem depender da API proprietária do Alerta.

## 1. Decisão arquitetural

O produto não deve tratar PNCP, Compras.gov.br, TCEs e portais eletrônicos como se fossem uma única base. As fontes têm coberturas, chaves, datas e taxonomias diferentes. O núcleo deve adotar um **modelo canônico de licitação** e manter, em paralelo, a proveniência de cada registro, o payload original e o histórico de alterações.

A chave operacional recomendada é composta por `source` e `source_external_id`. Para o PNCP, utilizar preferencialmente `numeroControlePNCP`; quando o endpoint não o devolver, formar uma chave determinística com CNPJ do órgão, ano e sequencial. Para o Compras.gov.br legado, usar a chave devolvida pelo próprio endpoint, preservando também UASG, modalidade, ano e número do aviso em colunas separadas. Não deduplicar apenas pelo título, órgão ou objeto, pois esses campos mudam e podem coincidir entre fontes.

> **Princípio:** o filtro rápido é executado sobre colunas normalizadas e índices; o payload JSON original serve para auditoria, reprocessamento e campos ainda não normalizados. Nunca usar JSON bruto como única fonte para a busca principal.

## 2. Camadas de dados

| Camada | Responsabilidade | Persistência recomendada |
|---|---|---|
| `source_registry` | Cadastro de fontes, URLs, protocolo, escopo, status e regras de rate limit | PostgreSQL |
| `ingestion_runs` | Execuções, cursores, páginas, latência, erros e contadores | PostgreSQL |
| `raw_ingest_records` | Payload imutável por fonte, checksum e resposta técnica | PostgreSQL JSONB ou objeto em storage + metadados |
| `biddings` | Registro canônico pesquisável | PostgreSQL |
| `bidding_items` | Itens normalizados e catálogo/CATMAT/CATSER/NCM quando disponíveis | PostgreSQL |
| `bidding_documents` | Edital, anexos, atas, arquivos e links de origem | PostgreSQL + storage para cópia autorizada |
| `bidding_events` | Publicação, abertura, retificação, suspensão, cancelamento e atualização | PostgreSQL |
| `municipalities` e `modalities` | Dimensões estáveis para filtros e facetas | PostgreSQL |
| `bidding_facets_open` | Pré-agregação opcional para contagens por município, UF e modalidade | Materialized view ou tabela derivada |

## 3. Ajustes necessários ao schema atual

O modelo existente de `Bidding` já possui os campos essenciais para matching (`uf`, `municipalityIbgeCode`, `status`, `objectText`, datas e valor), mas é insuficiente para distinguir data de publicação, data de abertura, data-limite de proposta, data de atualização da fonte, código de modalidade, número de controle PNCP, origem detalhada e eventos de retificação. A evolução deve ser incremental, preservando as relações de `Opportunity`, `Report`, `BiddingAnalysis` e `BiddingItem`.

Adicionar ao modelo `Bidding`:

| Campo | Tipo | Função |
|---|---|---|
| `sourceId` | UUID/FK | Proveniência normalizada da fonte |
| `sourceRecordKey` | varchar | Chave estável da fonte antes da normalização |
| `pncpControlNumber` | varchar nullable | `numeroControlePNCP`, quando disponível |
| `sourceSystemName` | varchar nullable | Nome do sistema de origem informado pelo órgão |
| `modalityCode` | varchar nullable | Código da modalidade na fonte |
| `modalityNormalized` | varchar | Taxonomia canônica do produto |
| `procurementLaw` | varchar nullable | Ex.: Lei 14.133/2021, legislação anterior |
| `processNumber` | varchar nullable | Processo administrativo |
| `purchaseYear` | smallint nullable | Ano da contratação |
| `publicationUpdatedAt` | timestamptz nullable | Atualização publicada na fonte |
| `sourceUpdatedAt` | timestamptz nullable | Última atualização conhecida |
| `lastSeenAt` | timestamptz | Última captura confirmada |
| `closedAt` | timestamptz nullable | Encerramento/fechamento conhecido |
| `searchText` | text | Texto consolidado para indexação |
| `searchVector` | tsvector | Busca full-text do PostgreSQL |
| `latitude`, `longitude` | numeric nullable | Geolocalização do município, se usada no raio |
| `rawPayloadVersion` | varchar | Versão do mapper/provider |

O campo atual `source` pode permanecer por compatibilidade, mas deve apontar semanticamente para `source_registry.code`. Se for feita migração completa, trocar o uso da coluna livre por FK e manter `source` apenas durante a transição.

## 4. DDL PostgreSQL recomendado

O DDL abaixo é uma referência de arquitetura. No repositório Prisma, a fonte de verdade deve ser `schema.prisma`; depois, gerar migration e revisar o SQL gerado antes de aplicá-lo.

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS source_registry (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                varchar(60) NOT NULL UNIQUE,
  name                varchar(180) NOT NULL,
  scope               varchar(30) NOT NULL, -- national, state, municipal, private
  authority           varchar(180),
  base_url             text,
  api_url              text,
  protocol             varchar(30) NOT NULL, -- api, csv, xml, html, manual
  coverage_notes       text,
  terms_url            text,
  is_active            boolean NOT NULL DEFAULT true,
  rate_limit_per_sec   numeric(12,3),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS municipalities (
  ibge_code       varchar(7) PRIMARY KEY,
  name            varchar(180) NOT NULL,
  normalized_name varchar(180) NOT NULL,
  uf              char(2) NOT NULL,
  latitude        numeric(9,6),
  longitude       numeric(9,6),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS municipalities_name_trgm_idx
  ON municipalities USING gin (normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS municipalities_uf_idx
  ON municipalities (uf, normalized_name);

CREATE TABLE IF NOT EXISTS modality_catalog (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_code     varchar(50) NOT NULL UNIQUE,
  display_name        varchar(120) NOT NULL,
  legal_family        varchar(80),
  active              boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS source_modality_map (
  source_id            uuid NOT NULL REFERENCES source_registry(id),
  source_code          varchar(80) NOT NULL,
  source_label         varchar(180),
  modality_id          uuid NOT NULL REFERENCES modality_catalog(id),
  PRIMARY KEY (source_id, source_code)
);

CREATE TABLE IF NOT EXISTS raw_ingest_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id           uuid NOT NULL REFERENCES source_registry(id),
  run_id              uuid,
  source_record_key   varchar(400) NOT NULL,
  payload             jsonb NOT NULL,
  payload_sha256      char(64) NOT NULL,
  http_status         integer,
  fetched_at          timestamptz NOT NULL DEFAULT now(),
  parser_version      varchar(50) NOT NULL,
  is_current          boolean NOT NULL DEFAULT true,
  UNIQUE (source_id, source_record_key, payload_sha256)
);

CREATE INDEX IF NOT EXISTS raw_ingest_current_idx
  ON raw_ingest_records (source_id, source_record_key, is_current);

ALTER TABLE biddings
  ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES source_registry(id),
  ADD COLUMN IF NOT EXISTS source_record_key varchar(400),
  ADD COLUMN IF NOT EXISTS pncp_control_number varchar(160),
  ADD COLUMN IF NOT EXISTS source_system_name varchar(180),
  ADD COLUMN IF NOT EXISTS modality_code varchar(80),
  ADD COLUMN IF NOT EXISTS modality_normalized varchar(50),
  ADD COLUMN IF NOT EXISTS procurement_law varchar(80),
  ADD COLUMN IF NOT EXISTS process_number varchar(120),
  ADD COLUMN IF NOT EXISTS purchase_year smallint,
  ADD COLUMN IF NOT EXISTS publication_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS search_text text,
  ADD COLUMN IF NOT EXISTS search_vector tsvector,
  ADD COLUMN IF NOT EXISTS latitude numeric(9,6),
  ADD COLUMN IF NOT EXISTS longitude numeric(9,6),
  ADD COLUMN IF NOT EXISTS raw_payload_version varchar(50);

CREATE UNIQUE INDEX IF NOT EXISTS biddings_source_record_key_uq
  ON biddings (source_id, source_record_key)
  WHERE source_id IS NOT NULL AND source_record_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS biddings_open_facets_idx
  ON biddings (status, uf, municipality_ibge_code, modality_normalized, proposal_due_date);
CREATE INDEX IF NOT EXISTS biddings_publication_idx
  ON biddings (publication_date, source_updated_at);
CREATE INDEX IF NOT EXISTS biddings_agency_idx
  ON biddings (agency_document, uasg);
CREATE INDEX IF NOT EXISTS biddings_object_trgm_idx
  ON biddings USING gin (object_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS biddings_search_vector_idx
  ON biddings USING gin (search_vector);

CREATE OR REPLACE FUNCTION refresh_bidding_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', unaccent(coalesce(NEW.object_text, ''))), 'A') ||
    setweight(to_tsvector('simple', unaccent(coalesce(NEW.object_summary, ''))), 'B') ||
    setweight(to_tsvector('simple', unaccent(coalesce(NEW.agency_name, ''))), 'C') ||
    setweight(to_tsvector('simple', unaccent(coalesce(NEW.municipality_name, ''))), 'C') ||
    setweight(to_tsvector('simple', unaccent(coalesce(NEW.bidding_number, ''))), 'C');
  NEW.search_text := concat_ws(' ', NEW.object_text, NEW.object_summary,
    NEW.agency_name, NEW.municipality_name, NEW.bidding_number);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS biddings_search_vector_trg ON biddings;
CREATE TRIGGER biddings_search_vector_trg
BEFORE INSERT OR UPDATE OF object_text, object_summary, agency_name,
  municipality_name, bidding_number ON biddings
FOR EACH ROW EXECUTE FUNCTION refresh_bidding_search_vector();

CREATE TABLE IF NOT EXISTS bidding_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bidding_id          uuid NOT NULL REFERENCES biddings(id) ON DELETE CASCADE,
  source_event_key    varchar(300),
  event_type          varchar(40) NOT NULL,
  event_at            timestamptz,
  title               text,
  payload             jsonb,
  payload_sha256      char(64),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bidding_id, source_event_key)
);

CREATE INDEX IF NOT EXISTS bidding_events_time_idx
  ON bidding_events (event_type, event_at);

CREATE TABLE IF NOT EXISTS ingestion_cursors (
  source_id            uuid PRIMARY KEY REFERENCES source_registry(id),
  cursor_type          varchar(30) NOT NULL, -- date, page, updated_at, opaque
  cursor_value         text,
  window_start         timestamptz,
  window_end           timestamptz,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS source_endpoint_health (
  source_id            uuid PRIMARY KEY REFERENCES source_registry(id),
  last_check_at        timestamptz,
  status               varchar(20) NOT NULL DEFAULT 'unknown',
  http_status          integer,
  latency_ms           integer,
  message              text,
  updated_at           timestamptz NOT NULL DEFAULT now()
);
```

## 5. Itens, documentos e modalidades

`BiddingItem` deve receber `sourceItemKey`, `catalogType`, `catalogCode`, `ncmCode`, `pdmCode`, `itemStatus`, `quantity`, `unit`, `unitValueEstimated`, `totalValueEstimated` e `searchVector`. A unicidade deve ser `(bidding_id, item_number)` durante a transição, mas, para fontes que retificam a numeração, a chave mais robusta é `(bidding_id, source_item_key)`.

`BiddingDocument` deve possuir `sourceDocumentKey`, `documentType`, `documentTitle`, `sourceUrl`, `mimeType`, `publishedAt`, `sha256`, `storageKey`, `isCurrent` e `accessPolicy`. Não copiar documentos de portais privados ou arquivos sujeitos a restrição sem verificar termos de uso; é possível persistir o link oficial e baixar somente quando houver autorização.

A taxonomia de modalidade deve ser canônica. Exemplos: `PREGAO_ELETRONICO`, `PREGAO_PRESENCIAL`, `CONCORRENCIA_ELETRONICA`, `CONCORRENCIA_PRESENCIAL`, `DISPENSA_ELETRONICA`, `INEXIGIBILIDADE`, `LEILAO`, `DIALOGO_COMPETITIVO`, `CREDENCIAMENTO`, `RDC`, `TOMADA_PRECOS`, `CONVITE` e `OUTROS`. O rótulo exibido ao usuário deve vir de `modality_catalog`; o código e o rótulo originais devem permanecer em `modality_code` e no payload.

## 6. Consultas que reproduzem os filtros facetados

### 6.1 Lista paginada sem palavra-chave

```sql
SELECT b.id, b.bidding_number, b.modality_normalized,
       b.agency_name, b.object_text, b.municipality_name,
       b.municipality_ibge_code, b.uf, b.publication_date,
       b.proposal_due_date, b.estimated_value, b.source_url
FROM biddings b
WHERE b.status = 'open'
  AND ($1::char(2) IS NULL OR b.uf = $1)
  AND ($2::varchar(7) IS NULL OR b.municipality_ibge_code = $2)
  AND ($3::text[] IS NULL OR b.modality_normalized = ANY($3))
  AND ($4::timestamptz IS NULL OR b.proposal_due_date >= $4)
  AND ($5::timestamptz IS NULL OR b.proposal_due_date < $5)
ORDER BY b.proposal_due_date NULLS LAST, b.publication_date DESC, b.id
LIMIT $6 OFFSET $7;
```

Para paginação de alto volume, substituir `OFFSET` por **keyset pagination**: `proposal_due_date`, `publication_date` e `id` formam o cursor. O front-end pode continuar exibindo páginas numeradas quando o total estiver disponível, mas o worker e a API interna devem preferir cursor.

### 6.2 Busca por palavra-chave em objeto e itens

```sql
SELECT DISTINCT b.id, b.bidding_number, b.object_text,
       b.municipality_name, b.uf, b.proposal_due_date,
       ts_rank_cd(b.search_vector, websearch_to_tsquery('simple', unaccent($1))) AS rank
FROM biddings b
LEFT JOIN bidding_items i ON i.bidding_id = b.id
WHERE b.status = 'open'
  AND (
    b.search_vector @@ websearch_to_tsquery('simple', unaccent($1))
    OR i.description ILIKE '%' || $1 || '%'
  )
ORDER BY rank DESC, b.proposal_due_date NULLS LAST, b.id
LIMIT $2;
```

Para o comportamento “qualquer filtro pode ser usado sozinho”, a API deve aceitar um objeto com todos os campos opcionais. A validação deve rejeitar somente intervalos inválidos, códigos desconhecidos ou limites abusivos; nunca exigir `keyword` quando há município, UF, modalidade ou raio.

### 6.3 Contagem por município sem palavra-chave

A contagem que o usuário observou é uma **faceta**, não uma busca textual. Ela deve ser feita diretamente sobre a relação filtrada:

```sql
SELECT b.municipality_ibge_code,
       max(b.municipality_name) AS municipality_name,
       b.uf,
       count(*)::bigint AS total_open
FROM biddings b
WHERE b.status = 'open'
  AND ($1::char(2) IS NULL OR b.uf = $1)
  AND ($2::varchar(50) IS NULL OR b.modality_normalized = $2)
  AND ($3::timestamptz IS NULL OR b.proposal_due_date >= $3)
  AND ($4::timestamptz IS NULL OR b.proposal_due_date < $4)
GROUP BY b.municipality_ibge_code, b.uf
ORDER BY total_open DESC, municipality_name
LIMIT $5;
```

Não usar `COUNT(DISTINCT b.id)` se a consulta não fizer join com itens/documentos. Quando houver join, usar `COUNT(DISTINCT b.id)` ou uma subconsulta `EXISTS`, evitando contagens duplicadas.

### 6.4 Modalidade e UF

```sql
SELECT coalesce(b.modality_normalized, 'OUTROS') AS modality,
       count(*)::bigint AS total_open
FROM biddings b
WHERE b.status = 'open'
  AND ($1::char(2) IS NULL OR b.uf = $1)
GROUP BY coalesce(b.modality_normalized, 'OUTROS')
ORDER BY total_open DESC;
```

### 6.5 Raio de distância

Para uma primeira versão, geocodificar apenas municípios por código IBGE e calcular distância por fórmula Haversine em aplicação ou SQL. Para alto volume, usar PostGIS e `geography(Point, 4326)`; não geocodificar cada edital individualmente.

```sql
-- Recomendado após habilitar PostGIS e adicionar municipality_point:
SELECT b.*,
       ST_Distance(b.municipality_point::geography,
                   ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 AS distance_km
FROM biddings b
WHERE b.status = 'open'
  AND ST_DWithin(
        b.municipality_point::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3 * 1000
      )
ORDER BY distance_km, b.proposal_due_date NULLS LAST;
```

## 7. Facetas pré-computadas

Se o volume passar de alguns milhões de registros ou as contagens forem exibidas em todas as páginas, criar a materialized view abaixo e atualizar após cada janela de ingestão concluída. Para consultas com palavra-chave, manter contagem online ou criar uma estratégia de facetas por termo; não pré-calcular todos os termos possíveis.

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS bidding_facets_open AS
SELECT uf, municipality_ibge_code, municipality_name,
       modality_normalized, count(*)::bigint AS total_open,
       min(proposal_due_date) AS next_due_date
FROM biddings
WHERE status = 'open'
GROUP BY uf, municipality_ibge_code, municipality_name, modality_normalized;

CREATE UNIQUE INDEX IF NOT EXISTS bidding_facets_open_uq
  ON bidding_facets_open (uf, municipality_ibge_code, modality_normalized);
```

## 8. Contrato interno recomendado

O provider existente aceita apenas `uf`, `keyword`, `since`, `cursor` e `limit`. Para a réplica completa, criar uma segunda interface sem remover a antiga:

```ts
export type CanonicalBiddingFilter = {
  keyword?: string;
  uf?: string;
  municipalityIbgeCode?: string;
  municipalityName?: string;
  radiusKm?: number;
  latitude?: number;
  longitude?: number;
  modalities?: string[];
  sourceCodes?: string[];
  status?: 'open' | 'closed' | 'cancelled' | 'unknown';
  publicationFrom?: Date;
  publicationTo?: Date;
  openingFrom?: Date;
  openingTo?: Date;
  proposalDueFrom?: Date;
  proposalDueTo?: Date;
  minValue?: number;
  maxValue?: number;
  uasg?: string;
  cnae?: string;
  pageSize?: number;
  cursor?: string;
};

export interface CanonicalBiddingRepository {
  search(filter: CanonicalBiddingFilter): Promise<{
    rows: BiddingSourceRaw[];
    nextCursor: string | null;
    total?: number;
  }>;
  facets(filter: Omit<CanonicalBiddingFilter, 'pageSize' | 'cursor'>): Promise<{
    municipalities: Array<{ ibgeCode: string; name: string; uf: string; total: number }>;
    modalities: Array<{ code: string; label: string; total: number }>;
    ufs: Array<{ uf: string; total: number }>;
  }>;
}
```

## 9. Regras de consistência

Toda data recebida de fonte deve ser convertida para UTC, preservando no payload a string original e o fuso/semântica declarada. `publicationDate`, `openingDate`, `proposalDueDate` e `sourceUpdatedAt` não são intercambiáveis. Quando apenas uma data estiver disponível, preencher somente o campo semanticamente correto e deixar os demais nulos.

Valores monetários devem ser armazenados como `numeric(18,2)` ou `numeric(18,4)` conforme a precisão da fonte; nunca converter para `float` no banco. O provider pode transportar `number`, mas o mapper deve usar `Decimal` ao persistir.

`status` deve ser derivado por uma função versionada que considere situação da fonte, data-limite e eventos. Não marcar automaticamente tudo como `open` apenas porque foi retornado pela API. Registros que desaparecem de uma janela não devem ser apagados: marcar `last_seen_at`, registrar a execução e, depois de uma política de retenção, atualizar para `unknown` ou `closed` conforme evidência.

## 10. Fontes oficiais e limites de equivalência

O PNCP fornece a camada nacional mais adequada para contratações sob a Lei 14.133/2021, com filtros oficiais por período, modalidade, UF, município IBGE, órgão, unidade e atualização. O Compras.gov.br fornece operações separadas para contratações PNCP, legado SIASG/Comprasnet, itens, resultados, UASG, catálogo, pesquisa de preços e atas. O TCE-CE fornece processos, publicações de editais, itens, licitantes e contratos do seu SIM; o TCU publica endpoint de suas próprias licitações, mas a chamada automatizada foi bloqueada nesta auditoria. Essas fontes não devem ser somadas sem `source_code`, porque a cobertura e a semântica diferem.

A declaração pública do Alerta lista ainda portais estaduais, municipais e privados. Para esses conectores, só usar API/documentação/arquivo ou página pública cujo uso automatizado seja permitido. Quando não existir API aberta, o resultado deve ser classificado como `portal-only` e não tratado como “API confirmada”. A cobertura nacional do Alerta provavelmente depende de uma combinação de APIs, feeds, arquivos e conectores específicos, não de uma única API pública universal.

## Referências

[1]: https://pncp.gov.br/api/consulta/swagger-ui/index.html "Swagger de consulta do PNCP"
[2]: https://www.gov.br/pncp/pt-br/pncp/copy_of_manuais/ManualPNCPAPIConsultasVerso1.0.pdf/@@display-file/file "Manual PNCP API Consultas"
[3]: https://dadosabertos.compras.gov.br/swagger-ui/index.html "Swagger da API de Dados Abertos do Compras.gov.br"
[4]: https://api-dados-abertos.tce.ce.gov.br/sim/ "API de Dados Abertos do TCE-CE"
[5]: https://sites.tcu.gov.br/dados-abertos/webservices-tcu/ "Webservices de Dados Abertos do TCU"
[6]: https://alertalicitacao.com.br/!sobre "Alerta Licitação — fontes de consulta declaradas"
