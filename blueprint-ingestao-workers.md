# Blueprint de Ingestão — Licita-IA

**Objetivo:** sincronizar dados de licitações a partir de fontes públicas autorizadas, sem depender da API privada do Alerta Licitação, mantendo rastreabilidade, deduplicação, atualizações e tolerância a indisponibilidade.

## 1. Estratégia de fontes

A ingestão deve ser orientada por **adapters independentes**, cada um com seu próprio contrato, paginação e cursor. O núcleo não deve conter regras de URL de fontes externas.

| Adapter | Fonte | Prioridade | Estratégia | Filtro incremental |
|---|---|---:|---|---|
| `PncpConsultaAdapter` | PNCP — consulta pública | P0 | Listagem por data de publicação/atualização, depois detalhe/itens | Janela móvel com sobreposição |
| `ComprasDadosAbertosAdapter` | Dados Abertos Compras.gov.br | P0 | Contratações 14.133 e legado SIASG/Comprasnet | Data inicial/final + paginação |
| `TceCeSimAdapter` | API SIM TCE-CE | P1 | Processos LCO e contratos por município/período | Município + `data_inicio/data_fim` |
| `TcuLicitacoesAdapter` | Webservice de licitações do TCU | P2 | Somente após autorização/validação do endpoint | Cursor conforme documentação |
| `StatePortalAdapter` | TCEs/portais estaduais | P1/P2 | Um adapter por contrato público confirmado | Data, exercício ou arquivo |
| `PortalOnlyConnector` | Sites sem API formal | P2 | Somente quando uso automatizado for permitido | ETag/Last-Modified ou snapshot |

A declaração pública do Alerta lista fontes nacionais, estaduais, municipais e privadas. Isso não significa que todas tenham API. O catálogo deve classificar cada fonte como `api_confirmed`, `file_confirmed`, `portal_only`, `requires_auth` ou `not_validated`.

## 2. Fluxo lógico de cada execução

```text
Scheduler
  -> cria IntegrationSyncRun
  -> carrega SourceRegistry e IngestionCursor
  -> cria jobs INGEST_SOURCE por fonte/janela
  -> worker limita concorrência por fonte
  -> adapter lista páginas
  -> raw landing grava payload + checksum
  -> mapper normaliza edital/itens/documentos
  -> upsert idempotente em Bidding/BiddingItem/BiddingDocument
  -> registra eventos e atualiza last_seen/source_updated_at
  -> publica MATCHING apenas quando houve inclusão ou mudança relevante
  -> atualiza cursor e métricas
  -> refresh de facetas após janela concluída
```

A fase de captura não deve depender do matching, análise de edital ou notificações. Se o downstream falhar, o payload e o registro canônico continuam persistidos para reprocessamento.

## 3. Janelas incrementais

### PNCP

Usar o endpoint de consulta compatível com o catálogo oficial para **propostas abertas** quando a prioridade for oportunidade ativa, e consultas por publicação/atualização quando a prioridade for completude histórica. As listagens de propostas abertas devem ser particionadas por modalidade e, quando necessário, por UF/município. Cada janela deve usar uma sobreposição de 48 horas para absorver atraso de publicação, relógios diferentes e retificações.

Para o detalhe canônico, utilizar as rotas de consulta de contratação, itens, resultados, documentos e histórico. O identificador principal é `numeroControlePNCP`; o vínculo órgão/ano/sequencial deve ser preservado para reconsulta.

### Compras.gov.br

A operação de contratações PNCP exige `dataPublicacaoPncpInicial`, `dataPublicacaoPncpFinal` e `codigoModalidade`, com datas `YYYY-MM-DD`. A página oficial aceita `tamanhoPagina` entre 10 e 500; o worker deve usar 500, respeitar rate limit e reduzir o tamanho se a resposta crescer excessivamente. O legado SIASG/Comprasnet usa operação separada e deve possuir cursor próprio.

