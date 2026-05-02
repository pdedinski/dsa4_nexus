import json
import sys

required_fields = ['id', 'name', 'german_name', 'is_basic', 'test_attributes', 'advancement_column', 'eec', 'combat_type', 'related_talents', 'description', 'specializations', 'source']

files = [
    'data/talents/combat_talents.json',
    'data/talents/physical_talents.json',
    'data/talents/social_talents.json',
    'data/talents/nature_talents.json',
    'data/talents/lore_talents.json',
    'data/talents/languages_scripts.json',
    'data/talents/artisan_talents.json',
]

total = 0
missing_fields = []
basic_counts = {'basic': 0, 'specialized': 0}

for f in files:
    with open(f, encoding='utf-8') as fp:
        data = json.load(fp)
    for t in data['talents']:
        total += 1
        if t.get('is_basic'):
            basic_counts['basic'] += 1
        else:
            basic_counts['specialized'] += 1
        for field in required_fields:
            if field not in t:
                missing_fields.append('{}: {} missing {}'.format(f, t.get('id', '???'), field))

print('Total talents: {}'.format(total))
print('Basic talents: {}'.format(basic_counts['basic']))
print('Specialized talents: {}'.format(basic_counts['specialized']))
if missing_fields:
    for m in missing_fields:
        print('MISSING: ' + m)
else:
    print('All required fields present in all talents!')
