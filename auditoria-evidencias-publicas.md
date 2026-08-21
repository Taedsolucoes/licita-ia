# Evidências públicas — Alerta Licitação

## Coleta inicial — 2026-08-21

### Página inicial
- Domínio observado: https://alertalicitacao.com.br/
- Navegação pública expõe: Painel geral, buscas por Estado, UASG, modalidade, itens, CNAE, municípios, tendências, proximidade, alertas por email e atualizações; as áreas “Por preço” e “Top 50” aparecem como exclusivas para assinantes.
- A página informa um painel com métricas de licitações encerradas, abertas, vencendo hoje e fontes oficiais.
- A página mostra uma seção de últimas licitações capturadas com identificador, abertura, órgão e objeto.
- Ofertas públicas indicam alertas por email, aplicativo Android/iPhone, exportação para Excel e, no plano corporativo, WhatsApp e gestão de certidões negativas.
- O link de detalhes observado usa o padrão `/!licitacao/{identificador}`.
- A página informa 6.441 portais/fontes oficiais no momento da coleta; este número é uma afirmação da página e precisa de validação independente antes de ser tratado como fato operacional.

### Página anunciada como API
- URL observada: https://alertalicitacao.com.br/!api
- Ao abrir sem autenticação, a rota redirecionou/exibiu tela de login com Facebook, Google e email/senha.
- Portanto, a documentação/contrato da API não ficou acessível nessa sessão sem autenticação; não foram tentados bypasses ou enumeração de áreas privadas.

## Limites da evidência
Estas observações são da superfície pública renderizada. Ainda não comprovam tecnologia de servidor, banco, filas, cron, origem de dados ou endpoints privados. A análise posterior deve distinguir fatos observados, evidências de documentação pública e hipóteses de engenharia.

### Contrato público da API
- O PDF anunciado na busca está em `https://alertalicitacao.com.br/contrato/TermosAPIAlertaLicitacao.pdf`.
- A visualização incorporada não carregou conteúdo textual nesta sessão; a próxima etapa é recuperar passivamente o arquivo público por HTTP e extrair o texto localmente, sem autenticação ou tentativa de contornar controles.

## Contrato público da API — achados decisivos

O PDF público identifica a Boina Azul Sistemas Ltda. como fornecedora da API e descreve uma licença pessoal, não exclusiva, intransferível, não sublicenciável, revogável e limitada para desenvolver, testar e compatibilizar um aplicativo. O contrato afirma que o conteúdo é capturado de diversas fontes oficiais.

A cláusula de armazenamento permite consultar e armazenar conteúdo relacionado a licitações, mas proíbe consultas destinadas a varrer todas as licitações abertas. O contrato também proíbe utilizar os dados da API em serviço de envio de avisos de licitações por email e em aplicativo que mostre informações de licitações em conflito com os aplicativos da Boina Azul.

Quando o conteúdo for exibido, o contrato exige link direto para a página correspondente do Alerta Licitação, sem `nofollow`. Também determina limite de uma chamada por segundo e proíbe métodos para subverter essa limitação.

As restrições adicionais incluem não fazer engenharia reversa da API, não alugar/revender/distribuir/utilizar as APIs fora do escopo, não interferir nos serviços e não usar a API para desenvolver produto ou serviço concorrente da Boina Azul. O contrato ainda prevê requisitos de segurança, cooperação em incidentes, possibilidade de revisão de conformidade e cobrança conforme as regras publicadas.

### Consequência para o projeto

A API do Alerta Licitação não pode ser tratada como base autorizada para clonar o próprio serviço ou alimentar um produto concorrente sem autorização contratual expressa. A implementação segura deve ser clean-room e independente, usando fontes oficiais com licença compatível; a integração Alerta, caso ainda desejada, deve ser mantida como adaptador opcional, condicionado à autorização escrita e a uma revisão jurídica do contrato.

## Navegação pública e gating de recursos

A rota `/!estado` expõe uma grade de UFs com contagens de licitações e links no padrão `/!estado/{UF}`. A mesma página repete a navegação lateral e o rodapé institucional com política de privacidade, página “Quem somos”, área de desenvolvedores e API.

