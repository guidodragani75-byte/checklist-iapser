import os, glob, sys, pypdf, re, json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from batch_engine import analyze_pdf

sys.stdout.reconfigure(encoding='utf-8')

base = r'C:\Users\cript\Downloads\drive-download-20260925T015525Z-1-001'

all_results = []

# 1. Load Abril from previously verified table_data.json
try:
    with open('table_data.json', 'r', encoding='utf-8') as f:
        abril_data = json.load(f)
    print(f"Loaded {len(abril_data)} records for Abril")
except Exception as e:
    abril_data = []

months = ['Enero', 'Febrero', 'Marzo', 'Mayo', 'Junio']

for m in months:
    m_dir = os.path.join(base, m)
    print(f"\n==========================================")
    print(f"PROCESSING MONTH: {m}")
    print(f"==========================================")
    
    # Collect files
    file_tuples = []
    for root, dirs, files in os.walk(m_dir):
        # Check for extra files like AA or AN.AGUA in the same directory
        extra_files = [os.path.join(root, f) for f in files if any(k in f.upper() for k in ['AN.AGUA', 'AN. AGUA', 'AA_', 'AGUA'])]
        for f in files:
            if not f.lower().endswith('.pdf'):
                continue
            full_path = os.path.join(root, f)
            fu = f.upper()
            
            # Select target technical reports
            if m in ['Enero', 'Febrero', 'Marzo']:
                if 'INFORMES' in root.upper() or 'INFORME TECNICO' in fu or 'INF TEC' in fu or 'INF. TEC' in fu:
                    file_tuples.append((full_path, extra_files))
            elif m == 'Mayo':
                if 'MAYO' in fu or 'INF' in fu:
                    file_tuples.append((full_path, extra_files))
            elif m == 'Junio':
                if any(k in fu for k in ['INF.TECNICO', 'INF TECNICO', 'INF TEC', 'INF. TEC']):
                    file_tuples.append((full_path, extra_files))
                    
    # Deduplicate by full_path
    seen = set()
    dedup = []
    for fp, ef in file_tuples:
        if fp not in seen:
            seen.add(fp)
            dedup.append((fp, ef))
            
    print(f"Total reports to analyze in {m}: {len(dedup)}")
    
    for idx, (fp, ef) in enumerate(dedup):
        res = analyze_pdf(fp, m, ef)
        if res:
            all_results.append(res)
            print(f"[{idx+1}/{len(dedup)}] {res['filename']} -> CUIT: {res['cuit']} | RS: {res['rs'][:30]} | Est: {res['estab']}")

with open('all_months_raw.json', 'w', encoding='utf-8') as out_f:
    json.dump(all_results, out_f, ensure_ascii=False, indent=2)

print(f"\nCompleted! Total records processed: {len(all_results)}")
