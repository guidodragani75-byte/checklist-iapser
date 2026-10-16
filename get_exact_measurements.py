import os, glob, pypdf, re, sys, json

sys.stdout.reconfigure(encoding='utf-8')

folder = r'C:\Users\cript\Downloads\drive-download-20260925T015525Z-1-001\Abril\Informes'
files = glob.glob(os.path.join(folder, '*.pdf'))

all_records = []

for idx, f in enumerate(files):
    fname = os.path.basename(f)
    reader = pypdf.PdfReader(f)
    pages = [p.extract_text() for p in reader.pages]
    
    print(f"\n=======================================================")
    print(f"FILE {idx+1}: {fname}")
    
    # Search for PAT text in the body and in protocol
    pat_info = ""
    for p_idx, p in enumerate(pages):
        if "MEDICIÓN DE RESISTENCIA DE PUESTA A TIERRA" in p.upper() or "MEDICIÓN DE RESISTENCIA DE PAT" in p.upper():
            for line in p.split('\n'):
                if any(w in line.lower() for w in ['ohm', 'resistencia', '0,', '0.', '1,', '1.', '2,', '2.', '3,', '4,', 'adecuad', 'parámetro', 'jabalina', 'segura']):
                    pat_info += f" [P.{p_idx+1}] {line.strip()}"
        if "PROTOCOLO DE MEDICIÓN DE PUESTA A TIERRA" in p.upper() or "ESQUEMA DE CONEXIÓN A TIERRA" in p.upper() or "VALOR OBTENIDO EN LA MEDICIÓN" in p.upper():
            for line in p.split('\n'):
                if any(w in line.lower() for w in ['ohm', 'cumple', 'valor', '0,', '0.', '1,', '1.', '2,', '2.', 'dd', 'ia']):
                    pat_info += f" [Protocol P.{p_idx+1}] {line.strip()}"
                    
    # Search for Iluminacion text
    ilu_info = ""
    for p_idx, p in enumerate(pages):
        if "MEDICIÓN DE NIVELES DE ILUMINACIÓN" in p.upper() or "MEDICIÓN DE ILUMINACIÓN" in p.upper():
            for line in p.split('\n'):
                if any(w in line.lower() for w in ['lux', 'adecuad', 'homogénea', 'homogenea', 'mínimo', 'minimo', 'variacion', 'conclusi', 'inferior']):
                    ilu_info += f" [P.{p_idx+1}] {line.strip()}"
        if "VALOR REQUERIDO LEGALMENTE" in p.upper() or "VALOR MEDIDO (LUX)" in p.upper():
            for line in p.split('\n'):
                if any(w in line.lower() for w in ['lux', 'mesa', 'oficina', 'archivo', 'hall', 'laboratorio', 'aula', 'taller']):
                    ilu_info += f" [Protocol P.{p_idx+1}] {line.strip()}"
                    
    # Search for Agua text
    agua_info = ""
    for p_idx, p in enumerate(pages):
        if "CALIDAD DEL AGUA" in p.upper() or "RESULTADOS DE ANALISIS DE AGUA" in p.upper() or "ANÁLISIS DE AGUA" in p.upper() or "CONCLUSION ANALISIS DE AGUA" in p.upper():
            for line in p.split('\n'):
                if any(w in line.lower() for w in ['apto', 'apta', 'potab', 'consumo', 'bacteriol', 'fisicoqu', 'mesófil', 'coliform', 'arsénico', 'red', 'tanque', 'limpieza', 'microbiol']):
                    agua_info += f" [P.{p_idx+1}] {line.strip()}"

    # Search for Ruido
    ruido_info = ""
    for p_idx, p in enumerate(pages):
        if "MEDICIÓN DE NIVELES DE RUIDO" in p.upper() or "MEDICIÓN DE RUIDO" in p.upper() or "CONTAMINACIÓN ACÚSTICA" in p.upper():
            for line in p.split('\n'):
                if any(w in line.lower() for w in ['ruido', 'acústic', 'acustic', 'decibel', 'dba', 'contaminaci', 'anexo']):
                    ruido_info += f" [P.{p_idx+1}] {line.strip()}"

    print(f"PAT: {pat_info[:300]}")
    print(f"ILU: {ilu_info[:300]}")
    print(f"AGUA: {agua_info[:300]}")
    print(f"RUIDO: {ruido_info[:300]}")

    all_records.append({
        'idx': idx + 1,
        'filename': fname,
        'pat_info': pat_info,
        'ilu_info': ilu_info,
        'agua_info': agua_info,
        'ruido_info': ruido_info
    })

with open('exact_measurements.json', 'w', encoding='utf-8') as f_out:
    json.dump(all_records, f_out, ensure_ascii=False, indent=2)