A rota `/!buscaItens`, apesar de aparecer na navegação pública, exibiu tela de autenticação sem mostrar o formulário de busca ao visitante não autenticado. O mesmo padrão foi observado na rota `/!api`.

Esses resultados sugerem um produto híbrido: parte do catálogo e das contagens é indexável/publicamente visível, enquanto busca avançada e integrações são protegidas por login e/ou assinatura. Isso descreve comportamento de produto, mas não permite inferir o back-end privado.

## Listagem estadual observada

A rota `/!estado/SP` mostra um total agregado de licitações para o estado e uma mensagem de cobertura parcial para visitantes: a página informa que apenas algumas licitações são mostradas e que o acesso completo depende de assinatura.

Os cards/listagens expõem identificador, visualizações, data de abertura, modalidade, órgão ou prefeitura, município e objeto textual. Foram observados identificadores heterogêneos, como `PSVC-SP-0-9825`, `LVR-SP-3330` e numerações de edital, o que indica que a chave pública é composta por fonte/UF/identificador e não por um único padrão nacional. A navegação de detalhe segue o identificador exibido, mas o HTML completo dessa listagem ainda precisa ser salvo para extrair os hrefs com precisão.

## Ficha detalhada observada

A rota `/!licitacao/PSVC-SP-0-9825` expõe um detalhe público com título/identificador, cidade e UF, modalidade, órgão, abertura e objeto textual. Também exibe um link para o site original do órgão público e ações de favoritar, compartilhar, ver outras licitações da mesma cidade e adicionar ao Google Agenda.

Na sessão persistida do navegador, a interface passou a mostrar recursos de usuário autenticado, incluindo “Meu painel”, “Busca Avançada” e “Minha API”. O email exibido pertence à sessão do usuário e não foi copiado para este dossiê. Nenhuma credencial, token ou conteúdo privado foi acessado ou armazenado.

## UASG e modalidades

A rota `/!uasg` oferece dois campos alternativos: código UASG numérico e nome ou parte do nome do órgão comprador. A página define UASG como código numérico de órgãos compradores no ComprasGOV e oferece uma rota adicional `/!uasg/lista` para a lista completa de UASGs.

A rota `/!tipo` informa que suas contagens representam licitações atualmente abertas e liga cada modalidade a um identificador numérico. Foram observados, entre outros, Pregão eletrônico (`5`), Dispensa (`6`), Concorrência (`2`), Chamamento público (`11`), Registro de preço (`10`), Inexigibilidade (`7`), Pregão (`13`), Pregão presencial (`8`), Concorrência eletrônica (`17`), Leilão (`3`), Cotação Eletrônica (`15`), Convite (`1`) e Concurso (`9`).

O padrão observado é uma página agregadora de contagens que redireciona para listas filtradas por códigos internos de modalidade; a página não expõe, nessa camada, o identificador oficial do PNCP nem a origem de cada contagem.

## CNAE e municípios

A rota `/!cnae` apresenta uma tabela de códigos CNAE, descrição da atividade econômica e quantidade de licitações associadas. A própria página informa que o módulo está em testes e que 68% das licitações estavam classificadas no momento da coleta. Isso indica uma camada de classificação/enriquecimento própria sobre os registros, não necessariamente um filtro nativo de uma fonte oficial.

A rota `/!municipios` não lista cidades diretamente: primeiro exige a escolha de um estado e leva às rotas `/!municipios/{UF}`. Portanto, a contagem por município é construída em dois níveis — UF e cidade — e a implementação equivalente deve manter uma dimensão normalizada de municípios, idealmente com código IBGE, além da contagem de registros abertos por município.

## Tendências e proximidade

A rota `/!termometro` oferece uma série histórica por palavra-chave, ano e UF opcional. A própria página orienta que palavras compostas devem ser pesquisadas separadamente porque a contagem considera ocorrências de qualquer uma das palavras. A implementação equivalente deverá definir explicitamente a semântica de busca — OR, AND, frase e stemming — para não reproduzir ambiguidades.

