import json
from pathlib import Path

spec = json.loads(Path('/home/ubuntu/licita-ia/evidence/apis/pncp-api-v3-openapi.json').read_text())
keywords = ('compra', 'contrat', 'item', 'arquivo', 'historico', 'ata', 'municip', 'modal', 'orgao', 'pca')
for path, operations in sorted(spec.get('paths', {}).items()):
    if not any(k in path.lower() for k in keywords):
        continue
    for method, op in sorted(operations.items()):
        if method.lower() not in {'get', 'post', 'put', 'patch', 'delete'}:
            continue
        params = []
        for p in op.get('parameters', []):
            schema = p.get('schema', {})
            params.append(f"{p.get('name')}[{p.get('in')}]" + ('*' if p.get('required') else '') + f":{schema.get('type','')}")
        print(f"{method.upper():6} {path} | operationId={op.get('operationId','')} | params={', '.join(params)}")
