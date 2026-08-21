import json
from pathlib import Path

spec = json.loads(Path('/home/ubuntu/licita-ia/evidence/apis/pncp-api-v3-openapi.json').read_text())
needles = ('/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}', '/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens', '/v1/orgaos/{cnpj}/contratos', '/v1/orgaos/{cnpj}/pca')
for path, operations in sorted(spec.get('paths', {}).items()):
    if not any(path.startswith(n) for n in needles):
        continue
    for method, op in sorted(operations.items()):
        if method.lower() != 'get':
            continue
        print(method.upper(), path, 'security=', op.get('security', '<inherits-global>'), 'responses=', ','.join(sorted(op.get('responses', {}).keys())))
print('GLOBAL_SECURITY=', spec.get('security'))
