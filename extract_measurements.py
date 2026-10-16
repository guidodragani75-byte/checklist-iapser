import os, glob, sys, pypdf, re, json

sys.stdout.reconfigure(encoding='utf-8')

folder = r'C:\Users\cript\Downloads\drive-download-20260925T015525Z-1-001\Abril\Informes'
files = glob.glob(os.path.join(folder, '*.pdf'))

for idx, f in enumerate(files):
    fname = os.path.basename(f)
    reader = pypdf.PdfReader(f)
    print(f"\n{'='*70}\n[{idx+1}/12] FILE: {fname}\nPAGES: {len(reader.pages)}")
    
    # We want to extract sections:
    # 1. First 3 pages for Header / Domicilio / CUIT / RS / Estab
    # 2. Summary of measurements (usually around pages 10-20)
    # 3. PAT Protocol pages
    # 4. Iluminacion Protocol pages
    # 5. Agua pages
    
    pages = [p.extract_text() for p in reader.pages]
    
    # Let's search for "MEDICIÓN DE RESISTENCIA DE PUESTA A TIERRA" or similar
    for p_idx, p_txt in enumerate(pages):
        # Look for PAT section summary
        if "MEDICIÓN DE RESISTENCIA DE PUESTA A TIERRA" in p_txt.upper() or "RESISTENCIA DE PAT" in p_txt.upper():
            print(f"--- PAT Mention (Page {p_idx+1}) ---")
            lines = p_txt.split('\n')
            for l in lines:
                if any(k in l.lower() for k in ['ohm', 'resistencia', 'adecuado', 'valor', 'puesta a tierra', 'anexo 5', 'anexo v', 'jabalina']):
                    print("  ", l.strip())
                    
        # Look for Iluminacion summary
        if "MEDICIÓN DE NIVELES DE ILUMINACIÓN" in p_txt.upper() or "MEDICIÓN DE ILUMINACIÓN" in p_txt.upper():
            print(f"--- Iluminacion Mention (Page {p_idx+1}) ---")
            lines = p_txt.split('\n')
            for l in lines:
                if any(k in l.lower() for k in ['lux', 'conclusi', 'adecuad', 'mínimo', 'minimo', 'anexo 6', 'anexo vi', 'uniformidad']):
                    print("  ", l.strip())

        # Look for Agua summary
        if "CALIDAD DEL AGUA" in p_txt.upper() or "RESULTADOS DE ANALISIS DE AGUA" in p_txt.upper() or "ANÁLISIS DE AGUA" in p_txt.upper():
            print(f"--- Agua Mention (Page {p_idx+1}) ---")
            lines = p_txt.split('\n')
            for l in lines:
                if any(k in l.lower() for k in ['apto', 'apta', 'potab', 'bacteriol', 'fisicoqu', 'mesófil', 'mesofil', 'coliform', 'consumo']):
                    print("  ", l.strip())

        # Look for Ruido summary
        if "MEDICIÓN DE NIVELES DE RUIDO" in p_txt.upper() or "MEDICIÓN DE RUIDO" in p_txt.upper() or "CONTAMINACIÓN ACÚSTICA" in p_txt.upper():
            print(f"--- Ruido / Otras Mention (Page {p_idx+1}) ---")
            lines = p_txt.split('\n')
            for l in lines:
                if any(k in l.lower() for k in ['ruido', 'acústic', 'acustic', 'dba', 'decibel', 'contaminaci', 'anexo']):
                    print("  ", l.strip())
