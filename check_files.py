import os, glob, sys, pypdf, re, json

sys.stdout.reconfigure(encoding='utf-8')

base = r'C:\Users\cript\Downloads\drive-download-20260925T015525Z-1-001'

def get_pdf_files_for_month(month_name):
    m_dir = os.path.join(base, month_name)
    if not os.path.exists(m_dir):
        return []
    
    pdf_files = []
    for root, dirs, files in os.walk(m_dir):
        for f in files:
            if not f.lower().endswith('.pdf'):
                continue
            full_path = os.path.join(root, f)
            fname_upper = f.upper()
            
            # For Enero, Febrero, Marzo, Abril: usually in "Informes" or root
            if month_name in ['Enero', 'Febrero', 'Marzo', 'Abril']:
                if 'INFORMES' in root.upper() or 'INFORME TECNICO' in fname_upper or 'INF TEC' in fname_upper or 'INF. TEC' in fname_upper:
                    pdf_files.append((full_path, root, f))
            elif month_name in ['Mayo', 'Junio']:
                # Filter for technical reports
                # In Mayo, the reports are inside EST... folders
                # In Junio, reports have INF TEC, INF.TECNICO, or if only one PDF exists
                if any(k in fname_upper for k in ['INF.TECNICO', 'INF TECNICO', 'INF TEC', 'INF. TEC', 'INFORME TECNICO', 'INFORME TÉCNICO', 'MAYO']):
                    pdf_files.append((full_path, root, f))
                elif month_name == 'Mayo':
                    # All PDFs in Mayo are the establishment reports
                    pdf_files.append((full_path, root, f))
                elif month_name == 'Junio':
                    # If in Junio there is a folder with only VISITA and AA, keep track
                    pass
    return pdf_files

for m in ['Enero', 'Febrero', 'Marzo', 'Mayo', 'Junio']:
    flist = get_pdf_files_for_month(m)
    print(f"Month: {m} -> {len(flist)} files detected")
    for fp, rt, fn in flist:
        print(f"  {fn}")
