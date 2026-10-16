import json, re

with open('all_months_raw.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Total records in all_months_raw: {len(data)}")

issues = []
for idx, r in enumerate(data):
    # Check if RS is generic like "P á g i n a  1 | 1" or similar
    if "p á g i n a" in r['rs'].lower() or len(r['rs']) < 4:
        issues.append((idx, 'rs', r['rs'], r['filename'], r['mes']))
    if not r['domicilio'] or len(r['domicilio']) < 5:
        issues.append((idx, 'domicilio', r['domicilio'], r['filename'], r['mes']))
    if not r['cuit'] or len(r['cuit']) < 11:
        issues.append((idx, 'cuit', r['cuit'], r['filename'], r['mes']))

print(f"Total potential field issues: {len(issues)}")
for i, field, val, fname, mes in issues:
    print(f"  [{i+1}] Mes: {mes} | Field: {field} | Val: '{val}' | File: {fname}")