A rota `/!pertodevoce` solicita UF, cidade, distância máxima entre 50 e 500 km, opção de restringir a um único estado e palavra-chave opcional. A página também exibe seleção de modalidades, incluindo concorrência, pregão eletrônico, dispensa, inexigibilidade, registro de preço, chamamento público, compra eletrônica, diálogo competitivo e concorrência eletrônica.

O filtro de origem lista explicitamente Compras Governamentais/ComprasNET, Licitações-E/Banco do Brasil, BEC-SP, PNCP, PRODESP, BLL Compras, BNC Compras, BBMNET, Portal de Compras Públicas, LicitaNET, Compras BR, M2A Compras e “Demais portais”. Essa lista é evidência direta de fontes declaradas na interface, mas não prova que cada fonte seja consumida por API; algumas podem ser capturadas por integração própria, feed, exportação ou coleta autorizada.

## Alertas e manutenção de fontes

A rota `/!alerta` oferece cadastro gratuito de email para receber licitações de interesse e encaminha o usuário conectado para as configurações do painel. A configuração detalhada não foi aberta para não acessar dados privados da conta.

A rota `/!mudancas` é uma fonte valiosa de evidência operacional: o site publica um histórico de versões e registra adição de municípios, correções de indexação de portais, alterações de sites municipais, captura de itens do PNCP, ajustes de acentuação e inclusão de novos portais. Entre os registros recentes, aparecem correções ou integrações relacionadas a PNCP, CODEMGE, Portal da Indústria, TCE-PR, M2A Compras, portal SELCORP, FINDES, CESAN-ES, SESC-ES e LICITACON/RS.

A existência de várias entradas “corrigido devido à mudança do site” indica que, além de APIs públicas, o serviço mantém conectores específicos por portal e rotinas de manutenção de scraping/parsing. Portanto, não é tecnicamente correto presumir que todo o catálogo venha de uma única API nacional.

## Estrutura exata da busca avançada

O HTML público da rota `/!buscAvancada` confirma um formulário `POST` com token oculto `csrf` e limite declarado de 1.000 licitações por consulta. Os campos principais são `q` para palavras-chave, `da_i` e `da_f` para intervalo de data de abertura, `UFList[]` para estados, `tiposList[]` para modalidades, `PortaisList[]` para portais, `EsferasList[]` para esfera, `cnae` para atividade econômica, `valorMinimo` para valor mínimo e `acao=Buscar`.

Os estados começam marcados por padrão. O front-end fornece atalhos de seleção por região e implementa as listas no cliente. As modalidades usam códigos internos de 0 a 17; os portais usam códigos internos 1 a 12 e `9999` para “Demais portais”; as esferas usam 1 Federal, 2 Estadual, 3 Municipal/Distrital, 4 Administração Indireta e 0 Não classificado.

O CNAE é um `select` com códigos internos próprios, não o código CNAE diretamente como valor. A busca avançada possui ainda perfis salvos em rotas como `/!buscAvancada/4663`, `/!buscAvancada/4694` e `/!buscAvancada/5011`, além de função JavaScript declarada para exportar a busca para `/exportaBuscaExcel.php`.

A observação mais importante para a réplica é que o portal não depende de uma única consulta remota para responder aos filtros: ele aparenta manter uma base normalizada própria com dimensões de UF, modalidade, portal, esfera, CNAE, município e data, sobre a qual calcula contagens e aplica combinações.

## Preço e popularidade

A rota `/!preco` agrega licitações em cinco faixas: até R$ 80 mil; R$ 80 mil–150 mil; R$ 150 mil–650 mil; R$ 650 mil–R$ 1,5 milhão; e acima de R$ 1,5 milhão. A página alerta que a busca é experimental e que somente parte das licitações possui valor do edital cadastrado, o que exige um estado explícito de `valor_desconhecido` na réplica.

A rota `/!top10` esclarece que o ranking é baseado em visualizações acumuladas pelo site e pelo aplicativo, com duas ordenações: “Mais visualizadas” e “Menos visualizadas”. Trata-se de uma métrica de engajamento própria, não de um atributo originário do PNCP ou Compras.gov.br.

## Busca textual global