Para cada janela, dividir por modalidade quando o total for grande. Nunca tentar varrer a base inteira em uma única execução. A janela padrão recomendada é de 24 horas para o modo diário e de 72 horas para o backfill inicial, com checkpoints por página.

### TCE-CE

Os endpoints LCO exigem `codigo_municipio`, `data_inicio` e `data_fim`, retornam JSON/XML e paginam com `$count` de até 1.000 e `$start_index`. Criar uma fila por município e intervalo de datas. A tabela `municipalities` deve fornecer os códigos aceitos pelo TCE-CE; não assumir que o código IBGE seja igual ao código interno do TCE sem tabela de correspondência.

### Portais estaduais e municipais

Cada adapter deve declarar `supportsSince`, `supportsMunicipality`, `supportsModality`, `supportsDocuments` e `requiresAuth`. Quando não houver filtro incremental, usar partições pequenas por município/órgão, cache HTTP, ETag e hash de conteúdo. Se o portal usar CAPTCHA, login ou bloqueio, marcar a fonte como indisponível e solicitar integração/autorização, sem contornar o controle.

## 4. Contrato do adapter

```ts
export type SourceCapability = {
  list: boolean;
  detail: boolean;
  items: boolean;
  documents: boolean;
  historical: boolean;
  supportsSince: boolean;
  supportsMunicipality: boolean;
  supportsModality: boolean;
};

export type SyncWindow = {
  from: Date;
  to: Date;
  municipalityCode?: string;
  uf?: string;
  modalityCode?: string;
};

export type PageCursor = {
  page?: number;
  offset?: number;
  opaque?: string;
};

export interface PublicProcurementAdapter {
  readonly sourceCode: string;
  readonly capabilities: SourceCapability;
  list(window: SyncWindow, cursor: PageCursor): Promise<{
    records: unknown[];
    next: PageCursor | null;
    total?: number;
    rawMeta?: Record<string, unknown>;
  }>;
  map(record: unknown): CanonicalProcurementRecord;
  fetchDetails?(key: string): Promise<unknown | null>;
  fetchItems?(key: string): Promise<unknown[]>;
  fetchDocuments?(key: string): Promise<unknown[]>;
  healthCheck(): Promise<HealthResult>;
}
```

O adapter nunca deve conhecer tenant, keyword do usuário, matching ou notificações. Ele apenas traduz a fonte para o contrato canônico.

## 5. Idempotência e upsert

Cada resposta deve ser normalizada antes do upsert. Calcular `sha256` do payload canônico e do payload bruto. Se `(source_id, source_record_key, payload_sha256)` já existir, registrar `duplicate` e não reprocessar. Se a chave existir com hash diferente, criar novo snapshot bruto, atualizar o canônico e gerar um `bidding_event` com o tipo `UPDATED` ou `RECTIFIED`.

A operação de upsert deve ser transacional por lote pequeno, por exemplo 100–500 registros. O worker deve suportar reexecução segura após timeout. Não atualizar `created_at`; atualizar apenas campos provenientes da fonte e manter campos calculados do produto separados.

```ts
async function persistCanonical(record: CanonicalProcurementRecord, runId: string) {
  const source = await sourceRepo.require(record.sourceCode);
  const rawHash = sha256(stableStringify(record.rawPayload));

  return prisma.$transaction(async tx => {
    const raw = await tx.rawIngestRecord.upsert({
      where: { sourceId_sourceRecordKey_payloadSha256: {
        sourceId: source.id,
        sourceRecordKey: record.sourceRecordKey,
        payloadSha256: rawHash,
      } },
      create: { sourceId: source.id, runId, sourceRecordKey: record.sourceRecordKey,
        payload: record.rawPayload, payloadSha256: rawHash, parserVersion: record.parserVersion },
      update: { fetchedAt: new Date(), runId },
    });

    const bidding = await tx.bidding.upsert({
      where: { source_sourceExternalId: {
        source: record.sourceCode,
        sourceExternalId: record.externalId,
      } },
      create: toBiddingCreate(record),
      update: toBiddingUpdate(record),
    });

    for (const item of record.items) {
      await tx.biddingItem.upsert({
        where: { biddingId_itemNumber: { biddingId: bidding.id, itemNumber: item.itemNumber } },
        create: toItemCreate(bidding.id, item),
        update: toItemUpdate(item),
      });
    }
    return { biddingId: bidding.id, rawId: raw.id };
  });
}
```

