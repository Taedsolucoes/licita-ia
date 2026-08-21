import json
from pathlib import Path

spec = json.loads(Path('/home/ubuntu/licita-ia/evidence/apis/compras/openapi.json').read_text())
path = spec['paths']['/modulo-contratacoes/1_consultarContratacoes_PNCP_14133']
print('METHODS', ','.join(path.keys()))
operation = path['get']
print('OPERATION_ID', operation.get('operationId'))
print('PARAMETERS')
for parameter in operation.get('parameters', []):
    schema = parameter.get('schema', {})
    print(parameter.get('name'), parameter.get('in'), 'required=', parameter.get('required'), 'type=', schema.get('type'), 'format=', schema.get('format'), 'default=', schema.get('default'))
print('RESPONSES')
for code, response in operation.get('responses', {}).items():
    print(code, response.get('description'))
    for media_type, media in response.get('content', {}).items():
        print('MEDIA', media_type, 'SCHEMA', media.get('schema'))
print('COMPONENT_SCHEMAS_REFERENCED')
refs = set()
for response in operation.get('responses', {}).values():
    for media in response.get('content', {}).values():
        ref = media.get('schema', {}).get('$ref')
        if ref:
            refs.add(ref.rsplit('/', 1)[-1])

def resolve(ref):
    return spec.get('components', {}).get('schemas', {}).get(ref.rsplit('/', 1)[-1], {})

queue = list(refs)
seen = set()
while queue:
    name = queue.pop(0)
    if name in seen:
        continue
    seen.add(name)
    schema = resolve(name)
    print('\nSCHEMA', name)
    print(json.dumps(schema, ensure_ascii=False, indent=2))
    text = json.dumps(schema)
    for candidate in spec.get('components', {}).get('schemas', {}):
        if f'#/components/schemas/{candidate}' in text and candidate not in seen:
            queue.append(candidate)