Uma consulta pública por `trator` redirecionou para `/!busca` e retornou 206 licitações abertas, com paginação numerada e link “Próxima”. A página orienta que termos compostos devem ser colocados entre aspas; sem aspas, o sistema procura licitações que contenham qualquer uma das palavras fornecidas. Isso confirma semântica OR para termos separados e busca de frase para expressões entre aspas.

Cada resultado apresenta identificador, título/número, visualizações, modalidade, cidade/UF, órgão, objeto e, quando disponível, o portal de origem. A mesma consulta exibiu registros distintos para a mesma numeração de edital em BLL e BNC, indicando que a chave deduplicadora precisa incluir fonte/portal e identificador externo, e não apenas número do edital.

## Vencimento e séries históricas

A rota `/!vencendoHoje` define “vencendo hoje” pela data de abertura igual à data corrente exibida no site e marca registros com horário passado como “Encerrada”. Os resultados seguem o mesmo card de licitação, com identificador, portal, data/hora, órgão, município, objeto, modalidade e, em alguns casos, valor.

A rota `/!serieTemporal` apresenta um gráfico Highcharts com a quantidade de licitações encerradas por mês de abertura, cobrindo meses de 2025 e 2026 na coleta. A página informa que anos anteriores ficam em servidores de backup e podem ser consultados sob demanda ou pela API do próprio Alerta. Para a réplica, a solução deve manter agregados mensais materializados e uma política de retenção histórica explícita, sem depender de backup opaco.

## APIs oficiais confirmadas — PNCP

O manual oficial de consultas informa que a base de produção é `https://pncp.gov.br/api/consulta` e que a consulta pública não exige autenticação. O manual de integração atualizado também distingue a API de consulta pública das APIs de manutenção, que exigem autenticação.

O manual oficial de consultas confirma o endpoint `GET /v1/contratacoes/publicacao` para contratações por período de publicação. Parâmetros obrigatórios: `dataInicial`, `dataFinal` no formato `AAAAMMDD`, `codigoModalidadeContratacao` e `pagina`. Parâmetros opcionais: `codigoModoDisputa`, `uf`, `codigoMunicipioIbge`, `cnpj`, `codigoUnidadeAdministrativa`, `idUsuario` e `tamanhoPagina`, limitado a 500. O retorno inclui `numeroControlePNCP`, `numeroCompra`, `anoCompra`, `processo`, instrumento convocatório, modalidade, modo de disputa, situação, objeto, valores, `dataAberturaProposta`, `dataEncerramentoProposta`, datas de publicação/inclusão/atualização, órgão, unidade, código IBGE, município, UF e `linkSistemaOrigem`.

O manual também confirma `GET /v1/contratacoes/proposta` para contratações com período de recebimento de propostas em aberto. Ele exige `dataFinal`, `codigoModalidadeContratacao` e `pagina`, aceita filtros por UF, município IBGE, CNPJ, unidade e usuário, e suporta `tamanhoPagina` até 500. Esse endpoint é o candidato oficial mais próximo para o card “vencendo hoje”, mas a regra exata de igualdade da data e tratamento de horários deve ser aplicada na nossa base.

A configuração OpenAPI pública de produção respondeu em `https://pncp.gov.br/api/pncp/v3/api-docs/swagger-config` e apontou para `https://pncp.gov.br/pncp-api/v3/api-docs`. A especificação pública listou, entre outras, as rotas de detalhe e itens: `/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}`, `/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens`, `/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens/{numeroItem}`, `/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/arquivos`, `/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/historico` e rotas de atas e contratos sob a mesma chave. A especificação retornada é de serviços PNCP; cada operação precisa ser conferida quanto à necessidade de autenticação antes de ser usada como consulta pública.

Fontes oficiais preservadas: manual de consultas `https://www.gov.br/pncp/pt-br/pncp/copy_of_manuais/ManualPNCPAPIConsultasVerso1.0.pdf/@@display-file/file`; manual atualizado `https://pncp.gov.br/manual/pt-br/latest/singlehtml/`; configuração OpenAPI `https://pncp.gov.br/api/pncp/v3/api-docs/swagger-config`; especificação OpenAPI `https://pncp.gov.br/pncp-api/v3/api-docs`; portal governamental do PNCP `https://www.gov.br/rededeparcerias/pt-br/servicos/portal-nacional-de-contratacoes-publicas-pncp`.

