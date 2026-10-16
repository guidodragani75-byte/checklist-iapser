import os, glob, sys, pypdf, re

sys.stdout.reconfigure(encoding='utf-8')

folder = r'C:\Users\cript\Downloads\drive-download-20260925T015525Z-1-001\Abril\Informes'
files = glob.glob(os.path.join(folder, '*.pdf'))

for idx, f in enumerate(files):
    fname = os.path.basename(f)
    reader = pypdf.PdfReader(f)
    print(f"\n{'='*75}\n[{idx+1}/12] {fname}")
    
    for p_num, p in enumerate(reader.pages):
        txt = p.extract_text()
        
        # Check if page is PAT protocol
        if "PROTOCOLO DE MEDICIÓN DE PUESTA A TIERRA" in txt.upper() or ("DATOS DE LA MEDICIÓN" in txt.upper() and ("PUESTA A TIERRA" in txt.upper() or "PAT" in txt.upper())):
            print(f">>> PAT Protocol on page {p_num+1}:")
            for line in txt.split('\n'):
                line_str = line.strip()
                if any(k in line_str.lower() for k in ['razón social', 'dirección', 'domicilio', 'c.u.i.t', 'establecimiento', 'localidad', 'valor', 'ohm', 'cumple', 'conclusi', 'jabalina', 'terreno', 'instrumento']):
                    print(f"    {line_str}")
                    
        # Check if page is Iluminacion protocol
        if "PROTOCOLO DE MEDICIÓN DE ILUMINACIÓN" in txt.upper() or ("DATOS DE LA MEDICIÓN" in txt.upper() and "ILUMINACIÓN" in txt.upper()):
            print(f">>> Iluminacion Protocol on page {p_num+1}:")
            for line in txt.split('\n'):
                line_str = line.strip()
                if any(k in line_str.lower() for k in ['punto de muestreo', 'valor medido', 'valor requerido', 'lux', 'conclusi', 'mesa', 'oficina']):
                    print(f"    {line_str}")

        # Check Calidad del Agua section text
        if "CALIDAD DEL AGUA" in txt.upper() and len(txt) > 200:
            print(f">>> Calidad del Agua on page {p_num+1}:")
            for line in txt.split('\n'):
                line_str = line.strip()
                if any(k in line_str.lower() for k in ['apto', 'apta', 'consumo', 'bacteriol', 'fisicoqu', 'mesófil', 'coliform', 'potab', 'tanque', 'red']):
                    print(f"    {line_str}")
