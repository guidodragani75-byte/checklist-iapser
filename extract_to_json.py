import os, glob, sys, pypdf, re, json

sys.stdout.reconfigure(encoding='utf-8')

folder = r'C:\Users\cript\Downloads\drive-download-20260925T015525Z-1-001\Abril\Informes'
files = glob.glob(os.path.join(folder, '*.pdf'))

data = []

for idx, f in enumerate(files):
    fname = os.path.basename(f)
    reader = pypdf.PdfReader(f)
    total_pages = len(reader.pages)
    pages = [p.extract_text() for p in reader.pages]
    full_text = '\n'.join(pages)
    
    item = {
        'idx': idx + 1,
        'filename': fname,
        'total_pages': total_pages,
        'mes_carpeta': 'Abril',
    }
    
    # 1. CUIT
    cuit = ''
    m = re.search(r'C\.?U\.?I\.?T\.?:?\s*([0-9\-\s]{11,14})', full_text, re.IGNORECASE)
    if m:
        cuit = re.sub(r'[^0-9]', '', m.group(1))
    if not cuit or len(cuit) < 11:
        m2 = re.match(r'^(\d{11})_', fname)
        if m2:
            cuit = m2.group(1)
    item['cuit'] = cuit
    
    # 2. RS
    rs = ''
    # Let's search in page 1 to 4
    p1_4 = '\n'.join(pages[:4])
    m_rs = re.search(r'Razón Social:?\s*([^\n\r]+)', p1_4, re.IGNORECASE)
    if m_rs:
        rs = m_rs.group(1).strip()
    if not rs:
        m_rs = re.search(r'PROPIETARIO:?\s*([^\n\r]+)', p1_4, re.IGNORECASE)
        if m_rs:
            rs = m_rs.group(1).strip()
    if not rs:
        # Check first page lines
        for l in pages[0].split('\n') + pages[1].split('\n'):
            l_s = l.strip()
            if any(term in l_s.upper() for term in ['MINISTERIO', 'UNIVERSIDAD', 'ADMINISTRADORA']):
                rs = l_s
                break
    item['rs'] = rs
    
    # 3. Establecimiento
    estab = ''
    m_est = re.search(r'ESTABLECIMIENTO\s*(?:N[°º]|:)?\s*([0-9]+)', p1_4, re.IGNORECASE)
    if m_est:
        estab = m_est.group(1).strip()
    if not estab:
        m_est = re.search(r'ESTABLECIMIENTO\s*([0-9]+)', p1_4, re.IGNORECASE)
        if m_est:
            estab = m_est.group(1).strip()
    if not estab:
        # Check filename
        m_est = re.search(r'_(\d+)_', fname)
        if m_est:
            estab = m_est.group(1)
    item['establecimiento'] = estab
    
    # 4. Domicilio
    dom = ''
    m_dom = re.search(r'DOMICILIO:?\s*([^\n\r]+)', p1_4, re.IGNORECASE)
    if m_dom:
        dom = m_dom.group(1).strip()
    if not dom:
        m_dom = re.search(r'Dirección:?\s*([^\n\r]+)', full_text, re.IGNORECASE)
        if m_dom:
            dom = m_dom.group(1).strip()
    if not dom:
        # Look in memoria descriptiva
        for p in pages[2:6]:
            m_mem = re.search(r'ubicad[oa]\s+en\s+([^\n\r\.]+)', p, re.IGNORECASE)
            if m_mem:
                dom = m_mem.group(1).strip()
                break
    item['domicilio'] = dom
    
    # Let's collect all text sections mentioning measurements
    measurements_text = []
    for p_num, p_txt in enumerate(pages):
        for header in [
            'MEDICIÓN DE RESISTENCIA DE PUESTA A TIERRA',
            'MEDICIÓN DE RESISTENCIA DE PAT',
            'MEDICIÓN DE NIVELES DE ILUMINACIÓN',
            'MEDICIÓN DE ILUMINACIÓN',
            'CALIDAD DEL AGUA',
            'RESULTADOS DE ANALISIS DE AGUA',
            'RESULTADOS DE ANÁLISIS DE AGUA',
            'MEDICIÓN DE NIVELES DE RUIDO',
            'MEDICIÓN DE RUIDO'
        ]:
            if header in p_txt.upper():
                measurements_text.append({
                    'page': p_num + 1,
                    'header': header,
                    'text': p_txt
                })
    item['sections'] = measurements_text
    data.append(item)

with open(r'c:\Users\cript\OneDrive\Escritorio\Antigravity\Informes IAPSER\extracted_data.json', 'w', encoding='utf-8') as out:
    json.dump(data, out, ensure_ascii=False, indent=2)

print(f"Extracted {len(data)} items to extracted_data.json")
