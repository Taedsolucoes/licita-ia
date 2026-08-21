import json
from pathlib import Path

spec = json.loads(Path('/home/ubuntu/licita-ia/evidence/apis/compras_v3_api-docs.body').read_text())
keywords = ('contrat', 'compra', 'item', 'preco', 'preço', 'catmat', 'catser', 'fornecedor', 'licit', 'uasg', 'municip', 'modal', 'órgão', 'orgao')
for path, operations in sorted(spec.get('paths', {}).items()):
    if not any(k in path.lower() for k in keywords):
        continue
    for method, op in sorted(operations.items()):
        if method.lower() not in {'get', 'post', 'put', 'patch', 'delete'}:
            continue
        params = []
        for p in op.get('parameters', []):
            params.append(f"{p.get('name')}[{p.get('in')}]" + ('*' if p.get('required') else ''))
        print(f"{method.upper():6} {path} | operationId={op.get('operationId','')} | params={', '.join(params)}")