## Dados Abertos Compras.gov.br

A página oficial `https://www.gov.br/compras/pt-br/cidadao/portal-de-dados-abertos` confirma que o Portal de Dados Abertos disponibiliza dados do SIASG e do Compras.gov.br, oferece API REST oficial, documentação Swagger, explorador de dados e repositório CSV. O Swagger oficial indicado é `https://dadosabertos.compras.gov.br/swagger-ui/index.html`; o repositório é `https://repositorio.dados.gov.br/seges/comprasgov/` e expõe diretórios `anual`, `catalogo_cnbs`, `compras_legado`, `diario` e `mensal`.

## API oficial de Dados Abertos do Compras.gov.br — OpenAPI confirmado

A especificação oficial foi obtida de `https://dadosabertos.compras.gov.br/v3/api-docs`. O servidor declarado é `https://dadosabertos.compras.gov.br`, com OpenAPI 3.1.0 e título “API Compras.gov.br”.

Para contratações sob a Lei 14.133/2021, a operação de lista é `GET /modulo-contratacoes/1_consultarContratacoes_PNCP_14133`. Ela aceita paginação (`pagina`, `tamanhoPagina`), unidade (`unidadeOrgaoCodigoUnidade`), órgão (`codigoOrgao`, `orgaoEntidadeCnpj`), período de publicação PNCP (`dataPublicacaoPncpInicial`, `dataPublicacaoPncpFinal`), modalidade (`codigoModalidade`), município IBGE (`unidadeOrgaoCodigoIbge`), UF (`unidadeOrgaoUfSigla`), atualização (`dataAualizacaoPncp`), amparo legal e exclusão. A operação de detalhe é `GET /modulo-contratacoes/1.1_consultarContratacoes_PNCP_14133_Id`, exigindo `tipo` e `codigo`, com atualização opcional.

Para itens da contratação 14.133, a lista é `GET /modulo-contratacoes/2_consultarItensContratacoes_PNCP_14133`, com filtros por unidade, órgão, situação do item, material/serviço, classe, grupo, item de catálogo, resultado, fornecedor, janela de inclusão/atualização PNCP, BPS, margem de preferência, NCM e PDM. O detalhe é `GET /modulo-contratacoes/2.1_consultarItensContratacoes_PNCP_14133_Id`, com `tipo`, `codigo`, `idCompraItem` e atualização.

Para resultados/vencedores de itens, a lista é `GET /modulo-contratacoes/3_consultarResultadoItensContratacoes_PNCP_14133`, com filtros por fornecedor, porte, natureza jurídica, situação do resultado, faixas de valor unitário/total homologado, período de resultado e benefícios. O detalhe correspondente é `GET /modulo-contratacoes/3.1_consultarResultadoItensContratacoes_PNCP_14133_Id`.

Para o legado SIASG/Comprasnet, a lista de licitações é `GET /modulo-legado/1_consultarLicitacao`, com `uasg`, número do aviso, modalidade, período de publicação e indicador `pertence14133`; o detalhe é `GET /modulo-legado/1.1_consultarLicitacao_Id`. Itens de licitação legada são consultados por `GET /modulo-legado/2_consultarItemLicitacao`, e compras sem licitação por `GET /modulo-legado/5_consultarComprasSemLicitacao`, com filtros por ano/aviso, modalidade, órgão, UASG, datas de dispensa, ratificação, publicação e `pertence14133`.

Para cadastro e código de UASG, a operação é `GET /modulo-uasg/1_consultarUasg`, com `codigoUasg`, CNPJ/CPF de órgão, UF e status; para órgãos, `GET /modulo-uasg/2_consultarOrgao`, com identificadores, código do órgão, status e uso SISG. Para catálogo, há `GET /modulo-material/4_consultarItemMaterial` e `GET /modulo-servico/6_consultarItemServico`.