O índice único atualmente existente em `Bidding` (`source`, `sourceExternalId`) pode ser mantido durante a migração. Quando `sourceId/sourceRecordKey` estiver estável, ele deve se tornar o índice de proveniência principal.

## 6. BullMQ e jobs

Criar jobs com payloads pequenos e reexecutáveis:

```ts
type IngestSourceJob = {
  sourceCode: string;
  windowFrom: string;
  windowTo: string;
  partition?: { uf?: string; municipalityCode?: string; modalityCode?: string };
  cursor?: PageCursor;
  runId: string;
};

type EnrichBiddingJob = {
  biddingId: string;
  reason: 'new' | 'updated' | 'missing_items' | 'manual_reprocess';
};
```

Filas recomendadas:

| Fila | Concorrência | Retry | Backoff |
|---|---:|---:|---|
| `ingest-source` | por fonte | 5 | exponencial 30s–30min |
| `ingest-detail` | 5–20 | 4 | exponencial |
| `normalize-bidding` | 10–30 | 3 | 5s–5min |
| `matching` | 5–10 | 4 | 30s–15min |
| `documents` | 2–5 | 3 | 1min–1h |
| `facets-refresh` | 1 | 3 | 1min |

A concorrência deve ser limitada por `sourceCode`, não apenas globalmente. Assim, uma fonte lenta ou indisponível não bloqueia PNCP e Compras.gov.br. Respostas 429/503 devem gerar retry; 400/422 devem ser enviados para dead-letter com parâmetros e corpo sanitizados; 401/403 devem pausar a fonte e alertar o operador.

## 7. Cron e backfill

| Job | Periodicidade | Escopo |
|---|---:|---|
| `pncp-open-proposals` | a cada 15 min | Propostas abertas e alterações recentes |
| `pncp-publications` | a cada hora | Janela móvel de publicação |
| `compras-pncp` | a cada hora | Contratações 14.133 por modalidade |
| `compras-legado` | a cada 2 h | SIASG/Comprasnet |
| `state-connectors` | diário | Cada estado com sua janela |
| `tce-ce-lco` | diário | Municípios/intervalos do Ceará |
| `detail-enrichment` | contínuo | Itens/documentos dos registros novos |
| `stale-reconciliation` | diário | Registros não vistos há 48–72 h |
| `facets-refresh` | após ingestão | Facetas abertas |
| `health-check` | a cada 5 min | Endpoint e credenciais |

O backfill deve ser uma tarefa explícita, com limite de data e orçamento de chamadas. Nunca permitir que um botão administrativo dispare varredura nacional sem confirmação e sem limite. Para cada backfill, salvar `run_type=backfill`, fonte, intervalo e estimativa de páginas.

## 8. Observabilidade

Registrar no `IntegrationSyncRun`: fonte, janela, partição, páginas, cursor inicial/final, duração, status, HTTP status predominante, lidos, mapeados, criados, atualizados, duplicados, descartados, 4xx, 5xx e erro sanitizado. Criar métricas:

```text
ingestion_records_read_total{source}
ingestion_records_upserted_total{source}
ingestion_errors_total{source,kind}
ingestion_latency_seconds{source}
ingestion_lag_seconds{source}
ingestion_queue_depth{queue}
ingestion_last_success_timestamp{source}
ingestion_source_coverage{source,uf}
```

