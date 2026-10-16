import os, glob, sys, pypdf, re

sys.stdout.reconfigure(encoding='utf-8')

folder = r'C:\Users\cript\Downloads\drive-download-20260925T015525Z-1-001\Abril\Informes'
files = glob.glob(os.path.join(folder, '*.pdf'))

for idx, f in enumerate(files):
    fname = os.path.basename(f)
    reader = pypdf.PdfReader(f)
    print(f"\n{'#'*80}\nFILE {idx+1}: {fname}")
    
    # Let's inspect all pages
    pages = [p.extract_text() for p in reader.pages]
    
    # 1. Header / Data
    p2 = pages[1] if len(pages) > 1 else ''
    p3 = pages[2] if len(pages) > 2 else ''
    p4 = pages[3] if len(pages) > 3 else ''
    print("--- PAGE 1-4 DATA ---")
    for l in (pages[0] + '\n' + p2 + '\n' + p3 + '\n' + p4).split('\n'):
        l_s = l.strip()
        if any(k in l_s.lower() for k in ['cuit', 'razón social', 'propietario', 'establecimiento', 'domicilio', 'dirección', 'localidad']):
            print("  ", l_s)
            
    # 2. PAT value & details
    print("--- PAT DETAILS ---")
    for p_num, p in enumerate(pages):
        if any(h in p.upper() for h in ['MEDICIÓN DE RESISTENCIA DE PUESTA A TIERRA', 'MEDICIÓN DE RESISTENCIA DE PAT', 'PROTOCOLO DE MEDICIÓN DE PUESTA A TIERRA']):
            for l in p.split('\n'):
                if any(k in l.lower() for k in ['ohm', '0,', '0.', '1,', '1.', '2,', '2.', '3,', 'cumple', 'adecuad', 'jabalina', 'valor obtenido']):
                    print(f"   [P.{p_num+1}] {l.strip()}")

    # 3. Iluminacion details
    print("--- ILUMINACION DETAILS ---")
    for p_num, p in enumerate(pages):
        if any(h in p.upper() for h in ['MEDICIÓN DE NIVELES DE ILUMINACIÓN', 'MEDICIÓN DE ILUMINACIÓN', 'PROTOCOLO DE MEDICIÓN DE ILUMINACIÓN']):
            for l in p.split('\n'):
                if any(k in l.lower() for k in ['lux', 'adecuad', 'conclusi', 'inferior', 'requerido', 'punto de muestreo']):
                    print(f"   [P.{p_num+1}] {l.strip()}")

    # 4. Agua details
    print("--- AGUA DETAILS ---")
    for p_num, p in enumerate(pages):
        if any(h in p.upper() for h in ['CALIDAD DEL AGUA', 'CONCLUSION ANALISIS DE AGUA', 'RESULTADOS DE ANALISIS DE AGUA']):
            for l in p.split('\n'):
                if any(k in l.lower() for k in ['apto', 'apta', 'potab', 'consumo', 'bacteriol', 'fisicoqu', 'mesófil', 'coliform', 'arsénico', 'red', 'tanque']):
                    print(f"   [P.{p_num+1}] {l.strip()}")

    # 5. Ruido / Otras
    print("--- RUIDO / OTRAS ---")
    for p_num, p in enumerate(pages):
        if any(h in p.upper() for h in ['MEDICIÓN DE NIVELES DE RUIDO', 'MEDICIÓN DE RUIDO', 'CONTAMINACIÓN ACÚSTICA', 'CARGA TÉRMICA']):
            for l in p.split('\n'):
                if any(k in l.lower() for k in ['ruido', 'acústic', 'acustic', 'decibel', 'dba', 'contaminaci', 'anexo', 'carga térmica']):
                    print(f"   [P.{p_num+1}] {l.strip()}")
