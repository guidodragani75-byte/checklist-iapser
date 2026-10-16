import os, pypdf, re, sys

sys.stdout.reconfigure(encoding='utf-8')

base = r'C:\Users\cript\Downloads\drive-download-20260925T015525Z-1-001'

target_files = [
    ('Enero', r'Enero\Informes\01 E 18- INFORME TECNICO MIN TRAB.pdf'),
    ('Enero', r'Enero\Informes\01 E30 - INFORME TECNICO MIN GOB.pdf'),
    ('Enero', r'Enero\Informes\01 E40- INFORME TECNICO MIN TRAB .pdf'),
    ('Febrero', r'Febrero\Informes\E 030 - INFORME TECNICO MIN GOB.pdf'),
    ('Marzo', r'Marzo\Informes\30707558691_UNIVERSIDADAUTONOMADEENTRERIOS_56_Esc 105 Patria Libre_mar26_INFORMETECNICO.pdf'),
    ('Marzo', r'Marzo\Informes\30712147829_ADMINISTRADORA TRIBUTARIA DE LA PROVINCIA DE ENTRE RIOS _67_ARCHIVOS GENERALES_mar26_INFORMETECNICO.pdf')
]

for m, rel in target_files:
    full = os.path.join(base, rel)
    r = pypdf.PdfReader(full)
    print(f"\n======================================")
    print(f"FILE: {rel}")
    for p_idx in range(min(5, len(r.pages))):
        txt = r.pages[p_idx].extract_text()
        print(f"--- P.{p_idx+1} ---")
        for line in txt.split('\n')[:15]:
            print("  ", line.strip())
