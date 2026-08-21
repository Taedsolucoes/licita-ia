import json
from pathlib import Path

spec = json.loads(Path('/home/ubuntu/licita-ia/evidence/apis/compras_v3_api-docs.body').read_text())
for path, operations in spec.get('paths', {}).items():
    for method, op in operations.items():
        if op.get('operationId') != 'consultarContratacoes_PNCP_14133':
            continue
        print('PATH', method.upper(), path)
        print('SUMMARY', op.get('summary'))
        print('DESCRIPTION', op.get('description'))
        for p in op.get('parameters', []):
            print('PARAM', p.get('name'), 'in=', p.get('in'), 'required=', p.get('required'), 'description=', p.get('description'), 'schema=', p.get('schema'))
        print('RESPONSES', sorted(op.get('responses', {}).keys()))
