# Runbook de produção — alertas nacionais do LicitaIA

**Escopo.** Este runbook ativa a ingestão contínua de contratações públicas nacionais utilizando somente as APIs oficiais do [PNCP](https://pncp.gov.br/api/consulta) e do [Compras.gov.br Dados Abertos](https://dadosabertos.compras.gov.br). O sistema não depende do portal Alerta Licitações e não deve receber sua URL, token ou segredo em ambiente algum.

## Arquitetura operacional

O serviço HTTP NestJS executa o scheduler persistido no BullMQ e os processors das filas. O scheduler registra um job recorrente no Redis; o worker chama `IntegrationService.syncBiddings()`, que consulta publicação nas duas fontes e também propostas abertas no PNCP. O PostgreSQL armazena registros canônicos, snapshots brutos, hashes, cursores e histórico dos ciclos.

As APIs públicas não entregam um webhook universal para cada nova licitação. Portanto, “tempo real” significa polling contínuo: a implantação de referência consulta a janela recente a cada cinco minutos, com sobreposição temporal e idempotência. A latência efetiva depende do momento em que a fonte governamental publica ou atualiza o registro, da duração da paginação nacional e de eventuais limites/indisponibilidades do upstream.

## Variáveis mínimas

Configure secrets fora do Git, usando o mecanismo de secrets do provedor:

```env
NODE_ENV=production
DATABASE_URL=postgresql://<user>:<password>@<private-host>:5432/licita_ia?schema=public&sslmode=require
REDIS_URL=rediss://<user>:<password>@<private-host>:6380/0
REDIS_TLS=true
JWT_SECRET=<long-random-secret>
CORS_ORIGIN=https://<app-domain>

PUBLIC_SOURCES_SYNC_ENABLED=false
PNCP_CONSULTA_BASE_URL=https://pncp.gov.br/api/consulta
PNCP_PAGE_SIZE=50
PNCP_LOOKBACK_DAYS=2
COMPRAS_PUBLICAS_BASE_URL=https://dadosabertos.compras.gov.br
COMPRAS_PUBLICAS_PAGE_SIZE=100
COMPRAS_PUBLICAS_LOOKBACK_DAYS=2
SYNC_INTERVAL_MS=300000
SYNC_WINDOW_OVERLAP_HOURS=6
SYNC_LOCK_TTL_SECONDS=3600
```

O endpoint PNCP atualmente aceitou no smoke test real no máximo 50 registros para esta operação; por isso o adapter limita `PNCP_PAGE_SIZE` a 50 mesmo que versões anteriores do manual descrevam um teto parametrizável maior. Se o comportamento oficial mudar, confirme novamente antes de elevar o limite.

## Ordem de implantação

1. Crie PostgreSQL gerenciado em rede privada, com backup automático, point-in-time recovery, TLS e pooling de conexões. Crie usuário exclusivo da aplicação.
2. Crie Redis gerenciado com autenticação, TLS e persistência adequada às filas BullMQ. Não utilize eviction que remova chaves das filas.
3. Faça o deploy da imagem com `apps/api/Dockerfile` e execute `pnpm db:migrate` antes de iniciar a API.
4. Mantenha `PUBLIC_SOURCES_SYNC_ENABLED=false` no primeiro boot. Confirme `GET /health` e `GET /ready`.
5. Confirme `GET /api/internal/integrations/sources/health` com um usuário administrativo. A resposta precisa mostrar PNCP e Compras.gov.br acessíveis.
6. Execute a sincronização manual protegida por JWT e confirme os registros em `GET /api/internal/integrations/sources/sync-runs?limit=20`.
7. Verifique que a consulta facetada retorna registros no índice local, por exemplo `GET /api/biddings?uf=RJ&limit=20`.
8. Ative `PUBLIC_SOURCES_SYNC_ENABLED=true`, reinicie uma única instância e aguarde dois ciclos completos.
9. Só aumente o número de instâncias depois de observar que o lock Redis, as filas e os cursores permanecem estáveis.

## Smoke tests oficiais

Use somente leitura e página pequena para validar o upstream. O formato de data do PNCP é `yyyyMMdd`; o Compras.gov.br usa `yyyy-MM-dd`.

```bash
curl -fsS --max-time 60 \
  -H 'Accept: application/json' \
  -H 'User-Agent: LicitaIA-PublicSource/1.0' \
  'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=20260801&dataFinal=20260822&codigoModalidadeContratacao=6&pagina=1&tamanhoPagina=50'

curl -fsS --max-time 60 \
  -H 'Accept: application/json' \
  -H 'User-Agent: LicitaIA-PublicSource/1.0' \
  'https://dadosabertos.compras.gov.br/modulo-contratacoes/1_consultarContratacoes_PNCP_14133?dataPublicacaoPncpInicial=2026-08-01&dataPublicacaoPncpFinal=2026-08-22&codigoModalidade=6&pagina=1&tamanhoPagina=10'
```

Em produção, substitua as datas por uma janela relativa ao relógio do servidor. Não use uma janela muito ampla no primeiro ciclo: o sistema pagina todas as modalidades e a duração pode superar cinco minutos em períodos de grande volume.

## Critérios de aprovação

| Área | Critério |
|---|---|
| Conectividade | Health oficial aprovado para as duas fontes e `GET /ready` em estado pronto. |
| Cobertura | Ciclos gravam publicação em PNCP/Compras.gov.br; PNCP também apresenta o modo `open_proposals`. |
| Integridade | Reexecutar a mesma janela não duplica `Bidding` nem snapshots correntes. |
| Retomada | Reiniciar a API e confirmar que o cursor salvo continua da página/modo correto. |
| Atualidade | `lastSuccessfulSyncAt` de cada fonte permanece dentro de duas cadências configuradas. |
| Alertas | Nova oportunidade compatível cria registro e notificação conforme o perfil do tenant. |
| Segurança | Nenhum segredo aparece no log; rotas internas exigem JWT e papel administrativo. |

## Rollback

Para interromper a ingestão sem apagar dados canônicos, altere `PUBLIC_SOURCES_SYNC_ENABLED=false` e reinicie a API. O scheduler persistido é removido no bootstrap e nenhum novo ciclo deve iniciar. Mantenha o PostgreSQL e o Redis preservados para investigação dos `IntegrationSyncRun`, `IngestionCursor` e snapshots.

Se uma fonte retornar 429, 5xx ou timeout, o cliente oficial aplica retry com backoff limitado. Não contorne bloqueios, não aumente a frequência agressivamente e não substitua o endpoint por um agregador privado. Depois da recuperação do upstream, execute um ciclo manual e verifique se o cursor avançou.

## Referências oficiais

[1]: https://pncp.gov.br/api/consulta "PNCP — API de Consulta"
[2]: https://www.gov.br/compras/pt-br/cidadao/portal-de-dados-abertos/documentacao-interativa-da-api-de-dados-abertos "Compras.gov.br — Documentação da API de Dados Abertos"