Alertas mínimos: nenhuma captura bem-sucedida em 2 ciclos; aumento de 4xx; aumento de 5xx; queda abrupta de volume; cursor não avançando; fila dead-letter não vazia; latência p95 acima do limite; divergência anormal entre registros do PNCP e Compras.gov.br no mesmo recorte.

## 9. Segurança e governança

Nunca colocar token, cookie ou credencial de fonte no código, log, payload bruto ou commit. Usar variáveis de ambiente/secret manager. Redigir `Authorization`, `Cookie`, CPF, e-mail e telefone quando forem desnecessários para o produto. Manter apenas os dados pessoais necessários à finalidade e documentar a base legal e a política de retenção.

Respeitar `robots.txt`, termos, rate limits, janelas de manutenção e mecanismos antiabuso. A API própria do Alerta possui restrições contratuais contra varredura completa e não deve ser usada como ingestão do licita-ia. Para fontes privadas, integrar somente com credencial e autorização contratual; para fontes oficiais, preferir documentação e dados abertos.

## 10. Implementação em Python independente

O seguinte esqueleto pode ser usado para validar adapters fora do NestJS. Ele não contém endpoints privados nem tenta contornar proteção; o adapter recebe a URL oficial documentada e os parâmetros legais.

```python
from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Iterator

import requests


@dataclass(frozen=True)
class Page:
    records: list[dict[str, Any]]
    next_page: int | None
    total: int | None


def fetch_compras_page(base_url: str, start: date, end: date,
                       modalidade: int, page: int = 1,
                       size: int = 500) -> Page:
    params = {
        "pagina": page,
        "tamanhoPagina": size,
        "dataPublicacaoPncpInicial": start.isoformat(),
        "dataPublicacaoPncpFinal": end.isoformat(),
        "codigoModalidade": modalidade,
    }
    response = requests.get(base_url, params=params, timeout=30,
                            headers={"Accept": "application/json"})
    if response.status_code in (429, 502, 503, 504):
        raise RuntimeError(f"retryable HTTP {response.status_code}")
    response.raise_for_status()
    body = response.json()
    records = body.get("resultado", [])
    total_pages = body.get("totalPaginas", 0)
    return Page(records=records,
                next_page=page + 1 if page < total_pages else None,
                total=body.get("totalRegistros"))


def iter_window(base_url: str, start: date, end: date,
                modalidades: list[int]) -> Iterator[dict[str, Any]]:
    for modalidade in modalidades:
        page = 1
        while page is not None:
            result = fetch_compras_page(base_url, start, end, modalidade, page)
            for record in result.records:
                yield record
            page = result.next_page
            time.sleep(0.2)  # ajustar ao limite publicado; não usar paralelismo cego


def payload_sha256(payload: dict[str, Any]) -> str:
    data = json.dumps(payload, ensure_ascii=False, sort_keys=True,
                       separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(data).hexdigest()


if __name__ == "__main__":
    # Exemplo estreito e limitado; substituir pela configuração da aplicação.
    base = "https://dadosabertos.compras.gov.br/modulo-contratacoes/1_consultarContratacoes_PNCP_14133"
    for row in iter_window(base, date.today() - timedelta(days=1), date.today(), [6]):
        print(payload_sha256(row), row.get("numeroControlePNCP"))
```

## 11. Ordem de implementação

Primeiro substituir o adapter do Alerta por `PncpConsultaAdapter` e `ComprasDadosAbertosAdapter`, sem remover o código antigo até a validação. Depois ampliar `FetchBiddingsOptions` para o filtro canônico, migrar `Bidding` com proveniência e snapshots, criar o job `ingest-source`, implementar upsert idempotente e medir cobertura. Em seguida, adicionar enriquecimento de itens/documentos, facetas por município/modalidade, matching e notificações. TCE-CE e conectores estaduais entram depois que o contrato de cada fonte estiver validado em smoke test e revisão de termos.