Para pesquisa de preços praticados, as operações oficiais são `GET /modulo-pesquisa-preco/1_consultarMaterial` e `/1.1_consultarMaterial_CSV`, com tipo/código, UASG, UF, município, data do resultado, classe, poder, esfera, compra e janela de compra; para serviços, `/3_consultarServico` e `/3.1_consultarServico_CSV`; para detalhes, `/2_consultarMaterialDetalhe`, `/2.1_consultarMaterialDetalhe_CSV`, `/4_consultarServicoDetalhe` e `/4.1_consultarServicoDetalhe_CSV`.

A operação de ARP por item é `GET /modulo-arp/2_consultarARPItem`, que aceita unidade gerenciadora, modalidade, vigência, assinatura, item, código, tipo, fornecedor, PDM e número da compra. Isso é complementar à busca de editais e atende a atas/registro de preços, mas não substitui a base de contratações.

### Validação de contrato e paginação do Compras.gov.br

A operação `GET /modulo-contratacoes/1_consultarContratacoes_PNCP_14133` declara no OpenAPI `dataPublicacaoPncpInicial` e `dataPublicacaoPncpFinal` como obrigatórios no formato `YYYY-MM-DD`, além de `codigoModalidade`. `pagina` tem padrão 1 e `tamanhoPagina` padrão 10. Um teste público com `tamanhoPagina=1` retornou HTTP 400 e a mensagem `Informe um número de paginação no intervalo de 10 a 500`, confirmando o limite operacional de 10 a 500 registros por página.

Um teste público com a operação de contratações 14.133, datas `2026-08-20` a `2026-08-21`, modalidade 6 e `tamanhoPagina=10`, retornou HTTP 200 e o envelope `{"resultado":[],"totalRegistros":0,"totalPaginas":0,"paginasRestantes":0}`. A ausência de registros nesse recorte não invalida a operação; ela deve ser tratada como conjunto vazio válido, distinto de erro e de indisponibilidade.

## Declaração pública de fontes do próprio Alerta

A página pública `/!sobre` afirma que o serviço faz varredura diária principalmente no Portal Nacional de Compras Públicas/PNCP, ComprasNet, Licitações-e do Banco do Brasil, Licitações Caixa, BEC, LicitaCON-RS, E-Lic-SC, LicitaNet, Licitar Digital, Portal de Compras Públicas, Publinexo, Diário Oficial da União, portais estaduais (incluindo Compras Pará, ComprasNet Bahia, PE Integrado, Compras MG, Compras Paraná/GMS, SIGA-ES e SIGA-RJ), Diário Oficial dos Municípios, TCE-PI, TCE Manaus, TCE Ceará, TCM Pará, TCE Acre, Petronect, FUMEC-SP, Casa da Moeda, Agência Peixe Vivo, portais privados como BLL, BNC, ComprasBR e sites diretamente mantidos por prefeituras.

Essa declaração é a evidência pública mais forte sobre o mapa de fontes, mas não prova que cada fonte tenha uma API aberta nem qual protocolo é usado em cada caso. A hipótese operacional mais provável é uma arquitetura híbrida: APIs oficiais onde existem, downloads/CSVs, feeds ou páginas públicas quando autorizados, e conectores específicos para portais privados e sites de órgãos. A réplica não deve tentar usar uma API universal inexistente para todas as fontes.

A página de desenvolvedores informa que a API própria do Alerta é uma camada de leitura sobre as licitações disponíveis no site, com token e restrições contratuais, incluindo proibição de varredura completa. Isso reforça a decisão de não utilizá-la como fonte de ingestão do nosso produto; ela deve ser tratada apenas como evidência de que o Alerta mantém um índice próprio e não como dependência técnica.

## TCU — cobertura e limitação de validação

A página oficial de Webservices do TCU expõe um endpoint de licitações e compras diretas em `https://portal.tcu.gov.br/lumis/api/rest/licitacoestcu/lumgetdata/list.xml`, além de um endpoint separado para termos contratuais, mas a extração textual não publicou o contrato de parâmetros. Uma chamada passiva sem parâmetros retornou HTTP 200 com uma página HTML de “Acesso Bloqueado”, não dados, portanto o endpoint é confirmado como publicado pelo TCU, mas o formato de consumo e a possibilidade de automação precisam ser validados com documentação/autoridade do órgão. Não deve ser usado como dependência primária até essa validação.

