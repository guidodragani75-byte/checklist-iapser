import os, glob, pypdf, re, sys

sys.stdout.reconfigure(encoding='utf-8')

folder = r'C:\Users\cript\Downloads\drive-download-20260925T015525Z-1-001\Abril\Informes'
files = glob.glob(os.path.join(folder, '*.pdf'))

for idx in range(len(files)):
    f = files[idx]
    fname = os.path.basename(f)
    reader = pypdf.PdfReader(f)
    pages = [p.extract_text() for p in reader.pages]
    
    print(f"\n{'='*70}\n[FILE {idx+1}] {fname}")
    
    # Print the specific pages where PAT, ILU, AGUA and RUIDO are discussed in the body
    # Usually around page 10 to 20
    for p_no in range(8, min(22, len(pages))):
        txt = pages[p_no]
        if any(k in txt.upper() for k in ['MEDICIÓN DE RESISTENCIA DE PUESTA A TIERRA', 'MEDICIÓN DE NIVELES DE ILUMINACIÓN', 'CALIDAD DEL AGUA', 'MEDICIÓN DE NIVELES DE RUIDO', 'MEDICIÓN DE RESISTENCIA DE PAT']):
            print(f"--- Page {p_no+1} ---")
            print(txt.strip())

    # Also check the protocol pages for PAT values or table rows
    for p_no in range(20, len(pages)):
        txt = pages[p_no]
        if "VALOR OBTENIDO EN LA MEDICIÓN" in txt.upper() or "OHM (Ω)" in txt.upper() or "OHM" in txt.upper():
            lines = [l.strip() for l in txt.split('\n') if any(w in l.lower() for w in ['ohm', 'valor', 'cumple', 'jabalina', '0,', '0.', '1,', '1.', '2,', '2.'])]
            if lines:
                print(f"--- Protocol Page {p_no+1} snippet ---")
                for l in lines[:10]:
                    print("  ", l)
                    
        # Check Agua conclusion at the end of the PDF
        if "CONCLUSION ANALISIS DE AGUA" in txt.upper() or "RESULTADOS DE ANALISIS DE AGUA" in txt.upper() or "CONCLUSIÓN DE LOS RESULTADOS DE ANÁLISIS DE AGUA" in txt.upper():
            print(f"--- Agua Conclusion Page {p_no+1} ---")
            print(txt.strip()[:1000])
