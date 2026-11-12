# Snapshot de municípios do IBGE

`municipalities.json` é um fallback local compacto com código IBGE, nome e UF. Foi extraído da resposta integral do endpoint oficial `https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome`, consultado em 12/11/2026. O serviço NestJS tenta primeiro a API ao vivo por UF e usa este snapshot somente quando a origem não está acessível; o cache de runtime reduz chamadas repetidas. Atualize o arquivo a partir do endpoint oficial quando a lista de municípios do IBGE mudar.