O TCU também documenta APIs públicas para atos normativos e certidões de pessoa jurídica, porém elas não são fontes de volumetria de editais municipais/estaduais. Elas podem complementar due diligence de fornecedores e compliance, não a ingestão principal de licitações.

## TCE-CE — API de Dados Abertos do SIM

A documentação oficial do TCE-CE está em `https://api-dados-abertos.tce.ce.gov.br/sim/` e declara a base `https://api-dados-abertos.tce.ce.gov.br/sim/metodo?campo1=valor1&campo2=valor2`. O catálogo OAS3 inclui, no módulo de Processos Administrativos para Contratações (LCO), `GET /processos_administrativos_contratacoes`, `GET /publicacoes_editais_processos_administrativos_parcerias`, `GET /licitantes_fornecedores_bens_servicos`, `GET /itens_compoem_bens_servicos`, `GET /dotacoes_utilizadas_contratacoes`, `GET /contratos` e `GET /contratados`.

A própria documentação informa limite de até 1.000 registros por requisição e uso de `$start_index` para paginação (`0`, `1000`, `2000` etc.), além de restrição de acesso a IPs no Brasil e autenticação para endpoints protegidos. A API é uma fonte estadual de dados do Ceará, não um substituto do PNCP nacional. Os parâmetros exatos de município/modalidade/período devem ser obtidos no schema de cada operação antes de implementar o adaptador.

### Parâmetros LCO confirmados no OpenAPI do TCE-CE

No YAML oficial `https://api-dados-abertos.tce.ce.gov.br/sim/openapi_prod.yaml`, `GET /processos_administrativos_contratacoes` exige `codigo_municipio`, `data_inicio` e `data_fim`, e aceita `$format=json|xml`, `$count` de 1 a 1000 e `$start_index`. `GET /publicacoes_editais_processos_administrativos_parcerias` exige o mesmo trio de município e intervalo de datas, com a mesma paginação. `GET /licitantes_fornecedores_bens_servicos` e `GET /itens_compoem_bens_servicos` também exigem município e intervalo de autuação do processo. `GET /contratos` exige município e intervalo da data de celebração, com filtros opcionais de gestor/fiscal e a mesma paginação.

O catálogo do TCE-CE não expõe, nesses endpoints LCO, um filtro de modalidade equivalente ao `codigoModalidadeContratacao` do PNCP; portanto a modalidade pode precisar ser derivada do registro retornado ou obtida de outra camada do SIM. Isso impede prometer equivalência 1:1 com a busca avançada do Alerta apenas usando TCE-CE.

### Segurança das rotas PNCP

A inspeção do OpenAPI `https://pncp.gov.br/pncp-api/v3/api-docs` mostrou que as operações GET de contratação, itens, resultados, documentos, histórico, atas, contratos e PCA não possuem requisito `bearerAuth` explícito no nível da operação; as rotas de arquivos excluídos são as exceções que declaram bearer token. Isso é compatível com a documentação que separa consulta pública de manutenção autenticada, mas cada chamada deve ser testada com parcimônia e monitorada para mudanças de contrato.

### Atas e contratos no PNCP

O manual oficial confirma `GET /v1/atas` para consulta de atas de registro de preços por período de vigência, exigindo `dataInicial`, `dataFinal` e `pagina`, aceitando `idUsuario`, `cnpjOrgao`, `codigoUnidadeAdministrativa` e `tamanhoPagina` até 500. O retorno inclui `numeroControlePNCPAta`, `numeroControlePNCPCompra`, número/ano da ata, vigência, cancelamento, objeto, órgão, unidade e sistema de origem.

Também confirma `GET /v1/contratos` para contratos e empenhos com força de contrato por período de publicação, exigindo `dataInicial`, `dataFinal` e `pagina`, aceitando `cnpjOrgao`, `codigoUnidadeAdministrativa`, `usuarioId` e `tamanhoPagina` até 500. O retorno inclui o vínculo `numeroControlePNCPCompra`, fornecedor, valores, vigência, órgão, município/UF, usuário de origem e data de atualização.
