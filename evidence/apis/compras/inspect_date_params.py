import json
from pathlib import Path

spec = json.loads(Path('/home/ubuntu/licita-ia/evidence/apis/compras/openapi.json').read_text())
operation = spec['paths']['/modulo-contratacoes/1_consultarContratacoes_PNCP_14133']['get']
for parameter in operation.get('parameters', []):
    if parameter.get('name') in {
        'dataPublicacaoPncpInicial',
        'dataPublicacaoPncpFinal',
        'dataAualizacaoPncp',
        'codigoModalidade',
        'unidadeOrgaoUfSigla',
        'unidadeOrgaoCodigoIbge',
    }:
        print(json.dumps(parameter, ensure_ascii=False, indent=2))
