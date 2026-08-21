# Provider legado do Alerta Licitação

Este diretório contém o adapter histórico do Alerta Licitação mantido apenas para referência operacional e eventual remoção futura mediante decisão explícita do responsável pelo projeto.

## Estado

O provider está **desabilitado por padrão** e não é registrado no `IntegrationModule`. Nenhum job novo, scheduler ou rota interna deve conseguir utilizá-lo. O código foi preservado para não apagar histórico sem autorização.

## Motivo do isolamento

A due diligence técnica do projeto identificou que esse adapter chama um endpoint proprietário de terceiro e está sujeito aos termos contratuais do fornecedor. O projeto `licita-ia` adotará, como fonte de dados, conectores independentes para APIs oficiais e públicas, começando pelo PNCP e pelo Dados Abertos do Compras.gov.br.

Não utilizar este provider como modelo de payload, filtro, taxonomia, URL ou comportamento para novos adapters. Os conectores oficiais devem ser implementados clean-room, com base exclusivamente na documentação das respectivas autoridades públicas.

Não reativar, estender ou conectar este provider sem autorização escrita, revisão contratual e aprovação explícita do responsável pelo repositório.
